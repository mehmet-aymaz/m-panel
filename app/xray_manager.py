import os
import json
import time
import shutil
import subprocess
from sqlalchemy.orm import Session
from database import SessionLocal
import models

XRAY_CONFIG_PATH = "/usr/local/etc/xray/config.json"
XRAY_BACKUP_PATH = "/usr/local/etc/xray/config.json.backup"

def is_client_active(client) -> bool:
    if not client.enable:
        return False
        
    # Check expiry time (if set, i.e., > 0)
    now_seconds = time.time()
    if client.expiry_time > 0:
        expiry = client.expiry_time
        # Convert milliseconds to seconds if necessary
        if expiry > 10**11:
            expiry = expiry / 1000.0
        if now_seconds > expiry:
            return False
            
    # Check bandwidth limit (if total_gb > 0)
    if client.total_gb > 0:
        limit_bytes = client.total_gb * 1024 * 1024 * 1024
        used_bytes = client.up + client.down
        if used_bytes >= limit_bytes:
            return False
            
    return True

def generate_config(db: Session) -> str:
    # Query all active/enabled inbounds
    inbounds = db.query(models.Inbound).filter(models.Inbound.enable == True).all()
    
    xray_inbounds = []
    for inbound in inbounds:
        try:
            settings_dict = json.loads(inbound.settings) if inbound.settings else {}
        except Exception:
            settings_dict = {}
            
        try:
            stream_settings_dict = json.loads(inbound.stream_settings) if inbound.stream_settings else {}
        except Exception:
            stream_settings_dict = {}
            
        # Bind active clients
        if inbound.protocol.lower() in ["vless", "vmess", "trojan"]:
            clients_list = []
            for client in inbound.clients:
                if is_client_active(client):
                    if inbound.protocol.lower() == "vless":
                        clients_list.append({
                            "id": client.uuid,
                            "email": client.email,
                            "level": 0
                        })
                    elif inbound.protocol.lower() == "vmess":
                        clients_list.append({
                            "id": client.uuid,
                            "email": client.email,
                            "level": 0,
                            "alterId": 0
                        })
                    elif inbound.protocol.lower() == "trojan":
                        clients_list.append({
                            "password": client.uuid,
                            "email": client.email,
                            "level": 0
                        })
            settings_dict["clients"] = clients_list
            
        xray_inbound = {
            "port": inbound.port,
            "protocol": inbound.protocol.lower(),
            "settings": settings_dict,
            "streamSettings": stream_settings_dict,
            "sniffing": {
                "enabled": True,
                "destOverride": ["http", "tls"]
            }
        }
        
        # Use remark as tag if available
        if inbound.remark:
            xray_inbound["tag"] = inbound.remark
            
        xray_inbounds.append(xray_inbound)
        
    config = {
        "log": {
            "loglevel": "warning"
        },
        "stats": {},
        "policy": {
            "system": {
                "statsInboundUplink": True,
                "statsInboundDownlink": True
            }
        },
        "inbounds": xray_inbounds,
        "outbounds": [
            {
                "protocol": "freedom",
                "settings": {}
            },
            {
                "protocol": "blackhole",
                "settings": {},
                "tag": "blocked"
            }
        ],
        "routing": {
            "domainStrategy": "IPIfNonMatch",
            "rules": [
                {
                    "type": "field",
                    "ip": ["geoip:private"],
                    "outboundTag": "blocked"
                },
                {
                    "type": "field",
                    "protocol": ["bittorrent"],
                    "outboundTag": "blocked"
                }
            ]
        }
    }
    
    return json.dumps(config, indent=2)

def apply_config(config_str: str) -> bool:
    # 1. Backup existing config
    backup_created = False
    if os.path.exists(XRAY_CONFIG_PATH):
        try:
            shutil.copy2(XRAY_CONFIG_PATH, XRAY_BACKUP_PATH)
            backup_created = True
        except Exception as e:
            print(f"Uyarı: Xray yedek dosyası oluşturulamadı: {e}")
            
    # 2. Write new config
    try:
        # Ensure target directory exists (should exist)
        os.makedirs(os.path.dirname(XRAY_CONFIG_PATH), exist_ok=True)
        with open(XRAY_CONFIG_PATH, "w", encoding="utf-8") as f:
            f.write(config_str)
    except Exception as e:
        # Rollback backup immediately if failed to write
        if backup_created:
            shutil.copy2(XRAY_BACKUP_PATH, XRAY_CONFIG_PATH)
        raise RuntimeError(f"Xray config dosyası yazılamadı: {e}")
        
    # 3. Restart xray service
    restart_res = subprocess.run(["systemctl", "restart", "xray"], capture_output=True, text=True)
    if restart_res.returncode != 0:
        rollback_and_raise(backup_created, f"xray servisi restart edilemedi: {restart_res.stderr}")
        
    # 4. Wait 2 seconds
    time.sleep(2)
    
    # 5. Check if service is active
    status_res = subprocess.run(["systemctl", "is-active", "xray"], capture_output=True, text=True)
    if status_res.stdout.strip() != "active":
        # Get last 15 lines of journal log
        journal_res = subprocess.run(["journalctl", "-u", "xray", "-n", "15", "--no-pager"], capture_output=True, text=True)
        error_details = journal_res.stdout if journal_res.stdout else "Günlük kaydı alınamadı."
        rollback_and_raise(backup_created, f"xray servisi aktifleşemedi. Hata Detayları:\n{error_details}")
        
    return True

def rollback_and_raise(backup_created: bool, error_msg: str):
    if backup_created and os.path.exists(XRAY_BACKUP_PATH):
        try:
            shutil.copy2(XRAY_BACKUP_PATH, XRAY_CONFIG_PATH)
            subprocess.run(["systemctl", "restart", "xray"])
        except Exception as e:
            print(f"Kritik Hata: Geri yükleme sırasında hata oluştu: {e}")
    raise RuntimeError(error_msg)

def rebuild_and_apply_xray_config():
    db = SessionLocal()
    try:
        config_str = generate_config(db)
        apply_config(config_str)
    finally:
        db.close()
