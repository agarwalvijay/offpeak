#!/bin/bash

# Setup nginx configuration for comed.theagarwals.com
# Run this script on your GCP VM

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

DOMAIN="comed.theagarwals.com"
EMAIL="your-email@example.com"  # Update this with your email

print_status "Setting up nginx configuration for $DOMAIN"

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    SUDO=""
else
    SUDO="sudo"
fi

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    print_error "nginx is not installed. Please install nginx first."
    exit 1
fi

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    print_status "Installing certbot for SSL certificates..."
    $SUDO apt-get update
    $SUDO apt-get install -y certbot python3-certbot-nginx
fi

# Create nginx configuration
print_status "Creating nginx configuration..."
$SUDO tee /etc/nginx/sites-available/$DOMAIN > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Reverse proxy to Streamlit app
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        
        # Streamlit specific settings
        proxy_buffering off;
        proxy_read_timeout 86400;
        proxy_redirect off;
    }

    # Handle Streamlit static files
    location /_stcore/static/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Handle WebSocket connections for real-time updates
    location /_stcore/stream {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Logging
    access_log /var/log/nginx/$DOMAIN.access.log;
    error_log /var/log/nginx/$DOMAIN.error.log;
}
EOF

# Enable the site
print_status "Enabling nginx site..."
$SUDO ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Test nginx configuration
print_status "Testing nginx configuration..."
$SUDO nginx -t

if [ $? -eq 0 ]; then
    print_success "nginx configuration is valid"
else
    print_error "nginx configuration has errors"
    exit 1
fi

# Reload nginx
print_status "Reloading nginx..."
$SUDO systemctl reload nginx

print_warning "IMPORTANT: Before running SSL setup, make sure:"
print_warning "1. DNS for $DOMAIN points to this server's IP"
print_warning "2. Firewall allows HTTP (80) and HTTPS (443) traffic"
print_warning "3. Update EMAIL variable in this script with your actual email"

echo ""
print_status "To complete setup with SSL certificate, run:"
echo "sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive"

echo ""
print_status "Current nginx sites enabled:"
ls -la /etc/nginx/sites-enabled/

echo ""
print_success "nginx configuration for $DOMAIN has been created!"
print_status "Access your app at: http://$DOMAIN (after DNS propagation)"
print_status "HTTPS will be available after running certbot command above"