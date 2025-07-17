const logger = require('../shared/logging/logger');
const { config } = require('../shared/config');
const { formatDate, chunkArray } = require('../shared/utils');

/**
 * Business Development Dashboard Reporter
 * 
 * Creates comprehensive reporting and analytics for BD activities:
 * - Tracks outreach campaign performance
 * - Monitors pipeline progression
 * - Generates executive dashboards
 * - Creates visual reports with Canva
 * - Provides actionable insights
 */
class BDDashboardReporterAutomation {
  constructor(mcpAdapters) {
    this.name = 'BD Dashboard Reporter';
    this.description = 'Creates comprehensive BD analytics and reporting dashboards';
    this.schedule = '0 18 * * *'; // Daily at 6 PM
    this.enabled = true;
    
    // MCP feature flags
    this.usesNotion = true;
    this.usesGoogleDrive = true;
    this.usesCanva = true;
    this.usesGmail = true;
    this.usesCalendar = true;
    this.usesGitHub = true;
    
    // Store MCP adapters
    this.notion = mcpAdapters.notion;
    this.googleDrive = mcpAdapters.googleDrive;
    this.canva = mcpAdapters.canva;
    this.gmail = mcpAdapters.gmail;
    this.calendar = mcpAdapters.googleCalendar;
    this.github = mcpAdapters.github;
  }

  async execute(options = {}) {
    logger.info(`Executing ${this.name}...`);
    
    try {
      // Step 1: Collect BD data from various sources
      const bdData = await this.collectBDData();
      
      // Step 2: Analyze performance metrics
      const analytics = await this.analyzeBDPerformance(bdData);
      
      // Step 3: Create visual dashboard with Canva
      const visualDashboard = await this.createVisualDashboard(analytics);
      
      // Step 4: Generate executive summary report
      const executiveReport = await this.generateExecutiveReport(analytics);
      
      // Step 5: Update Notion dashboard
      await this.updateNotionDashboard(analytics);
      
      // Step 6: Send performance alerts if needed
      await this.sendPerformanceAlerts(analytics);
      
      // Step 7: Schedule follow-up actions
      await this.scheduleFollowUpActions(analytics);
      
      const result = {
        success: true,
        prospectsAnalyzed: bdData.prospects.length,
        campaignsTracked: bdData.campaigns.length,
        responseRate: analytics.responseRate,
        pipelineValue: analytics.pipelineValue,
        keyInsights: analytics.keyInsights,
        summary: `Analyzed ${bdData.prospects.length} prospects across ${bdData.campaigns.length} campaigns. Response rate: ${analytics.responseRate}%`
      };
      
      logger.info(`${this.name} completed successfully`);
      return result;
      
    } catch (error) {
      logger.error(`${this.name} failed:`, error);
      await this.createFailureIssue(error);
      throw error;
    }
  }

  async collectBDData() {
    logger.info('Collecting BD data from multiple sources...');
    
    const bdData = {
      prospects: [],
      campaigns: [],
      emails: [],
      meetings: [],
      responses: []
    };
    
    try {
      // Collect prospects from Notion CRM
      if (config.notion.databaseIds.contacts) {
        const prospects = await this.notion.queryDatabase(
          config.notion.databaseIds.contacts,
          {
            property: 'Lead Source',
            select: {
              equals: 'Sports Club Prospector'
            }
          }
        );
        
        bdData.prospects = prospects.map(p => ({
          id: p.id,
          name: p.properties.Name.title[0]?.text.content || 'Unknown',
          sport: p.properties.Sport?.select?.name || 'Unknown',
          location: p.properties.Location?.rich_text[0]?.text.content || 'Unknown',
          estimatedAthletes: p.properties['Estimated Athletes']?.number || 0,
          leadScore: p.properties['Lead Score']?.number || 0,
          priority: p.properties.Priority?.select?.name || 'Low',
          outreachStatus: p.properties['Outreach Status']?.select?.name || 'Not Contacted',
          lastContact: p.properties['Last Contact']?.date?.start || null,
          nextFollowUp: p.properties['Next Follow-up']?.date?.start || null,
          contactEmail: p.properties['Contact Email']?.email || null,
          website: p.properties.Website?.url || null,
          createdAt: p.created_time,
          updatedAt: p.last_edited_time
        }));
      }
      
      // Collect email campaign data
      bdData.campaigns = await this.collectEmailCampaignData();
      
      // Collect meeting data from calendar
      bdData.meetings = await this.collectMeetingData();
      
      // Collect email responses
      bdData.responses = await this.collectEmailResponses();
      
      logger.info(`Collected BD data: ${bdData.prospects.length} prospects, ${bdData.campaigns.length} campaigns`);
      return bdData;
      
    } catch (error) {
      logger.error(`Failed to collect BD data: ${error.message}`);
      throw error;
    }
  }

  async collectEmailCampaignData() {
    // Simulate email campaign data collection
    // In a real implementation, this would query email service APIs
    return [
      {
        id: 'sports-club-outreach-week-1',
        name: 'Sports Club Initial Outreach',
        sentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        recipientCount: 25,
        openRate: 68.0,
        clickRate: 12.5,
        responseRate: 8.0,
        bounceRate: 4.0,
        subject: 'Boost Your Athletes\' Performance with GMTM',
        sport: 'Multiple',
        priority: 'High'
      },
      {
        id: 'basketball-academy-followup',
        name: 'Basketball Academy Follow-up',
        sentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        recipientCount: 15,
        openRate: 73.3,
        clickRate: 20.0,
        responseRate: 13.3,
        bounceRate: 0.0,
        subject: 'Basketball Success Stories - GMTM Case Studies',
        sport: 'Basketball',
        priority: 'Medium'
      },
      {
        id: 'soccer-club-specialized',
        name: 'Soccer Club Specialized Outreach',
        sentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        recipientCount: 18,
        openRate: 61.1,
        clickRate: 16.7,
        responseRate: 11.1,
        bounceRate: 5.6,
        subject: 'Elevate Your Soccer Program with GMTM',
        sport: 'Soccer',
        priority: 'High'
      }
    ];
  }

  async collectMeetingData() {
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Get meetings from the last 30 days
      const meetings = await this.calendar.getEvents(
        'primary',
        thirtyDaysAgo.toISOString(),
        today.toISOString(),
        100
      );
      
      // Filter for BD-related meetings
      const bdMeetings = meetings.filter(meeting => 
        meeting.summary && (
          meeting.summary.includes('Sports Club') ||
          meeting.summary.includes('Academy') ||
          meeting.summary.includes('BD') ||
          meeting.summary.includes('Business Development')
        )
      );
      
      return bdMeetings.map(meeting => ({
        id: meeting.id,
        title: meeting.summary,
        start: meeting.start.dateTime,
        end: meeting.end.dateTime,
        attendees: meeting.attendees?.length || 0,
        status: meeting.status,
        description: meeting.description
      }));
      
    } catch (error) {
      logger.warn(`Failed to collect meeting data: ${error.message}`);
      return [];
    }
  }

  async collectEmailResponses() {
    try {
      // Search for email responses to BD campaigns
      const responses = await this.gmail.searchEmails('subject:RE: subject:GMTM newer_than:30d', 50);
      
      return responses.map(response => ({
        id: response.id,
        subject: response.subject,
        from: response.from,
        receivedDate: response.date,
        snippet: response.snippet,
        isPositive: this.classifyResponseSentiment(response.snippet)
      }));
      
    } catch (error) {
      logger.warn(`Failed to collect email responses: ${error.message}`);
      return [];
    }
  }

  classifyResponseSentiment(snippet) {
    const positiveKeywords = ['interested', 'yes', 'schedule', 'call', 'meeting', 'discuss', 'learn more'];
    const negativeKeywords = ['not interested', 'no', 'remove', 'unsubscribe', 'busy'];
    
    const lowerSnippet = snippet.toLowerCase();
    
    const positiveScore = positiveKeywords.filter(word => lowerSnippet.includes(word)).length;
    const negativeScore = negativeKeywords.filter(word => lowerSnippet.includes(word)).length;
    
    return positiveScore > negativeScore;
  }

  async analyzeBDPerformance(bdData) {
    logger.info('Analyzing BD performance metrics...');
    
    const analytics = {
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      },
      prospectMetrics: {},
      campaignMetrics: {},
      responseMetrics: {},
      pipelineMetrics: {},
      keyInsights: [],
      recommendations: []
    };
    
    // Analyze prospect metrics
    analytics.prospectMetrics = {
      totalProspects: bdData.prospects.length,
      highPriorityProspects: bdData.prospects.filter(p => p.priority === 'High').length,
      avgLeadScore: bdData.prospects.reduce((sum, p) => sum + p.leadScore, 0) / bdData.prospects.length,
      prospectsBySport: this.groupBySport(bdData.prospects),
      prospectsByStatus: this.groupByStatus(bdData.prospects),
      prospectsByLocation: this.groupByLocation(bdData.prospects)
    };
    
    // Analyze campaign metrics
    analytics.campaignMetrics = {
      totalCampaigns: bdData.campaigns.length,
      avgOpenRate: bdData.campaigns.reduce((sum, c) => sum + c.openRate, 0) / bdData.campaigns.length,
      avgClickRate: bdData.campaigns.reduce((sum, c) => sum + c.clickRate, 0) / bdData.campaigns.length,
      avgResponseRate: bdData.campaigns.reduce((sum, c) => sum + c.responseRate, 0) / bdData.campaigns.length,
      totalEmailsSent: bdData.campaigns.reduce((sum, c) => sum + c.recipientCount, 0),
      bestPerformingCampaign: bdData.campaigns.reduce((best, current) => 
        current.responseRate > best.responseRate ? current : best, bdData.campaigns[0])
    };
    
    // Analyze response metrics
    analytics.responseMetrics = {
      totalResponses: bdData.responses.length,
      positiveResponses: bdData.responses.filter(r => r.isPositive).length,
      negativeResponses: bdData.responses.filter(r => !r.isPositive).length,
      responseRate: (bdData.responses.length / analytics.campaignMetrics.totalEmailsSent * 100).toFixed(1)
    };
    
    // Calculate pipeline metrics
    analytics.pipelineMetrics = {
      totalPipelineValue: this.calculatePipelineValue(bdData.prospects),
      avgDealSize: 25000, // Estimated average deal size
      conversionRate: 15, // Estimated conversion rate %
      projectedRevenue: 0,
      dealsByStage: this.groupByPipelineStage(bdData.prospects)
    };
    
    analytics.pipelineMetrics.projectedRevenue = 
      (analytics.pipelineMetrics.totalPipelineValue * analytics.pipelineMetrics.conversionRate / 100);
    
    // Generate key insights
    analytics.keyInsights = this.generateKeyInsights(analytics);
    
    // Generate recommendations
    analytics.recommendations = this.generateRecommendations(analytics);
    
    logger.info(`BD performance analysis complete. Response rate: ${analytics.responseMetrics.responseRate}%`);
    return analytics;
  }

  groupBySport(prospects) {
    const sportGroups = {};
    prospects.forEach(p => {
      sportGroups[p.sport] = (sportGroups[p.sport] || 0) + 1;
    });
    return sportGroups;
  }

  groupByStatus(prospects) {
    const statusGroups = {};
    prospects.forEach(p => {
      statusGroups[p.outreachStatus] = (statusGroups[p.outreachStatus] || 0) + 1;
    });
    return statusGroups;
  }

  groupByLocation(prospects) {
    const locationGroups = {};
    prospects.forEach(p => {
      const state = p.location.split(',')[0];
      locationGroups[state] = (locationGroups[state] || 0) + 1;
    });
    return locationGroups;
  }

  calculatePipelineValue(prospects) {
    return prospects.reduce((total, prospect) => {
      const baseValue = 15000; // Base contract value
      const athleteMultiplier = prospect.estimatedAthletes / 100;
      const scoreMultiplier = prospect.leadScore / 100;
      const priorityMultiplier = prospect.priority === 'High' ? 1.5 : prospect.priority === 'Medium' ? 1.2 : 1.0;
      
      return total + (baseValue * athleteMultiplier * scoreMultiplier * priorityMultiplier);
    }, 0);
  }

  groupByPipelineStage(prospects) {
    const stages = {
      'Prospecting': prospects.filter(p => p.outreachStatus === 'Not Contacted').length,
      'Initial Contact': prospects.filter(p => p.outreachStatus === 'Initial Email Sent').length,
      'Follow-up': prospects.filter(p => p.outreachStatus === 'Follow-up Sent').length,
      'Qualified': prospects.filter(p => p.outreachStatus === 'Qualified').length,
      'Proposal': prospects.filter(p => p.outreachStatus === 'Proposal Sent').length,
      'Negotiation': prospects.filter(p => p.outreachStatus === 'Negotiating').length,
      'Closed Won': prospects.filter(p => p.outreachStatus === 'Closed Won').length,
      'Closed Lost': prospects.filter(p => p.outreachStatus === 'Closed Lost').length
    };
    
    return stages;
  }

  generateKeyInsights(analytics) {
    const insights = [];
    
    // Response rate insights
    if (analytics.responseMetrics.responseRate > 10) {
      insights.push(`🎯 Strong response rate of ${analytics.responseMetrics.responseRate}% - above industry average`);
    } else if (analytics.responseMetrics.responseRate < 5) {
      insights.push(`⚠️ Low response rate of ${analytics.responseMetrics.responseRate}% - needs improvement`);
    }
    
    // Campaign performance insights
    if (analytics.campaignMetrics.bestPerformingCampaign) {
      insights.push(`🏆 Best performing campaign: "${analytics.campaignMetrics.bestPerformingCampaign.name}" (${analytics.campaignMetrics.bestPerformingCampaign.responseRate}% response rate)`);
    }
    
    // Pipeline insights
    if (analytics.pipelineMetrics.totalPipelineValue > 500000) {
      insights.push(`💰 Strong pipeline value of $${(analytics.pipelineMetrics.totalPipelineValue / 1000000).toFixed(1)}M`);
    }
    
    // Sport-specific insights
    const topSport = Object.entries(analytics.prospectMetrics.prospectsBySport)
      .sort(([,a], [,b]) => b - a)[0];
    if (topSport) {
      insights.push(`🏀 Top sport category: ${topSport[0]} (${topSport[1]} prospects)`);
    }
    
    // Geographic insights
    const topLocation = Object.entries(analytics.prospectMetrics.prospectsByLocation)
      .sort(([,a], [,b]) => b - a)[0];
    if (topLocation) {
      insights.push(`📍 Top geographic market: ${topLocation[0]} (${topLocation[1]} prospects)`);
    }
    
    return insights;
  }

  generateRecommendations(analytics) {
    const recommendations = [];
    
    // Response rate recommendations
    if (analytics.responseMetrics.responseRate < 8) {
      recommendations.push('Improve email personalization and subject lines');
      recommendations.push('A/B test different outreach templates');
      recommendations.push('Focus on higher-scoring prospects');
    }
    
    // Campaign recommendations
    if (analytics.campaignMetrics.avgOpenRate < 60) {
      recommendations.push('Optimize subject lines for better open rates');
      recommendations.push('Test different send times');
    }
    
    // Pipeline recommendations
    if (analytics.pipelineMetrics.totalPipelineValue < 300000) {
      recommendations.push('Increase prospecting volume');
      recommendations.push('Target larger sports organizations');
      recommendations.push('Expand to new geographic markets');
    }
    
    // Follow-up recommendations
    const needsFollowUp = Object.values(analytics.pipelineMetrics.dealsByStage)
      .slice(1, 4).reduce((a, b) => a + b, 0);
    if (needsFollowUp > 10) {
      recommendations.push('Accelerate follow-up sequences');
      recommendations.push('Schedule more discovery calls');
    }
    
    return recommendations;
  }

  async createVisualDashboard(analytics) {
    logger.info('Creating visual dashboard with Canva...');
    
    try {
      // Create comprehensive BD dashboard
      const dashboardData = {
        responseRate: analytics.responseMetrics.responseRate,
        pipelineValue: `$${(analytics.pipelineMetrics.totalPipelineValue / 1000000).toFixed(1)}M`,
        totalProspects: analytics.prospectMetrics.totalProspects,
        avgLeadScore: analytics.prospectMetrics.avgLeadScore.toFixed(1),
        topSport: Object.entries(analytics.prospectMetrics.prospectsBySport)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A',
        campaignCount: analytics.campaignMetrics.totalCampaigns,
        keyInsights: analytics.keyInsights.slice(0, 3)
      };
      
      const dashboard = await this.canva.createDesign('bd-dashboard-template', {
        customData: dashboardData,
        branding: {
          primaryColor: '#FF6B35',
          secondaryColor: '#2E86AB',
          logoUrl: 'https://gmtm.com/logo.png'
        }
      });
      
      // Export dashboard as PDF
      const exportedDashboard = await this.canva.exportDesign(dashboard.id, 'pdf');
      
      // Save to Google Drive
      await this.googleDrive.createFile(
        `BD_Dashboard_${formatDate()}.pdf`,
        exportedDashboard.downloadUrl,
        'application/pdf',
        []
      );
      
      logger.info('Visual dashboard created and saved to Google Drive');
      return dashboard;
      
    } catch (error) {
      logger.warn(`Failed to create visual dashboard: ${error.message}`);
      return null;
    }
  }

  async generateExecutiveReport(analytics) {
    logger.info('Generating executive BD report...');
    
    const reportContent = `
# Business Development Executive Report
## ${formatDate()}

### 📊 Executive Summary
- **Total Pipeline Value**: $${(analytics.pipelineMetrics.totalPipelineValue / 1000000).toFixed(1)}M
- **Projected Revenue**: $${(analytics.pipelineMetrics.projectedRevenue / 1000000).toFixed(1)}M
- **Response Rate**: ${analytics.responseMetrics.responseRate}%
- **Active Prospects**: ${analytics.prospectMetrics.totalProspects}
- **High-Priority Leads**: ${analytics.prospectMetrics.highPriorityProspects}

### 🎯 Key Performance Indicators
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Response Rate | ${analytics.responseMetrics.responseRate}% | 8.0% | ${analytics.responseMetrics.responseRate >= 8 ? '✅ On Track' : '⚠️ Below Target'} |
| Pipeline Value | $${(analytics.pipelineMetrics.totalPipelineValue / 1000000).toFixed(1)}M | $1.0M | ${analytics.pipelineMetrics.totalPipelineValue >= 1000000 ? '✅ On Track' : '⚠️ Below Target'} |
| Avg Lead Score | ${analytics.prospectMetrics.avgLeadScore.toFixed(1)} | 70 | ${analytics.prospectMetrics.avgLeadScore >= 70 ? '✅ On Track' : '⚠️ Below Target'} |
| Campaign Performance | ${analytics.campaignMetrics.avgResponseRate.toFixed(1)}% | 10.0% | ${analytics.campaignMetrics.avgResponseRate >= 10 ? '✅ On Track' : '⚠️ Below Target'} |

### 🏆 Top Performing Segments
**Sports Categories:**
${Object.entries(analytics.prospectMetrics.prospectsBySport)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([sport, count]) => `- ${sport}: ${count} prospects`)
  .join('\n')}

**Geographic Markets:**
${Object.entries(analytics.prospectMetrics.prospectsByLocation)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([location, count]) => `- ${location}: ${count} prospects`)
  .join('\n')}

### 📈 Pipeline Analysis
${Object.entries(analytics.pipelineMetrics.dealsByStage)
  .map(([stage, count]) => `- **${stage}**: ${count} prospects`)
  .join('\n')}

### 🔍 Key Insights
${analytics.keyInsights.map(insight => `- ${insight}`).join('\n')}

### 🎯 Strategic Recommendations
${analytics.recommendations.map(rec => `- ${rec}`).join('\n')}

### 📧 Campaign Performance
| Campaign | Sent | Open Rate | Click Rate | Response Rate |
|----------|------|-----------|------------|---------------|
${analytics.campaignMetrics.totalCampaigns > 0 ? 
  `| Best Campaign | ${analytics.campaignMetrics.bestPerformingCampaign?.recipientCount || 'N/A'} | ${analytics.campaignMetrics.bestPerformingCampaign?.openRate || 'N/A'}% | ${analytics.campaignMetrics.bestPerformingCampaign?.clickRate || 'N/A'}% | ${analytics.campaignMetrics.bestPerformingCampaign?.responseRate || 'N/A'}% |` : 
  '| No campaigns | - | - | - | - |'}

### 🚀 Next Steps
1. **Immediate Actions (This Week)**
   - Follow up with ${analytics.prospectMetrics.highPriorityProspects} high-priority prospects
   - Schedule discovery calls with recent positive responders
   - Optimize underperforming campaigns

2. **Short-term Goals (Next Month)**
   - Increase pipeline value to $1.5M
   - Improve response rate to 12%
   - Expand top-performing sport categories

3. **Long-term Strategy (Next Quarter)**
   - Scale successful campaigns to new markets
   - Develop sport-specific value propositions
   - Implement advanced lead scoring

### 📊 Supporting Data
- **Report Period**: ${new Date(analytics.dateRange.start).toLocaleDateString()} - ${new Date(analytics.dateRange.end).toLocaleDateString()}
- **Data Sources**: Notion CRM, Email Campaigns, Calendar, Responses
- **Last Updated**: ${new Date().toLocaleString()}

---
*Generated by GMTM BD Dashboard Reporter*
*For questions or drill-down analysis, contact the BD team*
    `;
    
    const fileName = `BD_Executive_Report_${formatDate().replace(/-/g, '_')}.md`;
    
    await this.googleDrive.createFile(
      fileName,
      reportContent,
      'text/markdown',
      []
    );
    
    logger.info(`Executive report created: ${fileName}`);
    return { fileName, content: reportContent };
  }

  async updateNotionDashboard(analytics) {
    logger.info('Updating Notion BD dashboard...');
    
    try {
      const dashboardProperties = {
        Name: {
          title: [{ text: { content: `BD Dashboard - ${formatDate()}` } }]
        },
        Type: {
          select: { name: 'BD Dashboard' }
        },
        Date: {
          date: { start: new Date().toISOString() }
        },
        'Total Prospects': {
          number: analytics.prospectMetrics.totalProspects
        },
        'Pipeline Value': {
          number: analytics.pipelineMetrics.totalPipelineValue
        },
        'Response Rate': {
          number: parseFloat(analytics.responseMetrics.responseRate)
        },
        'Avg Lead Score': {
          number: analytics.prospectMetrics.avgLeadScore
        },
        'High Priority Leads': {
          number: analytics.prospectMetrics.highPriorityProspects
        },
        'Campaigns Active': {
          number: analytics.campaignMetrics.totalCampaigns
        },
        Status: {
          select: { 
            name: analytics.responseMetrics.responseRate >= 8 ? 'On Track' : 'Needs Attention'
          }
        }
      };

      if (config.notion.databaseIds.reports) {
        await this.notion.createPage(
          config.notion.databaseIds.reports,
          dashboardProperties
        );
      }
      
      logger.info('Notion dashboard updated successfully');
    } catch (error) {
      logger.warn(`Failed to update Notion dashboard: ${error.message}`);
    }
  }

  async sendPerformanceAlerts(analytics) {
    logger.info('Checking for performance alerts...');
    
    const alerts = [];
    
    // Response rate alert
    if (analytics.responseMetrics.responseRate < 5) {
      alerts.push({
        type: 'critical',
        message: `Response rate critically low at ${analytics.responseMetrics.responseRate}%`,
        action: 'Immediate campaign optimization required'
      });
    }
    
    // Pipeline value alert
    if (analytics.pipelineMetrics.totalPipelineValue < 200000) {
      alerts.push({
        type: 'warning',
        message: `Pipeline value below target at $${(analytics.pipelineMetrics.totalPipelineValue / 1000000).toFixed(1)}M`,
        action: 'Increase prospecting efforts'
      });
    }
    
    // Follow-up alert
    const needsFollowUp = Object.values(analytics.pipelineMetrics.dealsByStage)
      .slice(1, 4).reduce((a, b) => a + b, 0);
    if (needsFollowUp > 15) {
      alerts.push({
        type: 'info',
        message: `${needsFollowUp} prospects need follow-up attention`,
        action: 'Schedule follow-up sequences'
      });
    }
    
    if (alerts.length > 0) {
      // Create GitHub issues for critical alerts
      for (const alert of alerts.filter(a => a.type === 'critical')) {
        await this.createPerformanceAlert(alert, analytics);
      }
    }
    
    logger.info(`Performance check complete. ${alerts.length} alerts generated.`);
  }

  async createPerformanceAlert(alert, analytics) {
    try {
      const title = `🚨 BD Performance Alert: ${alert.message}`;
      const body = `
## Business Development Performance Alert

**Alert Type**: ${alert.type.toUpperCase()}
**Issue**: ${alert.message}
**Recommended Action**: ${alert.action}
**Date**: ${new Date().toLocaleString()}

### Current Performance Metrics
- **Response Rate**: ${analytics.responseMetrics.responseRate}%
- **Pipeline Value**: $${(analytics.pipelineMetrics.totalPipelineValue / 1000000).toFixed(1)}M
- **Active Prospects**: ${analytics.prospectMetrics.totalProspects}
- **High Priority**: ${analytics.prospectMetrics.highPriorityProspects}

### Immediate Actions Required
- [ ] Review campaign performance data
- [ ] Analyze low-performing segments
- [ ] Implement optimization strategies
- [ ] Schedule performance review meeting
- [ ] Update BD team on findings

### Impact Assessment
This performance issue may impact:
- Monthly pipeline goals
- Quarterly revenue targets
- Team productivity metrics
- Overall BD effectiveness

*This alert was automatically generated by the BD Dashboard Reporter*
      `;

      await this.github.createIssue(
        'your-org',
        'gmtm-ops-automation',
        title,
        body,
        ['bd-performance', 'alert', alert.type]
      );
      
    } catch (error) {
      logger.error(`Failed to create performance alert: ${error.message}`);
    }
  }

  async scheduleFollowUpActions(analytics) {
    logger.info('Scheduling follow-up actions...');
    
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      
      const event = {
        summary: `🎯 BD Performance Review & Action Planning`,
        description: `
Weekly BD performance review based on dashboard analytics.

**Key Metrics to Review:**
- Response Rate: ${analytics.responseMetrics.responseRate}%
- Pipeline Value: $${(analytics.pipelineMetrics.totalPipelineValue / 1000000).toFixed(1)}M
- Active Prospects: ${analytics.prospectMetrics.totalProspects}
- High Priority Leads: ${analytics.prospectMetrics.highPriorityProspects}

**Action Items:**
${analytics.recommendations.map(rec => `- ${rec}`).join('\n')}

**Key Insights:**
${analytics.keyInsights.map(insight => `- ${insight}`).join('\n')}

**Materials to Review:**
- Executive report in Google Drive
- Visual dashboard (Canva)
- Notion CRM updates
- Campaign performance data

**Attendees Needed:**
- BD Team Lead
- Marketing Team
- Sales Operations
        `,
        start: {
          dateTime: tomorrow.toISOString(),
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
          timeZone: 'America/New_York'
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 }
          ]
        }
      };
      
      await this.calendar.createEvent('primary', event);
      logger.info('Scheduled BD performance review meeting');
      
    } catch (error) {
      logger.warn(`Failed to schedule follow-up actions: ${error.message}`);
    }
  }

  async createFailureIssue(error) {
    try {
      const title = `🚨 BD Dashboard Reporter Failed`;
      const body = `
## BD Dashboard Reporter Failure

**Automation**: ${this.name}
**Time**: ${new Date().toLocaleString()}
**Error**: ${error.message}

## Business Impact
The BD dashboard reporter failed, which may result in:
- Missing performance insights
- Delayed decision making
- Lack of pipeline visibility
- Missed optimization opportunities

## Error Details
\`\`\`
${error.stack}
\`\`\`

## Immediate Actions Required
- [ ] Investigate the reporting failure
- [ ] Check data source connectivity
- [ ] Verify Notion/Drive/Canva integrations
- [ ] Run manual performance analysis
- [ ] Fix and test the reporter
- [ ] Notify BD team of delay

*This issue was automatically created by the BD Dashboard Reporter*
      `;

      await this.github.createIssue(
        'your-org',
        'gmtm-ops-automation',
        title,
        body,
        ['automation-failure', 'bd-dashboard', 'critical']
      );
      
    } catch (ghError) {
      logger.error(`Failed to create failure issue: ${ghError.message}`);
    }
  }
}

module.exports = BDDashboardReporterAutomation;