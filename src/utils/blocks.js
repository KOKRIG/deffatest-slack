/**
 * Slack Block Kit Message Builders
 * Creates formatted messages for Slack
 */

/**
 * Build test started message
 */
function buildTestStartedBlock(testId, url, duration) {
    return [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: '✅ Test Started',
                emoji: true
            }
        },
        {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*Test ID:*\n\`${testId}\``
                },
                {
                    type: 'mrkdwn',
                    text: `*Duration:*\n${duration || '2h'}`
                },
                {
                    type: 'mrkdwn',
                    text: `*URL:*\n${url}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Status:*\n🟡 Running`
                }
            ]
        },
        {
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: "You'll receive a notification when the test completes"
                }
            ]
        },
        {
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'View Progress',
                        emoji: true
                    },
                    url: `https://deffatest.online/dashboard/test/${testId}`,
                    style: 'primary'
                },
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'Check Status',
                        emoji: true
                    },
                    action_id: `button_status_${testId}`,
                    value: testId
                }
            ]
        }
    ];
}

/**
 * Build test completed message
 */
function buildTestCompletedBlock(data) {
    const { test_id, bugs, report_url, duration, url } = data;
    const total = (bugs?.critical || 0) + (bugs?.high || 0) + (bugs?.medium || 0) + (bugs?.low || 0);
    
    let emoji = '✅';
    let statusText = 'No critical issues found';
    
    if (bugs?.critical > 0) {
        emoji = '🔴';
        statusText = `${bugs.critical} critical bug(s) found!`;
    } else if (bugs?.high > 0) {
        emoji = '🟠';
        statusText = `${bugs.high} high priority bug(s) found`;
    } else if (total > 0) {
        emoji = '🟡';
        statusText = `${total} minor issue(s) found`;
    }
    
    return [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `${emoji} Test Completed`,
                emoji: true
            }
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${statusText}*`
            }
        },
        {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*Test ID:*\n\`${test_id}\``
                },
                {
                    type: 'mrkdwn',
                    text: `*Duration:*\n${duration || 'N/A'}`
                }
            ]
        },
        {
            type: 'divider'
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '*Bug Summary:*'
            },
            fields: [
                { type: 'mrkdwn', text: `🔴 *Critical:* ${bugs?.critical || 0}` },
                { type: 'mrkdwn', text: `🟠 *High:* ${bugs?.high || 0}` },
                { type: 'mrkdwn', text: `🟡 *Medium:* ${bugs?.medium || 0}` },
                { type: 'mrkdwn', text: `🟢 *Low:* ${bugs?.low || 0}` }
            ]
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Total:* ${total} bugs`
            }
        },
        {
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'View Full Report',
                        emoji: true
                    },
                    url: report_url || `https://deffatest.online/dashboard/test/${test_id}`,
                    style: 'primary'
                }
            ]
        }
    ];
}

/**
 * Build test status message
 */
function buildTestStatusBlock(status) {
    const statusEmoji = {
        'queued': '⏸️',
        'running': '⏳',
        'completed': '✅',
        'failed': '❌'
    };
    
    const blocks = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `${statusEmoji[status.status] || '❓'} Test Status`,
                emoji: true
            }
        },
        {
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Test ID:*\n\`${status.test_id}\`` },
                { type: 'mrkdwn', text: `*Status:*\n${status.status}` },
                { type: 'mrkdwn', text: `*Progress:*\n${status.progress || 0}%` },
                { type: 'mrkdwn', text: `*Type:*\n${status.test_type || 'web'}` }
            ]
        }
    ];
    
    if (status.status === 'completed' && status.bugs) {
        blocks.push(
            { type: 'divider' },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: '*Bugs Found:*' },
                fields: [
                    { type: 'mrkdwn', text: `🔴 Critical: ${status.bugs.critical || 0}` },
                    { type: 'mrkdwn', text: `🟠 High: ${status.bugs.high || 0}` },
                    { type: 'mrkdwn', text: `🟡 Medium: ${status.bugs.medium || 0}` },
                    { type: 'mrkdwn', text: `🟢 Low: ${status.bugs.low || 0}` }
                ]
            }
        );
    }
    
    return blocks;
}

/**
 * Build help message
 */
function buildHelpBlock() {
    return {
        text: 'Deffatest Help',
        blocks: [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: '🤖 Deffatest Commands',
                    emoji: true
                }
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '*Start a test:*\n`/deffatest --url https://myapp.com --duration 2h`'
                }
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '*Check status:*\n`/deffatest-status <test-id>`'
                }
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '*Options:*\n• `--url` - Application URL (required)\n• `--duration` - Test duration (30m, 1h, 2h, 6h, 12h)\n• `--type` - Test type (web, mobile, game)'
                }
            },
            {
                type: 'divider'
            },
            {
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: 'Need help? Contact support@deffatest.online'
                    }
                ]
            }
        ]
    };
}

/**
 * Build auth required message
 */
function buildAuthRequiredBlock(linkUrl) {
    return {
        text: 'Authentication required',
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '🔐 *Authentication Required*\n\nLink your Deffatest account to use this command.'
                }
            },
            {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: 'Connect Deffatest Account',
                            emoji: true
                        },
                        url: linkUrl,
                        style: 'primary'
                    }
                ]
            }
        ]
    };
}

/**
 * Build error message
 */
function buildErrorBlock(message) {
    return [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `❌ *Error*\n\n${message}`
            }
        }
    ];
}

/**
 * Build bug alert message
 */
function buildBugAlertBlock(testId, criticalCount, highCount) {
    const emoji = criticalCount > 0 ? '🔴' : '🟠';
    const severity = criticalCount > 0 ? 'critical' : 'high priority';
    const count = criticalCount || highCount;
    
    return [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `${emoji} *Alert: ${count} ${severity} bug(s) detected*\n\nTest ID: \`${testId}\``
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
                    url: `https://deffatest.online/dashboard/test/${testId}`,
                    style: 'danger'
                }
            ]
        }
    ];
}

module.exports = {
    buildTestStartedBlock,
    buildTestCompletedBlock,
    buildTestStatusBlock,
    buildHelpBlock,
    buildAuthRequiredBlock,
    buildErrorBlock,
    buildBugAlertBlock
};
