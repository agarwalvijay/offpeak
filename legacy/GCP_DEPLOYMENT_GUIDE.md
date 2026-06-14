# GCP Deployment Guide for ComEd Dashboard

## Quick Deployment (Recommended)

### 1. Prerequisites
- Google Cloud Platform account
- gcloud CLI installed and configured
- Docker installed locally
- GCP project with billing enabled

### 2. Simple Deployment Steps

1. **Edit the deployment script:**
   ```bash
   nano deploy-gcp.sh
   ```
   Set your PROJECT_ID in the script:
   ```bash
   PROJECT_ID="your-gcp-project-id"
   ```

2. **Run the deployment script:**
   ```bash
   ./deploy-gcp.sh
   ```

3. **Access your app:**
   The script will output your app URL when deployment completes.

## Manual Deployment Options

### Option A: Cloud Run (Serverless - Recommended)

```bash
# Set your project ID
export PROJECT_ID=your-gcp-project-id
gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

# Build and deploy
gcloud builds submit --tag gcr.io/$PROJECT_ID/comed-dashboard
gcloud run deploy comed-dashboard \
  --image gcr.io/$PROJECT_ID/comed-dashboard \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

### Option B: Compute Engine (VM)

1. **Create a VM instance:**
   ```bash
   gcloud compute instances create comed-dashboard-vm \
     --zone=us-central1-a \
     --machine-type=e2-micro \
     --boot-disk-size=10GB \
     --image-family=ubuntu-2004-lts \
     --image-project=ubuntu-os-cloud \
     --tags=http-server,https-server
   ```

2. **Configure firewall:**
   ```bash
   gcloud compute firewall-rules create allow-streamlit \
     --allow tcp:8080 \
     --source-ranges 0.0.0.0/0 \
     --target-tags http-server
   ```

3. **SSH and setup:**
   ```bash
   gcloud compute ssh comed-dashboard-vm --zone=us-central1-a
   
   # On the VM:
   sudo apt update
   sudo apt install python3-pip git -y
   git clone <your-repo-url>
   cd <your-repo>
   pip3 install -r requirements.txt
   streamlit run app.py --server.port 8080 --server.address 0.0.0.0
   ```

### Option C: App Engine

1. **Create app.yaml:**
   ```yaml
   runtime: python311
   
   env_variables:
     PORT: 8080
   
   automatic_scaling:
     min_instances: 0
     max_instances: 2
   ```

2. **Deploy:**
   ```bash
   gcloud app deploy
   ```

## Cost Comparison

| Service | Cost (approx.) | Pros | Cons |
|---------|---------------|------|------|
| **Cloud Run** | $0-5/month | Serverless, auto-scaling, pay-per-use | Cold starts |
| **Compute Engine** | $5-20/month | Full control, no cold starts | Always running |
| **App Engine** | $10-30/month | Managed, integrated | Less flexible |

## Recommended: Cloud Run

**Why Cloud Run is best for this app:**
- Serverless (no server management)
- Auto-scaling (handles traffic spikes)
- Pay only for actual usage
- HTTPS automatically provided
- Easy deployments and rollbacks

## Domain Setup (Optional)

1. **Map custom domain:**
   ```bash
   gcloud run domain-mappings create \
     --service comed-dashboard \
     --domain your-domain.com \
     --region us-central1
   ```

2. **Update DNS records** as instructed by GCP

## Monitoring and Logs

- **View logs:** `gcloud logging read "resource.type=cloud_run_revision"`
- **Monitor in console:** https://console.cloud.google.com/run
- **Set up alerts** for errors or high usage

## Security Considerations

- The app is deployed with `--allow-unauthenticated` for public access
- ComEd API data is public, so no sensitive data exposure
- Consider adding authentication if needed:
  ```bash
  gcloud run deploy comed-dashboard --no-allow-unauthenticated
  ```

## Troubleshooting

**Common issues:**
- **Port mismatch:** Ensure app runs on port 8080
- **Memory limits:** Increase memory if app crashes
- **API timeouts:** Increase timeout for slow ComEd API responses

**Debug commands:**
```bash
# View service details
gcloud run services describe comed-dashboard --region us-central1

# View logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# Update service settings
gcloud run services update comed-dashboard --memory 2Gi --region us-central1
```

## Success Checklist

✅ Docker image builds successfully  
✅ Service deploys to Cloud Run  
✅ App accessible via provided URL  
✅ ComEd API data loads correctly  
✅ Charts and dashboard function properly  

Your ComEd electricity pricing dashboard is now running on Google Cloud Platform!