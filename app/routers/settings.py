from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import shutil
import zipfile
import tempfile
import pyotp
import urllib.request
import urllib.parse
import json
from database import get_db
from auth import get_current_user, get_password_hash, verify_password
import models

router = APIRouter(prefix="/settings", tags=["settings"])

class SettingItem(BaseModel):
    key: str
    value: Optional[str] = ""

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class Verify2FARequest(BaseModel):
    code: str

# GET /settings/ - Get all settings (masked sensitive data)
@router.get("/")
def get_settings(
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    settings = db.query(models.SystemSetting).all()
    res = {}
    for s in settings:
        val = s.value
        # Mask sensitive keys
        if s.key == "telegram_bot_token" and val:
            val = val[:6] + "..." + val[-6:] if len(val) > 12 else val
        res[s.key] = val
        
    # Also include 2FA status for the current admin user
    res["two_factor_enabled"] = current_user.two_factor_enabled
    return res

# PUT /settings/ - Update settings
@router.put("/")
def update_settings(
    settings_data: List[SettingItem],
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    for item in settings_data:
        setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == item.key).first()
        if setting:
            # If value is masked (e.g. contains '...'), do not update it unless it changed
            if item.key == "telegram_bot_token" and item.value and "..." in item.value:
                continue
            setting.value = item.value
        else:
            db.add(models.SystemSetting(key=item.key, value=item.value))
    db.commit()
    return {"message": "Ayarlar başarıyla güncellendi."}

# POST /settings/change-password - Change admin password
@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mevcut şifre hatalı."
        )
    
    current_user.password_hash = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Şifreniz başarıyla değiştirildi."}

# POST /settings/backup - Backup DB & config, returns ZIP
@router.post("/backup")
def get_backup(
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    db_path = "/opt/m-panel/app/data/panel.db"
    xray_config = "/usr/local/etc/xray/config.json"
    
    if not os.path.exists(db_path):
        # fallback to local app directory for debugging/dev
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "panel.db")
        if not os.path.exists(db_path):
            db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "m_panel.db")
            
    # Create zip file in temp directory
    temp_dir = tempfile.mkdtemp()
    zip_filename = os.path.join(temp_dir, "m-panel-backup.zip")
    
    try:
        with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Safe copy of DB to avoid locking
            if os.path.exists(db_path):
                temp_db = os.path.join(temp_dir, "panel.db")
                shutil.copy2(db_path, temp_db)
                zipf.write(temp_db, "panel.db")
            if os.path.exists(xray_config):
                zipf.write(xray_config, "xray_config.json")
                
        return FileResponse(
            path=zip_filename,
            filename="m-panel-backup.zip",
            media_type="application/zip"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Yedekleme oluşturulamadı: {str(e)}"
        )

# POST /settings/2fa/setup - Init 2FA
@router.post("/2fa/setup")
def setup_2fa(
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    # Generate random secret if not already present
    if not current_user.two_factor_secret:
        current_user.two_factor_secret = pyotp.random_base32()
        db.commit()
        
    totp = pyotp.TOTP(current_user.two_factor_secret)
    otpauth_url = totp.provisioning_uri(
        name=current_user.username,
        issuer_name="M-Panel"
    )
    
    return {
        "secret": current_user.two_factor_secret,
        "otpauth_url": otpauth_url
    }

# POST /settings/2fa/enable - Verify code and enable 2FA
@router.post("/2fa/enable")
def enable_2fa(
    data: Verify2FARequest,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    if not current_user.two_factor_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA kurulumu başlatılmamış."
        )
        
    totp = pyotp.TOTP(current_user.two_factor_secret)
    if totp.verify(data.code):
        current_user.two_factor_enabled = True
        db.commit()
        return {"message": "İki faktörlü kimlik doğrulama başarıyla aktifleştirildi."}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doğrulama kodu geçersiz."
        )

# POST /settings/2fa/disable - Disable 2FA
@router.post("/2fa/disable")
def disable_2fa(
    data: Verify2FARequest,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    totp = pyotp.TOTP(current_user.two_factor_secret) if current_user.two_factor_secret else None
    if totp and totp.verify(data.code):
        current_user.two_factor_enabled = False
        current_user.two_factor_secret = None
        db.commit()
        return {"message": "İki faktörlü kimlik doğrulama devre dışı bırakıldı."}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doğrulama kodu geçersiz."
        )

# POST /settings/telegram/test - Test telegram message
@router.post("/telegram/test")
def test_telegram(
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    token_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "telegram_bot_token").first()
    chat_id_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "telegram_chat_id").first()
    
    bot_token = token_setting.value if token_setting else ""
    chat_id = chat_id_setting.value if chat_id_setting else ""
    
    if not bot_token or not chat_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram Bot Token veya Chat ID eksik."
        )
        
    # Send test message using urllib
    text = "🔔 *M-Panel Entegrasyon Testi*\nTelegram bot bildirimleri başarıyla aktif edildi!"
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown"
    }
    
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=5) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            if not res_data.get("ok"):
                raise Exception(res_data.get("description", "Bilinmeyen hata"))
        return {"message": "Test mesajı başarıyla gönderildi."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Telegram bildirim testi başarısız: {str(e)}"
        )
