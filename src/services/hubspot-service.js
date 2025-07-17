/**
 * HubSpot Lead Management Service
 * 
 * This service handles all HubSpot API interactions for lead management
 * including creating contacts, deals, and tracking interactions
 */

const hubspot = require('@hubspot/api-client');

class HubSpotService {
  constructor() {
    this.client = new hubspot.Client({
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN
    });
    
    // Custom properties for lead scoring and tracking
    this.customProperties = {
      lead_score: 'lead_score',
      lead_source_detail: 'lead_source_detail',
      sport_type: 'sport_type',
      athlete_count: 'athlete_count',
      club_location: 'club_location',
      approval_status: 'approval_status',
      slack_thread_id: 'slack_thread_id',
      view_count: 'view_count',
      last_viewed_by: 'last_viewed_by'
    };
  }

  /**
   * Create a new lead in HubSpot
   */
  async createLead(leadData) {
    try {
      const contactProperties = {
        email: leadData.contactEmail || `contact@${leadData.clubName.toLowerCase().replace(/\s+/g, '')}.com`,
        firstname: leadData.contactName || 'Contact',
        lastname: leadData.clubName ? `(${leadData.clubName})` : '',
        company: leadData.clubName,
        phone: leadData.contactPhone || '',
        city: leadData.location,
        lifecyclestage: 'lead',
        [this.customProperties.lead_score]: leadData.score,
        [this.customProperties.sport_type]: leadData.sport,
        [this.customProperties.athlete_count]: leadData.athletes,
        [this.customProperties.club_location]: leadData.location,
        [this.customProperties.approval_status]: 'pending',
        [this.customProperties.lead_source_detail]: leadData.source || 'sports_prospector',
        [this.customProperties.slack_thread_id]: leadData.slackThreadId || ''
      };

      // Create contact
      const contact = await this.client.crm.contacts.basicApi.create({
        properties: contactProperties
      });

      // Create associated deal
      const dealProperties = {
        dealname: `${leadData.clubName} - ${leadData.sport}`,
        dealstage: 'qualifiedtobuy',
        pipeline: 'default',
        amount: leadData.estimatedValue || this.calculateEstimatedValue(leadData),
        closedate: this.calculateCloseDate(),
        dealtype: 'newbusiness',
        description: `Lead from ${leadData.sport} club with ${leadData.athletes} athletes in ${leadData.location}. Lead score: ${leadData.score}/100`
      };

      const deal = await this.client.crm.deals.basicApi.create({
        properties: dealProperties
      });

      // Associate contact with deal
      await this.client.crm.deals.associationsApi.create(
        deal.id,
        'contacts',
        contact.id
      );

      return {
        contactId: contact.id,
        dealId: deal.id,
        hubspotUrl: `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID}/contact/${contact.id}`
      };

    } catch (error) {
      console.error('Error creating lead in HubSpot:', error);
      throw error;
    }
  }

  /**
   * Update lead approval status
   */
  async updateLeadApproval(contactId, status, approvedBy) {
    try {
      const properties = {
        [this.customProperties.approval_status]: status,
        lifecyclestage: status === 'approved' ? 'marketingqualifiedlead' : 'lead'
      };

      await this.client.crm.contacts.basicApi.update(contactId, {
        properties
      });

      // Add note about approval
      await this.addNote(contactId, `Lead ${status} by ${approvedBy}`);

      return true;
    } catch (error) {
      console.error('Error updating lead approval:', error);
      throw error;
    }
  }

  /**
   * Track lead view
   */
  async trackLeadView(contactId, viewedBy) {
    try {
      // Get current view count
      const contact = await this.client.crm.contacts.basicApi.getById(contactId, [
        this.customProperties.view_count
      ]);

      const currentViewCount = parseInt(contact.properties[this.customProperties.view_count] || '0');

      await this.client.crm.contacts.basicApi.update(contactId, {
        properties: {
          [this.customProperties.view_count]: (currentViewCount + 1).toString(),
          [this.customProperties.last_viewed_by]: viewedBy,
          lastmodifieddate: new Date().toISOString()
        }
      });

      return currentViewCount + 1;
    } catch (error) {
      console.error('Error tracking lead view:', error);
      throw error;
    }
  }

  /**
   * Add note to contact
   */
  async addNote(contactId, noteText) {
    try {
      await this.client.crm.objects.notes.basicApi.create({
        properties: {
          hs_note_body: noteText,
          hs_timestamp: new Date().toISOString()
        },
        associations: [{
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }]
        }]
      });
    } catch (error) {
      console.error('Error adding note:', error);
      throw error;
    }
  }

  /**
   * Get lead metrics
   */
  async getLeadMetrics(timeRange = '30d') {
    try {
      const now = new Date();
      const startDate = new Date(now.getTime() - (parseInt(timeRange) * 24 * 60 * 60 * 1000));

      // Get contacts created in time range
      const contacts = await this.client.crm.contacts.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'createdate',
            operator: 'GTE',
            value: startDate.toISOString()
          }]
        }],
        properties: [
          'createdate',
          'lifecyclestage',
          this.customProperties.lead_score,
          this.customProperties.approval_status
        ]
      });

      // Get deals created in time range
      const deals = await this.client.crm.deals.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'createdate',
            operator: 'GTE',
            value: startDate.toISOString()
          }]
        }],
        properties: ['createdate', 'dealstage', 'amount', 'closedate']
      });

      // Calculate metrics
      const totalLeads = contacts.results.length;
      const approvedLeads = contacts.results.filter(c => 
        c.properties[this.customProperties.approval_status] === 'approved'
      ).length;
      const rejectedLeads = contacts.results.filter(c => 
        c.properties[this.customProperties.approval_status] === 'rejected'
      ).length;

      const closedWonDeals = deals.results.filter(d => d.properties.dealstage === 'closedwon').length;
      const totalPipelineValue = deals.results.reduce((sum, deal) => 
        sum + parseFloat(deal.properties.amount || 0), 0
      );

      const avgLeadScore = totalLeads > 0 ? 
        contacts.results.reduce((sum, contact) => 
          sum + parseFloat(contact.properties[this.customProperties.lead_score] || 0), 0
        ) / totalLeads : 0;

      return {
        totalLeads,
        approvedLeads,
        rejectedLeads,
        pendingLeads: totalLeads - approvedLeads - rejectedLeads,
        closedWonDeals,
        totalPipelineValue,
        avgLeadScore,
        conversionRate: totalLeads > 0 ? (closedWonDeals / totalLeads) * 100 : 0,
        approvalRate: totalLeads > 0 ? (approvedLeads / totalLeads) * 100 : 0
      };

    } catch (error) {
      console.error('Error getting lead metrics:', error);
      throw error;
    }
  }

  /**
   * Get lead details
   */
  async getLeadDetails(contactId) {
    try {
      const contact = await this.client.crm.contacts.basicApi.getById(contactId, [
        'firstname', 'lastname', 'company', 'email', 'phone', 'city',
        'lifecyclestage', 'createdate', 'lastmodifieddate',
        this.customProperties.lead_score,
        this.customProperties.sport_type,
        this.customProperties.athlete_count,
        this.customProperties.club_location,
        this.customProperties.approval_status,
        this.customProperties.view_count,
        this.customProperties.last_viewed_by
      ]);

      // Get associated deals
      const deals = await this.client.crm.contacts.associationsApi.getAll(
        contactId,
        'deals'
      );

      return {
        contact: contact.properties,
        deals: deals.results,
        hubspotUrl: `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID}/contact/${contactId}`
      };

    } catch (error) {
      console.error('Error getting lead details:', error);
      throw error;
    }
  }

  /**
   * Calculate estimated value based on lead data
   */
  calculateEstimatedValue(leadData) {
    const baseValue = 1000;
    const athleteMultiplier = leadData.athletes * 50;
    const scoreMultiplier = leadData.score * 10;
    
    return baseValue + athleteMultiplier + scoreMultiplier;
  }

  /**
   * Calculate estimated close date (30 days from now)
   */
  calculateCloseDate() {
    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + 30);
    return closeDate.toISOString().split('T')[0];
  }

  /**
   * Search leads
   */
  async searchLeads(criteria = {}) {
    try {
      const filters = [];

      if (criteria.sport) {
        filters.push({
          propertyName: this.customProperties.sport_type,
          operator: 'EQ',
          value: criteria.sport
        });
      }

      if (criteria.location) {
        filters.push({
          propertyName: this.customProperties.club_location,
          operator: 'CONTAINS_TOKEN',
          value: criteria.location
        });
      }

      if (criteria.minScore) {
        filters.push({
          propertyName: this.customProperties.lead_score,
          operator: 'GTE',
          value: criteria.minScore.toString()
        });
      }

      if (criteria.approvalStatus) {
        filters.push({
          propertyName: this.customProperties.approval_status,
          operator: 'EQ',
          value: criteria.approvalStatus
        });
      }

      const searchRequest = {
        filterGroups: filters.length > 0 ? [{ filters }] : [],
        properties: [
          'firstname', 'lastname', 'company', 'email', 'createdate',
          this.customProperties.lead_score,
          this.customProperties.sport_type,
          this.customProperties.athlete_count,
          this.customProperties.approval_status
        ],
        limit: criteria.limit || 100
      };

      const results = await this.client.crm.contacts.searchApi.doSearch(searchRequest);
      return results.results;

    } catch (error) {
      console.error('Error searching leads:', error);
      throw error;
    }
  }
}

module.exports = HubSpotService;