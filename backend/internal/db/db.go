package db

import (
	"database/sql"
	"log"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func Init(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return err
	}

	if err = DB.Ping(); err != nil {
		return err
	}

	if err = runMigrations(); err != nil {
		return err
	}

	log.Println("✅ Database initialized:", dbPath)
	return nil
}

func runMigrations() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS athletes (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			ftp INTEGER DEFAULT 200,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS workouts (
			id TEXT PRIMARY KEY,
			athlete_id TEXT REFERENCES athletes(id),
			title TEXT,
			sport_type TEXT DEFAULT 'cycling',
			start_time TIMESTAMP NOT NULL,
			duration_secs INTEGER,
			distance_meters REAL,
			elevation_gain_meters REAL,
			normalized_power INTEGER,
			avg_power INTEGER,
			max_power INTEGER,
			intensity_factor REAL,
			tss INTEGER,
			ftp_at_time INTEGER,
			avg_hr INTEGER,
			max_hr INTEGER,
			time_in_zones_json TEXT,
			garmin_connect_url TEXT,
			raw_fit_file_path TEXT,
			synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(athlete_id, id)
		)`,

		// Add columns if missing (existing DBs) — wrapped in procedural migration
		`ALTER TABLE workouts ADD COLUMN strava_url TEXT`,
		`ALTER TABLE workouts ADD COLUMN source TEXT`,
		`ALTER TABLE workouts ADD COLUMN best_30s INTEGER DEFAULT 0`,
		`ALTER TABLE workouts ADD COLUMN best_5min INTEGER DEFAULT 0`,
		`ALTER TABLE workouts ADD COLUMN best_20min INTEGER DEFAULT 0`,

		`CREATE TABLE IF NOT EXISTS daily_load (
			date DATE,
			athlete_id TEXT REFERENCES athletes(id),
			ctl REAL,
			atl REAL,
			tsb REAL,
			tss INTEGER,
			training_status TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (date, athlete_id)
		)`,

		`CREATE TABLE IF NOT EXISTS sync_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			athlete_id TEXT REFERENCES athletes(id),
			started_at TIMESTAMP,
			finished_at TIMESTAMP,
			workouts_fetched INTEGER DEFAULT 0,
			workouts_new INTEGER DEFAULT 0,
			status TEXT,
			error TEXT
		)`,

		`CREATE TABLE IF NOT EXISTS strava_tokens (
			athlete_id TEXT PRIMARY KEY,
			access_token TEXT,
			refresh_token TEXT,
			expires_at INTEGER,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`INSERT OR IGNORE INTO athletes (id, name, ftp) VALUES ('charly', 'Charly', 220)`,
	}

	for _, m := range migrations {
		if _, err := DB.Exec(m); err != nil {
			// Ignore "duplicate column name" and "table already exists" errors
			// These happen when migrations run on an already-migrated DB
			if !isMigrationHARDlessError(err) {
				log.Printf("Migration warning: %v | Query: %.80s", err, m)
			}
		}
	}

	return nil
}

// isMigrationHARDlessError returns true for SQLite "already exists" errors
// that are safe to ignore during migrations.
func isMigrationHARDlessError(err error) bool {
	if err == nil {
		return true
	}
	msg := err.Error()
	return strings.Contains(msg, "duplicate column name") ||
		strings.Contains(msg, "table already exists") ||
		strings.Contains(msg, "UNIQUE constraint failed") // harmless on INSERT OR IGNORE
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}
