"""
Optimization Plots Module
Formats comparison charts between Baseline, Classical, and Quantum optimization.
"""

from typing import Dict, Any, List

def format_optimization_comparison_data(comparison_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extracts series data for grouped bar chart comparisons."""
    labels = []
    baseline_vals = []
    classical_vals = []
    quantum_vals = []

    for row in comparison_data.get("rows", []):
        if row["metric"] in ["Objective Value", "Fuel Consumption", "Launch Cost", "Risk Score"]:
            labels.append(row["metric"])
            baseline_vals.append(row["baseline"])
            classical_vals.append(row["classical"])
            quantum_vals.append(row["quantum"])

    return {
        "labels": labels,
        "baseline": baseline_vals,
        "classical": classical_vals,
        "quantum": quantum_vals
    }
