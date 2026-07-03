"""
Garmin Connect client wrapper.
"""
import os
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

try:
    from garminconnect import Garmin
except ImportError:
    raise ImportError("garminconnect not installed")


CYCLING_TYPES = {"road_biking", "virtual_ride", "cycling", "indoor_cycling", "mountain_biking"}


class GarminClient:
    def __init__(self, email: str = None, password: str = None):
        self.email = email or os.getenv("GARMIN_EMAIL")
        self.password = password or os.getenv("GARMIN_PASSWORD")
        self.client = None

    def login(self) -> bool:
        try:
            self.client = Garmin(self.email, self.password)
            self.client.login()
            print(f"Logged in as {self.email}")
            return True
        except Exception as e:
            print(f"Login failed: {e}")
            return False

    def get_cycling_activities(
        self,
        start_date: datetime = None,
        end_date: datetime = None,
        limit: int = 200
    ) -> List[Dict[str, Any]]:
        if not self.client:
            if not self.login():
                return []

        if not end_date:
            end_date = datetime.now()
        if not start_date:
            start_date = end_date - timedelta(days=90)

        try:
            activities = self.client.get_activities_by_date(
                start_date.strftime("%Y-%m-%d"),
                end_date.strftime("%Y-%m-%d")
            )
            cycling = [
                a for a in activities
                if str(a.get("activityType", {}).get("typeKey", "")).lower() in CYCLING_TYPES
            ]
            print(f"Found {len(cycling)} cycling activities (from {len(activities)} total)")
            return cycling
        except Exception as e:
            print(f"Error fetching activities: {e}")
            return []

    def get_power_and_hr(self, activity_id: int) -> Dict[str, Any]:
        """Extract power and HR from activity details. Returns avg/max for both."""
        if not self.client:
            return {}

        time.sleep(1)  # Rate limit protection

        try:
            details = self.client.get_activity_details(activity_id)

            # metricDescriptors use list order, NOT metricsIdx
            descriptors = details.get("metricDescriptors", [])
            pos_map = {d.get("key"): i for i, d in enumerate(descriptors)}

            power_idx = pos_map.get("directPower")
            hr_idx = pos_map.get("directHeartRate")

            metrics_data = details.get("activityDetailMetrics", [])

            powers = []
            hrrs = []

            for row in metrics_data:
                if not isinstance(row, dict):
                    continue
                arr = row.get("metrics", [])
                if not isinstance(arr, list):
                    continue
                if power_idx is not None and len(arr) > power_idx:
                    p = arr[power_idx]
                    if isinstance(p, (int, float)) and p > 0:
                        powers.append(float(p))
                if hr_idx is not None and len(arr) > hr_idx:
                    h = arr[hr_idx]
                    if isinstance(h, (int, float)) and h > 0:
                        hrrs.append(float(h))

            result = {}
            if powers:
                result["avg_power"] = int(sum(powers) / len(powers))
                result["max_power"] = int(max(powers))
                # NP = rolling 30s average of powers, then avg of those averages
                np_val = self._calculate_np(powers)
                result["normalized_power"] = np_val
            if hrrs:
                result["avg_hr"] = int(sum(hrrs) / len(hrrs))
                result["max_hr"] = int(max(hrrs))

            return result

        except Exception as e:
            print(f"  Error getting power/hr for {activity_id}: {e}")
            return {}

    def _calculate_np(self, powers: List[float], window: int = 30) -> int:
        """Calculate Normalized Power from power array."""
        if not powers or len(powers) < window:
            return int(sum(powers) / len(powers)) if powers else 0
        
        # Rolling average over window
        rolling_avg = []
        for i in range(len(powers) - window + 1):
            window_avg = sum(powers[i:i+window]) / window
            rolling_avg.append(window_avg)
        
        # NP = average of those rolling averages, then ^4, then ^0.25
        if not rolling_avg:
            return int(sum(powers) / len(powers))
        
        np_raw = sum(rolling_avg) / len(rolling_avg)
        np_4 = np_raw ** 4
        return int(np_4 ** 0.25)
