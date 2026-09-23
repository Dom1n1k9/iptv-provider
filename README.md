# Self-Hosted IPTV Provider (RPi 5)

Personal IPTV provider for home use. Hosts channels, generates the **M3U playlist**
and **XMLTV EPG** that any IPTV app (TiviMate, IPTV Smarters, VLC, Jellyfin) can use.
Designed to run on a Raspberry Pi 5 (Raspberry Pi OS Lite 64-bit).

> **Network reality check:** your ISP **upload** bandwidth is the real bottleneck,
> not the Pi. 4Mbps 1080p feels enough for ~1-3 simultaneous viewers on a 30-50Mbps
> upload. Transcoding is software-side here, so keep it to direct remux/passthrough.

## Architecture

```
┌────────────┐  RTMP ingest   ┌──────────────┐   HLS/HTTP   ┌─────────────┐
│ Encoder /  │ ─────────────> │ nginx-rtmp   │ ───────────> │ IPTV apps   │
│ content    │                │  (RPi 5)     │              │ (viewer)    │
└────────────┘                └──────┬───────┘              └─────────────┘
                                     │ guide.xml
                                     ▼
                              ┌──────────────┐
                              │    API (TS)  │  ──/playlist.m3u  ──/epg.xml
                              │ (generates   │
                              │ M3U + XMLTV) │
                              └──────┬───────┘
                                     │ reverse proxy + TLS
                                     ▼
                              ┌──────────────┐
                              │    Caddy     │  https://... (clients)
                              └──────────────┘
                                     │
                              ┌──────────────┐
                              │ Uptime Kuma │  status dashboard
                              └──────────────┘
```

## Services (Docker Compose)

| Service     | Port | Purpose |
|-------------|------|---------|
| `iptv`      | `1935` (RTMP) / `8080` (HTTP-HLS) | Ingest + HLS serving |
| `epg`       | `127.0.0.1:3002` | iptv-org/epg XMLTV server (`/guide.xml`) |
| `api`       | `127.0.0.1:3000` | **TS API** `/playlist.m3u`, `/epg.xml`, `/channels` (auth) |
| `proxy`     | `80`, `443` | Caddy TLS reverse proxy (recommended) |
| `uptime-kuma` | `3001` | Monitoring/status page |

## Quick start (RPi 5, Raspberry Pi OS Lite 64-bit)

```bash
# 1. Install Docker (Lite has no Docker pre-installed)
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && exit   # log back in

# 2. Clone and deploy
git clone https://github.com/Dom1n1k9/iptv-provider.git
cd iptv-provider
cp .env.example .env && nano .env        # set PLAYLIST_USER/PASS first
docker compose up -d --build
```

Point your IPTV app at (LAN-only by default):

```
Playlist: http://<pi-ip>:8081/playlist.m3u
EPG:      http://<pi-ip>:8081/epg.xml
```

(To publish publicly, enable the HTTPS block in `config/Caddyfile` and set
`STREAM_BASE_URL=https://<domain>` in `.env` — then use `https://<domain>/playlist.m3u`.)

## Auth

The playlist/EPG endpoints are protected with **HTTP Basic auth**. Configure in `.env`:

```env
PLAYLIST_USER=admin
PLAYLIST_PASS=you-should-change-me
# Public base URL baked into stream links in the M3U
# LAN-only: http://<pi-ip>:8080    |  With Caddy/TLS: https://iptv.example.com
STREAM_BASE_URL=http://<pi-ip>:8080
```

IPTV apps (TiviMate, Smarters, etc.) let you enter a username/password — those
credentials are sent via Basic auth automatically. Without auth, anyone who finds
your Pi's IP could read your lineup.

## Reverse proxy / TLS (Caddy)

Edit `config/Caddyfile`. By default it runs **LAN-only** with no TLS:

```
Playlist (LAN): http://<pi-ip>:8081/playlist.m3u
EPG (LAN):      http://<pi-ip>:8081/epg.xml
```

The API behind it requires Basic auth, so leaving `:8081` on the LAN is fine.

To publish over the internet with TLS, **uncomment the `https://iptv.example.com`
block** in `config/Caddyfile` and replace `iptv.example.com` with your real domain
(which must already resolve to your Pi). Caddy will then fetch a Let's Encrypt cert
automatically and also serve `/hls/*` on the same public host.

Keep `:1935` (RTMP) and `:8080` (HLS) bound to the LAN only; do **not** expose them
to the internet. The API itself binds to localhost-only and is only reachable via Caddy.

## Monitoring (Uptime Kuma)

After `docker compose up`, open `http://<pi-ip>:3001`, set up a dashboard, and add
HTTP monitors. Since Kuma runs in its own container, use Docker **service names**,
not `localhost`:

- `http://api:3000/health`   (API up)
- `http://api:3000/playlist.m3u`  (expects 401 without auth = good)
- `http://iptv:80/hls/main-live.m3u8`  (stream up)

## Ingest

Push your stream into the Pi over RTMP (e.g. from OBS):

```
rtmp://<pi-ip>:1935/live/main-live
```
available to clients as `http://<pi-ip>:8080/hls/main-live.m3u8`.

## Configuration

- `config/channels/channels.yml` — lineup (HLS path per channel; API prefixes `STREAM_BASE_URL`)
- `config/epg/channels.xml` — the channel list fed to iptv-org/epg; builds the guide
- `config/nginx.conf` — RTMP/HLS/transcode behavior
- `config/Caddyfile` — reverse proxy / TLS rules
- `api/src/index.ts` — TS M3U/XMLTV generation + auth (proxies EPG from the epg service)

## Development

```bash
cd api
npm install
npm run dev     # ts-node watch
npm run build   # tsc -> dist/
npm run typecheck
```

CI runs typecheck + cross-platform Docker build (arm64 for RPi 5) on every push.

## RPi 5 tuning notes

- Use **64-bit Raspberry Pi OS Lite**; hardware decode via V4L2 where available.
- Add `dtoverlay=vc4-kms-v3d` to `/boot/firmware/config.txt` on Lite (uncomment if needed) for the V4L2 encoder, then reboot.
- External 4K/HEVC sources are heavy for software transcode — prefer passthrough/remux.
- Storage: SSD over USB3 is much better than an SD card for many streams.

## License

MIT
