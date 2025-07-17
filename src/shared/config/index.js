require('dotenv').config();

const config = {
  // HubSpot Configuration
  hubspot: {
    apiKey: process.env.HUBSPOT_API_KEY,
    baseUrl: process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com'
  },

  // Slack Configuration
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
    channel: process.env.SLACK_DEFAULT_CHANNEL || '#general'
  },

  // Gmail Configuration
  gmail: {
    credentials: {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    },
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send'
    ]
  },

  // Notion Configuration
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    databaseIds: {
      tasks: process.env.NOTION_TASKS_DATABASE_ID,
      contacts: process.env.NOTION_CONTACTS_DATABASE_ID,
      reports: process.env.NOTION_REPORTS_DATABASE_ID
    }
  },

  // Application Configuration
  app: {
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // Automation Configuration
  automation: {
    schedules: {
      dailyReports: process.env.DAILY_REPORTS_SCHEDULE || '0 9 * * *',
      weeklySync: process.env.WEEKLY_SYNC_SCHEDULE || '0 9 * * 1',
      monthlyReview: process.env.MONTHLY_REVIEW_SCHEDULE || '0 9 1 * *'
    },
    timeouts: {
      default: parseInt(process.env.DEFAULT_TIMEOUT) || 30000,
      long: parseInt(process.env.LONG_TIMEOUT) || 120000
    }
  },

  // Puppeteer Configuration
  puppeteer: {
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    slowMo: parseInt(process.env.PUPPETEER_SLOW_MO) || 0,
    timeout: parseInt(process.env.PUPPETEER_TIMEOUT) || 30000
  }
};

// Validation function to check required environment variables
function validateConfig() {
  const required = [];
  
  if (!config.hubspot.apiKey) required.push('HUBSPOT_API_KEY');
  if (!config.slack.webhookUrl) required.push('SLACK_WEBHOOK_URL');
  if (!config.gmail.credentials.client_id) required.push('GOOGLE_CLIENT_ID');
  if (!config.gmail.credentials.client_secret) required.push('GOOGLE_CLIENT_SECRET');
  if (!config.gmail.credentials.refresh_token) required.push('GOOGLE_REFRESH_TOKEN');
  if (!config.notion.apiKey) required.push('NOTION_API_KEY');
  
  if (required.length > 0) {
    throw new Error(`Missing required environment variables: ${required.join(', ')}`);
  }
}

module.exports = {
  config,
  validateConfig
};