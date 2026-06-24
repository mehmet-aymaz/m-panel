import base64
import hashlib
import json
import io
import time
import os
import paramiko
from cryptography.fernet import Fernet
from auth import JWT_SECRET_KEY
import models

def get_fernet() -> Fernet:
    # Derive a 32-byte key from JWT_SECRET_KEY
    key_bytes = hashlib.sha256(JWT_SECRET_KEY.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)

def encrypt_password(password: str) -> str:
    if not password:
        return ""
    f = get_fernet()
    return f.encrypt(password.encode()).decode()

def decrypt_password(encrypted: str) -> str:
    if not encrypted:
        return ""
    f = get_fernet()
    try:
        return f.decrypt(encrypted.encode()).decode()
    except Exception:
        return ""

def get_ssh_client(node: models.Node) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    password = decrypt_password(node.password) if node.password else None
    ssh_key = decrypt_password(node.ssh_key) if node.ssh_key else None
    
    if ssh_key:
        key_file = io.StringIO(ssh_key)
        try:
            pkey = paramiko.RSAKey.from_private_key(key_file, password=password)
        except Exception:
            try:
                pkey = paramiko.Ed25519Key.from_private_key(key_file, password=password)
            except Exception:
                try:
                    pkey = paramiko.PKey.from_private_key(key_file, password=password)
                except Exception as e:
                    raise RuntimeError(f"SSH Anahtarı ayrıştırılamadı: {e}")
        client.connect(node.host, port=node.port, username=node.username, pkey=pkey, timeout=10)
    elif password:
        client.connect(node.host, port=node.port, username=node.username, password=password, timeout=10)
    else:
        client.connect(node.host, port=node.port, username=node.username, timeout=10)
        
    return client

def push_xray_config(node: models.Node, config: dict) -> bool:
    client = get_ssh_client(node)
    try:
        config_str = json.dumps(config, indent=2)
        sftp = client.open_sftp()
        
        # Write config to tmp file
        temp_path = "/tmp/xray_config_new.json"
        with sftp.open(temp_path, "w") as f:
            f.write(config_str)
        sftp.close()
        
        # Validate config on the remote host
        val_cmd = f"if [ -f /usr/local/bin/xray ]; then /usr/local/bin/xray -test -config {temp_path}; else xray -test -config {temp_path}; fi"
        stdin, stdout, stderr = client.exec_command(val_cmd)
        exit_code = stdout.channel.recv_exit_status()
        
        if exit_code != 0:
            err_msg = stderr.read().decode('utf-8', errors='ignore') or stdout.read().decode('utf-8', errors='ignore')
            raise RuntimeError(f"Config doğrulama hatası: {err_msg}")
            
        # Move and restart
        target_path = node.xray_config_path or "/usr/local/etc/xray/config.json"
        target_dir = os.path.dirname(target_path)
        
        # Ensure remote target dir exists
        client.exec_command(f"mkdir -p {target_dir}")
        
        move_cmd = f"mv {temp_path} {target_path} && systemctl restart xray"
        stdin, stdout, stderr = client.exec_command(move_cmd)
        exit_code = stdout.channel.recv_exit_status()
        
        if exit_code != 0:
            err_msg = stderr.read().decode('utf-8', errors='ignore')
            raise RuntimeError(f"Config taşınırken veya Xray restart edilirken hata oluştu: {err_msg}")
            
        return True
    finally:
        client.close()

def get_node_stats(node: models.Node) -> dict:
    remote_script = """import json, os, time, subprocess, shutil
try:
    import psutil
    cpu = psutil.cpu_percent(interval=0.5)
    cores = psutil.cpu_count(logical=True)
    mem = psutil.virtual_memory()
    mem_pct, mem_tot, mem_usd = mem.percent, mem.total, mem.used
    swap = psutil.swap_memory()
    swap_pct, swap_tot, swap_usd = swap.percent, swap.total, swap.used
    
    net_io = psutil.net_io_counters()
    net_sent = net_io.bytes_sent
    net_recv = net_io.bytes_recv
    
    tcp_count = 0
    udp_count = 0
    try:
        connections = psutil.net_connections(kind='inet')
        for conn in connections:
            if conn.type == 1:
                tcp_count += 1
            elif conn.type == 2:
                udp_count += 1
    except:
        pass
    uptime = int(time.time() - psutil.boot_time())
except ImportError:
    # Fallback to pure procfs parsing
    try:
        with open('/proc/loadavg') as f:
            load = float(f.read().split()[0])
        cpu = min(100.0, load * 10)
    except:
        cpu = 0.0
    cores = os.cpu_count() or 1
    mem_pct, mem_tot, mem_usd = 0.0, 0, 0
    swap_pct, swap_tot, swap_usd = 0.0, 0, 0
    try:
        with open('/proc/meminfo') as f:
            lines = f.readlines()
        mem_info = {}
        for line in lines:
            parts = line.split()
            if len(parts) >= 2:
                mem_info[parts[0].replace(':', '')] = int(parts[1]) * 1024
        mem_tot = mem_info.get('MemTotal', 0)
        mem_free = mem_info.get('MemFree', 0)
        mem_cached = mem_info.get('Cached', 0)
        mem_buffers = mem_info.get('Buffers', 0)
        mem_usd = mem_tot - (mem_free + mem_cached + mem_buffers)
        if mem_tot > 0:
            mem_pct = round((mem_usd / mem_tot) * 100, 2)
            
        swap_tot = mem_info.get('SwapTotal', 0)
        swap_free = mem_info.get('SwapFree', 0)
        swap_usd = swap_tot - swap_free
        if swap_tot > 0:
            swap_pct = round((swap_usd / swap_tot) * 100, 2)
    except:
        pass
    net_sent, net_recv = 0, 0
    tcp_count, udp_count = 0, 0
    try:
        with open('/proc/uptime') as f:
            uptime = int(float(f.read().split()[0]))
    except:
        uptime = 0

try:
    disk = shutil.disk_usage('/')
    disk_pct = round((disk.used / disk.total) * 100, 2)
    disk_tot, disk_usd = disk.total, disk.used
except:
    disk_pct, disk_tot, disk_usd = 0.0, 0, 0

xray_active = False
try:
    res = subprocess.run(['systemctl', 'is-active', 'xray'], capture_output=True, text=True)
    xray_active = res.stdout.strip() == 'active'
except:
    pass

stats = {
    'cpu_usage': cpu,
    'cpu_cores': cores,
    'memory': {'percent': mem_pct, 'total_bytes': mem_tot, 'used_bytes': mem_usd},
    'swap': {'percent': swap_pct, 'total_bytes': swap_tot, 'used_bytes': swap_usd},
    'disk': {'percent': disk_pct, 'total_bytes': disk_tot, 'used_bytes': disk_usd},
    'net_io': {'bytes_sent': net_sent, 'bytes_recv': net_recv},
    'connections': {'tcp': tcp_count, 'udp': udp_count},
    'uptime': uptime,
    'xray_service_active': xray_active
}
print(json.dumps(stats))
"""
    client = get_ssh_client(node)
    try:
        # Try to execute in venv if exists, otherwise fallback to python3
        exec_cmd = "if [ -f /opt/m-panel/venv/bin/python ]; then /opt/m-panel/venv/bin/python; else python3; fi"
        stdin, stdout, stderr = client.exec_command(exec_cmd)
        stdin.write(remote_script)
        stdin.close()
        
        out = stdout.read().decode('utf-8', errors='ignore')
        code = stdout.channel.recv_exit_status()
        
        if code != 0:
            err_msg = stderr.read().decode('utf-8', errors='ignore')
            raise RuntimeError(f"Uzak sistem istatistikleri alınamadı: {err_msg}")
            
        return json.loads(out.strip())
    finally:
        client.close()

def test_connection(node: models.Node) -> dict:
    t0 = time.time()
    try:
        client = get_ssh_client(node)
        
        # Check if xray is running
        stdin, stdout, stderr = client.exec_command("systemctl is-active xray")
        xray_running = stdout.read().decode('utf-8').strip() == "active"
        
        client.close()
        latency_ms = int((time.time() - t0) * 1000)
        return {
            "success": True,
            "latency_ms": latency_ms,
            "xray_running": xray_running
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "latency_ms": 0,
            "xray_running": False
        }
