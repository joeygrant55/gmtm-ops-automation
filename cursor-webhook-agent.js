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
const BDHubSpotIntegration = require('./src/services/bd-hubspot-integration');

// Configuration
const config = {
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || 'YOUR_SLACK_WEBHOOK_URL_HERE',
  port: process.env.WEBHOOK_PORT || 3001,
  channel: process.env.SLACK_CHANNEL || '#bd-automation',
  hubspotPortalId: process.env.HUBSPOT_PORTAL_ID
};

// Initialize BD HubSpot integration
const bdHubSpotIntegration = new BDHubSpotIntegration();

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
        console.log('Received webhook:', JSON.stringify(data, null, 2));
        
        // Process HubSpot webhook events
        await processHubSpotWebhook(data);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        console.error('Webhook error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/interactivity') {
    console.log('=== SLACK INTERACTIVITY REQUEST RECEIVED ===');
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        console.log('Raw body:', body.substring(0, 200)); // Log first 200 chars
        // Slack sends payload as application/x-www-form-urlencoded
        const payload = JSON.parse(decodeURIComponent(body.replace('payload=', '')));
        console.log('Parsed payload type:', payload.type);
        console.log('Action ID:', payload.actions?.[0]?.action_id);

        const action = payload.actions[0];
        const actionValue = action.value;
        const userId = payload.user.id;
        const userName = payload.user.name;

        // Handle BD research agent approval actions
        if (action.action_id === 'create_hubspot_deal') {
          // Respond immediately to Slack to avoid timeout
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            response_type: 'ephemeral',
            text: `⏳ Processing HubSpot deal creation...`
          }));
          
          // Process asynchronously
          bdHubSpotIntegration.handleSlackApproval(actionValue, 'create_hubspot_deal', userId, userName)
            .then(result => {
              console.log('HubSpot deal creation result:', result);
            })
            .catch(error => {
              console.error('Error creating HubSpot deal:', error);
            });
          
          return;
        } else if (action.action_id === 'skip_lead') {
          try {
            const result = await bdHubSpotIntegration.handleSlackApproval(actionValue, 'skip_lead', userId, userName);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              response_type: 'ephemeral',
              text: `⏭️ Lead skipped successfully.`
            }));
          } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              response_type: 'ephemeral',
              text: `❌ Error skipping lead: ${error.message}`
            }));
          }
        } else {
          // Default response for unhandled actions
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            response_type: 'ephemeral',
            text: `You clicked: ${action.text.text || action.text}`
          }));
        }
      } catch (error) {
        console.error('Slack interactivity error:', error);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          response_type: 'ephemeral',
          text: `❌ Error processing action: ${error.message}`
        }));
      }
    });
    return;
  } else if (req.method === 'GET' && req.url.startsWith('/view/')) {
    await handleLeadDetailsView(req, res);
    return;
  } else if (req.method === 'GET' && req.url.startsWith('/lead-details/')) {
    await handleBDLeadDetailsView(req, res);
    return;
  } else if (req.method === 'POST' && req.url === '/trigger-bd-research') {
    // Endpoint to trigger BD research agent
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        // Simulate BD research agent finding qualified leads
        const sampleQualifiedLeads = [
          {
            clubName: 'Elite Soccer Academy California',
            sport: 'soccer',
            location: 'Los Angeles, CA',
            estimatedAthletes: 450,
            score: 85,
            priority: 'High',
            competitionLevel: 'National',
            facilities: 3,
            foundedYear: 2010,
            ageGroups: ['Youth', 'High School', 'College Prep'],
            contactInfo: {
              email: 'director@elitesoccerca.com',
              phone: '(555) 123-4567'
            },
            website: 'https://elitesoccerca.com',
            keyPersonnel: [
              { name: 'Sarah Johnson', role: 'Director' },
              { name: 'Mike Rodriguez', role: 'Head Coach' }
            ],
            qualificationDate: new Date().toISOString()
          }
        ];
        
        // Process leads through BD HubSpot integration
        const results = await bdHubSpotIntegration.processQualifiedLeads(sampleQualifiedLeads);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'BD research completed and Slack notifications sent',
          results: results
        }));
      } catch (error) {
        console.error('BD research trigger error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Process HubSpot webhook events
async function processHubSpotWebhook(data) {
  try {
    // HubSpot sends arrays of events
    const events = Array.isArray(data) ? data : [data];
    
    for (const event of events) {
      const { subscriptionType, objectId, objectTypeId, changeFlag, changeSource } = event;
      
      console.log(`Processing HubSpot event: ${subscriptionType} for object ${objectId} (type: ${objectTypeId})`);
      
      // Map HubSpot object type IDs to readable names
      const objectTypeMap = {
        '0-1': 'contact',
        '0-2': 'company', 
        '0-3': 'deal',
        '0-49': 'email',
        '0-5': 'task'
      };
      
      const objectType = objectTypeMap[objectTypeId] || objectTypeId;
      
      // Handle different subscription types
      switch (subscriptionType) {
        case 'object.creation':
          if (objectType === 'contact') {
            await handleNewContact(event);
          } else if (objectType === 'deal') {
            await handleNewDeal(event);
          } else if (objectType === 'company') {
            await handleNewCompany(event);
          }
          break;
        case 'object.propertyChange':
          if (objectType === 'contact') {
            await handleContactPropertyChange(event);
          } else if (objectType === 'deal') {
            await handleDealPropertyChange(event);
          }
          break;
        case 'object.associationChange':
          console.log(`Association change: ${event.associationType}`);
          break;
        default:
          console.log(`Unhandled subscription type: ${subscriptionType}`);
      }
    }
  } catch (error) {
    console.error('Error processing HubSpot webhook:', error);
  }
}

// Handle new contact creation
async function handleNewContact(event) {
  const { objectId, properties } = event;
  
  const contactData = {
    id: objectId,
    name: `${properties.firstname || ''} ${properties.lastname || ''}`.trim(),
    email: properties.email,
    company: properties.company,
    phone: properties.phone,
    lifecycleStage: properties.lifecyclestage,
    createdAt: properties.createdate
  };
  
  await sendToSlack({
    type: 'new_contact',
    contact: contactData
  });
}

// Handle contact property changes
async function handleContactPropertyChange(event) {
  const { objectId, properties, changeSource } = event;
  
  // Only notify on important property changes
  const importantProperties = ['lifecyclestage', 'hs_lead_status', 'dealstage'];
  const changedProperties = Object.keys(properties || {});
  
  if (changedProperties.some(prop => importantProperties.includes(prop))) {
    await sendToSlack({
      type: 'contact_updated',
      contactId: objectId,
      changes: properties,
      source: changeSource
    });
  }
}

// Handle new deal creation
async function handleNewDeal(event) {
  const { objectId, properties } = event;
  
  const dealData = {
    id: objectId,
    name: properties.dealname,
    stage: properties.dealstage,
    amount: properties.amount,
    closeDate: properties.closedate,
    createdAt: properties.createdate
  };
  
  await sendToSlack({
    type: 'new_deal',
    deal: dealData
  });
}

// Handle deal property changes
async function handleDealPropertyChange(event) {
  const { objectId, properties } = event;
  
  // Notify on stage changes
  if (properties.dealstage) {
    await sendToSlack({
      type: 'deal_stage_change',
      dealId: objectId,
      newStage: properties.dealstage,
      amount: properties.amount
    });
  }
}

// Handle new company creation
async function handleNewCompany(event) {
  const { objectId, properties } = event;
  
  const companyData = {
    id: objectId,
    name: properties.name,
    domain: properties.domain,
    industry: properties.industry,
    city: properties.city,
    state: properties.state
  };
  
  await sendToSlack({
    type: 'new_company',
    company: companyData
  });
}

// Send to Slack function (enhanced for HubSpot events)
async function sendToSlack(data) {
  const { type, automation, status, details } = data;
  
  let message = {
    channel: config.channel,
    username: 'GMTM BD Automation',
    icon_emoji: ':robot_face:'
  };
  
  // Format message based on type
  switch (type) {
    case 'new_contact':
      message.blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `👤 *New Contact Created: ${data.contact.name || 'Unknown'}*`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Email*\n${data.contact.email || 'N/A'}` },
            { type: 'mrkdwn', text: `*Company*\n${data.contact.company || 'N/A'}` },
            { type: 'mrkdwn', text: `*Phone*\n${data.contact.phone || 'N/A'}` },
            { type: 'mrkdwn', text: `*Stage*\n${data.contact.lifecycleStage || 'N/A'}` }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View in HubSpot' },
              url: `https://app.hubspot.com/contacts/${config.hubspotPortalId}/contact/${data.contact.id}`
            }
          ]
        }
      ];
      break;

    case 'new_deal':
      message.blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `💰 *New Deal Created: ${data.deal.name || 'Untitled Deal'}*`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Stage*\n${data.deal.stage || 'N/A'}` },
            { type: 'mrkdwn', text: `*Amount*\n$${data.deal.amount || '0'}` },
            { type: 'mrkdwn', text: `*Close Date*\n${data.deal.closeDate || 'N/A'}` }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Deal' },
              url: `https://app.hubspot.com/contacts/${config.hubspotPortalId}/deal/${data.deal.id}`
            }
          ]
        }
      ];
      break;

    case 'deal_stage_change':
      message.blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎯 *Deal Stage Changed*\nDeal moved to: *${data.newStage}*`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Deal ID*\n${data.dealId}` },
            { type: 'mrkdwn', text: `*Amount*\n$${data.amount || '0'}` }
          ]
        }
      ];
      break;

    case 'new_company':
      message.blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🏢 *New Company Added: ${data.company.name || 'Unknown Company'}*`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Domain*\n${data.company.domain || 'N/A'}` },
            { type: 'mrkdwn', text: `*Industry*\n${data.company.industry || 'N/A'}` },
            { type: 'mrkdwn', text: `*Location*\n${data.company.city || 'N/A'}${data.company.state ? `, ${data.company.state}` : ''}` }
          ]
        }
      ];
      break;

    case 'contact_updated':
      message.blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🔄 *Contact Updated*\nContact ID: ${data.contactId}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Changes:*\n${Object.entries(data.changes || {}).map(([key, value]) => `• ${key}: ${value}`).join('\n')}`
          }
        }
      ];
      break;

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

// Handle lead details view
async function handleLeadDetailsView(req, res) {
  const id = req.url.split('/view/')[1];
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<html><body><h2>Prospect Details</h2><p>Prospect ID: <b>${id}</b></p><p>(You can customize this page to show more info.)</p></body></html>`);
}

// Handle BD lead details view
async function handleBDLeadDetailsView(req, res) {
  const approvalId = req.url.split('/lead-details/')[1];
  const approval = bdHubSpotIntegration.getApprovalById(approvalId);
  
  if (!approval) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head><title>Lead Not Found</title></head>
        <body style="font-family: Arial, sans-serif; margin: 40px;">
          <h1>Lead Not Found</h1>
          <p>This lead approval may have expired or been processed already.</p>
        </body>
      </html>
    `);
    return;
  }

  const lead = approval.leadData;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${lead.clubName} - Lead Details</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #007cba; padding-bottom: 20px; margin-bottom: 30px; }
        h1 { color: #333; margin: 0 0 10px 0; }
        .score { background: #007cba; color: white; padding: 10px 20px; border-radius: 20px; display: inline-block; font-weight: bold; }
        .priority { padding: 5px 15px; border-radius: 15px; color: white; display: inline-block; margin-left: 10px; font-size: 14px; }
        .priority.high { background: #ff4444; }
        .priority.medium { background: #ffa500; }
        .priority.low { background: #4caf50; }
        .section { margin: 30px 0; }
        .section h2 { color: #007cba; margin-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-item { padding: 15px; background: #f8f9fa; border-radius: 5px; }
        .info-item label { font-weight: bold; color: #666; display: block; margin-bottom: 5px; }
        .info-item value { color: #333; font-size: 16px; }
        .status { margin: 20px 0; padding: 20px; background: #e8f5e8; border-radius: 5px; }
        .status.pending { background: #fff8e1; }
        .status.approved { background: #e8f5e8; }
        .status.skipped { background: #ffebee; }
        .actions { margin-top: 30px; text-align: center; }
        .button { padding: 12px 24px; margin: 0 10px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; text-decoration: none; display: inline-block; }
        .button.primary { background: #007cba; color: white; }
        .button.secondary { background: #6c757d; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${lead.clubName}</h1>
          <span class="score">Score: ${lead.score}/100</span>
          <span class="priority ${lead.priority.toLowerCase()}">${lead.priority} Priority</span>
        </div>
        
        <div class="status ${approval.status}">
          <strong>Status:</strong> ${approval.status.toUpperCase()}
          ${approval.approvedBy ? `<br><strong>Approved by:</strong> ${approval.approvedBy}` : ''}
          ${approval.skippedBy ? `<br><strong>Skipped by:</strong> ${approval.skippedBy}` : ''}
        </div>
        
        <div class="section">
          <h2>Basic Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <label>Sport</label>
              <value>${lead.sport}</value>
            </div>
            <div class="info-item">
              <label>Location</label>
              <value>${lead.location}</value>
            </div>
            <div class="info-item">
              <label>Athletes</label>
              <value>${lead.estimatedAthletes}</value>
            </div>
            <div class="info-item">
              <label>Competition Level</label>
              <value>${lead.competitionLevel}</value>
            </div>
            <div class="info-item">
              <label>Facilities</label>
              <value>${lead.facilities}</value>
            </div>
            <div class="info-item">
              <label>Founded</label>
              <value>${lead.foundedYear}</value>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>Contact Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <label>Email</label>
              <value><a href="mailto:${lead.contactInfo.email}">${lead.contactInfo.email}</a></value>
            </div>
            <div class="info-item">
              <label>Phone</label>
              <value><a href="tel:${lead.contactInfo.phone}">${lead.contactInfo.phone}</a></value>
            </div>
            <div class="info-item">
              <label>Website</label>
              <value><a href="${lead.website}" target="_blank">${lead.website}</a></value>
            </div>
            <div class="info-item">
              <label>Age Groups</label>
              <value>${lead.ageGroups.join(', ')}</value>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>Key Personnel</h2>
          ${lead.keyPersonnel.map(person => `
            <div class="info-item" style="margin-bottom: 10px;">
              <label>${person.role}</label>
              <value>${person.name}${person.email ? ` - <a href="mailto:${person.email}">${person.email}</a>` : ''}</value>
            </div>
          `).join('')}
        </div>
        
        ${approval.hubspotResult ? `
        <div class="section">
          <h2>HubSpot Integration</h2>
          <div class="info-grid">
            <div class="info-item">
              <label>Contact ID</label>
              <value>${approval.hubspotResult.contactId}</value>
            </div>
            <div class="info-item">
              <label>Deal ID</label>
              <value>${approval.hubspotResult.dealId}</value>
            </div>
          </div>
          <div class="actions">
            <a href="${approval.hubspotResult.hubspotUrl}" class="button primary" target="_blank">View in HubSpot</a>
          </div>
        </div>
        ` : ''}
        
        <div class="actions">
          <a href="${config.slackWebhookUrl.replace('/services/', '/app/')}" class="button secondary">Back to Slack</a>
        </div>
      </div>
    </body>
    </html>
  `;
  
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

// Start server
server.listen(config.port, () => {
  console.log(`🚀 Cursor webhook agent running on port ${config.port}`);
  console.log(`📡 Webhook endpoint: http://localhost:${config.port}/webhook`);
  console.log(`🔗 Slack channel: ${config.channel}`);
  console.log(`🔌 Interactivity: http://localhost:${config.port}/interactivity`);
  console.log(`🧪 Test BD workflow: curl -X POST http://localhost:${config.port}/trigger-bd-research`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('Shutting down webhook agent...');
  server.close(() => {
    console.log('Webhook agent stopped');
    process.exit(0);
  });
});