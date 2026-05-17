/*
 * backend/controllers/servicePackageController.js
 * Controller for service package management.
 */
const mongoose = require('mongoose');
const ServicePackage = require('../../models/ServicePackage');
const School = require('../../models/School');

// GET: List service packages
exports.getServicePackages = async (req, res) => {
  try {
    const packages = await ServicePackage.find({})
      .sort({ name: 1 })
      .lean();

    // Get count of schools using each package
    const packageCounts = await School.aggregate([
      {
        $group: {
          _id: '$servicePackage',
          count: { $sum: 1 }
        }
      }
    ]);
    const countMap = new Map(packageCounts.map(p => [p._id, p.count]));

    packages.forEach(pkg => {
      pkg.schoolCount = countMap.get(pkg.name) || 0;
    });

    res.render('finance/service-packages/index', {
      user: req.session.user,
      page: 'finance/service-packages',
      packages
    });
  } catch (err) {
    console.error('Error fetching service packages:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load service packages' });
  }
};

// GET: Create/edit form
exports.getPackageForm = async (req, res) => {
  try {
    let pkg = null;
    if (req.params.id) {
      pkg = await ServicePackage.findById(req.params.id).lean();
    }

    res.render('finance/service-packages/form', {
      user: req.session.user,
      page: 'finance/service-packages',
      pkg
    });
  } catch (err) {
    console.error('Error loading package form:', err);
    res.status(500).render('404', { user: req.session.user, error: 'Failed to load form' });
  }
};

// POST: Create or update service package
exports.savePackage = async (req, res) => {
  try {
    const {
      name, displayName, description, pricingModel,
      ratePerStudent, monthlyRetainer, perEventFee, currency,
      features, defaultBillingCycle, invoicePrefix, paymentTermsDays,
      isActive
    } = req.body;

    const featuresArray = Array.isArray(features)
      ? features.map(f => ({
          name: f.name?.trim(),
          description: f.description?.trim(),
          included: f.included === 'true'
        }))
      : [];

    const pkgData = {
      displayName: displayName.trim(),
      description,
      pricingModel,
      ratePerStudent: parseFloat(ratePerStudent) || 0,
      monthlyRetainer: parseFloat(monthlyRetainer) || 0,
      perEventFee: parseFloat(perEventFee) || 0,
      currency,
      features: featuresArray,
      defaultBillingCycle,
      invoicePrefix: invoicePrefix?.trim() || 'INV',
      paymentTermsDays: parseInt(paymentTermsDays) || 30,
      isActive: isActive === 'true'
    };

    let pkg;
    if (req.params.id) {
      pkg = await ServicePackage.findByIdAndUpdate(
        req.params.id,
        { $set: pkgData },
        { new: true, runValidators: true }
      );
    } else {
      pkg = new ServicePackage({
        name,
        ...pkgData,
        createdBy: req.session.user?.id ? new mongoose.Types.ObjectId(req.session.user.id) : null
      });
      await pkg.save();
    }

    res.json({ success: true, pkg });
  } catch (err) {
    console.error('Error saving service package:', err);
    res.status(500).json({ success: false, error: 'Failed to save package' });
  }
};

// DELETE: Service package
exports.deletePackage = async (req, res) => {
  try {
    const pkg = await ServicePackage.findById(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, error: 'Package not found' });
    }

    // Check if any schools are using this package
    const schoolCount = await School.countDocuments({ servicePackage: pkg.name });
    if (schoolCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete package used by ${schoolCount} school(s). Deactivate instead.`
      });
    }

    await ServicePackage.deleteOne({ _id: pkg._id });
    res.json({ success: true, message: 'Package deleted' });
  } catch (err) {
    console.error('Error deleting package:', err);
    res.status(500).json({ success: false, error: 'Failed to delete package' });
  }
};

module.exports = exports;
