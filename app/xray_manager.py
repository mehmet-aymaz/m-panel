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
            
        # Parse stream_settings column
        try:
            custom_stream = json.loads(inbound.stream_settings) if inbound.stream_settings else {}
        except Exception:
            custom_stream = {}

        # Build dynamic streamSettings
        dynamic_stream = {
            "network": inbound.network or "ws",
            "security": inbound.security or "tls"
        }

        # Handle Security
        if dynamic_stream["security"] == "tls":
            tls_settings = custom_stream.get("tlsSettings", {})
            if inbound.sni:
                tls_settings["serverName"] = inbound.sni
            dynamic_stream["tlsSettings"] = tls_settings
        elif dynamic_stream["security"] == "reality":
            reality_settings = custom_stream.get("realitySettings", {})
            # Ensure required reality fields exist, otherwise provide default placeholders
            if "dest" not in reality_settings:
                reality_settings["dest"] = f"{inbound.sni}:443" if inbound.sni else "google.com:443"
            if "privateKey" not in reality_settings:
                reality_settings["privateKey"] = "cEXIYJ0dmzZ34LC9yAbIn4doJ3CcjrH86IMFWzEqSXM"
            if "shortIds" not in reality_settings:
                reality_settings["shortIds"] = ["0123456789abcdef"]
            
            # For server-side Reality, serverNames (array of strings) is required.
            if "serverNames" not in reality_settings:
                reality_settings["serverNames"] = [inbound.sni] if inbound.sni else ["google.com"]
            elif inbound.sni and inbound.sni not in reality_settings["serverNames"]:
                reality_settings["serverNames"].append(inbound.sni)
                
            dynamic_stream["realitySettings"] = reality_settings
        elif dynamic_stream["security"] == "none":
            dynamic_stream.pop("tlsSettings", None)
            dynamic_stream.pop("realitySettings", None)

        # Handle Network
        if dynamic_stream["network"] == "ws":
            ws_settings = custom_stream.get("wsSettings", {})
            ws_settings["path"] = inbound.ws_path or "/"
            if inbound.ws_host:
                ws_settings["headers"] = ws_settings.get("headers", {})
                ws_settings["headers"]["Host"] = inbound.ws_host
            dynamic_stream["wsSettings"] = ws_settings
        elif dynamic_stream["network"] == "grpc":
            grpc_settings = custom_stream.get("grpcSettings", {})
            grpc_settings["serviceName"] = inbound.grpc_service_name or ""
            dynamic_stream["grpcSettings"] = grpc_settings
        elif dynamic_stream["network"] == "tcp":
            tcp_settings = custom_stream.get("tcpSettings", {})
            dynamic_stream["tcpSettings"] = tcp_settings

        # Merge other custom stream settings
        for k, v in custom_stream.items():
            if k not in dynamic_stream:
                dynamic_stream[k] = v

        # Bind active clients
        if inbound.protocol.lower() in ["vless", "vmess", "trojan"]:
            if inbound.protocol.lower() == "vless":
                settings_dict["decryption"] = "none"
            clients_list = []
            for client in inbound.clients:
                if is_client_active(client):
                    if inbound.protocol.lower() == "vless":
                        client_dict = {
                            "id": client.uuid,
                            "email": client.email,
                            "level": 0
                        }
                        if client.flow:
                            client_dict["flow"] = client.flow
                        if client.limit_ip and client.limit_ip > 0:
                            client_dict["limitIp"] = client.limit_ip
                        clients_list.append(client_dict)
                    elif inbound.protocol.lower() == "vmess":
                        client_dict = {
                            "id": client.uuid,
                            "email": client.email,
                            "level": 0,
                            "alterId": 0
                        }
                        if client.limit_ip and client.limit_ip > 0:
                            client_dict["limitIp"] = client.limit_ip
                        clients_list.append(client_dict)
                    elif inbound.protocol.lower() == "trojan":
                        client_dict = {
                            "password": client.uuid,
                            "email": client.email,
                            "level": 0
                        }
                        if client.limit_ip and client.limit_ip > 0:
                            client_dict["limitIp"] = client.limit_ip
                        clients_list.append(client_dict)
            settings_dict["clients"] = clients_list
            
        xray_inbound = {
            "port": inbound.port,
            "protocol": inbound.protocol.lower(),
            "settings": settings_dict,
            "streamSettings": dynamic_stream,
            "sniffing": {
                "enabled": bool(inbound.sniffing_enabled),
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
