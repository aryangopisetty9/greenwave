import urllib.request
import urllib.parse
import urllib.error
import json

def test_simulation():
    # 1. Test unauthenticated request should fail with 401
    print("Testing unauthenticated simulation request...")
    req_unauth = urllib.request.Request("http://localhost:8000/api/v1/simulation/run", method="POST")
    try:
        with urllib.request.urlopen(req_unauth) as resp:
            print(f"FAIL: Expected 401 but got {resp.status}")
            return False
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print("PASS: Unauthenticated request returned 401")
        else:
            print(f"FAIL: Expected 401 but got {e.code}")
            return False

    # 2. Login to get token
    print("Logging in...")
    login_data = json.dumps({'email': 'admin@greenwave.com', 'password': 'password'}).encode()
    req_login = urllib.request.Request("http://localhost:8000/api/v1/auth/login", data=login_data)
    req_login.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req_login) as resp:
            token_data = json.loads(resp.read().decode())
            token = token_data['access_token']
    except urllib.error.HTTPError as e:
        print(f"Login failed: {e.code} - {e.read().decode()}")
        return False

    # 3. Test authenticated simulation request
    print("Testing authenticated simulation request...")
    req_auth = urllib.request.Request("http://localhost:8000/api/v1/simulation/run", method="POST")
    req_auth.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req_auth) as resp:
            print(f"Status Code: {resp.status}")
            body = json.loads(resp.read().decode())
            if body.get("status") == "success":
                print("PASS: Authenticated request succeeded.")
                return True
            else:
                print("FAIL: Simulation returned error", body)
                return False
    except urllib.error.HTTPError as e:
        print(f"FAIL: Authenticated request failed with {e.code}: {e.read().decode()}")
        return False

if __name__ == "__main__":
    test_simulation()
