/**
 * Logger Utility
 * Secure logging - never log sensitive data
 */

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

const currentLevel = process.env.NODE_ENV === 'production' 
    ? LOG_LEVELS.INFO 
    : LOG_LEVELS.DEBUG;

function formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    return { prefix, message, args };
}

// SECURITY: Sanitize any potentially sensitive data from logs
function sanitize(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sensitiveKeys = [
        'token', 'api_key', 'apiKey', 'password', 'secret',
        'bot_token', 'access_token', 'authorization', 'credential'
    ];
    
    const sanitized = { ...obj };
    for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object') {
            sanitized[key] = sanitize(sanitized[key]);
        }
    }
    return sanitized;
}

module.exports = {
    error: (message, ...args) => {
        if (currentLevel >= LOG_LEVELS.ERROR) {
            console.error(`[${new Date().toISOString()}] [ERROR]`, message, ...args.map(sanitize));
        }
    },
    
    warn: (message, ...args) => {
        if (currentLevel >= LOG_LEVELS.WARN) {
            console.warn(`[${new Date().toISOString()}] [WARN]`, message, ...args.map(sanitize));
        }
    },
    
    info: (message, ...args) => {
        if (currentLevel >= LOG_LEVELS.INFO) {
            console.log(`[${new Date().toISOString()}] [INFO]`, message, ...args.map(sanitize));
        }
    },
    
    debug: (message, ...args) => {
        if (currentLevel >= LOG_LEVELS.DEBUG) {
            console.log(`[${new Date().toISOString()}] [DEBUG]`, message, ...args.map(sanitize));
        }
    }
};
