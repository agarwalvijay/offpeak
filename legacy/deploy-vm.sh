#!/bin/bash

# ComEd Dashboard VM Deployment Script
# Deploy to existing GCP VM instance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - UPDATE THESE VALUES
VM_NAME="instance-20250703-160055"
VM_ZONE="us-central1-c"
PROJECT_ID="tracking-app-158014"

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

# Check configuration
if [[ "$VM_NAME" == "your-vm-name" || "$PROJECT_ID" == "your-project-id" ]]; then
    print_error "Please update VM_NAME, VM_ZONE, and PROJECT_ID in this script"
    exit 1
fi

print_status "Deploying ComEd Dashboard to VM: $VM_NAME"
print_status "Zone: $VM_ZONE"
print_status "Project: $PROJECT_ID"

# Set project
gcloud config set project $PROJECT_ID

# Create deployment directory on VM
print_status "Creating deployment directory on VM..."
gcloud compute ssh $VM_NAME --zone=$VM_ZONE --command="mkdir -p ~/comed-dashboard"

# Copy application files to VM
print_status "Copying application files to VM..."
gcloud compute scp --recurse \
  --exclude=".git/*" \
  --exclude="flutter-app/*" \
  --exclude="android-app/*" \
  --exclude="attached_assets/*" \
  --exclude="__pycache__/*" \
  ./* $VM_NAME:~/comed-dashboard/ --zone=$VM_ZONE

# Install dependencies and run setup on VM
print_status "Installing dependencies on VM..."
gcloud compute ssh $VM_NAME --zone=$VM_ZONE --command="
    cd ~/comed-dashboard

    # Update system
    sudo apt-get update

    # Install Python and pip if not present
    sudo apt-get install -y python3 python3-pip python3-venv git curl

    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate

    # Install Python dependencies
    pip install --upgrade pip
    pip install streamlit pandas plotly requests numpy pytz

    # Create systemd service
    sudo tee /etc/systemd/system/comed-dashboard.service > /dev/null <<EOF
[Unit]
Description=ComEd Dashboard
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/$USER/comed-dashboard
Environment=PATH=/home/$USER/comed-dashboard/venv/bin
ExecStart=/home/$USER/comed-dashboard/venv/bin/streamlit run app.py --server.port=8080 --server.address=0.0.0.0
Restart=always

[Install]
WantedBy=multi-user.target
EOF

    # Enable and start service
    sudo systemctl daemon-reload
    sudo systemctl enable comed-dashboard
    sudo systemctl start comed-dashboard
"

# Configure firewall
print_status "Configuring firewall..."
gcloud compute firewall-rules create allow-comed-dashboard \
    --allow tcp:8080 \
    --source-ranges 0.0.0.0/0 \
    --target-tags http-server \
    --description "Allow ComEd Dashboard on port 8080" \
    2>/dev/null || print_warning "Firewall rule may already exist"

# Add network tag to VM if not present
print_status "Adding network tag to VM..."
gcloud compute instances add-tags $VM_NAME \
    --tags http-server \
    --zone $VM_ZONE \
    2>/dev/null || print_warning "Network tag may already exist"

# Get VM external IP
EXTERNAL_IP=$(gcloud compute instances describe $VM_NAME --zone=$VM_ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

print_success "Deployment completed successfully!"
print_success "ComEd Dashboard is available at: http://$EXTERNAL_IP:8080"

echo ""
echo "=================================================="
echo "🎉 VM DEPLOYMENT SUCCESSFUL!"
echo "=================================================="
echo "VM Name: $VM_NAME"
echo "Zone: $VM_ZONE"
echo "External IP: $EXTERNAL_IP"
echo "App URL: http://$EXTERNAL_IP:8080"
echo ""
echo "Service management:"
echo "  Check status: gcloud compute ssh $VM_NAME --zone=$VM_ZONE --command='sudo systemctl status comed-dashboard'"
echo "  View logs: gcloud compute ssh $VM_NAME --zone=$VM_ZONE --command='sudo journalctl -u comed-dashboard -f'"
echo "  Restart: gcloud compute ssh $VM_NAME --zone=$VM_ZONE --command='sudo systemctl restart comed-dashboard'"
echo "=================================================="
