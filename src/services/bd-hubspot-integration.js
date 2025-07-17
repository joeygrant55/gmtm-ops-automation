/**
 * Business Development HubSpot Integration Service
 * 
 * Connects BD research agent to HubSpot deal creation with Slack approval workflow
 */

const HubSpotService = require('./hubspot-service');
const https = require('https');
const url = require('url');

class BDHubSpotIntegration {
  constructor() {
    this.hubspotService = new HubSpotService();
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.ngrokUrl = process.env.NGROK_URL;
    
    // Store pending approvals with fallback data
    this.pendingApprovals = new Map();
    this.loadPendingApprovals();
  }

  /**
   * Load pending approvals from file (for persistence across restarts)
   */
  loadPendingApprovals() {
    try {
      const fs = require('fs');
      const path = require('path');
      const approvalsFile = path.join(__dirname, '../../data/pending-approvals.json');
      
      if (fs.existsSync(approvalsFile)) {
        const data = JSON.parse(fs.readFileSync(approvalsFile, 'utf8'));
        this.pendingApprovals = new Map(data);
        console.log(`Loaded ${this.pendingApprovals.size} pending approvals from file`);
      }
    } catch (error) {
      console.log('No existing approvals file found, starting fresh');
    }
  }

  /**
   * Save pending approvals to file
   */
  savePendingApprovals() {
    try {
      const fs = require('fs');
      const path = require('path');
      const dataDir = path.join(__dirname, '../../data');
      const approvalsFile = path.join(dataDir, 'pending-approvals.json');
      
      // Create data directory if it doesn't exist
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Convert Map to array for JSON serialization
      const data = Array.from(this.pendingApprovals.entries());
      fs.writeFileSync(approvalsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving pending approvals:', error);
    }
  }

  /**
   * Process qualified leads from BD research agent
   * Creates HubSpot contacts and sends Slack approval requests
   */
  async processQualifiedLeads(qualifiedLeads) {
    console.log(`Processing ${qualifiedLeads.length} qualified leads for HubSpot integration`);
    
    const results = [];
    
    for (const lead of qualifiedLeads) {
      try {
        // Generate unique approval ID
        const approvalId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store lead data for approval process
        this.pendingApprovals.set(approvalId, {
          leadData: lead,
          createdAt: new Date(),
          status: 'pending'
        });
        
        // Save to file for persistence
        this.savePendingApprovals();
        
        // Send Slack approval request
        await this.sendSlackApprovalRequest(lead, approvalId);
        
        results.push({
          leadId: lead.clubName,
          approvalId: approvalId,
          status: 'approval_sent',
          slackNotified: true
        });
        
      } catch (error) {
        console.error(`Error processing lead ${lead.clubName}:`, error);
        results.push({
          leadId: lead.clubName,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Send Slack approval request for a qualified lead
   */
  async sendSlackApprovalRequest(lead, approvalId) {
    const message = {
      channel: process.env.SLACK_CHANNEL,
      username: 'GMTM BD Research Agent',
      icon_emoji: ':dart:',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:dart: *New Qualified Lead Found: ${lead.clubName}*\n_BD Research Agent has identified a high-value prospect_`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Sport*\n${lead.sport}` },
            { type: 'mrkdwn', text: `*Location*\n${lead.location}` },
            { type: 'mrkdwn', text: `*Athletes*\n${lead.estimatedAthletes}` },
            { type: 'mrkdwn', text: `*Lead Score*\n${lead.score}/100` },
            { type: 'mrkdwn', text: `*Priority*\n${lead.priority}` },
            { type: 'mrkdwn', text: `*Competition Level*\n${lead.competitionLevel}` }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Contact Information*\n📧 ${lead.contactInfo.email}\n📞 ${lead.contactInfo.phone}\n🌐 ${lead.website}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Key Personnel*\n${lead.keyPersonnel.map(person => `• ${person.name} (${person.role})`).join('\n')}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Why This Lead Matters*\n• ${lead.estimatedAthletes} athletes to reach\n• ${lead.facilities} facilities\n• ${new Date().getFullYear() - lead.foundedYear} years in business\n• ${lead.ageGroups.join(', ')} age groups`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '✅ Create HubSpot Deal' },
              style: 'primary',
              action_id: 'create_hubspot_deal',
              value: approvalId
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '❌ Skip This Lead' },
              style: 'danger',
              action_id: 'skip_lead',
              value: approvalId
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '📋 View Details' },
              url: `${this.ngrokUrl}/lead-details/${approvalId}`
            }
          ]
        }
      ]
    };

    await this.sendSlackMessage(message);
  }

  /**
   * Handle Slack approval response
   */
  async handleSlackApproval(approvalId, action, userId, userName) {
    const pendingApproval = this.pendingApprovals.get(approvalId);
    
    if (!pendingApproval) {
      throw new Error('Approval ID not found or expired');
    }

    const leadData = pendingApproval.leadData;
    
    if (action === 'create_hubspot_deal') {
      try {
        // Create HubSpot contact and deal
        const hubspotResult = await this.createHubSpotDeal(leadData);
        
        // Update approval status
        pendingApproval.status = 'approved';
        pendingApproval.approvedBy = userName;
        pendingApproval.approvedAt = new Date();
        pendingApproval.hubspotResult = hubspotResult;
        
        // Send success notification
        await this.sendDealCreatedNotification(leadData, hubspotResult, userName);
        
        // Save updated status
        this.savePendingApprovals();
        
        // Clean up (remove from pending after 24 hours)
        setTimeout(() => {
          this.pendingApprovals.delete(approvalId);
          this.savePendingApprovals();
        }, 24 * 60 * 60 * 1000);
        
        return {
          success: true,
          message: 'HubSpot deal created successfully',
          hubspotResult: hubspotResult
        };
        
      } catch (error) {
        console.error('Error creating HubSpot deal:', error);
        
        // Send error notification
        await this.sendErrorNotification(leadData, error, userName);
        
        return {
          success: false,
          message: 'Failed to create HubSpot deal',
          error: error.message
        };
      }
      
    } else if (action === 'skip_lead') {
      // Mark as skipped
      pendingApproval.status = 'skipped';
      pendingApproval.skippedBy = userName;
      pendingApproval.skippedAt = new Date();
      
      // Send skip notification
      await this.sendLeadSkippedNotification(leadData, userName);
      
      // Save updated status
      this.savePendingApprovals();
      
      // Clean up
      setTimeout(() => {
        this.pendingApprovals.delete(approvalId);
        this.savePendingApprovals();
      }, 24 * 60 * 60 * 1000);
      
      return {
        success: true,
        message: 'Lead skipped',
        action: 'skipped'
      };
    }
  }

  /**
   * Create HubSpot contact and deal from BD research data
   */
  async createHubSpotDeal(leadData) {
    try {
      // Create HubSpot contact
      const contactResult = await this.hubspotService.createLead({
        clubName: leadData.clubName,
        sport: leadData.sport,
        location: leadData.location,
        athletes: leadData.estimatedAthletes,
        score: leadData.score,
        contactEmail: leadData.contactInfo.email,
        contactPhone: leadData.contactInfo.phone,
        contactName: leadData.keyPersonnel[0]?.name || 'Unknown',
        source: 'bd_research_agent',
        estimatedValue: this.calculateDealValue(leadData),
        customFields: {
          competition_level: leadData.competitionLevel,
          facilities_count: leadData.facilities,
          founded_year: leadData.foundedYear,
          age_groups: leadData.ageGroups.join(', '),
          website: leadData.website,
          priority: leadData.priority,
          qualification_date: leadData.qualificationDate
        }
      });
      
      return contactResult;
      
    } catch (error) {
      console.error('Error creating HubSpot deal:', error);
      throw error;
    }
  }

  /**
   * Calculate deal value based on lead data
   */
  calculateDealValue(leadData) {
    let baseValue = 10000; // Base GMTM package value
    
    // Athlete count multiplier
    const athleteMultiplier = Math.min(leadData.estimatedAthletes * 50, 25000);
    
    // Competition level multiplier
    const competitionMultipliers = {
      'National': 1.5,
      'State': 1.3,
      'Regional': 1.1,
      'Local': 1.0
    };
    const competitionMultiplier = competitionMultipliers[leadData.competitionLevel] || 1.0;
    
    // Facility count bonus
    const facilityBonus = leadData.facilities * 2000;
    
    // Years in business stability factor
    const yearsInBusiness = new Date().getFullYear() - leadData.foundedYear;
    const stabilityMultiplier = Math.min(yearsInBusiness * 0.05 + 1, 1.5);
    
    // Calculate final value
    const totalValue = (baseValue + athleteMultiplier + facilityBonus) * competitionMultiplier * stabilityMultiplier;
    
    return Math.round(totalValue);
  }

  /**
   * Send deal created notification
   */
  async sendDealCreatedNotification(leadData, hubspotResult, approvedBy) {
    const message = {
      channel: process.env.SLACK_CHANNEL,
      username: 'GMTM BD Research Agent',
      icon_emoji: ':white_check_mark:',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:white_check_mark: *HubSpot Deal Created Successfully!*\n*${leadData.clubName}* has been added to your sales pipeline`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Contact ID*\n${hubspotResult.contactId}` },
            { type: 'mrkdwn', text: `*Deal ID*\n${hubspotResult.dealId}` },
            { type: 'mrkdwn', text: `*Approved By*\n${approvedBy}` },
            { type: 'mrkdwn', text: `*Estimated Value*\n$${this.calculateDealValue(leadData).toLocaleString()}` }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Next Steps*\n• Follow up with initial outreach\n• Schedule discovery call\n• Send personalized proposal\n• Track engagement in HubSpot`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View in HubSpot' },
              url: hubspotResult.hubspotUrl,
              style: 'primary'
            }
          ]
        }
      ]
    };

    await this.sendSlackMessage(message);
  }

  /**
   * Send error notification
   */
  async sendErrorNotification(leadData, error, userName) {
    const message = {
      channel: process.env.SLACK_CHANNEL,
      username: 'GMTM BD Research Agent',
      icon_emoji: ':x:',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:x: *Error Creating HubSpot Deal*\nFailed to create deal for *${leadData.clubName}*`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Error*\n${error.message}` },
            { type: 'mrkdwn', text: `*Requested By*\n${userName}` },
            { type: 'mrkdwn', text: `*Lead Score*\n${leadData.score}/100` }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Manual Action Required*\nPlease create this deal manually in HubSpot or contact technical support.`
          }
        }
      ]
    };

    await this.sendSlackMessage(message);
  }

  /**
   * Send lead skipped notification
   */
  async sendLeadSkippedNotification(leadData, skippedBy) {
    const message = {
      channel: process.env.SLACK_CHANNEL,
      username: 'GMTM BD Research Agent',
      icon_emoji: ':heavy_minus_sign:',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:heavy_minus_sign: *Lead Skipped*\n*${leadData.clubName}* was skipped by ${skippedBy}`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Reason*\nManually skipped` },
            { type: 'mrkdwn', text: `*Lead Score*\n${leadData.score}/100` },
            { type: 'mrkdwn', text: `*Potential Value*\n$${this.calculateDealValue(leadData).toLocaleString()}` }
          ]
        }
      ]
    };

    await this.sendSlackMessage(message);
  }

  /**
   * Send Slack message
   */
  async sendSlackMessage(message) {
    const slackUrl = url.parse(this.slackWebhookUrl);
    
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
            resolve(data);
          } else {
            reject(new Error(`Slack returned ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', reject);
      req.write(JSON.stringify(message));
      req.end();
    });
  }

  /**
   * Get pending approvals (for dashboard)
   */
  getPendingApprovals() {
    return Array.from(this.pendingApprovals.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  /**
   * Get approval by ID
   */
  getApprovalById(approvalId) {
    return this.pendingApprovals.get(approvalId);
  }
}

module.exports = BDHubSpotIntegration;