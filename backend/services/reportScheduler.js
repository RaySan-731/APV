/*
 * backend/services/reportScheduler.js
 * Cron job service for scheduled reports
 */

const cron = require('node-cron');
const ScheduledReport = require('../../models/ScheduledReport');
const emailService = require('./emailService');
const { getKPIMetrics } = require('../utils/aggregations');
const Event = require('../../models/Event');
const School = require('../../models/School');
const User = require('../../models/User');
const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');

class ReportScheduler {
  constructor() {
    this.cronJob = null;
    this.isProcessing = false;
    this.queue = [];
    this.CONCURRENCY_LIMIT = 2;
    this.processingCount = 0;
    this.lastCPUCheck = 0;
    this.CPU_THRESHOLD = 80; // Skip if CPU > 80%
    this.MEMORY_THRESHOLD_MB = 500; // Skip if process uses > 500MB
  }

  /**
   * Check if system is under heavy load
   */
  isSystemOverloaded() {
    const usage = process.memoryUsage();
    const memoryMB = usage.heapUsed / 1024 / 1024;

    // Only check CPU occasionally to avoid overhead
    const now = Date.now();
    const shouldCheckCPU = now - this.lastCPUCheck > 30000; // Every 30 seconds
    if (shouldCheckCPU) {
      this.lastCPUCheck = now;
      // Simple CPU load check using process.cpuUsage
      const cpu = process.cpuUsage();
      const totalCPUTime = (cpu.user + cpu.system) / 1000000; // Convert to seconds
      // Estimate CPU usage over the last interval (rough approximation)
      // This is simplified - for production use a proper monitoring library
      if (totalCPUTime > 0.5) { // High CPU usage detected
        console.warn(`[ReportScheduler] High CPU usage detected (${(totalCPUTime*1000).toFixed(1)}ms total), skipping job to prevent blocking`);
        return true;
      }
    }

    if (memoryMB > this.MEMORY_THRESHOLD_MB) {
      console.warn(`[ReportScheduler] High memory usage (${memoryMB.toFixed(0)}MB), throttling`);
      return true;
    }

    return false;
  }

  /**
   * Start the scheduler
   */
   start() {
    // Run every 2 minutes instead of every minute to allow buffer time
    this.cronJob = cron.schedule('*/2 * * * *', async () => {
      const startTime = Date.now();

      // Skip if already processing to prevent overlap
      if (this.isProcessing) {
        const duration = Date.now() - startTime;
        console.log(`[ReportScheduler] Still processing previous run (took ${duration}ms), skipping this tick`);
        return;
      }

      // Check system load before running
      if (this.isSystemOverloaded()) {
        console.log('[ReportScheduler] System overloaded, skipping this run');
        return;
      }

      try {
        await this.processScheduledReports();
        const totalDuration = Date.now() - startTime;
        if (totalDuration > 60000) {
          console.warn(`[ReportScheduler] Job took ${totalDuration}ms - consider reducing report load or increasing interval`);
        }
      } catch (err) {
        console.error('[ReportScheduler] Job failed:', err);
      }
    }, {
      scheduled: true,
      timezone: "Africa/Nairobi"
    });

    console.log('Report scheduler started (runs every 2 minutes)');
  }

  /**
   * Generate PDF document for scheduled report using worker thread
   */
  async generatePDF(reportType, data) {
    return new Promise((resolve, reject) => {
      // Resolve worker path relative to this file
      const workerPath = path.join(__dirname, 'pdfWorker.js');

      // Offload to worker thread to avoid blocking event loop
      const worker = new Worker(workerPath, {
        workerData: { reportType, data }
      });

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('PDF generation timeout'));
      }, 30000); // 30 second timeout

      worker.on('message', (result) => {
        clearTimeout(timeout);
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(Buffer.from(result.buffer));
        }
      });

      worker.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`PDF worker stopped with exit code ${code}`));
        }
      });
    });
  }

  /**
   * Process all scheduled reports that are due
   * Uses queue-based processing with concurrency control
   */
  async processScheduledReports() {
    if (this.isProcessing) {
      console.log('[ReportScheduler] Already processing, skipping this run');
      return;
    }

    const now = new Date();

    try {
      // Check if there are pending reports
      const pendingCount = await ScheduledReport.countDocuments({
        isActive: true,
        nextSendAt: { $lte: now },
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gte: now } }
        ]
      });

      if (pendingCount === 0) return;

      // Limit frequency: only check every 2 minutes if already processed recently
      const recentRun = await ScheduledReport.findOne({
        lastSentAt: { $gte: new Date(now.getTime() - 2 * 60 * 1000) }
      });
      if (recentRun) {
        console.log('[ReportScheduler] Reports sent recently, skipping to avoid overlap');
        return;
      }

      this.isProcessing = true;
      console.log(`[ReportScheduler] Processing ${pendingCount} scheduled report(s)`);

      const CONCURRENCY_LIMIT = 2;
      this.processingCount = 0;

      // Fetch all due reports
      const dueReports = await ScheduledReport.find({
        isActive: true,
        nextSendAt: { $lte: now },
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gte: now } }
        ]
      })
      .populate('createdBy', 'name email')
      .populate('recipients', 'name email')
      .sort({ nextSendAt: 1 })
      .limit(10); // Process max 10 reports per run

      if (dueReports.length === 0) {
        this.isProcessing = false;
        return;
      }

      // Process using a semaphore pattern with proper yielding
      const semaphore = new Array(CONCURRENCY_LIMIT).fill(null);
      let index = 0;

      const processNext = async () => {
        if (index >= dueReports.length) return;

        const currentIndex = index++;
        const report = dueReports[currentIndex];

        try {
          // Generate report data
          const reportData = await this.generateReportData(report.reportType, report.config);

          // Generate PDF with timeout
          const pdfBuffer = await Promise.race([
            this.generatePDF(report.reportType, reportData),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('PDF generation timeout')), 25000)
            )
          ]);

          // Send emails with individual error handling
          const sendPromises = report.recipients.map(async (recipient) => {
            try {
              await emailService.sendReportEmail(
                { name: recipient.name || '', email: recipient.email },
                reportData,
                [{
                  filename: `${report.reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`,
                  content: pdfBuffer,
                  contentType: 'application/pdf'
                }]
              );
            } catch (emailErr) {
              console.error(`[ReportScheduler] Failed to send email to ${recipient.email}:`, emailErr.message);
            }
          });

          await Promise.all(sendPromises);

          // Update schedule
          report.lastSentAt = now;
          report.nextSendAt = this.calculateNextSendDate(report.frequency);
          await report.save();

          console.log(`✓ [ReportScheduler] Sent "${report.name}" to ${report.recipients.length} recipient(s)`);
        } catch (error) {
          console.error(`[ReportScheduler] Failed to process report ${report._id} (${report.name}):`, error.message);
        } finally {
          this.processingCount--;
        }
      };

      // Launch limited concurrency workers with yielding
      const workers = [];
      for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, dueReports.length); i++) {
        (async () => {
          while (index < dueReports.length) {
            this.processingCount++;
            await processNext();
            // Yield to event loop between each report
            await new Promise(resolve => setImmediate(resolve));
          }
        })();
      }

      // Wait for all to finish with timeout
      const waitForCompletion = () => new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (this.processingCount === 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });

      await Promise.race([
        waitForCompletion(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Processing timeout')), 5 * 60 * 1000) // 5 min max
        )
      ]);

      this.isProcessing = false;
    } catch (error) {
      this.isProcessing = false;
      console.error('[ReportScheduler] Processing error:', error);
    }
  }

  /**
   * Generate report data based on type
   */
  async generateReportData(reportType, config) {
    // Use KPI metrics for monthly summary
    if (reportType === 'monthly_summary') {
      const kpis = await getKPIMetrics('30d');
      const totalSchools = await School.countDocuments();
      const monthlyEvents = await Event.countDocuments({
        startDate: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      });

      return {
        totalSchools,
        eventsThisMonth: monthlyEvents,
        ...kpis
      };
    }

    // For other types, use aggregations
    // This can be extended based on needed report types
    return { message: 'Report generation not implemented for this type' };
  }

  /**
   * Calculate next send date based on frequency
   */
  calculateNextSendDate(frequency) {
    const next = new Date();
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setDate(1);
        next.setMonth(next.getMonth() + 1);
        if (next.getMonth() === 0) next.setFullYear(next.getFullYear() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
    }
    // Reset to midnight
    next.setHours(0, 0, 0, 0);
    return next;
  }
}

// Export singleton instance
module.exports = new ReportScheduler();
