/**
 * Slash Command Handlers
 * Handles /deffatest and /deffatest-status commands
 */

const DeffatestAPI = require('../services/deffatest-api');
const { getUserLink, saveTest } = require('../services/database');
const { 
    buildTestStartedBlock, 
    buildTestStatusBlock,
    buildHelpBlock, 
    buildAuthRequiredBlock, 
    buildErrorBlock 
} = require('../utils/blocks');
const logger = require('../utils/logger');

/**
 * Handle /deffatest command
 */
async function handleTestCommand(command, respond, client) {
    const { text, user_id, team_id, channel_id } = command;
    
    try {
        // Parse arguments
        const args = parseArgs(text);
        
        // Show help if requested or no URL
        if (args.help || (!args.url && !text.includes('--url'))) {
            await respond(buildHelpBlock());
            return;
        }
        
        // Validate URL
        if (!args.url) {
            await respond({
                text: 'Missing URL',
                blocks: buildErrorBlock('Please provide a URL with --url https://yourapp.com')
            });
            return;
        }
        
        // Validate URL format
        try {
            new URL(args.url);
        } catch {
            await respond({
                text: 'Invalid URL',
                blocks: buildErrorBlock('Please provide a valid URL (e.g., https://myapp.com)')
            });
            return;
        }
        
        // Check if user has linked their Deffatest account
        const userLink = await getUserLink(user_id, team_id);
        
        if (!userLink) {
            const linkUrl = `${process.env.FRONTEND_URL}/integrations/slack/connect?user_id=${user_id}&team_id=${team_id}`;
            await respond(buildAuthRequiredBlock(linkUrl));
            return;
        }
        
        // Show "submitting" message
        await respond({
            text: 'Submitting test...',
            blocks: [{
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '⏳ *Submitting test to Deffatest...*'
                }
            }]
        });
        
        // Submit test to Deffatest
        const api = new DeffatestAPI(userLink.api_key);
        const result = await api.submitWebTest({
            url: args.url,
            duration: args.duration || '2h',
            name: `Slack: ${args.url}`,
            metadata: {
                slack_team_id: team_id,
                slack_user_id: user_id,
                slack_channel_id: channel_id,
                source: 'slack'
            }
        });
        
        const testId = result.test_id;
        
        // Save test for notifications
        await saveTest({
            test_id: testId,
            slack_team_id: team_id,
            slack_user_id: user_id,
            slack_channel_id: channel_id,
            test_type: args.type || 'web',
            url: args.url,
            duration: args.duration || '2h'
        });
        
        // Update message with test details
        await respond({
            replace_original: true,
            text: 'Test started!',
            blocks: buildTestStartedBlock(testId, args.url, args.duration || '2h')
        });
        
        logger.info(`Test submitted: ${testId} by ${user_id}`);
        
    } catch (error) {
        logger.error('Test command error:', error.message);
        await respond({
            replace_original: true,
            text: 'Error',
            blocks: buildErrorBlock(error.message)
        });
    }
}

/**
 * Handle /deffatest-status command
 */
async function handleStatusCommand(command, respond, client) {
    const { text, user_id, team_id } = command;
    
    try {
        const testId = text.trim();
        
        if (!testId) {
            await respond({
                text: 'Missing test ID',
                blocks: [{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '❌ *Missing test ID*\n\nUsage: `/deffatest-status <test-id>`'
                    }
                }]
            });
            return;
        }
        
        // Get user link
        const userLink = await getUserLink(user_id, team_id);
        
        if (!userLink) {
            const linkUrl = `${process.env.FRONTEND_URL}/integrations/slack/connect?user_id=${user_id}&team_id=${team_id}`;
            await respond(buildAuthRequiredBlock(linkUrl));
            return;
        }
        
        // Fetch status
        const api = new DeffatestAPI(userLink.api_key);
        const status = await api.getTestStatus(testId);
        
        await respond({
            text: 'Test Status',
            blocks: buildTestStatusBlock(status)
        });
        
    } catch (error) {
        logger.error('Status command error:', error.message);
        await respond({
            text: 'Error',
            blocks: buildErrorBlock(error.message)
        });
    }
}

/**
 * Parse command arguments
 * Handles: --url https://example.com --duration 2h --type web
 */
function parseArgs(text) {
    const args = {};
    
    if (!text) return args;
    
    // Match --key value or --key "quoted value"
    const regex = /--(\w+)\s+(?:"([^"]+)"|(\S+))/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        const key = match[1];
        const value = match[2] || match[3];
        args[key] = value;
    }
    
    // Check for help
    if (text.includes('help') || text === 'help') {
        args.help = true;
    }
    
    return args;
}

module.exports = {
    handleTestCommand,
    handleStatusCommand
};
