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
const Payment = require('../../models/Payment');
const InvoicePDFService = require('../services/invoicePDFService');
const Program = require('../../models/Program');
const PaymentService = require('../services/paymentService');
const MpesaService = require('../services/mpesaService');
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
      recentStudents,
      enrolledPrograms
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
        .lean(),
      // Enrolled programs
      School.findById(schoolId)
        .populate('programsEnrolled', 'name description category duration price')
        .select('programsEnrolled')
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

    // Transform enrolled programs
    const transformedPrograms = (enrolledPrograms?.programsEnrolled || []).map(p => ({
      _id: p._id,
      name: p.name,
      description: p.description,
      category: p.category,
      duration: p.duration,
      price: p.price
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
          daysSinceLastVisit,
          unreadNotifications: unreadNotificationsCount,
          unreadMessages: unreadMessagesCount
        },
        programs: transformedPrograms,
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

// DELETE: Remove a student
exports.deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findOne({
      _id: studentId,
      school: req.schoolId,
      status: 'active'
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const studentName = student.fullName;
    student.status = 'inactive';
    await student.save();

    // Log audit
    await logAudit(
      'student_deleted',
      'student',
      studentId,
      studentName,
      { reason: 'Deleted by school admin' },
      {
        userId: req.staff._id,
        userName: req.staff.name,
        userEmail: req.staff.email,
        userRole: req.staff.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );

    res.json({ success: true, message: `Student "${studentName}" removed successfully` });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete student' });
  }
};

// POST: Enroll school in a program
exports.enrollProgram = async (req, res) => {
  try {
    const { programId } = req.body;

    if (!programId) {
      return res.status(400).json({ success: false, error: 'Program ID is required' });
    }

    // Validate program exists and is active
    const program = await Program.findById(programId).lean();
    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }
    if (program.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Program is not active' });
    }

    // Check if already enrolled
    const school = await School.findById(req.schoolId).lean();
    const alreadyEnrolled = school?.programsEnrolled?.some(
      pid => pid.toString() === programId
    );

    if (alreadyEnrolled) {
      return res.status(400).json({ success: false, error: 'School already enrolled in this program' });
    }

    // Add program to school's enrolled programs
    await School.findByIdAndUpdate(
      req.schoolId,
      { $addToSet: { programsEnrolled: programId } }
    );

    // Add school to program's schools list
    await Program.findByIdAndUpdate(
      programId,
      { $addToSet: { schools: req.schoolId } }
    );

    // Log audit
    await logAudit(
      'program_enrolled',
      'program',
      programId,
      program.name,
      { schoolId: req.schoolId, schoolName: school.name },
      {
        userId: req.staff._id,
        userName: req.staff.name,
        userEmail: req.staff.email,
        userRole: req.staff.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );

    // Fetch the updated program with details
    const enrolledProgram = await Program.findById(programId)
      .select('name description category duration price')
      .lean();

    res.status(201).json({
      success: true,
      data: enrolledProgram,
      message: 'Successfully enrolled in program'
    });
  } catch (err) {
    console.error('Enroll program error:', err);
    res.status(500).json({ success: false, error: 'Failed to enroll in program' });
  }
};

// POST: Remove program from school enrollment
exports.removeProgram = async (req, res) => {
  try {
    const { programId } = req.body;

    if (!programId) {
      return res.status(400).json({ success: false, error: 'Program ID is required' });
    }

    // Validate program exists
    const program = await Program.findById(programId).lean();
    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    // Remove program from school's enrolled programs
    await School.findByIdAndUpdate(
      req.schoolId,
      { $pull: { programsEnrolled: programId } }
    );

    // Remove school from program's schools list
    await Program.findByIdAndUpdate(
      programId,
      { $pull: { schools: req.schoolId } }
    );

    // Log audit
    await logAudit(
      'program_removed',
      'program',
      programId,
      program.name,
      { schoolId: req.schoolId, schoolName: req.school.name },
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
       message: 'Program removed successfully'
     });
   } catch (err) {
     console.error('Remove program error:', err);
     res.status(500).json({ success: false, error: 'Failed to remove program' });
   }
 };

 // --- Additional School Admin API endpoints ---

 // Get school's events (placeholder)
 exports.getEvents = async (req, res) => {
   res.status(501).json({ success: false, error: 'Not implemented' });
 };

 // Get event details (placeholder)
 exports.getEventDetails = async (req, res) => {
   res.status(501).json({ success: false, error: 'Not implemented' });
 };

  // Update event attendance — school admin records/updates their RSVP for an invited event
  exports.updateEventAttendance = async (req, res) => {
    try {
      const { eventId } = req.params;
      const { rsvpStatus, attendingCount } = req.body;
      const schoolId = req.schoolId;

      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ success: false, error: 'Invalid event ID' });
      }

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      // Find this school's invitation record
      const schoolIndex = event.targetSchools.findIndex(
        ts => ts.schoolId.toString() === schoolId.toString()
      );

      if (schoolIndex === -1) {
        return res.status(404).json({ success: false, error: 'Your school has not been invited to this event' });
      }

      const schoolTarget = event.targetSchools[schoolIndex];

      // Update RSVP status
      if (rsvpStatus) {
        const validStatuses = ['invited', 'confirmed', 'declined', 'pending', 'no_response'];
        if (!validStatuses.includes(rsvpStatus)) {
          return res.status(400).json({ success: false, error: 'Invalid RSVP status' });
        }
        schoolTarget.rsvpStatus = rsvpStatus;
        schoolTarget.rsvpResponseDate = new Date();
        schoolTarget.rsvpResponseBy = req.staff._id;
      }

      // Update attendance / participation count
      if (attendingCount !== undefined) {
        const count = parseInt(attendingCount, 10);
        if (isNaN(count) || count < 0) {
          return res.status(400).json({ success: false, error: 'Invalid attendance count' });
        }
        schoolTarget.attendance = schoolTarget.attendance || {};
        schoolTarget.attendance.registered = count;
        schoolTarget.attendance.recordedAt = new Date();
        schoolTarget.attendance.recordedBy = req.staff._id;
      }

      await event.save();

      await logAudit(
        'attendance_updated',
        'event',
        eventId,
        event.name,
        {
          schoolId,
          rsvpStatus: schoolTarget.rsvpStatus,
          attendingCount: attendingCount !== undefined ? attendingCount : schoolTarget.attendance?.registered
        },
        {
          userId: req.staff._id,
          userName: req.staff.name,
          userEmail: req.staff.email,
          userRole: req.staff.role,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      res.json({ success: true, event });
    } catch (err) {
      console.error('Error updating attendance:', err);
      res.status(500).json({ success: false, error: 'Failed to update attendance' });
    }
  };

  // Submit school 1-5 star review + optional comment for a past event they attended
  exports.submitEventRating = async (req, res) => {
    try {
      const { eventId } = req.params;
      const { rating, comment } = req.body;
      const schoolId = req.schoolId;

      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ success: false, error: 'Invalid event ID' });
      }

      const numRating = parseInt(rating, 10);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ success: false, error: 'Review rating must be between 1 and 5 stars' });
      }

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      const schoolIndex = event.targetSchools.findIndex(
        ts => ts.schoolId.toString() === schoolId.toString()
      );

      if (schoolIndex === -1) {
        return res.status(404).json({ success: false, error: 'Your school was not invited to this event' });
      }

      const schoolTarget = event.targetSchools[schoolIndex];

      // Optionally restrict to past/attended events
      const isPast = event.status === 'completed' || (event.endDate && event.endDate < new Date());
      const hasAttended = schoolTarget.attendance?.attended > 0 || schoolTarget.rsvpStatus === 'confirmed';
      if (!isPast && !hasAttended) {
        return res.status(400).json({ success: false, error: 'You can only review events you have attended' });
      }

      schoolTarget.schoolRating = schoolTarget.schoolRating || {};
      schoolTarget.schoolRating.rating = numRating;
      schoolTarget.schoolRating.comment = (comment || '').trim().substring(0, 1000);
      schoolTarget.schoolRating.ratedAt = new Date();
      schoolTarget.schoolRating.ratedBy = req.staff._id;

      await event.save();

      await logAudit(
        'event_rated',
        'event',
        eventId,
        event.name,
        {
          schoolId,
          rating: numRating,
          hasComment: !!schoolTarget.schoolRating.comment
        },
        {
          userId: req.staff._id,
          userName: req.staff.name,
          userEmail: req.staff.email,
          userRole: req.staff.role,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      res.json({ success: true, event });
    } catch (err) {
      console.error('Error submitting event rating:', err);
      res.status(500).json({ success: false, error: 'Failed to submit review' });
    }
  };

  // Get invoices for school (JSON API)
  exports.getInvoices = async (req, res) => {
    try {
      const invoices = await Invoice.find({ schoolId: req.schoolId })
        .sort({ issueDate: -1 })
        .lean();
      res.json({ success: true, invoices });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  // Get single invoice for the logged-in school (for polling status after payment)
  exports.getInvoice = async (req, res) => {
    try {
      const invoiceId = req.params.invoiceId;
      if (!/^[0-9a-fA-F]{24}$/.test(invoiceId)) {
        return res.status(400).json({ success: false, error: 'Invalid invoice ID' });
      }

      const invoice = await Invoice.findOne({
        _id: invoiceId,
        schoolId: req.schoolId
      }).lean();

      if (!invoice) {
        return res.status(404).json({ success: false, error: 'Invoice not found' });
      }

      res.json({ success: true, invoice });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  // Get invoices sent to a school, populated with founder/admin sender info
  exports.getSentInvoices = async (req, res) => {
    try {
      const invoices = await Invoice.find({ schoolId: req.schoolId })
        .populate('issuedBy', 'name email role')
        .populate('sentBy', 'name email role')
        .sort({ issueDate: -1 })
        .lean();

      // Also attach M-Pesa receipts for the sent invoices view
      const mpesaReceipts = await Payment.find({
        schoolId: req.schoolId,
        method: 'mpesa',
        status: 'completed',
        receiptUrl: { $exists: true, $ne: null }
      })
        .sort({ paidDate: -1, createdAt: -1 })
        .select('invoiceId receiptUrl receiptFileName')
        .lean();

      const receiptMap = {};
      for (const p of mpesaReceipts) {
        if (p.invoiceId) {
          const key = p.invoiceId.toString();
          if (!receiptMap[key]) {
            receiptMap[key] = { receiptUrl: p.receiptUrl, receiptFileName: p.receiptFileName };
          }
        }
      }

      invoices.forEach(inv => {
        const key = inv._id.toString();
        if (receiptMap[key]) inv.mpesaReceipt = receiptMap[key];
      });

      res.json({ success: true, invoices });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  exports.payInvoice = async (req, res) => {
    try {
      const invoiceId = req.params.invoiceId;
      const { phoneNumber } = req.body;

      if (!invoiceId || !/^[0-9a-fA-F]{24}$/.test(invoiceId)) {
        return res.status(400).json({ success: false, error: 'Invalid invoice selected' });
      }

      if (!phoneNumber || !phoneNumber.toString().trim()) {
        return res.status(400).json({ success: false, error: 'Phone number is required' });
      }

      const invoice = await Invoice.findOne({ _id: invoiceId, schoolId: req.schoolId });
      if (!invoice) {
        return res.status(404).json({ success: false, error: 'Invoice not found' });
      }

      const balance = Math.max(0, (invoice.totalAmount || 0) - (invoice.amountPaid || 0));
      if (balance <= 0) {
        return res.status(400).json({ success: false, error: 'Invoice is already paid' });
      }

      const accountReference = invoice.invoiceNumber || invoice._id.toString();
      const description = `Invoice payment ${invoice.invoiceNumber || ''}`.trim();

      const result = await MpesaService.initiateStkPush({
        phoneNumber,
        amount: balance,
        accountReference,
        transactionDesc: description
      });

      if (!result.success) {
        return res.status(502).json({ success: false, error: result.error || 'Failed to initiate STK push' });
      }

      const payment = await PaymentService.recordPayment({
        schoolId: req.schoolId,
        invoiceId: invoice._id,
        amount: balance,
        method: 'mpesa',
        reference: result.data.CheckoutRequestID || PaymentService.generatePaymentReference('mpesa'),
        notes: 'MPESA STK push initiated',
        recordedBy: req.staff._id,
        status: 'pending',
        checkoutRequestId: result.data.CheckoutRequestID,
        transactionMeta: result.data
      });

      res.json({ success: true, message: 'STK push initiated. Enter your M-Pesa PIN when prompted.', paymentId: payment._id });
    } catch (err) {
      console.error('Error initiating invoice payment:', err);
      res.status(500).json({ success: false, error: 'Failed to initiate payment' });
    }
  };

  exports.mpesaStkCallback = async (req, res) => {
    // Always acknowledge M-Pesa immediately (they retry on non-2xx)
    const rawBody = req.body || {};
    console.log('=== MPESA STK CALLBACK RECEIVED ===');
    console.log(JSON.stringify(rawBody, null, 2));

    // Respond fast
    res.json({ success: true, received: true });

    // Process asynchronously (do not block the response)
    setImmediate(async () => {
      try {
        const payload = rawBody;
        const callbackBody = payload.Body?.stkCallback || payload;

        const checkoutRequestId = callbackBody.CheckoutRequestID || callbackBody.checkoutRequestID;
        if (!checkoutRequestId) {
          console.error('MPESA callback missing CheckoutRequestID', payload);
          return;
        }

        const resultCode = Number(callbackBody.ResultCode ?? callbackBody.resultCode ?? -1);
        const resultDesc = callbackBody.ResultDesc || callbackBody.resultDesc || 'Unknown result';
        const callbackMetadata = callbackBody.CallbackMetadata || callbackBody.callbackMetadata || {};

        const items = callbackMetadata.Item || callbackMetadata.item || [];
        const amountItem = items.find(item => (item.Name || item.name) === 'Amount');
        const receiptItem = items.find(item => (item.Name || item.name) === 'MpesaReceiptNumber');

        await PaymentService.completePendingPayment({
          checkoutRequestId,
          mpesaReceiptNumber: receiptItem?.Value ?? receiptItem?.value,
          resultCode,
          resultDesc,
          amount: amountItem?.Value ?? amountItem?.value,
          transactionMeta: callbackBody,
          mpesaCallbackRaw: rawBody   // <-- full raw data stored here
        });
      } catch (err) {
        console.error('MPESA callback async processing error:', err);
      }
    });
  };

  // Download invoice / receipt PDF for the school (now fully implemented)
  exports.downloadInvoice = async (req, res) => {
    try {
      const invoiceId = req.params.invoiceId;

      if (!/^[0-9a-fA-F]{24}$/.test(invoiceId)) {
        return res.status(400).json({ success: false, error: 'Invalid invoice ID' });
      }

      // Strict ownership check
      const invoice = await Invoice.findOne({
        _id: invoiceId,
        schoolId: req.schoolId
      }).select('invoiceNumber').lean();

      if (!invoice) {
        return res.status(404).json({ success: false, error: 'Invoice not found' });
      }

      const pdfBuffer = await InvoicePDFService.generateInvoicePDF(invoiceId);

      const safeNumber = (invoice.invoiceNumber || invoiceId).replace(/[^a-zA-Z0-9_-]/g, '');
      const filename = `receipt_${safeNumber}.pdf`;   // Labeled as receipt to match the button text

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error('Error generating invoice PDF for school:', err);
      res.status(500).json({ success: false, error: 'Failed to generate receipt' });
    }
  };

 // Raise payment query (placeholder)
 exports.raisePaymentQuery = async (req, res) => {
   res.status(501).json({ success: false, error: 'Not implemented' });
 };

 // Get school documents (placeholder)
 exports.getDocuments = async (req, res) => {
   res.status(501).json({ success: false, error: 'Not implemented' });
 };

 // Upload document (placeholder)
 exports.uploadDocument = async (req, res) => {
   res.status(501).json({ success: false, error: 'Not implemented' });
 };

 // Get school messages (placeholder)
 exports.getMessages = async (req, res) => {
   res.status(501).json({ success: false, error: 'Not implemented' });
 };

 // Send message (placeholder)
 exports.sendMessage = async (req, res) => {
   res.status(501).json({ success: false, error: 'Not implemented' });
 };

 // Get notifications (placeholder)
 exports.getNotifications = async (req, res) => {
   res.status(501).json({ success: false, error: 'Not implemented' });
 };

 // Mark notification as read (placeholder)
 exports.markNotificationRead = async (req, res) => {
   res.status(501).json({ success: false, error: 'Not implemented' });
 };

 // Get available programs for school to enroll (programs not already enrolled)
 exports.getAvailablePrograms = async (req, res) => {
   try {
     const school = await School.findById(req.schoolId).select('programsEnrolled');
     const programs = await Program.find({
       _id: { $nin: school.programsEnrolled || [] }
     }).select('name description category duration price');
     res.json({ success: true, programs });
   } catch (err) {
     res.status(500).json({ success: false, error: err.message });
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

