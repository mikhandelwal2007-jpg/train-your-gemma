# Train Your Gemma 🐉

> **Train Your Gemma** is a game where the player raises a small open-weights model (a "hatchling" Gemma) by catching mistakes in its step-by-step reasoning.

The player taps the **FIRST wrong step** in a reasoning trace, or taps **"Flawless"**. These taps become step-level labels that train a small "critic" model (the "tail fin"). With the critic attached, the model critiques its own steps and retries, and a held-out "flight test" benchmark measures whether it actually improved. All labels feed an open dataset with strict user opt-in consent.

---

## 🎯 Targeted Tracks
- **Best Use of Gemma 4** (Gemma does the step-by-step reasoning and multimodal problem solving)
- **Best Open-Source AI Project** (DigitalOcean GPU-backed inference, training, and flight test benchmark)

---

## 🛡️ Non-Negotiable Principles
1. **Stats are computed, never invented**: Accuracy, Eyesight, and Honesty stats come strictly from real flight-test runs. If unmeasured, the UI displays *"Not measured yet"* with progress towards flight test.
2. **Held-out split integrity**: Flight-test problems are NEVER shown in gameplay, never used for training, and never used to build critic training data. Splits are partitioned by **problem**, not trace.
3. **Honest reporting**: If the critic does not beat the baseline with statistical significance, the UI plainly reports *"No clear improvement yet"*.
4. **Opt-in dataset**: Public dataset export requires explicit player consent.
5. **Untrusted model output**: Model-generated content is sanitized; math parsing is sandboxed and validated with AST allowlists.

---

## 🏗️ Architecture & Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLModel/SQLAlchemy, SQLite (dev) / PostgreSQL (prod).
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, KaTeX for math rendering. Mobile-first design.
- **Verification Engine**: Sandboxed SymPy AST parser and Pint unit converter running in an isolated subprocess with CPU and timeout limits.
- **Mascot & Visuals**: Lightweight, original SVG dragon avatar with evolutionary stages (*Hatchling*, *Juvenile*, *Adult*).

---

## 🚀 Quickstart

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Backend Setup
```bash
# Clone the repository
git clone https://github.com/Shaurya-jain29/train-your-gemma.git
cd train-your-gemma

# Create and activate virtual environment
python3.11 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI backend (runs on http://localhost:8000)
uvicorn app.backend.main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup
```bash
cd app/frontend

# Install dependencies
npm install

# Start Vite dev server (runs on http://localhost:5173 with proxy to backend)
npm run dev
```

Visit **http://localhost:5173** to train your hatchling Gemma!

---

## 🧪 Testing

Run the automated test suite covering unit checkers, held-out leakage integrity, scoring rules, and mock mode:
```bash
pytest -v
```

---

## 📜 Problem & Visual Licenses
All problems and generated chart visuals are original creations released under the **CC0-1.0 Universal Public Domain Dedication**.
