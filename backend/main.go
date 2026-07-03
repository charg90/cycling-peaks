package main

import (
	"cycling-peaks/backend/internal/api"
	"cycling-peaks/backend/internal/db"
	"cycling-peaks/backend/internal/sync"
	"log"
	"os"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	dbPath := os.Getenv("DATABASE_URL")
	if dbPath == "" {
		dbPath = "cycling.db"
	}

	if err := db.Init(dbPath); err != nil {
		log.Fatalf("Failed to init DB: %v", err)
	}
	defer db.Close()

	app := fiber.New(fiber.Config{
		AppName: "Cycling Peaks API",
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE",
		AllowHeaders: "Origin, Content-Type, Accept",
	}))

	api.Setup(app)

	interval := 60
	if v := os.Getenv("SYNC_INTERVAL_MINUTES"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			interval = i
		}
	}
	sync.StartScheduler(interval)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Cycling Peaks API running on http://localhost:%s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
