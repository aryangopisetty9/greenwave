import os
import sys
import xml.etree.ElementTree as ET
import traci

# We need simulation service to evaluate candidates
# But we can't import it directly due to circular dependency, so we'll pass the evaluator callback
SUMO_HOME = r"C:\Program Files (x86)\SUMO"
if 'SUMO_HOME' not in os.environ:
    os.environ['SUMO_HOME'] = SUMO_HOME
sys.path.append(os.path.join(SUMO_HOME, 'tools'))

BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sumo")

class OptimizerService:
    def __init__(self):
        self.net_file = os.path.join(BASE_DIR, "demo.net.xml")
        
    def generate_optimized_timings(self, evaluator_fn=None):
        """
        Parses the baseline network and generates a new TLS logic.
        If an evaluator_fn is provided, it searches multiple candidates and picks the best one.
        evaluator_fn takes a candidate_timings dict and returns a dict with 'average_waiting_time'.
        """
        if not os.path.exists(self.net_file):
            raise FileNotFoundError("Network file not found.")
            
        tree = ET.parse(self.net_file)
        root = tree.getroot()
        
        # Read baseline tlLogic
        baseline_tls = {}
        for tl in root.findall('tlLogic'):
            tl_id = tl.get('id')
            phases = []
            for phase in tl.findall('phase'):
                state = phase.get('state')
                duration = float(phase.get('duration', 0))
                phases.append((duration, state))
            baseline_tls[tl_id] = phases

        if not evaluator_fn:
            # Fallback if no evaluator provided, just return baseline
            return self._build_traci_phases(baseline_tls)

        # Generate candidates: Test a few offset modifications to create a green wave
        # We assume 4 intersections. We'll try offsets of 0, 10, 20, 30 seconds for the corridor.
        best_timings = baseline_tls
        best_metric = float('inf')
        
        # Candidate 1: Baseline
        baseline_timings = self._build_traci_phases(baseline_tls)
        baseline_res = evaluator_fn(baseline_timings)
        if baseline_res and 'average_travel_time' in baseline_res:
            best_metric = baseline_res['average_travel_time']
            
        # Strategy: we want to find better splits for the main phases.
        # We respect min_green=10, max_green=60
        # Phase 0 is typically Main Green, Phase 2 is Cross Green. Phase 1 and 3 are Yellow.
        # Let's test a few combinations of splits.
        split_deltas = [
            (5, -5),   # +5s main, -5s cross
            (10, -10),
            (-5, 5),   # -5s main, +5s cross
            (-10, 10),
        ]
        
        for d_main, d_cross in split_deltas:
            candidate = {}
            valid_candidate = True
            for tl_id, phases in baseline_tls.items():
                new_phases = []
                for p_idx, (dur, state) in enumerate(phases):
                    if 'y' in state.lower() or 'r' in state.lower():
                        # Do not alter yellow or all-red phases
                        new_phases.append((dur, state))
                    elif p_idx == 0:
                        # Main green
                        new_dur = dur + d_main
                        if new_dur < 10 or new_dur > 60:
                            valid_candidate = False
                        new_phases.append((new_dur, state))
                    elif p_idx == 2:
                        # Cross green
                        new_dur = dur + d_cross
                        if new_dur < 10 or new_dur > 60:
                            valid_candidate = False
                        new_phases.append((new_dur, state))
                    else:
                        new_phases.append((dur, state))
                candidate[tl_id] = new_phases
            
            if not valid_candidate:
                continue
                
            candidate_traci = self._build_traci_phases(candidate)
            res = evaluator_fn(candidate_traci)
            if res and 'average_travel_time' in res:
                if res['average_travel_time'] < best_metric:
                    best_metric = res['average_travel_time']
                    best_timings = candidate

        # If no improvement was found, we return the baseline
        # The prompt requires: "If none improves the selected objective, retain the baseline"
        return self._build_traci_phases(best_timings)

    def _build_traci_phases(self, timings_dict):
        result = {}
        for tl_id, phases in timings_dict.items():
            traci_phases = []
            for (dur, state) in phases:
                traci_phases.append(traci.trafficlight.Phase(dur, state))
            result[tl_id] = traci_phases
        return result

optimizer_service = OptimizerService()
