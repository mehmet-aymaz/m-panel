from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from auth import get_current_user
import models
from xray_manager import generate_config, apply_config

router = APIRouter(prefix="/inbounds", tags=["inbounds"])

# Pydantic schemas
class InboundBase(BaseModel):
    remark: Optional[str] = None
    protocol: str
    port: int
    settings: Optional[str] = None
    stream_settings: Optional[str] = None
    enable: Optional[bool] = True
    network: Optional[str] = "ws"
    security: Optional[str] = "tls"
    sni: Optional[str] = None
    ws_path: Optional[str] = "/"
    ws_host: Optional[str] = None
    sniffing_enabled: Optional[bool] = True
    grpc_service_name: Optional[str] = None

class InboundCreate(InboundBase):
    pass

class InboundUpdate(BaseModel):
    remark: Optional[str] = None
    protocol: Optional[str] = None
    port: Optional[int] = None
    settings: Optional[str] = None
    stream_settings: Optional[str] = None
    enable: Optional[bool] = None
    network: Optional[str] = None
    security: Optional[str] = None
    sni: Optional[str] = None
    ws_path: Optional[str] = None
    ws_host: Optional[str] = None
    sniffing_enabled: Optional[bool] = None
    grpc_service_name: Optional[str] = None

class ClientResponse(BaseModel):
    id: int
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

class InboundResponse(BaseModel):
    id: int
    remark: Optional[str]
    protocol: str
    port: int
    settings: Optional[str]
    stream_settings: Optional[str]
    enable: bool
    up: int
    down: int
    total: int
    expiry_time: int
    network: str
    security: str
    sni: Optional[str]
    ws_path: Optional[str]
    ws_host: Optional[str]
    sniffing_enabled: bool
    grpc_service_name: Optional[str]
    clients: List[ClientResponse] = []

    class Config:
        from_attributes = True

@router.get("/", response_model=List[InboundResponse])
def list_inbounds(db: Session = Depends(get_db), current_user: models.AdminUser = Depends(get_current_user)):
    return db.query(models.Inbound).all()

@router.post("/", response_model=InboundResponse)
def create_inbound(
    inbound_in: InboundCreate, 
    db: Session = Depends(get_db), 
    current_user: models.AdminUser = Depends(get_current_user)
):
    # Reserved ports check (System and panel reserve ports)
    RESERVED_PORTS = [22, 8000, 8443]
    if inbound_in.port in RESERVED_PORTS:
        port_desc = {
            22: "SSH bağlantısı",
            8000: "M-Panel API backend servisi",
            8443: "Nginx Web Panel arayüzü"
        }.get(inbound_in.port, "Sistem")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{inbound_in.port} portu {port_desc} tarafından kullanılıyor. Lütfen inbound için farklı bir port girin."
        )

    # Port collision check
    existing = db.query(models.Inbound).filter(models.Inbound.port == inbound_in.port).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{inbound_in.port} portu zaten başka bir inbound tarafından kullanılıyor."
        )

    # Validation: gRPC needs service name
    net = inbound_in.network.lower() if inbound_in.network else "ws"
    if net == "grpc" and not inbound_in.grpc_service_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="gRPC network protokolü için Service Name alanı zorunludur."
        )

    # Create inbound database object
    db_inbound = models.Inbound(
        remark=inbound_in.remark,
        protocol=inbound_in.protocol.lower(),
        port=inbound_in.port,
        settings=inbound_in.settings,
        stream_settings=inbound_in.stream_settings,
        enable=inbound_in.enable if inbound_in.enable is not None else True,
        network=net,
        security=inbound_in.security.lower() if inbound_in.security else "tls",
        sni=inbound_in.sni,
        ws_path=inbound_in.ws_path if inbound_in.ws_path else "/",
        ws_host=inbound_in.ws_host,
        sniffing_enabled=inbound_in.sniffing_enabled if inbound_in.sniffing_enabled is not None else True,
        grpc_service_name=inbound_in.grpc_service_name
    )
    
    db.add(db_inbound)
    
    try:
        # Flush so changes are visible to generate_config in the transaction
        db.flush()
        
        # Apply to Xray
        config_str = generate_config(db)
        apply_config(config_str)
        
        # Commit database changes on success
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Xray yapılandırması uygulanamadı veya servis başlatılamadı. Hata: {str(e)}"
        )
        
    return db_inbound

@router.put("/{id}", response_model=InboundResponse)
def update_inbound(
    id: int,
    inbound_in: InboundUpdate,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    db_inbound = db.query(models.Inbound).filter(models.Inbound.id == id).first()
    if not db_inbound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inbound bulunamadı."
        )

    if inbound_in.port is not None and inbound_in.port != db_inbound.port:
        RESERVED_PORTS = [22, 8000, 8443]
        if inbound_in.port in RESERVED_PORTS:
            port_desc = {
                22: "SSH bağlantısı",
                8000: "M-Panel API backend servisi",
                8443: "Nginx Web Panel arayüzü"
            }.get(inbound_in.port, "Sistem")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{inbound_in.port} portu {port_desc} tarafından kullanılıyor. Lütfen inbound için farklı bir port girin."
            )
        existing = db.query(models.Inbound).filter(models.Inbound.port == inbound_in.port).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{inbound_in.port} portu zaten başka bir inbound tarafından kullanılıyor."
            )
        db_inbound.port = inbound_in.port

    # Determine final network configuration
    final_network = inbound_in.network.lower() if inbound_in.network is not None else db_inbound.network
    final_grpc_name = inbound_in.grpc_service_name if inbound_in.grpc_service_name is not None else db_inbound.grpc_service_name

    # Validation: gRPC needs service name
    if final_network == "grpc" and not final_grpc_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="gRPC network protokolü için Service Name alanı zorunludur."
        )

    # Update fields
    if inbound_in.remark is not None:
        db_inbound.remark = inbound_in.remark
    if inbound_in.protocol is not None:
        db_inbound.protocol = inbound_in.protocol.lower()
    if inbound_in.settings is not None:
        db_inbound.settings = inbound_in.settings
    if inbound_in.stream_settings is not None:
        db_inbound.stream_settings = inbound_in.stream_settings
    if inbound_in.enable is not None:
        db_inbound.enable = inbound_in.enable
    if inbound_in.network is not None:
        db_inbound.network = inbound_in.network.lower()
    if inbound_in.security is not None:
        db_inbound.security = inbound_in.security.lower()
    if inbound_in.sni is not None:
        db_inbound.sni = inbound_in.sni
    if inbound_in.ws_path is not None:
        db_inbound.ws_path = inbound_in.ws_path if inbound_in.ws_path else "/"
    if inbound_in.ws_host is not None:
        db_inbound.ws_host = inbound_in.ws_host
    if inbound_in.sniffing_enabled is not None:
        db_inbound.sniffing_enabled = inbound_in.sniffing_enabled
    if inbound_in.grpc_service_name is not None:
        db_inbound.grpc_service_name = inbound_in.grpc_service_name

    try:
        db.flush()
        config_str = generate_config(db)
        apply_config(config_str)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Xray yapılandırması güncellenemedi. Hata: {str(e)}"
        )

    return db_inbound

@router.delete("/{id}")
def delete_inbound(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    db_inbound = db.query(models.Inbound).filter(models.Inbound.id == id).first()
    if not db_inbound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inbound bulunamadı."
        )

    db.delete(db_inbound)

    try:
        db.flush()
        config_str = generate_config(db)
        apply_config(config_str)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Inbound silinirken Xray yapılandırması güncellenemedi. Hata: {str(e)}"
        )

    return {"status": "ok", "message": f"Inbound {id} ve ilişkili tüm kullanıcılar başarıyla silindi."}

@router.patch("/{id}/toggle", response_model=InboundResponse)
def toggle_inbound(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    db_inbound = db.query(models.Inbound).filter(models.Inbound.id == id).first()
    if not db_inbound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inbound bulunamadı."
        )

    db_inbound.enable = not db_inbound.enable

    try:
        db.flush()
        config_str = generate_config(db)
        apply_config(config_str)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Inbound durumu değiştirilirken Xray yapılandırması uygulanamadı. Hata: {str(e)}"
        )

    return db_inbound
