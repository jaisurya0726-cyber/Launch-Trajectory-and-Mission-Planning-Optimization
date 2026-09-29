"""
Quantum Plots Module
Provides helpers for QUBO matrix heatmaps and QAOA measurement histograms.
"""

from typing import Dict, Any, List

def format_qaoa_distribution_data(top_bitstrings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Prepares bitstring distribution data for quantum histogram visualizations."""
    bitstrings = [item["bitstring"] for item in top_bitstrings]
    probabilities = [item["probability"] for item in top_bitstrings]
    energies = [item["qubo_energy"] for item in top_bitstrings]
    feasibility = [item["is_feasible"] for item in top_bitstrings]

    return {
        "bitstrings": bitstrings,
        "probabilities": probabilities,
        "energies": energies,
        "feasibility": feasibility
    }


def format_qubo_heatmap_data(qubo_matrix: List[List[float]], variable_labels: List[str]) -> Dict[str, Any]:
    """Prepares 2D matrix data for heatmap rendering."""
    return {
        "labels": variable_labels,
        "matrix": qubo_matrix,
        "size": len(variable_labels)
    }
