# Deploy ComEd Dashboard to Existing GCP VM

## Quick Deployment

### 1. Update Configuration
Edit `deploy-vm.sh` and set your VM details:
```bash
VM_NAME="your-actual-vm-name"
VM_ZONE="us-central1-a"  # Your VM's zone
PROJECT_ID="your-gcp-project-id"
```

### 2. Run Deployment
```bash
chmod +x deploy-vm.sh
./deploy-vm.sh
```

### 3. Access Your App
The script will output your app URL: `http://YOUR-VM-IP:8080`

## Manual Deployment Steps

If you prefer manual deployment:

### 1. Connect to Your VM
```bash
gcloud compute ssh your-vm-name --zone=your-zone
```

### 2. Install Dependencies
```bash
# Update system
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv git

# Create project directory
mkdir -p ~/comed-dashboard
cd ~/comed-dashboard
```

### 3. Upload Application Files
From your local machine:
```bash
gcloud compute scp --recurse ./* your-vm-name:~/comed-dashboard/ --zone=your-zone
```

### 4. Setup Python Environment
On the VM:
```bash
cd ~/comed-dashboard
python3 -m venv venv
source venv/bin/activate
pip install streamlit pandas plotly requests numpy pytz
```

### 5. Test the Application
```bash
streamlit run app.py --server.port=8080 --server.address=0.0.0.0
```

### 6. Setup as System Service
```bash
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

sudo systemctl daemon-reload
sudo systemctl enable comed-dashboard
sudo systemctl start comed-dashboard
```

### 7. Configure Firewall
```bash
# Create firewall rule
gcloud compute firewall-rules create allow-comed-dashboard \
    --allow tcp:8080 \
    --source-ranges 0.0.0.0/0 \
    --target-tags http-server

# Add tag to your VM
gcloud compute instances add-tags your-vm-name \
    --tags http-server \
    --zone your-zone
```

## Service Management

### Check Service Status
```bash
gcloud compute ssh your-vm-name --zone=your-zone --command='sudo systemctl status comed-dashboard'
```

### View Application Logs
```bash
gcloud compute ssh your-vm-name --zone=your-zone --command='sudo journalctl -u comed-dashboard -f'
```

### Restart Service
```bash
gcloud compute ssh your-vm-name --zone=your-zone --command='sudo systemctl restart comed-dashboard'
```

### Stop Service
```bash
gcloud compute ssh your-vm-name --zone=your-zone --command='sudo systemctl stop comed-dashboard'
```

## Application Updates

To update the application:

1. **Copy new files:**
   ```bash
   gcloud compute scp --recurse ./* your-vm-name:~/comed-dashboard/ --zone=your-zone
   ```

2. **Restart service:**
   ```bash
   gcloud compute ssh your-vm-name --zone=your-zone --command='sudo systemctl restart comed-dashboard'
   ```

## Security Considerations

### Restrict Access (Optional)
To limit access to specific IPs:
```bash
gcloud compute firewall-rules update allow-comed-dashboard \
    --source-ranges YOUR-IP-ADDRESS/32
```

### Enable HTTPS (Optional)
For HTTPS, consider using:
- **Nginx reverse proxy** with Let's Encrypt SSL
- **Google Cloud Load Balancer** with SSL certificate
- **Cloudflare** for SSL termination

## Troubleshooting

### App Not Loading
1. Check if service is running:
   ```bash
   sudo systemctl status comed-dashboard
   ```

2. Check firewall:
   ```bash
   gcloud compute firewall-rules list --filter="name=allow-comed-dashboard"
   ```

3. Verify VM has http-server tag:
   ```bash
   gcloud compute instances describe your-vm-name --zone=your-zone --format="value(tags.items)"
   ```

### Performance Issues
- **Increase VM size:** Upgrade to e2-standard-2 or higher
- **Monitor resources:** Use `htop` to check CPU/memory usage
- **Check logs:** Look for errors in application logs

### Port Already in Use
If port 8080 is busy:
1. Find the process: `sudo lsof -i :8080`
2. Kill it: `sudo kill -9 PID`
3. Restart service: `sudo systemctl restart comed-dashboard`

## Cost Optimization

- **Use preemptible instances** for development (60-91% cost savings)
- **Stop VM when not needed** to save costs
- **Use smaller machine types** (e2-micro for light usage)

## Success Checklist

✅ VM accessible via SSH  
✅ Python dependencies installed  
✅ Application files copied to VM  
✅ Systemd service created and running  
✅ Firewall rule configured  
✅ App accessible via external IP:8080  
✅ ComEd API data loading correctly  

Your ComEd Dashboard is now running on your GCP VM with automatic startup and service management!