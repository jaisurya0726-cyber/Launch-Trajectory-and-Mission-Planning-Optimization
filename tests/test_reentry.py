"""
Unit Tests for Atmospheric Re-entry Aerothermal Simulation Engine (unittest)
"""

import unittest
from simulation.reentry_simulation import (
    run_reentry_simulation,
    get_atmospheric_density,
    TPS_MATERIALS,
    REENTRY_PRESETS,
)

class TestReentrySimulation(unittest.TestCase):
    def test_atmospheric_density_profile(self):
        sea = get_atmospheric_density(0.0)
        self.assertTrue(1.20 <= sea["rho"] <= 1.25)
        self.assertTrue(285 <= sea["temp_k"] <= 290)

        strat = get_atmospheric_density(30.0)
        self.assertTrue(strat["rho"] < sea["rho"])
        self.assertTrue(strat["rho"] > 0.01)

        thermo = get_atmospheric_density(100.0)
        self.assertTrue(thermo["rho"] < 1e-4)

    def test_tps_materials_exist(self):
        expected = ["pica_x", "carbon_phenolic", "li_900_tiles", "rcc_composite", "sla_561v", "inconel_metallic"]
        for mat_id in expected:
            self.assertIn(mat_id, TPS_MATERIALS)
            mat = TPS_MATERIALS[mat_id]
            self.assertGreater(mat["density_kg_m3"], 0)
            self.assertGreater(mat["max_service_temp_c"], 500)
            self.assertGreater(mat["emissivity"], 0)

    def test_reentry_simulation_leo_nominal(self):
        res = run_reentry_simulation(
            entry_velocity_km_s=7.75,
            entry_flight_path_angle_deg=-1.75,
            vehicle_mass_kg=7800.0,
            nose_radius_m=1.8,
            tps_thickness_mm=45.0,
            material_id="pica_x"
        )
        traj = res["trajectory"]
        s = res["summary"]

        self.assertGreater(len(traj), 50)
        self.assertTrue(40.0 < s["peak_heat_flux_w_cm2"] < 400.0)
        self.assertTrue(1.5 < s["peak_deceleration_g"] < 8.0)
        self.assertGreater(s["peak_surface_temp_c"], 1000.0)
        self.assertTrue(200 < s["flight_time_s"] < 1000)

    def test_reentry_presets(self):
        for pid, preset in REENTRY_PRESETS.items():
            res = run_reentry_simulation(
                entry_velocity_km_s=preset["entry_velocity_km_s"],
                entry_flight_path_angle_deg=preset["entry_flight_path_angle_deg"],
                vehicle_mass_kg=preset["vehicle_mass_kg"],
                nose_radius_m=preset["nose_radius_m"],
                tps_thickness_mm=preset["tps_thickness_mm"],
                material_id=preset["material_id"]
            )
            self.assertGreater(res["summary"]["flight_time_s"], 0)
            self.assertGreater(res["summary"]["peak_heat_flux_w_cm2"], 0)

if __name__ == "__main__":
    unittest.main()
