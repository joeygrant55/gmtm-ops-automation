const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const logger = require('../shared/logging/logger');
const metrics = require('../shared/logging/metrics');
const { config } = require('../shared/config');
const { SlackClient } = require('../shared/integrations');

class AutomationOrchestrator {
  constructor() {
    this.automations = new Map();
    this.schedules = new Map();
    this.isInitialized = false;
    this.slackClient = new SlackClient(config.slack.webhookUrl);
  }

  async initialize() {
    try {
      logger.info('Initializing Automation Orchestrator...');
      
      // Load all automations from the automations directory
      await this.loadAutomations();
      
      // Set up scheduled tasks
      this.setupScheduledTasks();
      
      this.isInitialized = true;
      logger.info('Automation Orchestrator initialized successfully');
      
      await this.slackClient.sendAutomationStatus('Orchestrator', 'started', 'System initialized and ready');
    } catch (error) {
      logger.error('Failed to initialize Automation Orchestrator:', error);
      throw error;
    }
  }

  async loadAutomations() {
    const automationsDir = path.join(__dirname, '../automations');
    
    // Create automations directory if it doesn't exist
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
            const automation = new AutomationClass();
            
            // Validate automation structure
            if (!automation.name || typeof automation.execute !== 'function') {
              logger.warn(`Invalid automation structure in ${file}`);
              continue;
            }
            
            this.automations.set(automationName, automation);
            logger.info(`Loaded automation: ${automation.name}`);
          } catch (error) {
            logger.error(`Failed to load automation ${file}:`, error);
          }
        }
      }
      
      logger.info(`Loaded ${this.automations.size} automations`);
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
      logger.info(`Starting automation: ${automation.name}`);
      
      // Notify via Slack
      await this.slackClient.sendAutomationStatus(automation.name, 'started');
      
      // Execute the automation
      const result = await automation.execute(options);
      
      // Record success metrics
      metrics.recordAutomationEnd(runKey, 'success');
      
      // Notify completion
      await this.slackClient.sendAutomationStatus(
        automation.name, 
        'completed', 
        result?.summary || 'Automation completed successfully'
      );
      
      logger.info(`Automation completed: ${automation.name}`);
      return result;
      
    } catch (error) {
      logger.error(`Automation failed: ${automation.name}`, error);
      
      // Record failure metrics
      metrics.recordAutomationEnd(runKey, 'failed', error);
      
      // Notify failure
      await this.slackClient.sendAutomationStatus(
        automation.name, 
        'failed', 
        error.message
      );
      
      throw error;
    }
  }

  async runAllAutomations(options = {}) {
    const results = {};
    
    for (const [name, automation] of this.automations) {
      try {
        results[name] = await this.runAutomation(name, options);
      } catch (error) {
        results[name] = { error: error.message };
      }
    }
    
    return results;
  }

  setupScheduledTasks() {
    // Set up cron jobs for each automation that has a schedule
    for (const [name, automation] of this.automations) {
      if (automation.schedule) {
        const task = cron.schedule(automation.schedule, async () => {
          try {
            await this.runAutomation(name, { scheduled: true });
          } catch (error) {
            logger.error(`Scheduled automation failed: ${name}`, error);
          }
        }, {
          scheduled: false,
          timezone: 'America/New_York'
        });
        
        this.schedules.set(name, task);
        logger.info(`Scheduled automation: ${name} (${automation.schedule})`);
      }
    }
  }

  startScheduledTasks() {
    for (const [name, task] of this.schedules) {
      task.start();
      logger.info(`Started scheduled task: ${name}`);
    }
  }

  stopScheduledTasks() {
    for (const [name, task] of this.schedules) {
      task.stop();
      logger.info(`Stopped scheduled task: ${name}`);
    }
  }

  getAutomationsList() {
    return Array.from(this.automations.values()).map(automation => ({
      name: automation.name,
      description: automation.description || 'No description available',
      schedule: automation.schedule || 'Manual only',
      enabled: automation.enabled !== false
    }));
  }

  getMetrics() {
    return metrics.getMetrics();
  }

  async getStatus() {
    return {
      initialized: this.isInitialized,
      automationsCount: this.automations.size,
      scheduledTasksCount: this.schedules.size,
      automations: this.getAutomationsList(),
      metrics: this.getMetrics().summary
    };
  }
}

module.exports = AutomationOrchestrator;