"""
Calculate TSS, CTL, ATL, TSB from workout data.
Also power zones.
"""
import math
from datetime import datetime, date
from typing import List, Dict, Optional


def get_zones_from_ftp(ftp: int) -> List[Dict]:
    """
    Return power zone boundaries based on FTP.
    Zones: Z1<55%, Z2 55-75%, Z3 75-90%, Z4 90-105%, Z5 105-120%, Z6 120-150%, Z7>150%
    """
    return [
        {"zone": 1, "name": "Recovery",     "min": 0,      "max": int(ftp * 0.55)},
        {"zone": 2, "name": "Endurance",     "min": int(ftp * 0.55), "max": int(ftp * 0.75)},
        {"zone": 3, "name": "Tempo",         "min": int(ftp * 0.75), "max": int(ftp * 0.90)},
        {"zone": 4, "name": "Threshold",     "min": int(ftp * 0.90), "max": int(ftp * 1.05)},
        {"zone": 5, "name": "VO2max",        "min": int(ftp * 1.05), "max": int(ftp * 1.20)},
        {"zone": 6, "name": "Anaerobic",     "min": int(ftp * 1.20), "max": int(ftp * 1.50)},
        {"zone": 7, "name": "Neuromuscular", "min": int(ftp * 1.50), "max": 9999},
    ]


def calculate_power_zones(power_samples: List[int], ftp: int) -> Dict[str, int]:
    """
    Given a list of 1-second power samples and FTP, return seconds spent in each zone.
    Returns dict: {"z1": secs, "z2": secs, ..., "z7": secs, "total": secs}
    """
    import json
    if not power_samples:
        return {"z1": 0, "z2": 0, "z3": 0, "z4": 0, "z5": 0, "z6": 0, "z7": 0, "total": 0}

    zones = get_zones_from_ftp(ftp)
    counts = {z["zone"]: 0 for z in zones}

    for w in power_samples:
        for z in zones:
            if z["min"] <= w < z["max"]:
                counts[z["zone"]] += 1
                break

    return {
        "z1": counts[1],
        "z2": counts[2],
        "z3": counts[3],
        "z4": counts[4],
        "z5": counts[5],
        "z6": counts[6],
        "z7": counts[7],
        "total": len(power_samples),
    }


def format_zones_as_json(zones_dict: Dict[str, int]) -> str:
    """Serialize zone seconds dict to JSON string."""
    import json
    return json.dumps(zones_dict)


def calculate_tss(duration_secs: int, np: int, ftp: int) -> int:
    """
    Training Stress Score.
    TSS = duration_hours * (NP/FTP)^2 * 100
    """
    if ftp == 0 or np == 0 or duration_secs == 0:
        return 0
    duration_hours = duration_secs / 3600.0
    intensity_factor = np / ftp
    tss = duration_hours * intensity_factor ** 2 * 100
    return int(round(tss))


def calculate_ctl(tss_history: List[int], days: int = 30) -> float:
    """
    Chronic Training Load - exponentially weighted moving average.
    Livery 30-day average of daily TSS.
    """
    if not tss_history:
        return 0.0

    # EWMA with 30-day decay constant
    k = 2 / (days + 1)
    ctl = 0.0

    for i, tss in enumerate(tss_history):
        if i == 0:
            ctl = float(tss)
        else:
            ctl = k * float(tss) + (1 - k) * ctl

    return round(ctl, 1)


def calculate_atl(tss_history: List[int], days: int = 7) -> float:
    """
    Acute Training Load - 7-day stress.
    """
    if not tss_history:
        return 0.0

    k = 2 / (days + 1)
    atl = 0.0

    for i, tss in enumerate(tss_history):
        if i == 0:
            atl = float(tss)
        else:
            atl = k * float(tss) + (1 - k) * atl

    return round(atl, 1)


def calculate_tsb(ctl: float, atl: float) -> float:
    """Training Stress Balance = CTL - ATL."""
    return round(ctl - atl, 1)


def training_status(tsb: float) -> str:
    """Get training status from TSB value."""
    if tsb > 25:
        return "fresh"
    elif tsb >= 5:
        return "optimal"
    elif tsb >= -5:
        return "borderline"
    elif tsb >= -25:
        return "overreaching"
    else:
        return "unproductive"
