/**
 * Deffatest Slack Bot
 * AI-powered bug detection notifications for Slack
 * 
 * SECURITY: All secrets are loaded from environment variables
 * NEVER hardcode any credentials in this file
 */

const { App, ExpressReceiver } = require('@slack/bolt');
require('dotenv').config();

// Import modules
const commandsController = require('./controllers/commands');
const eventsController = require('./controllers/events');
const interactionsController = require('./controllers/interactions');
const oauthController = require('./controllers/oauth');
const webhooksController = require('./controllers/webhooks');
const { verifyDeffatestWebhook } = require('./middleware/auth');
const { getWorkspaceToken } = require('./services/database');
const logger = require('./utils/logger');

// Validate required environment variables
const requiredEnvVars = [
    'SLACK_CLIENT_ID',
    'SLACK_CLIENT_SECRET', 
    'SLACK_SIGNING_SECRET',
    'DEFFATEST_API_URL',
    'ENCRYPTION_KEY'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        logger.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

// Create Express receiver for custom routes
const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    endpoints: '/slack/events',
    processBeforeResponse: true
});

// Create Slack app with custom authorization
const app = new App({
    receiver,
    authorize: async ({ teamId }) => {
        try {
            const workspace = await getWorkspaceToken(teamId);
            
            if (!workspace) {
                throw new Error('Workspace not authorized');
            }
            
            return {
                botToken: workspace.bot_token,
                botId: workspace.bot_id,
                botUserId: workspace.bot_user_id
            };
        } catch (error) {
            logger.error('Authorization failed:', error.message);
            throw error;
        }
    }
});

// ============================================================================
// SLASH COMMANDS
// ============================================================================

// /deffatest - Main command
app.command('/deffatest', async ({ command, ack, respond, client }) => {
    await ack();
    await commandsController.handleTestCommand(command, respond, client);
});

// /deffatest-status - Check test status
app.command('/deffatest-status', async ({ command, ack, respond, client }) => {
    await ack();
    await commandsController.handleStatusCommand(command, respond, client);
});

// ============================================================================
// EVENTS
// ============================================================================

// App mention (@deffatest)
app.event('app_mention', async ({ event, client }) => {
    await eventsController.handleMention(event, client);
});

// Direct messages
app.event('message', async ({ event, client }) => {
    if (event.channel_type === 'im' && !event.bot_id) {
        await eventsController.handleDirectMessage(event, client);
    }
});

// ============================================================================
// INTERACTIONS (Buttons, Menus)
// ============================================================================

// Button clicks
app.action(/^button_.*/, async ({ action, ack, body, client }) => {
    await ack();
    await interactionsController.handleButtonClick(action, body, client);
});

// Select menus
app.action(/^select_.*/, async ({ action, ack, body, client }) => {
    await ack();
    await interactionsController.handleSelectMenu(action, body, client);
});

// View submissions (modals)
app.view(/^modal_.*/, async ({ ack, body, view, client }) => {
    await ack();
    await interactionsController.handleViewSubmission(body, view, client);
});

// ============================================================================
// OAUTH ROUTES
// ============================================================================

// Install page (Add to Slack button leads here)
receiver.router.get('/slack/install', oauthController.initiateOAuth);

// OAuth callback (Slack redirects here after authorization)
receiver.router.get('/slack/oauth/callback', oauthController.handleCallback);

// Success page after installation
receiver.router.get('/slack/success', oauthController.successPage);

// ============================================================================
// WEBHOOK ROUTES (from Deffatest backend)
// ============================================================================

// Receive webhooks from Deffatest when tests complete
receiver.router.post('/webhooks/deffatest',
    verifyDeffatestWebhook,
    async (req, res) => {
        try {
            await webhooksController.handleWebhook(req.body, app.client);
            res.json({ success: true });
        } catch (error) {
            logger.error('Webhook error:', error.message);
            res.status(500).json({ error: 'Internal error' });
        }
    }
);

// ============================================================================
// HEALTH & STATUS
// ============================================================================

// Health check (minimal info for security)
receiver.router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3001;

(async () => {
    try {
        await app.start(PORT);
        logger.info(`⚡ Deffatest Slack Bot running on port ${PORT}`);
    } catch (error) {
        logger.error('Failed to start:', error.message);
        process.exit(1);
    }
})();
