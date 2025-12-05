-- ============================================
-- DEFFATEST SLACK BOT - DATABASE SCHEMA
-- ============================================
-- Run this on your PostgreSQL database before starting the bot
-- ============================================

-- Workspaces table (stores installed Slack workspaces)
CREATE TABLE IF NOT EXISTS slack_workspaces (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(255) UNIQUE NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    bot_token_encrypted TEXT NOT NULL,  -- SECURITY: Encrypted with AES-256-GCM
    bot_id VARCHAR(255),
    bot_user_id VARCHAR(255),
    scope TEXT,
    installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- User links table (maps Slack users to Deffatest accounts)
CREATE TABLE IF NOT EXISTS user_links (
    id SERIAL PRIMARY KEY,
    slack_team_id VARCHAR(255) NOT NULL,
    slack_user_id VARCHAR(255) NOT NULL,
    api_key_encrypted TEXT NOT NULL,  -- SECURITY: Encrypted with AES-256-GCM
    deffatest_email VARCHAR(255),
    deffatest_user_id VARCHAR(255),
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(slack_team_id, slack_user_id)
);

-- Tests table (tracks tests for notifications)
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

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_team ON slack_workspaces(team_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_active ON slack_workspaces(is_active);
CREATE INDEX IF NOT EXISTS idx_user_links_user ON user_links(slack_team_id, slack_user_id);
CREATE INDEX IF NOT EXISTS idx_user_links_active ON user_links(is_active);
CREATE INDEX IF NOT EXISTS idx_tests_test_id ON slack_tests(test_id);
CREATE INDEX IF NOT EXISTS idx_tests_channel ON slack_tests(slack_channel_id);
CREATE INDEX IF NOT EXISTS idx_tests_status ON slack_tests(status);

-- ============================================
-- SECURITY NOTES:
-- ============================================
-- 1. bot_token_encrypted and api_key_encrypted store AES-256-GCM encrypted data
-- 2. Format: iv:authTag:ciphertext (all hex encoded)
-- 3. The ENCRYPTION_KEY environment variable is required for decryption
-- 4. Never store unencrypted tokens in the database
-- 5. Rotate ENCRYPTION_KEY periodically (requires re-encrypting all data)
-- ============================================
