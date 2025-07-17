# MCP Integration Guide

This document explains how to leverage your MCP (Model Context Protocol) connectors for enhanced automation capabilities.

## 🔗 Available MCP Connectors

Based on your connected MCPs, here are the enhanced capabilities:

### 1. **Gmail MCP** 
- **Replaces**: `googleapis` client
- **Benefits**: 
  - Simplified authentication
  - Real-time email processing
  - Better error handling
  - No OAuth token management

### 2. **Notion MCP**
- **Replaces**: `@notionhq/client`
- **Benefits**:
  - Direct database operations
  - Simplified page management
  - Better context awareness
  - Automated property handling

### 3. **Google Calendar MCP**
- **New Capability**: Calendar-based automation
- **Features**:
  - Schedule automation runs
  - Create meeting reminders
  - Track automation events
  - Calendar-based triggers

### 4. **GitHub MCP**
- **New Capability**: Issue tracking and code management
- **Features**:
  - Auto-create issues for failures
  - Track automation deployments
  - Code repository management
  - Pull request automation

### 5. **Stripe MCP**
- **New Capability**: Payment and revenue tracking
- **Features**:
  - Revenue analytics
  - Customer lifecycle tracking
  - Payment processing automation
  - Subscription management

### 6. **Google Drive MCP**
- **New Capability**: Document and report generation
- **Features**:
  - Automated report creation
  - File sharing and collaboration
  - Document template management
  - Backup and archiving

### 7. **Intercom MCP**
- **New Capability**: Customer support automation
- **Features**:
  - Automated customer responses
  - Ticket routing
  - Support analytics
  - Knowledge base management

### 8. **Canva MCP**
- **New Capability**: Design automation
- **Features**:
  - Automated design generation
  - Brand consistency
  - Marketing material creation
  - Social media content

## 🚀 Running MCP-Enhanced Automations

### Basic Usage

```bash
# Run with MCP integrations (when in Claude Code)
npm run start:mcp

# Run specific MCP automation
npm run email-processor
npm run revenue-tracker

# Run all MCP automations
npm run run-all
```

### Environment Detection

The system automatically detects if it's running in Claude Code environment:

```javascript
// Automatically uses MCP tools when available
const orchestrator = new MCPAutomationOrchestrator();
```

## 📊 MCP-Enhanced Automation Examples

### 1. Email Processing with MCPs

```javascript
// Uses Gmail MCP + Notion MCP + Calendar MCP + GitHub MCP
const emailProcessor = new MCPEmailProcessorAutomation(mcpAdapters);

// Capabilities:
// - Process emails without OAuth
// - Create Notion tasks automatically
// - Schedule follow-up meetings
// - Create GitHub issues for bugs
```

### 2. Revenue Tracking with MCPs

```javascript
// Uses Stripe MCP + Notion MCP + Google Drive MCP + Calendar MCP
const revenueTracker = new MCPRevenueTrackerAutomation(mcpAdapters);

// Capabilities:
// - Collect Stripe revenue data
// - Generate executive reports
// - Detect revenue anomalies
// - Schedule review meetings
// - Create automated dashboards
```

## 🔧 MCP vs Traditional API Comparison

| Feature | Traditional API | MCP Integration |
|---------|----------------|-----------------|
| **Authentication** | Complex OAuth flows | Handled by Claude Code |
| **Rate Limiting** | Manual handling | Automatic management |
| **Error Handling** | Custom implementation | Built-in resilience |
| **Context Awareness** | Limited | Full context integration |
| **Real-time Data** | Polling required | Event-driven |
| **Development Speed** | Slower setup | Instant integration |

## 🛠 Creating MCP-Enhanced Automations

### Step 1: Create Your Automation Class

```javascript
class MyMCPAutomation {
  constructor(mcpAdapters) {
    this.name = 'My MCP Automation';
    this.schedule = '0 9 * * *'; // Daily at 9 AM
    
    // Set MCP feature flags
    this.usesGmail = true;
    this.usesNotion = true;
    this.usesCalendar = true;
    
    // Store MCP adapters
    this.gmail = mcpAdapters.gmail;
    this.notion = mcpAdapters.notion;
    this.calendar = mcpAdapters.googleCalendar;
  }

  async execute(options = {}) {
    // Your automation logic using MCP tools
    const emails = await this.gmail.searchEmails('is:unread');
    
    for (const email of emails) {
      await this.notion.createPage(databaseId, {
        // Create task from email
      });
    }
    
    return { success: true, processed: emails.length };
  }
}
```

### Step 2: Add to Automations Directory

Save your automation in `src/automations/` and it will be automatically loaded.

### Step 3: Run Your Automation

```bash
npm run start:mcp
```

## 🔄 MCP Adapter Pattern

The MCP adapters provide a consistent interface:

```javascript
// All MCP adapters follow this pattern
class MCPAdapter {
  async executeTool(action, params) {
    // Interfaces with Claude Code's MCP system
    // Handles authentication, rate limiting, errors
  }
}

// Usage in automations
await this.gmail.searchEmails(query);
await this.notion.createPage(databaseId, properties);
await this.calendar.createEvent(calendarId, event);
```

## 🚨 Error Handling and Monitoring

MCP automations include enhanced error handling:

- **Automatic Issue Creation**: Failures create GitHub issues
- **Calendar Notifications**: Events track automation runs
- **Notion Reporting**: Detailed logs in your workspace
- **Slack Alerts**: Real-time notifications

## 📈 Benefits of MCP Integration

1. **Simplified Development**: No API key management
2. **Enhanced Reliability**: Built-in error handling
3. **Better Context**: Claude Code provides rich context
4. **Automatic Scaling**: MCP handles rate limits
5. **Real-time Processing**: Event-driven architecture
6. **Unified Interface**: Consistent API across services

## 🎯 Best Practices

### 1. Feature Detection
```javascript
// Check if running in Claude Code environment
if (this.isClaudeCodeEnvironment) {
  // Use MCP features
} else {
  // Fallback to traditional APIs
}
```

### 2. Error Handling
```javascript
try {
  await this.mcpAdapter.executeTool('action', params);
} catch (error) {
  // MCP adapters provide detailed error context
  await this.createGitHubIssue(error);
}
```

### 3. Monitoring
```javascript
// MCP automations automatically track metrics
const runKey = metrics.recordAutomationStart(this.name);
// ... automation logic
metrics.recordAutomationEnd(runKey, 'success');
```

## 🔮 Future Enhancements

The MCP integration opens up possibilities for:

- **AI-Powered Automation**: Use Claude's reasoning in automation logic
- **Dynamic Workflow Creation**: Create automations based on context
- **Cross-Platform Intelligence**: Leverage data across all connected services
- **Predictive Analytics**: Use historical data for smarter automation
- **Natural Language Control**: Control automations through conversation

## 📚 Next Steps

1. **Test MCP Connectivity**: Run `npm run start:mcp` to verify MCP connections
2. **Create Custom Automations**: Build automations specific to your needs
3. **Monitor Performance**: Use the built-in metrics and GitHub integration
4. **Expand Integration**: Add more MCP connectors as they become available
5. **Optimize Workflows**: Use the rich context provided by Claude Code

Your MCP connectors transform this from a simple automation framework into a powerful, intelligent operations system that can reason about your business context and take appropriate actions automatically.