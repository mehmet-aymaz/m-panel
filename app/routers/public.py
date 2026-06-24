import time
import json
import base64
import urllib.parse
from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter(prefix="", tags=["public"])

def format_bytes(b: int) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if b < 1024:
            if unit in ["GB", "TB"]:
                return f"{b:.2f} {unit}"
            elif unit == "B":
                return f"{int(b)} {unit}"
            else:
                return f"{b:.1f} {unit}"
        b /= 1024
    return f"{b:.2f} PB"

def get_profile_info(client: models.Client) -> dict:
    email = client.email or ""
    expiry_time = client.expiry_time or 0
    now_ms = int(time.time() * 1000)
    
    if expiry_time == 0:
        expiry_status = "unlimited"
        remaining_days = None
    elif expiry_time < now_ms:
        expiry_status = "expired"
        remaining_days = 0
    else:
        expiry_status = "active"
        remaining_days = max(0, (expiry_time - now_ms) // (1000 * 60 * 60 * 24))
        
    used_bytes = (client.up or 0) + (client.down or 0)
    
    return {
        "remark": email,
        "expiryTime": expiry_time,
        "expiryStatus": expiry_status,
        "remainingDays": remaining_days,
        "totalGB": client.total_gb or 0.0,
        "usedBytes": used_bytes,
        "usedFormatted": format_bytes(used_bytes)
    }

def build_vless_link(client: models.Client, inbound: models.Inbound, host: str) -> str:
    port = inbound.port
    inbound_remark = inbound.remark or ""
    client_email = client.email or ""
    
    if inbound_remark and client_email:
        full_remark = f"{inbound_remark}-{client_email}"
    else:
        full_remark = inbound_remark or client_email or "vless"
    remark_encoded = urllib.parse.quote(full_remark)
    
    net_type = inbound.network or "ws"
    security = inbound.security or "none"
    
    # All WebSocket inbounds are proxied via Nginx on port 443 with SSL
    if net_type == "ws":
        security = "tls"
        port = 443
    
    p = {
        "type": net_type,
        "security": security,
        "encryption": "none"
    }
    
    if security in ["tls", "xtls"]:
        if inbound.sni:
            p["sni"] = inbound.sni
        
        # Default fallback values for client TLS handshake
        p["alpn"] = "http/1.1"
        p["fp"] = "chrome"
        
        try:
            custom_stream = json.loads(inbound.stream_settings) if inbound.stream_settings else {}
            tls_s = custom_stream.get("tlsSettings", {})
            if tls_s.get("alpn"):
                p["alpn"] = ",".join(tls_s["alpn"]) if isinstance(tls_s["alpn"], list) else tls_s["alpn"]
            if tls_s.get("fingerprint"):
                p["fp"] = tls_s["fingerprint"]
        except Exception:
            pass
            
    if net_type == "ws":
        p["path"] = inbound.ws_path or "/"
        if inbound.ws_host:
            p["host"] = inbound.ws_host
    elif net_type == "grpc":
        p["serviceName"] = inbound.grpc_service_name or ""
    elif security == "reality":
        try:
            custom_stream = json.loads(inbound.stream_settings) if inbound.stream_settings else {}
            reality = custom_stream.get("realitySettings", {})
            
            p["pbk"] = reality.get("publicKey", "FEd7tNvmNJdVrZIG-e8EUOZn3acrkHWYu9AYWlF7WCE")
            
            s_names = reality.get("serverNames", [])
            if s_names:
                p["sni"] = s_names[0]
            elif inbound.sni:
                p["sni"] = inbound.sni
            else:
                p["sni"] = "google.com"
                
            p["fp"] = reality.get("fingerprint", "chrome")
            
            short_ids = reality.get("shortIds", [])
            if short_ids:
                p["sid"] = short_ids[0]
            else:
                p["sid"] = "0123456789abcdef"
        except Exception:
            p["pbk"] = "FEd7tNvmNJdVrZIG-e8EUOZn3acrkHWYu9AYWlF7WCE"
            p["sni"] = inbound.sni or "google.com"
            p["fp"] = "chrome"
            p["sid"] = "0123456789abcdef"
            
        p["flow"] = client.flow or "xtls-rprx-vision"
        
    query_str = urllib.parse.urlencode(p)
    return f"vless://{client.uuid}@{host}:{port}?{query_str}#{remark_encoded}"

def build_vmess_link(client: models.Client, inbound: models.Inbound, host: str) -> str:
    inbound_remark = inbound.remark or ""
    client_email = client.email or ""
    if inbound_remark and client_email:
        full_remark = f"{inbound_remark}-{client_email}"
    else:
        full_remark = inbound_remark or client_email or "vmess"
        
    port = inbound.port
    net_type = inbound.network or "ws"
    security = inbound.security or "none"
    
    if net_type == "ws":
        security = "tls"
        port = 443
        
    config = {
        "v": "2",
        "ps": full_remark,
        "add": host,
        "port": str(port),
        "id": client.uuid,
        "aid": "0",
        "scy": "auto",
        "net": net_type,
        "type": "none",
        "host": inbound.ws_host or "",
        "path": inbound.ws_path or "/",
        "tls": "tls" if security == "tls" else ""
    }
    
    if security == "tls" and inbound.sni:
        config["sni"] = inbound.sni
        
    config_str = json.dumps(config)
    encoded = base64.b64encode(config_str.encode("utf-8")).decode("utf-8")
    return f"vmess://{encoded}"

def build_trojan_link(client: models.Client, inbound: models.Inbound, host: str) -> str:
    inbound_remark = inbound.remark or ""
    client_email = client.email or ""
    if inbound_remark and client_email:
        full_remark = f"{inbound_remark}-{client_email}"
    else:
        full_remark = inbound_remark or client_email or "trojan"
    remark_encoded = urllib.parse.quote(full_remark)
    
    port = inbound.port
    net_type = inbound.network or "ws"
    security = inbound.security or "none"
    
    if net_type == "ws":
        security = "tls"
        port = 443
        
    p = {
        "type": net_type,
        "security": security
    }
    
    if security == "tls":
        if inbound.sni:
            p["sni"] = inbound.sni
        p["alpn"] = "http/1.1"
        p["fp"] = "chrome"
        
    if net_type == "ws":
        p["path"] = inbound.ws_path or "/"
        if inbound.ws_host:
            p["host"] = inbound.ws_host
    elif net_type == "grpc":
        p["serviceName"] = inbound.grpc_service_name or ""
        
    query_str = urllib.parse.urlencode(p)
    return f"trojan://{client.uuid}@{host}:{port}?{query_str}#{remark_encoded}"

def build_ss_link(client: models.Client, inbound: models.Inbound, host: str) -> str:
    inbound_remark = inbound.remark or ""
    client_email = client.email or ""
    if inbound_remark and client_email:
        full_remark = f"{inbound_remark}-{client_email}"
    else:
        full_remark = inbound_remark or client_email or "shadowsocks"
    remark_encoded = urllib.parse.quote(full_remark)
    
    port = inbound.port
    method = inbound.security or "aes-256-gcm"
    password = client.uuid
    
    userinfo = f"{method}:{password}"
    userinfo_b64 = base64.b64encode(userinfo.encode("utf-8")).decode("utf-8").replace("=", "")
    return f"ss://{userinfo_b64}@{host}:{port}#{remark_encoded}"

def build_client_link(client: models.Client, inbound: models.Inbound, host: str) -> str:
    proto = inbound.protocol.lower()
    if proto == "vless":
        return build_vless_link(client, inbound, host)
    elif proto == "vmess":
        return build_vmess_link(client, inbound, host)
    elif proto == "trojan":
        return build_trojan_link(client, inbound, host)
    elif proto == "shadowsocks":
        return build_ss_link(client, inbound, host)
    return ""

@router.get("/api")
def query_client_profile(
    request: Request,
    uuid: str = Query(..., description="UUID value of the client"),
    db: Session = Depends(get_db)
):
    # Find client by UUID
    client = db.query(models.Client).filter(models.Client.uuid == uuid).first()
    if not client:
        return {"success": False, "message": "Bu UUID degerine ait kullanici bulunamadi."}
        
    # Get the inbound details
    inbound = db.query(models.Inbound).filter(models.Inbound.id == client.inbound_id).first()
    if not inbound:
        return {"success": False, "message": "Kullanicinin bagli oldugu inbound bulunamadi."}
        
    # Dynamically extract host from request header
    host = request.headers.get("host") or "panel.mehmetaymaz.com.tr"
    if ":" in host:
        host = host.split(":")[0]
    
    # Generate links list
    link = build_client_link(client, inbound, host)
    links = [{
        "link": link,
        "network": inbound.network or "ws",
        "port": 443 if (inbound.network or "ws") == "ws" else inbound.port,
        "remark": inbound.remark or "",
    }]
    
    profile = get_profile_info(client)
    
    return {
        "success": True,
        "link": link,
        "links": links,
        "email": client.email,
        "comment": client.comment or "",
        "telegramId": client.tg_id or "",
        "subId": "",
        "expiry": client.expiry_time or 0,
        "totalGB": client.total_gb or 0.0,
        "profile": profile
    }

@router.get("/sub/{uuid}")
def get_subscription(
    uuid: str,
    request: Request,
    db: Session = Depends(get_db)
):
    # Find client by UUID
    client = db.query(models.Client).filter(models.Client.uuid == uuid).first()
    if not client or not client.enable:
        return Response(content="Kullanici bulunamadi veya devre disi.", status_code=404)
        
    from xray_manager import is_client_active
    if not is_client_active(client):
        return Response(content="Kullanici kotasi doldu veya suresi bitti.", status_code=403)
        
    inbound = db.query(models.Inbound).filter(models.Inbound.id == client.inbound_id).first()
    if not inbound or not inbound.enable:
        return Response(content="Bagli olunan inbound devre disi veya bulunamadi.", status_code=404)
        
    # Dynamically extract host from request header
    host = request.headers.get("host") or "panel.mehmetaymaz.com.tr"
    if ":" in host:
        host = host.split(":")[0]
        
    link = build_client_link(client, inbound, host)
    if not link:
        return Response(content="Baglanti linki uretilemedi.", status_code=500)
        
    links_str = link + "\n"
    encoded_sub = base64.b64encode(links_str.encode("utf-8")).decode("utf-8")
    
    return Response(
        content=encoded_sub,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=subscription.txt",
            "Cache-Control": "no-store, no-cache, must-revalidate"
        }
    )

