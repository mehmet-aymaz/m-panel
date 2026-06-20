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

    class Config:
        from_attributes = True

@router.get("/", response_model=List[ClientResponse])
def list_clients(db: Session = Depends(get_db), current_user: models.AdminUser = Depends(get_current_user)):
    clients = db.query(models.Client).all()
    
    result = []
    for client in clients:
        inbound = db.query(models.Inbound).filter(models.Inbound.id == client.inbound_id).first()
        inbound_remark = inbound.remark if inbound else "Bilinmiyor"
        
        result.append(ClientResponse(
            id=client.id,
            inbound_id=client.inbound_id,
            inbound_remark=inbound_remark,
            email=client.email,
            uuid=client.uuid,
            total_gb=client.total_gb,
            expiry_time=client.expiry_time,
            up=client.up,
            down=client.down,
            enable=client.enable,
            limit_ip=client.limit_ip,
            tg_id=client.tg_id,
            comment=client.comment,
            flow=client.flow
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

    # Check email collision
    if client_in.email is not None and client_in.email != db_client.email:
        existing = db.query(models.Client).filter(models.Client.email == client_in.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{client_in.email} e-posta adresi zaten kullanımda."
            )
        db_client.email = client_in.email

    # Check if inbound exists
    if client_in.inbound_id is not None and client_in.inbound_id != db_client.inbound_id:
        inbound = db.query(models.Inbound).filter(models.Inbound.id == client_in.inbound_id).first()
        if not inbound:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inbound ID {client_in.inbound_id} bulunamadı."
            )
        db_client.inbound_id = client_in.inbound_id

    # Validate UUID if updated
    if client_in.uuid is not None:
        try:
            uuid.UUID(client_in.uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geçersiz UUID formatı. Lütfen geçerli bir UUID girin."
            )
        db_client.uuid = client_in.uuid

    # Update other fields
    if client_in.total_gb is not None:
        db_client.total_gb = client_in.total_gb
    if client_in.enable is not None:
        db_client.enable = client_in.enable
    if client_in.limit_ip is not None:
        db_client.limit_ip = client_in.limit_ip
    if client_in.tg_id is not None:
        db_client.tg_id = client_in.tg_id
    if client_in.comment is not None:
        db_client.comment = client_in.comment
    if client_in.flow is not None:
        db_client.flow = client_in.flow

    # Expiry updates
    if client_in.expiry_days is not None:
        if client_in.expiry_days == 0:
            db_client.expiry_time = 0
        else:
            db_client.expiry_time = int((time.time() + client_in.expiry_days * 24 * 3600) * 1000)

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
