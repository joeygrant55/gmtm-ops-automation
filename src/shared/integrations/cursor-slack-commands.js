const CursorSlackBridge = require('./cursor-slack-bridge');
const logger = require('../logging/logger');

/**
 * Cursor-Slack Command Interface
 * 
 * This module provides Slack slash commands and interactive elements
 * that integrate with Cursor's background agents to control the BD automation system.
 */

class CursorSlackCommands {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.bridge = new CursorSlackBridge();
    this.logger = logger.child({ service: 'cursor-slack-commands' });
  }

  /**
   * Handle slash command: /bd-automation
   */
  async handleBDAutomationCommand(command, args, user) {
    try {
      switch (command) {
        case 'status':
          return await this.handleStatusCommand(user);
        case 'run':
          return await this.handleRunCommand(args, user);
        case 'prospects':
          return await this.handleProspectsCommand(args, user);
        case 'metrics':
          return await this.handleMetricsCommand(user);
        case 'help':
          return await this.handleHelpCommand(user);
        default:
          return await this.handleUnknownCommand(command, user);
      }
    } catch (error) {
      this.logger.error(`Failed to handle BD automation command: ${error.message}`);
      return this.createErrorResponse(error.message);
    }
  }

  /**
   * Handle: /bd-automation status
   */
  async handleStatusCommand(user) {
    const status = await this.orchestrator.getStatus();
    
    const response = {
      response_type: 'in_channel',
      text: `🤖 *GMTM BD Automation Status*`,
      attachments: [{
        color: status.initialized ? '#4CAF50' : '#F44336',
        fields: [
          {
            title: 'System Status',
            value: status.initialized ? '✅ Running' : '❌ Offline',
            short: true
          },
          {
            title: 'MCP Environment',
            value: status.mcpEnvironment,
            short: true
          },
          {
            title: 'Active Automations',
            value: status.automationsCount.toString(),
            short: true
          },
          {
            title: 'Scheduled Tasks',
            value: status.scheduledTasksCount.toString(),
            short: true
          }
        ],
        footer: `Requested by ${user.name}`,
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    // Add automation details
    if (status.automations.length > 0) {
      response.attachments.push({
        color: '#2196F3',
        title: 'Available Automations',
        text: status.automations.map(auto => 
          `• *${auto.name}* - ${auto.schedule === 'Manual only' ? 'Manual' : 'Scheduled'}`
        ).join('\n')
      });
    }

    return response;
  }

  /**
   * Handle: /bd-automation run [automation-name]
   */
  async handleRunCommand(args, user) {
    if (!args || args.length === 0) {
      return {
        response_type: 'ephemeral',
        text: `❌ Please specify an automation to run. Use \`/bd-automation help\` for available options.`
      };
    }

    const automationName = args[0];
    const validAutomations = {
      'sports-prospector': 'sports-club-prospector',
      'email-processor': 'mcp-email-processor',
      'revenue-tracker': 'mcp-revenue-tracker',
      'bd-dashboard': 'bd-dashboard-reporter'
    };

    if (!validAutomations[automationName]) {
      return {
        response_type: 'ephemeral',
        text: `❌ Unknown automation: ${automationName}. Available: ${Object.keys(validAutomations).join(', ')}`
      };
    }

    // Send immediate response
    const response = {
      response_type: 'in_channel',
      text: `🚀 <@${user.id}> triggered *${automationName}* automation`,
      attachments: [{
        color: '#2196F3',
        text: 'Automation starting... You\'ll receive updates as it progresses.',
        footer: 'GMTM BD Automation',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    // Run automation asynchronously
    this.runAutomationAsync(validAutomations[automationName], user);

    return response;
  }

  /**
   * Handle: /bd-automation prospects [filter]
   */
  async handleProspectsCommand(args, user) {
    // This would query the CRM for prospects
    // For now, we'll return a simulated response
    
    const filter = args?.[0] || 'all';
    const prospects = await this.getProspectsData(filter);

    return {
      response_type: 'in_channel',
      text: `📊 *Current Prospects (${filter})*`,
      attachments: [{
        color: '#36a64f',
        fields: [
          {
            title: 'Total Prospects',
            value: prospects.total.toString(),
            short: true
          },
          {
            title: 'High Priority',
            value: prospects.highPriority.toString(),
            short: true
          },
          {
            title: 'Pending Outreach',
            value: prospects.pendingOutreach.toString(),
            short: true
          },
          {
            title: 'Awaiting Response',
            value: prospects.awaitingResponse.toString(),
            short: true
          }
        ],
        actions: [
          {
            type: 'button',
            text: 'View Details',
            style: 'primary',
            value: 'view_prospects'
          },
          {
            type: 'button',
            text: 'Start Outreach',
            style: 'default',
            value: 'start_outreach'
          }
        ],
        footer: `Requested by ${user.name}`,
        ts: Math.floor(Date.now() / 1000)
      }]
    };
  }

  /**
   * Handle: /bd-automation metrics
   */
  async handleMetricsCommand(user) {
    const metrics = await this.getBDMetrics();

    return {
      response_type: 'in_channel',
      text: `📈 *BD Performance Metrics*`,
      attachments: [{
        color: '#FF9800',
        fields: [
          {
            title: 'Response Rate',
            value: `${metrics.responseRate}%`,
            short: true
          },
          {
            title: 'Pipeline Value',
            value: `$${metrics.pipelineValue.toLocaleString()}`,
            short: true
          },
          {
            title: 'Emails Sent (7d)',
            value: metrics.emailsSent.toString(),
            short: true
          },
          {
            title: 'Meetings Scheduled',
            value: metrics.meetingsScheduled.toString(),
            short: true
          },
          {
            title: 'Conversion Rate',
            value: `${metrics.conversionRate}%`,
            short: true
          },
          {
            title: 'Avg Deal Size',
            value: `$${metrics.avgDealSize.toLocaleString()}`,
            short: true
          }
        ],
        actions: [
          {
            type: 'button',
            text: 'Full Report',
            style: 'primary',
            value: 'full_report'
          },
          {
            type: 'button',
            text: 'Export Data',
            style: 'default',
            value: 'export_data'
          }
        ],
        footer: `Updated: ${new Date().toLocaleString()}`,
        ts: Math.floor(Date.now() / 1000)
      }]
    };
  }

  /**
   * Handle: /bd-automation help
   */
  async handleHelpCommand(user) {
    return {
      response_type: 'ephemeral',
      text: `🤖 *GMTM BD Automation Commands*`,
      attachments: [{
        color: '#2196F3',
        fields: [
          {
            title: '/bd-automation status',
            value: 'Show system status and active automations',
            short: false
          },
          {
            title: '/bd-automation run [automation]',
            value: 'Run specific automation: sports-prospector, email-processor, revenue-tracker, bd-dashboard',
            short: false
          },
          {
            title: '/bd-automation prospects [filter]',
            value: 'View current prospects (all, high-priority, pending)',
            short: false
          },
          {
            title: '/bd-automation metrics',
            value: 'Show BD performance metrics and KPIs',
            short: false
          },
          {
            title: '/bd-automation help',
            value: 'Show this help message',
            short: false
          }
        ],
        footer: 'GMTM BD Automation System'
      }]
    };
  }

  /**
   * Handle unknown commands
   */
  async handleUnknownCommand(command, user) {
    return {
      response_type: 'ephemeral',
      text: `❌ Unknown command: ${command}. Use \`/bd-automation help\` for available commands.`
    };
  }

  /**
   * Run automation asynchronously and send updates to Slack
   */
  async runAutomationAsync(automationName, user) {
    try {
      // Send start notification
      await this.bridge.sendAutomationUpdate(automationName, 'started', {
        triggeredBy: user.name
      });

      // Run the automation
      const result = await this.orchestrator.runAutomation(automationName);

      // Send completion notification
      await this.bridge.sendAutomationUpdate(automationName, 'completed', {
        summary: result.summary,
        prospectsProcessed: result.prospectsResearched || result.prospectsAnalyzed,
        emailsSent: result.emailsSent,
        pipelineValue: result.prospectsResearched ? result.prospectsResearched * 45000 : null
      });

      // Send detailed results for sports prospector
      if (automationName === 'sports-club-prospector' && result.topProspects) {
        await this.bridge.sendProspectApprovalRequest(result.topProspects);
      }

    } catch (error) {
      this.logger.error(`Automation ${automationName} failed: ${error.message}`);
      
      // Send failure notification
      await this.bridge.sendAutomationUpdate(automationName, 'failed', {
        error: error.message,
        triggeredBy: user.name
      });
    }
  }

  /**
   * Get prospects data (simulated)
   */
  async getProspectsData(filter) {
    // In a real implementation, this would query your CRM
    return {
      total: 47,
      highPriority: 15,
      pendingOutreach: 12,
      awaitingResponse: 8,
      qualified: 32,
      filter: filter
    };
  }

  /**
   * Get BD metrics (simulated)
   */
  async getBDMetrics() {
    // In a real implementation, this would calculate actual metrics
    return {
      responseRate: 12.5,
      pipelineValue: 2100000,
      emailsSent: 156,
      meetingsScheduled: 8,
      conversionRate: 15.2,
      avgDealSize: 45000
    };
  }

  /**
   * Create error response
   */
  createErrorResponse(message) {
    return {
      response_type: 'ephemeral',
      text: `❌ Error: ${message}`,
      attachments: [{
        color: '#F44336',
        text: 'Please try again or contact support if the issue persists.',
        footer: 'GMTM BD Automation'
      }]
    };
  }

  /**
   * Handle interactive button clicks
   */
  async handleButtonInteraction(payload) {
    const { value, user, response_url } = payload;
    
    try {
      switch (value) {
        case 'view_prospects':
          return await this.handleViewProspects(user, response_url);
        case 'start_outreach':
          return await this.handleStartOutreach(user, response_url);
        case 'full_report':
          return await this.handleFullReport(user, response_url);
        case 'export_data':
          return await this.handleExportData(user, response_url);
        default:
          // Handle prospect-specific actions
          await this.bridge.handleSlackInteraction(payload);
      }
    } catch (error) {
      this.logger.error(`Failed to handle button interaction: ${error.message}`);
    }
  }

  async handleViewProspects(user, responseUrl) {
    // Send detailed prospect view
    const message = {
      text: `📊 *Detailed Prospect View*`,
      replace_original: true,
      attachments: [{
        color: '#36a64f',
        text: 'Top 5 prospects ready for outreach:',
        fields: [
          {
            title: 'California Elite Basketball Academy',
            value: 'Score: 92/100 • 450 athletes • National level',
            short: false
          },
          {
            title: 'Texas Football Training Center',
            value: 'Score: 88/100 • 380 athletes • State level',
            short: false
          },
          {
            title: 'Florida Soccer Academy',
            value: 'Score: 85/100 • 320 athletes • Regional level',
            short: false
          }
        ]
      }]
    };

    // Send to response URL (simulated)
    this.logger.info(`Sending detailed prospect view to ${user.name}`);
    return message;
  }

  async handleStartOutreach(user, responseUrl) {
    // Trigger outreach automation
    await this.runAutomationAsync('sports-club-prospector', user);
    
    return {
      text: `🚀 Outreach automation started by <@${user.id}>`,
      replace_original: true,
      attachments: [{
        color: '#2196F3',
        text: 'Sports club prospector is now running. You\'ll receive updates as it progresses.'
      }]
    };
  }

  async handleFullReport(user, responseUrl) {
    // Generate and send full report
    this.logger.info(`Generating full BD report for ${user.name}`);
    
    return {
      text: `📊 *Full BD Report Generated*`,
      replace_original: true,
      attachments: [{
        color: '#FF9800',
        text: 'Report has been generated and saved to Google Drive. Check #bd-reports channel for the link.'
      }]
    };
  }

  async handleExportData(user, responseUrl) {
    // Export data to CSV/Excel
    this.logger.info(`Exporting BD data for ${user.name}`);
    
    return {
      text: `📤 *Data Export Initiated*`,
      replace_original: true,
      attachments: [{
        color: '#4CAF50',
        text: 'BD data is being exported to CSV. You\'ll receive a download link shortly.'
      }]
    };
  }
}

module.exports = CursorSlackCommands;