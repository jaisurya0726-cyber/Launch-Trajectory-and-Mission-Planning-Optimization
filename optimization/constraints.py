"""
Constraints Module
Validates launch mission feasibility, structural limits, fuel margins,
aerospace dynamic pressure, and quantum binary choice rules.
"""

from typing import Dict, Any, List, Tuple
from models.mission_model import Mission

def check_mission_constraints(
    mission: Mission,
    fuel_consumed: float,
    max_acceleration_g: float = 5.2,
    max_risk_threshold: float = 65.0
) -> Tuple[bool, List[str], float]:
    """
    Check physical constraints for a mission configuration.
    Returns:
      (is_feasible, violation_messages, total_penalty)
    """
    violations = []
    penalty = 0.0

    # 1. Payload capacity
    if mission.payload_mass > mission.payload_capacity:
        excess = mission.payload_mass - mission.payload_capacity
        violations.append(f"Payload capacity exceeded by {excess:.1f} kg")
        penalty += (excess / mission.payload_capacity) * 200.0

    # 2. Fuel mass budget
    if fuel_consumed > mission.fuel_mass:
        deficit = fuel_consumed - mission.fuel_mass
        violations.append(f"Fuel requirement exceeds tank capacity by {deficit:.1f} kg")
        penalty += (deficit / mission.fuel_mass) * 300.0

    # 3. Acceleration g-limit
    if max_acceleration_g > 6.0:
        violations.append(f"Max acceleration {max_acceleration_g:.2f}g exceeds structural limit 6.0g")
        penalty += (max_acceleration_g - 6.0) * 80.0

    # 4. Risk threshold
    if mission.risk_score > max_risk_threshold:
        violations.append(f"Risk score {mission.risk_score:.1f} exceeds threshold {max_risk_threshold:.1f}")
        penalty += (mission.risk_score - max_risk_threshold) * 2.5

    # 5. Launch window duration
    if mission.launch_window_duration < 15:
        violations.append("Launch window too narrow (<15 min)")
        penalty += 50.0

    is_feasible = (len(violations) == 0)
    return is_feasible, violations, penalty


def check_qubo_binary_constraints(bitstring: str) -> Tuple[bool, List[str], float]:
    """
    Validates binary QUBO encoding:
    bit 0..2: exactly one launch window
    bit 3..5: exactly one trajectory
    bit 6..8: exactly one payload/fuel profile
    """
    violations = []
    penalty = 0.0

    if len(bitstring) < 9:
        return False, ["Bitstring length < 9"], 500.0

    window_bits = [int(bitstring[i]) for i in range(0, 3)]
    traj_bits = [int(bitstring[i]) for i in range(3, 6)]
    profile_bits = [int(bitstring[i]) for i in range(6, 9)]

    w_sum = sum(window_bits)
    if w_sum != 1:
        violations.append(f"Launch window choice violated: expected 1 selected, got {w_sum}")
        penalty += abs(w_sum - 1) * 150.0

    t_sum = sum(traj_bits)
    if t_sum != 1:
        violations.append(f"Trajectory profile violated: expected 1 selected, got {t_sum}")
        penalty += abs(t_sum - 1) * 150.0

    p_sum = sum(profile_bits)
    if p_sum != 1:
        violations.append(f"Fuel/Payload mode violated: expected 1 selected, got {p_sum}")
        penalty += abs(p_sum - 1) * 150.0

    is_feasible = (len(violations) == 0)
    return is_feasible, violations, penalty
