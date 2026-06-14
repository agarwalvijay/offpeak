# Setup ComEd Dashboard with Custom Domain on nginx

## Overview
This guide configures nginx to serve your ComEd dashboard at `comed.theagarwals.com` alongside your existing `aoknos.com` site.

## Prerequisites
- nginx already running on your server
- Domain `comed.theagarwals.com` DNS pointing to your server's IP
- ComEd dashboard running on localhost:8080
- Root/sudo access to the server

## Quick Setup

### 1. Update Email in Script
Edit `setup-nginx-domain.sh` and change:
```bash
EMAIL="your-email@example.com"  # Replace with your actual email
```

### 2. Run Setup Script
```bash
chmod +x setup-nginx-domain.sh
./setup-nginx-domain.sh
```

### 3. Setup SSL Certificate
```bash
sudo certbot --nginx -d comed.theagarwals.com --email your-email@example.com --agree-tos --non-interactive
```

## Manual Setup Steps

If you prefer manual configuration:

### 1. Create nginx Site Configuration
```bash
sudo nano /etc/nginx/sites-available/comed.theagarwals.com
```

Copy the content from `nginx-config/comed.theagarwals.com` file.

### 2. Enable the Site
```bash
sudo ln -s /etc/nginx/sites-available/comed.theagarwals.com /etc/nginx/sites-enabled/
```

### 3. Test Configuration
```bash
sudo nginx -t
```

### 4. Reload nginx
```bash
sudo systemctl reload nginx
```

### 5. Install SSL Certificate
```bash
sudo certbot --nginx -d comed.theagarwals.com
```

## DNS Configuration

Make sure your DNS has an A record:
```
comed.theagarwals.com.  IN  A  YOUR-SERVER-IP
```

You can check DNS propagation:
```bash
nslookup comed.theagarwals.com
dig comed.theagarwals.com
```

## Firewall Configuration

Ensure your firewall allows web traffic:
```bash
# GCP firewall (if needed)
gcloud compute firewall-rules create allow-http-https \
    --allow tcp:80,tcp:443 \
    --source-ranges 0.0.0.0/0 \
    --target-tags http-server

# Or using ufw (Ubuntu)
sudo ufw allow 'Nginx Full'
```

## Verify Setup

### 1. Check nginx Status
```bash
sudo systemctl status nginx
```

### 2. Check Site Configuration
```bash
sudo nginx -T | grep -A 10 -B 10 comed.theagarwals.com
```

### 3. Test HTTP Access
```bash
curl -I http://comed.theagarwals.com
```

### 4. Test HTTPS Access (after SSL)
```bash
curl -I https://comed.theagarwals.com
```

## Multiple Sites Configuration

Your nginx now serves:
- `aoknos.com` - Your existing static website
- `comed.theagarwals.com` - ComEd dashboard (reverse proxy to :8080)

Both sites work independently with their own configurations.

## Troubleshooting

### ComEd Dashboard Not Loading
1. **Check Streamlit is running:**
   ```bash
   sudo systemctl status comed-dashboard
   curl http://localhost:8080
   ```

2. **Check nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/comed.theagarwals.com.error.log
   ```

3. **Verify proxy settings:**
   ```bash
   sudo nginx -T | grep -A 5 "proxy_pass"
   ```

### SSL Certificate Issues
1. **Check certificate status:**
   ```bash
   sudo certbot certificates
   ```

2. **Renew certificate:**
   ```bash
   sudo certbot renew --dry-run
   ```

3. **Force certificate renewal:**
   ```bash
   sudo certbot renew --force-renewal
   ```

### DNS Not Resolving
1. **Check DNS propagation:**
   ```bash
   nslookup comed.theagarwals.com 8.8.8.8
   ```

2. **Verify domain pointing to correct IP:**
   ```bash
   dig +short comed.theagarwals.com
   ```

## Performance Optimization

### Enable Gzip Compression
The configuration includes gzip compression for better performance.

### Browser Caching
Consider adding cache headers for static assets:
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Security Features

The configuration includes:
- **HTTPS redirect** - All HTTP traffic redirected to HTTPS
- **Security headers** - X-Frame-Options, XSS Protection, etc.
- **Modern SSL/TLS** - Only secure protocols and ciphers
- **WebSocket support** - For Streamlit real-time updates

## Monitoring

### Check Access Logs
```bash
sudo tail -f /var/log/nginx/comed.theagarwals.com.access.log
```

### Monitor Real-time Traffic
```bash
sudo tail -f /var/log/nginx/access.log | grep comed.theagarwals.com
```

## Success Checklist

✅ nginx configuration created and enabled  
✅ DNS pointing to server IP  
✅ HTTP access working  
✅ SSL certificate installed  
✅ HTTPS access working  
✅ ComEd dashboard loading correctly  
✅ Real-time data updates working  
✅ WebSocket connections functioning  

Your ComEd dashboard is now professionally hosted at `https://comed.theagarwals.com` with SSL security!