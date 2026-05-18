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
    this.maxConcurrency = 5;
    this.lastCPUTime = 0;
    this.CPU_CHECK_INTERVAL = 5000; // Check every 5 seconds
    this.CPU_THRESHOLD_MS = 200; // 200ms of CPU time in interval = 4% CPU
    this.MEMORY_THRESHOLD_MB = 400;
  }

  /**
   * Check if system is under heavy load using delta CPU measurement
   */
  isSystemOverloaded() {
    const now = Date.now();

    if (now - this.lastCPUTime > this.CPU_CHECK_INTERVAL) {
      const cpu = process.cpuUsage();
      const totalCPUTime = (cpu.user + cpu.system) / 1000; // µs to ms

      if (this.lastCPUTime > 0) {
        const cpuDelta = totalCPUTime - this.lastCPUTime;
        const timeDelta = now - this.lastCPUTime;
        const cpuPercent = (cpuDelta / timeDelta) * 100;

        if (cpuDelta > this.CPU_THRESHOLD_MS) {
          console.warn(`[NotificationScheduler] High CPU load (${cpuDelta.toFixed(0)}ms in ${timeDelta}ms = ${cpuPercent.toFixed(1)}% CPU), throttling`);
          this.lastCPUTime = totalCPUTime;
          return true;
        }
      }

      this.lastCPUTime = totalCPUTime;
    }

    const usage = process.memoryUsage();
    const memoryMB = usage.heapUsed / 1024 / 1024;
    if (memoryMB > this.MEMORY_THRESHOLD_MB) {
      console.warn(`[NotificationScheduler] High memory (${memoryMB.toFixed(0)}MB), throttling`);
      return true;
    }

    return false;
  }

  start() {
    // Check for overdue reports less frequently to reduce DB load
    this.schedule('0 */3 * * *', this.checkOverdueReports.bind(this), 'overdue_reports');

    // Check for upcoming events (48 hours) less frequently
    this.schedule('0 */6 * * *', this.checkUpcomingEvents.bind(this), 'upcoming_events');

    // Check for unresolved conflicts less frequently
    this.schedule('0 */4 * * *', this.checkUnresolvedConflicts.bind(this), 'conflict_escalation');

    // Process scheduled announcements less frequently to reduce system load
    this.schedule('*/15 * * * *', this.processScheduledAnnouncements.bind(this), 'announcements');

    console.log('Notification scheduler started');
  }

  schedule(cronExpression, taskFn, jobName) {
    const job = cron.schedule(cronExpression, async () => {
      const startTime = Date.now();
      // Skip if system is overloaded
      if (this.isSystemOverloaded()) {
        console.log(`[${jobName}] Skipped due to system load`);
        return;
      }
      try {
        await taskFn();
        const duration = Date.now() - startTime;
        if (duration > 30000) { // 30 seconds
          console.warn(`[${jobName}] Job took ${duration}ms - check for bottlenecks`);
        }
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
    try {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      // Find events that ended > 1 day ago with no report and status not closed
      const overdueEvents = await Event.find({
        endDate: { $lt: threeDaysAgo },
        'review.reportSubmittedBy': { $exists: false },
        status: { $in: ['completed', 'reviewed'] }
      })
      .populate('trainers.trainerId', 'name email role')
      .select('name endDate trainers')
      .limit(10); // Lower limit to reduce load

      if (overdueEvents.length === 0) return;

      console.log(`[Notification] Found ${overdueEvents.length} overdue reports`);

      // Collect all reminder tasks
      const tasks = [];
      for (const event of overdueEvents) {
        for (const trainerAssign of event.trainers) {
          const trainer = trainerAssign.trainerId;
          if (!trainer || !trainer.email) continue;

          // lastReminderAt lives on the trainers subdoc (built from Event.js schema)
          const lastReminder = trainerAssign.lastReminderAt;
          if (lastReminder && (now - lastReminder) < 24 * 60 * 60 * 1000) {
            continue; // Skip if reminder sent within last 24h
          }

          tasks.push({ trainer, event });
        }
      }

      // Process in batches with concurrency control
      await this.processInBatches(tasks, this.maxConcurrency, async ({ trainer, event }) => {
        await this.sendReportReminder(trainer, event._id, event.trainers);
      });

    } catch (error) {
      console.error('[Notification] Error checking overdue reports:', error);
    }
  }

  async sendReportReminder(trainer, eventId, trainersArray) {
    try {
      const trainerId = trainer._id || trainer;
      const prefs = await NotificationPreference.findOne({ staffId: trainerId });

      if (prefs && prefs.types?.report_reminder?.enabled === false) {
        return;
      }

      const event = await Event.findById(eventId);
      if (!event) return;

      // Create in-app notification (fast DB write)
      await Notification.create({
        recipientId: trainerId,
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

      // Persist lastReminderAt on the matching trainers subdoc so next scheduler
      // run can skip this trainer for the same event (24 h dedup window).
      event.trainers = event.trainers || [];
      const match = event.trainers.find(
        t => t && (t.trainerId || t).toString?.() === trainerId.toString?.()
      );
      if (match) {
        match.lastReminderAt = new Date();
      }
      // Always save to touch the field even when the match loop ran fine.
      await event.save();

      // Send email asynchronously without blocking main flow
      if (prefs && prefs.channels?.email?.enabled && prefs.types?.report_reminder?.email) {
        setTimeout(async () => {
          try {
            await Promise.race([
              emailService.sendEmail({
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
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 10000))
            ]);
          } catch (emailErr) {
            console.warn(`[Notification] Email reminder failed to ${trainer.email}:`, emailErr.message);
          }
        }, 0);
      }

      console.log(`[Notification] Overdue report reminder sent to ${trainer.name} for event ${event.name}`);
    } catch (error) {
      console.error('[Notification] Error in sendReportReminder:', error);
    }
  }

  /**
   * Check for events starting within 48 hours
   * Send reminders to assigned trainers
   */
  async checkUpcomingEvents() {
    try {
      const now = new Date();
      const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const upcomingEvents = await Event.find({
        startDate: { $gte: now, $lte: twoDaysFromNow },
        status: { $in: ['confirmed', 'scheduled'] }
      })
      .populate('trainers.trainerId', 'name email role')
      .select('name startDate trainers')
      .limit(8);

      if (upcomingEvents.length === 0) return;

      console.log(`[Notification] Found ${upcomingEvents.length} upcoming events`);

      // Collect all reminder tasks
      const tasks = [];
      for (const event of upcomingEvents) {
        for (const trainerAssign of event.trainers) {
          const trainer = trainerAssign.trainerId;
          if (!trainer || !trainer.email) continue;

          // lastReminderAt lives on the trainers subdoc (Event.js schema)
          const lastReminder = trainerAssign.lastReminderAt;
          if (lastReminder && (now - lastReminder) < 24 * 60 * 60 * 1000) {
            continue;
          }

          tasks.push({ trainer, event });
        }
      }

      // Process in batches
      await this.processInBatches(tasks, this.maxConcurrency, async ({ trainer, event }) => {
        await this.sendUpcomingEventReminder(trainer, event, null);
      });

    } catch (error) {
      console.error('[Notification] Error checking upcoming events:', error);
    }
  }

  async sendUpcomingEventReminder(trainer, event, _trainersArray) {
    try {
      const trainerId = trainer._id || trainer;
      const prefs = await NotificationPreference.findOne({ staffId: trainerId });

      if (prefs && prefs.types?.upcoming_event?.enabled === false) {
        return;
      }

      const populatedEvent = await Event.findById(event._id);
      if (!populatedEvent) return;

      const hoursUntil = Math.floor((new Date(populatedEvent.startDate) - new Date()) / (60 * 60 * 1000));

      await Notification.create({
        recipientId: trainerId,
        type: 'upcoming_event',
        title: 'Event Starting Soon',
        message: `"${populatedEvent.name}" begins in approximately ${hoursUntil} hours. Location: ${populatedEvent.location?.name || 'TBD'}`,
        actionUrl: '/dashboard/events/' + populatedEvent._id,
        entityType: 'event',
        entityId: populatedEvent._id,
        priority: hoursUntil < 24 ? 'high' : 'normal'
      });

      // Persist lastReminderAt on the trainer subdoc so next run can deduplicate
      populatedEvent.trainers = populatedEvent.trainers || [];
      const match = populatedEvent.trainers.find(
        t => (t.trainerId || t).toString?.() === trainerId.toString?.()
      );
      if (match) match.lastReminderAt = new Date();
      await populatedEvent.save();

      if (prefs && prefs.channels?.email?.enabled && prefs.types?.upcoming_event?.email) {
        // Non-blocking email send
        setTimeout(async () => {
          try {
            await Promise.race([
              emailService.sendEmail({
                to: trainer.email,
                subject: `Upcoming Event: ${populatedEvent.name}`,
                html: `
                  <h2>Event Reminder</h2>
                  <p>Hello ${trainer.name},</p>
                  <p>This is a reminder that you have an upcoming event:</p>
                  <ul>
                    <li><strong>Event:</strong> ${populatedEvent.name}</li>
                    <li><strong>Date:</strong> ${new Date(populatedEvent.startDate).toLocaleDateString()}</li>
                    <li><strong>Time:</strong> ${new Date(populatedEvent.startDate).toLocaleTimeString()}</li>
                    <li><strong>Location:</strong> ${populatedEvent.location?.name || 'TBD'}</li>
                  </ul>
                  <p>Please ensure you are prepared and have submitted any required documentation.</p>
                `,
                priority: hoursUntil < 24 ? 'high' : 'normal'
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 10000))
            ]);
          } catch (emailErr) {
            console.warn(`[Notification] Email reminder failed to ${trainer.email}:`, emailErr.message);
          }
        }, 0);
      }

      console.log(`[Notification] Upcoming event reminder sent to ${trainer.name} for ${populatedEvent.name}`);
    } catch (error) {
      console.error('[Notification] Error in sendUpcomingEventReminder:', error);
    }
  }

  /**
   * Check for unresolved conflicts and escalate
   */
  async checkUnresolvedConflicts() {
    try {
      const eventsWithConflicts = await Event.find({
        'conflicts.resolved': false,
        status: { $in: ['scheduled', 'confirmed'] }
      })
      .populate('createdBy', 'name email')
      .select('name conflicts')
      .limit(10);

      if (eventsWithConflicts.length === 0) return;

      // Get all admins once
      const admins = await Staff.find({ role: { $in: ['admin', 'founder'] } }).select('email name _id');
      if (admins.length === 0) return;

      const notificationPromises = [];

      for (const event of eventsWithConflicts) {
        const unresolvedConflicts = event.conflicts.filter(c => !c.resolved);
        if (unresolvedConflicts.length === 0) continue;

        for (const conflict of unresolvedConflicts) {
          // Notify each admin (limit to avoid spam)
          for (const admin of admins.slice(0, 3)) {
            notificationPromises.push(
              Notification.create({
                recipientId: admin._id,
                type: 'approval_required',
                title: 'Unresolved Conflict',
                message: `Conflict detected for event "${event.name}": ${conflict.description}`,
                actionUrl: '/dashboard/events/' + event._id,
                entityType: 'event',
                entityId: event._id,
                priority: 'high'
              })
            );
          }
          break; // Notify once per event (break inner conflict loop)
        }
      }

      if (notificationPromises.length > 0) {
        await Promise.all(notificationPromises.slice(0, 20)); // Cap at 20 notifications
        console.log(`[Notification] Escalated ${notificationPromises.length} conflict(s)`);
      }

    } catch (error) {
      console.error('[Notification] Error checking unresolved conflicts:', error);
    }
  }

  /**
   * Process scheduled announcements with concurrency control
   */
  async processScheduledAnnouncements() {
    try {
      const now = new Date();
      const dueAnnouncements = await Announcement.find({
        deliveryType: 'scheduled',
        status: 'scheduled',
        scheduledAt: { $lte: now }
      })
      .limit(5); // Lower limit to reduce overload

      if (dueAnnouncements.length === 0) return;

      console.log(`[Notification] Processing ${dueAnnouncements.length} scheduled announcements`);

      // Process announcements in parallel with lower concurrency limit
      await this.processInBatches(dueAnnouncements, 1, async (announcement) => {
        await this.deliverAnnouncement(announcement);
        // Yield between announcements
        await new Promise(resolve => setImmediate(resolve));
      });

    } catch (error) {
      console.error('[Notification] Error processing scheduled announcements:', error);
    }
  }

  /**
   * Process tasks in batches with concurrency control
   */
  async processInBatches(tasks, concurrency, processor) {
    const results = [];
    const batchSize = Math.ceil(tasks.length / concurrency);

    for (let i = 0; i < concurrency; i++) {
      const start = i * batchSize;
      const end = start + batchSize;
      const batch = tasks.slice(start, end);

      if (batch.length === 0) break;

      // Process each batch in parallel
      const batchResult = batch.map(async (task, index) => {
        try {
          const result = await processor(task);
          // Small delay between tasks in same batch
          if (index > 0) {
            await new Promise(resolve => setImmediate(resolve));
          }
          return result;
        } catch (err) {
          console.error('[Notification] Batch task error:', err);
        }
      });

      results.push(...batchResult);
    }

    await Promise.all(results);
  }

  async deliverAnnouncement(announcement) {
    try {
      console.log(`[Announcement] Delivering scheduled announcement: ${announcement.title}`);

      // Resolve recipients
      let recipients = [];
      switch (announcement.targetType) {
        case 'all_trainers':
          recipients = await Staff.find({ role: 'trainer' }).select('email name _id').limit(100);
          break;
        case 'all_staff':
          recipients = await Staff.find({}).select('email name _id').limit(100);
          break;
        default:
          console.warn('Target type not yet implemented for scheduled announcements:', announcement.targetType);
          return;
      }

      if (recipients.length === 0) {
        console.log('[Announcement] No recipients found');
        return;
      }

      // Create notifications in parallel with concurrency limit
      const notificationPromises = recipients.slice(0, 25).map(async (recipient) => {
        try {
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
        } catch (err) {
          console.warn(`[Announcement] Failed to create notification:`, err.message);
        }
      });

      await Promise.all(notificationPromises);


      // Send emails asynchronously without blocking
      if (announcement.sendEmail) {
        setTimeout(async () => {
          // Lower recipient batch size to reduce email/DB load
          const emailPromises = recipients.slice(0, 15).map(async (recipient) => {
            if (!recipient.email) return;
            try {
              await Promise.race([
                emailService.sendEmail({
                  to: recipient.email,
                  subject: announcement.emailSubject || announcement.title,
                  html: announcement.content,
                  templateId: 'announcement',
                  templateData: { title: announcement.title, content: announcement.content }
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 10000))
              ]);
            } catch (emailErr) {
              console.warn(`[Announcement] Email failed to ${recipient.email}:`, emailErr.message);
            }
          });
          await Promise.all(emailPromises);
        }, 0);
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
