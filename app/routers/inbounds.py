from fastapi import APIRouter, Depends
from auth import get_current_user
import models

router = APIRouter(prefix="/inbounds", tags=["inbounds"])

@router.get("/")
def list_inbounds(current_user: models.AdminUser = Depends(get_current_user)):
    return {
        "message": "Inbounds listing endpoint placeholder. To be implemented in next phase.",
        "inbounds": []
    }
