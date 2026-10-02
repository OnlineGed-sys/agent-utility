CREATE TABLE IF NOT EXISTS request_events (
 request_id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, http_status INTEGER NOT NULL,
 paid INTEGER NOT NULL CHECK(paid IN (0,1)), client_hash TEXT,
 client_cohort TEXT NOT NULL, discovery_channel TEXT NOT NULL,
 amount_atomic TEXT NOT NULL, event TEXT NOT NULL CHECK(json_valid(event))
);
CREATE INDEX IF NOT EXISTS events_time ON request_events(timestamp);
CREATE INDEX IF NOT EXISTS events_paid_client ON request_events(paid,client_hash);
