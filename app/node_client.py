"""
node_client.py — 3x-ui REST API İstemcisi

M-Panel'in uzak 3x-ui panellerine REST API üzerinden bağlanmasını sağlar.
Hem cookie/login tabanlı standart akışı hem de API Token (Bearer Auth) tabanlı
yeni nesil bağlantı yöntemlerini destekler.
"""

import time
import requests
import re
import json
from requests import Session
from node_manager import decrypt_password


class XUIClient:
    """
    3x-ui panel REST API istemcisi.

    Kullanım:
        # Şifre ile (Cookie Auth):
        client = XUIClient(url="https://host:2053/admin", username="admin", password="password")
        
        # API Token ile (Bearer Auth):
        client = XUIClient(url="https://host:2053/admin", username="API", password="API_TOKEN_HERE")
    """

    def __init__(self, url: str, username: str, password: str):
        self.base_url = url.rstrip('/')
        self.username = username
        self.password = password
        self.session: Session = requests.Session()
        self._logged_in = False
        
        # Şifre uzunluğu 30 karakterden büyükse bunu API Token/Key kabul et
        self.is_token_auth = password is not None and len(password) > 30

    def _get_api_url(self, endpoint: str) -> str:
        """
        Kimlik doğrulama yöntemine göre endpoint URL'ini dinamik eşler.
        """
        if self.is_token_auth:
            # API Token auth ise prefix: /panel/api/
            # server/status -> /panel/api/server/status
            # inbounds/list -> /panel/api/inbounds/list
            return f"{self.base_url}/panel/api/{endpoint}"
        else:
            # Standart cookie auth
            # server/status -> /server/status
            # inbounds/list -> /xui/API/inbounds/list
            if endpoint == "server/status":
                return f"{self.base_url}/server/status"
            else:
                return f"{self.base_url}/xui/API/{endpoint}"

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    def login(self) -> bool:
        """
        Oturum açar. 
        API Token ise login POST atmadan header'ları enjekte eder.
        Şifre ise CSRF token çekip form-data login POST atar.
        """
        if self.is_token_auth:
            self.session.headers["Authorization"] = f"Bearer {self.password}"
            self.session.headers["x-api-key"] = self.password
            self.session.headers["token"] = self.password
            self.session.headers["access-token"] = self.password
            self.session.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            self.session.headers["Accept"] = "application/json"
            self._logged_in = True
            return True

        try:
            # 1. CSRF token çekmek için önce ana sayfayı ziyaret et
            root_resp = self.session.get(
                f"{self.base_url}/",
                timeout=10,
                verify=False
            )
            
            # HTML'den csrf-token meta etiketini ara
            csrf_token = None
            match = re.search(r'name="csrf-token"\s+content="([^"]+)"', root_resp.text)
            if not match:
                match = re.search(r'content="([^"]+)"\s+name="csrf-token"', root_resp.text)
            
            if match:
                csrf_token = match.group(1)
                self.session.headers["X-Csrf-Token"] = csrf_token
            
            # User-Agent ve headers ekle
            self.session.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            self.session.headers["Accept"] = "application/json, text/plain, */*"

            # 2. Login POST isteğini form-data (urlencoded) olarak at
            resp = self.session.post(
                f"{self.base_url}/login",
                data={"username": self.username, "password": self.password},
                timeout=10,
                verify=False,
            )
            
            # Yanıt JSON mu kontrol et
            try:
                data = resp.json()
                self._logged_in = data.get("success", False)
            except Exception:
                self._logged_in = resp.status_code == 200 and "3x-ui" in self.session.cookies
                
            return self._logged_in
        except Exception:
            self._logged_in = False
            return False

    def _ensure_logged_in(self):
        """Oturum yoksa otomatik login dener."""
        if not self._logged_in:
            if not self.login():
                raise RuntimeError("3x-ui paneline giriş yapılamadı. Kimlik bilgilerini veya API Token'ı kontrol edin.")

    # ------------------------------------------------------------------
    # Inbound CRUD
    # ------------------------------------------------------------------

    def get_inbounds(self) -> list:
        """Tüm inbound'ları listele."""
        self._ensure_logged_in()
        resp = self.session.get(
            self._get_api_url("inbounds/list"),
            timeout=15,
            verify=False,
        )
        data = resp.json()
        if data.get("success"):
            inbounds = data.get("obj", [])
            
            # Online kullanıcıları çek ve her inbound'a ekle
            onlines = []
            try:
                online_url = f"{self.base_url}/panel/api/clients/onlines" if self.is_token_auth else f"{self.base_url}/xui/API/inbounds/onlines"
                onlines_resp = self.session.post(online_url, timeout=5, verify=False)
                onlines_data = onlines_resp.json()
                if onlines_data.get("success"):
                    onlines = onlines_data.get("obj", [])
            except Exception:
                pass
                
            for ib in inbounds:
                ib["_onlines"] = onlines
                
            return inbounds
        raise RuntimeError(f"Inbound'lar alınamadı: {data.get('msg', 'Bilinmeyen hata')}")

    def add_inbound(self, inbound_data: dict) -> dict:
        """Yeni inbound ekle."""
        self._ensure_logged_in()
        resp = self.session.post(
            self._get_api_url("inbounds/add"),
            json=inbound_data,
            timeout=15,
            verify=False,
        )
        data = resp.json()
        if data.get("success"):
            return data.get("obj", {})
        raise RuntimeError(f"Inbound eklenemedi: {data.get('msg', 'Bilinmeyen hata')}")

    def update_inbound(self, inbound_id: int, inbound_data: dict) -> dict:
        """Inbound güncelle."""
        self._ensure_logged_in()
        resp = self.session.post(
            self._get_api_url(f"inbounds/update/{inbound_id}"),
            json=inbound_data,
            timeout=15,
            verify=False,
        )
        data = resp.json()
        if data.get("success"):
            return data.get("obj", {})
        raise RuntimeError(f"Inbound güncellenemedi: {data.get('msg', 'Bilinmeyen hata')}")

    def delete_inbound(self, inbound_id: int) -> bool:
        """Inbound sil."""
        self._ensure_logged_in()
        resp = self.session.post(
            self._get_api_url(f"inbounds/del/{inbound_id}"),
            timeout=15,
            verify=False,
        )
        data = resp.json()
        if data.get("success"):
            return True
        raise RuntimeError(f"Inbound silinemedi: {data.get('msg', 'Bilinmeyen hata')}")

    # ------------------------------------------------------------------
    # Client (Kullanıcı) CRUD
    # ------------------------------------------------------------------

    def add_client(self, inbound_id: int, client_data: dict) -> bool:
        """Inbound'a kullanıcı ekle."""
        self._ensure_logged_in()
        if self.is_token_auth:
            # API Token auth (MHSanaei v2.0+) -> doğrudan json listesi ve inboundId
            payload = {
                "inboundId": inbound_id,
                "clients": [client_data],
            }
            resp = self.session.post(
                f"{self.base_url}/panel/api/clients/add",
                json=payload,
                timeout=15,
                verify=False,
            )
        else:
            # Standart cookie auth ise /xui/API/inbounds/addClient
            payload = {
                "id": inbound_id,
                "settings": json.dumps({"clients": [client_data]}),
            }
            resp = self.session.post(
                f"{self.base_url}/xui/API/inbounds/addClient",
                json=payload,
                timeout=15,
                verify=False,
            )
        data = resp.json()
        if data.get("success"):
            return True
        raise RuntimeError(f"Kullanıcı eklenemedi: {data.get('msg', 'Bilinmeyen hata')}")

    def update_client(self, inbound_id: int, email: str, client_data: dict) -> bool:
        """Kullanıcıyı günceller (Limit IP, Süre, Trafik Limiti vb.)."""
        self._ensure_logged_in()
        if self.is_token_auth:
            # Token auth'ta: POST /panel/api/clients/update/{email}
            # Buradaki email, kullanıcının güncellenmeden önceki mevcut email'idir.
            # MHSanaei v2.0+ API'sinde update body'si doğrudan client payload'unun kendisidir.
            resp = self.session.post(
                f"{self.base_url}/panel/api/clients/update/{email}",
                json=client_data,
                timeout=15,
                verify=False,
            )
        else:
            # Cookie auth'ta: POST /xui/API/inbounds/updateClient/{uuid}
            # Cookie auth için UUID'yi client_data'dan veya id alanından alıyoruz
            uuid = client_data.get("id") or client_data.get("password") or ""
            payload = {
                "id": inbound_id,
                "settings": json.dumps({"clients": [client_data]}),
            }
            resp = self.session.post(
                f"{self.base_url}/xui/API/inbounds/updateClient/{uuid}",
                json=payload,
                timeout=15,
                verify=False,
            )
        data = resp.json()
        if data.get("success"):
            return True
        raise RuntimeError(f"Kullanıcı güncellenemedi: {data.get('msg', 'Bilinmeyen hata')}")

    def delete_client(self, inbound_id: int, email: str, uuid: str = "") -> bool:
        """Kullanıcı sil (veya detach et)."""
        self._ensure_logged_in()
        if self.is_token_auth:
            # Token auth'ta doğrudan email ile detach at
            resp = self.session.post(
                f"{self.base_url}/panel/api/clients/{email}/detach",
                json={"inboundId": inbound_id},
                timeout=15,
                verify=False,
            )
        else:
            # Standart cookie auth ise delClient/{uuid}
            # Eğer uuid boşsa, email ile eşleşen uuid'yi bulabiliriz
            if not uuid:
                uuid = email
            resp = self.session.post(
                f"{self.base_url}/xui/API/inbounds/{inbound_id}/delClient/{uuid}",
                timeout=15,
                verify=False,
            )
        data = resp.json()
        if data.get("success"):
            return True
        raise RuntimeError(f"Kullanıcı silinemedi: {data.get('msg', 'Bilinmeyen hata')}")

    def reset_client_traffic(self, email: str) -> bool:
        """Trafik sıfırla."""
        self._ensure_logged_in()
        url = f"{self.base_url}/panel/api/clients/resetTraffic/{email}" if self.is_token_auth else f"{self.base_url}/xui/API/inbounds/resetClientTraffic/{email}"
        resp = self.session.post(
            url,
            timeout=15,
            verify=False,
        )
        data = resp.json()
        if data.get("success"):
            return True
        raise RuntimeError(f"Trafik sıfırlanamadı: {data.get('msg', 'Bilinmeyen hata')}")

    def get_client_traffics(self, email: str) -> dict:
        """Kullanıcı trafik bilgisi."""
        self._ensure_logged_in()
        url = f"{self.base_url}/panel/api/clients/traffic/{email}" if self.is_token_auth else f"{self.base_url}/xui/API/inbounds/clientTraffics/{email}"
        # MHSanaei API Token için traffic/ GET formatındadır
        if self.is_token_auth:
            resp = self.session.get(url, timeout=15, verify=False)
        else:
            resp = self.session.post(url, timeout=15, verify=False)
        data = resp.json()
        if data.get("success"):
            return data.get("obj", {})
        raise RuntimeError(f"Trafik bilgisi alınamadı: {data.get('msg', 'Bilinmeyen hata')}")

    # ------------------------------------------------------------------
    # Server Status
    # ------------------------------------------------------------------

    def get_server_status(self) -> dict:
        """Sunucu CPU/RAM/disk durumunu çeker."""
        self._ensure_logged_in()
        resp = self.session.get(
            self._get_api_url("server/status"),
            timeout=10,
            verify=False,
        )
        data = resp.json()
        if data.get("success"):
            return self._normalize_status(data.get("obj", {}))
        if "obj" in data:
            return self._normalize_status(data["obj"])
        raise RuntimeError(f"Sunucu durumu alınamadı: {data.get('msg', 'Bilinmeyen hata')}")

    @staticmethod
    def _normalize_status(obj: dict) -> dict:
        """M-Panel formatına normalize eder."""
        mem = obj.get("mem", {})
        disk = obj.get("disk", {})
        net = obj.get("net", {})

        mem_total = mem.get("total", 0)
        mem_current = mem.get("current", 0)
        mem_pct = round((mem_current / mem_total * 100), 1) if mem_total > 0 else 0

        disk_total = disk.get("total", 0)
        disk_current = disk.get("current", 0)
        disk_pct = round((disk_current / disk_total * 100), 1) if disk_total > 0 else 0

        return {
            "cpu_usage": obj.get("cpu", 0),
            "cpu_cores": obj.get("cpuCores", 1),
            "memory": {
                "percent": mem_pct,
                "total_bytes": mem_total,
                "used_bytes": mem_current,
                "total": mem_total,
                "used": mem_current,
            },
            "disk": {
                "percent": disk_pct,
                "total_bytes": disk_total,
                "used_bytes": disk_current,
                "total": disk_total,
                "used": disk_current,
            },
            "net_io": {
                "bytes_sent": net.get("up", 0),
                "bytes_recv": net.get("down", 0),
            },
            "uptime": obj.get("uptime", 0),
            "xray_running": obj.get("xray", {}).get("state", "") == "running" if isinstance(obj.get("xray"), dict) else False,
            "xray_version": obj.get("xray", {}).get("version", "") if isinstance(obj.get("xray"), dict) else "",
            "_raw": obj,
        }

    # ------------------------------------------------------------------
    # Connection Test
    # ------------------------------------------------------------------

    def test_connection(self) -> dict:
        """Giriş ve durum sorgusu ile gecikme ölçer."""
        t0 = time.time()
        try:
            if not self.login():
                return {
                    "success": False,
                    "error": "Giriş başarısız. Kimlik bilgilerini veya API Token'ı kontrol edin.",
                    "latency_ms": int((time.time() - t0) * 1000),
                }
            status = self.get_server_status()
            latency_ms = int((time.time() - t0) * 1000)
            return {
                "success": True,
                "latency_ms": latency_ms,
                "version": status.get("xray_version", ""),
                "xray_running": status.get("xray_running", False),
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "latency_ms": int((time.time() - t0) * 1000),
            }


# ------------------------------------------------------------------
# Yardımcı fonksiyon: node modelinden XUIClient oluştur
# ------------------------------------------------------------------

def get_xui_client(node) -> XUIClient:
    """SQLAlchemy Node modelinden XUIClient oluşturur."""
    raw_password = decrypt_password(node.xui_password) if node.xui_password else ""
    return XUIClient(
        url=node.url or "",
        username=node.xui_username or "",
        password=raw_password,
    )

