"""
Streamlit Application: Launch Trajectory & Mission-Planning Quantum Optimization Dashboard
Implements the 8 required pages with interactive parameter controls,
trajectory plots, classical optimization, QUBO matrices, QAOA quantum distribution,
and comparison tables.
"""

import sys
import os
import csv
import json

# Add root directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from preprocessing.preprocess import load_missions, get_mission_by_id, ensure_dataset
from simulation.trajectory_simulation import simulate_trajectory
from optimization.classical_optimizer import optimize_classical
from optimization.qubo_model import build_qubo_matrix
from optimization.qaoa_optimizer import run_qaoa_simulation
from evaluation.comparison import generate_comparison_table

def run_streamlit_app():
    try:
        import streamlit as st
    except ImportError:
        print("Streamlit is not installed in this environment. Run 'pip install streamlit' to view the UI.")
        return

    st.set_page_config(
        page_title="Launch Trajectory Quantum Optimization",
        page_icon="🚀",
        layout="wide"
    )

    st.title("🚀 Launch Trajectory & Mission-Planning Optimization")
    st.markdown("##### *Quantum & Classical Hybrid Aerospace Optimization Platform*")

    st.info(
        "**Scientific Disclaimer**: This project is an academic simulation using simplified aerospace models "
        "and synthetic/educational data. It is intended for research and demonstration of optimization techniques "
        "and is not a flight-certified launch guidance, navigation, or mission-control system."
    )

    ensure_dataset()
    missions = load_missions()

    # Sidebar Navigation: 8 Required Pages
    pages = [
        "1. Mission Selection",
        "2. Mission Parameters",
        "3. Trajectory Simulation",
        "4. Classical Optimization",
        "5. QUBO Formulation",
        "6. QAOA Quantum Optimization",
        "7. Classical vs Quantum Comparison",
        "8. Final Mission Plan & Exports"
    ]
    selected_page = st.sidebar.radio("Navigation Console", pages)

    # Mission Selector in sidebar
    st.sidebar.markdown("---")
    st.sidebar.subheader("Active Mission")
    mission_ids = [f"{m.mission_id} - {m.satellite_name} ({m.rocket})" for m in missions[:80]]
    chosen_str = st.sidebar.selectbox("Select Mission", mission_ids, index=0)
    current_m_id = chosen_str.split(" - ")[0]
    mission = get_mission_by_id(current_m_id)

    if not mission:
        st.error("Mission not found.")
        return

    # PAGE 1: MISSION SELECTION
    if selected_page.startswith("1."):
        st.header("Page 1: Mission Selection & Catalog Browser")
        st.markdown(f"**Loaded Missions in Database:** {len(missions)} records (Synthetically and physically informed)")

        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Mission ID", mission.mission_id)
            st.metric("Satellite", mission.satellite_name)
        with col2:
            st.metric("Rocket", mission.rocket)
            st.metric("Data Type", mission.data_type)
        with col3:
            st.metric("Target Orbit", mission.target_orbit)
            st.metric("Altitude", f"{mission.altitude} km")
        with col4:
            st.metric("Launch Site", mission.launch_site)
            st.metric("Safety Status", mission.safety_status)

        st.subheader("Mission Catalog Overview")
        filter_col1, filter_col2 = st.columns(2)
        with filter_col1:
            orbit_filter = st.selectbox("Filter Orbit", ["All"] + list(set(m.target_orbit for m in missions)))
        with filter_col2:
            rocket_filter = st.selectbox("Filter Rocket", ["All"] + list(set(m.rocket for m in missions)))

        filtered_table = []
        for m in missions:
            if (orbit_filter == "All" or m.target_orbit == orbit_filter) and (rocket_filter == "All" or m.rocket == rocket_filter):
                filtered_table.append({
                    "ID": m.mission_id,
                    "Satellite": m.satellite_name,
                    "Type": m.data_type,
                    "Rocket": m.rocket,
                    "Orbit": m.target_orbit,
                    "Altitude (km)": m.altitude,
                    "Payload (kg)": m.payload_mass,
                    "Cost ($M)": m.launch_cost,
                    "Risk Score": m.risk_score,
                    "Status": m.safety_status
                })

        st.dataframe(filtered_table[:25], use_container_width=True)

    # PAGE 2: MISSION PARAMETERS
    elif selected_page.startswith("2."):
        st.header(f"Page 2: Physical Parameters — {mission.mission_id} ({mission.satellite_name})")
        col1, col2 = st.columns(2)

        with col1:
            st.subheader("Launch Vehicle & Mass Specs")
            st.write(f"- **Rocket:** {mission.rocket}")
            st.write(f"- **Rocket Dry Mass:** {mission.rocket_mass:,.0f} kg")
            st.write(f"- **Propellant Mass:** {mission.fuel_mass:,.0f} kg")
            st.write(f"- **Payload Mass:** {mission.payload_mass:,.0f} kg (Cap: {mission.payload_capacity:,.0f} kg)")
            st.write(f"- **Sea-Level Thrust:** {mission.thrust:,.0f} kN")
            st.write(f"- **Specific Impulse (Isp):** {mission.specific_impulse} s")
            st.write(f"- **Thrust-to-Weight Ratio (TWR):** {mission.thrust_to_weight_ratio:.2f}")

        with col2:
            st.subheader("Atmospheric, Orbit & Weather Conditions")
            st.write(f"- **Launch Site:** {mission.launch_site}")
            st.write(f"- **Target Orbit:** {mission.target_orbit} (Inc: {mission.inclination}°, Alt: {mission.altitude} km)")
            st.write(f"- **Mission Delta-V Required:** {mission.delta_v:.2f} km/s")
            st.write(f"- **Estimated Flight Time:** {mission.flight_time} s ({mission.flight_time // 60}m {mission.flight_time % 60}s)")
            st.write(f"- **Surface Temperature:** {mission.weather_temperature} °C")
            st.write(f"- **Wind Speed:** {mission.wind_speed} m/s")
            st.write(f"- **Precipitation:** {mission.rain} mm/hr | Humidity: {mission.humidity}%")
            st.write(f"- **Composite Risk Score:** {mission.risk_score:.1f} / 100 ({mission.safety_status})")

    # PAGE 3: TRAJECTORY SIMULATION
    elif selected_page.startswith("3."):
        st.header(f"Page 3: Trajectory Simulation — {mission.satellite_name}")
        with st.spinner("Running Runge-Kutta 4th-Order Integration..."):
            traj = simulate_trajectory(mission)

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Max Altitude", f"{traj['summary']['max_altitude_km']:.1f} km")
        col2.metric("Final Velocity", f"{traj['summary']['final_velocity_ms']:,.0f} m/s")
        col3.metric("Max Acceleration", f"{traj['summary']['max_acceleration_g']:.2f} g")
        col4.metric("Burn Duration", f"{traj['summary']['burn_time_sec']:.0f} s")

        st.subheader("Ascent Flight Telemetry Charts")
        st.line_chart({
            "Altitude (km)": traj["altitude_km"],
            "Velocity (x10 m/s)": [v / 10.0 for v in traj["velocity_ms"]]
        })

        st.line_chart({
            "Fuel Remaining (kg)": traj["fuel_remaining_kg"],
            "Dynamic Pressure (kPa)": traj["dynamic_pressure_kPa"],
            "Acceleration (g)": traj["accel_g"]
        })

    # PAGE 4: CLASSICAL OPTIMIZATION
    elif selected_page.startswith("4."):
        st.header(f"Page 4: Classical Optimization — {mission.satellite_name}")
        with st.spinner("Executing Differential Search & Combinatorial Refinement..."):
            classical_res = optimize_classical(mission)

        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Baseline Parameters")
            b = classical_res["baseline"]
            st.write(f"- Objective: **{b['objective_value']:.4f}**")
            st.write(f"- Fuel Consumed: **{b['fuel_consumption_kg']:,.1f} kg**")
            st.write(f"- Launch Cost: **${b['launch_cost_musd']:.2f} M**")
            st.write(f"- Risk Score: **{b['risk_score']:.1f}**")
            st.write(f"- Delta-V: **{b['delta_v_kms']:.3f} km/s**")
        with col2:
            st.subheader("Classically Optimized Solution")
            opt = classical_res["optimized"]
            sel = classical_res["selected_configuration"]
            st.write(f"- Objective: **{opt['objective_value']:.4f}** ({classical_res['objective_improvement_pct']}% improvement)")
            st.write(f"- Fuel Consumed: **{opt['fuel_consumption_kg']:,.1f} kg**")
            st.write(f"- Launch Cost: **${opt['launch_cost_musd']:.2f} M**")
            st.write(f"- Risk Score: **{opt['risk_score']:.1f}**")
            st.write(f"- Selected Window: **{sel['window_name']}**")
            st.write(f"- Selected Trajectory: **{sel['trajectory_name']}**")
            st.write(f"- Selected Mode: **{sel['mode_name']}**")

        st.caption(f"Classical optimizer evaluated {classical_res['iterations']} candidates in {classical_res['execution_time_ms']} ms.")

    # PAGE 5: QUBO FORMULATION
    elif selected_page.startswith("5."):
        st.header("Page 5: QUBO Matrix & Binary Formulation")
        st.markdown(
            "Mapping discrete aerospace choices to binary decision vector $\\vec{x} \\in \\{0, 1\\}^9$:\n"
            "- $x_1, x_2, x_3$: Launch Window (Early, Mid, Late)\n"
            "- $x_4, x_5, x_6$: Trajectory Profile (Direct Ascent, Gravity Turn, Multi-Stage)\n"
            "- $x_7, x_8, x_9$: Fuel/Payload Mode (Conservative, Nominal, Aggressive)"
        )
        qubo_data = build_qubo_matrix(mission)
        st.subheader("9x9 Symmetric QUBO Matrix Q")
        st.write("Variables:", qubo_data["variables"])
        st.dataframe(qubo_data["qubo_matrix"], use_container_width=True)
        st.write(f"**Energy Offset (Constant):** {qubo_data['qubo_offset']}")

    # PAGE 6: QAOA QUANTUM OPTIMIZATION
    elif selected_page.startswith("6."):
        st.header("Page 6: QAOA Quantum Circuit & Statevector Simulation")
        p_layers = st.slider("QAOA Circuit Layers (p)", min_value=1, max_value=3, value=1)
        shots = st.select_slider("Measurement Shots", options=[256, 512, 1024, 2048], value=1024)

        with st.spinner("Executing QAOA Quantum Simulation..."):
            qaoa_res = run_qaoa_simulation(mission, p_layers=p_layers, shots=shots)

        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Quantum Circuit Specification")
            cs = qaoa_res["circuit_summary"]
            st.write(f"- **Qubits:** {cs['num_qubits']} ($2^9 = 512$ dimensional Hilbert space)")
            st.write(f"- **Layers (p):** {cs['layers_p']}")
            st.write(f"- **Optimal γ (gamma):** {cs['gamma_parameters']}")
            st.write(f"- **Optimal β (beta):** {cs['beta_parameters']}")
            st.write(f"- **Gate Counts:** {cs['gate_counts']}")
            st.write(f"- **Simulation Time:** {qaoa_res['execution_time_ms']} ms")

        with col2:
            st.subheader("Optimal Sampled Solution")
            st.write(f"- **Best Bitstring:** `{qaoa_res['best_bitstring']}`")
            cand = qaoa_res["best_candidate"]
            st.write(f"- **Sample Frequency:** {cand['shots']} / {shots} shots ({cand['probability'] * 100:.1f}%)")
            st.write(f"- **QUBO Energy:** {cand['qubo_energy']:.2f}")
            st.write(f"- **Feasible:** {'✅ Yes' if cand['is_feasible'] else '❌ Violations'}")

        st.subheader("Measurement Probability Distribution (Top Bitstrings)")
        dist_dict = {item["bitstring"]: item["probability"] for item in qaoa_res["top_bitstrings"]}
        st.bar_chart(dist_dict)

    # PAGE 7: COMPARISON
    elif selected_page.startswith("7."):
        st.header("Page 7: Baseline vs Classical vs Quantum Comparison Table")
        classical_res = optimize_classical(mission)
        qaoa_res = run_qaoa_simulation(mission, p_layers=1, shots=1024)
        comp = generate_comparison_table(
            baseline_metrics=classical_res["baseline"],
            classical_metrics=classical_res["optimized"],
            classical_exec_ms=classical_res["execution_time_ms"],
            quantum_plan=qaoa_res["decoded_plan"],
            quantum_exec_ms=qaoa_res["execution_time_ms"]
        )

        st.table(comp["rows"])
        st.markdown(f"**Academic Finding:** {comp['scientific_analysis']}")

    # PAGE 8: FINAL MISSION PLAN & EXPORTS
    elif selected_page.startswith("8."):
        st.header(f"Page 8: Final Mission Plan & Exports — {mission.mission_id}")
        classical_res = optimize_classical(mission)
        qaoa_res = run_qaoa_simulation(mission, p_layers=1, shots=1024)
        plan = qaoa_res["decoded_plan"]

        st.success(f"Final Configuration: {plan['window_name']} | {plan['trajectory_name']} | {plan['mode_name']}")

        # Exportable CSV downloads
        traj = simulate_trajectory(mission)
        qubo_data = build_qubo_matrix(mission)

        col1, col2 = st.columns(2)
        with col1:
            st.download_button(
                "📥 Download optimized_mission.csv",
                data=json.dumps(plan, indent=2),
                file_name="optimized_mission.csv",
                mime="text/csv"
            )
            st.download_button(
                "📥 Download comparison_results.csv",
                data="metric,baseline,classical,quantum\n" + "\n".join(
                    f"{r['metric']},{r['baseline']},{r['classical']},{r['quantum']}" for r in generate_comparison_table(
                        classical_res["baseline"], classical_res["optimized"], classical_res["execution_time_ms"],
                        plan, qaoa_res["execution_time_ms"]
                    )["rows"]
                ),
                file_name="comparison_results.csv",
                mime="text/csv"
            )
        with col2:
            st.download_button(
                "📥 Download trajectory_results.csv",
                data="time,altitude_km,velocity_ms,accel_g,fuel_kg\n" + "\n".join(
                    f"{traj['time'][i]},{traj['altitude_km'][i]},{traj['velocity_ms'][i]},{traj['accel_g'][i]},{traj['fuel_remaining_kg'][i]}"
                    for i in range(len(traj['time']))
                ),
                file_name="trajectory_results.csv",
                mime="text/csv"
            )
            st.download_button(
                "📥 Download qubo_matrix.csv",
                data="\n".join(",".join(map(str, row)) for row in qubo_data["qubo_matrix"]),
                file_name="qubo_matrix.csv",
                mime="text/csv"
            )

        st.markdown("---")
        st.subheader("Dataset Description & Scientific Methodology")
        st.markdown(
            "- **Known Missions:** Historical references include Cartosat-3, Chandrayaan-3, Aditya-L1, RISAT-2BR1, GSAT series.\n"
            "- **Synthetic Missions:** Identified with `data_type: Synthetic` (e.g., SuryaSat-01, BharatEO-02).\n"
            "- **Physics Equations Used:**\n"
            "  - Tsiolkovsky Rocket Equation: $\\Delta v = I_{sp} g_0 \\ln(m_0 / m_f)$\n"
            "  - Newtonian Gravity: $g(h) = \\mu / (R_E + h)^2$\n"
            "  - Atmospheric Drag: $F_d = 0.5 \\rho(h) v^2 C_d A$\n"
            "  - Barometric Density: $\\rho(h) = \\rho_0 e^{-h / H}$\n"
            "  - Runge-Kutta 4th-Order Integration for launch ascent dynamics.\n"
            "  - QUBO & QAOA quantum statevector evolution over 9 qubits ($2^9$ states)."
        )

if __name__ == "__main__":
    run_streamlit_app()
