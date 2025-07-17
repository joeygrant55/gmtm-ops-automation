/**
 * Slack Shortcuts Configuration
 * 
 * Provides quick access to common BD tasks through Slack shortcuts
 */

const BDHubSpotIntegration = require('./bd-hubspot-integration');

class SlackShortcuts {
  constructor() {
    this.bdIntegration = new BDHubSpotIntegration();
  }

  /**
   * Handle Slack shortcut callbacks
   */
  async handleShortcut(payload) {
    const { callback_id, trigger_id, user } = payload;
    
    switch (callback_id) {
      case 'quick_add_lead':
        return this.handleQuickAddLead(trigger_id, user);
      case 'view_pending_approvals':
        return this.handleViewPendingApprovals(trigger_id, user);
      case 'search_hubspot':
        return this.handleSearchHubSpot(trigger_id, user);
      default:
        return { response_action: 'clear' };
    }
  }

  /**
   * Quick Add Lead - Opens modal to manually add a lead
   */
  async handleQuickAddLead(triggerId, user) {
    return {
      trigger_id: triggerId,
      view: {
        type: 'modal',
        callback_id: 'add_lead_modal',
        title: {
          type: 'plain_text',
          text: 'Quick Add Lead'
        },
        submit: {
          type: 'plain_text',
          text: 'Add Lead'
        },
        blocks: [
          {
            type: 'input',
            block_id: 'club_name',
            label: {
              type: 'plain_text',
              text: 'Club/Academy Name'
            },
            element: {
              type: 'plain_text_input',
              action_id: 'club_name_input',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., Elite Soccer Academy'
              }
            }
          },
          {
            type: 'input',
            block_id: 'sport',
            label: {
              type: 'plain_text',
              text: 'Sport'
            },
            element: {
              type: 'static_select',
              action_id: 'sport_select',
              placeholder: {
                type: 'plain_text',
                text: 'Select a sport'
              },
              options: [
                { text: { type: 'plain_text', text: 'Soccer' }, value: 'soccer' },
                { text: { type: 'plain_text', text: 'Basketball' }, value: 'basketball' },
                { text: { type: 'plain_text', text: 'Baseball' }, value: 'baseball' },
                { text: { type: 'plain_text', text: 'Football' }, value: 'football' },
                { text: { type: 'plain_text', text: 'Tennis' }, value: 'tennis' },
                { text: { type: 'plain_text', text: 'Golf' }, value: 'golf' },
                { text: { type: 'plain_text', text: 'Swimming' }, value: 'swimming' },
                { text: { type: 'plain_text', text: 'Other' }, value: 'other' }
              ]
            }
          },
          {
            type: 'input',
            block_id: 'location',
            label: {
              type: 'plain_text',
              text: 'Location'
            },
            element: {
              type: 'plain_text_input',
              action_id: 'location_input',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., Los Angeles, CA'
              }
            }
          },
          {
            type: 'input',
            block_id: 'athletes',
            label: {
              type: 'plain_text',
              text: 'Estimated Athletes'
            },
            element: {
              type: 'number_input',
              action_id: 'athletes_input',
              is_decimal_allowed: false,
              min_value: '1',
              max_value: '10000'
            }
          },
          {
            type: 'input',
            block_id: 'contact_email',
            label: {
              type: 'plain_text',
              text: 'Contact Email'
            },
            element: {
              type: 'email_text_input',
              action_id: 'email_input',
              placeholder: {
                type: 'plain_text',
                text: 'contact@example.com'
              }
            }
          },
          {
            type: 'input',
            block_id: 'priority',
            label: {
              type: 'plain_text',
              text: 'Priority Level'
            },
            element: {
              type: 'static_select',
              action_id: 'priority_select',
              initial_option: {
                text: { type: 'plain_text', text: 'Medium' },
                value: 'medium'
              },
              options: [
                { text: { type: 'plain_text', text: 'High' }, value: 'high' },
                { text: { type: 'plain_text', text: 'Medium' }, value: 'medium' },
                { text: { type: 'plain_text', text: 'Low' }, value: 'low' }
              ]
            }
          }
        ]
      }
    };
  }

  /**
   * View Pending Approvals - Shows all pending BD approvals
   */
  async handleViewPendingApprovals(triggerId, user) {
    const pendingApprovals = this.bdIntegration.getPendingApprovals();
    const pendingCount = pendingApprovals.filter(a => a.status === 'pending').length;
    
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Pending BD Approvals*\nYou have ${pendingCount} leads waiting for approval.`
        }
      },
      {
        type: 'divider'
      }
    ];
    
    // Add each pending approval
    pendingApprovals
      .filter(a => a.status === 'pending')
      .slice(0, 5) // Show max 5 in modal
      .forEach(approval => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${approval.leadData.clubName}*\n${approval.leadData.sport} • ${approval.leadData.location}\nScore: ${approval.leadData.score}/100`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Review'
            },
            action_id: `review_approval_${approval.id}`,
            value: approval.id
          }
        });
      });
    
    return {
      trigger_id: triggerId,
      view: {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: 'Pending Approvals'
        },
        close: {
          type: 'plain_text',
          text: 'Close'
        },
        blocks: blocks
      }
    };
  }

  /**
   * Search HubSpot - Quick search for existing contacts/deals
   */
  async handleSearchHubSpot(triggerId, user) {
    return {
      trigger_id: triggerId,
      view: {
        type: 'modal',
        callback_id: 'search_hubspot_modal',
        title: {
          type: 'plain_text',
          text: 'Search HubSpot'
        },
        submit: {
          type: 'plain_text',
          text: 'Search'
        },
        blocks: [
          {
            type: 'input',
            block_id: 'search_query',
            label: {
              type: 'plain_text',
              text: 'Search Query'
            },
            element: {
              type: 'plain_text_input',
              action_id: 'search_input',
              placeholder: {
                type: 'plain_text',
                text: 'Enter club name, email, or keyword'
              }
            }
          },
          {
            type: 'input',
            block_id: 'search_type',
            label: {
              type: 'plain_text',
              text: 'Search Type'
            },
            element: {
              type: 'static_select',
              action_id: 'type_select',
              initial_option: {
                text: { type: 'plain_text', text: 'All' },
                value: 'all'
              },
              options: [
                { text: { type: 'plain_text', text: 'All' }, value: 'all' },
                { text: { type: 'plain_text', text: 'Contacts' }, value: 'contacts' },
                { text: { type: 'plain_text', text: 'Deals' }, value: 'deals' },
                { text: { type: 'plain_text', text: 'Companies' }, value: 'companies' }
              ]
            }
          }
        ]
      }
    };
  }

  /**
   * Handle modal submissions
   */
  async handleModalSubmission(payload) {
    const { callback_id, view, user } = payload;
    
    switch (callback_id) {
      case 'add_lead_modal':
        return this.processQuickAddLead(view, user);
      case 'search_hubspot_modal':
        return this.processHubSpotSearch(view, user);
      default:
        return { response_action: 'clear' };
    }
  }

  /**
   * Process quick add lead submission
   */
  async processQuickAddLead(view, user) {
    const values = view.state.values;
    
    const leadData = {
      clubName: values.club_name.club_name_input.value,
      sport: values.sport.sport_select.selected_option.value,
      location: values.location.location_input.value,
      estimatedAthletes: parseInt(values.athletes.athletes_input.value),
      contactEmail: values.contact_email.email_input.value,
      priority: values.priority.priority_select.selected_option.text.text,
      score: 75, // Default score for manually added leads
      competitionLevel: 'Unknown',
      facilities: 1,
      foundedYear: new Date().getFullYear(),
      ageGroups: ['Unknown'],
      contactInfo: {
        email: values.contact_email.email_input.value,
        phone: 'Not provided'
      },
      website: 'Not provided',
      keyPersonnel: [
        { name: 'Unknown', role: 'Contact' }
      ],
      qualificationDate: new Date().toISOString(),
      addedBy: user.name,
      source: 'slack_quick_add'
    };
    
    // Process through BD integration
    await this.bdIntegration.processQualifiedLeads([leadData]);
    
    return {
      response_action: 'clear',
      view: {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: 'Success!'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ Lead "${leadData.clubName}" has been added and sent for approval!`
            }
          }
        ]
      }
    };
  }
}

module.exports = SlackShortcuts;