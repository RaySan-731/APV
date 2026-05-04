/*
 * backend/services/notificationScheduler.js
 * Scheduled jobs for system notifications:
 * - Overdue report reminders
 * - Upcoming event reminders (48 hrs)
 * - Escalation of critical issues
 */

const cron = require('node-cron');
const Event = require('../../models/Event');
const Staff = require('../../models/Staff');
const Notification = require('../../models/Notification');
const NotificationPreference = require('../../models/NotificationPreference');
const Announcement = require('../../models/Announcement');
const emailService = require('./emailService');

class NotificationScheduler {
  constructor() {
    this.jobs = [];
  }

  start() {
    // Check for overdue reports every hour
    this.schedule('0 * * * *', this.checkOverdueReports.bind(this), 'overdue_reports');

    // Check for upcoming events (48 hours) every 6 hours
    this.schedule('0 */6 * * *', this.checkUpcomingEvents.bind(this), 'upcoming_events');

    // Check for unresolved conflicts every 2 hours
    this.schedule('0 */2 * * *', this.checkUnresolvedConflicts.bind(this), 'conflict_escalation');

    // Process scheduled announcements every 5 minutes
    this.schedule('*/5 * * * *', this.processScheduledAnnouncements.bind(this), 'announcements');

    console.log('Notification scheduler started');
  }

  schedule(cronExpression, taskFn, jobName) {
    const job = cron.schedule(cronExpression, async () => {
      try {
        await taskFn();
      } catch (err) {
        console.error(`[${jobName}] Error:`, err);
      }
    }, { timezone: 'Africa/Nairobi' });

    this.jobs.push({ name: jobName, job });
  }

  stop() {
    this.jobs.forEach(({ job }) => job.stop());
    this.jobs = [];
  }

  /**
   * Check for events that have ended but reports not yet submitted
   * Send reminders at 1, 2, and 3 days past event end
   */
  async checkOverdueReports() {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Find events that ended > 1 day ago with no report and status not closed
    const overdueEvents = await Event.find({
      endDate: { $lt: threeDaysAgo },
      'review.reportSubmittedBy': { $exists: false },
      status: { $in: ['completed', 'reviewed'] }
    }).populate('trainers.trainerId', 'name email role')
      .select('name startDate endDate trainers');

    for (const event of overdueEvents) {
      for (const trainerAssign of event.trainers) {
        const trainer = trainerAssign.trainerId;
        if (!trainer || !trainer.email) continue;

        // Check if reminder already sent recently
        const lastReminder = event.trainers.find(t => t.trainerId.toString() === trainer._id.toString())?.lastReminderAt;
        if (lastReminder && (now - lastReminder) < 24 * 60 * 60 * 1000) {
          continue; // Skip if reminder sent within last 24h
        }

        // Check trainer's notification preferences
        await this.sendReportReminder(trainer, event);
      }
    }
  }

  async sendReportReminder(trainer, event) {
    const prefs = await NotificationPreference.findOne({ staffId: trainer._id });

    // Check if report reminders are enabled
    if (prefs && prefs.types?.report_reminder?.enabled === false) {
      return;
    }

    // Create in-app notification
    await Notification.create({
      recipientId: trainer._id,
      type: 'report_reminder',
      title: 'Report Overdue',
      message: `Please submit your post-event report for "${event.name}" (ended ${new Date(event.endDate).toLocaleDateString()})`,
      actionUrl: '/dashboard/events/' + event._id + '/review',
      entityType: 'event',
      entityId: event._id,
      priority: 'high',
      metadata: {
        relatedNames: [event.name],
        dueDate: event.endDate,
        daysOverdue: Math.floor((Date.now() - event.endDate) / (24 * 60 * 60 * 1000))
      }
    });

    // Send email if preferred
    if (prefs && prefs.channels?.email?.enabled && prefs.types?.report_reminder?.email) {
      await emailService.sendEmail({
        to: trainer.email,
        subject: `Overdue Report: ${event.name}`,
        html: `
          <h2>Report Overdue</h2>
          <p>Hello ${trainer.name},</p>
          <p>This is a reminder that the post-event report for <strong>${event.name}</strong> is now overdue.</p>
          <p><strong>Event Dates:</strong> ${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}</p>
          <p>Please submit your report as soon as possible.</p>
          <p><a href="${process.env.BASE_URL || 'http://localhost:3001'}/dashboard/events/${event._id}">Go to Event</a></p>
        `,
        priority: 'high'
      });
    }

    console.log(`[Notification] Overdue report reminder sent to ${trainer.name} for event ${event.name}`);
  }

  /**
   * Check for events starting within 48 hours
   * Send reminders to assigned trainers
   */
  async checkUpcomingEvents() {
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const upcomingEvents = await Event.find({
      startDate: { $gte: now, $lte: twoDaysFromNow },
      status: { $in: ['confirmed', 'scheduled'] }
    }).populate('trainers.trainerId', 'name email role')
      .select('name startDate endDate location trainers');

    for (const event of upcomingEvents) {
      for (const trainerAssign of event.trainers) {
        const trainer = trainerAssign.trainerId;
        if (!trainer || !trainer.email) continue;

        // Check if reminder already sent
        const lastReminder = event.trainers.find(t => t.trainerId.toString() === trainer._id.toString())?.lastReminderAt;
        if (lastReminder && (now - lastReminder) < 24 * 60 * 60 * 1000) {
          continue;
        }

        await this.sendUpcomingEventReminder(trainer, event);
      }
    }
  }

  async sendUpcomingEventReminder(trainer, event) {
    const prefs = await NotificationPreference.findOne({ staffId: trainer._id });

    if (prefs && prefs.types?.upcoming_event?.enabled === false) {
      return;
    }

    const hoursUntil = Math.floor((new Date(event.startDate) - new Date()) / (60 * 60 * 1000));

    await Notification.create({
      recipientId: trainer._id,
      type: 'upcoming_event',
      title: 'Event Starting Soon',
      message: `"${event.name}" begins in approximately ${hoursUntil} hours. Location: ${event.location?.name || 'TBD'}`,
      actionUrl: '/dashboard/events/' + event._id,
      entityType: 'event',
      entityId: event._id,
      priority: hoursUntil < 24 ? 'high' : 'normal'
    });

    if (prefs && prefs.channels?.email?.enabled && prefs.types?.upcoming_event?.email) {
      await emailService.sendEmail({
        to: trainer.email,
        subject: `Upcoming Event: ${event.name}`,
        html: `
          <h2>Event Reminder</h2>
          <p>Hello ${trainer.name},</p>
          <p>This is a reminder that you have an upcoming event:</p>
          <ul>
            <li><strong>Event:</strong> ${event.name}</li>
            <li><strong>Date:</strong> ${new Date(event.startDate).toLocaleDateString()}</li>
            <li><strong>Time:</strong> ${new Date(event.startDate).toLocaleTimeString()}</li>
            <li><strong>Location:</strong> ${event.location?.name || 'TBD'}</li>
          </ul>
          <p>Please ensure you are prepared and have submitted any required documentation.</p>
        `,
        priority: hoursUntil < 24 ? 'high' : 'normal'
      });
    }

    console.log(`[Notification] Upcoming event reminder sent to ${trainer.name} for ${event.name}`);
  }

  /**
   * Check for unresolved conflicts and escalate
   */
  async checkUnresolvedConflicts() {
    const eventsWithConflicts = await Event.find({
      'conflicts.resolved': false,
      status: { $in: ['scheduled', 'confirmed'] }
    }).populate('createdBy', 'name email')
      .select('name conflicts createdBy');

    for (const event of eventsWithConflicts) {
      const admins = await Staff.find({ role: { $in: ['admin', 'founder'] } }).select('email name _id');

      for (const conflict of event.conflicts.filter(c => !c.resolved)) {
        for (const admin of admins) {
          await Notification.create({
            recipientId: admin._id,
            type: 'approval_required',
            title: 'Unresolved Conflict',
            message: `Conflict detected for event "${event.name}": ${conflict.description}`,
            actionUrl: '/dashboard/events/' + event._id,
            entityType: 'event',
            entityId: event._id,
            priority: 'high'
          });
        }
        break; // Notify once per event
      }
    }
  }

  /**
   * Process scheduled announcements
   */
  async processScheduledAnnouncements() {
    const now = new Date();
    const dueAnnouncements = await Announcement.find({
      deliveryType: 'scheduled',
      status: 'scheduled',
      scheduledAt: { $lte: now }
    });

    for (const announcement of dueAnnouncements) {
      await this.deliverAnnouncement(announcement);
    }
  }

  async deliverAnnouncement(announcement) {
    // Reuse logic from server.js deliverAnnouncement function
    // Ensure this is called only once per announcement
    try {
      console.log(`[Announcement] Delivering scheduled announcement: ${announcement.title}`);

      // Resolve recipients (simplified here - should match server logic)
      let recipients = [];
      switch (announcement.targetType) {
        case 'all_trainers':
          recipients = await Staff.find({ role: 'trainer' }).select('email name _id');
          break;
        case 'all_staff':
          recipients = await Staff.find({});
          break;
        default:
          console.warn('Target type not yet implemented for scheduled announcements:', announcement.targetType);
      }

      for (const recipient of recipients) {
        await Notification.create({
          recipientId: recipient._id,
          type: 'announcement',
          title: announcement.title,
          message: announcement.content.substring(0, 150),
          actionUrl: '/announcements/' + announcement._id,
          entityType: 'announcement',
          entityId: announcement._id,
          priority: announcement.priority
        });

        if (announcement.sendEmail && recipient.email) {
          await emailService.sendEmail({
            to: recipient.email,
            subject: announcement.emailSubject || announcement.title,
            html: announcement.content,
            templateId: 'announcement',
            templateData: { title: announcement.title, content: announcement.content }
          });
        }
      }

      announcement.status = 'sent';
      announcement.sentAt = new Date();
      announcement.metrics = announcement.metrics || {};
      announcement.metrics.totalRecipients = recipients.length;
      await announcement.save();

      console.log(`[Announcement] Delivered to ${recipients.length} recipients`);
    } catch (err) {
      console.error('[Announcement] Delivery failed:', err);
      announcement.status = 'failed';
      await announcement.save();
    }
  }
}

module.exports = new NotificationScheduler();
