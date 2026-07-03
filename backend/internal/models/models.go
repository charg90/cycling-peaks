package models

import "time"

type Athlete struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	FTP       int       `json:"ftp"`
	CreatedAt time.Time `json:"created_at"`
}

type Workout struct {
	ID                  string  `json:"id"`
	AthleteID           string  `json:"athlete_id"`
	Title               string  `json:"title"`
	SportType           string  `json:"sport_type"`
	StartTime           string  `json:"start_time"`
	DurationSecs        int     `json:"duration_secs"`
	DistanceMeters      float64 `json:"distance_meters"`
	ElevationGainMeters float64 `json:"elevation_gain_meters"`
	NormalizedPower     int     `json:"normalized_power"`
	AvgPower            int     `json:"avg_power"`
	MaxPower            int     `json:"max_power"`
	IntensityFactor     float64 `json:"intensity_factor"`
	TSS                 int     `json:"tss"`
	FTPAtTime           int     `json:"ftp_at_time"`
	AvgHR               int     `json:"avg_hr"`
	MaxHR               int     `json:"max_hr"`
	TimeInZonesJSON     string  `json:"time_in_zones_json"`
	GarminConnectURL    string  `json:"garmin_connect_url"`
	SyncedAt            string  `json:"synced_at"`
}

type DailyLoad struct {
	Date            string  `json:"date"`
	AthleteID       string  `json:"athlete_id"`
	CTL             float64 `json:"ctl"`
	ATL             float64 `json:"atl"`
	TSB             float64 `json:"tsb"`
	TSS             int     `json:"tss"`
	TrainingStatus  string  `json:"training_status"`
	CreatedAt       string  `json:"created_at"`
}

type LoadToday struct {
	Date        string  `json:"date"`
	CTL         float64 `json:"ctl"`
	ATL         float64 `json:"atl"`
	TSB         float64 `json:"tsb"`
	TSSToday    int     `json:"tss_today"`
	Status      string  `json:"status"`
	Trend       string  `json:"trend"`
}

type DashboardSummary struct {
	CTL       float64        `json:"ctl"`
	ATL       float64        `json:"atl"`
	TSB       float64        `json:"tsb"`
	Status    string         `json:"status"`
	ThisWeek  WeekMonthStats `json:"this_week"`
	ThisMonth WeekMonthStats `json:"this_month"`
	LastWorkout *LastWorkout  `json:"last_workout,omitempty"`
}

type WeekMonthStats struct {
	TSS      int     `json:"tss"`
	Workouts int     `json:"workouts"`
	Hours    float64 `json:"hours"`
}

type LastWorkout struct {
	Title string `json:"title"`
	TSS   int    `json:"tss"`
	Date  string `json:"date"`
}

type SyncStatus struct {
	LastSync      string `json:"last_sync"`
	Status        string `json:"status"`
	WorkoutsCount int    `json:"workouts_count"`
}
