import os
import sys
import secrets
from dotenv import load_dotenv
from sqlalchemy.orm import Session

# Add current directory to path to import database and models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, SessionLocal, Base
import models
from auth import get_password_hash

def seed_db():
    ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(ENV_FILE):
        load_dotenv(ENV_FILE)
    
    admin_username = os.getenv("ADMIN_USERNAME")
    admin_password = os.getenv("ADMIN_PASSWORD")
    
    # Generate default credentials if not present in env
    updated_env = False
    if not admin_username:
        admin_username = "admin"
        with open(ENV_FILE, "a") as f:
            f.write(f"\nADMIN_USERNAME={admin_username}\n")
        updated_env = True
        
    if not admin_password:
        admin_password = secrets.token_urlsafe(12)
        with open(ENV_FILE, "a") as f:
            f.write(f"\nADMIN_PASSWORD={admin_password}\n")
        updated_env = True
        
    if updated_env:
        # Reload dotenv
        load_dotenv(ENV_FILE)
        print(f"--> .env dosyasına varsayılan Admin bilgileri eklendi:")
        print(f"    Kullanıcı Adı: {admin_username}")
        print(f"    Şifre: {admin_password}")
        
    # Ensure all tables are created
    Base.metadata.create_all(bind=engine)
    print("--> Veritabanı tabloları kontrol edildi/oluşturuldu.")
    
    db: Session = SessionLocal()
    try:
        # Check if admin user already exists
        exists = db.query(models.AdminUser).filter(models.AdminUser.username == admin_username).first()
        if not exists:
            hashed_password = get_password_hash(admin_password)
            admin = models.AdminUser(username=admin_username, password_hash=hashed_password)
            db.add(admin)
            db.commit()
            print(f"--> Admin kullanıcısı başarıyla oluşturuldu: {admin_username}")
        else:
            print(f"--> Admin kullanıcısı zaten mevcut: {admin_username}")
            
        # Seed default system settings
        default_settings = {
            "session_timeout": "1440",
            "telegram_bot_token": "",
            "telegram_chat_id": "",
            "telegram_notify_critical": "true",
            "telegram_notify_expiry": "true",
            "sub_link_prefix": ""
        }
        for k, v in default_settings.items():
            setting_exists = db.query(models.SystemSetting).filter(models.SystemSetting.key == k).first()
            if not setting_exists:
                db.add(models.SystemSetting(key=k, value=v))
                print(f"--> Varsayılan ayar oluşturuldu: {k} = '{v}'")
        db.commit()

        # Seed local node
        local_node_exists = db.query(models.Node).filter(models.Node.id == 1).first()
        if not local_node_exists:
            local_node = models.Node(id=1, name="Local", host="localhost", port=22, username="root", is_active=True)
            db.add(local_node)
            db.commit()
            print("--> Varsayılan Yerel Düğüm (Local Node) oluşturuldu.")
    except Exception as e:
        print(f"HATA: Seed işlemi sırasında bir sorun oluştu: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
