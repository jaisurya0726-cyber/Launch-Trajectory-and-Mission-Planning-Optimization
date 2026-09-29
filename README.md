# Launch Trajectory & Mission-Planning Optimization using Quantum Computing (AeroQuantum)

An advanced aerospace simulation and quantum mission-planning platform integrating **4th-Order Runge-Kutta (RK4) ascent flight dynamics**, **classical multi-objective combinatorial optimization**, **Quadratic Unconstrained Binary Optimization (QUBO)**, and **Quantum Approximate Optimization Algorithm (QAOA) 9-qubit statevector simulation**.

The platform is delivered as a modern full-stack web application powered by **React 19, TypeScript, Vite, Tailwind CSS, and Recharts**, paired with a validated **Python 3.10 simulation engine**.

---

## 🛰️ 1. Architecture & System Overview

```text
Launch-Trajectory-Quantum-Simulation/
│
├── src/                                  # Modern React 19 + TypeScript Web Platform
│   ├── components/
│   │   ├── TopBar.tsx                    # Mission header, navigation, and modal triggers
│   │   ├── MissionSelector.tsx           # Page 1: Mission selection, filtering & search
│   │   ├── MissionParameters.tsx         # Page 2: Mass budgets & Payload Sensitivity Toggle (±10%)
│   │   ├── TrajectorySimulationView.tsx  # Page 3: RK4 flight telemetry & Launch Angle Stability Overlay (±5°)
│   │   ├── ClassicalOptimizationView.tsx # Page 4: Deterministic classical multi-objective solver
│   │   ├── QUBOView.tsx                  # Page 5: 9-variable QUBO matrix & penalty formulation
│   │   ├── QAOAView.tsx                  # Page 6: 9-qubit QAOA simulator & statevector bitstrings
│   │   ├── ComparisonView.tsx            # Page 7: Classical vs. Quantum trade-off & radar analysis
│   │   ├── FinalPlanView.tsx             # Page 8: Operations plan, checklist, and export engine
│   │   ├── AnalyticsDashboard.tsx        # Page 9: Recharts historical trends & Status Filtering
│   │   ├── MissionLogbookSidebar.tsx     # Engineering notes, aerospace tags & report export
│   │   └── MissionHistoryModal.tsx       # LocalStorage persisted research iterations (last 5)
│   ├── lib/
│   │   ├── physics.ts                    # RK4 atmospheric integrator & Tsiolkovsky propellant models
│   │   ├── optimization.ts               # Classical solver & simulated QAOA statevector sampler
│   │   └── history.ts                    # LocalStorage persistence & logbook note handlers
│   ├── types/                            # Strict TypeScript domain interfaces
│   └── App.tsx                           # Root orchestrator & tab routing
│
├── data/
│   ├── launch_missions.csv               # 500 validated mission profiles (ISRO, NASA, ESA, Roscosmos, etc.)
│   ├── generate_dataset.py               # Deterministic physical data generator
│   └── processed_missions.csv            # Normalized feature catalog
│
├── models/
│   ├── qubo_formulation.py               # 9x9 Upper-triangular QUBO objective & penalty matrices
│   ├── qaoa_solver.py                    # Analytical Qiskit-compatible QAOA simulation
│   └── classical_optimizer.py            # Exhaustive ground-truth evaluator
│
├── simulation/
│   └── trajectory_rk4.py                 # Pure Python 4th-order Runge-Kutta flight dynamics
│
├── tests/
│   └── test_pipeline.py                  # 14 Python unit regression tests
│
└── app/
    └── dashboard.py                      # Standalone Streamlit console
```

---

## 🚀 2. Interactive Web Application Modules

### 🌓 Theme Customization: Dark & Light Mode
- **One-Click Theme Toggle**: Integrated header toggle button in the top action bar to switch instantly between Mission Control Dark theme and Engineering Lab Light theme with Sun/Moon indicators.
- **Persistent Preference**: Automatically caches user theme preference in `localStorage` (`aeroquantum_theme`).
- **Full Application Adaptation**: Smoothly adapts navigation ribbons, cards, data tables, parameter inputs, telemetry HUDs, and quantum visualizers to crisp, high-contrast light and dark palettes.

### Tab 1 — Mission Selection & Feature Catalog
- Live database of 500 reference and synthetic space missions across LEO, SSO, GTO, MEO, GEO, Lunar Transfer, and Deep Space trajectories.
- Multi-factor search, real-time filtering by orbit type, vehicle class (PSLV, GSLV Mk II, LVM3, SSLV), and risk classification.
- CSV and JSON dataset export capabilities.

### Tab 2 — Physics & Parameters with Dynamic Payload Sensitivity (±10%)
- Launch vehicle mass budget breakdown ($m_{dry}$, $m_{fuel}$, $m_{payload}$, $I_{sp}$, and $TWR$).
- **Payload Sensitivity Toggle**: Allows users to scrub payload mass by $\pm 10\%$ via segmented quick toggles or fine sliders.
- **Dynamic Physics Feedback**: Instantaneously updates fuel consumption via Tsiolkovsky's equation, vehicle theoretical maximum $\Delta v$ margin ($\pm \text{m/s}$), liftoff acceleration ($TWR$), and structural strain risk factors.

### Tab 3 — 4th-Order Runge-Kutta Ascent Simulation & Canvas Flight Animation
- **Interactive Canvas-Based Flight Path Animation**: Real-time 2D HTML5 canvas simulation plotting the vehicle's flight trajectory from launch pad to orbital injection, featuring:
  - Dynamic pitch orientation ($\gamma$) aligning the rocket nose with instantaneous velocity vectors.
  - Physically reactive particle exhaust plumes that expand in near-vacuum altitudes.
  - Stratified atmospheric gradient layers (Troposphere, Stratosphere, Mesosphere, Kármán Line at 100 km, and Target Orbit guide).
  - **Granular Playback Speed Control (0.5x, 1x, 2x)**: Dedicated speed selector allowing slow-motion (0.5x) for granular observation of critical staging events, real-time normal simulation (1.0x), and fast playback (2.0x).
  - **Granular Flight Stage Timeline & Fast-Jump Badges**: Interactive timeline scrubber with one-click jump chips to key flight stages: *Liftoff (T+0s)*, *Max-Q Transonic Corridor*, *Stage 1 MECO / Booster Staging*, *Fairing Jettison*, and *Target Orbit Injection*.
  - Real-time Flight Telemetry HUD overlay tracking MET ($T+$), Altitude, Downrange, Velocity, and G-force loads.
- **Compare Trajectories Overlay (Dual Arc Canvas Rendering)**:
  - **Simultaneous Dual Flight Path Rendering**: Renders two distinct mission runs as color-coded trajectory arcs on the same canvas (Run 1 in Cyan `#06b6d4`, Run 2 in Amber `#f59e0b`).
  - **Dynamic Multi-Run Selection**: Choose any combination from active simulation, saved user iterations in history, or benchmark reference missions (*Cartosat-3 SSO*, *Chandrayaan-3 LVM3*, *EOS-06*, *Aditya-L1*, *Microsat-R*).
  - **Dual Apogee & Target Orbit Guides**: Computes and labels apogee markers and target orbit dashed lines for both mission profiles on the canvas.
  - **Synchronized Playback**: Dual vehicle dots and exhaust plumes move synchronously across normalized flight progress during playback.
  - **On-Canvas Floating HUD & Delta Telemetry**: Displays live comparative telemetry with real-time differences in Achieved Apogee ($\Delta h$), Final Velocity ($\Delta v$), Peak Dynamic Pressure ($\Delta q$), Propellant Mass ($\Delta m$), and Burn Time ($\Delta t$).
  - **One-Click Actions**: Includes a swap button (`Run 1 ⇄ Run 2`) and an instant "Snapshot Current Run" button to persist custom trajectory tweaks into history.
- **Atmospheric Density Heatmap Overlay & Seasonal Weather Profiles**:
  - **Dynamic Canvas Density Heatmap**: Continuous barometric density gradient mapped vertically from sea level to orbital altitudes based on barometric scale heights $H = \frac{R \cdot T}{M \cdot g_0}$.
  - **Density Isoline Contours**: Highlights key aerospace boundaries including Boundary Layer ($\rho = 1.0\text{ kg/m}^3$), Commercial Troposphere ($\rho = 0.5\text{ kg/m}^3$), Max-Q Corridor ($\rho = 0.1\text{ kg/m}^3$), Upper Stratosphere ($\rho = 0.01\text{ kg/m}^3$), and Mesopause ($\rho = 0.001\text{ kg/m}^3$).
  - **Seasonal Weather Models**: Selectable profiles including *Mission Weather (Live Derived)*, *South Asian Monsoon (Hot & Saturated 32.5°C, 92% RH)*, *Tropical Summer (Thermal Expansion H=9150m)*, *Subtropical Winter (Dense Cold Air H=8150m)*, *ISA Standard Atmosphere (15°C, 1013 hPa)*, and *Cyclonic (988 hPa Low Pressure)*.
  - **Interactive Controls**: Density heatmap toggle (ON/OFF), opacity slider (15%–80%), target launch orbit altitude scrubber ($120\text{--}900\text{ km}$), continuous colorbar spectrum, and live vehicle ambient density telemetry readout ($\text{kg/m}^3$ and % sea level).
- **Launch Angle Stability Overlay & Range Slider (±5°)**: Simulates and overlays 5 simultaneous ascent flight profiles onto an interactive chart, accompanied by a real-time range slider ($0.1^\circ$ precision) with instant dynamic simulation feedback.
- **Weather-Constrained Launch Parameter Stability Map (Safe vs. Critical Constraints)**:
  - **Color-Coded Risk Envelope Grid**: Evaluates Launch Commit Criteria (LCC) across Launch Angle ($\Delta\gamma$) vs. Crosswind Speed ($0\text{--}24\text{ m/s}$) or Propellant Loading ($-15\%\text{ to }+15\%$).
  - **Three Safety Regions**: Categorizes operations into **Safe (Go - Emerald)**, **Caution (Marginal / Elevated Buffeting - Amber)**, and **Critical (No-Go / TVC Gimbal Saturation or Max-Q Exceeded - Rose)**.
  - **Dynamic Weather Integration**: Recalculates constraints based on current weather sensors (wind velocity, gust shear, surface temperature, precipitation/rain fairing erosion, and air density).
  - **Weather Stress Testing**: Interactive simulator testing sudden crosswind gusts ($+6\text{ m/s}$) and rain storm surges ($+8.5\text{ mm}$), visually shrinking the safe flight corridor.
  - **Current Operating Point Tracker**: Real-time pulsing radar indicator marking active mission parameters directly on the stability grid.
  - **Stability Inspector HUD**: Detailed diagnostics displaying the Launch Safety Index ($0\text{--}100$), Peak Max-Q load, TVC gimbal deflection margin, constraint violation reasons, and one-click angle application.
  - **View Controls**: Persistent header and section toggle buttons with filtering for *All*, *Safe Only*, *Caution Only*, and *Critical Only*.
- **Dual-Variable Sensitivity Analysis Heatmap (Launch Angle × Fuel Mass)**:
  - **7×7 Discretized Solution Grid (49 Scenarios)**: Evaluates coupled variations between Launch Angle Deviation ($\Delta\gamma$ from $-4^\circ$ to $+4^\circ$) and Propellant Mass Variation ($\Delta m_{\text{fuel}}$ from $-15\%$ to $+15\%$).
  - **Comprehensive Orbit Insertion Mission Efficiency ($\eta_{\text{insertion}}\%$)**: Computes multi-factor objective combining altitude insertion accuracy, orbital velocity sufficiency ($v / v_{\text{req}}$), structural drag/g-load penalties, and propellant reserve conservation.
  - **Metric Toggle Views**: Interactive switching between **Mission Efficiency (%)**, **Achieved Apogee (km)**, **Final Burnout Velocity (m/s)**, and **Peak Dynamic Pressure Max-Q (kPa)**.
  - **Scenario Telemetry Inspector HUD**: Hover or click any cell to inspect exact flight metrics (apogee dispersion $\Delta h$, burnout velocity, Max-Q load, G-force limit check, and optimizer recommendation).
  - **One-Click Scenario Application**: Instantly apply any matrix configuration ($\Delta\gamma$ and fuel mass) directly into the active Runge-Kutta flight path simulation.
  - **Sweet-Spot & Baseline Indicators**: Highlights the global optimal insertion configuration (★) and baseline nominal coordinates (⊙).
- **Live Vehicle Telemetry Monitor Simulation**: Real-time streaming sensor downlink displaying continuous fluctuations across:
  - **Dynamic Pressure ($q$)**: Simulates high-frequency pitot sensor noise around Max-Q transonic buffeting.
  - **Skin & Fairing Temperature (°C)**: Simulates aerodynamic thermal compression heating.
  - **Airspeed & Mach Number (m/s)**: Simulates pitot-static and inertial navigation system (INS) acceleration readings.
  - **Live Streaming Recharts Line Chart**: Real-time updating sliding buffer (22 data points) with channel filtering (`All`, `Pressure`, `Temperature`, `Airspeed`), polling frequency selectors (`1.0s`, `0.5s`, `0.25s`), turbulence injection trigger, and downlink health metrics.
- Timeline scrubber inspecting altitude, velocity, acceleration ($g$-load), mass depletion, and dynamic pressure ($q_{max}$).

### Tab 4 — Classical Multi-Objective Optimization
- Deterministic evaluation of all 27 discrete configuration combinations ($3 \times 3 \times 3$).
- Weighted objective minimization:
  $$f(\vec{x}) = w_1 \cdot \text{FuelNormalized} + w_2 \cdot \text{CostNormalized} + w_3 \cdot \text{RiskNormalized} + w_4 \cdot \Delta v_{\text{pen}}$$
- Interactive radar chart comparing Baseline vs. Classical Optimal profiles.

### Tab 5 — QUBO Formulation & Ising Interaction Matrix
- Maps discrete decision variables to 9 binary variables $x_1, \dots, x_9$:
  - $x_1, x_2, x_3$: Launch window selection (Early, Nominal/Mid, Late)
  - $x_4, x_5, x_6$: Trajectory profile (Direct Ascent, Gravity Turn, Multi-Stage)
  - $x_7, x_8, x_9$: Propellant throttle mode (Conservative, Nominal, Aggressive)
- $9 \times 9$ Upper-triangular interactive heatmap showing quadratic coupling terms $Q_{ij}$ and one-hot constraint penalties ($P = 100.0$).

### Tab 6 — 9-Qubit QAOA Quantum Circuit Simulation & Cost Convergence
- **Interactive Recharts Cost Function Convergence Visualization**: Visualizes the classical-quantum hybrid optimization trajectory over 25 iteration steps ($k=1 \dots 25$):
  - **Cost Expectation $\langle H_C \rangle$ Minimization**: Area chart displaying evaluated energy decreasing from uniform superposition ($E_0 \sim 150$) down to the optimal ground state ($E^*$).
  - **Monotonic Best Candidate Reference**: Step-line tracking the lowest objective energy discovered across iterations.
  - **Multi-Mode Analysis Toggles**: Instantaneously switch between *Cost Energy $\langle H_C \rangle$*, *Energy vs. Feasible Sampling Rate (%)*, *Variational Angles Trajectory ($\gamma$ Phase vs $\beta$ Mixer)*, and *Decoherence Noise Impact*.
  - **Live Quantum Metric Ribbon**: Highlights Initial Energy, Converged Ground Energy (or Noisy Plateau Floor), Energy Reduction % ($\Delta E$), Feasible State Fidelity under noise, and Optimal Variational Parameters.
- **Quantum Noise / Error Simulation (Decoherence & Gate Errors Tab)**:
  - **Sub-Navigation Tabs**: One-click toggling between *1. Circuit Topology & Pure State Simulation (Zero Noise)* and *2. Quantum Noise / Error Simulation*.
  - **Hardware Architecture Presets**: Fast switching between *Zero Noise (Fault-Tolerant)*, *Trapped Ion (Quantinuum H2 - 0.3% CNOT)*, *Superconducting Transmon (IBM Eagle / Heron - 1.5% CNOT)*, and *High Decoherence (Severe Crosstalk & Thermal Drift)*.
  - **Parametric Error Sliders**: Real-time continuous adjustment of 2-qubit CNOT gate error $\epsilon_2$ ($0.0\% - 8.0\%$), 1-qubit error $\epsilon_1$, dephasing time $T_2$ ($10 - 1500\ \mu\text{s}$), thermal relaxation $T_1$ ($15 - 2500\ \mu\text{s}$), and projective readout measurement error.
  - **Hardware Telemetry HUD**: Displays Circuit State Purity (Fidelity %), Decoherence Loss Gap ($\Delta F$), Total 2Q CNOT Gate Accumulation ($36 \times p$), and Circuit Depth / Duration ratio.
  - **Convergence Impact Overlay**: Overlays noisy cost expectation $\langle H_C \rangle_{\text{noisy}}$ in rose `#f43f5e` alongside the ideal cost curve, illustrating barren plateau floors, gate noise jitter, and one-hot constraint feasibility collapse.
  - **NISQ Physical Mechanics Callout**: Highlights why multi-layer QAOA circuits ($p=2, 3$) suffer severe decoherence due to $36 \times p$ entangling gates.
- **Quantum State Bloch Sphere Visualizer (SU(2) Qubit Superposition Space)**:
  - **Interactive 3D Bloch Sphere Canvas**: Renders single-qubit density operator statevectors $|\psi\rangle = \cos(\theta/2)|0\rangle + e^{i\phi}\sin(\theta/2)|1\rangle$ in 3D projective geometry with click-and-drag rotation and smooth auto-spin.
  - **9-Qubit Register Selector**: Direct inspection across all 9 decision variables: Launch Windows ($q_0, q_1, q_2$), Trajectories ($q_3, q_4, q_5$), and Throttle Modes ($q_6, q_7, q_8$).
  - **Optimization Phase Scrubber & Playback**: Step-by-step playback tracking how superposition evolves from initial equal superposition ($|+\rangle$ on the equator, $P=50/50$) into the collapsed ground state pole ($|0\rangle$ North or $|1\rangle$ South).
  - **Statevector Diagnostics HUD**: Real-time readouts of spherical coordinates $(\theta, \phi)$, Pauli expectation values ($\langle X \rangle, \langle Y \rangle, \langle Z \rangle$), and $Z$-basis measurement probabilities ($P(|0\rangle) = \cos^2(\theta/2)$, $P(|1\rangle) = \sin^2(\theta/2)$).
  - **Equatorial Projection & Trajectory Trail**: Visualizes phase precession and mixer rotation arcs on the sphere surface.
- **Quantum Circuit Simulation**: 9-qubit statevector simulation with projective measurement sampling (256 to 2048 shots).
- **Measurement Probability Distribution Histogram**: Visual breakdown of feasible vs infeasible bitstrings with one-hot constraint verification.

### Tab 7 — Classical vs. Quantum Comparison
- Transparent, side-by-side benchmark table comparing Classical and Quantum configurations.
- Metric-by-metric Delta analysis (Fuel savings, Cost reduction, Execution runtime, and Risk delta).
- Academic transparency note acknowledging classical efficiency on discrete search spaces versus quantum ground-state verification.

### Tab 8 — Operations Plan & Multi-Format Exports
- Flight operations executive summary and countdown sequence checklist.
- Technical specifications table and download handlers for **Mission Plan JSON** and **Trajectory Telemetry CSV**.

### Tab 9 — Research Analytics Dashboard (Recharts Powered)
- **Cost vs. Payload Capacity Scaling**: Composed chart plotting launch expenditure ($M USD) against payload mass and transport cost efficiency ($\$/\text{kg}$).
- **Classical vs. Quantum Convergence**: Area chart visualizing objective values across research iterations.
- **Propellant Conservation Trend**: Tracks fuel saved and residual risk index over time.
- **Filter by Mission Status**: Interactive dropdown allowing toggling between **All Statuses**, **Successful / Safe**, and **Risk-Flagged** cohorts with dynamic KPI recalculations.
- **JSON Export for Filtered Analytics**: One-click downloadable export generating structured JSON files (`mission_history_analytics_<status>_<date>.json`) packaging filter parameters, summary KPIs, environmental weather profiles, flight configurations, and individual mission records.

### Sidebars & Storage Drawers
- **Mission Logbook Sidebar**: Slide-over drawer allowing engineers to record custom field observations, assign aerospace tags (`Propulsion Margin`, `QUBO Ising Matrix`, `Flight Safety`, etc.), and export formatted engineering telemetry reports (`.txt`).
- **Mission History Modal**: Stores up to 5 user research iterations in browser `localStorage` with 1-click restore functionality.

---

## 📐 3. Mathematical & Physics Formulation

### 3.1 Tsiolkovsky Rocket Equation & Propellant Consumption
$$\Delta v = I_{sp} \cdot g_0 \cdot \ln\left(\frac{m_0}{m_f}\right) = I_{sp} \cdot g_0 \cdot \ln\left(\frac{m_{dry} + m_{fuel} + m_{payload}}{m_{dry} + m_{payload}}\right)$$

The required fuel consumption $m_{fuel, req}$ to achieve a mission orbital velocity $\Delta v_{req}$ is:
$$m_{fuel, req} = (m_{dry} + m_{payload}) \cdot \left( \exp\left(\frac{\Delta v_{req}}{I_{sp} \cdot g_0}\right) - 1 \right)$$

### 3.2 4th-Order Runge-Kutta (RK4) Flight Equations
$$\frac{dh}{dt} = v \sin \gamma$$
$$\frac{dx}{dt} = \frac{R_E}{R_E + h} v \cos \gamma$$
$$\frac{dv}{dt} = \frac{T(t) - F_D(v, h)}{m(t)} - g(h) \sin \gamma$$
$$\frac{d\gamma}{dt} = -\frac{1}{v} \left( g(h) - \frac{v^2}{R_E + h} \right) \cos \gamma + \dot{\gamma}_{\text{pitchover}}$$
where:
$$g(h) = g_0 \left(\frac{R_E}{R_E + h}\right)^2, \quad \rho(h) = \rho_0 e^{-h/H}, \quad F_D = \frac{1}{2} \rho(h) v^2 C_D A$$

### 3.3 QUBO Objective with One-Hot Penalty Functions
$$\min_{\vec{x}} E(\vec{x}) = \sum_{i=1}^9 Q_{ii} x_i + \sum_{i < j} 2 Q_{ij} x_i x_j$$
subject to:
$$P_{win} \left(\sum_{i=1}^3 x_i - 1\right)^2 + P_{traj} \left(\sum_{i=4}^6 x_i - 1\right)^2 + P_{mode} \left(\sum_{i=7}^9 x_i - 1\right)^2 = 0$$

### 3.4 Ising Spin Hamiltonian & QAOA Evolution
Using the transformation $x_i = \frac{1 - Z_i}{2}$, the cost function maps to the problem Hamiltonian:
$$H_C = \sum_{i=1}^9 h_i Z_i + \sum_{i < j} J_{ij} Z_i Z_j + C$$

The parameterized QAOA state is evolved across $p$ layers:
$$|\psi(\vec{\gamma}, \vec{\beta})\rangle = \left( \prod_{l=1}^p e^{-i \beta_l H_B} e^{-i \gamma_l H_C} \right) |+\rangle^{\otimes 9}$$
where $H_B = \sum_{i=1}^9 X_i$ is the transverse field mixer.

---

## 🛠️ 4. Quick Start & Execution

### Prerequisites
- Node.js 18+ & npm
- Python 3.10+ (for backend and unit test suite)

### Web Application (React + Vite)
```bash
# 1. Install dependencies
npm install

# 2. Run local development server (Port 3000)
npm run dev

# 3. Lint and build for production
npm run lint
npm run build
```

### Python Simulation Engine & Regression Tests
```bash
# 1. Run full unit test suite (14 tests covering dataset, RK4, QUBO, and QAOA)
python3 -m unittest discover tests

# 2. Execute automated simulation pipeline
python3 main.py

# 3. Optional: Run Streamlit dashboard console
streamlit run app/dashboard.py
```

---

## 🔬 5. Academic & Research Disclaimer
> **Disclaimer**: This software is an academic engineering simulation created for research, benchmarking, and demonstration of multi-objective combinatorial optimization and quantum algorithms applied to spaceflight dynamics. It is not certified for operational flight guidance, navigation, or real-world mission critical control.
