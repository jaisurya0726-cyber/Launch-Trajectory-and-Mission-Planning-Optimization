"""
Preprocessing Module
Handles dataset loading, checking for existence, auto-generation,
filtering, feature scaling, and validation.
"""

import os
import csv
from typing import List, Dict, Any, Optional
from data.generate_dataset import generate_dataset, validate_record
from models.mission_model import Mission

DEFAULT_DATA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "launch_missions.csv"
)

def ensure_dataset(data_path: str = DEFAULT_DATA_PATH, num_records: int = 500) -> str:
    """Check if launch_missions.csv exists, generate it if not."""
    if not os.path.exists(data_path) or os.path.getsize(data_path) < 100:
        print(f"Dataset not found at {data_path}. Auto-generating {num_records} mission records...")
        generate_dataset(num_records=num_records, output_path=data_path)
    return data_path


def load_missions(data_path: str = DEFAULT_DATA_PATH) -> List[Mission]:
    """Load missions from CSV, auto-generating if necessary."""
    ensure_dataset(data_path)
    missions = []
    with open(data_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            missions.append(Mission.from_dict(row))
    return missions


def filter_missions(
    missions: List[Mission],
    rocket: Optional[str] = None,
    target_orbit: Optional[str] = None,
    launch_site: Optional[str] = None,
    safety_status: Optional[str] = None,
    data_type: Optional[str] = None,
    max_risk: Optional[float] = None
) -> List[Mission]:
    """Filter missions by specified criteria."""
    filtered = missions
    if rocket:
        filtered = [m for m in filtered if m.rocket == rocket]
    if target_orbit:
        filtered = [m for m in filtered if m.target_orbit == target_orbit]
    if launch_site:
        filtered = [m for m in filtered if m.launch_site == launch_site]
    if safety_status:
        filtered = [m for m in filtered if m.safety_status == safety_status]
    if data_type:
        filtered = [m for m in filtered if m.data_type == data_type]
    if max_risk is not None:
        filtered = [m for m in filtered if m.risk_score <= max_risk]
    return filtered


def get_mission_by_id(mission_id: str, data_path: str = DEFAULT_DATA_PATH) -> Optional[Mission]:
    missions = load_missions(data_path)
    for m in missions:
        if m.mission_id.upper() == mission_id.upper():
            return m
    return None
