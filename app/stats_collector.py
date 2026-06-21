import threading
import time
import json
import subprocess
from database import SessionLocal
import models
from xray_manager import rebuild_and_apply_xray_config

# In-memory caches
# Key: client email, Value: bool
ONLINE_USERS = {}
# Key: client email, Value: {"up": int, "down": int}
REALTIME_TRAFFIC = {}
# Key: client email, Value: float
LAST_ACTIVE_TIME = {}

# Pending deltas to commit to database periodically
# Key: client email, Value: {"up": int, "down": int}
PENDING_TRAFFIC_DELTAS = {}
deltas_lock = threading.Lock()

_collector_thread = None
_stop_event = threading.Event()

def run_xray_api(command_args):
    cmd = ["/usr/local/bin/xray", "api"] + command_args + ["--server=127.0.0.1:10085"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=3)
        if res.returncode == 0:
            return res.stdout
        else:
            return None
    except Exception:
        return None

def fetch_traffic_deltas():
    # We query with -reset=true to get only the delta since last query
    stdout = run_xray_api(["statsquery", "-reset=true"])
    if not stdout:
        return {}
    
    try:
        data = json.loads(stdout)
    except Exception:
        return {}
        
    deltas = {}
    stats_list = data.get("stat", [])
    for item in stats_list:
        name = item.get("name", "")
        value = item.get("value", 0)
        if name.startswith("user>>>"):
            parts = name.split(">>>")
            if len(parts) >= 4:
                email = parts[1]
                direction = parts[3] # "uplink" or "downlink"
                if email not in deltas:
                    deltas[email] = {"up": 0, "down": 0}
                if direction == "uplink":
                    deltas[email]["up"] += value
                elif direction == "downlink":
                    deltas[email]["down"] += value
    return deltas

def fetch_online_users():
    stdout = run_xray_api(["statsgetallonlineusers"])
    if not stdout:
        return set()
        
    emails = set()
    try:
        data = json.loads(stdout)
        if isinstance(data, list):
            for email in data:
                if isinstance(email, str):
                    emails.add(email.strip())
        elif isinstance(data, dict):
            for key in ["users", "online_users", "user", "emails", "list"]:
                val = data.get(key)
                if isinstance(val, list):
                    for email in val:
                        if isinstance(email, str):
                            emails.add(email.strip())
    except Exception:
        pass
        
    if not emails:
        for line in stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            if "@" in line:
                cleaned = line.replace('"', '').replace("'", "").replace("[", "").replace("]", "").replace(",", "").strip()
                if cleaned:
                    emails.add(cleaned)
                      
    return emails

def load_initial_stats():
    db = SessionLocal()
    try:
        clients = db.query(models.Client).all()
        for client in clients:
            REALTIME_TRAFFIC[client.email] = {
                "up": client.up,
                "down": client.down
            }
            ONLINE_USERS[client.email] = False
    except Exception as e:
        print(f"Error loading initial stats: {e}")
    finally:
        db.close()

def write_deltas_to_db():
    global PENDING_TRAFFIC_DELTAS
    with deltas_lock:
        if not PENDING_TRAFFIC_DELTAS:
            return
        deltas_to_write = PENDING_TRAFFIC_DELTAS.copy()
        PENDING_TRAFFIC_DELTAS = {}
        
    db = SessionLocal()
    rebuild_needed = False
    try:
        for email, delta in deltas_to_write.items():
            if delta["up"] == 0 and delta["down"] == 0:
                continue
            client = db.query(models.Client).filter(models.Client.email == email).first()
            if client:
                client.up += delta["up"]
                client.down += delta["down"]
                # Disable client if bandwidth limit is reached
                if client.total_gb > 0:
                    limit_bytes = client.total_gb * 1024 * 1024 * 1024
                    if (client.up + client.down) >= limit_bytes:
                        client.enable = False
                        rebuild_needed = True
                        print(f"Client {email} limit exceeded. Disabling client...")
        db.commit()
        if rebuild_needed:
            # Rebuild xray config in a background task or thread so we don't block
            threading.Thread(target=rebuild_and_apply_xray_config, daemon=True).start()
    except Exception as e:
        print(f"Error writing traffic deltas to DB: {e}")
        # Restore deltas so they are not lost
        with deltas_lock:
            for email, delta in deltas_to_write.items():
                if email not in PENDING_TRAFFIC_DELTAS:
                    PENDING_TRAFFIC_DELTAS[email] = {"up": 0, "down": 0}
                PENDING_TRAFFIC_DELTAS[email]["up"] += delta["up"]
                PENDING_TRAFFIC_DELTAS[email]["down"] += delta["down"]
    finally:
        db.close()

def get_client_stats(email: str, db_up: int, db_down: int):
    with deltas_lock:
        delta = PENDING_TRAFFIC_DELTAS.get(email, {"up": 0, "down": 0})
        
    current = REALTIME_TRAFFIC.get(email, {"up": db_up, "down": db_down})
    is_online = ONLINE_USERS.get(email, False)
    
    up = max(db_up, current.get("up", db_up) + delta["up"])
    down = max(db_down, current.get("down", db_down) + delta["down"])
    return up, down, is_online

def collect_stats_loop():
    print("Stats collector thread loop starting...")
    load_initial_stats()
    
    last_db_write = time.time()
    while not _stop_event.is_set():
        start_time = time.time()
        
        # 1. Fetch traffic deltas
        deltas = fetch_traffic_deltas()
        if deltas:
            with deltas_lock:
                for email, delta in deltas.items():
                    if email not in PENDING_TRAFFIC_DELTAS:
                        PENDING_TRAFFIC_DELTAS[email] = {"up": 0, "down": 0}
                    PENDING_TRAFFIC_DELTAS[email]["up"] += delta["up"]
                    PENDING_TRAFFIC_DELTAS[email]["down"] += delta["down"]
                    
                    if email not in REALTIME_TRAFFIC:
                        REALTIME_TRAFFIC[email] = {"up": 0, "down": 0}
                    REALTIME_TRAFFIC[email]["up"] += delta["up"]
                    REALTIME_TRAFFIC[email]["down"] += delta["down"]
                    
                    # Update active time on traffic activity
                    if delta["up"] > 0 or delta["down"] > 0:
                        LAST_ACTIVE_TIME[email] = time.time()
        
        # 2. Fetch online users
        online_emails = fetch_online_users()
        
        # Update ONLINE_USERS
        now = time.time()
        for email in list(ONLINE_USERS.keys()):
            # Online if in online_emails list or active in last 60 seconds
            is_online = (email in online_emails) or (now - LAST_ACTIVE_TIME.get(email, 0) < 60)
            ONLINE_USERS[email] = is_online
                    
        # 3. Periodically write deltas to DB (every 30 seconds)
        if time.time() - last_db_write >= 30:
            write_deltas_to_db()
            last_db_write = time.time()
            
        # Sleep for the remainder of the 5-second interval
        elapsed = time.time() - start_time
        sleep_time = max(0.1, 5.0 - elapsed)
        _stop_event.wait(sleep_time)
        
    # Write remaining deltas on shutdown
    write_deltas_to_db()
    print("Stats collector thread loop finished.")

def start_collector():
    global _collector_thread, _stop_event
    if _collector_thread is not None and _collector_thread.is_alive():
        return
    _stop_event.clear()
    _collector_thread = threading.Thread(target=collect_stats_loop, daemon=True, name="StatsCollectorThread")
    _collector_thread.start()
    print("Stats collector thread started successfully.")

def stop_collector():
    global _collector_thread
    if _collector_thread is None:
        return
    _stop_event.set()
    _collector_thread.join(timeout=10)
    print("Stats collector thread stopped successfully.")

def reset_in_memory_traffic(email: str):
    with deltas_lock:
        if email in PENDING_TRAFFIC_DELTAS:
            PENDING_TRAFFIC_DELTAS[email] = {"up": 0, "down": 0}
    if email in REALTIME_TRAFFIC:
        REALTIME_TRAFFIC[email] = {"up": 0, "down": 0}
