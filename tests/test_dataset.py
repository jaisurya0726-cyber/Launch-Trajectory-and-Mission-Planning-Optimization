"""
Tests for Dataset Generation and Integrity
"""

import unittest
import os
from data.generate_dataset import generate_mission_record, validate_record, generate_dataset
from preprocessing.preprocess import ensure_dataset, load_missions

class TestDataset(unittest.TestCase):

    def setUp(self):
        self.data_path = ensure_dataset(num_records=500)
        self.missions = load_missions(self.data_path)

    def test_record_count(self):
        """Dataset must contain at least 300 records."""
        self.assertGreaterEqual(len(self.missions), 300)

    def test_record_fields(self):
        """All specified fields must be present and well-formed."""
        sample = self.missions[0]
        self.assertTrue(sample.mission_id.startswith("M"))
        self.assertIn(sample.data_type, ["Reference", "Synthetic"])
        self.assertGreater(sample.rocket_mass, 0)
        self.assertGreater(sample.fuel_mass, 0)
        self.assertGreater(sample.payload_mass, 0)
        self.assertLessEqual(sample.payload_mass, sample.payload_capacity * 1.02)
        self.assertGreater(sample.delta_v, 0)
        self.assertGreater(sample.flight_time, 0)
        self.assertGreaterEqual(sample.risk_score, 0.0)
        self.assertLessEqual(sample.risk_score, 100.0)
        self.assertIn(sample.safety_status, ["SAFE", "MODERATE RISK", "HIGH RISK / HOLD ADVISORY"])

    def test_validation_function(self):
        """validate_record correctly checks constraints."""
        valid_rec = generate_mission_record(0)
        self.assertTrue(validate_record(valid_rec))

        invalid_rec = dict(valid_rec)
        invalid_rec["payload_mass"] = -10.0
        self.assertFalse(validate_record(invalid_rec))

if __name__ == "__main__":
    unittest.main()
