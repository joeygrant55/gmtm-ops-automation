#!/usr/bin/env node

const CursorSlackNotifier = require('./src/shared/integrations/cursor-slack-notifier');

async function testCursorSlack() {
  console.log('🧪 Testing Cursor-Slack Integration...\n');
  
  const notifier = new CursorSlackNotifier();
  
  // Test 1: Automation Update
  console.log('📤 Test 1: Sending automation update...');
  await notifier.sendNotification({
    type: 'automation_update',
    data: {
      automation: 'Sports Club Prospector',
      status: 'completed',
      details: {
        summary: 'Processed 25 sports clubs successfully',
        prospectsProcessed: 25,
        emailsSent: 12,
        pipelineValue: 540000
      }
    }
  });
  
  // Test 2: Prospect Alert
  console.log('\n📤 Test 2: Sending prospect alert...');
  await notifier.sendNotification({
    type: 'prospect_alert',
    data: {
      prospect: {
        clubName: 'California Elite Basketball Academy',
        location: 'Los Angeles, CA',
        estimatedAthletes: 450,
        score: 92,
        priority: 'High'
      }
    }
  });
  
  // Test 3: Metrics Update
  console.log('\n📤 Test 3: Sending metrics update...');
  await notifier.sendNotification({
    type: 'metrics_update',
    data: {
      metrics: {
        responseRate: 12.5,
        pipelineValue: 2100000,
        totalProspects: 47,
        emailsSent: 156
      }
    }
  });
  
  // Test 4: High Priority Alert
  console.log('\n📤 Test 4: Sending high priority alert...');
  await notifier.sendAlert(
    'Low Response Rate Detected',
    'Response rate has dropped to 3.2% - immediate action required',
    'high'
  );
  
  // Test 5: Request Analysis
  console.log('\n📤 Test 5: Requesting BD analysis from Cursor...');
  await notifier.requestAnalysis({
    responseRate: 8.5,
    pipelineValue: 1500000,
    qualifiedLeads: 32,
    conversionRate: 12.3,
    campaigns: [
      { name: 'Basketball Academies Q3', responseRate: 15.2 },
      { name: 'Soccer Clubs West', responseRate: 6.8 },
      { name: 'Football Training Centers', responseRate: 4.5 }
    ]
  });
  
  console.log('\n✅ All tests sent! Check your Slack #bd-automation channel');
  console.log('💡 Cursor should pick up the @Cursor mentions and post to Slack');
}

// Run the test
testCursorSlack().catch(console.error);