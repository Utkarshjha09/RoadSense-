# Oracle Cloud Deployment Guide

This service fits well on Oracle Cloud Infrastructure using either:

- `OCI Compute` with Docker
- `Oracle Cloud Container Instances`

For your stage, the easiest reliable path is:

1. run locally first
2. deploy with Docker on an Ubuntu VM in OCI Compute

## 1. Local validation

From `backend/inference-service`:

```powershell
copy .env.example .env
```

Fill:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Then run:

```powershell
.\start.ps1
```

Check:

```text
http://localhost:8000/health
```

## 2. Prepare Oracle VM

Create an Oracle Cloud Ubuntu instance.

Recommended minimum:

- 2 OCPU
- 8 GB RAM

Open inbound port:

- `8000` if exposing directly
- or use `80/443` behind Nginx

## 3. Install Docker on the VM

SSH into the VM:

```bash
sudo apt update
sudo apt install -y docker.io
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu
```

Reconnect SSH after adding the docker group.

## 4. Copy the service to the VM

Push the repo to GitHub or copy the project directory to the VM.

## 5. Build the container

From the repo root on the VM:

```bash
docker build -f backend/inference-service/Dockerfile -t roadsense-inference .
```

## 6. Run the container

```bash
docker run -d \
  --name roadsense-inference \
  -p 8000:8000 \
  -e SUPABASE_URL=https://your-project-ref.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  -e DEFAULT_CONFIDENCE_THRESHOLD=0.7 \
  roadsense-inference
```

## 7. Test health

```bash
curl http://<your-vm-public-ip>:8000/health
```

## 8. Recommended production hardening

Add:

- Nginx reverse proxy
- HTTPS with Let's Encrypt
- process logs
- firewall rules limited to expected traffic

## 9. Client flow

Phone or ESP32+GPS device sends:

```text
Client -> POST /predict-window -> FastAPI -> Model -> Supabase -> JSON response
```

## 10. Next integration step

After deployment, update the mobile app with:

```env
EXPO_PUBLIC_INFERENCE_API_URL=https://your-domain-or-ip
```

Then change the driving flow to send 100-sample windows to this backend instead of relying only on local TFLite.
