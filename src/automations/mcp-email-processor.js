const logger = require('../shared/logging/logger');
const { config } = require('../shared/config');
const { sleep, formatDate } = require('../shared/utils');

/**
 * MCP-Enhanced Email Processing Automation
 * 
 * This automation demonstrates how to use MCP tools for:
 * - Gmail integration for email processing
 * - Notion for task management
 * - Google Calendar for scheduling
 * - GitHub for issue tracking
 */
class MCPEmailProcessorAutomation {
  constructor(mcpAdapters) {
    this.name = 'MCP Email Processor';
    this.description = 'Processes emails using MCP tools and creates tasks in Notion';
    this.schedule = '*/30 * * * *'; // Every 30 minutes
    this.enabled = true;
    
    // MCP feature flags
    this.usesGmail = true;
    this.usesNotion = true;
    this.usesCalendar = true;
    this.usesGitHub = true;
    
    // Store MCP adapters
    this.gmail = mcpAdapters.gmail;
    this.notion = mcpAdapters.notion;
    this.calendar = mcpAdapters.googleCalendar;
    this.github = mcpAdapters.github;
  }

  async execute(options = {}) {
    logger.info(`Executing ${this.name}...`);
    
    try {
      // Step 1: Search for unread emails with specific criteria
      const emails = await this.searchUnreadEmails();
      
      // Step 2: Process each email
      const processedEmails = [];
      for (const email of emails) {
        const processed = await this.processEmail(email);
        if (processed) {
          processedEmails.push(processed);
        }
      }
      
      // Step 3: Create summary report in Notion
      if (processedEmails.length > 0) {
        await this.createNotionSummary(processedEmails);
      }
      
      // Step 4: Schedule follow-up if needed
      await this.scheduleFollowUps(processedEmails);
      
      const result = {
        success: true,
        emailsProcessed: processedEmails.length,
        totalEmails: emails.length,
        summary: `Processed ${processedEmails.length} out of ${emails.length} emails successfully`,
        processedEmails: processedEmails.map(e => ({
          subject: e.subject,
          from: e.from,
          actionTaken: e.actionTaken
        }))
      };
      
      logger.info(`${this.name} completed successfully`);
      return result;
      
    } catch (error) {
      logger.error(`${this.name} failed:`, error);
      
      // Create GitHub issue for failure
      await this.createGitHubIssue(error);
      
      throw error;
    }
  }

  async searchUnreadEmails() {
    logger.info('Searching for unread emails...');
    
    // Search for unread emails from the last 24 hours
    const query = 'is:unread newer_than:1d';
    const emails = await this.gmail.searchEmails(query, 20);
    
    logger.info(`Found ${emails.length} unread emails`);
    return emails;
  }

  async processEmail(email) {
    try {
      logger.info(`Processing email: ${email.subject}`);
      
      // Get full email content
      const fullEmail = await this.gmail.getEmail(email.id);
      
      // Determine action based on email content
      const action = this.determineEmailAction(fullEmail);
      
      let processed = null;
      
      switch (action.type) {
        case 'create_task':
          processed = await this.createNotionTask(fullEmail, action);
          break;
        case 'schedule_meeting':
          processed = await this.scheduleCalendarMeeting(fullEmail, action);
          break;
        case 'create_issue':
          processed = await this.createGitHubIssueFromEmail(fullEmail, action);
          break;
        case 'archive':
          processed = await this.archiveEmail(fullEmail, action);
          break;
        default:
          logger.info(`No action needed for email: ${email.subject}`);
          return null;
      }
      
      // Mark email as read
      await this.gmail.markAsRead(email.id);
      
      return processed;
      
    } catch (error) {
      logger.error(`Failed to process email ${email.subject}:`, error);
      return null;
    }
  }

  determineEmailAction(email) {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    
    // Simple rule-based action determination
    if (subject.includes('task') || subject.includes('todo') || body.includes('please create')) {
      return { type: 'create_task', priority: 'medium' };
    }
    
    if (subject.includes('meeting') || subject.includes('schedule') || body.includes('calendar')) {
      return { type: 'schedule_meeting', duration: 60 };
    }
    
    if (subject.includes('bug') || subject.includes('issue') || subject.includes('error')) {
      return { type: 'create_issue', labels: ['bug', 'email-generated'] };
    }
    
    if (subject.includes('newsletter') || subject.includes('unsubscribe') || body.includes('automated')) {
      return { type: 'archive' };
    }
    
    return { type: 'none' };
  }

  async createNotionTask(email, action) {
    try {
      const taskProperties = {
        Name: {
          title: [{ text: { content: `Email Task: ${email.subject}` } }]
        },
        Status: {
          select: { name: 'Todo' }
        },
        Priority: {
          select: { name: action.priority || 'Medium' }
        },
        Source: {
          rich_text: [{ text: { content: `Email from ${email.from}` } }]
        },
        'Created Date': {
          date: { start: new Date().toISOString() }
        },
        Description: {
          rich_text: [{ text: { content: email.body.substring(0, 1000) } }]
        }
      };

      if (config.notion.databaseIds.tasks) {
        const page = await this.notion.createPage(
          config.notion.databaseIds.tasks,
          taskProperties
        );
        
        logger.info(`Created Notion task for email: ${email.subject}`);
        return {
          subject: email.subject,
          from: email.from,
          actionTaken: 'created_notion_task',
          notionPageId: page.id
        };
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to create Notion task: ${error.message}`);
      return null;
    }
  }

  async scheduleCalendarMeeting(email, action) {
    try {
      const meetingTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const endTime = new Date(meetingTime.getTime() + (action.duration || 60) * 60 * 1000);
      
      const event = {
        summary: `Meeting: ${email.subject}`,
        description: `Meeting scheduled from email:\n\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.body.substring(0, 500)}`,
        start: {
          dateTime: meetingTime.toISOString(),
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'America/New_York'
        },
        attendees: [
          { email: email.from }
        ]
      };
      
      const createdEvent = await this.calendar.createEvent('primary', event);
      
      logger.info(`Scheduled calendar meeting for email: ${email.subject}`);
      return {
        subject: email.subject,
        from: email.from,
        actionTaken: 'scheduled_meeting',
        eventId: createdEvent.id,
        meetingTime: meetingTime.toISOString()
      };
      
    } catch (error) {
      logger.error(`Failed to schedule calendar meeting: ${error.message}`);
      return null;
    }
  }

  async createGitHubIssueFromEmail(email, action) {
    try {
      const title = `📧 Email Issue: ${email.subject}`;
      const body = `
## Issue from Email

**From:** ${email.from}
**Subject:** ${email.subject}
**Received:** ${new Date().toLocaleString()}

## Email Content
${email.body}

## Next Steps
- [ ] Review the issue
- [ ] Assign to appropriate team member
- [ ] Prioritize and schedule

*This issue was automatically created from an email by the MCP Email Processor*
      `;

      const issue = await this.github.createIssue(
        'your-org', // Replace with your GitHub org
        'gmtm-ops-automation', // Replace with your repo
        title,
        body,
        action.labels || ['email-generated']
      );
      
      logger.info(`Created GitHub issue for email: ${email.subject}`);
      return {
        subject: email.subject,
        from: email.from,
        actionTaken: 'created_github_issue',
        issueNumber: issue.number,
        issueUrl: issue.html_url
      };
      
    } catch (error) {
      logger.error(`Failed to create GitHub issue: ${error.message}`);
      return null;
    }
  }

  async archiveEmail(email, action) {
    logger.info(`Archiving email: ${email.subject}`);
    
    // In a real implementation, this would archive the email
    // For now, we'll just mark it as read
    return {
      subject: email.subject,
      from: email.from,
      actionTaken: 'archived'
    };
  }

  async createNotionSummary(processedEmails) {
    try {
      const summaryProperties = {
        Name: {
          title: [{ text: { content: `Email Processing Summary - ${formatDate()}` } }]
        },
        Type: {
          select: { name: 'Email Summary' }
        },
        Date: {
          date: { start: new Date().toISOString() }
        },
        'Emails Processed': {
          number: processedEmails.length
        },
        Details: {
          rich_text: [{
            text: {
              content: processedEmails.map(e => 
                `• ${e.subject} (${e.from}) → ${e.actionTaken}`
              ).join('\n')
            }
          }]
        }
      };

      if (config.notion.databaseIds.reports) {
        await this.notion.createPage(
          config.notion.databaseIds.reports,
          summaryProperties
        );
        
        logger.info(`Created Notion summary for ${processedEmails.length} processed emails`);
      }
    } catch (error) {
      logger.error(`Failed to create Notion summary: ${error.message}`);
    }
  }

  async scheduleFollowUps(processedEmails) {
    const tasksRequiringFollowUp = processedEmails.filter(e => 
      e.actionTaken === 'created_notion_task' || e.actionTaken === 'created_github_issue'
    );
    
    if (tasksRequiringFollowUp.length === 0) return;
    
    try {
      const followUpTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
      
      const event = {
        summary: `📋 Follow-up on Email Tasks`,
        description: `Follow-up on tasks created from emails:\n\n${tasksRequiringFollowUp.map(e => `• ${e.subject}`).join('\n')}`,
        start: {
          dateTime: followUpTime.toISOString(),
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: new Date(followUpTime.getTime() + 30 * 60 * 1000).toISOString(),
          timeZone: 'America/New_York'
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 10 }
          ]
        }
      };
      
      await this.calendar.createEvent('primary', event);
      logger.info(`Scheduled follow-up reminder for ${tasksRequiringFollowUp.length} tasks`);
      
    } catch (error) {
      logger.error(`Failed to schedule follow-up: ${error.message}`);
    }
  }

  async createGitHubIssue(error) {
    try {
      const title = `🚨 MCP Email Processor Failure`;
      const body = `
## Automation Failure

**Automation:** ${this.name}
**Time:** ${new Date().toLocaleString()}
**Error:** ${error.message}

## Error Details
\`\`\`
${error.stack}
\`\`\`

## Impact
The email processing automation failed, which may result in:
- Missed email processing
- Unprocessed tasks
- Missed meeting scheduling opportunities

## Next Steps
- [ ] Investigate the root cause
- [ ] Fix the automation
- [ ] Test the fix
- [ ] Monitor for similar issues

*This issue was automatically created by the MCP Email Processor*
      `;

      await this.github.createIssue(
        'your-org',
        'gmtm-ops-automation',
        title,
        body,
        ['automation-failure', 'email-processor', 'critical']
      );
      
    } catch (ghError) {
      logger.error(`Failed to create GitHub issue for automation failure: ${ghError.message}`);
    }
  }
}

module.exports = MCPEmailProcessorAutomation;