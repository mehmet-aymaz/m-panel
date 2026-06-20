import time
import json
import urllib.parse
from fastapi import APIRouter, Depends, Query
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
    
    p = {
        "type": net_type,
        "security": security,
        "encryption": "none"
    }
    
    if security in ["tls", "xtls"]:
        if inbound.sni:
            p["sni"] = inbound.sni
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

@router.get("/api")
def query_client_profile(uuid: str = Query(..., description="UUID value of the client"), db: Session = Depends(get_db)):
    # Find client by UUID
    client = db.query(models.Client).filter(models.Client.uuid == uuid).first()
    if not client:
        return {"success": False, "message": "Bu UUID degerine ait kullanici bulunamadi."}
        
    # Get the inbound details
    inbound = db.query(models.Inbound).filter(models.Inbound.id == client.inbound_id).first()
    if not inbound:
        return {"success": False, "message": "Kullanicinin bagli oldugu inbound bulunamadi."}
        
    host = "wmehmet.web.tr"
    
    # Generate links list
    link = build_vless_link(client, inbound, host)
    links = [{
        "link": link,
        "network": inbound.network or "ws",
        "port": inbound.port,
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
