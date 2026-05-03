/*
 * backend/services/emailService.js
 * Email sending service using nodemailer
 */

const nodemailer = require('nodemailer');

let transporter;

function initializeTransporter() {
  if (process.env.EMAIL_HOST && process.env.EMAIL_PORT) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    // Development: ethereal test account or console
    transporter = nodemailer.createTransport({
      jsonTransport: true
    });
    console.warn('Email credentials not found. Using test transporter.');
  }
}

/**
 * Send email
 */
async function sendEmail(to, subject, html, attachments = []) {
  if (!transporter) initializeTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || `APV System <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    attachments
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${subject}`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Send scheduled report email
 */
async function sendReportEmail(recipient, reportData, attachments = []) {
  const subject = `Monthly Analytics Report - ${new Date().toLocaleDateString()}`;
  const html = `
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
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #1a365d; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>APV Analytics Report</h1>
        </div>
        <div class="content">
          <p>Dear ${recipient.name || 'Team Member'},</p>
          <p>Please find attached the monthly analytics report for ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>
          <p><strong>Key Highlights:</strong></p>
          <ul>
            <li>Total Schools: ${reportData.totalSchools || 'N/A'}</li>
            <li>Events This Month: ${reportData.eventsThisMonth || 'N/A'}</li>
            <li>Trainers Deployed: ${reportData.trainersDeployed || 'N/A'}</li>
            <li>Total Scouts Reached: ${reportData.totalScoutsReached || 'N/A'}</li>
            <li>Revenue Collected: KES ${reportData.revenueCollected ? reportData.revenueCollected.toLocaleString() : 'N/A'}</li>
            <li>Outstanding Payments: KES ${reportData.outstandingPayments ? reportData.outstandingPayments.toLocaleString() : 'N/A'}</li>
            <li>Report Submission Rate: ${reportData.reportSubmissionRate || 'N/A'}%</li>
          </ul>
          <p>For detailed insights, please review the attached PDF report.</p>
        </div>
        <div class="footer">
          <p>This is an automated email from the APV Management System.</p>
          <p>© ${new Date().getFullYear()} Arrow-Park Ventures</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(recipient.email, subject, html, attachments);
}

module.exports = {
  sendEmail,
  sendReportEmail,
  initializeTransporter
};
