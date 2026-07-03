package db

import (
	"cycling-peaks/backend/internal/models"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"time"
)

func GetAthlete(id string) (*models.Athlete, error) {
	row := DB.QueryRow("SELECT id, name, ftp, created_at FROM athletes WHERE id = ?", id)
	a := &models.Athlete{}
	var createdAt string
	err := row.Scan(&a.ID, &a.Name, &a.FTP, &createdAt)
	if err != nil {
		return nil, err
	}
	a.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
	return a, nil
}

func UpdateAthleteFTP(id string, ftp int) error {
	_, err := DB.Exec("UPDATE athletes SET ftp = ? WHERE id = ?", ftp, id)
	return err
}

func GetWorkouts(athleteID string, limit, offset int) ([]models.Workout, int, error) {
	var total int
	err := DB.QueryRow("SELECT COUNT(*) FROM workouts WHERE athlete_id = ?", athleteID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	rows, err := DB.Query(`
		SELECT id, athlete_id, title, sport_type, start_time, duration_secs,
			   distance_meters, elevation_gain_meters, normalized_power, avg_power,
			   max_power, intensity_factor, tss, ftp_at_time, avg_hr, max_hr,
			   time_in_zones_json, garmin_connect_url, synced_at
		FROM workouts
		WHERE athlete_id = ?
		ORDER BY start_time DESC
		LIMIT ? OFFSET ?`, athleteID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var workouts []models.Workout
	for rows.Next() {
		var w models.Workout
		var duration, avgPower, maxPower, tss, ftpAtTime, avgHR, maxHR, np sql.NullInt64
		var intensityFactor sql.NullFloat64
		var distance, elevation sql.NullFloat64
		var zones, url sql.NullString

		err := rows.Scan(&w.ID, &w.AthleteID, &w.Title, &w.SportType, &w.StartTime,
			&duration, &distance, &elevation, &np, &avgPower, &maxPower,
			&intensityFactor, &tss, &ftpAtTime, &avgHR, &maxHR,
			&zones, &url, &w.SyncedAt)
		if err != nil {
			continue
		}

		w.DurationSecs = int(duration.Int64)
		w.DistanceMeters = distance.Float64
		w.ElevationGainMeters = elevation.Float64
		w.NormalizedPower = int(np.Int64)
		w.AvgPower = int(avgPower.Int64)
		w.MaxPower = int(maxPower.Int64)
		w.IntensityFactor = intensityFactor.Float64
		w.TSS = int(tss.Int64)
		w.FTPAtTime = int(ftpAtTime.Int64)
		w.AvgHR = int(avgHR.Int64)
		w.MaxHR = int(maxHR.Int64)
		w.TimeInZonesJSON = zones.String
		w.GarminConnectURL = url.String

		workouts = append(workouts, w)
	}

	return workouts, total, nil
}

func GetLoadToday(athleteID string) (*models.LoadToday, error) {
	today := time.Now().Format("2006-01-02")
	row := DB.QueryRow(`
		SELECT date, ctl, atl, tsb, tss, training_status
		FROM daily_load WHERE athlete_id = ? AND date = ?`, athleteID, today)

	dl := &models.LoadToday{Date: today}
	err := row.Scan(&dl.Date, &dl.CTL, &dl.ATL, &dl.TSB, &dl.TSSToday, &dl.Status)
	if err == sql.ErrNoRows {
		// No data for today, return empty
		dl.CTL = 0
		dl.ATL = 0
		dl.TSB = 0
		dl.TSSToday = 0
		dl.Status = "no_data"
		dl.Trend = "unknown"
		return dl, nil
	}
	if err != nil {
		return nil, err
	}

	// Determine trend by comparing with yesterday
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	var prevCTL float64
	row2 := DB.QueryRow("SELECT ctl FROM daily_load WHERE athlete_id = ? AND date = ?", athleteID, yesterday)
	row2.Scan(&prevCTL)

	if dl.CTL > prevCTL+1 {
		dl.Trend = "improving"
	} else if dl.CTL < prevCTL-1 {
		dl.Trend = "declining"
	} else {
		dl.Trend = "stable"
	}

	return dl, nil
}

func GetLoadHistory(athleteID string, days int) ([]models.DailyLoad, error) {
	rows, err := DB.Query(`
		SELECT date, ctl, atl, tsb, tss, training_status
		FROM daily_load
		WHERE athlete_id = ?
		ORDER BY date DESC
		LIMIT ?`, athleteID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var loads []models.DailyLoad
	for rows.Next() {
		var dl models.DailyLoad
		if err := rows.Scan(&dl.Date, &dl.CTL, &dl.ATL, &dl.TSB, &dl.TSS, &dl.TrainingStatus); err != nil {
			continue
		}
		loads = append(loads, dl)
	}
	return loads, nil
}

func GetDashboardSummary(athleteID string) (*models.DashboardSummary, error) {
	loadToday, err := GetLoadToday(athleteID)
	if err != nil {
		return nil, err
	}

	// This week stats
	weekStart := time.Now().AddDate(0, 0, -int(time.Now().Weekday()))
	thisWeek := getWeekMonthStats(athleteID, weekStart)

	// This month stats
	monthStart := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.UTC)
	thisMonth := getWeekMonthStats(athleteID, monthStart)

	// Last workout
	lastW := getLastWorkout(athleteID)

	return &models.DashboardSummary{
		CTL:        loadToday.CTL,
		ATL:        loadToday.ATL,
		TSB:        loadToday.TSB,
		Status:     loadToday.Status,
		ThisWeek:   thisWeek,
		ThisMonth:  thisMonth,
		LastWorkout: lastW,
	}, nil
}

func getWeekMonthStats(athleteID string, since time.Time) models.WeekMonthStats {
	sinceStr := since.Format("2006-01-02")
	var stats models.WeekMonthStats

	row := DB.QueryRow(`
		SELECT COALESCE(SUM(tss), 0), COUNT(*), COALESCE(SUM(duration_secs), 0)
		FROM workouts WHERE athlete_id = ? AND date(start_time) >= ?`, athleteID, sinceStr)
	row.Scan(&stats.TSS, &stats.Workouts, &stats.Hours)
	stats.Hours = float64(stats.Hours) / 3600.0

	return stats
}

func getLastWorkout(athleteID string) *models.LastWorkout {
	row := DB.QueryRow(`
		SELECT title, tss, start_time FROM workouts
		WHERE athlete_id = ? ORDER BY start_time DESC LIMIT 1`, athleteID)

	var title, date string
	var tss int
	err := row.Scan(&title, &tss, &date)
	if err != nil {
		return nil
	}
	parsed, _ := time.Parse("2006-01-02 15:04:05", date)
	return &models.LastWorkout{
		Title: title,
		TSS:   tss,
		Date:  parsed.Format("2006-01-02"),
	}
}

func GetSyncStatus(athleteID string) (*models.SyncStatus, error) {
	var status models.SyncStatus

	row := DB.QueryRow(`
		SELECT status, finished_at FROM sync_log
		WHERE athlete_id = ? ORDER BY finished_at DESC LIMIT 1`, athleteID)

	var finishedAt sql.NullString
	err := row.Scan(&status.Status, &finishedAt)
	if err == sql.ErrNoRows {
		status.Status = "never_run"
		status.LastSync = "never"
	} else if err != nil {
		return nil, err
	} else {
		if finishedAt.Valid {
			status.LastSync = finishedAt.String
		}
	}

	var count int
	DB.QueryRow("SELECT COUNT(*) FROM workouts WHERE athlete_id = ?", athleteID).Scan(&count)
	status.WorkoutsCount = count

	return &status, nil
}

func UpsertWorkout(w *models.Workout) error {
	zonesJSON, _ := json.Marshal(map[string]int{"z1": 0, "z2": 0, "z3": 0, "z4": 0, "z5": 0})
	if w.TimeInZonesJSON != "" {
		zonesJSON = []byte(w.TimeInZonesJSON)
	}

	_, err := DB.Exec(`
		INSERT OR REPLACE INTO workouts
		(id, athlete_id, title, sport_type, start_time, duration_secs,
		 distance_meters, elevation_gain_meters, normalized_power, avg_power,
		 max_power, intensity_factor, tss, ftp_at_time, avg_hr, max_hr,
		 time_in_zones_json, garmin_connect_url, synced_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		w.ID, w.AthleteID, w.Title, w.SportType, w.StartTime, w.DurationSecs,
		w.DistanceMeters, w.ElevationGainMeters, w.NormalizedPower, w.AvgPower,
		w.MaxPower, w.IntensityFactor, w.TSS, w.FTPAtTime, w.AvgHR, w.MaxHR,
		string(zonesJSON), w.GarminConnectURL)

	return err
}

func UpdateDailyLoad(dateStr, athleteID string, ctl, atl, tsb float64, tss int) error {
	status := getTrainingStatus(tsb)
	_, err := DB.Exec(`
		INSERT OR REPLACE INTO daily_load (date, athlete_id, ctl, atl, tsb, tss, training_status)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		dateStr, athleteID, ctl, atl, tsb, tss, status)
	return err
}

func getTrainingStatus(tsb float64) string {
	switch {
	case tsb > 25:
		return "fresh"
	case tsb >= 5 && tsb <= 25:
		return "optimal"
	case tsb >= -5 && tsb < 5:
		return "borderline"
	case tsb >= -25 && tsb < -5:
		return "overreaching"
	default:
		return "unproductive"
	}
}

func LogSyncStart(athleteID string) (int64, error) {
	result, err := DB.Exec(`
		INSERT INTO sync_log (athlete_id, started_at, status)
		VALUES (?, CURRENT_TIMESTAMP, 'running')`, athleteID)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func LogSyncFinish(id int64, fetched, new int, status, errMsg string) error {
	_, err := DB.Exec(`
		UPDATE sync_log SET finished_at = CURRENT_TIMESTAMP,
		workouts_fetched = ?, workouts_new = ?, status = ?, error = ?
		WHERE id = ?`, fetched, new, status, errMsg, id)
	return err
}

// GetZonesBalance aggregates time in each power zone across all workouts in the last N days.
func GetZonesBalance(athleteID string, days int) (map[string]interface{}, error) {
	cutoff := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	rows, err := DB.Query(`
		SELECT time_in_zones_json FROM workouts
		WHERE athlete_id = ? AND time_in_zones_json IS NOT NULL AND time_in_zones_json != ''
		AND date(start_time) >= ?`, athleteID, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	totals := map[string]int{"z1": 0, "z2": 0, "z3": 0, "z4": 0, "z5": 0, "z6": 0, "z7": 0}
	totalSecs := 0
	for rows.Next() {
		var jsonStr string
		if err := rows.Scan(&jsonStr); err == nil {
			var zones map[string]int
			if err := json.Unmarshal([]byte(jsonStr), &zones); err == nil {
				for k, v := range zones {
					if k != "total" {
						totals[k] += v
					}
				}
				if t, ok := zones["total"]; ok {
					totalSecs += t
				}
			}
		}
	}

	// Convert to percentages
	pct := make(map[string]interface{})
	for k, v := range totals {
		pct[k] = map[string]interface{}{
			"seconds": v,
			"minutes": float64(v) / 60.0,
			"pct":     0.0,
		}
		if totalSecs > 0 {
			pct[k].(map[string]interface{})["pct"] = float64(v) / float64(totalSecs) * 100
		}
	}

	return map[string]interface{}{
		"days":       days,
		"total_secs": totalSecs,
		"total_mins": float64(totalSecs) / 60.0,
		"zones":      pct,
	}, nil
}

// GetFTPHistory estimates CP/FTP using the power-duration model from workout data.
// Uses best-effort estimates from best_30s, best_5min, best_20min and TSS formula.
func GetFTPHistory(athleteID string, limit int) ([]map[string]interface{}, error) {
	rows, err := DB.Query(`
		SELECT date(start_time), normalized_power, avg_power, max_power,
		       tss, duration_secs, best_30s, best_5min, best_20min
		FROM workouts
		WHERE athlete_id = ? AND normalized_power > 0
		ORDER BY start_time DESC
		LIMIT ?`, athleteID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var dateStr string
		var np, avgP, maxP, tss, dur, b30, b5, b20 int
		if err := rows.Scan(&dateStr, &np, &avgP, &maxP, &tss, &dur, &b30, &b5, &b20); err == nil {
			// Solve for FTP from TSS formula: FTP = NP / sqrt(TSS / (dur_h * 100))
			var ftpFromTSS float64
			if tss > 0 && dur > 0 {
				durH := float64(dur) / 3600.0
				ratio := float64(tss) / (durH * 100.0)
				if ratio > 0 {
					ftpFromTSS = float64(np) / math.Sqrt(ratio)
				}
			}

			// Power-duration model: CP estimate from best windows
			var cpFromModel float64
			if b30 > 0 && b5 > 0 && b5 < b30 {
				// W' = P30 * (30 - P30*30/P5), CP = P30²/P5 - W'/30
				Wprime := float64(b30) * (30.0 - float64(b30)*30.0/float64(b5))
				if Wprime > 0 && b30 > 0 {
					cpFromModel = float64(b30)*float64(b30)/float64(b5) - Wprime/30.0
				}
			}

			var estimatedFTP float64
			var method string
			if cpFromModel > 0 && ftpFromTSS > 0:
				estimatedFTP = cpFromModel*0.7 + ftpFromTSS*0.3
				method = "model+tss"
			} else if cpFromModel > 0:
				estimatedFTP = cpFromModel
				method = "power_duration_model"
			} else if ftpFromTSS > 0:
				estimatedFTP = ftpFromTSS
				method = "tss_formula"
			} else {
				estimatedFTP = float64(avgP)
				method = "avg_power_fallback"
			}

			result = append(result, map[string]interface{}{
				"date":         dateStr,
				"ftp":          int(round(estimatedFTP)),
				"ftp_model":    int(round(cpFromModel)),
				"ftp_from_tss": int(round(ftpFromTSS)),
				"method":       method,
				"np":           np,
				"avg_p":        avgP,
				"best_30s":     b30,
				"best_5min":    b5,
				"best_20min":   b20,
				"tss":          tss,
			})
		}
	}
	return result, nil
}

// GetOvertrainingAlert returns true if TSB < -30 for 3+ consecutive recent days.
func GetOvertrainingAlert(athleteID string) (map[string]interface{}, error) {
	rows, err := DB.Query(`
		SELECT date, tsb FROM daily_load
		WHERE athlete_id = ?
		ORDER BY date DESC
		LIMIT 10`, athleteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type dayTSB struct {
		date string
		tsb  float64
	}
	var days []dayTSB
	for rows.Next() {
		var d dayTSB
		if err := rows.Scan(&d.date, &d.tsb); err == nil {
			days = append(days, d)
		}
	}

	if len(days) < 3 {
		return map[string]interface{}{"alert": false, "reason": "insufficient_data", "days": 0}, nil
	}

	// Check last N consecutive days
	consecutive := 0
	firstAlertDate := ""
	for _, d := range days {
		if d.tsb < -30 {
			if consecutive == 0 {
				firstAlertDate = d.date
			}
			consecutive++
		} else {
			break
		}
	}

	return map[string]interface{}{
		"alert":           consecutive >= 3,
		"consecutive_days": consecutive,
		"first_date":      firstAlertDate,
	}, nil
}

// GetWeekWorkouts returns workouts for a specific Mon-Sun week.
// offset=0 = current week, offset=1 = last week, etc.
func GetWeekWorkouts(athleteID string, offset int) ([]models.Workout, error) {
	// Find the Monday of the target week
	now := time.Now()
	daysSinceMonday := int(now.Weekday()) // 0=Sun, 1=Mon, ...
	if daysSinceMonday == 0 {
		daysSinceMonday = 7
	}
	monday := now.AddDate(0, 0, -daysSinceMonday+1).AddDate(0, 0, -offset*7)
	sunday := monday.AddDate(0, 0, 6)

	mondayStr := monday.Format("2006-01-02")
	sundayStr := sunday.Format("2006-01-02")

	rows, err := DB.Query(`
		SELECT id, athlete_id, title, sport_type, start_time, duration_secs,
			   distance_meters, elevation_gain_meters, normalized_power, avg_power,
			   max_power, intensity_factor, tss, ftp_at_time, avg_hr, max_hr,
			   time_in_zones_json, garmin_connect_url, synced_at
		FROM workouts
		WHERE athlete_id = ? AND date(start_time) >= ? AND date(start_time) <= ?
		ORDER BY start_time ASC`, athleteID, mondayStr, sundayStr)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workouts []models.Workout
	for rows.Next() {
		var w models.Workout
		var duration, avgPower, maxPower, tss, ftpAtTime, avgHR, maxHR, np sql.NullInt64
		var intensityFactor sql.NullFloat64
		var distance, elevation sql.NullFloat64
		var zones, url sql.NullString

		err := rows.Scan(&w.ID, &w.AthleteID, &w.Title, &w.SportType, &w.StartTime,
			&duration, &distance, &elevation, &np, &avgPower, &maxPower,
			&intensityFactor, &tss, &ftpAtTime, &avgHR, &maxHR,
			&zones, &url, &w.SyncedAt)
		if err != nil {
			continue
		}

		w.DurationSecs = int(duration.Int64)
		w.DistanceMeters = distance.Float64
		w.ElevationGainMeters = elevation.Float64
		w.NormalizedPower = int(np.Int64)
		w.AvgPower = int(avgPower.Int64)
		w.MaxPower = int(maxPower.Int64)
		w.IntensityFactor = intensityFactor.Float64
		w.TSS = int(tss.Int64)
		w.FTPAtTime = int(ftpAtTime.Int64)
		w.AvgHR = int(avgHR.Int64)
		w.MaxHR = int(maxHR.Int64)
		w.TimeInZonesJSON = zones.String
		w.GarminConnectURL = url.String

		workouts = append(workouts, w)
	}

	return workouts, nil
}

// GetLoadTrends returns weekly changes in CTL and ATL over the last N weeks.
func GetLoadTrends(athleteID string, weeks int) ([]map[string]interface{}, error) {
	rows, err := DB.Query(`
		SELECT date, ctl, atl, tsb, tss
		FROM daily_load
		WHERE athlete_id = ?
		ORDER BY date DESC
		LIMIT ?`, athleteID, weeks*7)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type weekEntry struct {
		date    string
		ctl, atl, tsb float64
		tss     int
	}
	var entries []weekEntry
	for rows.Next() {
		var e weekEntry
		if err := rows.Scan(&e.date, &e.ctl, &e.atl, &e.tsb, &e.tss); err == nil {
			entries = append(entries, e)
		}
	}

	if len(entries) == 0 {
		return []map[string]interface{}{}, nil
	}

	// Group by ISO week (Mon-Sun)
	weekMap := make(map[string]map[string]interface{})
	for _, e := range entries {
		t, _ := time.Parse("2006-01-02", e.date)
		year, week := t.ISOWeek()
		key := fmt.Sprintf("%d-W%02d", year, week)
		if _, ok := weekMap[key]; !ok {
			weekMap[key] = map[string]interface{}{
				"week": key, "ctl": 0.0, "atl": 0.0, "tss": 0, "days": 0,
			}
		}
		entry := weekMap[key]
		entry["ctl"] = entry["ctl"].(float64) + e.ctl
		entry["atl"] = entry["atl"].(float64) + e.atl
		entry["tss"] = entry["tss"].(int) + e.tss
		entry["days"] = entry["days"].(int) + 1
	}

	var result []map[string]interface{}
	for _, entry := range weekMap {
		e := entry
		e["ctl"] = e["ctl"].(float64) / float64(e["days"].(int))
		e["atl"] = e["atl"].(float64) / float64(e["days"].(int))
		delete(e, "days")
		result = append(result, e)
	}

	// Sort by week ascending
	sort.Slice(result, func(i, j int) bool {
		return result[i]["week"].(string) < result[j]["week"].(string)
	})

	return result, nil
}
