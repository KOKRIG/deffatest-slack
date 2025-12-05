/**
 * Deffatest API Client
 * Handles communication with the Deffatest backend
 * 
 * SECURITY: API keys are passed at runtime, never stored in this file
 */

const axios = require('axios');
const logger = require('../utils/logger');

class DeffatestAPI {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('API key is required');
        }
        
        this.apiKey = apiKey;
        this.baseUrl = process.env.DEFFATEST_API_URL || 'https://api.deffatest.online';
        
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'deffatest-slack-bot/1.0.0'
            },
            timeout: 30000
        });
    }
    
    /**
     * Verify API key and get user info
     */
    async verifyApiKey() {
        try {
            const response = await this.client.get('/api/v1/api-keys/verify');
            return {
                valid: response.data.valid === true,
                user: response.data.user || response.data.data || {}
            };
        } catch (error) {
            logger.debug('API key verification failed:', error.message);
            return { valid: false, user: {} };
        }
    }
    
    /**
     * Submit a web test
     */
    async submitWebTest(params) {
        const { url, duration, name, metadata } = params;
        
        try {
            const response = await this.client.post('/api/tests/submit', {
                name: name || 'Slack Test',
                test_type: 'web',
                url: url,
                duration: this.parseDuration(duration || '2h'),
                source: 'slack',
                metadata: metadata || {}
            });
            
            return {
                test_id: response.data.test_id || response.data.data?.test_id,
                success: true
            };
        } catch (error) {
            logger.error('Test submission failed:', error.message);
            throw new Error(this.getErrorMessage(error));
        }
    }
    
    /**
     * Get test status
     */
    async getTestStatus(testId) {
        try {
            const response = await this.client.get(`/api/tests/${testId}/status`);
            const data = response.data.data || response.data;
            
            return {
                test_id: testId,
                status: data.status,
                progress: data.progress || 0,
                test_type: data.test_type || 'web',
                duration: data.duration,
                started_at: data.started_at,
                bugs: data.bugs || {
                    critical: 0,
                    high: 0,
                    medium: 0,
                    low: 0
                }
            };
        } catch (error) {
            logger.error('Failed to get test status:', error.message);
            throw new Error(this.getErrorMessage(error));
        }
    }
    
    /**
     * Parse duration string to minutes
     */
    parseDuration(duration) {
        const match = duration.match(/^(\d+)(m|h)$/);
        if (!match) return 120; // Default 2 hours
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        return unit === 'h' ? value * 60 : value;
    }
    
    /**
     * Extract error message from axios error
     */
    getErrorMessage(error) {
        if (error.response) {
            return error.response.data?.message || 
                   error.response.data?.detail || 
                   `API Error: ${error.response.status}`;
        }
        return error.message || 'Unknown error';
    }
}

module.exports = DeffatestAPI;
