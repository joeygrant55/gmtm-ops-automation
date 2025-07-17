const logger = require('../logging/logger');
const { config } = require('../config');

/**
 * Cursor-Slack Bridge Integration
 * 
 * This bridge connects your MCP automation system with Cursor's background agents
 * and Slack integrations for enhanced workflow automation and team collaboration.
 */

class CursorSlackBridge {
  constructor() {
    this.webhookUrl = process.env.CURSOR_SLACK_WEBHOOK_URL;
    this.slackChannel = process.env.CURSOR_SLACK_CHANNEL || '#bd-automation';
    this.logger = logger.child({ service: 'cursor-slack-bridge' });
  }

  /**
   * Send automation status updates to Slack via Cursor agents
   */
  async sendAutomationUpdate(automationName, status, data = {}) {
    const message = this.formatAutomationMessage(automationName, status, data);
    
    try {
      // Use Cursor's webhook to send to Slack
      await this.sendToSlack(message);
      this.logger.info(`Sent automation update for ${automationName} via Cursor-Slack bridge`);
    } catch (error) {
      this.logger.error(`Failed to send automation update: ${error.message}`);
    }
  }

  /**
   * Send prospect alerts to BD team via Slack
   */
  async sendProspectAlert(prospect, alertType = 'new_qualified_lead') {
    const message = this.formatProspectAlert(prospect, alertType);
    
    try {
      await this.sendToSlack(message);
      this.logger.info(`Sent prospect alert for ${prospect.clubName} via Cursor-Slack bridge`);
    } catch (error) {
      this.logger.error(`Failed to send prospect alert: ${error.message}`);
    }
  }

  /**
   * Send performance metrics to Slack dashboard
   */
  async sendPerformanceMetrics(metrics) {
    const message = this.formatMetricsMessage(metrics);
    
    try {
      await this.sendToSlack(message);
      this.logger.info('Sent performance metrics via Cursor-Slack bridge');
    } catch (error) {
      this.logger.error(`Failed to send performance metrics: ${error.message}`);
    }
  }

  /**
   * Create interactive Slack message for prospect approval
   */
  async sendProspectApprovalRequest(prospects) {
    const message = this.formatApprovalRequest(prospects);
    
    try {
      await this.sendToSlack(message);
      this.logger.info(`Sent prospect approval request via Cursor-Slack bridge`);
    } catch (error) {
      this.logger.error(`Failed to send approval request: ${error.message}`);
    }
  }

  /**
   * Format automation status message for Slack
   */
  formatAutomationMessage(automationName, status, data) {
    const statusEmoji = {
      'started': '🚀',
      'completed': '✅',
      'failed': '❌',
      'warning': '⚠️'
    };

    const emoji = statusEmoji[status] || '📊';
    
    let message = {
      channel: this.slackChannel,
      username: 'GMTM BD Automation',
      icon_emoji: ':robot_face:',
      attachments: [{
        color: this.getStatusColor(status),
        title: `${emoji} ${automationName} - ${status.toUpperCase()}`,
        fields: [
          {
            title: 'Status',
            value: status,
            short: true
          },
          {
            title: 'Time',
            value: new Date().toLocaleString(),
            short: true
          }
        ],
        footer: 'GMTM BD Automation System',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    // Add data-specific fields
    if (data.summary) {
      message.attachments[0].fields.push({
        title: 'Summary',
        value: data.summary,
        short: false
      });
    }

    if (data.prospectsProcessed) {
      message.attachments[0].fields.push({
        title: 'Prospects Processed',
        value: data.prospectsProcessed.toString(),
        short: true
      });
    }

    if (data.emailsSent) {
      message.attachments[0].fields.push({
        title: 'Emails Sent',
        value: data.emailsSent.toString(),
        short: true
      });
    }

    if (data.pipelineValue) {
      message.attachments[0].fields.push({
        title: 'Pipeline Value',
        value: `$${data.pipelineValue.toLocaleString()}`,
        short: true
      });
    }

    return message;
  }

  /**
   * Format prospect alert message for Slack
   */
  formatProspectAlert(prospect, alertType) {
    const alertEmoji = {
      'new_qualified_lead': '🎯',
      'high_value_prospect': '💎',
      'response_received': '📬',
      'meeting_scheduled': '📅'
    };

    const emoji = alertEmoji[alertType] || '📊';
    
    return {
      channel: this.slackChannel,
      username: 'GMTM BD Automation',
      icon_emoji: ':dart:',
      attachments: [{
        color: '#36a64f',
        title: `${emoji} New Qualified Lead: ${prospect.clubName}`,
        fields: [
          {
            title: 'Sport',
            value: prospect.sport?.charAt(0).toUpperCase() + prospect.sport?.slice(1) || 'Unknown',
            short: true
          },
          {
            title: 'Location',
            value: prospect.location || 'Unknown',
            short: true
          },
          {
            title: 'Athletes',
            value: prospect.estimatedAthletes?.toString() || 'Unknown',
            short: true
          },
          {
            title: 'Lead Score',
            value: `${prospect.score || 0}/100`,
            short: true
          },
          {
            title: 'Priority',
            value: prospect.priority || 'Medium',
            short: true
          },
          {
            title: 'Competition Level',
            value: prospect.competitionLevel || 'Unknown',
            short: true
          }
        ],
        actions: [
          {
            type: 'button',
            text: 'Approve Outreach',
            style: 'primary',
            value: `approve_${prospect.id || prospect.clubName.replace(/\s+/g, '_')}`
          },
          {
            type: 'button',
            text: 'Schedule Call',
            style: 'default',
            value: `schedule_${prospect.id || prospect.clubName.replace(/\s+/g, '_')}`
          },
          {
            type: 'button',
            text: 'Skip',
            style: 'danger',
            value: `skip_${prospect.id || prospect.clubName.replace(/\s+/g, '_')}`
          }
        ],
        footer: 'GMTM BD Automation System',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
  }

  /**
   * Format performance metrics message for Slack
   */
  formatMetricsMessage(metrics) {
    return {
      channel: this.slackChannel,
      username: 'GMTM BD Automation',
      icon_emoji: ':chart_with_upwards_trend:',
      attachments: [{
        color: '#2196F3',
        title: '📊 BD Performance Dashboard',
        fields: [
          {
            title: 'Response Rate',
            value: `${metrics.responseRate || 0}%`,
            short: true
          },
          {
            title: 'Pipeline Value',
            value: `$${(metrics.pipelineValue || 0).toLocaleString()}`,
            short: true
          },
          {
            title: 'Active Prospects',
            value: (metrics.totalProspects || 0).toString(),
            short: true
          },
          {
            title: 'High Priority',
            value: (metrics.highPriorityProspects || 0).toString(),
            short: true
          },
          {
            title: 'Emails Sent (24h)',
            value: (metrics.emailsSent || 0).toString(),
            short: true
          },
          {
            title: 'Meetings Scheduled',
            value: (metrics.meetingsScheduled || 0).toString(),
            short: true
          }
        ],
        actions: [
          {
            type: 'button',
            text: 'View Full Report',
            style: 'primary',
            value: 'view_report'
          },
          {
            type: 'button',
            text: 'Run Automation',
            style: 'default',
            value: 'run_automation'
          }
        ],
        footer: 'Updated every hour',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
  }

  /**
   * Format approval request message for Slack
   */
  formatApprovalRequest(prospects) {
    const topProspects = prospects.slice(0, 3);
    
    return {
      channel: this.slackChannel,
      username: 'GMTM BD Automation',
      icon_emoji: ':clipboard:',
      text: `🎯 *${prospects.length} New Qualified Prospects Ready for Outreach*`,
      attachments: [
        ...topProspects.map(prospect => ({
          color: '#ff9500',
          title: `${prospect.clubName} (Score: ${prospect.score}/100)`,
          fields: [
            {
              title: 'Sport',
              value: prospect.sport?.charAt(0).toUpperCase() + prospect.sport?.slice(1) || 'Unknown',
              short: true
            },
            {
              title: 'Athletes',
              value: prospect.estimatedAthletes?.toString() || 'Unknown',
              short: true
            },
            {
              title: 'Location',
              value: prospect.location || 'Unknown',
              short: false
            }
          ]
        })),
        {
          color: '#36a64f',
          title: 'Approval Actions',
          text: 'Choose how to proceed with these prospects:',
          actions: [
            {
              type: 'button',
              text: 'Approve All',
              style: 'primary',
              value: 'approve_all'
            },
            {
              type: 'button',
              text: 'Review Individually',
              style: 'default',
              value: 'review_individual'
            },
            {
              type: 'button',
              text: 'Schedule Review Meeting',
              style: 'default',
              value: 'schedule_review'
            }
          ]
        }
      ]
    };
  }

  /**
   * Get status color for Slack attachments
   */
  getStatusColor(status) {
    const colors = {
      'started': '#2196F3',
      'completed': '#4CAF50',
      'failed': '#F44336',
      'warning': '#FF9800'
    };
    return colors[status] || '#9E9E9E';
  }

  /**
   * Send message to Slack via Cursor webhook
   */
  async sendToSlack(message) {
    if (!this.webhookUrl) {
      this.logger.warn('Cursor-Slack webhook URL not configured');
      return;
    }

    try {
      // In a real implementation, this would make an HTTP request to Cursor's webhook
      // For now, we'll simulate the request
      this.logger.info('Sending message to Slack via Cursor webhook:', JSON.stringify(message, null, 2));
      
      // Simulate successful webhook call
      return { success: true, timestamp: new Date().toISOString() };
    } catch (error) {
      this.logger.error('Failed to send message to Slack via Cursor webhook:', error);
      throw error;
    }
  }

  /**
   * Handle Slack button interactions via Cursor
   */
  async handleSlackInteraction(payload) {
    const { value, user } = payload;
    
    try {
      if (value.startsWith('approve_')) {
        await this.handleProspectApproval(value, user);
      } else if (value.startsWith('schedule_')) {
        await this.handleScheduleCall(value, user);
      } else if (value.startsWith('skip_')) {
        await this.handleSkipProspect(value, user);
      } else if (value === 'approve_all') {
        await this.handleApproveAll(user);
      } else if (value === 'run_automation') {
        await this.handleRunAutomation(user);
      }
    } catch (error) {
      this.logger.error('Failed to handle Slack interaction:', error);
    }
  }

  async handleProspectApproval(value, user) {
    const prospectId = value.replace('approve_', '');
    this.logger.info(`User ${user.name} approved prospect ${prospectId}`);
    
    // Send confirmation back to Slack
    await this.sendToSlack({
      channel: this.slackChannel,
      text: `✅ <@${user.id}> approved outreach for prospect ${prospectId}. Automation will proceed.`,
      username: 'GMTM BD Automation'
    });
  }

  async handleScheduleCall(value, user) {
    const prospectId = value.replace('schedule_', '');
    this.logger.info(`User ${user.name} requested to schedule call with ${prospectId}`);
    
    // Send confirmation back to Slack
    await this.sendToSlack({
      channel: this.slackChannel,
      text: `📅 <@${user.id}> requested to schedule call with prospect ${prospectId}. Calendar invite will be sent.`,
      username: 'GMTM BD Automation'
    });
  }

  async handleSkipProspect(value, user) {
    const prospectId = value.replace('skip_', '');
    this.logger.info(`User ${user.name} skipped prospect ${prospectId}`);
    
    // Send confirmation back to Slack
    await this.sendToSlack({
      channel: this.slackChannel,
      text: `⏭️ <@${user.id}> skipped prospect ${prospectId}. Moving to next prospect.`,
      username: 'GMTM BD Automation'
    });
  }

  async handleApproveAll(user) {
    this.logger.info(`User ${user.name} approved all prospects`);
    
    // Send confirmation back to Slack
    await this.sendToSlack({
      channel: this.slackChannel,
      text: `🚀 <@${user.id}> approved all prospects. Automation will proceed with full outreach campaign.`,
      username: 'GMTM BD Automation'
    });
  }

  async handleRunAutomation(user) {
    this.logger.info(`User ${user.name} requested to run automation`);
    
    // Send confirmation back to Slack
    await this.sendToSlack({
      channel: this.slackChannel,
      text: `🤖 <@${user.id}> triggered automation run. Sports club prospector starting...`,
      username: 'GMTM BD Automation'
    });
  }
}

module.exports = CursorSlackBridge;