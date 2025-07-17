const AutomationOrchestrator = require('./src/orchestrator');
const { config, validateConfig } = require('./src/shared/config');
const logger = require('./src/shared/logging/logger');

async function main() {
  try {
    logger.info('Starting GMTM Operations Automation...');
    
    // Validate configuration
    validateConfig();
    
    // Initialize orchestrator
    const orchestrator = new AutomationOrchestrator();
    await orchestrator.initialize();
    
    // Start scheduled tasks
    orchestrator.startScheduledTasks();
    
    // Example: Run a specific automation
    // await orchestrator.runAutomation('example-automation');
    
    // Example: Get system status
    const status = await orchestrator.getStatus();
    logger.info('System Status:', status);
    
    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Shutting down gracefully...');
      orchestrator.stopScheduledTasks();
      process.exit(0);
    });
    
    logger.info('GMTM Operations Automation is running...');
    
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Export for use in other modules
module.exports = {
  AutomationOrchestrator,
  config,
  logger
};

// Run if this file is executed directly
if (require.main === module) {
  main();
}