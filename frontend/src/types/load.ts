export interface DailyLoad {
  date: string
  ctl: number
  atl: number
  tsb: number
  tss?: number
  training_status?: string
}

export interface Workout {
  id: string
  title: string
  sport_type: string
  start_time: string
  duration_secs: number
  distance_meters: number
  elevation_gain_meters: number
  normalized_power: number
  avg_power: number
  max_power: number
  intensity_factor: number
  tss: number
  avg_hr: number
  max_hr: number
  time_in_zones_json: string
  garmin_connect_url: string
}

export interface Summary {
  ctl: number
  atl: number
  tsb: number
  status: string
  this_week: { tss: number; workouts: number; hours: number }
  this_month: { tss: number; workouts: number; hours: number }
  last_workout?: { title: string; tss: number; date: string }
}

export interface Athlete {
  id: string
  name: string
  ftp: number
}

export interface FTPHistoryItem {
  date: string
  ftp: number
  ftp_model: number
  ftp_from_tss: number
  method: string
  np: number
  avg_p: number
  best_30s: number
  best_5min: number
  best_20min: number
  tss: number
}