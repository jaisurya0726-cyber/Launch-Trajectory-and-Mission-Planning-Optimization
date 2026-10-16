export interface PipelineStageInfo {
  id: number;
  step: string;
  title: string;
  shortLabel: string;
  category: "flight" | "optimization" | "quantum" | "analysis";
  categoryLabel: string;
  briefDescription: string;
  purpose: string;
  keyInputs: string;
  keyOutputs: string;
  badgeColor: string;
}

export const PIPELINE_STAGES: PipelineStageInfo[] = [
  {
    id: 0,
    step: "01",
    title: "Mission Selection",
    shortLabel: "Selection",
    category: "flight",
    categoryLabel: "Flight Setup",
    briefDescription: "Choose a verified historical or synthetic satellite mission, orbital target, and launch vehicle from the catalog.",
    purpose: "Initialize baseline payload, destination orbit, vehicle parameters, and launch site constraints.",
    keyInputs: "Catalog filter, search queries, payload class",
    keyOutputs: "Active baseline mission profile & constraints",
    badgeColor: "#06b6d4", // Cyan
  },
  {
    id: 1,
    step: "02",
    title: "Flight Parameters",
    shortLabel: "Parameters",
    category: "flight",
    categoryLabel: "Flight Setup",
    briefDescription: "Inspect and tune propulsion, propellant staging, specific impulse (Isp), and site weather parameters.",
    purpose: "Evaluate Tsiolkovsky delta-v requirements, mass ratios, thrust-to-weight margins, and launch risk.",
    keyInputs: "Dry mass, fuel load, thrust, payload sensitivity",
    keyOutputs: "Stage mass budgets, required Δv, thrust-to-weight ratio",
    badgeColor: "#3b82f6", // Blue
  },
  {
    id: 2,
    step: "03",
    title: "Ascent Trajectory",
    shortLabel: "Trajectory",
    category: "flight",
    categoryLabel: "Flight Dynamics",
    briefDescription: "Simulate launch ascent with 4th-order Runge-Kutta numerical integration in 3D orbit and 2D flight paths.",
    purpose: "Track velocity, altitude, dynamic pressure (Max-Q), multi-satellite constellations, and Earth orbital mechanics.",
    keyInputs: "Pitch program, staging timing, atmospheric density",
    keyOutputs: "Time-series flight vectors, orbital elements, 3D orbits",
    badgeColor: "#10b981", // Emerald
  },
  {
    id: 3,
    step: "04",
    title: "Classical Optimizer",
    shortLabel: "Classical",
    category: "optimization",
    categoryLabel: "Mathematical Optimization",
    briefDescription: "Run multi-objective simulated annealing to optimize launch window timing, trajectory profile, and flight mode.",
    purpose: "Establish classical baseline benchmarks minimizing fuel consumption, flight time, cost, and mission risk.",
    keyInputs: "Objective weights (fuel, cost, risk, time)",
    keyOutputs: "Optimized discrete configuration & improvement percentage",
    badgeColor: "#8b5cf6", // Purple
  },
  {
    id: 4,
    step: "05",
    title: "QUBO Formulation",
    shortLabel: "QUBO",
    category: "quantum",
    categoryLabel: "Quantum Computing",
    briefDescription: "Map discrete launch scheduling and trajectory decisions into a 9-qubit Quadratic Unconstrained Binary Optimization matrix.",
    purpose: "Convert hard aerospace constraints (one-hot selection penalties) into an Ising spin Hamiltonian for quantum processors.",
    keyInputs: "Constraint penalty weights, binary decision variables",
    keyOutputs: "9x9 upper-triangular QUBO coupling matrix & energy offset",
    badgeColor: "#d946ef", // Fuchsia
  },
  {
    id: 5,
    step: "06",
    title: "QAOA Circuit Simulation",
    shortLabel: "QAOA",
    category: "quantum",
    categoryLabel: "Quantum Computing",
    briefDescription: "Simulate parameterized quantum circuits with problem and mixer Hamiltonians across 512 statevector amplitudes.",
    purpose: "Explore quantum superposition and entanglement to sample ground-state combinatorial mission solutions.",
    keyInputs: "Variational angles (gamma, beta), circuit depth p, shot count",
    keyOutputs: "Sample probability distribution, lowest-energy bitstring",
    badgeColor: "#ec4899", // Pink
  },
  {
    id: 6,
    step: "07",
    title: "Benchmark Comparison",
    shortLabel: "Comparison",
    category: "optimization",
    categoryLabel: "Comparative Analysis",
    briefDescription: "Compare Baseline, Classical, and QAOA Quantum results side-by-side using radar and performance bar charts.",
    purpose: "Assess quantum speedup, energy convergence, constraint satisfaction, and solution fidelity against classical solvers.",
    keyInputs: "Baseline, Classical, and Quantum output plans",
    keyOutputs: "Performance comparison matrix, radar chart, winner badge",
    badgeColor: "#f59e0b", // Amber
  },
  {
    id: 7,
    step: "08",
    title: "Mission Plan & Export",
    shortLabel: "Plan & Export",
    category: "flight",
    categoryLabel: "Operations & Reporting",
    briefDescription: "Review the finalized stage burn sequence, event timelines, and export comprehensive mission reports to CSV and PDF.",
    purpose: "Generate flight checklists, propellant consumption timelines, and operational mission documentation.",
    keyInputs: "Optimized mission plan & flight telemetry data",
    keyOutputs: "Flight event timeline, downloadable CSV dataset & PDF summary",
    badgeColor: "#06b6d4", // Cyan
  },
  {
    id: 8,
    step: "09",
    title: "Analytics Dashboard",
    shortLabel: "Analytics",
    category: "analysis",
    categoryLabel: "Historical Telemetry",
    briefDescription: "Analyze historical flight telemetry, vehicle reliability trends, launch site utilization, and safety status metrics.",
    purpose: "Identify orbital performance correlations and cross-mission fuel efficiency across the global launch database.",
    keyInputs: "Historical launch mission database records",
    keyOutputs: "Reliability distributions, payload histograms, orbit charts",
    badgeColor: "#3b82f6", // Blue
  },
  {
    id: 9,
    step: "10",
    title: "Sensitivity Analysis",
    shortLabel: "Sensitivity",
    category: "analysis",
    categoryLabel: "Flight Dynamics",
    briefDescription: "Explore D3 interactive dispersion scatter plots showing how payload mass and pitch variations impact insertion accuracy.",
    purpose: "Determine flight envelope robustness, orbital tolerance margins, and propellant sensitivity gradients.",
    keyInputs: "Payload variation offsets (±10%), pitch perturbation angles",
    keyOutputs: "Multi-run dispersion scatter plots & tolerance confidence bands",
    badgeColor: "#10b981", // Emerald
  },
  {
    id: 10,
    step: "11",
    title: "Quantum Fidelity",
    shortLabel: "Fidelity",
    category: "quantum",
    categoryLabel: "Quantum Computing",
    briefDescription: "Evaluate quantum statevector overlap, energy expectation values, and circuit depth confidence metrics.",
    purpose: "Validate that sampled quantum bitstrings correspond to true ground-state solutions with high probability overlap.",
    keyInputs: "Statevector probabilities, Hamiltonian eigenspectrum",
    keyOutputs: "Quantum fidelity score, state overlap bar chart, confidence level",
    badgeColor: "#d946ef", // Fuchsia
  },
  {
    id: 11,
    step: "12",
    title: "Custom Mission Input",
    shortLabel: "Input",
    category: "flight",
    categoryLabel: "Custom Modeling",
    briefDescription: "Build custom launch vehicles, satellite specs, and flight targets from scratch and run automated optimizations.",
    purpose: "Allow user-defined payloads, staging configurations, and launch sites without relying on pre-existing catalog missions.",
    keyInputs: "Custom rocket name, stages, propellant mass, orbit parameters",
    keyOutputs: "Validated custom mission profile integrated into pipeline",
    badgeColor: "#f59e0b", // Amber
  },
  {
    id: 12,
    step: "13",
    title: "QEC Simulation",
    shortLabel: "QEC Sim",
    category: "quantum",
    categoryLabel: "Quantum Computing",
    briefDescription: "Model quantum error correction codes, depolarizing noise channels, and syndrome detection circuits.",
    purpose: "Test fault-tolerant resilience of quantum optimization algorithms under realistic NISQ environmental decoherence.",
    keyInputs: "Physical qubit noise rate, gate error probability, QEC code distance",
    keyOutputs: "Logical error rate curve, syndrome detection fidelity, threshold graph",
    badgeColor: "#ef4444", // Rose
  },
  {
    id: 13,
    step: "14",
    title: "Atmospheric Re-entry",
    shortLabel: "Re-entry",
    category: "flight",
    categoryLabel: "Aerothermal & Descent",
    briefDescription: "Simulate hypersonic terminal descent, Sutton-Graves stagnation heat flux, TPS ablation, and deceleration G-loads.",
    purpose: "Evaluate thermal protection materials (PICA-X, Carbon-Phenolic, Silica Tiles) and capsule descent survivability.",
    keyInputs: "Entry velocity (3.5–13 km/s), flight path angle, TPS material & thickness",
    keyOutputs: "Heat flux curves, skin & bondline temperatures, deceleration G profile",
    badgeColor: "#f97316", // Orange
  },
];
