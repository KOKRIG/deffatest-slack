/**
 * Database Service
 * Handles PostgreSQL operations for Slack workspaces and user links
 * 
 * SECURITY: 
 * - All tokens are encrypted before storage
 * - API keys are encrypted with AES-256-GCM
 */

const { Pool } = require('pg');
const { encrypt, decrypt } = require('../utils/crypto');
const logger = require('../utils/logger');

// Connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});

// Handle pool errors
pool.on('error', (err) => {
    logger.error('Database pool error:', err.message);
});

// ============================================================================
// WORKSPACE FUNCTIONS
// ============================================================================

/**
 * Save or update workspace after OAuth
 * SECURITY: Bot token is encrypted before storage
 */
async function saveWorkspace(workspaceData) {
    const {
        team_id,
        team_name,
        bot_token,
        bot_id,
        bot_user_id,
        scope
    } = workspaceData;
    
    // SECURITY: Encrypt the bot token
    const encryptedToken = encrypt(bot_token);
    
    const query = `
        INSERT INTO slack_workspaces (
            team_id, team_name, bot_token_encrypted, bot_id, bot_user_id, scope
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (team_id) 
        DO UPDATE SET
            team_name = EXCLUDED.team_name,
            bot_token_encrypted = EXCLUDED.bot_token_encrypted,
            bot_id = EXCLUDED.bot_id,
            bot_user_id = EXCLUDED.bot_user_id,
            scope = EXCLUDED.scope,
            updated_at = CURRENT_TIMESTAMP,
            is_active = TRUE
        RETURNING id, team_id, team_name
    `;
    
    try {
        const result = await pool.query(query, [
            team_id, team_name, encryptedToken, bot_id, bot_user_id, scope
        ]);
        logger.info(`Workspace saved: ${team_name}`);
        return result.rows[0];
    } catch (error) {
        logger.error('Failed to save workspace:', error.message);
        throw error;
    }
}

/**
 * Get workspace token for Slack API calls
 * SECURITY: Decrypts token only when needed
 */
async function getWorkspaceToken(teamId) {
    const query = `
        SELECT team_id, bot_token_encrypted, bot_id, bot_user_id 
        FROM slack_workspaces 
        WHERE team_id = $1 AND is_active = TRUE
    `;
    
    try {
        const result = await pool.query(query, [teamId]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const row = result.rows[0];
        
        // SECURITY: Decrypt token for use
        return {
            team_id: row.team_id,
            bot_token: decrypt(row.bot_token_encrypted),
            bot_id: row.bot_id,
            bot_user_id: row.bot_user_id
        };
    } catch (error) {
        logger.error('Failed to get workspace token:', error.message);
        return null;
    }
}

// ============================================================================
// USER LINK FUNCTIONS
// ============================================================================

/**
 * Link Slack user to Deffatest account
 * SECURITY: API key is encrypted before storage
 */
async function linkUser(linkData) {
    const {
        slack_team_id,
        slack_user_id,
        deffatest_api_key,
        deffatest_email,
        deffatest_user_id
    } = linkData;
    
    // SECURITY: Encrypt the API key
    const encryptedApiKey = encrypt(deffatest_api_key);
    
    const query = `
        INSERT INTO user_links (
            slack_team_id, slack_user_id, api_key_encrypted, 
            deffatest_email, deffatest_user_id
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (slack_team_id, slack_user_id)
        DO UPDATE SET
            api_key_encrypted = EXCLUDED.api_key_encrypted,
            deffatest_email = EXCLUDED.deffatest_email,
            deffatest_user_id = EXCLUDED.deffatest_user_id,
            updated_at = CURRENT_TIMESTAMP,
            is_active = TRUE
        RETURNING id
    `;
    
    try {
        const result = await pool.query(query, [
            slack_team_id, slack_user_id, encryptedApiKey,
            deffatest_email, deffatest_user_id
        ]);
        logger.info(`User linked: ${slack_user_id}`);
        return result.rows[0];
    } catch (error) {
        logger.error('Failed to link user:', error.message);
        throw error;
    }
}

/**
 * Get user's Deffatest API key
 * SECURITY: Decrypts API key only when needed
 */
async function getUserLink(slackUserId, slackTeamId) {
    const query = `
        SELECT slack_user_id, api_key_encrypted, deffatest_email, deffatest_user_id
        FROM user_links 
        WHERE slack_user_id = $1 AND slack_team_id = $2 AND is_active = TRUE
    `;
    
    try {
        const result = await pool.query(query, [slackUserId, slackTeamId]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const row = result.rows[0];
        
        // SECURITY: Decrypt API key for use
        return {
            slack_user_id: row.slack_user_id,
            api_key: decrypt(row.api_key_encrypted),
            email: row.deffatest_email,
            user_id: row.deffatest_user_id
        };
    } catch (error) {
        logger.error('Failed to get user link:', error.message);
        return null;
    }
}

// ============================================================================
// TEST TRACKING FUNCTIONS
// ============================================================================

/**
 * Save test submission for notifications
 */
async function saveTest(testData) {
    const {
        test_id,
        slack_team_id,
        slack_user_id,
        slack_channel_id,
        test_type,
        url,
        duration
    } = testData;
    
    const query = `
        INSERT INTO slack_tests (
            test_id, slack_team_id, slack_user_id, slack_channel_id,
            test_type, url, duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (test_id) DO NOTHING
        RETURNING id
    `;
    
    try {
        const result = await pool.query(query, [
            test_id, slack_team_id, slack_user_id, slack_channel_id,
            test_type, url, duration
        ]);
        return result.rows[0];
    } catch (error) {
        logger.error('Failed to save test:', error.message);
        throw error;
    }
}

/**
 * Get test info for sending notifications
 */
async function getTestInfo(testId) {
    const query = `
        SELECT t.*, w.bot_token_encrypted
        FROM slack_tests t
        JOIN slack_workspaces w ON t.slack_team_id = w.team_id
        WHERE t.test_id = $1
    `;
    
    try {
        const result = await pool.query(query, [testId]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const row = result.rows[0];
        
        return {
            test_id: row.test_id,
            slack_team_id: row.slack_team_id,
            slack_user_id: row.slack_user_id,
            slack_channel_id: row.slack_channel_id,
            test_type: row.test_type,
            url: row.url,
            duration: row.duration,
            bot_token: decrypt(row.bot_token_encrypted)
        };
    } catch (error) {
        logger.error('Failed to get test info:', error.message);
        return null;
    }
}

/**
 * Update test status
 */
async function updateTestStatus(testId, status, bugs) {
    const query = `
        UPDATE slack_tests SET
            status = $1,
            bugs_critical = $2,
            bugs_high = $3,
            bugs_medium = $4,
            bugs_low = $5,
            completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE test_id = $6
    `;
    
    try {
        await pool.query(query, [
            status,
            bugs?.critical || 0,
            bugs?.high || 0,
            bugs?.medium || 0,
            bugs?.low || 0,
            testId
        ]);
    } catch (error) {
        logger.error('Failed to update test status:', error.message);
    }
}

// ============================================================================
// INITIALIZE DATABASE
// ============================================================================

/**
 * Create tables if they don't exist
 */
async function initializeDatabase() {
    const createTablesQuery = `
        -- Workspaces table
        CREATE TABLE IF NOT EXISTS slack_workspaces (
            id SERIAL PRIMARY KEY,
            team_id VARCHAR(255) UNIQUE NOT NULL,
            team_name VARCHAR(255) NOT NULL,
            bot_token_encrypted TEXT NOT NULL,
            bot_id VARCHAR(255),
            bot_user_id VARCHAR(255),
            scope TEXT,
            installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE
        );
        
        -- User links table
        CREATE TABLE IF NOT EXISTS user_links (
            id SERIAL PRIMARY KEY,
            slack_team_id VARCHAR(255) NOT NULL,
            slack_user_id VARCHAR(255) NOT NULL,
            api_key_encrypted TEXT NOT NULL,
            deffatest_email VARCHAR(255),
            deffatest_user_id VARCHAR(255),
            linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            UNIQUE(slack_team_id, slack_user_id)
        );
        
        -- Tests table (for tracking notifications)
        CREATE TABLE IF NOT EXISTS slack_tests (
            id SERIAL PRIMARY KEY,
            test_id VARCHAR(255) UNIQUE NOT NULL,
            slack_team_id VARCHAR(255) NOT NULL,
            slack_user_id VARCHAR(255) NOT NULL,
            slack_channel_id VARCHAR(255) NOT NULL,
            test_type VARCHAR(50),
            url TEXT,
            duration VARCHAR(50),
            status VARCHAR(50) DEFAULT 'running',
            bugs_critical INTEGER DEFAULT 0,
            bugs_high INTEGER DEFAULT 0,
            bugs_medium INTEGER DEFAULT 0,
            bugs_low INTEGER DEFAULT 0,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        );
        
        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_workspaces_team ON slack_workspaces(team_id);
        CREATE INDEX IF NOT EXISTS idx_user_links_user ON user_links(slack_team_id, slack_user_id);
        CREATE INDEX IF NOT EXISTS idx_tests_test_id ON slack_tests(test_id);
    `;
    
    try {
        await pool.query(createTablesQuery);
        logger.info('Database tables initialized');
    } catch (error) {
        logger.error('Failed to initialize database:', error.message);
        throw error;
    }
}

module.exports = {
    pool,
    initializeDatabase,
    saveWorkspace,
    getWorkspaceToken,
    linkUser,
    getUserLink,
    saveTest,
    getTestInfo,
    updateTestStatus
};
