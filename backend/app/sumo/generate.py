import os
import subprocess

SUMO_HOME = r"C:\Program Files (x86)\SUMO"
NETGENERATE = os.path.join(SUMO_HOME, "bin", "netgenerate.exe")
DUAROUTER = os.path.join(SUMO_HOME, "bin", "duarouter.exe")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def create_network():
    # Generate a simple 4x1 grid network (3 inner intersections, 2 outer)
    # We'll make it 4x1, which gives 4 intersections in a row. 
    # default.junctions.type = traffic_light
    net_path = os.path.join(BASE_DIR, "demo.net.xml")
    cmd = [
        NETGENERATE, 
        "--grid", 
        "--grid.x-number", "4", 
        "--grid.y-number", "1", 
        "--grid.x-length", "300", 
        "--grid.y-length", "300", 
        "-o", net_path,
        "--default.junctions.type", "traffic_light"
    ]
    subprocess.run(cmd, check=True)
    print(f"Network generated at {net_path}")

def create_routes():
    # We will generate a simple route file with some random traffic or deterministic traffic along the corridor
    # Actually, we can use python to just write a simple route file
    route_path = os.path.join(BASE_DIR, "demo.rou.xml")
    with open(route_path, "w") as f:
        f.write('<routes>\n')
        f.write('  <vType id="car" accel="0.8" decel="4.5" sigma="0.5" length="5" minGap="2.5" maxSpeed="15" />\n')
        
        # Define a route going left to right (West to East)
        # The edges in a 4x1 grid from netgenerate will be named systematically.
        # Let's inspect the edge names... actually it's easier to just use randomTrips.py
        f.write('</routes>\n')

    # Run randomTrips.py
    random_trips = os.path.join(SUMO_HOME, "tools", "randomTrips.py")
    trips_path = os.path.join(BASE_DIR, "demo.trips.xml")
    cmd = [
        "python", random_trips,
        "-n", os.path.join(BASE_DIR, "demo.net.xml"),
        "-e", "3600",
        "-p", "2", # one vehicle every 2 seconds
        "-o", trips_path,
        "--route-file", route_path
    ]
    subprocess.run(cmd, check=True)
    print("Routes generated.")

if __name__ == "__main__":
    create_network()
    create_routes()
