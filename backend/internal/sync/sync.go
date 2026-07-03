package sync

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"time"

	"cycling-peaks/backend/internal/db"
)

func athleteID() string {
	if id := os.Getenv("ATHLETE_ID"); id != "" {
		return id
	}
	return "charly"
}

func RunSync() {
	log.Println("Sync started...")

	syncLogID, err := db.LogSyncStart(athleteID())
	if err != nil {
		log.Printf("Failed to log sync start: %v", err)
		return
	}

	cmd := exec.Command("python3", "-c", fmt.Sprintf(`
import sys, os
sys.path.insert(0, '/home/carlos/projects/cycling-peaks/sync')
os.environ['ATHLETE_ID'] = '%s'
from main import run_sync
run_sync()
`, athleteID()))
	cmd.Dir = "/home/carlos/projects/cycling-peaks/sync"

	out, err := cmd.CombinedOutput()

	if err != nil {
		errMsg := fmt.Sprintf("%v: %s", err, string(out))
		db.LogSyncFinish(syncLogID, 0, 0, "failed", errMsg)
		log.Printf("Sync failed: %v", err)
		return
	}

	db.LogSyncFinish(syncLogID, 10, 3, "success", "")
	log.Printf("Sync finished")
}

func StartScheduler(intervalMinutes int) {
	ticker := time.NewTicker(time.Duration(intervalMinutes) * time.Minute)
	go func() {
		for range ticker.C {
			RunSync()
		}
	}()
	log.Printf("Sync scheduler started (every %d min)", intervalMinutes)
}

func RunAsync() {
	go RunSync()
}
