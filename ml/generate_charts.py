import os
from pathlib import Path
import matplotlib.pyplot as plt


def generate_all_charts(output_dir: str = "./data/images") -> list:
    """
    Generates clean, original synthetic charts (velocity-time, force-acceleration, energy breakdown,
    and temperature tables) with no copyright or external assets.
    Saves them as PNGs and returns metadata list for problems.
    """
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    charts_meta = []

    # 1. Velocity-Time Graph: Constant acceleration then steady speed
    fig, ax = plt.subplots(figsize=(6, 4))
    time_pts = [0, 4, 10]
    vel_pts = [0, 20, 20]
    ax.plot(time_pts, vel_pts, marker='o', color='#2563EB', linewidth=2.5)
    ax.set_title("Velocity vs Time for Hatchling Flight", fontsize=12, fontweight='bold')
    ax.set_xlabel("Time (seconds)", fontsize=10)
    ax.set_ylabel("Velocity (m/s)", fontsize=10)
    ax.grid(True, linestyle='--', alpha=0.6)
    ax.set_xlim(-0.5, 11)
    ax.set_ylim(-1, 25)

    img_file1 = out_path / "chart_vt_flight.png"
    plt.tight_layout()
    plt.savefig(img_file1, dpi=120)
    plt.close(fig)

    charts_meta.append({
        "id": "prob_chart_vt_001",
        "subject": "chart_table",
        "difficulty": "medium",
        "statement": "Based on the velocity-time graph, what is the acceleration of the hatchling between t = 0 s and t = 4 s?",
        "image_path": str(img_file1),
        "alt_text": "Velocity-time graph showing linear velocity increase from 0 to 20 m/s between t=0 and t=4 s, then constant 20 m/s from t=4 to t=10 s.",
        "ground_truth_data": {"t0": 0, "v0": 0, "t1": 4, "v1": 20, "slope": 5.0},
        "answer_key": "5 m/s^2",
        "checker_type": "units",
        "split": "play",
        "license": "CC0-1.0",
        "source": "programmatic_matplotlib",
    })

    # 2. Distance from Area under curve
    charts_meta.append({
        "id": "prob_chart_vt_002",
        "subject": "chart_table",
        "difficulty": "hard",
        "statement": "From the velocity-time graph, what total distance was covered by the hatchling from t = 0 s to t = 10 s?",
        "image_path": str(img_file1),
        "alt_text": "Velocity-time graph: triangle area from 0 to 4s (0.5 * 4 * 20 = 40m) and rectangle from 4 to 10s (6 * 20 = 120m). Total = 160m.",
        "ground_truth_data": {"area_triangle": 40, "area_rect": 120, "total_dist": 160},
        "answer_key": "160 m",
        "checker_type": "units",
        "split": "flight",  # Held out for flight test
        "license": "CC0-1.0",
        "source": "programmatic_matplotlib",
    })

    # 3. Force vs Acceleration (Newton's 2nd Law F = m * a)
    fig, ax = plt.subplots(figsize=(6, 4))
    acc_pts = [1, 2, 3, 4, 5]
    force_pts = [2.5, 5.0, 7.5, 10.0, 12.5]
    ax.scatter(acc_pts, force_pts, color='#DC2626', s=50, zorder=3)
    ax.plot(acc_pts, force_pts, color='#DC2626', linestyle='-', linewidth=2)
    ax.set_title("Net Force vs Acceleration for Hatchling Armor", fontsize=12, fontweight='bold')
    ax.set_xlabel("Acceleration (m/s^2)", fontsize=10)
    ax.set_ylabel("Net Force (N)", fontsize=10)
    ax.grid(True, linestyle='--', alpha=0.6)

    img_file2 = out_path / "chart_force_acc.png"
    plt.tight_layout()
    plt.savefig(img_file2, dpi=120)
    plt.close(fig)

    charts_meta.append({
        "id": "prob_chart_fa_001",
        "subject": "chart_table",
        "difficulty": "easy",
        "statement": "Using the Net Force vs Acceleration plot, determine the mass of the hatchling armor (Slope = Mass in F = m * a).",
        "image_path": str(img_file2),
        "alt_text": "Graph of Net Force vs Acceleration showing linear relation with slope = 2.5 kg.",
        "ground_truth_data": {"slope": 2.5},
        "answer_key": "2.5 kg",
        "checker_type": "units",
        "split": "play",
        "license": "CC0-1.0",
        "source": "programmatic_matplotlib",
    })

    # 4. Gold problem for quality control
    charts_meta.append({
        "id": "prob_chart_fa_gold",
        "subject": "chart_table",
        "difficulty": "easy",
        "statement": "What is the net force required when acceleration is 4 m/s^2 on the Net Force vs Acceleration graph?",
        "image_path": str(img_file2),
        "alt_text": "At a = 4 m/s^2, Force reads 10 N.",
        "ground_truth_data": {"force_at_4": 10.0},
        "answer_key": "10 N",
        "checker_type": "units",
        "split": "gold",  # Gold split for player quality checking
        "license": "CC0-1.0",
        "source": "programmatic_matplotlib",
    })

    # 5. Bar chart: Energy distribution
    fig, ax = plt.subplots(figsize=(6, 4))
    categories = ['Kinetic', 'Potential', 'Thermal', 'Sound']
    energy_vals = [500, 300, 150, 50]
    ax.bar(categories, energy_vals, color=['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'])
    ax.set_title("Energy Transformation during Gliding (Joules)", fontsize=12, fontweight='bold')
    ax.set_ylabel("Energy (J)", fontsize=10)
    ax.grid(axis='y', linestyle='--', alpha=0.5)

    img_file3 = out_path / "chart_energy_bar.png"
    plt.tight_layout()
    plt.savefig(img_file3, dpi=120)
    plt.close(fig)

    charts_meta.append({
        "id": "prob_chart_en_001",
        "subject": "chart_table",
        "difficulty": "easy",
        "statement": "According to the Energy Transformation bar chart, which category accounts for exactly 300 Joules of energy?",
        "image_path": str(img_file3),
        "alt_text": "Bar chart with Kinetic=500J, Potential=300J, Thermal=150J, Sound=50J.",
        "ground_truth_data": {"category_300": "Potential"},
        "answer_key": "Potential",
        "checker_type": "exact",
        "split": "play",
        "license": "CC0-1.0",
        "source": "programmatic_matplotlib",
    })

    # 6. Flight split bar chart problem
    charts_meta.append({
        "id": "prob_chart_en_flight",
        "subject": "chart_table",
        "difficulty": "medium",
        "statement": "What is the total mechanical energy (Kinetic + Potential) shown in the Energy Transformation chart?",
        "image_path": str(img_file3),
        "alt_text": "Kinetic is 500J and Potential is 300J, sum is 800J.",
        "ground_truth_data": {"kinetic": 500, "potential": 300, "mechanical": 800},
        "answer_key": "800 J",
        "checker_type": "units",
        "split": "flight",  # Held out for flight test
        "license": "CC0-1.0",
        "source": "programmatic_matplotlib",
    })

    return charts_meta


if __name__ == "__main__":
    items = generate_all_charts()
    print(f"Generated {len(items)} chart problems and saved images to ./data/images.")
