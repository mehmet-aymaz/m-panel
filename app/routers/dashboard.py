from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db), current_user: models.AdminUser = Depends(get_current_user)):
    from stats_collector import get_client_stats
    
    # Inbounds count
    total_inbounds_count = db.query(models.Inbound).count()
    
    # Clients count
    clients = db.query(models.Client).all()
    active_clients_count = sum(1 for c in clients if c.enable)
    
    # Traffic calculations
    total_traffic_bytes = 0
    for client in clients:
        real_up, real_down, _ = get_client_stats(client.email, client.up, client.down)
        total_traffic_bytes += (real_up + real_down)
        
    total_traffic_used_gb = round(total_traffic_bytes / (1024 * 1024 * 1024), 4)
    
    return {
        "active_clients_count": active_clients_count,
        "total_inbounds_count": total_inbounds_count,
        "total_traffic_used_gb": total_traffic_used_gb
    }
