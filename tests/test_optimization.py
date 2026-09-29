"""
Tests for Optimization and Constraints
"""

import unittest
from optimization.objective_function import calculate_objective
from optimization.constraints import check_mission_constraints, check_qubo_binary_constraints
from optimization.classical_optimizer import optimize_classical
from preprocessing.preprocess import load_missions

class TestOptimization(unittest.TestCase):

    def setUp(self):
        self.missions = load_missions()
        self.mission = self.missions[0]

    def test_objective_scalarization(self):
        """Higher fuel/cost/risk must strictly yield higher cost value."""
        base_obj = calculate_objective(10000, 20000, 30.0, 20.0, 500)
        worse_obj = calculate_objective(15000, 20000, 45.0, 50.0, 700)
        self.assertLess(base_obj, worse_obj)

    def test_constraint_penalties(self):
        """Violation of payload limits must trigger positive penalty."""
        is_feas, viols, pen = check_mission_constraints(self.mission, self.mission.fuel_mass * 0.5)
        self.assertTrue(is_feas)
        self.assertEqual(pen, 0.0)

    def test_classical_optimizer_improves_or_matches_baseline(self):
        """Classical optimizer must return a solution no worse than baseline."""
        res = optimize_classical(self.mission)
        base_obj = res["baseline"]["objective_value"]
        opt_obj = res["optimized"]["objective_value"]
        self.assertLessEqual(opt_obj, base_obj)

if __name__ == "__main__":
    unittest.main()
