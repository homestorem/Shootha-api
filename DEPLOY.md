# Production API Deploy

This project can run as an external API server for released mobile apps.

## 1) Deploy the backend (Render / Railway / VPS)

### Option A: Docker-based deploy

Use the included `Dockerfile`.

Required runtime environment variables:

- `PORT` (default `4001`)
- `NODE_ENV=production`
- `OTP_IQ_API_KEY`
- `WAYL_BASE_URL`
- `WAYL_API_KEY`
- `WAYL_CHECKOUT_PATH`
- `WAYL_WEBHOOK_URL`
- `WAYL_WEBHOOK_SECRET`
- `SESSION_SECRET`
- Firebase/server secrets used by your backend routes

Health check endpoint:

- `GET /health`

## 2) Point the app to external API

Set app build env var (EAS production environment):

- `EXPO_PUBLIC_API_URL=https://your-api-domain.com`

Important:

- Use `https` in production.
- Do not use LAN IP / localhost for release builds.

## 3) Build app with production env

Use EAS production profile:

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

## 4) Quick verification checklist

Before submitting to stores:

- `https://your-api-domain.com/health` returns `{ "ok": true, ... }`
- `https://your-api-domain.com/api/venues` returns data
- OTP send/verify works on cellular network (not only Wi-Fi)
