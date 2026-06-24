from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from auth import verify_password, create_access_token, get_current_user, JWT_SECRET_KEY, JWT_ALGORITHM
import models
from typing import List, Optional
import secrets
from datetime import datetime, timedelta
import pyotp
from jose import jwt

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    status: str = "success" # success, requires_2fa
    temp_token: Optional[str] = None

class Verify2FALoginRequest(BaseModel):
    temp_token: str
    code: str

class APITokenCreate(BaseModel):
    name: str
    scope: str = "read_only"

class APITokenResponse(BaseModel):
    id: int
    name: str
    token: str
    scope: str
    created_at: str
    is_active: bool

    class Config:
        from_attributes = True

@router.post("/login", response_model=LoginResponse)
def login(request_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.AdminUser).filter(models.AdminUser.username == request_data.username).first()
    if not user or not verify_password(request_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kullanıcı adı veya şifre",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if user.two_factor_enabled:
        # Generate a temporary token that expires in 5 minutes
        temp_payload = {
            "sub": user.username,
            "temp": True,
            "exp": datetime.utcnow() + timedelta(minutes=5)
        }
        temp_token = jwt.encode(temp_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        return LoginResponse(status="requires_2fa", temp_token=temp_token)
        
    # Get dynamic timeout value
    timeout_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "session_timeout").first()
    timeout_minutes = int(timeout_setting.value) if timeout_setting and timeout_setting.value else 60 * 24
    
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=timeout_minutes)
    )
    return LoginResponse(access_token=access_token, token_type="bearer", status="success")

@router.post("/login/verify-2fa", response_model=LoginResponse)
def verify_login_2fa(request_data: Verify2FALoginRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(request_data.temp_token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if not payload.get("temp"):
            raise HTTPException(status_code=400, detail="Geçersiz geçici anahtar.")
        username = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Geçici oturum süresi doldu.")
        
    user = db.query(models.AdminUser).filter(models.AdminUser.username == username).first()
    if not user or not user.two_factor_secret:
        raise HTTPException(status_code=400, detail="Kullanıcı bulunamadı veya 2FA aktif değil.")
        
    totp = pyotp.TOTP(user.two_factor_secret)
    if totp.verify(request_data.code):
        # Get dynamic timeout value
        timeout_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "session_timeout").first()
        timeout_minutes = int(timeout_setting.value) if timeout_setting and timeout_setting.value else 60 * 24
        
        access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=timedelta(minutes=timeout_minutes)
        )
        return LoginResponse(access_token=access_token, token_type="bearer", status="success")
    else:
        raise HTTPException(status_code=400, detail="Doğrulama kodu geçersiz.")

@router.post("/api-tokens", response_model=APITokenResponse)
def create_api_token(
    request_data: APITokenCreate, 
    db: Session = Depends(get_db), 
    current_user: models.AdminUser = Depends(get_current_user)
):
    if request_data.scope not in ["read_only", "client_manage", "full_access"]:
        raise HTTPException(status_code=400, detail="Geçersiz yetki kapsamı (scope)")
        
    secure_token = f"mp_{secrets.token_hex(32)}"
    new_token = models.APIToken(
        name=request_data.name,
        token=secure_token,
        scope=request_data.scope,
        created_at=datetime.utcnow().isoformat(),
        is_active=True
    )
    db.add(new_token)
    db.commit()
    db.refresh(new_token)
    return new_token

@router.get("/api-tokens", response_model=List[APITokenResponse])
def list_api_tokens(
    db: Session = Depends(get_db), 
    current_user: models.AdminUser = Depends(get_current_user)
):
    tokens = db.query(models.APIToken).all()
    masked_tokens = []
    for t in tokens:
        masked_val = t.token[:7] + "..." + t.token[-4:] if len(t.token) > 12 else t.token
        masked_tokens.append({
            "id": t.id,
            "name": t.name,
            "token": masked_val,
            "scope": t.scope,
            "created_at": t.created_at,
            "is_active": t.is_active
        })
    return masked_tokens

@router.delete("/api-tokens/{token_id}")
def delete_api_token(
    token_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.AdminUser = Depends(get_current_user)
):
    token_record = db.query(models.APIToken).filter(models.APIToken.id == token_id).first()
    if not token_record:
        raise HTTPException(status_code=404, detail="API Token bulunamadı")
    db.delete(token_record)
    db.commit()
    return {"message": "API Token başarıyla silindi"}

