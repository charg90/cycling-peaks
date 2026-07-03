"""
Unit tests for TSS, CTL, ATL, TSB calculators.
"""
import pytest
from calculators import (
    calculate_tss,
    calculate_ctl,
    calculate_atl,
    calculate_tsb,
    training_status,
)


class TestCalculateTSS:
    def test_standard_workout(self):
        """1 hour at FTP = TSS 100"""
        # 1 hour, NP=FTP=220, FTP=220
        tss = calculate_tss(duration_secs=3600, np=220, ftp=220)
        assert tss == 100

    def test_half_hour_at_ftp(self):
        """30 min at FTP = TSS 50"""
        tss = calculate_tss(duration_secs=1800, np=220, ftp=220)
        assert tss == 50

    def test_intensity_below_ftp(self):
        """1 hour at 80% FTP = TSS ~64"""
        tss = calculate_tss(duration_secs=3600, np=176, ftp=220)
        assert tss == 64

    def test_intensity_above_ftp(self):
        """1 hour at 120% FTP = TSS ~144"""
        tss = calculate_tss(duration_secs=3600, np=264, ftp=220)
        assert tss == 144

    def test_zero_ftp_returns_zero(self):
        assert calculate_tss(3600, 220, 0) == 0

    def test_zero_power_returns_zero(self):
        assert calculate_tss(3600, 0, 220) == 0

    def test_rounds_to_integer(self):
        """TSS should be a whole number"""
        tss = calculate_tss(duration_secs=2700, np=200, ftp=220)
        assert isinstance(tss, int)


class TestCalculateCTL:
    def test_single_workout(self):
        """CTL = TSS after first workout"""
        tss_history = [100]
        ctl = calculate_ctl(tss_history, days=30)
        assert ctl == 100.0

    def test_empty_history(self):
        assert calculate_ctl([]) == 0.0

    def test_ewma_weights_recent_more(self):
        """With 30-day K, recent workouts count more"""
        history = [50, 100, 150]  # oldest to newest
        ctl = calculate_ctl(history, days=30)
        # CTL should be between 50 and 150, closer to 150
        assert 50 < ctl < 150

    def test_30_day_decay_constant(self):
        """K = 2/(30+1) ~ 0.0645"""
        tss_history = [0] * 30 + [100]
        ctl = calculate_ctl(tss_history, days=30)
        # After 30 zeros, adding 100 should not bring CTL to 100 immediately
        assert ctl < 100


class TestCalculateATL:
    def test_seven_day_stress(self):
        """ATL with 7-day lookback"""
        history = [50, 60, 70, 80, 90, 100, 110]
        atl = calculate_atl(history, days=7)
        # Should be weighted toward recent values
        assert atl > 70

    def test_empty_history(self):
        assert calculate_atl([]) == 0.0


class TestCalculateTSB:
    def test_positive_tsb(self):
        """CTL > ATL = fresh"""
        tsb = calculate_tsb(ctl=80, atl=50)
        assert tsb == 30.0

    def test_negative_tsb(self):
        """CTL < ATL = fatigued"""
        tsb = calculate_tsb(ctl=50, atl=80)
        assert tsb == -30.0

    def test_zero_tsb(self):
        assert calculate_tsb(70, 70) == 0.0


class TestTrainingStatus:
    def test_fresh(self):
        assert training_status(30) == "fresh"
        assert training_status(100) == "fresh"

    def test_optimal(self):
        assert training_status(25) == "optimal"
        assert training_status(10) == "optimal"
        assert training_status(5) == "optimal"

    def test_borderline(self):
        assert training_status(4) == "borderline"
        assert training_status(-4) == "borderline"

    def test_overreaching(self):
        assert training_status(-10) == "overreaching"
        assert training_status(-24) == "overreaching"

    def test_unproductive(self):
        assert training_status(-30) == "unproductive"
        assert training_status(-100) == "unproductive"


class TestIntegration:
    def test_full_load_cycle(self):
        """Simulate 4 weeks of training and verify CTL/ATL/TSB"""
        # Week 1: moderate load
        tss_history = [80, 90, 85, 0, 0, 100, 95]  # 7 days

        ctl = calculate_ctl(tss_history, days=30)
        atl = calculate_atl(tss_history, days=7)
        tsb = calculate_tsb(ctl, atl)
        status = training_status(tsb)

        assert ctl > 0
        assert atl > 0
        assert isinstance(tsb, float)
        assert status in ["fresh", "optimal", "borderline", "overreaching", "unproductive"]

    def test_rested_after_week_off(self):
        """After a week off, TSB should be very high (fresh)"""
        # 7 days off
        tss_history = [80, 90, 85, 0, 0, 0, 0]

        ctl = calculate_ctl(tss_history, days=30)
        atl = calculate_atl(tss_history, days=7)
        tsb = calculate_tsb(ctl, atl)

        # ATL drops because recent days are zero
        # CTL stays elevated because the older workouts still count
        assert tsb > 0  # should be fresh
