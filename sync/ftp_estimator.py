"""
FTP / Critical Power estimator using the power-duration model.

Model: P(t) = CP + W'/t
Where:
  CP  = Critical Power (≈ FTP at threshold, sustainable ~60min)
  W'  = W prime — anaerobic work capacity (kJ)

To estimate CP and W', we use three reference points from the workout data:
  - P30s: best 30-second average power (all-out sprint)
  - P5min: best 5-minute average power (VO2max range)
  - P20min: best 20-minute average power (threshold/FTP test range)

From the CP model:
  W' = P30s * (30 - P30s * 30 / P5min)
  CP = P30s² / P5min - W' / 30

Alternative using P20min:
  W' = P5min * (300 - P5min * 300 / P20min)
  CP = P5min² / P20min - W' / 300

We take the median of all valid CP estimates as the final FTP.
We also solve from TSS:  FTP = NP / √(TSS / (dur_h × 100))
This gives a third estimate, weighted lower since TSS may have been
computed with a wrong FTP.

Final FTP = weighted median of [CP_estimates, TSS_estimates].
"""

import math
from typing import List, Tuple, Optional
from statistics import median


def estimate_cp_from_p30_p5(p30: float, p5: float) -> Optional[float]:
    """Estimate CP from best 30s and best 5min power (in watts).

    CP model: P(t) = CP + W'/t
    For t=30s and t=5min:
      P30 = CP + W'/30
      P5  = CP + W'/300
    Solving:
      W' = P30 - P5 / (1 - 30/300) ... actually:
      From the two equations:
        W' = P30 * (30 - P30 * 30 / P5) is WRONG

    Correct derivation:
      W'/30 = P30 - CP
      W'/300 = P5 - CP
      W' = 30*(P30 - CP) = 300*(P5 - CP)
      30*P30 - 30*CP = 300*P5 - 300*CP
      270*CP = 300*P5 - 30*P30
      CP = (300*P5 - 30*P30) / 270 = (10*P5 - P30) / 9

    This requires P30 > P5 for a valid CP (short duration = higher power).
    """
    if p30 <= 0 or p5 <= 0 or p30 <= p5:
        return None
    try:
        CP = (10.0 * p5 - p30) / 9.0
        if CP <= 50 or CP > 500:
            return None
        return CP
    except (ZeroDivisionError, ValueError):
        return None


def estimate_cp_from_p5_p20(p5: float, p20: float) -> Optional[float]:
    """Estimate CP from best 5min and best 20min power (in watts).

    Same CP model, for t=300s and t=1200s:
      CP = (20*P20 - 5*P5) / 15

    Requires P5 > P20 (shorter = higher power for valid CP).
    """
    if p5 <= 0 or p20 <= 0 or p5 <= p20:
        return None
    try:
        CP = (20.0 * p20 - 5.0 * p5) / 15.0
        if CP <= 50 or CP > 500:
            return None
        return CP
    except (ZeroDivisionError, ValueError):
        return None


def estimate_ftp_from_tss(np: float, tss: float, duration_secs: int) -> Optional[float]:
    """
    Solve for FTP from the TSS formula:
      TSS = dur_h × (NP/FTP)² × 100
    Rearranged:
      FTP = NP × √(100 × dur_h / TSS)

    dur_h = duration_secs / 3600
    """
    if np <= 0 or tss <= 0 or duration_secs <= 0:
        return None
    dur_h = duration_secs / 3600.0
    try:
        ratio = 100.0 * dur_h / tss
        if ratio <= 0:
            return None
        ftp = np / math.sqrt(ratio)
        if ftp <= 50 or ftp > 600:
            return None
        return ftp
    except (ValueError, ZeroDivisionError):
        return None


def estimate_ftp(p30: float, p5: float, p20: float,
                 np: float, tss: float, duration_secs: int,
                 weights: Tuple[float, float, float] = (0.5, 0.3, 0.2)
                 ) -> Optional[float]:
    """
    Combine three estimation methods with configurable weights.

    Weights (CP from P30/P5, CP from P5/P20, from TSS) reflect:
      - CP model is most accurate when both P30 and P5 are real sprint values
      - P5/P20 more reliable for threshold-level athletes
      - TSS formula is approximate since TSS itself may use wrong FTP
    """
    cp1 = estimate_cp_from_p30_p5(p30, p5)
    cp2 = estimate_cp_from_p5_p20(p5, p20)
    ftp_tss = estimate_ftp_from_tss(np, tss, duration_secs)

    estimates = []
    w = []

    if cp1 is not None:
        estimates.append(cp1)
        w.append(weights[0])
    if cp2 is not None:
        estimates.append(cp2)
        w.append(weights[1])
    if ftp_tss is not None:
        estimates.append(ftp_tss)
        w.append(weights[2])

    if not estimates:
        return None

    # Weighted median (simple version: sort by value, use weighted mean of top 2)
    if len(estimates) == 1:
        return estimates[0]

    # For weighted median, sort by value and pick the one where
    # cumulative weight crosses 0.5
    sorted_pairs = sorted(zip(estimates, w), key=lambda x: x[0])
    total_w = sum(w for _, w in sorted_pairs)
    cumsum = 0.0
    for val, weight in sorted_pairs:
        cumsum += weight
        if cumsum >= total_w / 2.0:
            return val

    return sorted_pairs[-1][0]


def estimate_from_workout_summary(workouts: List[dict]) -> Optional[float]:
    """
    Given a list of workout dicts with keys:
      max_power_30s, max_power_5min, max_power_20min,
      normalized_power, tss, duration_secs

    Return the best FTP estimate.
    """
    estimates = []

    for w in workouts:
        p30 = w.get('max_power_30s', 0)
        p5 = w.get('max_power_5min', 0)
        p20 = w.get('max_power_20min', 0)
        np = w.get('normalized_power', 0)
        tss = w.get('tss', 0)
        dur = w.get('duration_secs', 0)

        est = estimate_ftp(p30, p5, p20, np, tss, dur)
        if est is not None:
            estimates.append(est)

    if not estimates:
        return None

    # Take the 75th percentile of all estimates — robust to outliers,
    # higher than median (FTP should be near the top of threshold efforts)
    estimates.sort()
    idx = int(len(estimates) * 0.75)
    return estimates[min(idx, len(estimates) - 1)]
