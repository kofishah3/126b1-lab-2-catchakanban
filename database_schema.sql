-- Create database
CREATE DATABASE auth_db;
\c auth_db

-- =========================
-- USERS TABLE (existing)
-- =========================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- BOARDS TABLE (per user)
-- =========================
CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================
-- TASKS TABLE (per board)
-- =========================
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    title TEXT NOT NULL,
    column_id VARCHAR(50),  -- todo, doing, done
    priority VARCHAR(20),   -- Low, Medium, High
    deadline TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_board
        FOREIGN KEY(board_id)
        REFERENCES boards(id)
        ON DELETE CASCADE
);

-- =========================
-- INDEXES (performance)
-- =========================

-- Quickly get all boards of a user
CREATE INDEX IF NOT EXISTS idx_boards_user_id
ON boards(user_id);

-- Quickly get tasks per board
CREATE INDEX IF NOT EXISTS idx_tasks_board_id
ON tasks(board_id);