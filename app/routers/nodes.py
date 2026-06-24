from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json
from database import get_db
from auth import get_current_user
import models
import node_manager
from xray_manager import generate_config

router = APIRouter(prefix="/nodes", tags=["nodes"])

class NodeBase(BaseModel):
    name: str
    host: str
    port: Optional[int] = 22
    username: Optional[str] = "root"
    xray_config_path: Optional[str] = "/usr/local/etc/xray/config.json"
    panel_port: Optional[int] = None
    is_active: Optional[bool] = True

class NodeCreate(NodeBase):
    password: Optional[str] = None
    ssh_key: Optional[str] = None

class NodeUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    xray_config_path: Optional[str] = None
    panel_port: Optional[int] = None
    is_active: Optional[bool] = None

class NodeResponse(NodeBase):
    id: int
    created_at: datetime
    last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[NodeResponse])
def list_nodes(db: Session = Depends(get_db), current_user: models.AdminUser = Depends(get_current_user)):
    return db.query(models.Node).all()

@router.post("/", response_model=NodeResponse)
def create_node(node_in: NodeCreate, db: Session = Depends(get_db), current_user: models.AdminUser = Depends(get_current_user)):
    db_node = models.Node(
        name=node_in.name,
        host=node_in.host,
        port=node_in.port,
        username=node_in.username,
        xray_config_path=node_in.xray_config_path,
        panel_port=node_in.panel_port,
        is_active=node_in.is_active if node_in.is_active is not None else True,
        password=node_manager.encrypt_password(node_in.password) if node_in.password else None,
        ssh_key=node_manager.encrypt_password(node_in.ssh_key) if node_in.ssh_key else None
    )
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node

@router.get("/{id}", response_model=NodeResponse)
def get_node(id: int, db: Session = Depends(get_db), current_user: models.AdminUser = Depends(get_current_user)):
    node = db.query(models.Node).filter(models.Node.id == id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Düğüm bulunamadı.")
    return node

@router.put("/{id}", response_model=NodeResponse)
def update_node(id: int, node_in: NodeUpdate, db: Session = Depends(get_db), current_user: models.AdminUser = Depends(get_current_user)):
    node = db.query(models.Node).filter(models.Node.id == id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Düğüm bulunamadı.")
    
    if node_in.name is not None:
        node.name = node_in.name
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
        node.password = node_manager.encrypt_password(node_in.password) if node_in.password else None
    if node_in.ssh_key is not None:
        node.ssh_key = node_manager.encrypt_password(node_in.ssh_key) if node_in.ssh_key else None
        
    db.commit()
    db.refresh(node)
    return node

@router.delete("/{id}")
def delete_node(id: int, db: Session = Depends(get_db), current_user: models.AdminUser = Depends(get_current_user)):
    if id == 1:
        raise HTTPException(status_code=400, detail="Yerel düğüm (Local Node) silinemez.")
    node = db.query(models.Node).filter(models.Node.id == id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Düğüm bulunamadı.")
    
    # Dissocciate inbounds from the node being deleted
    db.query(models.Inbound).filter(models.Inbound.node_id == id).update({models.Inbound.node_id: None})
    db.delete(node)
    db.commit()
    return {"status": "ok", "message": "Düğüm başarıyla silindi."}

@router.post("/{id}/test")
def test_node_connection(id: int, db: Session = Depends(get_db), current_user: models.AdminUser = Depends(get_current_user)):
    node = db.query(models.Node).filter(models.Node.id == id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Düğüm bulunamadı.")
    
    if id == 1:
        import subprocess
        xray_active = False
        try:
            res = subprocess.run(["systemctl", "is-active", "xray"], capture_output=True, text=True)
            xray_active = res.stdout.strip() == "active"
        except:
            pass
        return {"success": True, "latency_ms": 0, "xray_running": xray_active}
        
    res = node_manager.test_connection(node)
    if res.get("success"):
        node.last_seen = datetime.utcnow()
        db.commit()
    return res

@router.get("/{id}/stats")
def get_node_statistics(id: int, db: Session = Depends(get_db), current_user: models.AdminUser = Depends(get_current_user)):
    node = db.query(models.Node).filter(models.Node.id == id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Düğüm bulunamadı.")
    
    if id == 1:
        from stats_collector import SYSTEM_STATUS_CACHE
        return SYSTEM_STATUS_CACHE
        
    try:
        stats = node_manager.get_node_stats(node)
        node.last_seen = datetime.utcnow()
        db.commit()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Düğüm istatistikleri alınamadı: {str(e)}")

@router.post("/{id}/sync")
def sync_node_config(id: int, db: Session = Depends(get_db), current_user: models.AdminUser = Depends(get_current_user)):
    node = db.query(models.Node).filter(models.Node.id == id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Düğüm bulunamadı.")
    
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
