# GreenWave

Urban Traffic Signal Green-Wave Synchronizer & Corridor Flow Optimizer.

## Product Overview
GreenWave is a real-world traffic monitoring and corridor optimization platform. It connects to live traffic data (like TomTom API) to propose optimal traffic signal timings to reduce congestion.

## Prerequisites
- Python 3.14 (or equivalent)
- Node.js (v24+)
- Docker (optional, but recommended for PostgreSQL)

## Local Installation

1. **Clone/extract the project**
   Navigate to `e:\Greenwave`

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Database Setup**
   The project defaults to SQLite for local development (`greenwave.db`) if `SQLALCHEMY_DATABASE_URI` is set to `sqlite:///./greenwave.db`.
   Run migrations and seed the nationwide LGD-compatible administrative hierarchy (States & Districts) plus demo data:
   ```bash
   alembic upgrade head
   python seed_india.py
   python seed_db.py
   ```
   **To Import Additional Geographic Data**:
   Use `import_osm.py` to bound an OpenStreetMap extract for your assigned city to import real road candidates and verified signals.

4. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

## Environment Variables
Copy `backend/.env` and update the `TRAFFIC_API_KEY` with your TomTom API key. (Supports fallback graceful degradation if unavailable).

## Running the Application
**Backend (FastAPI):**
```bash
cd backend
python run.py
```
**Frontend (Vite/React):**
```bash
cd frontend
npm run dev
```

## Supported Workflows
- **Nationwide Coverage**: Administrative selectors cover all India.
- **Traffic Live Feed**: Fetches real-time TomTom flow metrics via `/traffic/status`.
- **Optimization Model**: Computes proposed green/red splits subject to cycle safety constraints.
- **TraCI Simulation**: Binds a physically projected demo network (`demo.net.xml`) using UTM to animate live baseline vs optimized comparisons.

## Known Limitations & Unsupported Areas
- **Simulation Coverage**: SUMO simulations currently only support the single `demo.net.xml` projected grid until dynamic `.net.xml` generators are linked for newly imported Indian roads.
- **Traffic Provider**: Requires a valid TomTom key. Otherwise, metrics cleanly fallback to "Not Configured".
- **OSM Traffic Signals**: OSM tags do not guarantee actual traffic light presence. Field operators must manually verify candidates before they enter Optimization.

## Security
- Authentication is handled via bearer tokens (simplified for dev).
- Role-based access control separates `Admin` from `Operator`. Operators are strictly isolated from cross-district records.
