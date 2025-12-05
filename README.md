# Deffatest Slack Bot

> AI-powered bug detection notifications for Slack

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Get real-time notifications when your Deffatest tests complete, start tests directly from Slack, and keep your team updated on bug detection.

## Features

- 🚀 **Start Tests** - Run tests with `/deffatest --url https://yourapp.com`
- 📊 **Check Status** - Check progress with `/deffatest-status <test-id>`
- 🔔 **Real-time Notifications** - Get notified when tests complete
- 🔴 **Bug Alerts** - Instant alerts for critical/high priority bugs
- 👥 **Team Visibility** - Everyone sees test results in the channel

## Installation

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL database
- Slack App (created at api.slack.com)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/KOKRIG/deffatest-slack.git
cd deffatest-slack
npm install
```

2. **Create environment file**
```bash
cp .env.example .env
```

3. **Configure environment variables**
```env
# Get these from api.slack.com/apps
SLACK_CLIENT_ID=your_client_id
SLACK_CLIENT_SECRET=your_client_secret
SLACK_SIGNING_SECRET=your_signing_secret

# Your server URL
SLACK_REDIRECT_URI=https://your-server.com/slack/oauth/callback

# Deffatest API
DEFFATEST_API_URL=https://api.deffatest.online

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_char_hex_key
DEFFATEST_WEBHOOK_SECRET=your_webhook_secret

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/deffatest_slack
```

4. **Start the server**
```bash
npm start
```

## Slack App Configuration

### 1. Create Slack App
- Go to https://api.slack.com/apps
- Click "Create New App" → "From scratch"
- Name: `Deffatest`

### 2. OAuth & Permissions
Add these Bot Token Scopes:
- `chat:write`
- `chat:write.public`
- `commands`
- `users:read`
- `channels:read`
- `groups:read`
- `im:write`
- `app_mentions:read`

Set Redirect URL:
```
https://your-server.com/slack/oauth/callback
```

### 3. Slash Commands
Create these commands:

| Command | Request URL | Description |
|---------|-------------|-------------|
| `/deffatest` | `https://your-server.com/slack/events` | Start a test |
| `/deffatest-status` | `https://your-server.com/slack/events` | Check status |

### 4. Event Subscriptions
Enable Events and set Request URL:
```
https://your-server.com/slack/events
```

Subscribe to bot events:
- `app_mention`
- `message.im`

### 5. Interactivity
Enable and set Request URL:
```
https://your-server.com/slack/events
```

## Usage

### Start a Test
```
/deffatest --url https://myapp.com --duration 2h
```

### Options
- `--url` - Application URL (required)
- `--duration` - Test duration: 30m, 1h, 2h, 6h, 12h (default: 2h)
- `--type` - Test type: web, mobile, game (default: web)

### Check Status
```
/deffatest-status test_abc123
```

### Get Help
```
/deffatest help
```

## Security

- ✅ All tokens encrypted with AES-256-GCM
- ✅ Webhook signatures verified
- ✅ CSRF protection on OAuth
- ✅ Rate limiting on endpoints
- ✅ No secrets in logs

## Deployment

### Heroku
```bash
heroku create deffatest-slack
heroku addons:create heroku-postgresql:mini
heroku config:set SLACK_CLIENT_ID=xxx
# ... set other env vars
git push heroku main
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/slack/install` | GET | Start OAuth flow |
| `/slack/oauth/callback` | GET | OAuth callback |
| `/slack/events` | POST | Slack events & commands |
| `/webhooks/deffatest` | POST | Deffatest webhooks |
| `/health` | GET | Health check |

## Support

- **Email:** support@deffatest.online
- **Docs:** https://docs.deffatest.online/slack

## License

MIT © Deffatest
