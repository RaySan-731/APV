/*
 * backend/services/emailService.js
 * Enhanced centralized email service with logging, templates, and retry logic.
 * Consolidates and replaces previous scattered email implementations.
 */

const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const EmailLog = require('../../models/EmailLog');

// Configure unified transporter
let transporter;

function initializeTransporter() {
  const defaultTimeout = parseInt(process.env.EMAIL_TIMEOUT) || 10000; // 10 second default

  if (process.env.EMAIL_HOST && process.env.EMAIL_PORT) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      timeout: defaultTimeout, // Connection timeout
      connectionTimeout: defaultTimeout // Connection establishment timeout
    });
  } else if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      timeout: defaultTimeout,
      connectionTimeout: defaultTimeout
    });
  } else {
    transporter = nodemailer.createTransport({
      jsonTransport: true,
      timeout: defaultTimeout
    });
    console.warn('Email credentials not found. Using test transport (emails will be logged, not sent).');
  }

  return transporter;
}

// Email templates registry
const templates = {
  // Staff invitation
  staff_invitation: (data) => ({
    subject: 'APV Staff Portal Invitation',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #1a365d; color: white; text-decoration: none; border-radius: 4px; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>APV Staff Portal</h1></div>
          <div class="content">
            <p>Hello ${data.name || 'Team Member'},</p>
            <p>You have been invited to join the APV Staff Portal. Please click the button below to activate your account:</p>
            <p><a href="${data.activationUrl}" class="button">Activate Account</a></p>
            <p>If the button doesn't work, copy and paste this URL: ${data.activationUrl}</p>
            <p>Best regards,<br>APV Administration</p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Arrow-Park Ventures</p></div>
        </div>
      </body>
      </html>
    `
  }),

  // Password reset
  password_reset: (data) => ({
    subject: 'APV Password Reset',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #1a365d; color: white; text-decoration: none; border-radius: 4px; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Password Reset</h1></div>
          <div class="content">
            <p>Hello ${data.name || 'User'},</p>
            <p>We received a request to reset your password. Click the button below to choose a new password:</p>
            <p><a href="${data.resetUrl}" class="button">Reset Password</a></p>
            <p>If the button doesn't work, copy and paste this URL: ${data.resetUrl}</p>
            <p>This link expires in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Arrow-Park Ventures</p></div>
        </div>
      </body>
      </html>
    `
  }),

  // Event assignment notification
  event_assignment: (data) => ({
    subject: `Event Assignment: ${data.eventName || 'New Assignment'}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #1a365d; color: white; text-decoration: none; border-radius: 4px; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>New Event Assignment</h1></div>
          <div class="content">
            <p>Hello ${data.trainerName || 'Trainer'},</p>
            <p>You have been assigned to the following event:</p>
            <ul>
              <li><strong>Event:</strong> ${data.eventName}</li>
              <li><strong>Date:</strong> ${data.eventDate}</li>
              <li><strong>Location:</strong> ${data.location}</li>
              <li><strong>Role:</strong> ${data.role || 'Trainer'}</li>
            </ul>
            <p><a href="${data.eventUrl}" class="button">View Event Details</a></p>
            <p>Please confirm your availability and submit your report after the event.</p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Arrow-Park Ventures</p></div>
        </div>
      </body>
      </html>
    `
  }),

  // Event invitation to school
  event_invitation: (data) => ({
    subject: `Invitation: ${data.eventName || 'Event Invitation'}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #1a365d; color: white; text-decoration: none; border-radius: 4px; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Event Invitation</h1></div>
          <div class="content">
            <p>Dear ${data.contactName || 'School Contact'},</p>
            <p>We are pleased to invite ${data.schoolName || 'your school'} to the following event:</p>
            <ul>
              <li><strong>Event:</strong> ${data.eventName}</li>
              <li><strong>Date:</strong> ${data.eventDate}</li>
              <li><strong>Location:</strong> ${data.location}</li>
            </ul>
            <p>${data.customMessage || ''}</p>
            <p><a href="${data.rsvpUrl}" class="button">RSVP Now</a></p>
            <p>RSVP Deadline: ${data.rsvpDeadline}</p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Arrow-Park Ventures</p></div>
        </div>
      </body>
      </html>
    `
  }),

  // RSVP confirmation
  rsvp_confirmation: (data) => ({
    subject: 'RSVP Confirmation',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>RSVP Confirmed</h1></div>
          <div class="content">
            <p>Hello ${data.contactName || 'Contact'},</p>
            <p>Your RSVP for ${data.eventName} has been ${data.rsvpStatus}.</p>
            <p>We look forward to seeing you there!</p>
            <p>Event Details:<br>
            Date: ${data.eventDate}<br>
            Location: ${data.location}</p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Arrow-Park Ventures</p></div>
        </div>
      </body>
      </html>
    `
  }),

  // Report submission notification to admins
  report_submitted: (data) => ({
    subject: 'Event Report Ready for Review',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #1a365d; color: white; text-decoration: none; border-radius: 4px; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Report Submitted</h1></div>
          <div class="content">
            <p>Hello Admin,</p>
            <p>A trainer has submitted a report for review:</p>
            <ul>
              <li><strong>Event:</strong> ${data.eventName}</li>
              <li><strong>Trainer:</strong> ${data.trainerName}</li>
              <li><strong>Submitted:</strong> ${new Date().toLocaleString()}</li>
            </ul>
            <p><a href="${data.reviewUrl}" class="button">Review Report</a></p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Arrow-Park Ventures</p></div>
        </div>
      </body>
      </html>
    `
  }),

  // Report review notification to trainer
  report_reviewed: (data) => ({
    subject: 'Your Report Has Been Reviewed',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #1a365d; color: white; text-decoration: none; border-radius: 4px; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Report Reviewed</h1></div>
          <div class="content">
            <p>Hello ${data.trainerName || 'Trainer'},</p>
            <p>Your report for <strong>${data.eventName}</strong> has been <strong>${data.reviewStatus}</strong>.</p>
            ${data.reviewNotes ? `<p><strong>Review Notes:</strong><br>${data.reviewNotes}</p>` : ''}
            <p><a href="${data.eventUrl}" class="button">View Event</a></p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Arrow-Park Ventures</p></div>
        </div>
      </body>
      </html>
    `
  }),

  // Payment received notification
  payment_received: (data) => ({
    subject: 'Payment Confirmation',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Payment Received</h1></div>
          <div class="content">
            <p>Hello ${data.recipientName || 'Team Member'},</p>
            <p>We have received your payment:</p>
            <ul>
              <li><strong>Amount:</strong> KES ${data.amount?.toLocaleString() || data.amount}</li>
              <li><strong>Reference:</strong> ${data.reference || ''}</li>
              <li><strong>Date:</strong> ${new Date(data.date || Date.now()).toLocaleDateString()}</li>
              <li><strong>Description:</strong> ${data.description || 'Payment'}</li>
            </ul>
            <p>Thank you for your prompt payment.</p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Arrow-Park Ventures</p></div>
        </div>
      </body>
      </html>
    `
  }),

  // Overdue reminder
  overdue_reminder: (data) => ({
    subject: `Overdue: ${data.itemType || 'Item'} - Action Required`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #c53030; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #c53030; color: white; text-decoration: none; border-radius: 4px; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Action Required - Overdue</h1></div>
          <div class="content">
            <p>Hello ${data.recipientName || 'Team Member'},</p>
            <p>The following item is now overdue and requires your immediate attention:</p>
            <ul>
              <li><strong>Item:</strong> ${data.itemName || data.itemType}</li>
              <li><strong>Due Date:</strong> ${new Date(data.dueDate).toLocaleDateString()}</li>
              <li><strong>Days Overdue:</strong> ${data.daysOverdue}</li>
            </ul>
            <p><a href="${data.actionUrl}" class="button">Take Action</a></p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Arrow-Park Ventures</p></div>
        </div>
      </body>
      </html>
    `
  }),

  // Bulk announcement
  announcement: (data) => ({
    subject: data.title || 'Announcement',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>${data.title || 'Announcement'}</h1></div>
          <div class="content">
            ${data.content ? `<div>${data.content.replace(/\n/g, '<br>')}</div>` : ''}
            ${data.actionUrl ? `<p><a href="${data.actionUrl}" class="button">Take Action</a></p>` : ''}
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Arrow-Park Ventures</p></div>
        </div>
      </body>
      </html>
    `
  }),

  // Default/fallback template
  default: (data) => ({
    subject: data.subject || 'Notification from APV System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Notification</h1></div>
          <div class="content">
            ${data.message ? `<p>${data.message.replace(/\n/g, '<br>')}</p>` : ''}
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Arrow-Park Ventures</p></div>
        </div>
      </body>
      </html>
    `
  })
};

/**
 * Send a single email with logging
 */
async function sendEmail(options) {
  const {
    to,
    subject,
    html,
    text,
    attachments = [],
    templateId,
    templateData,
    triggeredBy,
    entityType,
    entityId,
    triggerReason,
    priority = 'normal'
  } = options;

  if (!transporter) initializeTransporter();

  // Resolve template if provided
  let finalHtml = html;
  let finalSubject = subject;
  if (templateId && templates[templateId]) {
    const templated = templates[templateId](templateData || {});
    finalSubject = templated.subject;
    finalHtml = templated.html;
  }

   // Normalize recipient to array of objects with email and optional name
   let recipients;
   if (Array.isArray(to)) {
     recipients = to.map(r => typeof r === 'string' ? { email: r } : r);
   } else if (typeof to === 'string') {
     recipients = [{ email: to }];
   } else if (to && typeof to === 'object' && 'email' in to) {
     recipients = [to];
   } else {
     recipients = [];
   }

  // Create email log entry
  const emailLog = new EmailLog({
    subject: finalSubject,
    from: {
      email: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@apv-ventures.com',
      name: process.env.EMAIL_FROM_NAME || 'APV System'
    },
    to: recipients,
    textBody: text,
    htmlBody: finalHtml,
    templateId,
    entityType,
    entityId,
    triggeredBy,
    triggerReason,
    status: 'pending',
    priority: priority === 'urgent' ? 'high' : priority
  });

  try {
    await emailLog.save();

    // Send email with timeout to prevent blocking
    const mailOptions = {
      from: emailLog.from,
      to: emailLog.to.map(r => r.email).join(', '),
      cc: emailLog.cc?.map(c => c.email).join(', ') || undefined,
      bcc: emailLog.bcc?.map(b => b.email).join(', ') || undefined,
      subject: finalSubject,
      html: finalHtml,
      text: text,
      attachments
    };

    const sendTimeout = parseInt(process.env.EMAIL_SEND_TIMEOUT) || 15000; // 15 second send timeout

    const info = await Promise.race([
      transporter.sendMail(mailOptions),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Email send timeout')), sendTimeout))
    ]);

    const messageId = info.messageId || info.response?.split(' ')?.[1] || undefined;

    // Update log with success
    emailLog.messageId = messageId;
    emailLog.status = 'sent';
    emailLog.sentAt = new Date();
    emailLog.smtpResponse = info.response;

    if (info.envelope) {
      emailLog.deliveredAt = new Date();
    }

    await emailLog.save();

    console.log(`[EmailService] Sent successfully to ${recipients.map(r => r.email).join(', ')}: ${finalSubject}`);
    return { success: true, emailLogId: emailLog._id, messageId };

  } catch (error) {
    console.error('[EmailService] Failed to send email:', error);

    // Update log with failure
    emailLog.status = 'failed';
    emailLog.errorMessage = error.message;
    emailLog.errorDetails = {
      code: error.code,
      command: error.command,
      response: error.response
    };
    emailLog.smtpCode = error.code;

    // Retry logic
    emailLog.retryCount = (emailLog.retryCount || 0) + 1;
    emailLog.lastRetryAt = new Date();

    if (emailLog.retryCount < (emailLog.maxRetries || 3)) {
      const delayMs = Math.min(1000 * Math.pow(2, emailLog.retryCount), 30000); // Exponential backoff
      emailLog.nextRetryAt = new Date(Date.now() + delayMs);
      console.log(`[EmailService] Will retry in ${delayMs/1000}s (attempt ${emailLog.retryCount})`);
    }

    await emailLog.save();
    return { success: false, error: error.message, emailLogId: emailLog._id };
  }
}

/**
 * Send email to multiple recipients
 */
async function sendBulkEmail(options) {
  const { to, ...restOptions } = options;
  const results = [];

  for (const recipient of to) {
    const result = await sendEmail({
      ...restOptions,
      to: recipient
    });
    results.push(result);
  }

  return results;
}

/**
 * Get email logs with filters
 */
async function getEmailLogs(filters = {}) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.recipient) query['to.email'] = filters.recipient;
  if (filters.entityType) query.entityType = filters.entityType;
  if (filters.dateFrom) query.createdAt = { ...query.createdAt, $gte: filters.dateFrom };
  if (filters.dateTo) query.createdAt = { ...query.createdAt, $lte: filters.dateTo };

  return EmailLog.find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit || 50)
    .populate('triggeredBy', 'name email')
    .exec();
}

/**
 * Retry failed email
 */
async function retryEmail(emailLogId) {
  const emailLog = await EmailLog.findById(emailLogId);
  if (!emailLog) {
    return { success: false, error: 'Email log not found' };
  }

  if (emailLog.status !== 'failed') {
    return { success: false, error: 'Only failed emails can be retried' };
  }

  // Reconstruct the original email options
  const options = {
    to: emailLog.to,
    subject: emailLog.subject,
    html: emailLog.htmlBody,
    text: emailLog.textBody,
    attachments: emailLog.attachments || [],
    triggeredBy: emailLog.triggeredBy,
    entityType: emailLog.entityType,
    entityId: emailLog.entityId
  };

  return sendEmail(options);
}

module.exports = {
  transporter,
  initializeTransporter,
  sendEmail,
  sendBulkEmail,
  getEmailLogs,
  retryEmail,
  templates
};
