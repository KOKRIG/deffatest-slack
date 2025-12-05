/**
 * Interaction Handlers
 * Handles button clicks, select menus, and modal submissions
 */

const DeffatestAPI = require('../services/deffatest-api');
const { getUserLink } = require('../services/database');
const { buildTestStatusBlock, buildErrorBlock } = require('../utils/blocks');
const logger = require('../utils/logger');

/**
 * Handle button clicks
 */
async function handleButtonClick(action, body, client) {
    const actionId = action.action_id;
    const userId = body.user.id;
    const teamId = body.team.id;
    const channelId = body.channel?.id;
    
    try {
        // Status button: button_status_<test-id>
        if (actionId.startsWith('button_status_')) {
            const testId = action.value;
            
            const userLink = await getUserLink(userId, teamId);
            if (!userLink) {
                await client.chat.postEphemeral({
                    channel: channelId,
                    user: userId,
                    text: 'Please link your Deffatest account first.'
                });
                return;
            }
            
            const api = new DeffatestAPI(userLink.api_key);
            const status = await api.getTestStatus(testId);
            
            await client.chat.postEphemeral({
                channel: channelId,
                user: userId,
                text: 'Test Status',
                blocks: buildTestStatusBlock(status)
            });
        }
        
        // Download button: button_download_<test-id>
        else if (actionId.startsWith('button_download_')) {
            const testId = action.value;
            
            await client.chat.postEphemeral({
                channel: channelId,
                user: userId,
                text: `📥 Download your report at: https://deffatest.online/dashboard/test/${testId}`
            });
        }
        
    } catch (error) {
        logger.error('Button click error:', error.message);
        
        if (channelId && userId) {
            await client.chat.postEphemeral({
                channel: channelId,
                user: userId,
                text: `Error: ${error.message}`
            });
        }
    }
}

/**
 * Handle select menu changes
 */
async function handleSelectMenu(action, body, client) {
    // Placeholder for future select menu interactions
    logger.debug('Select menu interaction:', action.action_id);
}

/**
 * Handle modal/view submissions
 */
async function handleViewSubmission(body, view, client) {
    // Placeholder for future modal submissions
    logger.debug('View submission:', view.callback_id);
}

module.exports = {
    handleButtonClick,
    handleSelectMenu,
    handleViewSubmission
};
