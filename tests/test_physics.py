"""
Tests for Aerospace Physics Calculations
"""

import unittest
import math
from models.trajectory_model import (
    gravity_at_altitude,
    atmospheric_density,
    aerodynamic_drag,
    G0,
    EARTH_RADIUS_M
)
from models.orbit_model import create_target_orbit, Orbit
from models.rocket_model import get_rocket_by_name
from simulation.trajectory_simulation import simulate_trajectory
from preprocessing.preprocess import load_missions

class TestPhysics(unittest.TestCase):

    def test_gravity_inversion(self):
        """Gravity must decrease with altitude: g(h) < g(0)."""
        g_surface = gravity_at_altitude(0.0)
        g_leo = gravity_at_altitude(400000.0)  # 400 km
        self.assertAlmostEqual(g_surface, 9.81, places=1)
        self.assertLess(g_leo, g_surface)
        self.assertGreater(g_leo, 8.0)

    def test_density_exponential_decay(self):
        """Density must decrease monotonically with altitude."""
        rho_0 = atmospheric_density(0.0)
        rho_10k = atmospheric_density(10000.0)
        rho_100k = atmospheric_density(100000.0)
        self.assertGreater(rho_0, rho_10k)
        self.assertGreater(rho_10k, rho_100k)

    def test_drag_force(self):
        """Drag must be zero when velocity is zero and scale quadratically."""
        drag_0 = aerodynamic_drag(0.0, 1000.0, 0.3, 10.0)
        self.assertEqual(drag_0, 0.0)
        drag_100 = aerodynamic_drag(100.0, 1000.0, 0.3, 10.0)
        drag_200 = aerodynamic_drag(200.0, 1000.0, 0.3, 10.0)
        self.assertAlmostEqual(drag_200 / drag_100, 4.0, places=1)

    def test_orbit_velocity(self):
        """LEO circular velocity must be approximately 7.5 - 7.8 km/s."""
        orbit = create_target_orbit("LEO", altitude=400.0)
        self.assertGreater(orbit.circular_velocity, 7.5)
        self.assertLess(orbit.circular_velocity, 7.8)

    def test_trajectory_simulation(self):
        """Simulation must produce non-empty telemetry and positive final altitude."""
        missions = load_missions()
        traj = simulate_trajectory(missions[0], time_step=5.0)
        self.assertGreater(len(traj["time"]), 10)
        self.assertGreater(traj["summary"]["max_altitude_km"], 50.0)

if __name__ == "__main__":
    unittest.main()
