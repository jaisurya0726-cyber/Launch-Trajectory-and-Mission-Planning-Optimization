"""
QUBO Model Module
Formulates Quadratic Unconstrained Binary Optimization (QUBO) problem
and Ising Hamiltonian representation for aerospace launch optimization.
"""

from typing import Dict, Any, List, Tuple
from models.mission_model import Mission

VARIABLE_LABELS = [
    "x1_win_early",       # Window Early (-15 min)
    "x2_win_mid",         # Window Mid (Nominal)
    "x3_win_late",        # Window Late (+15 min)
    "x4_traj_direct",     # Trajectory Direct Ascent
    "x5_traj_gravity",    # Trajectory Gravity Turn
    "x6_traj_multistage", # Trajectory Multi-Stage Ascent
    "x7_mode_conserv",    # Mode Conservative (+5% fuel margin)
    "x8_mode_nominal",    # Mode Nominal
    "x9_mode_aggressive"  # Mode Aggressive (-5% fuel margin)
]

def build_qubo_matrix(
    mission: Mission,
    penalty_window: float = 120.0,
    penalty_trajectory: float = 120.0,
    penalty_mode: float = 120.0,
    penalty_risk: float = 80.0
) -> Dict[str, Any]:
    """
    Constructs 9x9 symmetric QUBO matrix Q such that:
    Cost(x) = sum_i Q_ii x_i + sum_{i < j} Q_ij x_i x_j
    Minimizing Cost(x) satisfies exactly-one selection in each group and
    minimizes multi-objective mission cost.
    """
    n = 9
    Q = [[0.0 for _ in range(n)] for _ in range(n)]

    # 1. Objective individual costs (Linear diagonal terms)
    # Window costs: Early (favorable wind/temp), Mid, Late
    w_costs = [18.0 - (mission.wind_speed * 0.4), 22.0, 28.0 + (mission.rain * 0.8)]
    # Trajectory costs: Direct, Gravity Turn (best fuel efficiency), Multi-Stage
    t_costs = [35.0, 16.0, 24.0]
    if mission.target_orbit in ["GEO", "GTO", "Highly Elliptical Orbit"]:
        t_costs[0] += 50.0  # Direct ascent strongly penalized for high orbits
    # Mode costs: Conservative (higher fuel mass), Nominal, Aggressive (low fuel mass, slightly higher risk)
    m_costs = [28.0, 20.0, 15.0 + (mission.risk_score * 0.25)]

    for i in range(3):
        Q[i][i] += w_costs[i]
    for i in range(3):
        Q[i + 3][i + 3] += t_costs[i]
    for i in range(3):
        Q[i + 6][i + 6] += m_costs[i]

    # 2. Penalty: (sum_{i in group} x_i - 1)^2 = sum x_i + 2 sum_{i < j} x_i x_j - 1
    # Adding P * sum x_i to diagonal, 2P to off-diagonals (offset of +P is constant)
    groups = [
        (0, 1, 2, penalty_window),
        (3, 4, 5, penalty_trajectory),
        (6, 7, 8, penalty_mode)
    ]

    for start_idx, mid_idx, end_idx, P in groups:
        indices = [start_idx, mid_idx, end_idx]
        for idx in indices:
            # -2P from expansion (-2P x_i) + P from x_i^2 = -P x_i
            Q[idx][idx] += -P
        for i_idx in range(len(indices)):
            for j_idx in range(i_idx + 1, len(indices)):
                a = indices[i_idx]
                b = indices[j_idx]
                Q[a][b] += 2.0 * P
                Q[b][a] += 2.0 * P

    # 3. Cross-coupling domain penalties (Interactions between choices)
    # Late window + Direct ascent during high wind creates compounding risk
    if mission.wind_speed > 12.0:
        Q[2][3] += penalty_risk * 0.6
        Q[3][2] += penalty_risk * 0.6

    # Aggressive fuel mode + Direct ascent is physically unfeasible
    Q[3][8] += 75.0
    Q[8][3] += 75.0

    # High payload ratio + Aggressive mode penalty
    if mission.payload_mass / mission.payload_capacity > 0.85:
        Q[6][8] += 60.0
        Q[8][6] += 60.0

    # Round matrix values for numerical cleanliness
    for i in range(n):
        for j in range(n):
            Q[i][j] = round(Q[i][j], 2)

    # Calculate constant energy offset (3 groups * P)
    offset = penalty_window + penalty_trajectory + penalty_mode

    # Convert to Ising Hamiltonian: x_i = (1 - Z_i) / 2
    # H_Ising = sum_i h_i Z_i + sum_{i < j} J_ij Z_i Z_j + constant
    ising_h = [0.0] * n
    ising_J = [[0.0 for _ in range(n)] for _ in range(n)]
    ising_offset = offset

    for i in range(n):
        ising_h[i] -= 0.5 * Q[i][i]
        ising_offset += 0.5 * Q[i][i]
        for j in range(i + 1, n):
            j_term = 0.25 * (Q[i][j] + Q[j][i])
            ising_J[i][j] = j_term
            ising_J[j][i] = j_term
            ising_h[i] -= 0.25 * (Q[i][j] + Q[j][i])
            ising_h[j] -= 0.25 * (Q[i][j] + Q[j][i])
            ising_offset += 0.25 * (Q[i][j] + Q[j][i])

    ising_h = [round(val, 3) for val in ising_h]
    for i in range(n):
        for j in range(n):
            ising_J[i][j] = round(ising_J[i][j], 3)

    return {
        "num_qubits": n,
        "variables": VARIABLE_LABELS,
        "qubo_matrix": Q,
        "qubo_offset": round(offset, 2),
        "ising_h": ising_h,
        "ising_J": ising_J,
        "ising_offset": round(ising_offset, 3),
        "penalty_parameters": {
            "penalty_window": penalty_window,
            "penalty_trajectory": penalty_trajectory,
            "penalty_mode": penalty_mode,
            "penalty_risk": penalty_risk
        }
    }


def evaluate_qubo_energy(bitstring: str, qubo_matrix: List[List[float]], offset: float = 0.0) -> float:
    """Evaluate E(x) = sum_i Q_ii x_i + sum_{i<j} (Q_ij + Q_ji) x_i x_j + offset."""
    x = [int(b) for b in bitstring]
    n = len(x)
    energy = offset
    for i in range(n):
        if x[i] == 1:
            energy += qubo_matrix[i][i]
            for j in range(i + 1, n):
                if x[j] == 1:
                    energy += qubo_matrix[i][j] + qubo_matrix[j][i]
    return round(energy, 4)
