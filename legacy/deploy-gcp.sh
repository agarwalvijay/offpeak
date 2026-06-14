#!/bin/bash

# ComEd Dashboard GCP Deployment Script
# This script deploys the Streamlit app to Google Cloud Run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=""
REGION="us-central1"
SERVICE_NAME="comed-dashboard"

# Function to print colored output
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

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
    print_error "Please set PROJECT_ID in this script"
    echo "Edit deploy-gcp.sh and set PROJECT_ID to your GCP project ID"
    exit 1
fi

print_status "Starting deployment to Google Cloud Run..."
print_status "Project ID: $PROJECT_ID"
print_status "Region: $REGION"
print_status "Service Name: $SERVICE_NAME"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI is not installed"
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    echo "Install it from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Set the project
print_status "Setting GCP project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
print_status "Enabling required GCP APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and push the Docker image
print_status "Building Docker image..."
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest .

print_status "Pushing Docker image to Container Registry..."
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

# Deploy to Cloud Run
print_status "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 300

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

print_success "Deployment completed successfully!"
print_success "Your ComEd Dashboard is available at: $SERVICE_URL"

echo ""
echo "=================================================="
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "=================================================="
echo "Service URL: $SERVICE_URL"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Service Name: $SERVICE_NAME"
echo ""
echo "To update the deployment, run this script again."
echo "To delete the service: gcloud run services delete $SERVICE_NAME --region $REGION"
echo "=================================================="