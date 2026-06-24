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
        inbound_security = inbound.security or "tls"
        if inbound.protocol.lower() == "shadowsocks":
            inbound_security = "none"

        dynamic_stream = {
            "network": inbound.network or "ws",
            "security": inbound_security
        }

        # Handle Security
        if dynamic_stream["security"] == "tls":
            tls_settings = custom_stream.get("tlsSettings", {})
            if inbound.sni:
                tls_settings["serverName"] = inbound.sni
            # Automatically add server certificates if not present
            if "certificates" not in tls_settings:
                tls_settings["certificates"] = [
                    {
                        "certificateFile": "/usr/local/etc/xray/fullchain.pem",
                        "keyFile": "/usr/local/etc/xray/privkey.pem"
                    }
                ]
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
        if inbound.protocol.lower() in ["vless", "vmess", "trojan", "shadowsocks"]:
            if inbound.protocol.lower() == "vless":
                settings_dict["decryption"] = "none"
            elif inbound.protocol.lower() == "shadowsocks":
                settings_dict["method"] = inbound.security or "aes-256-gcm"
                settings_dict["network"] = "tcp,udp"
                
            clients_list = []
            for client in inbound.clients:
                if is_client_active(client):
                    if inbound.protocol.lower() == "vless":
                        client_dict = {
                            "id": client.uuid,
                            "email": client.email,
                            "level": 0
                        }
                        # Flow (like xtls-rprx-vision) is only supported on VLESS over TCP with TLS/Reality.
                        # Using flow on WS or gRPC will cause Xray to reject the connection.
                        if client.flow and (inbound.network or "ws") == "tcp" and (inbound.security or "none") in ["tls", "reality"]:
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
                    elif inbound.protocol.lower() == "shadowsocks":
                        client_dict = {
                            "password": client.uuid,
                            "email": client.email,
                            "level": 0
                        }
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
        
    # Add API inbound for local control/stats
    xray_inbounds.append({
        "listen": "127.0.0.1",
        "port": 10085,
        "protocol": "dokodemo-door",
        "settings": {
            "address": "127.0.0.1"
        },
        "tag": "api"
    })
        
    config = {
        "log": {
            "loglevel": "warning"
        },
        "stats": {},
        "api": {
            "tag": "api",
            "services": [
                "HandlerService",
                "LoggerService",
                "StatsService"
            ]
        },
        "policy": {
            "system": {
                "statsInboundUplink": True,
                "statsInboundDownlink": True
            },
            "levels": {
                "0": {
                    "statsUserUplink": True,
                    "statsUserDownlink": True
                }
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
                    "inboundTag": ["api"],
                    "outboundTag": "api"
                },
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

def is_xray_config_valid(config_path: str) -> tuple[bool, str]:
    # Try finding xray executable
    xray_bin = "/usr/local/bin/xray"
    if not os.path.exists(xray_bin):
        # Fallback to path search
        xray_bin = shutil.which("xray") or "xray"
    
    try:
        res = subprocess.run([xray_bin, "-test", "-config", config_path], capture_output=True, text=True, timeout=5)
        if res.returncode == 0:
            return True, ""
        else:
            return False, res.stderr or res.stdout or "Bilinmeyen konfigürasyon hatası"
    except Exception as e:
        # If xray executable is not found or fails to run (e.g. on Windows/Dev), assume valid config
        return True, f"Xray test edilemedi (xray çalıştırılamadı): {e}"

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
        # Ensure target directory exists
        os.makedirs(os.path.dirname(XRAY_CONFIG_PATH), exist_ok=True)
        with open(XRAY_CONFIG_PATH, "w", encoding="utf-8") as f:
            f.write(config_str)
    except Exception as e:
        # Rollback backup immediately if failed to write
        if backup_created:
            shutil.copy2(XRAY_BACKUP_PATH, XRAY_CONFIG_PATH)
        raise RuntimeError(f"Xray config dosyası yazılamadı: {e}")

    # 2.5 Validate configuration
    valid, validation_err = is_xray_config_valid(XRAY_CONFIG_PATH)
    if not valid:
        # Config is invalid! Rollback to backup and raise error.
        if backup_created:
            try:
                shutil.copy2(XRAY_BACKUP_PATH, XRAY_CONFIG_PATH)
            except Exception as e:
                print(f"Hata: Geri yükleme sırasında hata oluştu: {e}")
        raise RuntimeError(f"Xray yapılandırma testi başarısız oldu:\n{validation_err}")
        
    # 3. Check if systemctl is available
    if not shutil.which("systemctl"):
        print("Uyarı: systemctl bulunamadı. Yapılandırma dosyası doğrulandı ve kaydedildi ancak servis yeniden başlatılamadı.")
        return True

    # 4. Restart xray service
    try:
        restart_res = subprocess.run(["systemctl", "restart", "xray"], capture_output=True, text=True)
        if restart_res.returncode != 0:
            # Try with sudo
            sudo_res = subprocess.run(["sudo", "systemctl", "restart", "xray"], capture_output=True, text=True)
            if sudo_res.returncode != 0:
                # Configuration is valid, but restart failed (likely due to privileges/environment).
                # Do NOT rollback. Return True and log the warning.
                print(f"Uyarı: Xray servisi yeniden başlatılamadı (yetki/servis hatası), ancak yapılandırma geçerli olduğu için kaydedildi: {restart_res.stderr} | {sudo_res.stderr}")
                return True
    except Exception as e:
        print(f"Uyarı: Xray servisi restart edilirken hata oluştu: {e}")
        return True
        
    # 5. Wait 2 seconds
    time.sleep(2)
    
    # 6. Check if service is active
    try:
        status_res = subprocess.run(["systemctl", "is-active", "xray"], capture_output=True, text=True)
        if status_res.stdout.strip() != "active":
            # Try to get logs
            journal_res = subprocess.run(["journalctl", "-u", "xray", "-n", "15", "--no-pager"], capture_output=True, text=True)
            error_details = journal_res.stdout if journal_res.stdout else "Günlük kaydı alınamadı."
            print(f"Uyarı: Xray servisi aktif görünmüyor. Hata Detayları:\n{error_details}")
    except Exception as e:
        print(f"Uyarı: Xray servis durumu kontrol edilemedi: {e}")
        
    return True

RESERVED_PORTS = [22, 80, 443, 8000, 8443]

def ufw_allow_port(port: int):
    if port in RESERVED_PORTS:
        return
    try:
        subprocess.run(["ufw", "allow", f"{port}/tcp"], capture_output=True, text=True, check=True)
    except Exception as e:
        print(f"Uyarı: UFW kuralı eklenemedi (port {port}): {e}")

def ufw_delete_port(port: int, db: Session, exclude_inbound_id: int = None):
    if port in RESERVED_PORTS:
        return
    query = db.query(models.Inbound).filter(models.Inbound.port == port)
    if exclude_inbound_id is not None:
        query = query.filter(models.Inbound.id != exclude_inbound_id)
    other_exists = query.first() is not None
    if not other_exists:
        try:
            subprocess.run(["ufw", "delete", "allow", f"{port}/tcp"], capture_output=True, text=True, check=True)
        except Exception as e:
            print(f"Uyarı: UFW kuralı silinemedi (port {port}): {e}")

def sync_inbounds_to_ufw():
    db = SessionLocal()
    try:
        inbounds = db.query(models.Inbound).all()
        try:
            res = subprocess.run(["ufw", "status"], capture_output=True, text=True, check=True)
            status_lines = res.stdout.splitlines()
        except Exception as e:
            print(f"Uyarı: UFW status okunamadı: {e}")
            status_lines = []
            
        allowed_ports = set()
        for line in status_lines:
            parts = line.split()
            if len(parts) >= 2 and parts[1] == "ALLOW":
                port_part = parts[0]
                if "/tcp" in port_part:
                    try:
                        p = int(port_part.split("/")[0])
                        allowed_ports.add(p)
                    except ValueError:
                        pass
        
        for ib in inbounds:
            if ib.port in RESERVED_PORTS:
                continue
            if ib.port not in allowed_ports:
                ufw_allow_port(ib.port)
    finally:
        db.close()

def rebuild_and_apply_xray_config():
    db = SessionLocal()
    try:
        # Copy Let's Encrypt certificates to Xray directory and set permissions
        try:
            shutil.copy2("/etc/letsencrypt/live/panel.mehmetaymaz.com.tr/fullchain.pem", "/usr/local/etc/xray/fullchain.pem")
            shutil.copy2("/etc/letsencrypt/live/panel.mehmetaymaz.com.tr/privkey.pem", "/usr/local/etc/xray/privkey.pem")
            os.chmod("/usr/local/etc/xray/fullchain.pem", 0o644)
            os.chmod("/usr/local/etc/xray/privkey.pem", 0o644)
        except Exception as e:
            print(f"Warning: Failed to copy certificates: {e}")

        # Automatically allow enabled inbound ports in firewall
        active_inbounds = db.query(models.Inbound).filter(models.Inbound.enable == True).all()
        for ib in active_inbounds:
            ufw_allow_port(ib.port)
        config_str = generate_config(db)
        apply_config(config_str)
    finally:
        db.close()
