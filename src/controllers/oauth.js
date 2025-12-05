/**
 * OAuth Controller
 * Handles Slack workspace installation flow
 * 
 * SECURITY:
 * - Uses state parameter for CSRF protection
 * - Tokens are encrypted before storage
 */

const axios = require('axios');
const crypto = require('crypto');
const { saveWorkspace } = require('../services/database');
const logger = require('../utils/logger');

// Store OAuth states temporarily (use Redis in production for multi-server)
const oauthStates = new Map();

// Clean up old states every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [state, data] of oauthStates) {
        if (now - data.created > 10 * 60 * 1000) { // 10 minutes
            oauthStates.delete(state);
        }
    }
}, 5 * 60 * 1000);

/**
 * Step 1: Initiate OAuth flow (Add to Slack button)
 */
function initiateOAuth(req, res) {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
        logger.error('Missing SLACK_CLIENT_ID or SLACK_REDIRECT_URI');
        return res.status(500).send('Server configuration error');
    }
    
    const scopes = [
        'chat:write',
        'chat:write.public',
        'commands',
        'users:read',
        'channels:read',
        'groups:read',
        'im:write',
        'app_mentions:read'
    ].join(',');
    
    // SECURITY: Generate random state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    oauthStates.set(state, { created: Date.now() });
    
    const authUrl = `https://slack.com/oauth/v2/authorize?` +
        `client_id=${clientId}&` +
        `scope=${scopes}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}`;
    
    res.redirect(authUrl);
}

/**
 * Step 2: Handle OAuth callback from Slack
 */
async function handleCallback(req, res) {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'https://deffatest.online';
    
    // Check for errors from Slack
    if (error) {
        logger.warn('OAuth denied:', error);
        return res.redirect(`${frontendUrl}/integrations/slack?error=${error}`);
    }
    
    // SECURITY: Verify state to prevent CSRF
    if (!state || !oauthStates.has(state)) {
        logger.warn('Invalid OAuth state');
        return res.redirect(`${frontendUrl}/integrations/slack?error=invalid_state`);
    }
    
    // Remove used state
    oauthStates.delete(state);
    
    try {
        // Exchange code for access token
        const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
            params: {
                client_id: process.env.SLACK_CLIENT_ID,
                client_secret: process.env.SLACK_CLIENT_SECRET,
                code: code,
                redirect_uri: process.env.SLACK_REDIRECT_URI
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        const data = response.data;
        
        if (!data.ok) {
            logger.error('OAuth token exchange failed:', data.error);
            return res.redirect(`${frontendUrl}/integrations/slack?error=${data.error}`);
        }
        
        // Save workspace (token is encrypted in database service)
        await saveWorkspace({
            team_id: data.team.id,
            team_name: data.team.name,
            bot_token: data.access_token,
            bot_id: data.bot_user_id,
            bot_user_id: data.bot_user_id,
            scope: data.scope
        });
        
        logger.info(`Workspace installed: ${data.team.name} (${data.team.id})`);
        
        // Redirect to success page
        res.redirect(`/slack/success?team=${encodeURIComponent(data.team.name)}`);
        
    } catch (error) {
        logger.error('OAuth callback error:', error.message);
        res.redirect(`${frontendUrl}/integrations/slack?error=exchange_failed`);
    }
}

/**
 * Step 3: Success page after installation
 */
function successPage(req, res) {
    const teamName = req.query.team || 'your workspace';
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Deffatest - Installation Complete</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #0066FF 0%, #00D4FF 100%);
            padding: 20px;
        }
        .container {
            background: white;
            padding: 50px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        .checkmark {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #1a1a1a;
            margin-bottom: 15px;
            font-size: 28px;
        }
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 25px;
        }
        .team-name {
            color: #0066FF;
            font-weight: 600;
        }
        .steps {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 12px;
            margin: 25px 0;
            text-align: left;
        }
        .steps h3 {
            margin-bottom: 15px;
            color: #333;
            font-size: 16px;
        }
        .steps ol {
            padding-left: 20px;
            color: #555;
        }
        .steps li {
            margin: 10px 0;
            line-height: 1.5;
        }
        code {
            background: #e9ecef;
            padding: 3px 8px;
            border-radius: 4px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 14px;
        }
        .btn {
            display: inline-block;
            background: #4A154B;
            color: white;
            padding: 14px 35px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: background 0.2s;
        }
        .btn:hover { background: #611f69; }
    </style>
</head>
<body>
    <div class="container">
        <div class="checkmark">✓</div>
        <h1>Installation Complete!</h1>
        <p>Deffatest has been added to <span class="team-name">${teamName}</span></p>
        
        <div class="steps">
            <h3>Get Started:</h3>
            <ol>
                <li>Go to any Slack channel</li>
                <li>Type <code>/deffatest help</code></li>
                <li>Link your Deffatest account when prompted</li>
                <li>Start testing with <code>/deffatest --url https://yourapp.com</code></li>
            </ol>
        </div>
        
        <a href="https://slack.com/app" class="btn">Open Slack</a>
    </div>
</body>
</html>
    `);
}

module.exports = {
    initiateOAuth,
    handleCallback,
    successPage
};
