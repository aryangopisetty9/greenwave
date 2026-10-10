import httpx
import time

client = httpx.Client(base_url="http://localhost:8000/api/v1")

print("1. Login...")
res = client.post("/auth/login", json={"email": "test@example.com", "password": "password"})
if res.status_code != 200:
    print("Signup...")
    # Get state & district
    states = client.get("/locations/states").json()
    state_id = states[0]['id']
    districts = client.get(f"/locations/states/{state_id}/districts").json()
    district_id = districts[0]['id']
    
    res = client.post("/auth/signup", json={
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "password",
        "state_id": state_id,
        "district_id": district_id
    })
    res = client.post("/auth/login", json={"email": "test@example.com", "password": "password"})

token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print(f"Token: {token}")

print("2. Check videos...")
res = client.get("/cv/demo/check", headers=headers)
print("Check:", res.json())

print("3. Start Demo...")
res = client.post("/cv/demo/start", headers=headers)
print("Start:", res.json())

if res.status_code == 200:
    session_id = res.json()["session_id"]
    print(f"Waiting for 15s to let optimizer log decisions... session: {session_id}")
    time.sleep(15)
    
    print("4. Stop Demo...")
    res = client.post(f"/cv/demo/action/{session_id}?action=stop", headers=headers)
    print("Stop:", res.json())

print("5. Check Analytics...")
res = client.get("/analytics/summary", headers=headers)
print("Analytics:", res.json())

print("6. Check Alerts...")
res = client.get("/alerts", headers=headers)
print("Alerts:", res.json())
