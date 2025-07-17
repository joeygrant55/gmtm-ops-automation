# 🔧 Cursor Webhook Setup Guide

This guide will help you set up the webhook integration between your BD automation system and Slack using Cursor's background agents.

## 📋 **Prerequisites**

1. **Slack Webhook URL** - We'll get this in the next steps
2. **Cursor IDE** - Already installed ✅
3. **Node.js** - Already installed ✅

## 🚀 **Step 1: Get Your Slack Webhook URL**

### **Option A: Create Incoming Webhook (Easiest)**

1. Go to: https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Name it: `GMTM BD Automation`
4. Select your workspace
5. Click **"Incoming Webhooks"** in the left sidebar
6. Toggle **"Activate Incoming Webhooks"** to ON
7. Click **"Add New Webhook to Workspace"**
8. Select channel: `#bd-automation` (or create it first)
9. Copy the webhook URL (looks like: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX`)

### **Option B: Use Existing Slack App**

If you already have a Slack app:
1. Go to your app settings
2. Enable **Incoming Webhooks**
3. Add webhook for `#bd-automation` channel
4. Copy the webhook URL

## 🔌 **Step 2: Configure the Webhook Agent**

1. **Update your `.env` file**:
```bash
# Add these lines to your .env file
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#bd-automation
WEBHOOK_PORT=3001
```

2. **Test the webhook agent**:
```bash
# In a new terminal window
cd /Users/joey/gmtm-ops-automation
node cursor-webhook-agent.js
```

You should see:
```
🚀 Cursor webhook agent running on port 3001
📡 Webhook endpoint: http://localhost:3001/webhook
🔗 Slack channel: #bd-automation
```

## 🔗 **Step 3: Connect BD Automation to Webhook**

Update your automation to send webhooks:

1. **Add webhook configuration to `.env`**:
```bash
# Cursor webhook endpoint
CURSOR_SLACK_WEBHOOK_URL=http://localhost:3001/webhook
```

2. **Test the connection**:
```bash
# In another terminal, test the webhook
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "automation_update",
    "automation": "Test",
    "status": "completed",
    "details": {
      "message": "Webhook test successful!"
    }
  }'
```

You should see a message in your Slack channel!

## 🎯 **Step 4: Run as Cursor Background Agent**

### **Option A: Manual Start**
1. Open Cursor IDE
2. Open terminal in Cursor
3. Run: `node cursor-webhook-agent.js`
4. Keep it running in the background

### **Option B: Auto-start with PM2**
```bash
# Install PM2 globally
npm install -g pm2

# Start the webhook agent
pm2 start cursor-webhook-agent.js --name "bd-webhook"

# Save PM2 configuration
pm2 save

# Set up auto-start on system boot
pm2 startup
```

### **Option C: Use Cursor's Task Runner**
1. In Cursor, open `.vscode/tasks.json`
2. Add this task:
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start BD Webhook Agent",
      "type": "shell",
      "command": "node cursor-webhook-agent.js",
      "isBackground": true,
      "problemMatcher": {
        "pattern": {
          "regexp": "^(.*)$",
          "message": 1
        },
        "background": {
          "activeOnStart": true,
          "beginsPattern": "^Starting",
          "endsPattern": "^Webhook agent running"
        }
      }
    }
  ]
}
```

Then run: `Cmd+Shift+P` → `Tasks: Run Task` → `Start BD Webhook Agent`

## ✅ **Step 5: Verify Integration**

1. **Start the webhook agent** (if not already running)
2. **Run a test automation**:
```bash
npm run sports-prospector
```

3. **Check Slack** - You should see:
   - 🚀 Automation started notification
   - 📊 Progress updates
   - ✅ Completion notification
   - 🎯 Prospect alerts (if any found)

## 🛠️ **Troubleshooting**

### **No messages in Slack?**
1. Check webhook URL is correct in `.env`
2. Ensure channel exists and bot has access
3. Check terminal for error messages
4. Test webhook directly with curl command

### **Connection refused?**
1. Make sure webhook agent is running
2. Check port 3001 is not in use: `lsof -i :3001`
3. Try a different port in `.env`

### **Slack errors?**
1. Regenerate webhook URL in Slack
2. Check channel permissions
3. Ensure webhook is active in Slack app

## 📊 **What Happens Next**

Once connected, your BD automation will automatically:
- Send real-time updates to Slack
- Alert team about qualified prospects
- Show performance metrics
- Enable interactive approval workflows

## 🎉 **Success Indicators**

You'll know it's working when:
- Test webhook shows message in Slack ✅
- Automation runs trigger Slack notifications ✅
- Team can see prospect alerts in real-time ✅
- Interactive buttons appear in Slack messages ✅

---

**Next Step**: Once webhook is working, proceed to Step 2: Configure Slack slash commands for full interactive control!