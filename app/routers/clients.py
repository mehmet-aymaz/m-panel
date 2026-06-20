from fastapi import APIRouter, Depends
from auth import get_current_user
import models

router = APIRouter(prefix="/clients", tags=["clients"])

@router.get("/")
def list_clients(current_user: models.AdminUser = Depends(get_current_user)):
    return {
        "message": "Clients listing endpoint placeholder. To be implemented in next phase.",
        "clients": []
    }
