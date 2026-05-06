/*
 * backend/controllers/expenseController.js
 * Controller for expense tracking and management.
 */
const mongoose = require('mongoose');
const Expense = require('../../models/Expense');
const Event = require('../../models/Event');
const School = require('../../models/School');
const Staff = require('../../models/Staff');
const Budget = require('../../models/Budget');

// GET: List expenses with filters
exports.getExpenses = async (req, res) => {
  try {
    const {
      eventId,
      schoolId,
      staffId,
      category,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};
    if (eventId) query.eventId = mongoose.Types.ObjectId(eventId);
    if (schoolId) query.schoolId = mongoose.Types.ObjectId(schoolId);
    if (staffId) query.staffId = mongoose.Types.ObjectId(staffId);
    if (category) query.category = category;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.paidDate = {};
      if (startDate) query.paidDate.$gte = new Date(startDate);
      if (endDate) query.paidDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .populate('eventId', 'name')
        .populate('schoolId', 'name')
        .populate('staffId', 'name')
        .populate('paidBy', 'name')
        .sort({ paidDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Expense.countDocuments(query)
    ]);

    // Category summary
    const categorySummary = await Expense.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.render('finance/expenses/index', {
      user: req.session.user,
      page: 'finance/expenses',
      expenses,
      categorySummary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      filters: { eventId, schoolId, staffId, category, status, startDate, endDate }
    });
  } catch (err) {
    console.error('Error fetching expenses:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load expenses' });
  }
};

// GET: Create expense form
exports.getCreateExpense = async (req, res) => {
  try {
    const { eventId } = req.query;

    let preselectedEvent = null;
    if (eventId) {
      preselectedEvent = await Event.findById(eventId).lean();
    }

    res.render('finance/expenses/create', {
      user: req.session.user,
      page: 'finance/expenses',
      events: await Event.find({ status: { $in: ['completed', 'in_progress'] } }).select('_id name startDate').lean(),
      schools: await School.find({}).select('_id name').lean(),
      staff: await Staff.find({}).select('_id name').lean(),
      preselectedEvent,
      budgetCategories: [
        'equipment', 'transport', 'venue', 'materials', 'catering',
        'accommodation', 'trainer_allowance', 'marketing', 'utilities',
        'office', 'other'
      ]
    });
  } catch (err) {
    console.error('Error loading create expense form:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load form' });
  }
};

// POST: Create new expense
exports.createExpense = async (req, res) => {
  try {
    const {
      title, description, category, amount, taxAmount, discount,
      eventId, schoolId, staffId,
      paymentMethod, paymentReference, paidDate, paidBy,
      isReimbursement, reimbursedTo,
      budgetId, status, notes, rejectionReason
    } = req.body;

    // Net amount calculation
    const netAmount = (parseFloat(amount) || 0) - (parseFloat(discount) || 0);

    const expense = new Expense({
      title: title.trim(),
      description,
      category,
      amount: parseFloat(amount) || 0,
      taxAmount: parseFloat(taxAmount) || 0,
      discount: parseFloat(discount) || 0,
      netAmount,
      eventId: eventId || null,
      schoolId: schoolId || null,
      staffId: staffId || null,
      paymentMethod,
      paymentReference,
      paidDate: paidDate ? new Date(paidDate) : null,
      paidBy: paidBy || null,
      isReimbursement: isReimbursement === 'true',
      reimbursedTo: reimbursedTo || null,
      budgetId: budgetId || null,
      status: status || 'pending',
      notes,
      rejectionReason,
      createdBy: req.session.user?.id ? mongoose.Types.ObjectId(req.session.user.id) : null
    });

    await expense.save();

    // If approved, update budget spent if linked
    if (status === 'approved' && budgetId) {
      await Budget.findByIdAndUpdate(budgetId, {
        $inc: { 'categories.$[elem].spent': netAmount }
      }, {
        arrayFilters: [{ 'elem.category': category }]
      });
    }

    res.json({ success: true, expense });
  } catch (err) {
    console.error('Error creating expense:', err);
    res.status(500).json({ success: false, error: 'Failed to create expense' });
  }
};

// POST: Upload receipt
exports.uploadReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { expenseId } = req.body;
    const expense = await Expense.findById(expenseId);

    if (!expense) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }

    expense.receiptUrl = `/uploads/receipts/${req.file.filename}`;
    expense.receiptFileName = req.file.originalname;
    expense.uploadedBy = req.session.user?.id ? mongoose.Types.ObjectId(req.session.user.id) : null;
    expense.uploadedAt = new Date();
    await expense.save();

    res.json({ success: true, receiptUrl: expense.receiptUrl });
  } catch (err) {
    console.error('Error uploading receipt:', err);
    res.status(500).json({ success: false, error: 'Failed to upload receipt' });
  }
};

// POST: Approve/reject expense
exports.updateExpenseStatus = async (req, res) => {
  try {
    const { status, approvedAmount, rejectionReason } = req.body;
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }

    expense.status = status;
    if (status === 'approved') {
      expense.approvedBy = req.session.user?.id ? mongoose.Types.ObjectId(req.session.user.id) : null;
      expense.approvedAt = new Date();
      expense.approvedAmount = parseFloat(approvedAmount) || expense.netAmount;
    } else if (status === 'rejected') {
      expense.rejectionReason = rejectionReason;
    }
    await expense.save();

    res.json({ success: true, expense });
  } catch (err) {
    console.error('Error updating expense status:', err);
    res.status(500).json({ success: false, error: 'Failed to update expense' });
  }
};

// GET: Expense analytics
exports.getExpenseAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'category' } = req.query;

    const match = {};
    if (startDate || endDate) {
      match.paidDate = {};
      if (startDate) match.paidDate.$gte = new Date(startDate);
      if (endDate) match.paidDate.$lte = new Date(endDate);
    }

    let groupField = '$category';
    if (groupBy === 'month') {
      groupField = { $dateToString: { format: '%Y-%m', date: '$paidDate' } };
    } else if (groupBy === 'event') {
      groupField = '$eventId';
    } else if (groupBy === 'staff') {
      groupField = '$staffId';
    }

    const analytics = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupField,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Populate names if grouped by event or staff
    if (groupBy === 'event') {
      const eventIds = analytics.map(a => a._id).filter(id => id);
      const events = await Event.find({ _id: { $in: eventIds } }).select('_id name').lean();
      const eventMap = new Map(events.map(e => [e._id.toString(), e.name]));
      analytics.forEach(a => {
        a.name = eventMap.get(a._id?.toString()) || 'Unknown Event';
      });
    } else if (groupBy === 'staff') {
      const staffIds = analytics.map(a => a._id).filter(id => id);
      const staff = await Staff.find({ _id: { $in: staffIds } }).select('_id name').lean();
      const staffMap = new Map(staff.map(s => [s._id.toString(), s.name]));
      analytics.forEach(a => {
        a.name = staffMap.get(a._id?.toString()) || 'Unknown Staff';
      });
    }

    res.json({ success: true, analytics });
  } catch (err) {
    console.error('Error fetching expense analytics:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
};

module.exports = exports;
