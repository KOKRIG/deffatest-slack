/**
 * Event Handlers
 * Handles app mentions and direct messages
 */

const { buildHelpBlock } = require('../utils/blocks');
const logger = require('../utils/logger');

/**
 * Handle @deffatest mentions
 */
async function handleMention(event, client) {
    const { channel, user, text, team } = event;
    
    try {
        // Extract the message after the mention
        const message = text.replace(/<@[A-Z0-9]+>/g, '').trim().toLowerCase();
        
        // Respond based on message content
        if (message.includes('help') || message === '') {
            await client.chat.postMessage({
                channel: channel,
                text: 'Deffatest Help',
                ...buildHelpBlock()
            });
        } else if (message.includes('status')) {
            await client.chat.postMessage({
                channel: channel,
                text: 'Use `/deffatest-status <test-id>` to check test status.'
            });
        } else if (message.includes('test')) {
            await client.chat.postMessage({
                channel: channel,
                text: 'Use `/deffatest --url https://yourapp.com` to start a test.'
            });
        } else {
            await client.chat.postMessage({
                channel: channel,
                text: `Hi <@${user}>! Use \`/deffatest help\` to see available commands.`
            });
        }
        
    } catch (error) {
        logger.error('Mention handler error:', error.message);
    }
}

/**
 * Handle direct messages to the bot
 */
async function handleDirectMessage(event, client) {
    const { channel, user, text } = event;
    
    // Ignore bot messages
    if (event.bot_id) return;
    
    try {
        const message = text.toLowerCase().trim();
        
        if (message.includes('help')) {
            await client.chat.postMessage({
                channel: channel,
                text: 'Deffatest Help',
                ...buildHelpBlock()
            });
        } else if (message.includes('hello') || message.includes('hi')) {
            await client.chat.postMessage({
                channel: channel,
                text: `Hello! 👋 I'm Deffatest Bot. Use \`/deffatest --url https://yourapp.com\` in any channel to start a test.`
            });
        } else {
            await client.chat.postMessage({
                channel: channel,
                text: `I'm here to help with automated bug detection! 🔍\n\n*Quick Commands:*\n• \`/deffatest --url <url>\` - Start a test\n• \`/deffatest-status <id>\` - Check status\n• \`/deffatest help\` - See all options`
            });
        }
        
    } catch (error) {
        logger.error('DM handler error:', error.message);
    }
}

module.exports = {
    handleMention,
    handleDirectMessage
};
