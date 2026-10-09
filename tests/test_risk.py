"""
Unit Tests for Launch Risk Assessment Engine (unittest)
"""

import unittest
from simulation.risk_assessment import assess_launch_window_risk, normal_cdf

class TestRiskAssessment(unittest.TestCase):
    def test_normal_cdf(self):
        self.assertLess(abs(normal_cdf(0.0, 0.0, 1.0) - 0.5), 1e-4)
        self.assertGreater(normal_cdf(3.0, 0.0, 1.0), 0.99)
        self.assertLess(normal_cdf(-3.0, 0.0, 1.0), 0.01)

    def test_launch_risk_assessment_calm_conditions(self):
        res = assess_launch_window_risk(
            temperature_c=25.0,
            wind_speed_ms=4.0,
            rain_mm_hr=0.0,
            humidity_pct=40.0,
            cloud_cover_pct=10.0,
            gust_factor=1.1,
        )
        self.assertLess(res["composite_risk_pct"], 30.0)
        self.assertIn("GO", res["safety_status"])
        self.assertGreater(res["go_probability_pct"], 70.0)
        self.assertGreaterEqual(len(res["rules"]), 4)

    def test_launch_risk_assessment_high_wind_scrub(self):
        res = assess_launch_window_risk(
            wind_speed_ms=22.0,  # exceeds 15 m/s limit
            gust_factor=1.5,
        )
        self.assertGreater(res["composite_risk_pct"], 50.0)
        self.assertGreater(res["breakdown"]["wind_risk_pct"], 60.0)

if __name__ == "__main__":
    unittest.main()
