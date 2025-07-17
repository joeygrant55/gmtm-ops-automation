const logger = require('../shared/logging/logger');
const { config } = require('../shared/config');
const { formatDate, chunkArray } = require('../shared/utils');

/**
 * MCP Revenue Tracking Automation
 * 
 * This automation demonstrates advanced MCP usage for:
 * - Stripe data collection
 * - Notion dashboard creation
 * - Google Drive report generation
 * - Calendar-based scheduling
 * - GitHub issue creation for anomalies
 */
class MCPRevenueTrackerAutomation {
  constructor(mcpAdapters) {
    this.name = 'MCP Revenue Tracker';
    this.description = 'Tracks revenue metrics using Stripe and creates reports in Notion and Google Drive';
    this.schedule = '0 6 * * *'; // Daily at 6 AM
    this.enabled = true;
    
    // MCP feature flags
    this.usesStripe = true;
    this.usesNotion = true;
    this.usesGoogleDrive = true;
    this.usesCalendar = true;
    this.usesGitHub = true;
    
    // Store MCP adapters
    this.stripe = mcpAdapters.stripe;
    this.notion = mcpAdapters.notion;
    this.googleDrive = mcpAdapters.googleDrive;
    this.calendar = mcpAdapters.googleCalendar;
    this.github = mcpAdapters.github;
  }

  async execute(options = {}) {
    logger.info(`Executing ${this.name}...`);
    
    try {
      // Step 1: Collect revenue data from Stripe
      const revenueData = await this.collectRevenueData();
      
      // Step 2: Analyze the data for trends and anomalies
      const analysis = await this.analyzeRevenueData(revenueData);
      
      // Step 3: Create/update Notion dashboard
      await this.updateNotionDashboard(revenueData, analysis);
      
      // Step 4: Generate detailed report in Google Drive
      await this.generateDriveReport(revenueData, analysis);
      
      // Step 5: Schedule review meeting if needed
      if (analysis.requiresReview) {
        await this.scheduleReviewMeeting(analysis);
      }
      
      // Step 6: Create GitHub issues for anomalies
      if (analysis.anomalies.length > 0) {
        await this.createAnomalyIssues(analysis.anomalies);
      }
      
      const result = {
        success: true,
        totalRevenue: revenueData.totalRevenue,
        newCustomers: revenueData.newCustomers,
        anomaliesDetected: analysis.anomalies.length,
        summary: `Processed revenue data: $${revenueData.totalRevenue.toLocaleString()}, ${revenueData.newCustomers} new customers, ${analysis.anomalies.length} anomalies detected`,
        revenueData,
        analysis
      };
      
      logger.info(`${this.name} completed successfully`);
      return result;
      
    } catch (error) {
      logger.error(`${this.name} failed:`, error);
      await this.createFailureIssue(error);
      throw error;
    }
  }

  async collectRevenueData() {
    logger.info('Collecting revenue data from Stripe...');
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfDay = new Date(yesterday);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(yesterday);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Collect various metrics
    const [payments, customers, subscriptions, invoices] = await Promise.all([
      this.stripe.getPayments(100, {
        gte: Math.floor(startOfDay.getTime() / 1000),
        lt: Math.floor(endOfDay.getTime() / 1000)
      }),
      this.stripe.getCustomers(100),
      this.stripe.getSubscriptions(100, 'active'),
      this.stripe.getInvoices(100, 'paid')
    ]);
    
    // Process the data
    const revenueData = {
      date: formatDate(yesterday),
      totalRevenue: payments.reduce((sum, payment) => sum + payment.amount, 0) / 100, // Convert from cents
      paymentsCount: payments.length,
      newCustomers: customers.filter(c => 
        new Date(c.created * 1000) >= startOfDay && new Date(c.created * 1000) <= endOfDay
      ).length,
      activeSubscriptions: subscriptions.length,
      monthlyRecurringRevenue: subscriptions.reduce((sum, sub) => sum + (sub.plan?.amount || 0), 0) / 100,
      paidInvoices: invoices.filter(inv => 
        new Date(inv.status_transitions?.paid_at * 1000) >= startOfDay && 
        new Date(inv.status_transitions?.paid_at * 1000) <= endOfDay
      ).length,
      payments,
      customers,
      subscriptions,
      invoices
    };
    
    logger.info(`Collected revenue data: $${revenueData.totalRevenue.toLocaleString()}, ${revenueData.newCustomers} new customers`);
    return revenueData;
  }

  async analyzeRevenueData(revenueData) {
    logger.info('Analyzing revenue data for trends and anomalies...');
    
    const analysis = {
      date: revenueData.date,
      trends: {},
      anomalies: [],
      requiresReview: false,
      recommendations: []
    };
    
    // Simple trend analysis (in a real implementation, this would be more sophisticated)
    const avgDailyRevenue = 5000; // This would come from historical data
    const avgNewCustomers = 10;
    
    analysis.trends = {
      revenueVsAverage: ((revenueData.totalRevenue - avgDailyRevenue) / avgDailyRevenue * 100).toFixed(2),
      customersVsAverage: ((revenueData.newCustomers - avgNewCustomers) / avgNewCustomers * 100).toFixed(2),
      revenuePerCustomer: revenueData.newCustomers > 0 ? (revenueData.totalRevenue / revenueData.newCustomers).toFixed(2) : 0
    };
    
    // Detect anomalies
    if (revenueData.totalRevenue < avgDailyRevenue * 0.5) {
      analysis.anomalies.push({
        type: 'low_revenue',
        severity: 'high',
        message: `Revenue is ${analysis.trends.revenueVsAverage}% below average`,
        value: revenueData.totalRevenue,
        expected: avgDailyRevenue
      });
      analysis.requiresReview = true;
    }
    
    if (revenueData.newCustomers < avgNewCustomers * 0.3) {
      analysis.anomalies.push({
        type: 'low_customer_acquisition',
        severity: 'medium',
        message: `New customers are ${analysis.trends.customersVsAverage}% below average`,
        value: revenueData.newCustomers,
        expected: avgNewCustomers
      });
    }
    
    if (revenueData.totalRevenue > avgDailyRevenue * 2) {
      analysis.anomalies.push({
        type: 'high_revenue',
        severity: 'low',
        message: `Revenue is ${analysis.trends.revenueVsAverage}% above average - investigate cause`,
        value: revenueData.totalRevenue,
        expected: avgDailyRevenue
      });
    }
    
    // Generate recommendations
    if (analysis.trends.revenueVsAverage < -20) {
      analysis.recommendations.push('Consider running a promotional campaign');
      analysis.recommendations.push('Review customer feedback for service issues');
    }
    
    if (analysis.trends.customersVsAverage < -30) {
      analysis.recommendations.push('Increase marketing spend');
      analysis.recommendations.push('Review conversion funnel for drop-offs');
    }
    
    logger.info(`Analysis complete: ${analysis.anomalies.length} anomalies, review required: ${analysis.requiresReview}`);
    return analysis;
  }

  async updateNotionDashboard(revenueData, analysis) {
    try {
      logger.info('Updating Notion revenue dashboard...');
      
      const dashboardProperties = {
        Name: {
          title: [{ text: { content: `Revenue Report - ${revenueData.date}` } }]
        },
        Date: {
          date: { start: new Date(revenueData.date).toISOString() }
        },
        'Total Revenue': {
          number: revenueData.totalRevenue
        },
        'New Customers': {
          number: revenueData.newCustomers
        },
        'Active Subscriptions': {
          number: revenueData.activeSubscriptions
        },
        'MRR': {
          number: revenueData.monthlyRecurringRevenue
        },
        'Revenue Trend': {
          rich_text: [{ text: { content: `${analysis.trends.revenueVsAverage}% vs average` } }]
        },
        'Anomalies': {
          number: analysis.anomalies.length
        },
        'Requires Review': {
          checkbox: analysis.requiresReview
        },
        Status: {
          select: { name: analysis.requiresReview ? 'Needs Review' : 'Normal' }
        }
      };

      if (config.notion.databaseIds.reports) {
        const page = await this.notion.createPage(
          config.notion.databaseIds.reports,
          dashboardProperties
        );
        
        // Add detailed analysis as page content
        if (analysis.anomalies.length > 0 || analysis.recommendations.length > 0) {
          const blocks = [];
          
          if (analysis.anomalies.length > 0) {
            blocks.push({
              type: 'heading_2',
              heading_2: {
                rich_text: [{ text: { content: '🚨 Anomalies Detected' } }]
              }
            });
            
            analysis.anomalies.forEach(anomaly => {
              blocks.push({
                type: 'bulleted_list_item',
                bulleted_list_item: {
                  rich_text: [{ text: { content: `${anomaly.message} (${anomaly.severity} severity)` } }]
                }
              });
            });
          }
          
          if (analysis.recommendations.length > 0) {
            blocks.push({
              type: 'heading_2',
              heading_2: {
                rich_text: [{ text: { content: '💡 Recommendations' } }]
              }
            });
            
            analysis.recommendations.forEach(rec => {
              blocks.push({
                type: 'bulleted_list_item',
                bulleted_list_item: {
                  rich_text: [{ text: { content: rec } }]
                }
              });
            });
          }
          
          await this.notion.appendToPage(page.id, blocks);
        }
        
        logger.info(`Updated Notion dashboard with revenue data`);
      }
    } catch (error) {
      logger.error(`Failed to update Notion dashboard: ${error.message}`);
    }
  }

  async generateDriveReport(revenueData, analysis) {
    try {
      logger.info('Generating detailed report in Google Drive...');
      
      const reportContent = `
# Revenue Report - ${revenueData.date}

## Executive Summary
- **Total Revenue**: $${revenueData.totalRevenue.toLocaleString()}
- **New Customers**: ${revenueData.newCustomers}
- **Active Subscriptions**: ${revenueData.activeSubscriptions}
- **Monthly Recurring Revenue**: $${revenueData.monthlyRecurringRevenue.toLocaleString()}

## Trend Analysis
- **Revenue vs Average**: ${analysis.trends.revenueVsAverage}%
- **Customer Acquisition vs Average**: ${analysis.trends.customersVsAverage}%
- **Revenue per Customer**: $${analysis.trends.revenuePerCustomer}

## Anomalies (${analysis.anomalies.length})
${analysis.anomalies.map(a => `- **${a.type}**: ${a.message} (${a.severity} severity)`).join('\n')}

## Recommendations
${analysis.recommendations.map(r => `- ${r}`).join('\n')}

## Detailed Data
- **Total Payments**: ${revenueData.paymentsCount}
- **Paid Invoices**: ${revenueData.paidInvoices}
- **Review Required**: ${analysis.requiresReview ? 'Yes' : 'No'}

Generated on: ${new Date().toLocaleString()}
`;
      
      const fileName = `Revenue_Report_${revenueData.date.replace(/-/g, '_')}.md`;
      
      await this.googleDrive.createFile(
        fileName,
        reportContent,
        'text/markdown',
        [] // Add parent folder IDs if needed
      );
      
      logger.info(`Created detailed report in Google Drive: ${fileName}`);
    } catch (error) {
      logger.error(`Failed to generate Drive report: ${error.message}`);
    }
  }

  async scheduleReviewMeeting(analysis) {
    try {
      logger.info('Scheduling revenue review meeting...');
      
      const meetingTime = new Date();
      meetingTime.setDate(meetingTime.getDate() + 1); // Tomorrow
      meetingTime.setHours(10, 0, 0, 0); // 10 AM
      
      const event = {
        summary: `🔍 Revenue Review Meeting - Anomalies Detected`,
        description: `
Revenue review meeting scheduled due to detected anomalies:

${analysis.anomalies.map(a => `• ${a.message}`).join('\n')}

Recommendations to discuss:
${analysis.recommendations.map(r => `• ${r}`).join('\n')}

Please review the Notion dashboard and Google Drive report before the meeting.
        `,
        start: {
          dateTime: meetingTime.toISOString(),
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: new Date(meetingTime.getTime() + 60 * 60 * 1000).toISOString(),
          timeZone: 'America/New_York'
        },
        attendees: [
          { email: 'ceo@company.com' },
          { email: 'cfo@company.com' },
          { email: 'head-of-sales@company.com' }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 120 },
            { method: 'popup', minutes: 15 }
          ]
        }
      };
      
      await this.calendar.createEvent('primary', event);
      logger.info(`Scheduled revenue review meeting for tomorrow at 10 AM`);
    } catch (error) {
      logger.error(`Failed to schedule review meeting: ${error.message}`);
    }
  }

  async createAnomalyIssues(anomalies) {
    try {
      const highSeverityAnomalies = anomalies.filter(a => a.severity === 'high');
      
      if (highSeverityAnomalies.length > 0) {
        const title = `🚨 High Severity Revenue Anomalies Detected`;
        const body = `
## Revenue Anomalies Detected

**Date**: ${formatDate()}
**Severity**: High
**Count**: ${highSeverityAnomalies.length}

## Anomalies
${highSeverityAnomalies.map(a => `
### ${a.type}
- **Message**: ${a.message}
- **Actual Value**: ${a.value}
- **Expected Value**: ${a.expected}
- **Severity**: ${a.severity}
`).join('\n')}

## Immediate Actions Required
- [ ] Investigate root cause
- [ ] Check for system issues
- [ ] Review customer feedback
- [ ] Analyze competitor activity
- [ ] Prepare executive summary

## Context
This issue was automatically created by the Revenue Tracker automation due to significant deviations from expected revenue patterns.

*Auto-generated on: ${new Date().toLocaleString()}*
        `;

        await this.github.createIssue(
          'your-org',
          'gmtm-ops-automation',
          title,
          body,
          ['revenue-anomaly', 'high-priority', 'requires-investigation']
        );
        
        logger.info(`Created GitHub issue for ${highSeverityAnomalies.length} high severity anomalies`);
      }
    } catch (error) {
      logger.error(`Failed to create anomaly issues: ${error.message}`);
    }
  }

  async createFailureIssue(error) {
    try {
      const title = `🚨 Revenue Tracker Automation Failed`;
      const body = `
## Automation Failure

**Automation**: ${this.name}
**Time**: ${new Date().toLocaleString()}
**Error**: ${error.message}

## Impact
The revenue tracking automation failed, which may result in:
- Missing revenue data
- Undetected anomalies
- Lack of executive reporting
- Potential revenue loss due to unidentified issues

## Error Details
\`\`\`
${error.stack}
\`\`\`

## Immediate Actions
- [ ] Investigate the failure
- [ ] Check Stripe API connectivity
- [ ] Verify Notion/Drive permissions
- [ ] Run manual revenue analysis
- [ ] Fix the automation
- [ ] Test the fix

*This issue was automatically created by the Revenue Tracker automation*
      `;

      await this.github.createIssue(
        'your-org',
        'gmtm-ops-automation',
        title,
        body,
        ['automation-failure', 'revenue-tracker', 'critical']
      );
      
    } catch (ghError) {
      logger.error(`Failed to create failure issue: ${ghError.message}`);
    }
  }
}

module.exports = MCPRevenueTrackerAutomation;