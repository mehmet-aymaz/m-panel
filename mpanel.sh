#!/bin/bash
# =================================================================
# M-Panel CLI Management Tool (mpanel)
# =================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_menu() {
    clear
    echo -e "${BLUE}================================================================${NC}"
    echo -e "${GREEN}       M-Panel Yönetim Paneli / Management Menu${NC}"
    echo -e "${BLUE}================================================================${NC}"
    echo -e "  1. Başlat / Start M-Panel"
    echo -e "  2. Durdur / Stop M-Panel"
    echo -e "  3. Yeniden Başlat / Restart M-Panel"
    echo -e "  4. Durum Kontrolü / Check Status"
    echo -e "  5. Logları Görüntüle / View Backend Logs"
    echo -e "  6. Yönetici Bilgilerini Göster / Show Admin Credentials"
    echo -e "  7. Yönetici Şifresini Değiştir / Change Admin Password"
    echo -e "  8. Paneli Kaldır / Uninstall M-Panel"
    echo -e "  0. Çıkış / Exit"
    echo -e "${BLUE}================================================================${NC}"
    echo -n "Seçiminiz / Enter choice [0-8]: "
}

get_status() {
    local api_status
    local xray_status
    
    api_status=$(systemctl is-active m-panel-api || echo "inactive")
    xray_status=$(systemctl is-active xray || echo "inactive")
    
    echo -e "\n--- M-Panel Servis Durumları / Service Statuses ---"
    if [ "$api_status" = "active" ]; then
        echo -e "  FastAPI Backend : ${GREEN}AKTİF (RUNNING)${NC}"
    else
        echo -e "  FastAPI Backend : ${RED}PASİF (STOPPED)${NC}"
    fi
    
    if [ "$xray_status" = "active" ]; then
        echo -e "  Xray-Core Service: ${GREEN}AKTİF (RUNNING)${NC}"
    else
        echo -e "  Xray-Core Service: ${RED}PASİF (STOPPED)${NC}"
    fi
    echo ""
    read -n 1 -s -r -p "Devam etmek için bir tuşa basın... / Press any key to continue..."
}

show_credentials() {
    ENV_FILE="/opt/m-panel/app/.env"
    echo -e "\n--- Yönetici Bilgileri / Admin Credentials ---"
    if [ -f "$ENV_FILE" ]; then
        local user
        local pass
        local port
        user=$(grep "ADMIN_USERNAME=" "$ENV_FILE" | cut -d'=' -f2)
        pass=$(grep "ADMIN_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2)
        
        # Get port from Nginx m-panel config
        if [ -f "/etc/nginx/sites-available/m-panel" ]; then
            port=$(grep -E 'listen\s+[0-9]+' /etc/nginx/sites-available/m-panel | awk '{print $2}' | tr -d ';')
        fi
        
        local ip
        ip=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
        
        echo -e "  Kullanıcı Adı / Username: ${GREEN}${user}${NC}"
        echo -e "  Şifre / Password         : ${GREEN}${pass}${NC}"
        echo -e "  Panel Adresi / URL       : ${GREEN}http://${ip}:${port:-2053}${NC}"
    else
        echo -e "${RED}.env yapılandırma dosyası bulunamadı!${NC}"
    fi
    echo ""
    read -n 1 -s -r -p "Devam etmek için bir tuşa basın... / Press any key to continue..."
}

change_password() {
    ENV_FILE="/opt/m-panel/app/.env"
    DB_PATH="/opt/m-panel/app/data/panel.db"
    
    echo -e "\n--- Şifre Değiştirme / Change Password ---"
    echo -n "Yeni Şifreyi Girin / Enter new password: "
    read -r new_pass
    
    if [ -z "$new_pass" ]; then
        echo -e "${RED}HATA: Şifre boş olamaz! / ERROR: Password cannot be empty!${NC}"
        sleep 2
        return
    fi
    
    echo -e "${YELLOW}Şifre veritabanında güncelleniyor... / Updating password...${NC}"
    
    # Run inline python to update SQLite DB safely using venv
    /opt/m-panel/venv/bin/python -c "
import sqlite3, bcrypt, os
hashed = bcrypt.hashpw('$new_pass'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
conn = sqlite3.connect('$DB_PATH')
c = conn.cursor()
c.execute(\"UPDATE admin_users SET password_hash = ? WHERE username = 'admin'\", (hashed,))
conn.commit()
conn.close()
"
    
    # Update .env
    sed -i "s|ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$new_pass|" "$ENV_FILE"
    
    echo -e "${GREEN}Şifre başarıyla değiştirildi! / Password changed successfully!${NC}"
    echo ""
    read -n 1 -s -r -p "Devam etmek için bir tuşa basın... / Press any key to continue..."
}

uninstall_panel() {
    echo -e "${RED}================================================================${NC}"
    echo -e "${RED}  ⚠️  DİKKAT: M-Panel tamamen kaldırılacaktır!${NC}"
    echo -e "${RED}  ⚠️  WARNING: M-Panel will be completely uninstalled!${NC}"
    echo -e "${RED}================================================================${NC}"
    echo -n "Kaldırmak istediğinize emin misiniz? [e/H]: "
    read -r choice
    if [[ "$choice" =~ ^[eEyY]$ ]]; then
        if [ -f "/opt/m-panel/install.sh" ]; then
            bash /opt/m-panel/install.sh --uninstall
        else
            echo -e "${RED}install.sh bulunamadı, manuel kaldırılıyor...${NC}"
            systemctl stop m-panel-api xray nginx || true
            systemctl disable m-panel-api xray || true
            rm -f /etc/systemd/system/m-panel-api.service /etc/systemd/system/xray.service
            systemctl daemon-reload
            rm -rf /opt/m-panel /var/www/m-panel
            rm -f /usr/local/bin/xray /etc/nginx/sites-enabled/m-panel
            rm -f /usr/local/bin/mpanel /usr/local/bin/m-panel
            systemctl reload nginx || true
            echo -e "${GREEN}Kaldırıldı! / Uninstalled!${NC}"
        fi
        exit 0
    fi
}

main() {
    while true; do
        show_menu
        read -r choice
        case $choice in
            1)
                echo -e "${YELLOW}Servisler başlatılıyor...${NC}"
                systemctl start m-panel-api xray nginx
                echo -e "${GREEN}Başlatıldı.${NC}"
                sleep 1.5
                ;;
            2)
                echo -e "${YELLOW}Servisler durduruluyor...${NC}"
                systemctl stop m-panel-api xray
                echo -e "${GREEN}Durduruldu.${NC}"
                sleep 1.5
                ;;
            3)
                echo -e "${YELLOW}Servisler yeniden başlatılıyor...${NC}"
                systemctl restart m-panel-api xray nginx
                echo -e "${GREEN}Yeniden başlatıldı.${NC}"
                sleep 1.5
                ;;
            4)
                get_status
                ;;
            5)
                echo -e "\n--- Son 50 Log Kaydı / Last 50 Logs ---"
                journalctl -u m-panel-api -n 50 --no-pager
                echo ""
                read -n 1 -s -r -p "Devam etmek için bir tuşa basın... / Press any key to continue..."
                ;;
            6)
                show_credentials
                ;;
            7)
                change_password
                ;;
            8)
                uninstall_panel
                ;;
            0)
                clear
                exit 0
                ;;
            *)
                echo -e "${RED}Geçersiz seçim! / Invalid choice!${NC}"
                sleep 1.5
                ;;
        esac
    done
}

main
