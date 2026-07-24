-- Migration: daily wage records (hours × hourly_rate on EXIT)
CREATE TABLE IF NOT EXISTS daily_wage (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL,
    work_date DATE NOT NULL,
    hours_worked DECIMAL(8, 2) NOT NULL,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    wage_amount DECIMAL(12, 2) NOT NULL,
    entry_time TIMESTAMP,
    exit_time TIMESTAMP,
    break_duration_ms BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES worker(id) ON DELETE CASCADE,
    UNIQUE (worker_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_wage_date ON daily_wage(work_date);
CREATE INDEX IF NOT EXISTS idx_daily_wage_worker ON daily_wage(worker_id);
