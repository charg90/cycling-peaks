"""
Merge strategy for Garmin + Strava workouts.

Goal: for each training session, get the MOST COMPLETE data possible.
- Garmin: power/hr from device (more accurate), elevation, detailed metrics
- Strava: distance, speed, kudos, suffer score, public description

Matching: by start_time (same day) + similar duration (±5 min tolerance).
After matching, fields are merged with priority: Garmin > Strava for power/HR,
Strava > Garmin for distance/speed/kudos.
"""
import os
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple

DB_PATH = os.getenv("DATABASE_URL", "/home/carlos/projects/cycling-peaks/backend/cycling.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def time_key(activity: dict) -> Tuple[datetime, float]:
    """Return (start_time, duration) for sorting/matching."""
    start = activity.get("start_time") or activity.get("start_date") or ""
    if isinstance(start, str):
        try:
            start = datetime.fromisoformat(start.replace("Z", "+00:00"))
        except Exception:
            start = datetime.now()
    duration = activity.get("duration_secs") or activity.get("elapsed_time") or 0
    return start, float(duration)


def duration_match(a_dur: float, b_dur: float, tolerance_secs: float = 300) -> bool:
    return abs(a_dur - b_dur) <= tolerance_secs


def same_day(a_time, b_time) -> bool:
    """Check if two datetime objects are the same calendar day (in local time)."""
    try:
        if isinstance(a_time, str):
            a_time = datetime.fromisoformat(a_time.replace("Z", "+00:00"))
        if isinstance(b_time, str):
            b_time = datetime.fromisoformat(b_time.replace("Z", "+00:00"))
        return a_time.date() == b_time.date()
    except Exception:
        return False


def find_best_match(
    g_list: list[dict],
    s_list: list[dict],
) -> Tuple[list, list, list]:
    """
    Given two lists of activities (garmin and strava), find the best matching pairs.
    Matching logic:
    1. If both have an activity on the same day with matching duration (±5min) -> merge
    2. If only one source has an activity that day -> use as-is (fill what we can)

    Returns (pairs, unmatched_g, unmatched_s).
    """
    g_matched = set()
    s_matched = set()
    pairs = []

    # Sort by start time
    g_sorted = sorted(g_list, key=lambda a: a.get("start_time") or a.get("start_date") or "")
    s_sorted = sorted(s_list, key=lambda a: a.get("start_date") or "")

    for i, g in enumerate(g_sorted):
        g_time = g.get("start_time") or g.get("start_date") or ""
        g_dur = float(g.get("duration_secs") or g.get("elapsed_time") or 0)
        try:
            g_dt = datetime.fromisoformat(g_time.replace("Z", "+00:00")) if g_time else None
        except Exception:
            g_dt = None

        for j, s in enumerate(s_sorted):
            if j in s_matched:
                continue
            s_time = s.get("start_date") or ""
            s_dur = float(s.get("elapsed_time") or s.get("duration_secs") or 0)
            try:
                s_dt = datetime.fromisoformat(s_time.replace("Z", "+00:00")) if s_time else None
            except Exception:
                s_dt = None

            if g_dt and s_dt and same_day(g_dt, s_dt) and duration_match(g_dur, s_dur, 300):
                pairs.append((g, s))
                g_matched.add(i)
                s_matched.add(j)
                break

    unmatched_g = [g for i, g in enumerate(g_sorted) if i not in g_matched]
    unmatched_s = [s for j, s in enumerate(s_sorted) if j not in s_matched]

    return pairs, unmatched_g, unmatched_s


def merge_activity(g: Optional[dict], s: Optional[dict], ftp: int) -> dict:
    """
    Merge Garmin (g) and Strava (s) data into a single workout dict.

    Priority:
    - Power/HR/NP/IF/TSS: Garmin first, then Strava (only if Strava has power data)
    - Distance/Elevation: Garmin if accurate, else Strava
    - Duration: use the more reliable one
    - Speed: Strava is generally better calibrated
    - URLs: keep both
    """
    if g is None and s is None:
        return {}

    # ---- Identify source and extract id ----
    if g and s:
        act_id = g.get("id") or s.get("id")
        source = "both"
    elif g:
        act_id = g.get("id")
        source = "garmin"
    else:
        act_id = s.get("id")
        source = "strava"

    merged = {
        "id": act_id,
        "title": "Cycling",
        "sport_type": "cycling",
        "start_time": "",
        "duration_secs": 0,
        "distance_meters": 0.0,
        "elevation_gain_meters": 0.0,
        "normalized_power": 0,
        "avg_power": 0,
        "max_power": 0,
        "intensity_factor": 0.0,
        "tss": 0,
        "avg_hr": 0,
        "max_hr": 0,
        "avg_speed": 0.0,
        "max_speed": 0.0,
        "kilojoules": 0.0,
        "suffer_score": 0,
        "garmin_connect_url": "",
        "strava_url": "",
        "source": "both",
    }

    # ---- Basic info ----
    if g:
        merged["title"] = g.get("title") or g.get("activityName") or merged["title"]
        merged["sport_type"] = g.get("sport_type") or merged["sport_type"]
        merged["start_time"] = g.get("start_time") or merged["start_time"]
        merged["duration_secs"] = g.get("duration_secs") or merged["duration_secs"]
        merged["distance_meters"] = g.get("distance_meters") or merged["distance_meters"]
        merged["elevation_gain_meters"] = g.get("elevation_gain_meters") or merged["elevation_gain_meters"]
        merged["garmin_connect_url"] = g.get("garmin_connect_url") or merged["garmin_connect_url"]
    elif s:
        merged["title"] = s.get("title") or s.get("name") or merged["title"]
        merged["sport_type"] = s.get("sport_type") or merged["sport_type"]
        merged["start_time"] = s.get("start_date") or merged["start_time"]
        merged["duration_secs"] = s.get("elapsed_time") or s.get("moving_time") or merged["duration_secs"]
        merged["distance_meters"] = s.get("distance", 0) * 1000 if s.get("distance") else 0  # km -> m
        merged["elevation_gain_meters"] = s.get("total_elevation_gain") or 0.0
        merged["strava_url"] = s.get("strava_url") or merged["strava_url"]

    # ---- Power / HR ---- (Garmin wins if both have it)
    if g:
        g_power = g.get("avg_power") or 0
        g_np = g.get("normalized_power") or 0
        g_hr = g.get("avg_hr") or 0
        if g_power > 0:
            merged["avg_power"] = g_power
            merged["normalized_power"] = g_np or g_power
            merged["max_power"] = g.get("max_power") or 0
            merged["avg_hr"] = g_hr
            merged["max_hr"] = g.get("max_hr") or 0

    if s:
        s_power = s.get("average_power") or s.get("weighted_average_power") or 0
        s_hr = int(s.get("average_heartrate") or 0)
        # Only fill from Strava if Garmin didn't have power, or if Strava has NP
        if s_power > 0:
            if merged["avg_power"] == 0:
                merged["avg_power"] = s_power
                merged["normalized_power"] = s.get("normalized_power") or s_power
                merged["max_power"] = s.get("max_power") or 0
                merged["avg_hr"] = s_hr
                merged["max_hr"] = int(s.get("max_heartrate") or 0)
            elif s.get("normalized_power") and s.get("normalized_power") > merged.get("normalized_power", 0):
                # If Strava has NP and Garmin doesn't / is lower, use Strava's NP for IF calc
                merged["normalized_power"] = s.get("normalized_power")

        # HR fill from Strava if Garmin didn't have it
        if merged["avg_hr"] == 0 and s_hr > 0:
            merged["avg_hr"] = s_hr
            merged["max_hr"] = int(s.get("max_heartrate") or 0)

    # ---- Intensity Factor & TSS ----
    if merged["normalized_power"] > 0 and ftp > 0:
        merged["intensity_factor"] = round(merged["normalized_power"] / ftp, 2)
        duration_hours = merged["duration_secs"] / 3600.0
        merged["tss"] = int(round(duration_hours * (merged["normalized_power"] / ftp) ** 2 * 100))

    # ---- Speed ---- (Strava wins)
    if s:
        avg_speed = s.get("average_speed", 0) or 0
        max_speed = s.get("max_speed", 0) or 0
        if avg_speed > 0:
            merged["avg_speed"] = round(avg_speed, 1)
        if max_speed > 0:
            merged["max_speed"] = round(max_speed, 1)

    # ---- Extras from Strava ----
    if s:
        merged["kilojoules"] = s.get("kilojoules") or 0.0
        merged["suffer_score"] = s.get("suffer_score") or 0

    if g and not s:
        merged["source"] = "garmin"
    elif s and not g:
        merged["source"] = "strava"
    else:
        merged["source"] = source

    return merged
