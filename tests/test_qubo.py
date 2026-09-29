"""
Tests for QUBO Formulation and QAOA Decoding
"""

import unittest
from optimization.qubo_model import build_qubo_matrix, evaluate_qubo_energy
from optimization.constraints import check_qubo_binary_constraints
from optimization.qaoa_optimizer import decode_bitstring_to_mission, run_qaoa_simulation
from preprocessing.preprocess import load_missions

class TestQUBO(unittest.TestCase):

    def setUp(self):
        self.missions = load_missions()
        self.mission = self.missions[0]
        self.qubo = build_qubo_matrix(self.mission)

    def test_qubo_dimensions(self):
        """QUBO matrix must be 9x9."""
        Q = self.qubo["qubo_matrix"]
        self.assertEqual(len(Q), 9)
        for row in Q:
            self.assertEqual(len(row), 9)

    def test_binary_constraints(self):
        """Valid bitstring has exactly one '1' in each 3-bit block."""
        valid_bs = "010010010"
        is_feas, viols, pen = check_qubo_binary_constraints(valid_bs)
        self.assertTrue(is_feas)
        self.assertEqual(len(viols), 0)
        self.assertEqual(pen, 0.0)

        invalid_bs = "110000010"  # two 1s in first group, zero in second
        is_feas2, viols2, pen2 = check_qubo_binary_constraints(invalid_bs)
        self.assertFalse(is_feas2)
        self.assertGreater(pen2, 0.0)

    def test_qaoa_simulation_run(self):
        """QAOA must execute and return 9-bit decoded plan."""
        qaoa_res = run_qaoa_simulation(self.mission, p_layers=1, shots=256)
        self.assertEqual(len(qaoa_res["best_bitstring"]), 9)
        self.assertIn("fuel_consumption_kg", qaoa_res["decoded_plan"])
        self.assertIn("objective_value", qaoa_res["decoded_plan"])

if __name__ == "__main__":
    unittest.main()
