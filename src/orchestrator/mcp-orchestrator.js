const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const logger = require('../shared/logging/logger');
const metrics = require('../shared/logging/metrics');
const { config } = require('../shared/config');
const { createMCPAdapters } = require('../shared/integrations/mcp-adapters');
const CursorSlackNotifier = require('../shared/integrations/cursor-slack-notifier');

/**
 * MCP-Enhanced Automation Orchestrator
 * 
 * This orchestrator is designed to work within Claude Code's environment
 * where MCP tools are available for direct integration.
 */
class MCPAutomationOrchestrator {
  constructor() {
    this.automations = new Map();
    this.schedules = new Map();
    this.isInitialized = false;
    this.mcpAdapters = createMCPAdapters();
    this.isClaudeCodeEnvironment = this.detectClaudeCodeEnvironment();
    this.cursorSlack = new CursorSlackNotifier();
  }

  detectClaudeCodeEnvironment() {
    // Check if we're running in Claude Code environment
    // This is a placeholder - actual detection would depend on Claude Code's runtime
    return process.env.CLAUDE_CODE_RUNTIME === 'true' || process.env.NODE_ENV === 'claude-code';
  }

  async initialize() {
    try {
      logger.info('Initializing MCP-Enhanced Automation Orchestrator...');
      
      // Test MCP connectivity if in Claude Code environment
      if (this.isClaudeCodeEnvironment) {
        await this.testMCPConnectivity();
      }
      
      // Load all automations
      await this.loadAutomations();
      
      // Set up scheduled tasks
      this.setupScheduledTasks();
      
      this.isInitialized = true;
      logger.info('MCP-Enhanced Automation Orchestrator initialized successfully');
      
      // Create GitHub issue for successful initialization if in Claude Code
      if (this.isClaudeCodeEnvironment) {
        await this.createGitHubStatusIssue('Orchestrator Initialized', 'System successfully initialized with MCP integrations');
      }
      
    } catch (error) {
      logger.error('Failed to initialize MCP-Enhanced Automation Orchestrator:', error);
      
      // Create GitHub issue for initialization failure
      if (this.isClaudeCodeEnvironment) {
        await this.createGitHubStatusIssue('Orchestrator Initialization Failed', `Error: ${error.message}`);
      }
      
      throw error;
    }
  }

  async testMCPConnectivity() {
    logger.info('Testing MCP connectivity...');
    
    const tests = [
      { name: 'Gmail', test: () => this.mcpAdapters.gmail.searchEmails('test', 1) },
      { name: 'Notion', test: () => this.mcpAdapters.notion.queryDatabase('test', {}, []) },
      { name: 'Google Calendar', test: () => this.mcpAdapters.googleCalendar.getEvents('primary', new Date().toISOString(), new Date().toISOString()) },
      { name: 'GitHub', test: () => this.mcpAdapters.github.getRepositoryInfo('test', 'test') }
    ];

    for (const test of tests) {
      try {
        await test.test();
        logger.info(`MCP ${test.name} connectivity: OK`);
      } catch (error) {
        logger.warn(`MCP ${test.name} connectivity: FAILED - ${error.message}`);
      }
    }
  }

  async loadAutomations() {
    const automationsDir = path.join(__dirname, '../automations');
    
    if (!fs.existsSync(automationsDir)) {
      fs.mkdirSync(automationsDir, { recursive: true });
      logger.info('Created automations directory');
      return;
    }

    try {
      const files = fs.readdirSync(automationsDir);
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          const automationName = path.basename(file, '.js');
          const automationPath = path.join(automationsDir, file);
          
          try {
            const AutomationClass = require(automationPath);
            const automation = new AutomationClass(this.mcpAdapters);
            
            if (!automation.name || typeof automation.execute !== 'function') {
              logger.warn(`Invalid automation structure in ${file}`);
              continue;
            }
            
            this.automations.set(automationName, automation);
            logger.info(`Loaded MCP automation: ${automation.name}`);
          } catch (error) {
            logger.error(`Failed to load automation ${file}:`, error);
          }
        }
      }
      
      logger.info(`Loaded ${this.automations.size} MCP automations`);
    } catch (error) {
      logger.error('Error loading automations:', error);
    }
  }

  async runAutomation(automationName, options = {}) {
    if (!this.automations.has(automationName)) {
      throw new Error(`Automation '${automationName}' not found`);
    }

    const automation = this.automations.get(automationName);
    const runKey = metrics.recordAutomationStart(automation.name);
    
    try {
      logger.info(`Starting MCP automation: ${automation.name}`);
      
      // Send Cursor-Slack notification
      await this.cursorSlack.sendNotification({
        type: 'automation_update',
        data: {
          automation: automation.name,
          status: 'started',
          details: { triggeredBy: options.triggeredBy || 'System' }
        }
      });
      
      // Create calendar event for automation run
      if (this.isClaudeCodeEnvironment) {
        await this.createCalendarEvent(automation.name, 'started');
      }
      
      const result = await automation.execute(options);
      
      metrics.recordAutomationEnd(runKey, 'success');
      
      // Update calendar event and create success notification
      if (this.isClaudeCodeEnvironment) {
        await this.updateCalendarEvent(automation.name, 'completed', result?.summary);
        await this.createNotionReport(automation.name, result);
      }
      
      logger.info(`MCP automation completed: ${automation.name}`);
      return result;
      
    } catch (error) {
      logger.error(`MCP automation failed: ${automation.name}`, error);
      
      metrics.recordAutomationEnd(runKey, 'failed', error);
      
      // Create GitHub issue for automation failure
      if (this.isClaudeCodeEnvironment) {
        await this.createGitHubIssue(automation.name, error);
        await this.updateCalendarEvent(automation.name, 'failed', error.message);
      }
      
      throw error;
    }
  }

  async createCalendarEvent(automationName, status) {
    try {
      const event = {
        summary: `🤖 ${automationName} - ${status}`,
        description: `Automation ${automationName} ${status} at ${new Date().toLocaleString()}`,
        start: {
          dateTime: new Date().toISOString(),
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
          timeZone: 'America/New_York'
        }
      };
      
      await this.mcpAdapters.googleCalendar.createEvent('primary', event);
      logger.info(`Created calendar event for ${automationName}`);
    } catch (error) {
      logger.warn(`Failed to create calendar event: ${error.message}`);
    }
  }

  async updateCalendarEvent(automationName, status, details) {
    // This would require storing event IDs, simplified for example
    logger.info(`Would update calendar event for ${automationName}: ${status} - ${details}`);
  }

  async createNotionReport(automationName, result) {
    try {
      const reportProperties = {
        Name: {
          title: [{ text: { content: `${automationName} Report` } }]
        },
        Status: {
          select: { name: result.success ? 'Success' : 'Failed' }
        },
        Date: {
          date: { start: new Date().toISOString() }
        },
        Details: {
          rich_text: [{ text: { content: result.summary || 'No details available' } }]
        }
      };

      if (config.notion?.databaseIds?.reports) {
        await this.mcpAdapters.notion.createPage(
          config.notion.databaseIds.reports,
          reportProperties
        );
        logger.info(`Created Notion report for ${automationName}`);
      } else {
        logger.info(`Would create Notion report for ${automationName} (database not configured)`);
      }
    } catch (error) {
      logger.warn(`Failed to create Notion report: ${error.message}`);
    }
  }

  async createGitHubIssue(automationName, error) {
    try {
      const title = `🚨 Automation Failure: ${automationName}`;
      const body = `
## Automation Failure Report

**Automation:** ${automationName}
**Time:** ${new Date().toLocaleString()}
**Error:** ${error.message}

## Stack Trace
\`\`\`
${error.stack}
\`\`\`

## Next Steps
- [ ] Investigate root cause
- [ ] Fix the issue
- [ ] Test the automation
- [ ] Deploy the fix

*This issue was automatically created by the MCP Automation Orchestrator*
      `;

      await this.mcpAdapters.github.createIssue(
        'your-org', // Replace with your GitHub org/user
        'gmtm-ops-automation', // Replace with your repo name
        title,
        body,
        ['automation-failure', 'bug']
      );
      
      logger.info(`Created GitHub issue for ${automationName} failure`);
    } catch (error) {
      logger.warn(`Failed to create GitHub issue: ${error.message}`);
    }
  }

  async createGitHubStatusIssue(title, message) {
    try {
      await this.mcpAdapters.github.createIssue(
        'your-org',
        'gmtm-ops-automation',
        `📊 ${title}`,
        `${message}\n\n*Generated at: ${new Date().toLocaleString()}*`,
        ['status', 'automation']
      );
    } catch (error) {
      logger.warn(`Failed to create GitHub status issue: ${error.message}`);
    }
  }

  setupScheduledTasks() {
    for (const [name, automation] of this.automations) {
      if (automation.schedule) {
        const task = cron.schedule(automation.schedule, async () => {
          try {
            await this.runAutomation(name, { scheduled: true });
          } catch (error) {
            logger.error(`Scheduled MCP automation failed: ${name}`, error);
          }
        }, {
          scheduled: false,
          timezone: 'America/New_York'
        });
        
        this.schedules.set(name, task);
        logger.info(`Scheduled MCP automation: ${name} (${automation.schedule})`);
      }
    }
  }

  startScheduledTasks() {
    for (const [name, task] of this.schedules) {
      task.start();
      logger.info(`Started scheduled MCP task: ${name}`);
    }
  }

  stopScheduledTasks() {
    for (const [name, task] of this.schedules) {
      task.stop();
      logger.info(`Stopped scheduled MCP task: ${name}`);
    }
  }

  async getStatus() {
    const mcpStatus = this.isClaudeCodeEnvironment ? 'Connected' : 'Simulated';
    
    return {
      initialized: this.isInitialized,
      mcpEnvironment: mcpStatus,
      automationsCount: this.automations.size,
      scheduledTasksCount: this.schedules.size,
      automations: Array.from(this.automations.values()).map(automation => ({
        name: automation.name,
        description: automation.description || 'No description available',
        schedule: automation.schedule || 'Manual only',
        enabled: automation.enabled !== false,
        usesGmail: !!automation.usesGmail,
        usesNotion: !!automation.usesNotion,
        usesCalendar: !!automation.usesCalendar,
        usesGitHub: !!automation.usesGitHub
      })),
      metrics: this.getMetrics().summary
    };
  }

  getMetrics() {
    return metrics.getMetrics();
  }
}

module.exports = MCPAutomationOrchestrator;