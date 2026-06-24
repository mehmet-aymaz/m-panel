from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from pydantic import BaseModel
import os
import json
import subprocess
import urllib.request
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/update", tags=["update"])

STATUS_FILE = "/opt/m-panel/app/data/update_status.json"

class ApplyUpdateRequest(BaseModel):
    version: str

def get_update_status():
    if os.path.exists(STATUS_FILE):
        try:
            with open(STATUS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "in_progress": False,
        "current_step": 0,
        "total_steps": 7,
        "step_label": "",
        "completed": False,
        "error": None
    }

def save_update_status(status_data):
    try:
        os.makedirs(os.path.dirname(STATUS_FILE), exist_ok=True)
        with open(STATUS_FILE, "w") as f:
            json.dump(status_data, f)
    except Exception:
        pass

def run_update_task(new_version: str):
    status_data = {
        "in_progress": True,
        "current_step": 0,
        "total_steps": 7,
        "step_label": "Güncelleme başlatıldı...",
        "completed": False,
        "error": None
    }
    save_update_status(status_data)

    try:
        # Step 1: Git pull
        status_data["current_step"] = 1
        status_data["step_label"] = "Kod güncelleniyor (git pull)..."
        save_update_status(status_data)
        
        # Git pull from local repo directory
        res = subprocess.run(["git", "pull"], cwd="/opt/m-panel", capture_output=True, text=True)
        if res.returncode != 0:
            raise Exception(f"Git pull başarısız oldu: {res.stderr}")

        # Step 2: Install pip requirements
        status_data["current_step"] = 2
        status_data["step_label"] = "Bağımlılıklar güncelleniyor (pip install)..."
        save_update_status(status_data)
        
        res = subprocess.run(["/opt/m-panel/venv/bin/pip", "install", "-r", "/opt/m-panel/app/requirements.txt", "-q"], capture_output=True, text=True)
        if res.returncode != 0:
            raise Exception(f"Python bağımlılıkları yüklenemedi: {res.stderr}")

        # Step 3: Run migration
        status_data["current_step"] = 3
        status_data["step_label"] = "Veritabanı güncelleniyor (migrate.py)..."
        save_update_status(status_data)
        
        res = subprocess.run(["/opt/m-panel/venv/bin/python", "/opt/m-panel/app/migrate.py"], capture_output=True, text=True)
        if res.returncode != 0:
            raise Exception(f"Veritabanı güncellemesi (migration) başarısız oldu: {res.stderr}")

        # Step 4: Npm install
        status_data["current_step"] = 4
        status_data["step_label"] = "Arayüz paketleri kuruluyor (npm install)..."
        save_update_status(status_data)
        
        res = subprocess.run(["npm", "install", "--silent"], cwd="/opt/m-panel/frontend", capture_output=True, text=True)
        if res.returncode != 0:
            raise Exception(f"NPM bağımlılıkları yüklenemedi: {res.stderr}")

        # Step 5: Npm run build
        status_data["current_step"] = 5
        status_data["step_label"] = "Arayüz derleniyor (npm run build)..."
        save_update_status(status_data)
        
        res = subprocess.run(["npm", "run", "build"], cwd="/opt/m-panel/frontend", capture_output=True, text=True)
        if res.returncode != 0:
            raise Exception(f"Arayüz derleme hatası (build): {res.stderr}")

        # Step 6: Deploy build output
        status_data["current_step"] = 6
        status_data["step_label"] = "Arayüz dosyaları kopyalanıyor..."
        save_update_status(status_data)
        
        # Ensure var directory exists
        os.makedirs("/var/www/m-panel", exist_ok=True)
        # Clear existing build
        subprocess.run("rm -rf /var/www/m-panel/*", shell=True)
        # Copy dist folder
        res = subprocess.run("cp -r /opt/m-panel/frontend/dist/* /var/www/m-panel/", shell=True, capture_output=True, text=True)
        if res.returncode != 0:
            raise Exception(f"Arayüz dosyaları kopyalanamadı: {res.stderr}")

        # Update version in .env file
        env_file = "/opt/m-panel/app/.env"
        env_lines = []
        version_updated = False
        if os.path.exists(env_file):
            with open(env_file, "r") as f:
                for line in f:
                    if line.strip().startswith("PANEL_VERSION="):
                        env_lines.append(f"PANEL_VERSION={new_version}\n")
                        version_updated = True
                    else:
                        env_lines.append(line)
        if not version_updated:
            env_lines.append(f"\nPANEL_VERSION={new_version}\n")
        with open(env_file, "w") as f:
            f.writelines(env_lines)

        # Step 7: Restart API service
        status_data["current_step"] = 7
        status_data["step_label"] = "Servis yeniden başlatılıyor..."
        save_update_status(status_data)
        
        # Trigger restart with systemd in a delayed process
        subprocess.Popen(["sleep 2 && systemctl restart m-panel-api"], shell=True)

    except Exception as e:
        status_data["in_progress"] = False
        status_data["error"] = str(e)
        save_update_status(status_data)


@router.get("/check")
def check_update(current_user: models.AdminUser = Depends(get_current_user)):
    current_version = os.getenv("PANEL_VERSION", "v1.0.0")
    latest_version = "v1.0.0"
    release_url = ""
    update_available = False
    
    try:
        req = urllib.request.Request(
            "https://api.github.com/repos/mehmetaymaz/m-panel/releases/latest",
            headers={"User-Agent": "M-Panel-App"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            latest_version = data.get("tag_name", "v1.0.0")
            release_url = data.get("html_url", "")
            
            # Simple version tag comparison
            if latest_version != current_version:
                update_available = True
    except Exception as e:
        # Silently fail and log in console
        print(f"Güncelleme kontrolü başarısız oldu: {e}")
        
    return {
        "current_version": current_version,
        "latest_version": latest_version,
        "update_available": update_available,
        "release_url": release_url
    }


@router.get("/changelog")
def get_changelog(current_user: models.AdminUser = Depends(get_current_user)):
    latest_version = "v1.0.0"
    release_date = ""
    body = "Değişiklik geçmişi alınamadı."
    
    try:
        req = urllib.request.Request(
            "https://api.github.com/repos/mehmetaymaz/m-panel/releases/latest",
            headers={"User-Agent": "M-Panel-App"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            latest_version = data.get("tag_name", "v1.0.0")
            body = data.get("body", "")
            published_at = data.get("published_at", "")
            if published_at:
                release_date = published_at.split("T")[0]
    except Exception as e:
        print(f"Değişiklik geçmişi alınırken hata oluştu: {e}")
        
    return {
        "version": latest_version,
        "release_date": release_date,
        "body": body
    }


@router.post("/apply")
def apply_update(
    request: ApplyUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: models.AdminUser = Depends(get_current_user)
):
    status_data = get_update_status()
    if status_data.get("in_progress"):
        raise HTTPException(status_code=400, detail="Bir güncelleme işlemi zaten devam ediyor.")
        
    background_tasks.add_task(run_update_task, request.version)
    return {"status": "started", "version": request.version}


@router.get("/status")
def get_status(current_user: models.AdminUser = Depends(get_current_user)):
    status_data = get_update_status()
    
    # If completed or has error, clear the file on the next status check (self-cleaning)
    if status_data.get("completed") or status_data.get("error"):
        if os.path.exists(STATUS_FILE):
            try:
                os.remove(STATUS_FILE)
            except Exception:
                pass
                
    return status_data
