/*
 * backend/controllers/schoolController.js
 * Handles all school admin dashboard data and operations
 * with strict data isolation per school
 */

const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');

const School = require('../../models/School');
const Staff = require('../../models/Staff');
const Student = require('../../models/Student');
const ScoutGroup = require('../../models/ScoutGroup');
const Event = require('../../models/Event');
const Invoice = require('../../models/Invoice');
const SchoolDocument = require('../../models/SchoolDocument');
const Message = require('../../models/Message');
const Notification = require('../../models/Notification');
const VisitLog = require('../../models/VisitLog');
const AuditLog = require('../../models/AuditLog');
const logAudit = require('../../server').logAudit;

// GET: School admin dashboard homepage data
exports.getDashboardData = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const school = req.school;

    // Parallel fetch all dashboard data
    const [
      totalStudents,
      activeGroupsCount,
      upcomingEvents,
      pastEventsCount,
      pendingInvoices,
      totalPaidThisYear,
      unreadNotificationsCount,
      unreadMessagesCount,
      lastVisit,
      pendingActions,
      recentStudents
    ] = await Promise.all([
      // Total students
      Student.countDocuments({ school: schoolId, status: 'active' }),
      // Active student groups
      ScoutGroup.countDocuments({ schoolId, status: 'active' }),
      // Upcoming events (next 30 days, status confirmed/in_progress)
      Event.find({
        'targetSchools.schoolId': schoolId,
        startDate: { $gte: new Date(), $lte: new Date(Date.now() + 30*24*60*60*1000) },
        status: { $in: ['confirmed', 'in_progress', 'scheduled'] }
      }).sort({ startDate: 1 }).lean(),
      // Past events count (for trends)
      Event.countDocuments({
        'targetSchools.schoolId': schoolId,
        status: 'completed'
      }),
      // Pending invoices
      Invoice.countDocuments({
        schoolId,
        status: { $in: ['issued', 'sent', 'partial', 'overdue'] }
      }),
      // Total paid this year
      Invoice.aggregate([
        {
          $match: {
            schoolId: new mongoose.Types.ObjectId(schoolId),
            status: 'paid',
            paidDate: { $gte: new Date(new Date().getFullYear(), 0, 1) }
          }
        },
        {
          $group: {
            _id: null,
            totalPaid: { $sum: '$totalAmount' }
          }
        }
      ]),
      // Unread notifications
      Notification.countDocuments({
        recipientId: req.staff._id,
        isRead: false,
        dismissed: false
      }),
      // Unread messages
      Message.countDocuments({
        'recipients.staffId': req.staff._id,
        'recipients.status': 'sent',
        'recipients.deleted': { $ne: true }
      }),
      // Last visit date
      VisitLog.findOne({ schoolId }).sort({ date: -1 }).select('date').lean(),
      // Pending actions summary
      calculatePendingActions(schoolId, req.staff._id),
      // Recent students (last 5) with trainer info
      Student.find({ school: schoolId, status: 'active' })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('assignedTrainer', 'name')
        .lean()
    ]);

    const totalPaid = totalPaidThisYear[0]?.totalPaid || 0;

    // Transform recent students to include trainer names
    const transformedRecentStudents = recentStudents.map(s => ({
      _id: s._id,
      fullName: s.fullName,
      scoutSection: s.scoutSection,
      assignedTrainerName: s.assignedTrainer?.name || 'Unassigned',
      createdAt: s.createdAt
    }));

    // Days since last visit
    let daysSinceLastVisit = null;
    if (lastVisit) {
      const diffTime = Math.abs(new Date() - new Date(lastVisit.date));
      daysSinceLastVisit = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Notifications (last 5 unread)
    const recentNotifications = await Notification.find({
      recipientId: req.staff._id,
      isRead: false,
      dismissed: false
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

    // Build pending actions array with counts
    const pendingActionsList = await buildPendingActions(schoolId, req.staff._id);

    res.json({
      success: true,
      data: {
        school: {
          name: school.name,
          serviceStatus: school.serviceStatus,
          status: school.status,
          onboardingDate: school.onboardingDate
        },
         stats: {
           totalStudents,
           activeGroupsCount,
          upcomingEventsCount: upcomingEvents.length,
          pastEventsCount,
          pendingInvoices,
          totalPaidThisYear: totalPaid,
          daysSinceLastVisit
        },
        nextEvent: upcomingEvents.length > 0 ? {
          id: upcomingEvents[0]._id,
          name: upcomingEvents[0].name,
          startDate: upcomingEvents[0].startDate,
          endDate: upcomingEvents[0].endDate,
          eventType: upcomingEvents[0].eventType,
          location: upcomingEvents[0].location?.name
        } : null,
        notifications: {
          unreadCount: unreadNotificationsCount,
          recent: recentNotifications.map(n => ({
            id: n._id,
            type: n.type,
            title: n.title,
            message: n.message,
            createdAt: n.createdAt,
            actionUrl: n.actionUrl
          }))
        },
        messages: {
          unreadCount: unreadMessagesCount
        },
        pendingActions: pendingActionsList,
        recentStudents: transformedRecentStudents,
        serviceStatusIndicator: {
          status: school.serviceStatus,
          lastVisit: daysSinceLastVisit
        }
      }
    });
  } catch (err) {
    console.error('Dashboard data error:', err);
    res.status(500).json({ success: false, error: 'Failed to load dashboard data' });
  }
};

// GET: Full school profile
exports.getSchoolProfile = async (req, res) => {
  try {
    const school = await School.findById(req.schoolId).lean();

    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    // Get assigned trainer info
    const primaryStaff = school.assignedStaff?.find(a => a.assignmentType === 'primary');
    let trainerInfo = null;
    if (primaryStaff?.staffId) {
      const trainer = await Staff.findById(primaryStaff.staffId).select('name email phone').lean();
      if (trainer) {
        trainerInfo = trainer;
      }
    }

    res.json({
      success: true,
      data: {
        school,
        trainer: trainerInfo
      }
    });
  } catch (err) {
    console.error('Get school profile error:', err);
    res.status(500).json({ success: false, error: 'Failed to load school profile' });
  }
};

// POST: Update school profile (limited fields)
exports.updateSchoolProfile = async (req, res) => {
  try {
    const { phone, adminEmail, logo } = req.body;

    const updateData = {};
    if (phone !== undefined) updateData['contactPerson.phone'] = phone.trim();
    if (adminEmail !== undefined) updateData['contactPerson.email'] = adminEmail.trim().toLowerCase();
    if (logo !== undefined) updateData['logoUrl'] = logo.trim();

    // Capture old values for audit
    const oldSchool = await School.findById(req.schoolId).lean();
    const fieldsChanged = Object.keys(updateData);

    const updatedSchool = await School.findByIdAndUpdate(
      req.schoolId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    // Log audit
    await logAudit(
      'school_updated',
      'school',
      req.schoolId,
      oldSchool.name,
      {
        oldValues: fieldsChanged.reduce((acc, field) => {
          acc[field] = oldSchool[field];
          return acc;
        }, {}),
        newValues: fieldsChanged.reduce((acc, field) => {
          acc[field] = updatedSchool[field];
          return acc;
        }, {})
      },
      {
        userId: req.staff._id,
        userName: req.staff.name,
        userEmail: req.staff.email,
        userRole: req.staff.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );

    res.json({
      success: true,
      data: updatedSchool,
      message: 'Profile updated successfully'
    });
  } catch (err) {
    console.error('Update school profile error:', err);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
};

// GET: Scout groups and students
exports.getStudentsData = async (req, res) => {
  try {
    const schoolId = req.schoolId;

    const [
      groups,
      students
    ] = await Promise.all([
      ScoutGroup.find({ schoolId }).sort({ name: 1 }).lean(),
      Student.find({ school: schoolId, status: 'active' })
        .sort({ fullName: 1 })
        .populate('assignedTrainer', 'name email')
        .populate('addedBy.trainerId', 'name')
        .lean()
    ]);

    // Transform students to include readable trainer names
    const transformedStudents = students.map(student => ({
      ...student,
      assignedTrainerName: student.assignedTrainer?.name || 'Unassigned',
      addedByName: student.addedBy?.trainerId?.name || 'Unknown'
    }));

    res.json({
      success: true,
      data: {
        groups,
        students: transformedStudents,
        totalStudents: transformedStudents.length
      }
    });
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ success: false, error: 'Failed to load students data' });
  }
};

// POST: Update student record
exports.updateStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { fullName, scoutSection, advancementNotes, assignedTrainer } = req.body;

    const student = await Student.findOne({
      _id: studentId,
      school: req.schoolId,
      status: 'active'
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Validate assignedTrainer if provided
    if (assignedTrainer) {
      const trainerExists = await Staff.findById(assignedTrainer);
      if (!trainerExists) {
        return res.status(400).json({ success: false, error: 'Invalid trainer selected' });
      }
      // Ensure trainer is assigned to this school
      const school = await School.findById(req.schoolId);
      const isTrainerAssigned = school.assignedStaff?.some(
        a => a.staffId.equals(assignedTrainer) && a.status === 'active'
      );
      if (!isTrainerAssigned) {
        return res.status(400).json({ success: false, error: 'Selected trainer is not assigned to this school' });
      }
    }

    // Store changes for approval (could create a pending update model)
    // For now, direct update with audit log (in production, require trainer approval)
    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName.trim();
    if (scoutSection !== undefined) updateData.scoutSection = scoutSection;
    if (advancementNotes !== undefined) updateData.advancementNotes = advancementNotes;
    if (assignedTrainer !== undefined) updateData.assignedTrainer = assignedTrainer || null;

    const oldStudent = student.toObject();

    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    // Log audit
    await logAudit(
      'student_updated',
      'student',
      studentId,
      oldStudent.fullName,
      {
        oldValues: { ...oldStudent },
        newValues: { ...updatedStudent }
      },
      {
        userId: req.staff._id,
        userName: req.staff.name,
        userEmail: req.staff.email,
        userRole: req.staff.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );

    res.json({
      success: true,
      data: updatedStudent
    });
  } catch (err) {
    console.error('Update student error:', err);
    res.status(500).json({ success: false, error: 'Failed to update student' });
  }
};

// POST: Add new student
exports.addStudent = async (req, res) => {
  try {
    const { fullName, dateOfBirth, gender, parentName, parentPhone, parentEmail, scoutSection, assignedTrainer } = req.body;

    if (!fullName || !dateOfBirth || !gender || !parentPhone || !parentEmail || !scoutSection) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    // Validate assignedTrainer if provided
    if (assignedTrainer) {
      const trainerExists = await Staff.findById(assignedTrainer);
      if (!trainerExists) {
        return res.status(400).json({ success: false, error: 'Invalid trainer selected' });
      }
      const school = await School.findById(req.schoolId);
      const isTrainerAssigned = school.assignedStaff?.some(
        a => a.staffId.equals(assignedTrainer) && a.status === 'active'
      );
      if (!isTrainerAssigned) {
        return res.status(400).json({ success: false, error: 'Selected trainer is not assigned to this school' });
      }
    }

    const newStudent = new Student({
      fullName: fullName.trim(),
      dateOfBirth: new Date(dateOfBirth),
      gender,
      parentContact: {
        name: parentName?.trim() || 'Parent',
        phone: parentPhone.trim(),
        email: parentEmail.trim().toLowerCase(),
        relationship: 'Parent'
      },
      scoutSection,
      school: req.schoolId,
      addedBy: {
        trainerId: req.staff._id
      },
      assignedTrainer: assignedTrainer || null,
      status: 'active'
    });

    await newStudent.save();

    // Return saved student with populated names
    const savedStudent = await Student.findById(newStudent._id)
      .populate('assignedTrainer', 'name')
      .populate('addedBy.trainerId', 'name')
      .lean();

    const result = {
      ...savedStudent,
      assignedTrainerName: savedStudent.assignedTrainer?.name || 'Unassigned',
      addedByName: savedStudent.addedBy?.trainerId?.name || 'Unknown'
    };

    // Log audit
    await logAudit(
      'student_created',
      'student',
      newStudent._id,
      newStudent.fullName,
      { newValues: result },
      {
        userId: req.staff._id,
        userName: req.staff.name,
        userEmail: req.staff.email,
        userRole: req.staff.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Student added successfully'
    });
  } catch (err) {
    console.error('Add student error:', err);
    res.status(500).json({ success: false, error: 'Failed to add student' });
  }
};

    // Log audit
    await logAudit(
      'scout_created',
      'student',
      newScout._id,
      newScout.fullName,
      { newValues: result },
      {
        userId: req.staff._id,
        userName: req.staff.name,
        userEmail: req.staff.email,
        userRole: req.staff.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Scout added successfully'
    });
  } catch (err) {
    console.error('Add student error:', err);
    res.status(500).json({ success: false, error: 'Failed to Add student' });
  }
};

// GET: Events (upcoming and past)
exports.getEvents = async (req, res) => {
  try {
    const { status = 'upcoming', page = 1, limit = 20 } = req.query;
    const schoolId = req.schoolId;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { 'targetSchools.schoolId': schoolId };

    if (status === 'upcoming') {
      query.startDate = { $gte: new Date() };
      query.status = { $in: ['scheduled', 'confirmed', 'in_progress'] };
    } else if (status === 'past') {
      query.$or = [
        { startDate: { $lt: new Date() } },
        { status: { $in: ['completed', 'cancelled', 'archived'] } }
      ];
    }

    const events = await Event.find(query)
      .sort({ startDate: status === 'upcoming' ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ success: false, error: 'Failed to load events' });
  }
};

// GET: Single event details (with RSVP/attendance for school admin)
exports.getEventDetails = async (req, res) => {
  try {
    const { eventId } = req.params;
    const schoolId = req.schoolId;

    const event = await Event.findById(eventId)
      .populate('trainers.trainerId', 'name email')
      .lean();

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Verify this school is invited to this event
    const schoolInvitation = event.targetSchools?.find(
      ts => ts.schoolId.toString() === schoolId.toString()
    );

    if (!schoolInvitation) {
      return res.status(403).json({ success: false, error: 'Access denied to event' });
    }

    res.json({
      success: true,
      data: {
        event,
        schoolInvitation
      }
    });
  } catch (err) {
    console.error('Get event error:', err);
    res.status(500).json({ success: false, error: 'Failed to load event' });
  }
};

// POST: Mark attendance/confirm participation for event
exports.updateEventAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { rsvpStatus, attendingCount, participantDetails } = req.body;

    const schoolId = req.schoolId;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const schoolInvitation = event.targetSchools?.find(
      ts => ts.schoolId.toString() === schoolId.toString()
    );

    if (!schoolInvitation) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Update invitation RSVP
    schoolInvitation.rsvpStatus = rsvpStatus || schoolInvitation.rsvpStatus;
    schoolInvitation.rsvpResponseDate = new Date();
    schoolInvitation.rsvpResponseBy = req.staff._id;

    if (attendingCount !== undefined) {
      schoolInvitation.attendance.registered = parseInt(attendingCount);
    }

    if (participantDetails) {
      schoolInvitation.participantDetails = participantDetails;
    }

    await event.save();

    // Log audit
    await logAudit(
      'event_attendance_updated',
      'event',
      eventId,
      event.name,
      {
        rsvpStatus: schoolInvitation.rsvpStatus,
        attendingCount: schoolInvitation.attendance.registered
      },
      {
        userId: req.staff._id,
        userName: req.staff.name,
        userEmail: req.staff.email,
        userRole: req.staff.role
      }
    );

    res.json({
      success: true,
      message: 'Attendance updated successfully',
      data: { schoolInvitation }
    });
  } catch (err) {
    console.error('Update attendance error:', err);
    res.status(500).json({ success: false, error: 'Failed to update attendance' });
  }
};

// GET: Payment history / invoices
exports.getInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const schoolId = req.schoolId;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { schoolId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const invoices = await Invoice.find(query)
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Invoice.countDocuments(query);

    // Calculate summary stats
    const stats = await Invoice.aggregate([
      {
        $match: {
          schoolId: new mongoose.Types.ObjectId(schoolId)
        }
      },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$amountPaid' },
          overdueCount: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$status', 'issued'] },
                  { $lt: ['$dueDate', new Date()] }
                ]},
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        invoices,
        stats: stats[0] || { totalInvoiced: 0, totalPaid: 0, overdueCount: 0 },
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ success: false, error: 'Failed to load invoices' });
  }
};

// GET: Download invoice as PDF
exports.downloadInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const schoolId = req.schoolId;

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      schoolId
    }).populate('schoolId', 'name email address contactPerson billingAddress').lean();

    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    const doc = new PDFDocument({ margin: 50 });
    const filename = `invoice_${invoice.invoiceNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();

    // Invoice details
    doc.fontSize(12);
    doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
    doc.text(`Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}`);
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`);
    doc.moveDown();

    // Bill To
    doc.fontSize(14).text('Bill To:');
    doc.fontSize(12);
    const school = invoice.schoolId;
    doc.text(school?.name || 'Unknown');
    if (school?.billingAddress) {
      doc.text(school.billingAddress.address || '');
      doc.text(`${school.billingAddress.city || ''}, ${school.billingAddress.country || ''}`);
    }
    doc.moveDown();

    // Items table
    doc.fontSize(12);
    let y = doc.y;
    // Table header
    doc.font('Helvetica-Bold');
    doc.text('Description', 50, y);
    doc.text('Qty', 350, y, { width: 50, align: 'right' });
    doc.text('Unit Price', 420, y, { width: 80, align: 'right' });
    doc.text('Total', 500, y, { width: 80, align: 'right' });
    doc.font('Helvetica');
    y += 20;
    doc.moveTo(50, y).lineTo(570, y).stroke();

    // Items
    y += 10;
    invoice.items.forEach(item => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.text(item.description.substring(0, 50), 50, y, { width: 280, height: 20 });
      doc.text(item.quantity.toString(), 350, y, { width: 50, align: 'right' });
      doc.text(`KES ${item.unitPrice.toFixed(2)}`, 420, y, { width: 80, align: 'right' });
      doc.text(`KES ${item.total.toFixed(2)}`, 500, y, { width: 80, align: 'right' });
      y += 20;
    });

    // Totals
    y += 10;
    doc.moveTo(400, y).lineTo(570, y).stroke();
    y += 20;
    doc.font('Helvetica-Bold');
    doc.text(`Subtotal: KES ${invoice.subtotal.toFixed(2)}`, 420, y, { width: 140, align: 'right' });
    y += 20;
    doc.text(`Total: KES ${invoice.totalAmount.toFixed(2)}`, 420, y, { width: 140, align: 'right' });
    y += 20;
    doc.text(`Balance Due: KES ${invoice.balance.toFixed(2)}`, 420, y, { width: 140, align: 'right' });

    // Payment instructions
    doc.moveDown(2);
    doc.font('Helvetica');
    doc.text('Payment Instructions:', { underline: true });
    doc.text(`Bank: ${invoice.bankDetails?.bankName || 'APV Ventures Ltd'}`);
    doc.text(`Account: ${invoice.bankDetails?.accountName || 'Arrow-Park Ventures'}`);
    doc.text(`Account No: ${invoice.bankDetails?.accountNumber || ''}`);
    doc.text(`M-Pesa Till: ${invoice.bankDetails?.mpesaTillNumber || ''}`);

    doc.end();
  } catch (err) {
    console.error('Download invoice error:', err);
    res.status(500).send('Failed to generate PDF');
  }
};

// POST: Raise payment query
exports.raisePaymentQuery = async (req, res) => {
  try {
    const { invoiceId, subject, message } = req.body;

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      schoolId: req.schoolId
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Create a message to founders/admins about payment query
    const founders = await Staff.find({ role: { $in: ['admin', 'founder'] } }).select('_id').lean();
    const founderIds = founders.map(f => f._id);

    const newMessage = new Message({
      senderId: req.staff._id,
      senderName: req.staff.name,
      senderRole: 'school_admin',
      recipients: founderIds.map(id => ({ staffId: id, status: 'sent' })),
      subject: `Payment Query - Invoice ${invoice.invoiceNumber}`,
      body: `Invoice: ${invoice.invoiceNumber}\nAmount: ${invoice.totalAmount} ${invoice.currency}\n\nQuery: ${message}`,
      messageType: 'direct',
      priority: 'normal'
    });

    await newMessage.save();

    // Update invoice notes
    await Invoice.findByIdAndUpdate(invoiceId, {
      $push: {
        notes: `Payment query raised by ${req.staff.name} on ${new Date().toISOString()}: ${message}`
      }
    });

    // Log audit
    await logAudit(
      'payment_query_raised',
      'invoice',
      invoiceId,
      invoice.invoiceNumber,
      { subject, message },
      {
        userId: req.staff._id,
        userName: req.staff.name,
        userEmail: req.staff.email,
        userRole: req.staff.role
      }
    );

    res.json({
      success: true,
      message: 'Payment query submitted successfully'
    });
  } catch (err) {
    console.error('Raise payment query error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit query' });
  }
};

// GET: School documents
exports.getDocuments = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const schoolId = req.schoolId;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { schoolId };
    if (type && type !== 'all') {
      query.documentType = type;
    }

    const documents = await SchoolDocument.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await SchoolDocument.countDocuments(query);

    res.json({
      success: true,
      data: {
        documents,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    console.error('Get documents error:', err);
    res.status(500).json({ success: false, error: 'Failed to load documents' });
  }
};

// POST: Upload document
exports.uploadDocument = async (req, res) => {
  try {
    const { documentType, name, description, expiryDate } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const document = new SchoolDocument({
      schoolId: req.schoolId,
      documentType: documentType || 'other',
      name: name || req.file.originalname,
      description,
      url: `/uploads/documents/${req.file.filename}`,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      uploadedBy: req.staff._id
    });

    await document.save();

    // Log audit
    await logAudit(
      'document_uploaded',
      'schoolDocument',
      document._id,
      document.name,
      { documentType },
      {
        userId: req.staff._id,
        userName: req.staff.name,
        userEmail: req.staff.email,
        userRole: req.staff.role
      }
    );

    res.status(201).json({
      success: true,
      data: document,
      message: 'Document uploaded successfully'
    });
  } catch (err) {
    console.error('Upload document error:', err);
    res.status(500).json({ success: false, error: 'Failed to upload document' });
  }
};

// GET: Communication / messages between school and founder
exports.getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const schoolId = req.schoolId;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find all founders/admins to use as recipient IDs
    const founders = await Staff.find({ role: { $in: ['admin', 'founder'] } }).select('_id').lean();
    const founderIds = founders.map(f => f._id);

    // Find messages between school admin and founders
    const messages = await Message.find({
      $or: [
        { senderId: req.staff._id, 'recipients.staffId': { $in: founderIds } },
        { senderId: { $in: founderIds }, 'recipients.staffId': req.staff._id }
      ]
    })
    .sort({ sentAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    const total = await Message.countDocuments({
      $or: [
        { senderId: req.staff._id, 'recipients.staffId': { $in: founderIds } },
        { senderId: { $in: founderIds }, 'recipients.staffId': req.staff._id }
      ]
    });

    // Mark received messages as read
    await Message.updateMany(
      {
        senderId: { $in: founderIds },
        'recipients.staffId': req.staff._id,
        'recipients.status': 'sent'
      },
      {
        $set: { 'recipients.$.status': 'read', 'recipients.$.readAt': new Date() }
      }
    );

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ success: false, error: 'Failed to load messages' });
  }
};

// POST: Send message to founder
exports.sendMessage = async (req, res) => {
  try {
    const { subject, body } = req.body;

    if (!body || body.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Message body is required' });
    }

    // Find all founders/admins
    const founders = await Staff.find({ role: { $in: ['admin', 'founder'] } }).select('_id').lean();
    if (founders.length === 0) {
      return res.status(500).json({ success: false, error: 'No founders found to message' });
    }

    const founderIds = founders.map(f => f._id);

    const message = new Message({
      senderId: req.staff._id,
      senderName: req.staff.name,
      senderRole: 'school_admin',
      recipients: founderIds.map(id => ({ staffId: id, status: 'sent' })),
      subject: subject || 'Message from School Admin',
      body: body.trim(),
      messageType: 'direct',
      priority: 'normal'
    });

    await message.save();

    // Create notifications for recipients
    for (const founder of founders) {
      await Notification.create({
        recipientId: founder._id,
        type: 'message',
        title: 'New message from School Admin',
        message: `Subject: ${subject || 'No subject'}`,
        actionUrl: `/messages/${message._id}`,
        entityType: 'message',
        entityId: message._id,
        priority: 'normal'
      });
    }

    // Log audit
    await logAudit(
      'message_sent',
      'message',
      message._id,
      subject || 'Direct message',
      {},
      {
        userId: req.staff._id,
        userName: req.staff.name,
        userEmail: req.staff.email,
        userRole: req.staff.role
      }
    );

    res.status(201).json({
      success: true,
      data: message,
      message: 'Message sent successfully'
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
};

// GET: Notifications for school admin
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { recipientId: req.staff._id };
    if (unreadOnly === 'true') {
      query.isRead = false;
      query.dismissed = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Notification.countDocuments(query);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ success: false, error: 'Failed to load notifications' });
  }
};

// POST: Mark notification as read
exports.markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: req.staff._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark notification error:', err);
    res.status(500).json({ success: false, error: 'Failed to mark notification' });
  }
};

// Helper: Calculate pending actions
async function calculatePendingActions(schoolId, staffId) {
  const actions = [];

  const pendingInvoices = await Invoice.countDocuments({
    schoolId,
    status: { $in: ['issued', 'sent', 'overdue'] }
  });

  if (pendingInvoices > 0) {
    actions.push({
      type: 'payment',
      count: pendingInvoices,
      message: `${pendingInvoices} invoice${pendingInvoices > 1 ? 's' : ''} require${pendingInvoices > 1 ? '' : 's'} attention`,
      actionUrl: '/school/payments'
    });
  }

  const unreadMessages = await Message.countDocuments({
    'recipients.staffId': staffId,
    'recipients.status': 'sent',
    'recipients.deleted': { $ne: true }
  });

   if (unreadMessages > 0) {
     actions.push({
       type: 'message',
       count: unreadMessages,
       message: `${unreadMessages} unread message${unreadMessages > 1 ? 's' : ''}`,
       actionUrl: '/school/messages'
     });
   }

  const unreadNotifications = await Notification.countDocuments({
    recipientId: staffId,
    isRead: false,
    dismissed: false
  });

  if (unreadNotifications > 0) {
    actions.push({
      type: 'notification',
      count: unreadNotifications,
      message: `${unreadNotifications} notification${unreadNotifications > 1 ? 's' : ''}`,
      actionUrl: '/school/notifications'
    });
  }

  return actions;
}

// Helper: Build pending actions array for dashboard
async function buildPendingActions(schoolId, staffId) {
  return await calculatePendingActions(schoolId, staffId);
}

