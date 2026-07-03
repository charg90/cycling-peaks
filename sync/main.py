"""
Main sync entrypoint.
Fetches workouts from Garmin Connect + Strava, merges them, and stores in SQLite.
"""
import os
import sys
import sqlite3
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from calculators import calculate_tss, calculate_ctl, calculate_atl, calculate_tsb, calculate_power_zones, format_zones_as_json, training_status
from strava_client import get_authorized_client, get_cycling_activities, get_activity_details as strava_details
from merge import find_best_match, merge_activity

ATHLETE_ID = os.getenv("ATHLETE_ID", "charly")
DB_PATH = os.getenv("DATABASE_URL", "/home/carlos/projects/cycling-peaks/backend/cycling.db")
GARMIN_EMAIL = os.getenv("GARMIN_EMAIL", "")
GARMIN_PASSWORD = os.getenv("GARMIN_PASSWORD", "")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_ftp(conn) -> int:
    row = conn.execute(f"SELECT ftp FROM athletes WHERE id = '{ATHLETE_ID}'").fetchone()
    return row["ftp"] if row else 220


def workout_exists(conn, activity_id: str) -> bool:
    row = conn.execute("SELECT id FROM workouts WHERE id = ?", (activity_id,)).fetchone()
    return row is not None


# ─────────────────────────────────────────────
# Garmin
# ─────────────────────────────────────────────
def load_garmin_activities() -> list[dict]:
    """Fetch cycling activities from Garmin Connect."""
    try:
        from garminconnect import Garmin
        client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
        client.login()
    except Exception as e:
        print(f"ERROR: Garmin login failed: {e}")
        return []

    end_date = datetime.now()
    start_date = end_date - timedelta(days=90)

    try:
        activities = client.get_activities_by_date(
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d")
        )
        CYCLING = {"road_biking", "virtual_ride", "cycling", "indoor_cycling", "mountain_biking"}
        cycling = [
            a for a in activities
            if str(a.get("activityType", {}).get("typeKey", "")).lower() in CYCLING
        ]
        print(f"Garmin: found {len(cycling)} cycling activities")

        result = []
        for a in cycling:
            act = {
                "id": str(a["activityId"]),
                "title": a.get("activityName", "Cycling"),
                "sport_type": "cycling",
                "start_time": a.get("startTimeLocal", a.get("startTimeGMT", "")),
                "duration_secs": int(a.get("duration", 0)),
                "distance_meters": float(a.get("distance", 0) or 0),
                "elevation_gain_meters": float(a.get("elevationGain", 0) or 0),
                "avg_power": 0,
                "normalized_power": 0,
                "max_power": 0,
                "avg_hr": 0,
                "max_hr": 0,
                "garmin_connect_url": f"https://connect.garmin.com/modern/activity/{a['activityId']}",
            }
            result.append(act)
        return result

    except Exception as e:
        print(f"Error fetching Garmin activities: {e}")
        return []


def fetch_garmin_power_hr(client, activity_id: int) -> Dict[str, Any]:
    """
    Fetch per-second power and HR from Garmin activity details.

    Returns dict with avg_power, max_power, normalized_power,
    best_30s, best_5min, best_20min, avg_hr, max_hr, and raw powers list.

    Uses signal alarm as a global timeout to prevent hanging on rate-limited Garmin.
    If Garmin doesn't respond in 8s, returns {} immediately.
    """
    def timeout_handler(signum, frame):
        raise TimeoutError(f"Garmin timed out for {activity_id}")

    old_handler = signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(8)

    try:
        # Patch requests timeout globally for this call
        import requests as _req
        _orig_get = _req.Session.get
        _orig_post = _req.Session.post
        _req.Session.get = lambda s, *a, **k: _orig_get(s, *a, timeout=(5, 8), **k)
        _req.Session.post = lambda s, *a, **k: _orig_post(s, *a, timeout=(5, 8), **k)
        try:
            details = client.get_activity_details(activity_id, maxchartsize=2000)
        finally:
            _req.Session.get = _orig_get
            _req.Session.post = _orig_post
    except (TimeoutError, Exception) as e:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)
        return {}

    signal.alarm(0)
    signal.signal(signal.SIGALRM, old_handler)

    metrics = details.get("activityDetailMetrics", [])
    if not metrics:
        return {}

    # Find power and HR series
    power_series = None
    hr_series = None
    for metric in metrics:
        key = metric.get("key", "")
        if key == "power":
            power_series = metric.get("metrics", [])
        elif key == "heartRate":
            hr_series = metric.get("metrics", [])

    if not power_series:
        return {}

    # Extract values
    powers = []
    hrs = []
    for entry in power_series:
        vals = entry.get("values", [])
        for v in vals:
            if v and isinstance(v, (int, float)) and v > 0:
                powers.append(float(v))
    for entry in (hr_series or []):
        vals = entry.get("values", [])
        for v in vals:
            if v and isinstance(v, (int, float)) and v > 0:
                hrs.append(float(v))

    if not powers:
        return {}

    avg_power = int(round(sum(powers) / len(powers)))
    max_power = int(max(powers))
    avg_hr = int(round(sum(hrs) / len(hrs))) if hrs else 0
    max_hr = int(max(hrs)) if hrs else 0

    # Normalized power: 30-s rolling averages, then 4th root of mean of 4th powers
    np_val = _calc_normalized_power(powers)

    # Best 30-second, 5-min, 20-min rolling averages (for FTP estimation)
    best_30s = _best_window_avg(powers, window=30)
    best_5min = _best_window_avg(powers, window=300)
    best_20min = _best_window_avg(powers, window=1200)

    return {
        "avg_power": avg_power,
        "max_power": max_power,
        "normalized_power": np_val,
        "avg_hr": avg_hr,
        "max_hr": max_hr,
        "best_30s": best_30s,
        "best_5min": best_5min,
        "best_20min": best_20min,
        "powers": powers,
    }

def _calc_normalized_power(powers: List[int]) -> int:
    """
    Calculate Normalized Power from second-by-second power data.

    NP = 4th root of the mean of (30-s rolling averages)^4
    Formula: NP = (mean(rolling_avg^4))^(1/4)
    This weights higher-intensity efforts disproportionately.
    """
    if len(powers) < 30:
        return int(round(sum(powers) / len(powers))) if powers else 0
    rolling = []
    for i in range(len(powers) - 29):
        window = powers[i:i + 30]
        rolling.append(sum(window) / 30)
    if not rolling:
        return int(round(sum(powers) / len(powers)))
    # Correct NP formula: mean of 4th powers, then 4th root
    np_raw = (sum(r ** 4 for r in rolling) / len(rolling)) ** 0.25
    return int(round(np_raw))


def _best_window_avg(powers: List[int], window: int) -> int:
    """Return the highest average power over `window` consecutive seconds."""
    if len(powers) < window:
        return int(round(sum(powers) / len(powers))) if powers else 0
    best = 0.0
    for i in range(len(powers) - window + 1):
        window_avg = sum(powers[i:i + window]) / window
        if window_avg > best:
            best = window_avg
    return int(round(best))


# ─────────────────────────────────────────────
# Insert / Update
# ─────────────────────────────────────────────
def upsert_workout(conn, w: Dict[str, Any], ftp: int):
    """Insert or update a merged workout in the DB."""
    act_id = w["id"]
    title = w.get("title", "Cycling")
    start_time = w.get("start_time", "")
    duration = w.get("duration_secs", 0)
    distance = w.get("distance_meters", 0)
    elevation = w.get("elevation_gain_meters", 0)
    avg_power = w.get("avg_power", 0)
    max_power = w.get("max_power", 0)
    normalized_power = w.get("normalized_power", 0) or avg_power
    intensity_factor = w.get("intensity_factor", 0.0)
    tss = w.get("tss", 0)
    avg_hr = w.get("avg_hr", 0)
    max_hr = w.get("max_hr", 0)
    garmin_url = w.get("garmin_connect_url", "")
    strava_url = w.get("strava_url", "")
    source = w.get("source", "")
    zones_json = w.get("time_in_zones_json", "") or ""
    best_30s = w.get("best_30s", 0)
    best_5min = w.get("best_5min", 0)
    best_20min = w.get("best_20min", 0)

    conn.execute("""
        INSERT OR REPLACE INTO workouts
        (id, athlete_id, title, sport_type, start_time, duration_secs,
         distance_meters, elevation_gain_meters, normalized_power, avg_power,
         max_power, intensity_factor, tss, ftp_at_time, avg_hr, max_hr,
         time_in_zones_json, garmin_connect_url, strava_url, source,
         best_30s, best_5min, best_20min, synced_at)
        VALUES (?, ?, ?, 'cycling', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """, (act_id, ATHLETE_ID, title, start_time, duration, distance, elevation,
          normalized_power, avg_power, max_power, intensity_factor,
          tss, ftp, avg_hr, max_hr, zones_json, garmin_url, strava_url, source,
          best_30s, best_5min, best_20min))
    return True


# ─────────────────────────────────────────────
# Daily load recalculation
# ─────────────────────────────────────────────
def recalculate_daily_load(conn):
    rows = conn.execute("""
        SELECT date(start_time) as day, SUM(tss) as daily_tss
        FROM workouts
        WHERE athlete_id = ? AND tss > 0
        GROUP BY day
        ORDER BY day ASC
    """, (ATHLETE_ID,)).fetchall()

    if not rows:
        return

    tss_by_day = {row["day"]: row["daily_tss"] for row in rows}
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=90)

    conn.execute("DELETE FROM daily_load WHERE athlete_id = ?", (ATHLETE_ID,))

    current = start_date
    while current <= end_date:
        day_str = current.strftime("%Y-%m-%d")
        tss_up_to_day = [
            tss_by_day.get((start_date + timedelta(days=i)).strftime("%Y-%m-%d"), 0)
            for i in range((current - start_date).days + 1)
        ]
        ctl = calculate_ctl(tss_up_to_day, days=30)
        atl = calculate_atl(tss_up_to_day, days=7)
        tsb = calculate_tsb(ctl, atl)
        tss_today = tss_by_day.get(day_str, 0)
        status = training_status(tsb)
        conn.execute("""
            INSERT INTO daily_load (date, athlete_id, ctl, atl, tsb, tss, training_status)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (day_str, ATHLETE_ID, ctl, atl, tsb, tss_today))
        current += timedelta(days=1)

    conn.commit()
    print(f"Recalculated daily_load for {len(rows)} training days")


# ─────────────────────────────────────────────
# Main sync
# ─────────────────────────────────────────────
def run_sync():
    print("=== Cycling Peaks Sync (Garmin + Strava) ===")

    # ── 1. Load Garmin activities (basic list) ──
    print("\n[1/4] Fetching Garmin activities...")
    garmin_activities = load_garmin_activities()

    # ── 2. Load Strava activities ──
    print("\n[2/4] Fetching Strava activities...")
    strava_client = get_authorized_client()
    strava_activities = []
    if strava_client:
        strava_activities = get_cycling_activities(strava_client)
    else:
        print("  (Strava not configured, skipping)")

    # ── 3. Match & Merge ──
    print(f"\n[3/4] Merging: {len(garmin_activities)} Garmin + {len(strava_activities)} Strava")
    pairs, unmatched_g, unmatched_s = find_best_match(
        garmin_activities, strava_activities
    )
    print(f"  → {len(pairs)} matched pairs, {len(unmatched_g)} Garmin-only, {len(unmatched_s)} Strava-only")

    # ── 4. Fetch detailed power/HR and insert ──
    conn = get_db()
    ftp = get_ftp(conn)

    try:
        from garminconnect import Garmin
        g_client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
        g_client.login()
        has_garmin = True
    except Exception as e:
        print(f"  Garmin login failed: {e}, will use Strava for power if available")
        has_garmin = False
        g_client = None

    total = len(pairs) + len(unmatched_g) + len(unmatched_s)
    processed = 0

    def process_activity(act: dict, source: str):
        nonlocal processed
        if not act or "id" not in act:
            print(f"  [{processed}/{total}] SKIPPED - no id in activity: {act}")
            return
        processed += 1
        act_id = act["id"]

        # Fetch power/HR details
        power_hr = {}
        if source in ("garmin", "both") and has_garmin:
            # Try Garmin detailed
            try:
                power_hr = fetch_garmin_power_hr(g_client, int(act_id))
            except Exception:
                pass

        if not power_hr and source in ("strava", "both") and strava_client:
            # Try Strava details
            try:
                power_hr = strava_details(strava_client, act_id)
            except Exception:
                pass

        # Merge details into activity
        if power_hr:
            act["avg_power"] = power_hr.get("avg_power") or act.get("avg_power", 0)
            act["max_power"] = power_hr.get("max_power") or act.get("max_power", 0)
            act["normalized_power"] = power_hr.get("normalized_power") or act.get("normalized_power", 0)
            act["avg_hr"] = power_hr.get("avg_hr") or act.get("avg_hr", 0)
            act["max_hr"] = power_hr.get("max_hr") or act.get("max_hr", 0)
            # Best window averages for FTP estimation
            act["best_30s"] = power_hr.get("best_30s", 0)
            act["best_5min"] = power_hr.get("best_5min", 0)
            act["best_20min"] = power_hr.get("best_20min", 0)
            # Calculate power zones if we have raw samples
            powers = power_hr.get("powers") or power_hr.get("power_samples")
            if powers and ftp > 0:
                zones = calculate_power_zones(powers, ftp)
                act["time_in_zones_json"] = format_zones_as_json(zones)

        # Recalculate TSS if we have power
        if act.get("normalized_power", 0) > 0 and ftp > 0:
            act["intensity_factor"] = round(act["normalized_power"] / ftp, 2)
            dur_h = act["duration_secs"] / 3600.0
            act["tss"] = int(round(dur_h * (act["normalized_power"] / ftp) ** 2 * 100))

        print(f"  [{processed}/{total}] {act.get('title','?')[:50]} | "
              f"P={act.get('avg_power',0)}W NP={act.get('normalized_power',0)}W "
              f"TSS={act.get('tss',0)} | src={source}")
        upsert_workout(conn, act, ftp)

    # Process matched pairs
    for g, s in pairs:
        merged = merge_activity(g, s, ftp)
        if merged:
            process_activity(merged, "both")
        time.sleep(1)

    # Process Garmin-only
    for g in unmatched_g:
        merged = merge_activity(g, None, ftp)
        if merged:
            process_activity(merged, "garmin")
        time.sleep(2)

    # Process Strava-only
    for s in unmatched_s:
        merged = merge_activity(None, s, ftp)
        if merged:
            process_activity(merged, "strava")
        time.sleep(1)

    conn.commit()
    recalculate_daily_load(conn)

    # Log sync
    conn.execute("""
        INSERT INTO sync_log (athlete_id, started_at, finished_at, workouts_fetched, workouts_new, status)
        VALUES (?, datetime('now', '-5 minutes'), datetime('now'), ?, ?, 'success')
    """, (ATHLETE_ID, total, processed))
    conn.commit()
    conn.close()

    print(f"\n=== Sync Complete: {processed} workouts processed ===")


if __name__ == "__main__":
    run_sync()
