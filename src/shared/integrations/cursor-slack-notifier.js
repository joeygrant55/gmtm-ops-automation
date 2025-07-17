const logger = require('../logging/logger');

/**
 * Cursor-Slack Notifier
 * Uses the native Cursor-Slack integration to send BD automation updates
 */
class CursorSlackNotifier {
  constructor() {
    this.logger = logger.child({ service: 'cursor-slack-notifier' });
    this.channel = process.env.SLACK_CHANNEL || '#bd-automation';
  }

  /**
   * Send BD automation notification via Cursor
   */
  async sendNotification(message) {
    try {
      // Format message for Cursor
      const cursorMessage = this.formatForCursor(message);
      
      // Log the message (Cursor will pick this up)
      console.log(`@Cursor post to ${this.channel}: ${cursorMessage}`);
      
      this.logger.info(`Sent notification via Cursor-Slack: ${message.type}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send Cursor-Slack notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Format automation update for Cursor
   */
  formatAutomationUpdate(automationName, status, details = {}) {
    const statusEmoji = {
      'started': '🚀',
      'completed': '✅',
      'failed': '❌',
      'warning': '⚠️'
    };

    const emoji = statusEmoji[status] || '📊';
    
    let message = `${emoji} **${automationName}** - ${status.toUpperCase()}\n`;
    
    if (details.summary) {
      message += `📝 Summary: ${details.summary}\n`;
    }
    
    if (details.prospectsProcessed) {
      message += `🎯 Prospects: ${details.prospectsProcessed}\n`;
    }
    
    if (details.emailsSent) {
      message += `📧 Emails Sent: ${details.emailsSent}\n`;
    }
    
    if (details.pipelineValue) {
      message += `💰 Pipeline Value: $${details.pipelineValue.toLocaleString()}\n`;
    }
    
    return message;
  }

  /**
   * Format prospect alert for Cursor
   */
  formatProspectAlert(prospect) {
    return `🎯 **New Qualified Lead**: ${prospect.clubName}
📍 Location: ${prospect.location}
🏃 Athletes: ${prospect.estimatedAthletes}
📊 Score: ${prospect.score}/100
🏷️ Priority: ${prospect.priority}

@team Should we proceed with outreach?`;
  }

  /**
   * Format metrics update for Cursor
   */
  formatMetricsUpdate(metrics) {
    return `📊 **BD Performance Update**
📈 Response Rate: ${metrics.responseRate}%
💰 Pipeline Value: $${metrics.pipelineValue.toLocaleString()}
🎯 Active Prospects: ${metrics.totalProspects}
📧 Emails (24h): ${metrics.emailsSent}

View full dashboard: [BD Analytics](#)`;
  }

  /**
   * Format message for Cursor based on type
   */
  formatForCursor(message) {
    const { type, data } = message;
    
    switch (type) {
      case 'automation_update':
        return this.formatAutomationUpdate(data.automation, data.status, data.details);
      case 'prospect_alert':
        return this.formatProspectAlert(data.prospect);
      case 'metrics_update':
        return this.formatMetricsUpdate(data.metrics);
      default:
        return JSON.stringify(message, null, 2);
    }
  }

  /**
   * Send high-priority alert
   */
  async sendAlert(title, message, priority = 'medium') {
    const priorityEmoji = {
      'low': '🔵',
      'medium': '🟡',
      'high': '🔴',
      'critical': '🚨'
    };

    const emoji = priorityEmoji[priority] || '📢';
    
    const cursorMessage = `${emoji} **ALERT: ${title}**\n${message}\n\n@team Please review immediately.`;
    
    return this.sendNotification({
      type: 'alert',
      data: { title, message, priority }
    });
  }

  /**
   * Ask Cursor to analyze BD performance
   */
  async requestAnalysis(data) {
    const message = `@Cursor analyze this BD performance data and suggest improvements:

**Current Metrics:**
- Response Rate: ${data.responseRate}%
- Pipeline Value: $${data.pipelineValue}
- Qualified Leads: ${data.qualifiedLeads}
- Conversion Rate: ${data.conversionRate}%

**Recent Campaigns:**
${data.campaigns.map(c => `- ${c.name}: ${c.responseRate}% response`).join('\n')}

What strategies would improve our response and conversion rates?`;

    console.log(message);
    this.logger.info('Requested BD analysis from Cursor');
  }

  /**
   * Request code review for automation updates
   */
  async requestCodeReview(filePath, changes) {
    const message = `@Cursor review these BD automation changes in ${filePath}:

\`\`\`javascript
${changes}
\`\`\`

Focus on:
1. Performance optimization
2. Error handling
3. Best practices for BD automation
`;

    console.log(message);
    this.logger.info('Requested code review from Cursor');
  }
}

module.exports = CursorSlackNotifier;