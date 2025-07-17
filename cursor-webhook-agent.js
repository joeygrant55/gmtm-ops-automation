require('dotenv').config();
/**
 * Cursor Background Agent for Slack Webhook
 * 
 * This agent runs in Cursor and forwards BD automation events to Slack
 */

const http = require('http');
const https = require('https');
const url = require('url');
const { StringDecoder } = require('string_decoder');

// Configuration
const config = {
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || 'YOUR_SLACK_WEBHOOK_URL_HERE',
  port: process.env.WEBHOOK_PORT || 3001,
  channel: process.env.SLACK_CHANNEL || '#bd-automation'
};

// Create webhook server
const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        console.log('Received webhook:', data);
        
        // Forward to Slack
        await sendToSlack(data);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        console.error('Webhook error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/interactivity') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      // Slack sends payload as application/x-www-form-urlencoded
      const payload = JSON.parse(decodeURIComponent(body.replace('payload=', '')));
      console.log('Received Slack interactivity:', payload);

      // Example: Respond with a simple message (ephemeral)
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        response_type: 'ephemeral',
        text: `You clicked: ${payload.actions[0].text.text || payload.actions[0].text}`
      }));
    });
    return;
  } else if (req.method === 'GET' && req.url.startsWith('/view/')) {
    const id = req.url.split('/view/')[1];
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><body><h2>Prospect Details</h2><p>Prospect ID: <b>${id}</b></p><p>(You can customize this page to show more info.)</p></body></html>`);
    return;
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Send to Slack function
async function sendToSlack(data) {
  const { type, automation, status, details } = data;
  
  let message = {
    channel: config.channel,
    username: 'GMTM BD Automation',
    icon_emoji: ':robot_face:'
  };
  
  // Format message based on type
  switch (type) {
    case 'automation_update':
      message.text = `🤖 ${automation} - ${status}`;
      message.attachments = [{
        color: getStatusColor(status),
        fields: Object.entries(details || {}).map(([key, value]) => ({
          title: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
          value: value.toString(),
          short: true
        })),
        footer: 'GMTM BD Automation',
        ts: Math.floor(Date.now() / 1000)
      }];
      break;
      
    case 'prospect_alert':
      message.text = undefined; // Block Kit uses blocks, not text
      message.blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:dart: *New Qualified Lead: ${details.clubName}*`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Sport*\n${details.sport}` },
            { type: 'mrkdwn', text: `*Location*\n${details.location}` },
            { type: 'mrkdwn', text: `*Athletes*\n${details.athletes}` },
            { type: 'mrkdwn', text: `*Score*\n${details.score}/100` }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Approve Outreach' },
              style: 'primary',
              action_id: 'approve_outreach',
              value: details.id
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Details' },
              url: `https://ca3edd68739f.ngrok-free.app/view/${details.id}`
            }
          ]
        }
      ];
      break;
      
    case 'metrics_update':
      message.text = `📊 BD Performance Update`;
      message.attachments = [{
        color: '#2196F3',
        fields: [
          { title: 'Response Rate', value: `${details.responseRate}%`, short: true },
          { title: 'Pipeline Value', value: `$${details.pipelineValue}`, short: true },
          { title: 'Active Prospects', value: details.activeProspects, short: true },
          { title: 'Emails Sent', value: details.emailsSent, short: true }
        ]
      }];
      break;
  }
  
  // Send to Slack webhook
  const slackUrl = url.parse(config.slackWebhookUrl);
  
  const options = {
    hostname: slackUrl.hostname,
    port: slackUrl.port || 443,
    path: slackUrl.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('Sent to Slack successfully');
          resolve(data);
        } else {
          console.error('Slack error:', data);
          reject(new Error(`Slack returned ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(message));
    req.end();
  });
}

function getStatusColor(status) {
  const colors = {
    'started': '#2196F3',
    'completed': '#4CAF50',
    'failed': '#F44336',
    'warning': '#FF9800'
  };
  return colors[status] || '#9E9E9E';
}

// Start server
server.listen(config.port, () => {
  console.log(`🚀 Cursor webhook agent running on port ${config.port}`);
  console.log(`📡 Webhook endpoint: http://localhost:${config.port}/webhook`);
  console.log(`🔗 Slack channel: ${config.channel}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('Shutting down webhook agent...');
  server.close(() => {
    console.log('Webhook agent stopped');
    process.exit(0);
  });
});