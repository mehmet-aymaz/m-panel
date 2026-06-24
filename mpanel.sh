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
    echo -e "  7. Yönetici Bilgilerini Güncelle / Update Admin Credentials"
    echo -e "  8. SSL Sertifikası Al (Let's Encrypt) / Get SSL Certificate"
    echo -e "  9. Paneli Kaldır / Uninstall M-Panel"
    echo -e "  0. Çıkış / Exit"
    echo -e "${BLUE}================================================================${NC}"
    echo -n "Seçiminiz / Enter choice [0-9]: "
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

change_credentials() {
    ENV_FILE="/opt/m-panel/app/.env"
    DB_PATH="/opt/m-panel/app/data/panel.db"
    
    echo -e "\n--- Yönetici Bilgilerini Güncelle / Update Admin Credentials ---"
    
    local current_user="admin"
    if [ -f "$ENV_FILE" ]; then
        current_user=$(grep "ADMIN_USERNAME=" "$ENV_FILE" | cut -d'=' -f2)
    fi
    
    echo -n "Yeni Kullanıcı Adı / Enter new username [Varsayılan/Default: $current_user]: "
    read -r new_user
    if [ -z "$new_user" ]; then
        new_user=$current_user
    fi
    
    echo -n "Yeni Şifre / Enter new password (Boş bırakırsanız değişmez / Leave empty to keep current): "
    read -r new_pass
    
    echo -e "${YELLOW}Veritabanı güncelleniyor... / Updating database...${NC}"
    
    # Run inline python to update SQLite DB safely using venv
    /opt/m-panel/venv/bin/python -c "
import sqlite3, bcrypt
conn = sqlite3.connect('$DB_PATH')
c = conn.cursor()
c.execute(\"SELECT id, password_hash FROM admin_users WHERE username = ?\", ('$current_user',))
row = c.fetchone()
if not row:
    c.execute(\"SELECT id, password_hash FROM admin_users LIMIT 1\")
    row = c.fetchone()

if row:
    user_id = row[0]
    old_hash = row[1]
    hashed = old_hash
    if '$new_pass' != '':
        hashed = bcrypt.hashpw('$new_pass'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    c.execute(\"UPDATE admin_users SET username = ?, password_hash = ? WHERE id = ?\", ('$new_user', hashed, user_id))
    conn.commit()
else:
    print('FAILED: User not found')
conn.close()
"
    
    # Update .env
    if [ -f "$ENV_FILE" ]; then
        sed -i "s|ADMIN_USERNAME=.*|ADMIN_USERNAME=$new_user|" "$ENV_FILE"
        if [ -n "$new_pass" ]; then
            sed -i "s|ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$new_pass|" "$ENV_FILE"
        fi
    fi
    
    echo -e "${GREEN}Yönetici bilgileri başarıyla güncellendi! / Admin credentials updated successfully!${NC}"
    echo ""
    read -n 1 -s -r -p "Devam etmek için bir tuşa basın... / Press any key to continue..."
}

setup_ssl() {
    echo -e "\n--- SSL Sertifikası Al / Get SSL Certificate ---"
    echo -n "Domain adını girin / Enter domain name (örn: panel.mehmetaymaz.com.tr): "
    read -r domain
    
    if [ -z "$domain" ]; then
        echo -e "${RED}HATA: Alan adı boş olamaz! / ERROR: Domain name cannot be empty!${NC}"
        sleep 2
        return
    fi
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo -e "${YELLOW}Certbot kuruluyor... / Installing certbot...${NC}"
        apt-get update && apt-get install -y certbot python3-certbot-nginx
    fi
    
    # Read the current port from nginx config
    local port=2053
    if [ -f "/etc/nginx/sites-available/m-panel" ]; then
        port=$(grep -E 'listen\s+[0-9]+' /etc/nginx/sites-available/m-panel | awk '{print $2}' | tr -d ';' | head -n 1)
    fi
    if [ -z "$port" ]; then
        port=2053
    fi
    
    echo -e "${YELLOW}Nginx yapılandırması domain için güncelleniyor... / Updating Nginx config for domain...${NC}"
    
    # Generate temporary server block for port 80 and the domain, keeping port $port untouched
    cat <<EOF > /etc/nginx/sites-available/m-panel
server {
    listen $port;
    server_tokens off;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        root /var/www/m-panel;
        try_files \$uri \$uri/ /index.html;
    }
}

server {
    listen 80;
    server_name $domain;
    server_tokens off;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        root /var/www/m-panel;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

    if ! nginx -t; then
        echo -e "${RED}HATA: Nginx yapılandırma testi başarısız! / ERROR: Nginx configuration test failed!${NC}"
        echo ""
        read -n 1 -s -r -p "Devam etmek için bir tuşa basın... / Press any key to continue..."
        return
    fi
    
    systemctl reload nginx
    
    echo -e "${YELLOW}Certbot SSL sertifikası alınıyor... / Obtaining Certbot SSL certificate...${NC}"
    if certbot --nginx -d "$domain" --non-interactive --agree-tos --register-unsafely-without-email; then
        ufw allow 443/tcp &> /dev/null || true
        ufw reload &> /dev/null || true
        echo -e "${GREEN}SSL sertifikası başarıyla alındı ve Nginx yapılandırıldı! / SSL certificate successfully obtained!${NC}"
        echo -e "${GREEN}Artık https://${domain} adresi ile güvenli şekilde erişebilirsiniz. / You can now access via https://${domain}${NC}"
    else
        echo -e "${RED}HATA: SSL sertifikası alınamadı! DNS A kaydının bu sunucuya yönlendiğinden emin olun.${NC}"
        echo -e "${RED}ERROR: Failed to obtain SSL certificate. Make sure DNS A record points to this server.${NC}"
    fi
    
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
                change_credentials
                ;;
            8)
                setup_ssl
                ;;
            9)
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
