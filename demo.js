#!/usr/bin/env node

const MCPAutomationOrchestrator = require('./src/orchestrator/mcp-orchestrator');
const logger = require('./src/shared/logging/logger');

/**
 * Demo Script for Sports Club BD Automation
 * 
 * This script demonstrates the automation capabilities without requiring
 * actual API keys or MCP connections. Perfect for showcasing the system.
 */

async function runDemo() {
  console.log('\n🏆 GMTM Sports Club BD Automation Demo');
  console.log('=====================================\n');

  try {
    // Set demo environment
    process.env.NODE_ENV = 'demo';
    process.env.CLAUDE_CODE_RUNTIME = 'false';

    logger.info('🚀 Starting Sports Club BD Automation Demo...');

    // Initialize orchestrator
    const orchestrator = new MCPAutomationOrchestrator();
    await orchestrator.initialize();

    console.log('\n📊 Available Automations:');
    const status = await orchestrator.getStatus();
    status.automations.forEach((automation, index) => {
      console.log(`${index + 1}. ${automation.name}`);
      console.log(`   Description: ${automation.description}`);
      console.log(`   Schedule: ${automation.schedule}`);
      console.log(`   Status: ${automation.enabled ? '✅ Enabled' : '❌ Disabled'}\n`);
    });

    // Run Sports Club Prospector
    console.log('🎯 Running Sports Club Prospector...');
    console.log('─'.repeat(50));
    
    const prospectorResult = await orchestrator.runAutomation('sports-club-prospector');
    
    console.log('\n✅ Sports Club Prospector Results:');
    console.log(`📈 Prospects Researched: ${prospectorResult.prospectsResearched}`);
    console.log(`🎯 Qualified Leads: ${prospectorResult.qualifiedLeads}`);
    console.log(`📧 Emails Sent: ${prospectorResult.emailsSent}`);
    console.log(`💰 Pipeline Value: Estimated $${(prospectorResult.qualifiedLeads * 45000).toLocaleString()}`);
    
    console.log('\n🏆 Top Prospects:');
    prospectorResult.topProspects?.forEach((prospect, index) => {
      console.log(`${index + 1}. ${prospect.name}`);
      console.log(`   📍 Location: ${prospect.location}`);
      console.log(`   🏃 Athletes: ${prospect.athleteReach}`);
      console.log(`   📊 Score: ${prospect.score}/100`);
      console.log('');
    });

    // Run BD Dashboard Reporter
    console.log('📊 Running BD Dashboard Reporter...');
    console.log('─'.repeat(50));
    
    const dashboardResult = await orchestrator.runAutomation('bd-dashboard-reporter');
    
    console.log('\n✅ BD Dashboard Results:');
    console.log(`📈 Prospects Analyzed: ${dashboardResult.prospectsAnalyzed}`);
    console.log(`📧 Campaigns Tracked: ${dashboardResult.campaignsTracked}`);
    console.log(`📊 Response Rate: ${dashboardResult.responseRate}%`);
    console.log(`💰 Pipeline Value: $${dashboardResult.pipelineValue?.toLocaleString()}`);
    
    console.log('\n🔍 Key Insights:');
    dashboardResult.keyInsights?.forEach((insight, index) => {
      console.log(`${index + 1}. ${insight}`);
    });

    // Show system status
    console.log('\n🔧 System Status:');
    console.log('─'.repeat(50));
    
    const status = await orchestrator.getStatus();
    console.log(`🤖 Automations Loaded: ${status.automationsCount}`);
    console.log(`⏰ Scheduled Tasks: ${status.scheduledTasksCount}`);
    console.log(`🔗 MCP Environment: ${status.mcpEnvironment}`);
    console.log(`✅ System Status: ${status.initialized ? 'Ready' : 'Initializing'}`);

    // Show next steps
    console.log('\n🚀 Next Steps:');
    console.log('─'.repeat(50));
    console.log('1. 📝 Review generated reports in logs/');
    console.log('2. 🔧 Configure MCP connectors in Claude Code');
    console.log('3. 🎯 Run with real data: npm run sports-prospector');
    console.log('4. 📊 Monitor performance: npm run bd-dashboard');
    console.log('5. 🔄 Set up scheduling for automated runs');

    console.log('\n✅ Demo completed successfully!');
    console.log('🏆 Sports Club BD Automation is ready for deployment.\n');

  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    logger.error('Demo execution failed:', error);
  }
}

// Run the demo
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { runDemo };