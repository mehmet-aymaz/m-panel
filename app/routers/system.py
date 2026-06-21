from fastapi import APIRouter, Depends, HTTPException, status
import shutil
import psutil
import time
import subprocess
from auth import get_current_user
import models

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/status")
def get_system_status(current_user: models.AdminUser = Depends(get_current_user)):
    # CPU usage and cores
    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_cores = psutil.cpu_count(logical=True)
    
    # Memory usage
    mem = psutil.virtual_memory()
    memory_percent = mem.percent
    memory_total = mem.total
    memory_used = mem.used
    
    # Swap memory usage
    swap = psutil.swap_memory()
    swap_percent = swap.percent
    swap_total = swap.total
    swap_used = swap.used
    
    # Disk usage
    disk = shutil.disk_usage("/")
    disk_total = disk.total
    disk_used = disk.used
    disk_percent = (disk.used / disk.total) * 100
    
    # Network IO counters
    net_io = psutil.net_io_counters()
    net_sent = net_io.bytes_sent
    net_recv = net_io.bytes_recv
    
    # Active connections count
    tcp_count = 0
    udp_count = 0
    try:
        connections = psutil.net_connections(kind='inet')
        for conn in connections:
            if conn.type == 1: # SOCK_STREAM (TCP)
                tcp_count += 1
            elif conn.type == 2: # SOCK_DGRAM (UDP)
                udp_count += 1
    except Exception:
        pass
        
    # Uptime in seconds
    system_uptime = int(time.time() - psutil.boot_time())
    
    # Check xray service status
    xray_active = False
    try:
        res = subprocess.run(["systemctl", "is-active", "xray"], capture_output=True, text=True)
        xray_active = res.stdout.strip() == "active"
    except Exception:
        pass
        
    return {
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

@router.post("/xray/control")
def control_xray(action: str, current_user: models.AdminUser = Depends(get_current_user)):
    if action not in ["start", "stop", "restart"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz işlem. Sadece start, stop veya restart desteklenir."
        )
    
    try:
        if action == "start":
            res = subprocess.run(["systemctl", "start", "xray"], capture_output=True, text=True)
        elif action == "stop":
            res = subprocess.run(["systemctl", "stop", "xray"], capture_output=True, text=True)
        elif action == "restart":
            res = subprocess.run(["systemctl", "restart", "xray"], capture_output=True, text=True)
            
        if res.returncode != 0:
            raise Exception(res.stderr or res.stdout)
            
        # Verify status for start / restart
        if action in ["start", "restart"]:
            time.sleep(1.5)
            status_res = subprocess.run(["systemctl", "is-active", "xray"], capture_output=True, text=True)
            if status_res.stdout.strip() != "active":
                journal_res = subprocess.run(["journalctl", "-u", "xray", "-n", "10", "--no-pager"], capture_output=True, text=True)
                raise Exception(f"Xray servisi başlatılamadı. Servis logları:\n{journal_res.stdout}")
                
        return {"status": "success", "message": f"Xray servisi başarıyla {action} edildi."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Xray servisi {action} edilemedi. Hata: {str(e)}"
        )

