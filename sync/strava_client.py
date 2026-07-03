"""
Strava API v3 client wrapper.
Handles auth (with refresh token flow) and activity fetching.
"""
import os
import time
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Optional
from stravalib import Client

ATHLETE_ID = os.getenv("ATHLETE_ID", "charly")
STRAVA_CLIENT_ID = os.getenv("STRAVA_CLIENT_ID", "")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET", "")
STRAVA_ACCESS_TOKEN = os.getenv("STRAVA_ACCESS_TOKEN", "")
STRAVA_REFRESH_TOKEN = os.getenv("STRAVA_REFRESH_TOKEN", "")
STRAVA_TOKEN_EXPIRES_AT = int(os.getenv("STRAVA_TOKEN_EXPIRES_AT", "0"))

DB_PATH = os.getenv("DATABASE_URL", "/home/carlos/projects/cycling-peaks/backend/cycling.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def save_tokens(access_token: str, refresh_token: str, expires_at: int):
    conn = get_db()
    conn.execute("""
        INSERT OR REPLACE INTO strava_tokens (athlete_id, access_token, refresh_token, expires_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
    """, (ATHLETE_ID, access_token, refresh_token, expires_at))
    conn.commit()
    conn.close()


def load_tokens() -> Optional[dict]:
    """Load tokens from DB. Returns None if not found."""
    conn = get_db()
    row = conn.execute(
        "SELECT access_token, refresh_token, expires_at FROM strava_tokens WHERE athlete_id = ?", (ATHLETE_ID,)
    ).fetchone()
    conn.close()
    if row:
        return {
            "access_token": row["access_token"],
            "refresh_token": row["refresh_token"],
            "expires_at": row["expires_at"],
        }
    return None


def refresh_access_token(client: Client, refresh_token: str) -> Optional[dict]:
    """Refresh access token via Strava OAuth endpoint."""
    import urllib.request
    import urllib.parse
    try:
        data = urllib.parse.urlencode({
            "client_id": STRAVA_CLIENT_ID,
            "client_secret": STRAVA_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }).encode()

        req = urllib.request.Request(
            "https://www.strava.com/oauth/token",
            data=data,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())

        access_token = result.get("access_token")
        refresh_token = result.get("refresh_token")
        expires_at = result.get("expires_at")

        if access_token and expires_at:
            save_tokens(access_token, refresh_token, expires_at)
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "expires_at": expires_at,
            }
    except Exception as e:
        print(f"Token refresh failed: {e}")
    return None


def get_authorized_client() -> Optional[Client]:
    """Get an authorized Strava client, refreshing token if needed."""
    tokens = load_tokens()
    client = Client()

    if tokens:
        access_token = tokens["access_token"]
        expires_at = tokens["expires_at"]
        # Refresh if expires within 10 minutes
        if expires_at - int(time.time()) < 600:
            tokens = refresh_access_token(client, tokens["refresh_token"])
            if tokens:
                access_token = tokens["access_token"]
    else:
        # First run: use env vars
        access_token = STRAVA_ACCESS_TOKEN
        refresh_token = STRAVA_REFRESH_TOKEN
        expires_at = STRAVA_TOKEN_EXPIRES_AT

        if access_token:
            save_tokens(access_token, refresh_token, expires_at)

    if not access_token:
        print("ERROR: No Strava access token available")
        return None

    client.access_token = access_token
    return client


def athlete_info(client: Client) -> dict:
    """Get logged-in athlete info."""
    try:
        athlete = client.get_athlete()
        return {
            "id": athlete.id,
            "name": f"{athlete.firstname} {athlete.lastname}",
            "ftp": athlete.ftp,
        }
    except Exception as e:
        print(f"Error fetching athlete info: {e}")
        return {}


def get_cycling_activities(
    client: Client,
    after: datetime = None,
    before: datetime = None,
    limit: int = 200,
) -> list[dict]:
    """
    Fetch cycling activities from Strava.
    Returns list of activity dicts with consistent field names (similar to Garmin format).
    """
    if after is None:
        after = datetime.now() - timedelta(days=90)
    if before is None:
        before = datetime.now()

    try:
        activities = client.get_activities(
            after=after, before=before, limit=limit
        )

        result = []
        for a in activities:
            # Strava activity type filter
            sport_type = str(getattr(a, "type", "Ride") or "Ride").lower()
            if sport_type not in {"ride", "virtualride", "indoorcycling"}:
                continue

            # Handle NaiveDatetime vs timezone-aware
            start_date = getattr(a, "start_date", None)
            start_latlng = getattr(a, "start_latlng", None)

            act = {
                "id": str(a.id),
                "title": getattr(a, "name", "Cycling"),
                "sport_type": sport_type,
                "start_date": str(start_date) if start_date else "",
                "start_lat": start_latlng[0] if start_latlng else None,
                "start_lng": start_latlng[1] if start_latlng else None,
                "elapsed_time": int(getattr(a, "elapsed_time", 0) or 0),
                "moving_time": int(getattr(a, "moving_time", 0) or 0),
                "distance": float(getattr(a, "distance", 0) or 0),
                "total_elevation_gain": float(getattr(a, "total_elevation_gain", 0) or 0),
                "average_speed": float(getattr(a, "average_speed", 0) or 0),
                "max_speed": float(getattr(a, "max_speed", 0) or 0),
                "average_power": int(getattr(a, "average_watts", 0) or 0),
                # Strava only provides avg power if user has a power meter
                "weighted_average_power": int(getattr(a, "weighted_average_watts", 0) or 0),
                "max_power": 0,  # Not available in summary
                "average_heartrate": float(getattr(a, "average_heartrate", 0) or 0),
                "max_heartrate": float(getattr(a, "max_heartrate", 0) or 0),
                "intensity_factor": float(getattr(a, "intensity", 0) or 0),  # IF
                "kilojoules": float(getattr(a, "kilojoules", 0) or 0),
                "suffer_score": int(getattr(a, "suffer_score", 0) or 0),
                "strava_url": f"https://www.strava.com/activities/{a.id}",
            }
            result.append(act)

        print(f"Strava: fetched {len(result)} cycling activities")
        return result

    except Exception as e:
        print(f"Error fetching Strava activities: {e}")
        return []


def get_activity_details(client: Client, activity_id: str) -> dict:
    """
    Get detailed activity including per-stream data (power, HR, speed).
    Returns dict with power/hrmax arrays and computed averages.
    """
    try:
        activity = client.get_activity(activity_id)

        result = {
            "id": str(activity.id),
            "description": getattr(activity, "description", "") or "",
            "average_power": int(getattr(activity, "average_watts", 0) or 0),
            "weighted_average_power": int(getattr(activity, "weighted_average_watts", 0) or 0),
            "max_power": 0,
            "average_heartrate": float(getattr(activity, "average_heartrate", 0) or 0),
            "max_heartrate": float(getattr(activity, "max_heartrate", 0) or 0),
            "intensity_factor": float(getattr(activity, "intensity", 0) or 0),
            "kilojoules": float(getattr(activity, "kilojoules", 0) or 0),
        }

        # Try to get streams
        try:
            streams = client.get_activity_streams(
                activity_id,
                types=["power", "heartrate", "cadence", "distance", "velocity_smooth"],
                resolution="high",
            )

            powers = streams.get("power", [])
            hrs = streams.get("heartrate", [])

            if powers and len(powers) > 0:
                valid = [p for p in powers if p and p > 0]
                if valid:
                    result["average_power"] = int(sum(valid) / len(valid))
                    result["max_power"] = int(max(valid))
                    result["normalized_power"] = calculate_np(valid)
                else:
                    result["average_power"] = 0

            if hrs and len(hrs) > 0:
                valid = [h for h in hrs if h and h > 0]
                if valid:
                    result["average_heartrate"] = int(sum(valid) / len(valid))
                    result["max_heartrate"] = int(max(valid))

        except Exception as e:
            print(f"  Strava streams error for {activity_id}: {e}")

        return result

    except Exception as e:
        print(f"Error fetching Strava activity {activity_id}: {e}")
        return {}


def calculate_np(powers, window=30):
    """Normalized Power: rolling 30s avg, then ^4 avg, then ^0.25."""
    if not powers or len(powers) < window:
        return int(sum(powers) / len(powers)) if powers else 0
    rolling = []
    for i in range(len(powers) - window + 1):
        rolling.append(sum(powers[i:i + window]) / window)
    if not rolling:
        return int(sum(powers) / len(powers))
    return int((sum(r**4 for r in rolling) / len(rolling)) ** 0.25)
