const MCPAutomationOrchestrator = require('./src/orchestrator/mcp-orchestrator');
const { config, validateConfig } = require('./src/shared/config');
const logger = require('./src/shared/logging/logger');

/**
 * MCP-Enhanced GMTM Operations Automation
 * 
 * This is the main entry point for the MCP-enhanced version of the automation system.
 * It's designed to work optimally when running within Claude Code with MCP connectors.
 */

async function main() {
  try {
    logger.info('Starting MCP-Enhanced GMTM Operations Automation...');
    
    // Check if we're in Claude Code environment
    const isClaudeCode = process.env.CLAUDE_CODE_RUNTIME === 'true' || process.env.NODE_ENV === 'claude-code';
    
    if (isClaudeCode) {
      logger.info('🔗 Running in Claude Code environment with MCP connectors');
    } else {
      logger.warn('⚠️  Running in standalone mode - MCP features will be simulated');
    }
    
    // Validate configuration (skip validations in MCP mode)
    if (!isClaudeCode) {
      try {
        validateConfig();
      } catch (error) {
        logger.warn('Configuration validation failed in standalone mode:', error.message);
        logger.info('Some features may be limited without full configuration');
      }
    }
    
    // Initialize MCP orchestrator
    const orchestrator = new MCPAutomationOrchestrator();
    await orchestrator.initialize();
    
    // Start scheduled tasks
    orchestrator.startScheduledTasks();
    
    // Example: Run specific MCP automations
    if (process.argv.includes('--run-email-processor')) {
      await orchestrator.runAutomation('mcp-email-processor');
    }
    
    if (process.argv.includes('--run-revenue-tracker')) {
      await orchestrator.runAutomation('mcp-revenue-tracker');
    }
    
    if (process.argv.includes('--run-sports-prospector')) {
      await orchestrator.runAutomation('sports-club-prospector');
    }
    
    if (process.argv.includes('--run-bd-dashboard')) {
      await orchestrator.runAutomation('bd-dashboard-reporter');
    }
    
    if (process.argv.includes('--run-all')) {
      await orchestrator.runAllAutomations();
    }
    
    // Display system status
    const status = await orchestrator.getStatus();
    logger.info('MCP System Status:', status);
    
    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Shutting down MCP automation system gracefully...');
      orchestrator.stopScheduledTasks();
      process.exit(0);
    });
    
    if (isClaudeCode) {
      logger.info('🚀 MCP-Enhanced GMTM Operations Automation is running with full MCP integration!');
    } else {
      logger.info('🚀 MCP-Enhanced GMTM Operations Automation is running in simulation mode');
    }
    
  } catch (error) {
    logger.error('Failed to start MCP automation system:', error);
    process.exit(1);
  }
}

// Export for use in other modules
module.exports = {
  MCPAutomationOrchestrator,
  config,
  logger
};

// Run if this file is executed directly
if (require.main === module) {
  main();
}

// Usage examples for Claude Code environment:
/*

# Run with email processing
node mcp-index.js --run-email-processor

# Run with revenue tracking
node mcp-index.js --run-revenue-tracker

# Run all automations
node mcp-index.js --run-all

# Run in Claude Code environment
CLAUDE_CODE_RUNTIME=true node mcp-index.js

# Run with specific logging level
LOG_LEVEL=debug node mcp-index.js

*/