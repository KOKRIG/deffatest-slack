/**
 * Authentication Middleware
 * 
 * SECURITY:
 * - Verifies webhook signatures from Deffatest backend
 * - Prevents unauthorized requests
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Verify Deffatest webhook signature
 * SECURITY: Ensures webhooks actually came from Deffatest backend
 */
function verifyDeffatestWebhook(req, res, next) {
    const signature = req.headers['x-deffatest-signature'];
    const timestamp = req.headers['x-deffatest-timestamp'];
    
    // Check if headers exist
    if (!signature || !timestamp) {
        logger.warn('Webhook missing signature headers');
        return res.status(401).json({ error: 'Missing signature' });
    }
    
    // Check timestamp to prevent replay attacks (5 minute window)
    const timestampMs = parseInt(timestamp);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (isNaN(timestampMs) || Math.abs(now - timestampMs) > fiveMinutes) {
        logger.warn('Webhook timestamp too old or invalid');
        return res.status(401).json({ error: 'Invalid timestamp' });
    }
    
    // Verify signature
    const webhookSecret = process.env.DEFFATEST_WEBHOOK_SECRET;
    if (!webhookSecret) {
        logger.error('DEFFATEST_WEBHOOK_SECRET not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }
    
    // Create expected signature: HMAC-SHA256(timestamp + body)
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${timestamp}${body}`)
        .digest('hex');
    
    // Timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    if (signatureBuffer.length !== expectedBuffer.length) {
        logger.warn('Webhook signature length mismatch');
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        logger.warn('Webhook signature verification failed');
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Signature valid, proceed
    next();
}

/**
 * Rate limiting helper
 * SECURITY: Prevents abuse of endpoints
 */
const rateLimitMap = new Map();

function rateLimit(maxRequests = 100, windowMs = 60000) {
    return (req, res, next) => {
        const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const now = Date.now();
        
        // Get or create entry
        let entry = rateLimitMap.get(key);
        if (!entry || now - entry.windowStart > windowMs) {
            entry = { count: 0, windowStart: now };
        }
        
        entry.count++;
        rateLimitMap.set(key, entry);
        
        // Clean up old entries periodically
        if (rateLimitMap.size > 10000) {
            for (const [k, v] of rateLimitMap) {
                if (now - v.windowStart > windowMs) {
                    rateLimitMap.delete(k);
                }
            }
        }
        
        if (entry.count > maxRequests) {
            logger.warn(`Rate limit exceeded for ${key}`);
            return res.status(429).json({ error: 'Too many requests' });
        }
        
        next();
    };
}

module.exports = {
    verifyDeffatestWebhook,
    rateLimit
};
