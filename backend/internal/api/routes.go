package api

import (
	"cycling-peaks/backend/internal/db"
	"cycling-peaks/backend/internal/sync"
	"os"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
)

func Setup(app *fiber.App) {
	api := app.Group("/api/v1")

	// Athlete
	api.Get("/athlete", getAthlete)
	api.Put("/athlete/ftp", updateFTP)

	// Workouts
	api.Get("/workouts", getWorkouts)
	api.Get("/workouts/:id", getWorkout)

	// Load
	api.Get("/load/today", getLoadToday)
	api.Get("/load/history", getLoadHistory)
	api.Get("/load/trends", getLoadTrends)

	// Zones
	api.Get("/zones/balance", getZonesBalance)

	// Dashboard
	api.Get("/dashboard/summary", getDashboardSummary)
	api.Get("/dashboard/week", getDashboardWeek)

	// Athlete
	api.Get("/athlete/ftp-history", getFTPHistory)

	// Alerts
	api.Get("/alerts/overtraining", getOvertrainingAlert)

	// Sync
	api.Get("/sync/status", getSyncStatus)
	api.Post("/sync/trigger", triggerSync)
}

// getAthleteID returns the configured athlete ID, defaulting to "charly"
func getAthleteID(c *fiber.Ctx) string {
	if id := os.Getenv("ATHLETE_ID"); id != "" {
		return id
	}
	return "charly"
}

func getAthlete(c *fiber.Ctx) error {
	athlete, err := db.GetAthlete(getAthleteID(c))
	if err != nil {
		return c.JSON(fiber.Map{"error": "athlete not found"})
	}
	return c.JSON(athlete)
}

func updateFTP(c *fiber.Ctx) error {
	var body struct {
		FTP int `json:"ftp"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if err := db.UpdateAthleteFTP(getAthleteID(c), body.FTP); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true, "ftp": body.FTP})
}

func getWorkouts(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "30"))
	page, _ := strconv.Atoi(c.Query("page", "1"))
	offset := (page - 1) * limit

	workouts, total, err := db.GetWorkouts(getAthleteID(c), limit, offset)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"data": workouts,
		"pagination": fiber.Map{
			"page":     page,
			"per_page": limit,
			"total":    total,
		},
	})
}

func getWorkout(c *fiber.Ctx) error {
	id := c.Params("id")
	workouts, _, _ := db.GetWorkouts(getAthleteID(c), 1000, 0)
	for _, w := range workouts {
		if w.ID == id {
			return c.JSON(w)
		}
	}
	return c.Status(404).JSON(fiber.Map{"error": "workout not found"})
}

func getLoadToday(c *fiber.Ctx) error {
	load, err := db.GetLoadToday(getAthleteID(c))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(load)
}

func getLoadHistory(c *fiber.Ctx) error {
	days, _ := strconv.Atoi(c.Query("days", "90"))
	loads, err := db.GetLoadHistory(getAthleteID(c), days)
	if err != nil {
		return c.JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"data": loads})
}

func getLoadTrends(c *fiber.Ctx) error {
	weeks, _ := strconv.Atoi(c.Query("weeks", "12"))
	trends, err := db.GetLoadTrends(getAthleteID(c), weeks)
	if err != nil {
		return c.JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"data": trends})
}

func getDashboardSummary(c *fiber.Ctx) error {
	summary, err := db.GetDashboardSummary(getAthleteID(c))
	if err != nil {
		return c.JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(summary)
}

func getDashboardWeek(c *fiber.Ctx) error {
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	workouts, err := db.GetWeekWorkouts(getAthleteID(c), offset)
	if err != nil {
		return c.JSON(fiber.Map{"error": err.Error()})
	}

	// Compute week stats
	var totalTSS, totalDuration, totalDistance int
	for _, w := range workouts {
		totalTSS += w.TSS
		totalDuration += w.DurationSecs
		totalDistance += int(w.DistanceMeters)
	}
	weekStart := time.Now().AddDate(0, 0, -int(time.Now().Weekday())+1).AddDate(0, 0, -offset*7)
	weekEnd := weekStart.AddDate(0, 0, 6)

	return c.JSON(fiber.Map{
		"week_start":  weekStart.Format("2006-01-02"),
		"week_end":    weekEnd.Format("2006-01-02"),
		"workouts":    workouts,
		"total_tss":   totalTSS,
		"total_hours": float64(totalDuration) / 3600.0,
		"total_km":    float64(totalDistance) / 1000.0,
		"workout_count": len(workouts),
	})
}

func getSyncStatus(c *fiber.Ctx) error {
	status, err := db.GetSyncStatus(getAthleteID(c))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(status)
}

func triggerSync(c *fiber.Ctx) error {
	sync.RunAsync()
	return c.JSON(fiber.Map{
		"status":  "triggered",
		"message": "Sync started in background",
	})
}

// getZonesBalance returns aggregate time in each power zone over the last N days.
func getZonesBalance(c *fiber.Ctx) error {
	days, _ := strconv.Atoi(c.Query("days", "90"))
	balance, err := db.GetZonesBalance(getAthleteID(c), days)
	if err != nil {
		return c.JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(balance)
}

// getFTPHistory returns estimated FTP evolution from high-intensity workouts.
func getFTPHistory(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	history, err := db.GetFTPHistory(getAthleteID(c), limit)
	if err != nil {
		return c.JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(map[string]interface{}{"data": history})
}

// getOvertrainingAlert returns true if TSB < -30 for 3+ consecutive recent days.
func getOvertrainingAlert(c *fiber.Ctx) error {
	alert, err := db.GetOvertrainingAlert(getAthleteID(c))
	if err != nil {
		return c.JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(alert)
}
