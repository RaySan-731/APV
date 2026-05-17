/*
 * backend/controllers/budgetController.js
 * Controller for budget management - create, track, and alert.
 */
const mongoose = require('mongoose');
const Budget = require('../../models/Budget');
const Expense = require('../../models/Expense');
const Event = require('../../models/Event');

// GET: Budget list
exports.getBudgets = async (req, res) => {
  try {
    const { type, period, status, eventId, page = 1, limit = 20 } = req.query;

    const query = {};
    if (type) query.type = type;
    if (period) query.period = period;
    if (status) query.status = status;
    if (eventId) query.eventId = new mongoose.Types.ObjectId(eventId);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [budgets, total] = await Promise.all([
      Budget.find(query)
        .populate('eventId', 'name')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Budget.countDocuments(query)
    ]);

    // Alerts summary
    const alertBudgets = await Budget.find({
      status: 'active',
      alertTriggered: true,
      criticalAlertTriggered: false
    }).count();

    const criticalAlertBudgets = await Budget.find({
      status: 'active',
      criticalAlertTriggered: true
    }).count();

    res.render('finance/budgets/index', {
      user: req.session.user,
      page: 'finance/budgets',
      budgets,
      alertBudgets,
      criticalAlertBudgets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      filters: { type, period, status, eventId },
      expenseCategories: [
        'equipment', 'transport', 'venue', 'materials', 'catering',
        'accommodation', 'trainer_allowance', 'marketing', 'utilities',
        'office', 'other'
      ]
    });
  } catch (err) {
    console.error('Error fetching budgets:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load budgets' });
  }
};

// GET: Create budget form
exports.getCreateBudget = async (req, res) => {
  try {
    const { type, eventId } = req.query;

    let preselectedEvent = null;
    if (eventId) {
      preselectedEvent = await Event.findById(eventId).lean();
    }

    res.render('finance/budgets/create', {
      user: req.session.user,
      page: 'finance/budgets',
      events: await Event.find({ status: { $in: ['scheduled', 'confirmed', 'in_progress'] } }).select('_id name startDate').lean(),
      type: type || 'event',
      preselectedEvent,
      expenseCategories: [
        'equipment', 'transport', 'venue', 'materials', 'catering',
        'accommodation', 'trainer_allowance', 'marketing', 'utilities',
        'office', 'other'
      ]
    });
  } catch (err) {
    console.error('Error loading create budget form:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load form' });
  }
};

// POST: Create new budget
exports.createBudget = async (req, res) => {
  try {
    const {
      name, code, type, period,
      eventId, department,
      categories, // Array of { category, allocated }
      notes, status
    } = req.body;

    const totalAllocated = (categories || []).reduce((sum, cat) => sum + (parseFloat(cat.allocated) || 0), 0);

    const parsedCategories = (categories || []).map(cat => ({
      category: cat.category,
      allocated: parseFloat(cat.allocated) || 0,
      spent: 0,
      notes: cat.notes || ''
    }));

    const budget = new Budget({
      name: name.trim(),
      code: code.trim(),
      type,
      period: period.trim(),
      eventId: eventId || null,
      department: department?.trim(),
      categories: parsedCategories,
      totalAllocated,
      totalSpent: 0,
      totalRemaining: totalAllocated,
      status: status || 'draft',
      approvedBy: req.session.user?.id ? new mongoose.Types.ObjectId(req.session.user.id) : null,
      approvedAt: status === 'active' ? new Date() : null,
      notes,
      createdBy: req.session.user?.id ? new mongoose.Types.ObjectId(req.session.user.id) : null
    });

    await budget.save();

    res.json({ success: true, budget });
  } catch (err) {
    console.error('Error creating budget:', err);
    res.status(500).json({ success: false, error: 'Failed to create budget' });
  }
};

// GET: Budget detail
exports.getBudget = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id)
      .populate('eventId', 'name')
      .populate('createdBy', 'name');

    if (!budget) {
      return res.status(404).render('404', { user: req.session.user, error: 'Budget not found' });
    }

    // Get expenses linked to this budget
    const expenses = await Expense.find({ budgetId: budget._id })
      .sort({ paidDate: -1 })
      .lean();

    // Spending by category
    const categorySpending = await Expense.aggregate([
      { $match: { budgetId: budget._id } },
      {
        $group: {
          _id: '$category',
          amount: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.render('finance/budgets/detail', {
      user: req.session.user,
      page: 'finance/budgets',
      budget,
      expenses,
      categorySpending,
      expenseCategories: [
        'equipment', 'transport', 'venue', 'materials', 'catering',
        'accommodation', 'trainer_allowance', 'marketing', 'utilities',
        'office', 'other'
      ]
    });
  } catch (err) {
    console.error('Error fetching budget:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load budget' });
  }
};

// POST: Update budget status
exports.updateBudgetStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const budget = await Budget.findById(req.params.id);

    if (!budget) {
      return res.status(404).json({ success: false, error: 'Budget not found' });
    }

    budget.status = status;
    if (status === 'active' && !budget.approvedBy) {
      budget.approvedBy = req.session.user?.id ? new mongoose.Types.ObjectId(req.session.user.id) : null;
      budget.approvedAt = new Date();
    }
    await budget.save();

    res.json({ success: true, budget });
  } catch (err) {
    console.error('Error updating budget status:', err);
    res.status(500).json({ success: false, error: 'Failed to update budget' });
  }
};

// GET: Budget analytics (spending vs allocated)
exports.getBudgetAnalytics = async (req, res) => {
  try {
    const { type, period } = req.query;
    const query = { status: 'active' };
    if (type) query.type = type;
    if (period) query.period = period;

    const budgets = await Budget.find(query).lean();

    const result = budgets.map(budget => ({
      name: budget.name,
      type: budget.type,
      allocated: budget.totalAllocated,
      spent: budget.totalSpent,
      remaining: budget.totalRemaining,
      spentPercent: (budget.totalSpent / budget.totalAllocated * 100).toFixed(1),
      alertTriggered: budget.alertTriggered,
      criticalAlertTriggered: budget.criticalAlertTriggered,
      categories: budget.categories
    }));

    res.json({ success: true, budgets: result });
  } catch (err) {
    console.error('Error fetching budget analytics:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
};

module.exports = exports;
