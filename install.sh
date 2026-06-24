#!/bin/bash
# =================================================================
# M-Panel Single-Command Installer Script (install.sh)
# Supported OS: Ubuntu 20.04/22.04/24.04, Debian 10/11/12
# =================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global Variables
PANEL_PORT=2053
ADMIN_PASSWORD=""
JWT_SECRET_KEY=""
REPO_URL="https://github.com/mehmet-aymaz/m-panel.git"

# Step logger
print_step() {
    local step_num=$1
    local total_steps=$2
    local tr_msg=$3
    local en_msg=$4
    echo -e "${BLUE}================================================================${NC}"
    echo -e "${YELLOW}[${step_num}/${total_steps}] ${tr_msg}${NC}"
    echo -e "${BLUE}        ${en_msg}${NC}"
    echo -e "${BLUE}================================================================${NC}"
}

# Root and OS Verification
check_root_and_os() {
    # Check if run as root
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}HATA: Bu betik root hakları ile çalıştırılmalıdır! / ERROR: This script must be run as root!${NC}"
        exit 1
    fi

    # Detect OS name and version
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME=$ID
        OS_VERSION=$VERSION_ID
    else
        OS_NAME=$(uname -s)
        OS_VERSION=""
    fi

    echo -e "${GREEN}Sistem: $OS_NAME $OS_VERSION / System: $OS_NAME $OS_VERSION${NC}"

    # Verify compatibility
    SUPPORTED=false
    if [ "$OS_NAME" = "ubuntu" ]; then
        if [[ "$OS_VERSION" =~ ^(20\.04|22\.04|24\.04) ]]; then
            SUPPORTED=true
        fi
    elif [ "$OS_NAME" = "debian" ]; then
        if [[ "$OS_VERSION" =~ ^(10|11|12) ]]; then
            SUPPORTED=true
        fi
    fi

    if [ "$SUPPORTED" = false ]; then
        echo -e "${YELLOW}UYARI: Bu işletim sistemi resmi olarak desteklenmemektedir! Kurulum yine de denenecek.${NC}"
        echo -e "${YELLOW}WARNING: This operating system is not officially supported! Will try to install anyway.${NC}"
        echo ""
    fi
}

# Port prompting and validation
ask_port() {
    local default_port=2053
    local port_ok=false

    while [ "$port_ok" = false ]; do
        echo -e "${YELLOW}Panel portunu girin [Varsayılan: $default_port]: ${NC}"
        echo -e "${YELLOW}Enter panel port [Default: $default_port]: ${NC}"
        read -r input_port
        
        if [ -z "$input_port" ]; then
            PANEL_PORT=$default_port
            port_ok=true
        elif [[ "$input_port" =~ ^[0-9]+$ ]] && [ "$input_port" -ge 1024 ] && [ "$input_port" -le 65535 ]; then
            PANEL_PORT=$input_port
            
            # Check for conflict with common ports
            if [[ "$PANEL_PORT" =~ ^(22|80|443|8000)$ ]]; then
                echo -e "${RED}HATA: Port $PANEL_PORT kritik bir sistem portudur. Lütfen başka bir port seçin.${NC}"
                echo -e "${RED}ERROR: Port $PANEL_PORT is a critical system port. Please choose another port.${NC}"
                echo ""
            else
                port_ok=true
            fi
        else
            echo -e "${RED}HATA: Geçersiz port! 1024 - 65535 arasında bir sayı girin.${NC}"
            echo -e "${RED}ERROR: Invalid port! Enter a number between 1024 and 65535.${NC}"
            echo ""
        fi
    done

    echo -e "${GREEN}Seçilen Port: $PANEL_PORT / Selected Port: $PANEL_PORT${NC}"
    echo ""
}

# Check for existing installations
check_previous_installation() {
    if [ -d "/opt/m-panel" ]; then
        echo -e "${YELLOW}================================================================${NC}"
        echo -e "${YELLOW}UYARI: Mevcut bir M-Panel kurulumu bulundu! (/opt/m-panel)${NC}"
        echo -e "${YELLOW}WARNING: Existing M-Panel installation found! (/opt/m-panel)${NC}"
        echo -e "${YELLOW}================================================================${NC}"
        echo -en "${YELLOW}Kaldırıp yeniden kurmak istiyor musunuz? [e/H]: ${NC}"
        read -r choice_tr
        echo -en "${YELLOW}Do you want to uninstall and reinstall? [y/N]: ${NC}"
        read -r choice_en
        
        local should_uninstall=false
        if [[ "$choice_tr" =~ ^[eEyY]$ ]] || [[ "$choice_en" =~ ^[eEyY]$ ]]; then
            should_uninstall=true
        fi

        if [ "$should_uninstall" = true ]; then
            echo -e "${YELLOW}Önceki kurulum kaldırılıyor... / Uninstalling previous installation...${NC}"
            uninstall
        else
            echo -e "${RED}Kurulum iptal edildi. / Installation cancelled.${NC}"
            exit 0
        fi
    fi
}

# Uninstall Function
uninstall() {
    echo -e "${YELLOW}M-Panel kaldırılıyor... / Uninstalling M-Panel...${NC}"

    # Stop services
    echo -e "${YELLOW}Servisler durduruluyor... / Stopping services...${NC}"
    systemctl stop m-panel-api xray nginx || true
    systemctl disable m-panel-api xray || true

    # Delete service files
    echo -e "${YELLOW}Servis dosyaları siliniyor... / Deleting service files...${NC}"
    rm -f /etc/systemd/system/m-panel-api.service
    rm -f /etc/systemd/system/xray.service
    systemctl daemon-reload

    # Remove application and static files
    echo -e "${YELLOW}Uygulama dosyaları siliniyor... / Deleting application files...${NC}"
    rm -rf /opt/m-panel
    rm -rf /var/www/m-panel

    # Remove Xray binary and configs
    echo -e "${YELLOW}Xray dosyaları siliniyor... / Deleting Xray files...${NC}"
    rm -f /usr/local/bin/xray
    rm -rf /usr/local/etc/xray

    # Retrieve panel port from Nginx configuration if possible, to remove UFW rule
    if [ -f "/etc/nginx/sites-available/m-panel" ]; then
        local old_port
        old_port=$(grep -E 'listen\s+[0-9]+' /etc/nginx/sites-available/m-panel | awk '{print $2}' | tr -d ';')
        if [ -n "$old_port" ]; then
            echo -e "${YELLOW}UFW kuralı kaldırılıyor ($old_port)... / Removing UFW rule ($old_port)...${NC}"
            ufw delete allow "$old_port"/tcp || true
        fi
    fi

    # Remove Nginx configurations
    echo -e "${YELLOW}Nginx yapılandırmaları siliniyor... / Deleting Nginx configs...${NC}"
    rm -f /etc/nginx/sites-enabled/m-panel
    rm -f /etc/nginx/sites-available/m-panel
    systemctl reload nginx || true

    echo -e "${GREEN}M-Panel başarıyla kaldırıldı! / M-Panel has been successfully uninstalled!${NC}"
}

# Step 1: Install Dependencies
install_dependencies() {
    print_step "1" "8" "Sistem Güncellemesi ve Bağımlılıklar Kuruluyor" "System Update and Installing Dependencies"

    # Update repositories
    apt-get update -y

    # Install apt dependencies
    apt-get install -y curl wget git unzip jq python3 python3-pip python3-venv nginx ufw

    # Node.js 20.x installation
    echo -e "${YELLOW}Node.js 20.x kuruluyor... / Installing Node.js 20.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    
    # Verify node and npm installation
    if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
        echo -e "${RED}HATA: Node.js veya NPM yüklenemedi! / ERROR: Failed to install Node.js or NPM!${NC}"
        exit 1
    fi
    echo -e "${GREEN}Node.js $(node -v) ve NPM $(npm -v) başarıyla kuruldu. / Node.js and NPM installed successfully.${NC}"
}

# Step 2: Install Xray-core
install_xray() {
    print_step "2" "8" "Xray-Core Kurulumu" "Installing Xray-Core"

    echo -e "${YELLOW}GitHub API'den son Xray-core sürümü sorgulanıyor... / Querying latest Xray-core release...${NC}"
    local latest_version
    latest_version=$(curl -s https://api.github.com/repos/XTLS/Xray-core/releases/latest | jq -r .tag_name)
    
    if [ -z "$latest_version" ] || [ "$latest_version" = "null" ]; then
        latest_version="v25.1.30" # Fallback version
        echo -e "${YELLOW}GitHub API limiti veya bağlantı hatası. Varsayılan sürüm kullanılacak: $latest_version / GitHub API limit or connection issue. Fallback version will be used: $latest_version${NC}"
    else
        echo -e "${GREEN}En son sürüm bulundu: $latest_version / Latest version found: $latest_version${NC}"
    fi

    # Create temporary directory for download
    local tmp_dir
    tmp_dir=$(mktemp -d)
    
    echo -e "${YELLOW}Xray-core indiriliyor... / Downloading Xray-core...${NC}"
    local download_url="https://github.com/XTLS/Xray-core/releases/download/${latest_version}/Xray-linux-64.zip"
    
    if ! wget -q --show-progress -O "$tmp_dir/xray.zip" "$download_url"; then
        echo -e "${RED}HATA: Xray-core indirilemedi! / ERROR: Failed to download Xray-core!${NC}"
        rm -rf "$tmp_dir"
        exit 1
    fi

    echo -e "${YELLOW}Dosyalar çıkarılıyor... / Extracting files...${NC}"
    if ! unzip -o "$tmp_dir/xray.zip" -d "$tmp_dir/xray_extracted"; then
        echo -e "${RED}HATA: Zip dosyası açılamadı! / ERROR: Failed to extract zip file!${NC}"
        rm -rf "$tmp_dir"
        exit 1
    fi

    # Copy binary
    mkdir -p /usr/local/bin
    cp -f "$tmp_dir/xray_extracted/xray" /usr/local/bin/xray
    chmod +x /usr/local/bin/xray

    # Create config folder and default config if not exists
    mkdir -p /usr/local/etc/xray
    if [ ! -f "/usr/local/etc/xray/config.json" ]; then
        echo '{"log":{"loglevel":"warning"},"inbounds":[],"outbounds":[{"protocol":"freedom"}]}' > /usr/local/etc/xray/config.json
    fi

    # Create systemd service file
    echo -e "${YELLOW}Xray systemd servisi oluşturuluyor... / Creating Xray systemd service...${NC}"
    cat <<EOF > /etc/systemd/system/xray.service
[Unit]
Description=Xray Service
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/xray run -config /usr/local/etc/xray/config.json
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

    # Clean up temp
    rm -rf "$tmp_dir"
    echo -e "${GREEN}Xray-core başarıyla kuruldu! / Xray-core installed successfully!${NC}"
}

# Step 3: Setup Backend
setup_backend() {
    print_step "3" "8" "M-Panel Backend Kurulumu" "Installing M-Panel Backend"

    echo -e "${YELLOW}Repository klonlanıyor... / Cloning repository...${NC}"
    mkdir -p /opt/m-panel
    
    if ! git clone "$REPO_URL" /opt/m-panel; then
        echo -e "${RED}HATA: Depo klonlanamadı! / ERROR: Failed to clone repository!${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Python Sanal Ortamı (venv) oluşturuluyor... / Creating Python Virtual Environment (venv)...${NC}"
    python3 -m venv /opt/m-panel/venv
    /opt/m-panel/venv/bin/pip install --upgrade pip

    echo -e "${YELLOW}Python bağımlılıkları kuruluyor... / Installing Python dependencies...${NC}"
    if ! /opt/m-panel/venv/bin/pip install -r /opt/m-panel/app/requirements.txt; then
        echo -e "${RED}HATA: Python bağımlılıkları yüklenemedi! / ERROR: Failed to install Python dependencies!${NC}"
        exit 1
    fi

    # Generate JWT Secret Key and Random URL-safe Admin Password (12 alphanumeric characters)
    JWT_SECRET_KEY=$(openssl rand -hex 32)
    ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 12)

    echo -e "${YELLOW}.env dosyası yapılandırılıyor... / Configuring .env file...${NC}"
    cat <<EOF > /opt/m-panel/app/.env
# M-Panel Environment Variables
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$ADMIN_PASSWORD
JWT_SECRET_KEY=$JWT_SECRET_KEY
DATABASE_URL=sqlite:////opt/m-panel/app/data/panel.db
PANEL_VERSION=v1.0.0
EOF

    chmod 600 /opt/m-panel/app/.env

    # Create systemd service for FastAPI app
    echo -e "${YELLOW}M-Panel backend systemd servisi oluşturuluyor... / Creating M-Panel backend systemd service...${NC}"
    cat <<EOF > /etc/systemd/system/m-panel-api.service
[Unit]
Description=M-Panel API Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/m-panel/app
ExecStart=/opt/m-panel/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

    echo -e "${GREEN}Backend kurulumu tamamlandı. / Backend installation completed.${NC}"
}

# Step 4: Init Database
init_database() {
    print_step "4" "8" "Veritabanı Yapılandırılıyor" "Initializing Database"

    echo -e "${YELLOW}Veritabanı tabloları ve varsayılan yönetici oluşturuluyor... / Creating database tables and default admin...${NC}"
    
    mkdir -p /opt/m-panel/app/data

    # Run init_db.py using virtual environment's Python
    if ! (cd /opt/m-panel/app && /opt/m-panel/venv/bin/python init_db.py); then
        echo -e "${RED}HATA: Veritabanı başlatılamadı! / ERROR: Failed to initialize database!${NC}"
        exit 1
    fi

    echo -e "${GREEN}Veritabanı başarıyla başlatıldı. / Database initialized successfully.${NC}"
}

# Step 5: Build Frontend
build_frontend() {
    print_step "5" "8" "Frontend Derleniyor" "Building Frontend"

    echo -e "${YELLOW}React paketleri kuruluyor... / Installing React packages...${NC}"
    if ! (cd /opt/m-panel/frontend && npm install); then
        echo -e "${RED}HATA: Frontend bağımlılıkları yüklenemedi! / ERROR: Failed to install frontend dependencies!${NC}"
        exit 1
    fi

    echo -e "${YELLOW}React uygulaması derleniyor... / Building React application...${NC}"
    if ! (cd /opt/m-panel/frontend && npm run build); then
        echo -e "${RED}HATA: Frontend derlenemedi! / ERROR: Failed to build frontend!${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Build dosyaları kopyalanıyor... / Copying build output...${NC}"
    mkdir -p /var/www/m-panel
    rm -rf /var/www/m-panel/*
    cp -r /opt/m-panel/frontend/dist/* /var/www/m-panel/

    echo -e "${GREEN}Frontend derleme ve dağıtım tamamlandı. / Frontend build and deployment completed.${NC}"
}

# Step 6: Configure Nginx
configure_nginx() {
    print_step "6" "8" "Nginx Yapılandırılıyor" "Configuring Nginx"

    echo -e "${YELLOW}M-Panel Nginx konfigürasyonu oluşturuluyor... / Creating Nginx configuration...${NC}"
    
    # Nginx configuration template (escaped variables to write literals)
    cat <<EOF > /etc/nginx/sites-available/m-panel
server {
    listen $PANEL_PORT;
    
    server_tokens off;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
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

    # Symlink to sites-enabled
    ln -sf /etc/nginx/sites-available/m-panel /etc/nginx/sites-enabled/m-panel

    # Remove default Nginx site symlink to prevent port conflicts
    rm -f /etc/nginx/sites-enabled/default

    # Test Nginx config
    echo -e "${YELLOW}Nginx yapılandırması test ediliyor... / Testing Nginx configuration...${NC}"
    if ! nginx -t; then
        echo -e "${RED}HATA: Nginx yapılandırma testi başarısız! / ERROR: Nginx configuration test failed!${NC}"
        echo -e "${YELLOW}Yapılan değişiklikler geri alınıyor... / Rolling back configuration...${NC}"
        rm -f /etc/nginx/sites-enabled/m-panel
        exit 1
    fi

    # Reload nginx
    systemctl reload nginx
    echo -e "${GREEN}Nginx yapılandırması başarıyla tamamlandı. / Nginx configuration completed successfully.${NC}"
}

# Step 7: Configure UFW
configure_ufw() {
    print_step "7" "8" "UFW Güvenlik Duvarı Yapılandırılıyor" "Configuring UFW Firewall"

    echo -e "${YELLOW}UFW kuralları ekleniyor... / Adding UFW rules...${NC}"
    
    # Allow ports
    ufw allow 22/tcp || true
    ufw allow 80/tcp || true
    ufw allow "$PANEL_PORT"/tcp || true

    # Enable firewall
    echo -e "${YELLOW}UFW etkinleştiriliyor... / Enabling UFW...${NC}"
    ufw --force enable

    echo -e "${GREEN}UFW başarıyla yapılandırıldı. / UFW configured successfully.${NC}"
}

# Step 8: Start Services
start_services() {
    print_step "8" "8" "Servisler Başlatılıyor" "Starting Services"

    echo -e "${YELLOW}Systemd daemon-reload...${NC}"
    systemctl daemon-reload

    echo -e "${YELLOW}Servisler aktifleştiriliyor ve başlatılıyor... / Enabling and starting services...${NC}"
    
    # Start and enable Xray
    systemctl enable xray
    if ! systemctl restart xray; then
        echo -e "${RED}HATA: Xray servisi başlatılamadı! / ERROR: Failed to start Xray service!${NC}"
        journalctl -u xray --no-pager -n 20
        exit 1
    fi

    # Start and enable FastAPI app
    systemctl enable m-panel-api
    if ! systemctl restart m-panel-api; then
        echo -e "${RED}HATA: M-Panel Backend servisi başlatılamadı! / ERROR: Failed to start M-Panel Backend service!${NC}"
        journalctl -u m-panel-api --no-pager -n 20
        exit 1
    fi

    # Restart Nginx
    if ! systemctl restart nginx; then
        echo -e "${RED}HATA: Nginx servisi yeniden başlatılamadı! / ERROR: Failed to restart Nginx!${NC}"
        exit 1
    fi

    echo -e "${GREEN}Bütün servisler başarıyla başlatıldı. / All services started successfully.${NC}"
}

# Health check logic
health_check() {
    echo -e "${YELLOW}Sağlık kontrolü yapılıyor... / Running health check...${NC}"
    
    local retries=3
    local wait_sec=5
    local success=false

    for ((i=1; i<=retries; i++)); do
        echo -e "${YELLOW}Deneme $i/$retries: Backend kontrol ediliyor... / Attempt $i/$retries: Checking backend...${NC}"
        sleep "$wait_sec"
        
        local response
        response=$(curl -s http://127.0.0.1:8000/health || true)
        
        if [[ "$response" =~ "status" ]] && [[ "$response" =~ "ok" ]]; then
            success=true
            break
        fi
    done

    if [ "$success" = true ]; then
        echo -e "${GREEN}Sağlık kontrolü başarılı! Backend çalışıyor. / Health check passed! Backend is running.${NC}"
    else
        echo -e "${RED}HATA: Sağlık kontrolü başarısız oldu! Backend yanıt vermiyor. / ERROR: Health check failed! Backend is not responding.${NC}"
        echo -e "${YELLOW}Son API logları: / Latest API logs:${NC}"
        journalctl -u m-panel-api --no-pager -n 30
        exit 1
    fi
}

# Installation Summary
print_summary() {
    local server_ip
    server_ip=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅  M-Panel Başarıyla Kuruldu! / M-Panel Installed Successfully!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  🌐 Adres / URL    : http://${server_ip}:${PANEL_PORT}${NC}"
    echo -e "${GREEN}  👤 Kullanıcı / User: admin${NC}"
    echo -e "${GREEN}  🔑 Şifre / Password: ${ADMIN_PASSWORD}${NC}"
    echo -e "${GREEN}  📦 Sürüm / Version  : v1.0.0${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  ⚠️  Şifreyi kaydedin! Tekrar gösterilmez.${NC}"
    echo -e "${YELLOW}  ⚠️  Save this password! It will not be shown again.${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# MAIN EXECUTION ROUTINE
main() {
    # If uninstallation requested
    if [ "$1" = "--uninstall" ]; then
        check_root_and_os
        uninstall
        exit 0
    fi

    # Standard installation flow
    check_root_and_os
    check_previous_installation
    ask_port
    
    install_dependencies
    install_xray
    setup_backend
    init_database
    build_frontend
    configure_nginx
    configure_ufw
    start_services
    health_check
    print_summary
}

# Run script passing all arguments
main "$@"
