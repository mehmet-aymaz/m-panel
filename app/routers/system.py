import shutil
import psutil
import subprocess
from fastapi import APIRouter, Depends
from auth import get_current_user
import models

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/status")
def get_system_status(current_user: models.AdminUser = Depends(get_current_user)):
    # CPU usage
    cpu_percent = psutil.cpu_percent(interval=None)
    
    # Memory usage
    mem = psutil.virtual_memory()
    memory_percent = mem.percent
    memory_total = mem.total
    memory_used = mem.used
    
    # Disk usage
    disk = shutil.disk_usage("/")
    disk_total = disk.total
    disk_used = disk.used
    disk_percent = (disk.used / disk.total) * 100
    
    # Check xray service status
    xray_active = False
    try:
        res = subprocess.run(["systemctl", "is-active", "xray"], capture_output=True, text=True)
        xray_active = res.stdout.strip() == "active"
    except Exception:
        pass
        
    return {
        "cpu_usage": cpu_percent,
        "memory": {
            "percent": memory_percent,
            "total_bytes": memory_total,
            "used_bytes": memory_used
        },
        "disk": {
            "percent": round(disk_percent, 2),
            "total_bytes": disk_total,
            "used_bytes": disk_used
        },
        "xray_service_active": xray_active
    }
