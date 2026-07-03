"""
routers/nodes.py — Node (Sunucu) Yönetimi Router

SSH ve 3x-ui API node türlerini destekler.
- SSH node'lar: node_manager.py üzerinden SSH bağlantısı
- XUI node'lar: node_client.py üzerinden 3x-ui REST API
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime
import json

from database import get_db
from auth import get_current_user
import models
import node_manager
from node_client import get_xui_client, XUIClient
from xray_manager import generate_config

router = APIRouter(prefix="/nodes", tags=["nodes"])


# ==============================================================================
# Pydantic Şemaları
# ==============================================================================

class NodeBase(BaseModel):
    name: str
    node_type: Optional[str] = "ssh"      # 'ssh' | 'xui_api'

    # SSH alanları
    host: Optional[str] = "localhost"
    port: Optional[int] = 22
    username: Optional[str] = "root"
    xray_config_path: Optional[str] = "/usr/local/etc/xray/config.json"
    panel_port: Optional[int] = None
    is_active: Optional[bool] = True

    # 3x-ui API alanları
    url: Optional[str] = None            # https://host:2053
    xui_username: Optional[str] = None
    xui_password: Optional[str] = None  # plain-text, encrypt edilecek


class NodeCreate(NodeBase):
    # SSH auth
    password: Optional[str] = None       # SSH şifre (plain-text)
    ssh_key: Optional[str] = None        # SSH private key (plain-text)


class NodeTestRequest(BaseModel):
    node_type: str                       # 'ssh' | 'xui_api'
    host: Optional[str] = None
    port: Optional[int] = 22
    username: Optional[str] = None
    password: Optional[str] = None       # Plain SSH password or SSH key
    url: Optional[str] = None
    xui_username: Optional[str] = None
    xui_password: Optional[str] = None   # Plain 3x-ui password


class NodeUpdate(BaseModel):
    name: Optional[str] = None
    node_type: Optional[str] = None

    # SSH
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    xray_config_path: Optional[str] = None
    panel_port: Optional[int] = None
    is_active: Optional[bool] = None

    # 3x-ui
    url: Optional[str] = None
    xui_username: Optional[str] = None
    xui_password: Optional[str] = None


class NodeResponse(BaseModel):
    id: int
    name: str
    node_type: Optional[str] = "ssh"
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    xray_config_path: Optional[str] = None
    panel_port: Optional[int] = None
    url: Optional[str] = None
    xui_username: Optional[str] = None
    # şifre alanları döndürülmez
    is_active: bool
    last_status: Optional[str] = "unknown"
    created_at: Optional[datetime] = None
    last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==============================================================================
# Yardımcı
# ==============================================================================

def _get_node_or_404(db: Session, node_id: int) -> models.Node:
    node = db.query(models.Node).filter(models.Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Düğüm bulunamadı.")
    return node


# ==============================================================================
# CRUD — Node Yönetimi
# ==============================================================================

@router.get("/", response_model=List[NodeResponse])
def list_nodes(
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    return db.query(models.Node).all()


@router.post("/", response_model=NodeResponse)
def create_node(
    node_in: NodeCreate,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    db_node = models.Node(
        name=node_in.name,
        node_type=node_in.node_type or "ssh",

        # SSH alanları
        host=node_in.host or "localhost",
        port=node_in.port or 22,
        username=node_in.username or "root",
        xray_config_path=node_in.xray_config_path or "/usr/local/etc/xray/config.json",
        panel_port=node_in.panel_port,
        is_active=node_in.is_active if node_in.is_active is not None else True,
        password=node_manager.encrypt_password(node_in.password) if node_in.password else None,
        ssh_key=node_manager.encrypt_password(node_in.ssh_key) if node_in.ssh_key else None,

        # 3x-ui alanları
        url=node_in.url,
        xui_username=node_in.xui_username,
        xui_password=node_manager.encrypt_password(node_in.xui_password) if node_in.xui_password else None,
        last_status="unknown",
    )
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node


@router.get("/{id}", response_model=NodeResponse)
def get_node(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    return _get_node_or_404(db, id)


@router.put("/{id}", response_model=NodeResponse)
def update_node(
    id: int,
    node_in: NodeUpdate,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    node = _get_node_or_404(db, id)

    if node_in.name is not None:
        node.name = node_in.name
    if node_in.node_type is not None:
        node.node_type = node_in.node_type

    # SSH alanları
    if node_in.host is not None:
        node.host = node_in.host
    if node_in.port is not None:
        node.port = node_in.port
    if node_in.username is not None:
        node.username = node_in.username
    if node_in.xray_config_path is not None:
        node.xray_config_path = node_in.xray_config_path
    if node_in.panel_port is not None:
        node.panel_port = node_in.panel_port
    if node_in.is_active is not None:
        node.is_active = node_in.is_active
    if node_in.password is not None:
        node.password = node_manager.encrypt_password(node_in.password)
    if node_in.ssh_key is not None:
        node.ssh_key = node_manager.encrypt_password(node_in.ssh_key)

    # 3x-ui alanları
    if node_in.url is not None:
        node.url = node_in.url
    if node_in.xui_username is not None:
        node.xui_username = node_in.xui_username
    if node_in.xui_password is not None:
        node.xui_password = node_manager.encrypt_password(node_in.xui_password)

    db.commit()
    db.refresh(node)
    return node


@router.delete("/{id}")
def delete_node(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    if id == 1:
        raise HTTPException(status_code=400, detail="Yerel düğüm (Local Node) silinemez.")
    node = _get_node_or_404(db, id)
    db.query(models.Inbound).filter(models.Inbound.node_id == id).update({models.Inbound.node_id: None})
    db.delete(node)
    db.commit()
    return {"status": "ok", "message": "Düğüm başarıyla silindi."}


@router.post("/test-connection-direct")
def test_node_connection_direct(
    req: NodeTestRequest,
    current_user: models.AdminUser = Depends(get_current_user)
):
    if req.node_type == "xui_api":
        if not req.url:
            raise HTTPException(status_code=400, detail="Panel URL gereklidir.")
        client = XUIClient(
            url=req.url,
            username=req.xui_username or "",
            password=req.xui_password or "",
        )
        return client.test_connection()
    else:
        # SSH test
        # Gecici node modeli taklit et
        class TempNode:
            def __init__(self, host, port, username, password):
                self.host = host
                self.port = port
                self.username = username
                self.password = node_manager.encrypt_password(password) if password else None
                self.ssh_key = None
        temp_node = TempNode(req.host or "localhost", req.port or 22, req.username or "root", req.password)
        return node_manager.test_connection(temp_node)


# ==============================================================================
# Bağlantı Testi ve Durum
# ==============================================================================

@router.post("/{id}/test")
def test_node_connection(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    node = _get_node_or_404(db, id)

    if id == 1:
        # Lokal node
        import subprocess
        xray_active = False
        try:
            res = subprocess.run(["systemctl", "is-active", "xray"], capture_output=True, text=True)
            xray_active = res.stdout.strip() == "active"
        except Exception:
            pass
        return {"success": True, "latency_ms": 0, "xray_running": xray_active}

    if node.node_type == "xui_api":
        client = get_xui_client(node)
        result = client.test_connection()
        if result.get("success"):
            node.last_seen = datetime.utcnow()
            node.last_status = "online"
        else:
            node.last_status = "error"
        db.commit()
        return result
    else:
        # SSH
        res = node_manager.test_connection(node)
        if res.get("success"):
            node.last_seen = datetime.utcnow()
            node.last_status = "online"
        else:
            node.last_status = "error"
        db.commit()
        return res


@router.get("/{id}/stats")
def get_node_stats(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    node = _get_node_or_404(db, id)

    if id == 1:
        from stats_collector import SYSTEM_STATUS_CACHE
        return SYSTEM_STATUS_CACHE

    if node.node_type == "xui_api":
        try:
            client = get_xui_client(node)
            stats = client.get_server_status()
            node.last_seen = datetime.utcnow()
            node.last_status = "online"
            db.commit()
            return stats
        except Exception as e:
            node.last_status = "offline"
            db.commit()
            raise HTTPException(status_code=500, detail=f"Sunucu durumu alınamadı: {str(e)}")
    else:
        # SSH
        try:
            stats = node_manager.get_node_stats(node)
            node.last_seen = datetime.utcnow()
            node.last_status = "online"
            db.commit()
            return stats
        except Exception as e:
            node.last_status = "offline"
            db.commit()
            raise HTTPException(status_code=500, detail=f"Düğüm istatistikleri alınamadı: {str(e)}")


# ==============================================================================
# SSH node: Config Sync (eski özellik, geriye uyumluluk)
# ==============================================================================

@router.post("/{id}/sync")
def sync_node_config(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    node = _get_node_or_404(db, id)

    if node.node_type == "xui_api":
        raise HTTPException(status_code=400, detail="3x-ui API düğümlerinde config sync desteklenmez. Inbound yönetimini kullanın.")

    config_dict = json.loads(generate_config(db, node_id=id))

    if id == 1:
        from xray_manager import apply_config
        try:
            apply_config(json.dumps(config_dict, indent=2))
            return {"success": True, "message": "Config yerel olarak uygulandı ve Xray yeniden başlatıldı."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Yerel config uygulanamadı: {str(e)}")

    try:
        node_manager.push_xray_config(node, config_dict)
        node.last_seen = datetime.utcnow()
        db.commit()
        return {"success": True, "message": "Config düğüme gönderildi ve Xray yeniden başlatıldı."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Config senkronizasyonu başarısız: {str(e)}")


# ==============================================================================
# 3x-ui: Inbound Yönetimi (proxy endpoint'ler)
# ==============================================================================

def _get_xui_node_or_error(db: Session, node_id: int) -> models.Node:
    """3x-ui API node'u getirir, yoksa veya SSH ise hata fırlatır."""
    node = _get_node_or_404(db, node_id)
    if node.node_type != "xui_api":
        raise HTTPException(
            status_code=400,
            detail="Bu endpoint yalnızca 3x-ui API türündeki düğümler için kullanılabilir."
        )
    return node


@router.get("/{id}/inbounds/")
def list_node_inbounds(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    """3x-ui node'undaki tüm inbound'ları listele."""
    node = _get_xui_node_or_error(db, id)
    try:
        client = get_xui_client(node)
        inbounds = client.get_inbounds()
        node.last_seen = datetime.utcnow()
        node.last_status = "online"
        db.commit()
        return {"success": True, "obj": inbounds}
    except Exception as e:
        node.last_status = "error"
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{id}/inbounds/")
def add_node_inbound(
    id: int,
    inbound_data: dict,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    """3x-ui node'una inbound ekle."""
    node = _get_xui_node_or_error(db, id)
    try:
        client = get_xui_client(node)
        result = client.add_inbound(inbound_data)
        node.last_seen = datetime.utcnow()
        db.commit()
        return {"success": True, "obj": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{id}/inbounds/{iid}")
def update_node_inbound(
    id: int,
    iid: int,
    inbound_data: dict,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    """3x-ui node'undaki inbound'u güncelle."""
    node = _get_xui_node_or_error(db, id)
    try:
        client = get_xui_client(node)
        result = client.update_inbound(iid, inbound_data)
        return {"success": True, "obj": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{id}/inbounds/{iid}")
def delete_node_inbound(
    id: int,
    iid: int,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    """3x-ui node'undan inbound sil."""
    node = _get_xui_node_or_error(db, id)
    try:
        client = get_xui_client(node)
        client.delete_inbound(iid)
        return {"success": True, "message": "Inbound silindi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# 3x-ui: Client (Kullanıcı) Yönetimi
# ==============================================================================

@router.post("/{id}/inbounds/{iid}/clients/")
def add_node_client(
    id: int,
    iid: int,
    client_data: dict,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    """3x-ui node'undaki inbound'a kullanıcı ekle."""
    node = _get_xui_node_or_error(db, id)
    try:
        xui = get_xui_client(node)
        xui.add_client(iid, client_data)
        return {"success": True, "message": "Kullanıcı eklendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{id}/inbounds/{iid}/clients/{email}")
def update_node_client(
    id: int,
    iid: int,
    email: str,
    client_data: dict,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    """3x-ui node'undaki kullanıcıyı güncelle."""
    node = _get_xui_node_or_error(db, id)
    try:
        xui = get_xui_client(node)
        xui.update_client(iid, email, client_data)
        return {"success": True, "message": "Kullanıcı güncellendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.delete("/{id}/inbounds/{iid}/clients/{email}")
def delete_node_client(
    id: int,
    iid: int,
    email: str,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    """3x-ui node'undan kullanıcı sil."""
    node = _get_xui_node_or_error(db, id)
    try:
        xui = get_xui_client(node)
        xui.delete_client(iid, email)
        return {"success": True, "message": "Kullanıcı silindi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{id}/inbounds/{iid}/clients/{email}/reset")
def reset_node_client_traffic(
    id: int,
    iid: int,
    email: str,
    db: Session = Depends(get_db),
    current_user: models.AdminUser = Depends(get_current_user)
):
    """3x-ui node'undaki kullanıcının trafiğini sıfırla."""
    node = _get_xui_node_or_error(db, id)
    try:
        xui = get_xui_client(node)
        xui.reset_client_traffic(email)
        return {"success": True, "message": "Trafik sıfırlandı."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
