from fastapi import APIRouter, Depends
from auth import get_current_user
import models

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary")
def get_dashboard_summary(current_user: models.AdminUser = Depends(get_current_user)):
    # Placeholder for dashboard stats
    return {
        "message": "Dashboard summary endpoint placeholder. To be implemented in next phase.",
        "active_clients_count": 0,
        "total_inbounds_count": 0,
        "total_traffic_used_gb": 0.0
    }
