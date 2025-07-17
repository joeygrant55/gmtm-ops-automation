require('dotenv').config();
/**
 * Enhanced Cursor Background Agent for Slack Webhook with HubSpot Integration
 * 
 * This agent handles lead management with HubSpot integration, real-time dashboard,
 * and comprehensive approval workflows
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs').promises;
const path = require('path');
const HubSpotService = require('./src/services/hubspot-service');

// Configuration
const config = {
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || 'YOUR_SLACK_WEBHOOK_URL_HERE',
  port: process.env.WEBHOOK_PORT || 3001,
  channel: process.env.SLACK_CHANNEL || '#bd-automation',
  hubspotPortalId: process.env.HUBSPOT_PORTAL_ID,
  ngrokUrl: process.env.NGROK_URL || 'https://ca3edd68739f.ngrok-free.app'
};

// Initialize services
const hubspotService = new HubSpotService();

// In-memory storage for dashboard data (replace with Redis in production)
const dashboardData = {
  leads: new Map(),
  views: new Map(),
  approvals: new Map(),
  metrics: {
    totalLeads: 0,
    approvedLeads: 0,
    rejectedLeads: 0,
    pendingLeads: 0,
    avgResponseTime: 0,
    conversionRate: 0
  }
};

// Create webhook server
const server = http.createServer(async (req, res) => {
  // Enable CORS for dashboard
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/webhook') {
    await handleWebhook(req, res);
  } else if (req.method === 'POST' && req.url === '/interactivity') {
    await handleSlackInteractivity(req, res);
  } else if (req.method === 'GET' && req.url.startsWith('/view/')) {
    await handleLeadView(req, res);
  } else if (req.method === 'GET' && req.url === '/dashboard') {
    await handleDashboard(req, res);
  } else if (req.method === 'GET' && req.url === '/api/dashboard-data') {
    await handleDashboardData(req, res);
  } else if (req.method === 'GET' && req.url === '/api/metrics') {
    await handleMetrics(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Handle webhook requests
async function handleWebhook(req, res) {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      console.log('Received webhook:', data);
      
      // Process lead data
      if (data.type === 'prospect_alert') {
        await processNewLead(data.details);
      }
      
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
}

// Handle Slack interactivity
async function handleSlackInteractivity(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      const payload = JSON.parse(decodeURIComponent(body.replace('payload=', '')));
      console.log('Received Slack interactivity:', payload);

      const action = payload.actions[0];
      const leadId = action.value;
      const userId = payload.user.id;
      const userName = payload.user.name;

      if (action.action_id === 'approve_outreach') {
        await handleApprovalAction(leadId, 'approved', userId, userName);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          response_type: 'ephemeral',
          text: `✅ Lead approved! HubSpot contact created and outreach sequence initiated.`
        }));
      } else if (action.action_id === 'reject_outreach') {
        await handleApprovalAction(leadId, 'rejected', userId, userName);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          response_type: 'ephemeral',
          text: `❌ Lead rejected and marked in HubSpot.`
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          response_type: 'ephemeral',
          text: `You clicked: ${action.text.text || action.text}`
        }));
      }
    } catch (error) {
      console.error('Slack interactivity error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

// Handle lead view
async function handleLeadView(req, res) {
  const leadId = req.url.split('/view/')[1];
  const viewerId = req.headers['x-user-id'] || 'anonymous';
  
  try {
    // Track view in dashboard
    await trackLeadView(leadId, viewerId);
    
    // Get lead details from HubSpot
    const leadData = dashboardData.leads.get(leadId);
    if (!leadData) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Lead Not Found</h2></body></html>');
      return;
    }

    // Get additional details from HubSpot if contact exists
    let hubspotData = null;
    if (leadData.hubspotContactId) {
      try {
        hubspotData = await hubspotService.getLeadDetails(leadData.hubspotContactId);
      } catch (error) {
        console.error('Error fetching HubSpot data:', error);
      }
    }

    const html = generateLeadDetailsHTML(leadData, hubspotData);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } catch (error) {
    console.error('Error handling lead view:', error);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<html><body><h2>Error loading lead details</h2></body></html>');
  }
}

// Handle dashboard
async function handleDashboard(req, res) {
  try {
    const dashboardHTML = await generateDashboardHTML();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(dashboardHTML);
  } catch (error) {
    console.error('Error generating dashboard:', error);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<html><body><h2>Error loading dashboard</h2></body></html>');
  }
}

// Handle dashboard data API
async function handleDashboardData(req, res) {
  try {
    const data = {
      leads: Array.from(dashboardData.leads.values()),
      views: Array.from(dashboardData.views.values()),
      approvals: Array.from(dashboardData.approvals.values()),
      metrics: dashboardData.metrics
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// Handle metrics API
async function handleMetrics(req, res) {
  try {
    const metrics = await hubspotService.getLeadMetrics();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics));
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// Process new lead
async function processNewLead(leadDetails) {
  const leadId = leadDetails.id;
  
  // Store in dashboard data
  dashboardData.leads.set(leadId, {
    ...leadDetails,
    createdAt: new Date(),
    status: 'pending',
    viewCount: 0,
    hubspotContactId: null,
    hubspotDealId: null
  });
  
  // Update metrics
  dashboardData.metrics.totalLeads++;
  dashboardData.metrics.pendingLeads++;
  
  console.log(`New lead processed: ${leadDetails.clubName} (${leadId})`);
}

// Handle approval action
async function handleApprovalAction(leadId, status, userId, userName) {
  try {
    const leadData = dashboardData.leads.get(leadId);
    if (!leadData) {
      throw new Error('Lead not found');
    }

    // Update lead status
    leadData.status = status;
    leadData.approvedBy = userName;
    leadData.approvedAt = new Date();
    
    // Update metrics
    if (status === 'approved') {
      dashboardData.metrics.approvedLeads++;
      dashboardData.metrics.pendingLeads--;
      
      // Create in HubSpot
      const hubspotResult = await hubspotService.createLead(leadData);
      leadData.hubspotContactId = hubspotResult.contactId;
      leadData.hubspotDealId = hubspotResult.dealId;
      leadData.hubspotUrl = hubspotResult.hubspotUrl;
      
      // Start automated outreach sequence
      await startOutreachSequence(leadData);
      
    } else if (status === 'rejected') {
      dashboardData.metrics.rejectedLeads++;
      dashboardData.metrics.pendingLeads--;
    }
    
    // Store approval record
    dashboardData.approvals.set(`${leadId}-${Date.now()}`, {
      leadId,
      status,
      userId,
      userName,
      timestamp: new Date()
    });
    
    console.log(`Lead ${leadId} ${status} by ${userName}`);
    
  } catch (error) {
    console.error('Error handling approval action:', error);
    throw error;
  }
}

// Track lead view
async function trackLeadView(leadId, viewerId) {
  const leadData = dashboardData.leads.get(leadId);
  if (leadData) {
    leadData.viewCount = (leadData.viewCount || 0) + 1;
    leadData.lastViewedAt = new Date();
    leadData.lastViewedBy = viewerId;
    
    // Track in HubSpot if contact exists
    if (leadData.hubspotContactId) {
      try {
        await hubspotService.trackLeadView(leadData.hubspotContactId, viewerId);
      } catch (error) {
        console.error('Error tracking view in HubSpot:', error);
      }
    }
  }
  
  // Store view record
  dashboardData.views.set(`${leadId}-${Date.now()}`, {
    leadId,
    viewerId,
    timestamp: new Date()
  });
}

// Start automated outreach sequence
async function startOutreachSequence(leadData) {
  try {
    // Add note to HubSpot contact
    await hubspotService.addNote(
      leadData.hubspotContactId,
      `🚀 Automated outreach sequence started for ${leadData.clubName}. Lead score: ${leadData.score}/100`
    );
    
    // Send follow-up notification to Slack
    await sendToSlack({
      type: 'outreach_started',
      details: {
        clubName: leadData.clubName,
        sport: leadData.sport,
        hubspotUrl: leadData.hubspotUrl,
        approvedBy: leadData.approvedBy
      }
    });
    
    console.log(`Outreach sequence started for ${leadData.clubName}`);
    
  } catch (error) {
    console.error('Error starting outreach sequence:', error);
  }
}

// Send to Slack function (enhanced)
async function sendToSlack(data) {
  const { type, automation, status, details } = data;
  
  let message = {
    channel: config.channel,
    username: 'GMTM BD Automation',
    icon_emoji: ':robot_face:'
  };
  
  switch (type) {
    case 'prospect_alert':
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
              text: { type: 'plain_text', text: 'Reject' },
              style: 'danger',
              action_id: 'reject_outreach',
              value: details.id
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Details' },
              url: `${config.ngrokUrl}/view/${details.id}`
            }
          ]
        }
      ];
      break;
      
    case 'outreach_started':
      message.blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:rocket: *Outreach Started: ${details.clubName}*`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Sport*\n${details.sport}` },
            { type: 'mrkdwn', text: `*Approved By*\n${details.approvedBy}` }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View in HubSpot' },
              url: details.hubspotUrl
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
          { title: 'Total Leads', value: details.totalLeads, short: true },
          { title: 'Approved', value: details.approvedLeads, short: true },
          { title: 'Conversion Rate', value: `${details.conversionRate}%`, short: true },
          { title: 'Pipeline Value', value: `$${details.pipelineValue}`, short: true }
        ]
      }];
      break;
      
    default:
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

// Generate lead details HTML
function generateLeadDetailsHTML(leadData, hubspotData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Lead Details - ${leadData.clubName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { border-bottom: 2px solid #007cba; padding-bottom: 10px; margin-bottom: 20px; }
        .status { display: inline-block; padding: 5px 10px; border-radius: 15px; color: white; font-size: 12px; }
        .status.pending { background: #ffa500; }
        .status.approved { background: #4caf50; }
        .status.rejected { background: #f44336; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .field { margin-bottom: 10px; }
        .field label { font-weight: bold; color: #333; }
        .field value { color: #666; }
        .hubspot-link { background: #ff7a59; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${leadData.clubName}</h1>
          <span class="status ${leadData.status}">${leadData.status.toUpperCase()}</span>
        </div>
        
        <div class="grid">
          <div>
            <div class="field">
              <label>Sport:</label>
              <div>${leadData.sport}</div>
            </div>
            <div class="field">
              <label>Location:</label>
              <div>${leadData.location}</div>
            </div>
            <div class="field">
              <label>Athletes:</label>
              <div>${leadData.athletes}</div>
            </div>
            <div class="field">
              <label>Lead Score:</label>
              <div>${leadData.score}/100</div>
            </div>
          </div>
          
          <div>
            <div class="field">
              <label>Created:</label>
              <div>${new Date(leadData.createdAt).toLocaleString()}</div>
            </div>
            <div class="field">
              <label>View Count:</label>
              <div>${leadData.viewCount}</div>
            </div>
            ${leadData.approvedBy ? `
            <div class="field">
              <label>Approved By:</label>
              <div>${leadData.approvedBy}</div>
            </div>
            ` : ''}
            ${leadData.hubspotUrl ? `
            <div class="field">
              <a href="${leadData.hubspotUrl}" class="hubspot-link" target="_blank">View in HubSpot</a>
            </div>
            ` : ''}
          </div>
        </div>
        
        ${hubspotData ? `
        <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 5px;">
          <h3>HubSpot Data</h3>
          <p><strong>Contact:</strong> ${hubspotData.contact.firstname} ${hubspotData.contact.lastname}</p>
          <p><strong>Email:</strong> ${hubspotData.contact.email}</p>
          <p><strong>Phone:</strong> ${hubspotData.contact.phone || 'N/A'}</p>
          <p><strong>Lifecycle Stage:</strong> ${hubspotData.contact.lifecyclestage}</p>
        </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
}

// Generate dashboard HTML
async function generateDashboardHTML() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Lead Management Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: #007cba; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric { background: white; padding: 20px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #007cba; }
        .metric .value { font-size: 2em; font-weight: bold; color: #333; }
        .leads-table { background: white; border-radius: 8px; overflow: hidden; }
        .leads-table table { width: 100%; border-collapse: collapse; }
        .leads-table th, .leads-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        .leads-table th { background: #f8f9fa; font-weight: bold; }
        .status { padding: 4px 8px; border-radius: 12px; font-size: 12px; color: white; }
        .status.pending { background: #ffa500; }
        .status.approved { background: #4caf50; }
        .status.rejected { background: #f44336; }
      </style>
      <script>
        async function refreshData() {
          try {
            const response = await fetch('/api/dashboard-data');
            const data = await response.json();
            
            // Update metrics
            document.getElementById('total-leads').textContent = data.leads.length;
            document.getElementById('approved-leads').textContent = data.metrics.approvedLeads;
            document.getElementById('pending-leads').textContent = data.metrics.pendingLeads;
            document.getElementById('rejected-leads').textContent = data.metrics.rejectedLeads;
            
            // Update leads table
            const tbody = document.getElementById('leads-tbody');
            tbody.innerHTML = '';
            
            data.leads.forEach(lead => {
              const row = tbody.insertRow();
              row.innerHTML = \`
                <td><a href="/view/\${lead.id}">\${lead.clubName}</a></td>
                <td>\${lead.sport}</td>
                <td>\${lead.location}</td>
                <td>\${lead.score}/100</td>
                <td><span class="status \${lead.status}">\${lead.status}</span></td>
                <td>\${lead.viewCount || 0}</td>
                <td>\${new Date(lead.createdAt).toLocaleString()}</td>
              \`;
            });
            
          } catch (error) {
            console.error('Error refreshing data:', error);
          }
        }
        
        // Refresh every 30 seconds
        setInterval(refreshData, 30000);
        
        // Initial load
        document.addEventListener('DOMContentLoaded', refreshData);
      </script>
    </head>
    <body>
      <div class="header">
        <h1>🎯 Lead Management Dashboard</h1>
        <p>Real-time lead tracking and approval workflow</p>
      </div>
      
      <div class="metrics">
        <div class="metric">
          <h3>Total Leads</h3>
          <div class="value" id="total-leads">0</div>
        </div>
        <div class="metric">
          <h3>Approved</h3>
          <div class="value" id="approved-leads">0</div>
        </div>
        <div class="metric">
          <h3>Pending</h3>
          <div class="value" id="pending-leads">0</div>
        </div>
        <div class="metric">
          <h3>Rejected</h3>
          <div class="value" id="rejected-leads">0</div>
        </div>
      </div>
      
      <div class="leads-table">
        <table>
          <thead>
            <tr>
              <th>Club Name</th>
              <th>Sport</th>
              <th>Location</th>
              <th>Score</th>
              <th>Status</th>
              <th>Views</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody id="leads-tbody">
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;
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
  console.log(`🚀 Enhanced webhook agent running on port ${config.port}`);
  console.log(`📡 Webhook endpoint: http://localhost:${config.port}/webhook`);
  console.log(`📊 Dashboard: http://localhost:${config.port}/dashboard`);
  console.log(`🔗 Slack channel: ${config.channel}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('Shutting down enhanced webhook agent...');
  server.close(() => {
    console.log('Enhanced webhook agent stopped');
    process.exit(0);
  });
});

module.exports = server;