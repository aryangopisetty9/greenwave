import os
import sys
import subprocess
import tempfile
import xml.etree.ElementTree as ET

# Add SUMO_HOME to path for traci
SUMO_HOME = r"C:\Program Files (x86)\SUMO"
if 'SUMO_HOME' not in os.environ:
    os.environ['SUMO_HOME'] = SUMO_HOME
tools = os.path.join(SUMO_HOME, 'tools')
sys.path.append(tools)
import traci

BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sumo")

class SimulationService:
    def __init__(self):
        self.sumo_binary = os.path.join(SUMO_HOME, "bin", "sumo.exe")
        self.net_file = os.path.join(BASE_DIR, "demo.net.xml")
        self.rou_file = os.path.join(BASE_DIR, "demo.rou.xml")
        self.sumocfg = os.path.join(BASE_DIR, "demo.sumocfg")
    
    def run_simulation(self, optimized_timings=None):
        # We use a temporary directory for outputs to avoid conflicts
        with tempfile.TemporaryDirectory() as tmpdirname:
            tripinfo_out = os.path.join(tmpdirname, "tripinfo.xml")
            summary_out = os.path.join(tmpdirname, "summary.xml")
            
            cmd = [
                self.sumo_binary,
                "-c", self.sumocfg,
                "--tripinfo-output", tripinfo_out,
                "--summary-output", summary_out,
                "--no-step-log", "true",
                "--no-warnings", "true"
            ]
            
            # Start TraCI
            traci.start(cmd)
            
            try:
                # Apply optimized timings if provided
                if optimized_timings:
                    for tls_id, phases in optimized_timings.items():
                        # Create a new Logic object for TraCI
                        logic = traci.trafficlight.Logic("optim", 0, 0, phases)
                        traci.trafficlight.setProgramLogic(tls_id, logic)
                
                step = 0
                snapshots = []
                cum_departed = 0
                cum_arrived = 0
                while traci.simulation.getMinExpectedNumber() > 0 and step < 3600:
                    traci.simulationStep()
                    cum_departed += traci.simulation.getDepartedNumber()
                    cum_arrived += traci.simulation.getArrivedNumber()
                    if step % 10 == 0:
                        vehicles = []
                        for vid in traci.vehicle.getIDList():
                            # Bounded snapshot limit, let's say max 100 vehicles to avoid huge payloads
                            if len(vehicles) >= 100:
                                break
                            x, y = traci.vehicle.getPosition(vid)
                            lon, lat = traci.simulation.convertGeo(x, y)
                            vehicles.append({
                                "id": vid,
                                "edge_id": traci.vehicle.getRoadID(vid),
                                "x": round(x, 2),
                                "y": round(y, 2),
                                "lon": round(lon, 6),
                                "lat": round(lat, 6)
                            })
                            
                        # Also get signal states
                        signals = {}
                        for tls_id in traci.trafficlight.getIDList():
                            signals[tls_id] = traci.trafficlight.getRedYellowGreenState(tls_id)

                        snapshots.append({
                            "time": step,
                            "running": traci.vehicle.getIDCount(),
                            "departed_cum": cum_departed,
                            "arrived_cum": cum_arrived,
                            "vehicles": vehicles,
                            "signals": signals
                        })
                    step += 1
            finally:
                traci.close()
            
            results = self._parse_results(tripinfo_out, summary_out)
            results["snapshots"] = snapshots
            return results
            
    def _parse_results(self, tripinfo_path, summary_path):
        results = {
            "completed_vehicles": 0,
            "departed_vehicles": 0,
            "unfinished_vehicles": 0,
            "average_travel_time": 0.0,
            "average_waiting_time": 0.0,
            "throughput": 0.0,
            "duration": 3600
        }
        
        # Parse Summary for totals
        if os.path.exists(summary_path):
            summary_tree = ET.parse(summary_path)
            summary_root = summary_tree.getroot()
            # The last step has the final counts
            last_step = summary_root.findall('step')[-1]
            if last_step is not None:
                results["departed_vehicles"] = int(last_step.get('inserted', 0))
                results["running_vehicles"] = int(last_step.get('running', 0))
                results["unfinished_vehicles"] = int(last_step.get('running', 0)) + int(last_step.get('waiting', 0))
                results["completed_vehicles"] = int(last_step.get('ended', 0))
        
        if not os.path.exists(tripinfo_path):
            return results
            
        # Parse Tripinfo
        tree = ET.parse(tripinfo_path)
        root = tree.getroot()
        
        total_travel_time = 0.0
        total_waiting_time = 0.0
        count = 0
        
        for trip in root.findall('tripinfo'):
            duration = float(trip.get('duration', 0))
            waitingTime = float(trip.get('waitingTime', 0))
            total_travel_time += duration
            total_waiting_time += waitingTime
            count += 1
            
        if count > 0:
            results["average_travel_time"] = round(total_travel_time / count, 2)
            results["average_waiting_time"] = round(total_waiting_time / count, 2)
            results["throughput"] = count
            
        return results

simulation_service = SimulationService()
