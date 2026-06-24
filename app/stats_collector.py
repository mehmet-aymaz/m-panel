import threading
import time
import json
import subprocess
import psutil
import shutil
from database import SessionLocal
import models
from xray_manager import rebuild_and_apply_xray_config

# Telegram notifications cooldown
_last_telegram_critical_alert = 0

def send_telegram_notification(text: str):
    db = SessionLocal()
    try:
        token_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "telegram_bot_token").first()
        chat_id_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "telegram_chat_id").first()
        bot_token = token_setting.value if token_setting else ""
        chat_id = chat_id_setting.value if chat_id_setting else ""
        if not bot_token or not chat_id:
            return
            
        import urllib.request
        import urllib.parse
        import json
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown"
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=5) as response:
            pass
    except Exception as e:
        print(f"Telegram notification error: {e}")
    finally:
        db.close()

# In-memory caches
# Key: client email, Value: bool
ONLINE_USERS = {}
# Key: client email, Value: {"up": int, "down": int}
REALTIME_TRAFFIC = {}
# Key: client email, Value: float
LAST_ACTIVE_TIME = {}
# System status metrics cache
SYSTEM_STATUS_CACHE = {}

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
    try:
        psutil.cpu_percent(interval=0.1)
    except:
        pass

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

    update_system_status_cache()

def update_system_status_cache():
    global SYSTEM_STATUS_CACHE, _last_telegram_critical_alert
    try:
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_cores = psutil.cpu_count(logical=True)
        
        mem = psutil.virtual_memory()
        memory_percent = mem.percent
        memory_total = mem.total
        memory_used = mem.used
        
        swap = psutil.swap_memory()
        swap_percent = swap.percent
        swap_total = swap.total
        swap_used = swap.used
        
        disk = shutil.disk_usage("/")
        disk_total = disk.total
        disk_used = disk.used
        disk_percent = (disk.used / disk.total) * 100
        
        net_io = psutil.net_io_counters()
        net_sent = net_io.bytes_sent
        net_recv = net_io.bytes_recv
        
        tcp_count = 0
        udp_count = 0
        try:
            import os
            if os.path.exists('/proc/net/tcp'):
                with open('/proc/net/tcp', 'r') as f:
                    tcp_count = sum(1 for _ in f) - 1
                with open('/proc/net/udp', 'r') as f:
                    udp_count = sum(1 for _ in f) - 1
                if os.path.exists('/proc/net/tcp6'):
                    with open('/proc/net/tcp6', 'r') as f:
                        tcp_count += sum(1 for _ in f) - 1
                if os.path.exists('/proc/net/udp6'):
                    with open('/proc/net/udp6', 'r') as f:
                        udp_count += sum(1 for _ in f) - 1
            else:
                connections = psutil.net_connections(kind='inet')
                for conn in connections:
                    if conn.type == 1:
                        tcp_count += 1
                    elif conn.type == 2:
                        udp_count += 1
        except Exception:
            pass
            
        system_uptime = int(time.time() - psutil.boot_time())
        
        xray_active = False
        try:
            res = subprocess.run(["systemctl", "is-active", "xray"], capture_output=True, text=True)
            xray_active = res.stdout.strip() == "active"
        except Exception:
            pass
            
        SYSTEM_STATUS_CACHE = {
            "cpu_usage": cpu_percent,
            "cpu_cores": cpu_cores,
            "memory": {
                "percent": memory_percent,
                "total_bytes": memory_total,
                "used_bytes": memory_used
            },
            "swap": {
                "percent": swap_percent,
                "total_bytes": swap_total,
                "used_bytes": swap_used
            },
            "disk": {
                "percent": round(disk_percent, 2),
                "total_bytes": disk_total,
                "used_bytes": disk_used
            },
            "net_io": {
                "bytes_sent": net_sent,
                "bytes_recv": net_recv
            },
            "connections": {
                "tcp": tcp_count,
                "udp": udp_count
            },
            "uptime": system_uptime,
            "xray_service_active": xray_active
        }

        # Check critical system alert (> 90% CPU or RAM)
        if cpu_percent > 90 or memory_percent > 90:
            now = time.time()
            if now - _last_telegram_critical_alert > 3600: # 1 hour cooldown
                db = SessionLocal()
                try:
                    notify_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "telegram_notify_critical").first()
                    if notify_setting and notify_setting.value == "true":
                        msg = f"⚠️ *Kritik Sistem Uyarısı!*\nSunucu kaynak kullanımı kritik seviyeye ulaştı:\n\n💻 *CPU Kullanımı:* %{cpu_percent}\n💾 *Bellek Kullanımı:* %{memory_percent}"
                        threading.Thread(target=send_telegram_notification, args=(msg,), daemon=True).start()
                        _last_telegram_critical_alert = now
                except Exception as db_err:
                    print(f"Error querying notification setting: {db_err}")
                finally:
                    db.close()
    except Exception as e:
        print(f"Error updating system status cache: {e}")

def write_deltas_to_db():
    global PENDING_TRAFFIC_DELTAS
    with deltas_lock:
        deltas_to_write = PENDING_TRAFFIC_DELTAS.copy()
        PENDING_TRAFFIC_DELTAS = {}
        
    db = SessionLocal()
    rebuild_needed = False
    try:
        # 1. Update traffic and check bandwidth limit
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
                        notify_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "telegram_notify_expiry").first()
                        if notify_setting and notify_setting.value == "true":
                            used_gb = round((client.up + client.down) / (1024**3), 2)
                            msg = f"🚫 *Kullanıcı Trafik Sınırına Ulaştı*\nE-posta: `{client.email}`\nKota: {client.total_gb} GB\nTüketim: {used_gb} GB\nHesap devre dışı bırakıldı."
                            threading.Thread(target=send_telegram_notification, args=(msg,), daemon=True).start()
                            
        # 2. Check expired clients
        now_ms = int(time.time() * 1000)
        expired_clients = db.query(models.Client).filter(
            models.Client.enable == True,
            models.Client.expiry_time > 0,
            models.Client.expiry_time < now_ms
        ).all()
        for ec in expired_clients:
            ec.enable = False
            rebuild_needed = True
            print(f"Client {ec.email} expired. Disabling...")
            expiry_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(ec.expiry_time / 1000.0))
            notify_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "telegram_notify_expiry").first()
            if notify_setting and notify_setting.value == "true":
                msg = f"⏳ *Kullanıcı Süresi Doldu*\nE-posta: `{ec.email}`\nSon Kullanma: {expiry_str}\nHesap devre dışı bırakıldı."
                threading.Thread(target=send_telegram_notification, args=(msg,), daemon=True).start()

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
        
        # Update active time on online users detection
        for email in online_emails:
            LAST_ACTIVE_TIME[email] = time.time()
        
        # Fetch all current client emails from DB dynamically to ensure new/deleted clients are handled correctly
        db = SessionLocal()
        try:
            db_emails = {c.email for c in db.query(models.Client.email).all()}
        except Exception as e:
            print(f"Error querying client emails: {e}")
            db_emails = set(ONLINE_USERS.keys())
        finally:
            db.close()

        # Update ONLINE_USERS
        now = time.time()
        for email in db_emails:
            if email not in ONLINE_USERS:
                ONLINE_USERS[email] = False

        for email in list(ONLINE_USERS.keys()):
            if email not in db_emails:
                ONLINE_USERS.pop(email, None)
                LAST_ACTIVE_TIME.pop(email, None)
                REALTIME_TRAFFIC.pop(email, None)
                continue
            # Online if in online_emails list or active in last 30 seconds (balances disconnect detection and idle flickering)
            is_online = (email in online_emails) or (now - LAST_ACTIVE_TIME.get(email, 0) < 30)
            ONLINE_USERS[email] = is_online
            
        # 2.5 Update system status cache
        update_system_status_cache()
                    
        # 3. Periodically write deltas to DB (every 30 seconds)
        if time.time() - last_db_write >= 30:
            write_deltas_to_db()
            last_db_write = time.time()
            
        # Sleep for the remainder of the 10-second interval
        elapsed = time.time() - start_time
        sleep_time = max(0.1, 10.0 - elapsed)
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
