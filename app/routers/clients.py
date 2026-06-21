import uuid
import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from auth import get_current_user
import models
from xray_manager import generate_config, apply_config

router = APIRouter(prefix="/clients", tags=["clients"])

# Pydantic schemas
class ClientBase(BaseModel):
    inbound_id: int
    email: str
    uuid: Optional[str] = None
    total_gb: Optional[float] = 0.0
    expiry_days: Optional[int] = 0  # 0 means unlimited
    enable: Optional[bool] = True
    limit_ip: Optional[int] = 0
    tg_id: Optional[str] = None
    comment: Optional[str] = None
    flow: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    inbound_id: Optional[int] = None
    email: Optional[str] = None
    uuid: Optional[str] = None
    total_gb: Optional[float] = None
    expiry_days: Optional[int] = None  # 0 means unlimited, None means don't change
    enable: Optional[bool] = None
    limit_ip: Optional[int] = None
    tg_id: Optional[str] = None
    comment: Optional[str] = None
    flow: Optional[str] = None

class ClientResponse(BaseModel):
    id: int
    inbound_id: int
    inbound_remark: Optional[str]
    email: str
    uuid: str
    total_gb: float
    expiry_time: int
    up: int
    down: int
    enable: bool
    limit_ip: int
    tg_id: Optional[str]
    comment: Optional[str]
    flow: Optional[str]
    online: bool = False

    class Config:
        from_attributes = True

@router.get("/", response_model=List[ClientResponse])
def list_clients(db: Session = Depends(get_db), current_user: models.AdminUser = Depends(get_current_user)):
    from stats_collector import get_client_stats
    clients = db.query(models.Client).all()
    
    result = []
    for client in clients:
        inbound = db.query(models.Inbound).filter(models.Inbound.id == client.inbound_id).first()
        inbound_remark = inbound.remark if inbound else "Bilinmiyor"
        
        real_up, real_down, is_online = get_client_stats(client.email, client.up, client.down)
        
        result.append(ClientResponse(
            id=client.id,
            inbound_id=client.inbound_id,
            inbound_remark=inbound_remark,
            email=client.email,
            uuid=client.uuid,
            total_gb=client.total_gb,
            expiry_time=client.expiry_time,
            up=real_up,
            down=real_down,
            enable=client.enable,
            limit_ip=client.limit_ip,
            tg_id=client.tg_id,
            comment=client.comment,
            flow=client.flow,
            online=is_online
        ))
    return result

@router.post("/", response_model=ClientResponse)
def create_client(
    client_in: ClientCreate,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    # Check email collision
    existing = db.query(models.Client).filter(models.Client.email == client_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{client_in.email} e-posta adresi zaten kullanımda."
        )

    # Check if inbound exists
    inbound = db.query(models.Inbound).filter(models.Inbound.id == client_in.inbound_id).first()
    if not inbound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inbound ID {client_in.inbound_id} bulunamadı."
        )

    # Validate UUID if provided
    client_uuid = client_in.uuid
    if client_uuid:
        try:
            uuid.UUID(client_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geçersiz UUID formatı. Lütfen geçerli bir UUID girin."
            )
    else:
        client_uuid = str(uuid.uuid4())

    # Convert expiry_days to expiry_time timestamp in milliseconds
    expiry_time = 0
    if client_in.expiry_days and client_in.expiry_days > 0:
        expiry_time = int((time.time() + client_in.expiry_days * 24 * 3600) * 1000)

    # Create client
    db_client = models.Client(
        inbound_id=client_in.inbound_id,
        email=client_in.email,
        uuid=client_uuid,
        total_gb=client_in.total_gb if client_in.total_gb is not None else 0.0,
        expiry_time=expiry_time,
        enable=client_in.enable if client_in.enable is not None else True,
        limit_ip=client_in.limit_ip if client_in.limit_ip is not None else 0,
        tg_id=client_in.tg_id,
        comment=client_in.comment,
        flow=client_in.flow
    )

    db.add(db_client)

    try:
        db.flush()
        # Apply changes to Xray
        config_str = generate_config(db)
        apply_config(config_str)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Xray yapılandırması uygulanamadı. Hata: {str(e)}"
        )

    inbound_remark = inbound.remark if inbound else "Bilinmiyor"
    return ClientResponse(
        id=db_client.id,
        inbound_id=db_client.inbound_id,
        inbound_remark=inbound_remark,
        email=db_client.email,
        uuid=db_client.uuid,
        total_gb=db_client.total_gb,
        expiry_time=db_client.expiry_time,
        up=db_client.up,
        down=db_client.down,
        enable=db_client.enable,
        limit_ip=db_client.limit_ip,
        tg_id=db_client.tg_id,
        comment=db_client.comment,
        flow=db_client.flow
    )

@router.put("/{id}", response_model=ClientResponse)
def update_client(
    id: int,
    client_in: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    db_client = db.query(models.Client).filter(models.Client.id == id).first()
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı."
        )

    # Convert request to dict, only including fields that were explicitly sent
    update_data = client_in.dict(exclude_unset=True)

    # Check email collision
    if "email" in update_data:
        email_val = update_data["email"]
        if email_val is not None and email_val != db_client.email:
            existing = db.query(models.Client).filter(models.Client.email == email_val).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{email_val} e-posta adresi zaten kullanımda."
                )
            db_client.email = email_val

    # Check if inbound exists
    if "inbound_id" in update_data:
        inb_id_val = update_data["inbound_id"]
        if inb_id_val is not None and inb_id_val != db_client.inbound_id:
            inbound = db.query(models.Inbound).filter(models.Inbound.id == inb_id_val).first()
            if not inbound:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Inbound ID {inb_id_val} bulunamadı."
                )
            db_client.inbound_id = inb_id_val

    # Validate UUID if updated
    if "uuid" in update_data:
        uuid_val = update_data["uuid"]
        if uuid_val is not None:
            try:
                uuid.UUID(uuid_val)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Geçersiz UUID formatı. Lütfen geçerli bir UUID girin."
                )
            db_client.uuid = uuid_val

    # Update other fields, letting None values clear the field
    if "total_gb" in update_data:
        db_client.total_gb = update_data["total_gb"]
    if "enable" in update_data:
        db_client.enable = update_data["enable"]
    if "limit_ip" in update_data:
        db_client.limit_ip = update_data["limit_ip"]
    if "tg_id" in update_data:
        db_client.tg_id = update_data["tg_id"]
    if "comment" in update_data:
        db_client.comment = update_data["comment"]
    if "flow" in update_data:
        db_client.flow = update_data["flow"]

    # Expiry updates
    if "expiry_days" in update_data:
        expiry_days_val = update_data["expiry_days"]
        if expiry_days_val is not None:
            if expiry_days_val == 0:
                db_client.expiry_time = 0
            else:
                db_client.expiry_time = int((time.time() + expiry_days_val * 24 * 3600) * 1000)

    try:
        db.flush()
        # Apply changes to Xray
        config_str = generate_config(db)
        apply_config(config_str)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Xray yapılandırması uygulanamadı. Hata: {str(e)}"
        )

    inbound = db.query(models.Inbound).filter(models.Inbound.id == db_client.inbound_id).first()
    inbound_remark = inbound.remark if inbound else "Bilinmiyor"
    return ClientResponse(
        id=db_client.id,
        inbound_id=db_client.inbound_id,
        inbound_remark=inbound_remark,
        email=db_client.email,
        uuid=db_client.uuid,
        total_gb=db_client.total_gb,
        expiry_time=db_client.expiry_time,
        up=db_client.up,
        down=db_client.down,
        enable=db_client.enable,
        limit_ip=db_client.limit_ip,
        tg_id=db_client.tg_id,
        comment=db_client.comment,
        flow=db_client.flow
    )

@router.delete("/{id}")
def delete_client(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    db_client = db.query(models.Client).filter(models.Client.id == id).first()
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı."
        )

    db.delete(db_client)

    try:
        db.flush()
        config_str = generate_config(db)
        apply_config(config_str)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Kullanıcı silinirken Xray yapılandırması uygulanamadı. Hata: {str(e)}"
        )

    return {"status": "ok", "message": f"Kullanıcı {id} başarıyla silindi."}

@router.patch("/{id}/toggle", response_model=ClientResponse)
def toggle_client(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    db_client = db.query(models.Client).filter(models.Client.id == id).first()
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı."
        )

    db_client.enable = not db_client.enable

    try:
        db.flush()
        config_str = generate_config(db)
        apply_config(config_str)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Kullanıcı durumu güncellenirken Xray yapılandırması uygulanamadı. Hata: {str(e)}"
        )

    inbound = db.query(models.Inbound).filter(models.Inbound.id == db_client.inbound_id).first()
    inbound_remark = inbound.remark if inbound else "Bilinmiyor"
    return ClientResponse(
        id=db_client.id,
        inbound_id=db_client.inbound_id,
        inbound_remark=inbound_remark,
        email=db_client.email,
        uuid=db_client.uuid,
        total_gb=db_client.total_gb,
        expiry_time=db_client.expiry_time,
        up=db_client.up,
        down=db_client.down,
        enable=db_client.enable,
        limit_ip=db_client.limit_ip,
        tg_id=db_client.tg_id,
        comment=db_client.comment,
        flow=db_client.flow
    )

@router.post("/{id}/reset-traffic", response_model=ClientResponse)
def reset_client_traffic(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    db_client = db.query(models.Client).filter(models.Client.id == id).first()
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı."
        )

    db_client.up = 0
    db_client.down = 0
    
    try:
        from stats_collector import reset_in_memory_traffic
        reset_in_memory_traffic(db_client.email)
    except Exception:
        pass
        
    db.commit()

    inbound = db.query(models.Inbound).filter(models.Inbound.id == db_client.inbound_id).first()
    inbound_remark = inbound.remark if inbound else "Bilinmiyor"
    return ClientResponse(
        id=db_client.id,
        inbound_id=db_client.inbound_id,
        inbound_remark=inbound_remark,
        email=db_client.email,
        uuid=db_client.uuid,
        total_gb=db_client.total_gb,
        expiry_time=db_client.expiry_time,
        up=db_client.up,
        down=db_client.down,
        enable=db_client.enable,
        limit_ip=db_client.limit_ip,
        tg_id=db_client.tg_id,
        comment=db_client.comment,
        flow=db_client.flow
    )

@router.get("/{id}/ip-logs")
def get_client_ip_logs(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    import subprocess
    client = db.query(models.Client).filter(models.Client.id == id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
        
    email = client.email
    
    try:
        cmd = ["journalctl", "-u", "xray", "-n", "2000", "--no-pager"]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        if res.returncode != 0:
            return []
            
        logs = []
        seen_ips = set()
        
        lines = res.stdout.splitlines()
        for line in reversed(lines):
            # Check for email in line
            if f"email: {email}".lower() in line.lower() or f"email:{email}".lower() in line.lower():
                try:
                    if "from " in line:
                        parts = line.split("from ")
                        ip_part = parts[1].split()[0]
                        ip = ip_part.split(":")[0]
                        
                        # Extract timestamp
                        time_str = ""
                        time_part = parts[0].strip().split()
                        for word in time_part:
                            if "/" in word and len(word) >= 8:
                                idx = time_part.index(word)
                                if idx + 1 < len(time_part):
                                    time_str = f"{word} {time_part[idx+1].split('.')[0]}"
                                break
                        
                        if not time_str:
                            time_str = " ".join(time_part[:3])
                            
                        if ip not in seen_ips:
                            seen_ips.add(ip)
                            logs.append({"ip": ip, "time": time_str.replace("/", "-")})
                            if len(logs) >= 5:
                                break
                except Exception:
                    pass
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"IP günlükleri alınamadı: {str(e)}")

