/**
 * Webhook Controller
 * Handles incoming webhooks from Deffatest backend
 * 
 * SECURITY: All webhooks are verified by middleware before reaching here
 */

const { getTestInfo, updateTestStatus } = require('../services/database');
const { buildTestCompletedBlock, buildBugAlertBlock } = require('../utils/blocks');
const logger = require('../utils/logger');

/**
 * Main webhook handler
 */
async function handleWebhook(body, slackClient) {
    const { event, data } = body;
    
    logger.info(`Webhook received: ${event}`);
    
    switch (event) {
        case 'test.completed':
            await handleTestCompleted(data, slackClient);
            break;
            
        case 'test.failed':
            await handleTestFailed(data, slackClient);
            break;
            
        case 'bugs.found':
            await handleBugsFound(data, slackClient);
            break;
            
        case 'test.progress':
            // Optional: Update progress (usually not needed as too frequent)
            break;
            
        default:
            logger.debug('Unknown webhook event:', event);
    }
}

/**
 * Handle test completion
 */
async function handleTestCompleted(data, slackClient) {
    const { test_id, bugs, report_url, duration } = data;
    
    // Get test info from database
    const testInfo = await getTestInfo(test_id);
    
    if (!testInfo) {
        logger.warn(`Test not found in database: ${test_id}`);
        return;
    }
    
    // Update test status in database
    await updateTestStatus(test_id, 'completed', bugs);
    
    // Build completion message
    const blocks = buildTestCompletedBlock({
        test_id,
        bugs: bugs || { critical: 0, high: 0, medium: 0, low: 0 },
        report_url: report_url || `https://deffatest.online/dashboard/test/${test_id}`,
        duration: duration || testInfo.duration,
        url: testInfo.url
    });
    
    try {
        // Send to the channel where test was started
        await slackClient.chat.postMessage({
            token: testInfo.bot_token,
            channel: testInfo.slack_channel_id,
            text: 'Test completed!',
            blocks
        });
        
        // Also DM the user who started the test
        await slackClient.chat.postMessage({
            token: testInfo.bot_token,
            channel: testInfo.slack_user_id,
            text: 'Your Deffatest test has completed!',
            blocks
        });
        
        logger.info(`Completion notification sent for test ${test_id}`);
        
    } catch (error) {
        logger.error('Failed to send completion notification:', error.message);
    }
}

/**
 * Handle test failure
 */
async function handleTestFailed(data, slackClient) {
    const { test_id, error: errorMessage } = data;
    
    const testInfo = await getTestInfo(test_id);
    
    if (!testInfo) {
        logger.warn(`Test not found: ${test_id}`);
        return;
    }
    
    // Update status
    await updateTestStatus(test_id, 'failed', null);
    
    try {
        await slackClient.chat.postMessage({
            token: testInfo.bot_token,
            channel: testInfo.slack_channel_id,
            text: 'Test failed',
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `❌ *Test Failed*\n\nTest ID: \`${test_id}\`\n\n${errorMessage || 'Unknown error occurred'}`
                    }
                },
                {
                    type: 'actions',
                    elements: [
                        {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: 'View Details'
                            },
                            url: `https://deffatest.online/dashboard/test/${test_id}`
                        }
                    ]
                }
            ]
        });
        
    } catch (error) {
        logger.error('Failed to send failure notification:', error.message);
    }
}

/**
 * Handle bugs found during test
 */
async function handleBugsFound(data, slackClient) {
    const { test_id, critical, high } = data;
    
    // Only notify for critical or high severity bugs
    if (!critical && !high) return;
    
    const testInfo = await getTestInfo(test_id);
    
    if (!testInfo) return;
    
    try {
        await slackClient.chat.postMessage({
            token: testInfo.bot_token,
            channel: testInfo.slack_channel_id,
            text: `Bug alert for test ${test_id}`,
            blocks: buildBugAlertBlock(test_id, critical || 0, high || 0)
        });
        
    } catch (error) {
        logger.error('Failed to send bug alert:', error.message);
    }
}

module.exports = {
    handleWebhook
};
