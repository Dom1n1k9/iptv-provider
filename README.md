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
| `epg`       | -    | Pulls XMLTV from sources |
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

Point your IPTV app at:

```
Playlist: https://<domain>/playlist.m3u   (Basic auth: user/pass)
EPG:      https://<domain>/epg.xml
Local:    http://<pi-ip>:3000/playlist.m3u
```

## Auth

The playlist/EPG endpoints are protected with **HTTP Basic auth**. Configure in `.env`:

```env
PLAYLIST_USER=admin
PLAYLIST_PASS=you-should-change-me
```

IPTV apps (TiviMate, Smarters, etc.) let you enter a username/password — those
credentials are sent via Basic auth automatically. Without auth, anyone who finds
your Pi's IP could read your lineup.

## Reverse proxy / TLS (Caddy)

Edit `config/Caddyfile` and replace `iptv.example.com` with your real domain. On a
bare Pi (no public domain yet), change the `http://localhost:8081` block to bind to
the Pi's LAN IP instead:
`http://<pi-lan-ip>:8081 { reverse_proxy api:3000 }`

Keep `:1935` (RTMP) and `:8080` (HLS) bound to the LAN only; do **not** expose them
to the internet.

## Monitoring (Uptime Kuma)

After `docker compose up`, open `http://<pi-ip>:3001`, set up a dashboard, and add
HTTP monitors for:
- `http://localhost:3000/health` (API up)
- `http://localhost:3000/playlist.m3u` (auth endpoint)
- `http://localhost:80/hls/main-live.m3u8` (stream up)

## Ingest

Push your stream into the Pi over RTMP (e.g. from OBS):

```
rtmp://<pi-ip>:1935/live/main-live
```
available to clients as `http://<pi-ip>:8080/hls/main-live.m3u8`.

## Configuration

- `config/channels/channels.yml` — lineup (turns into M3U)
- `config/epg/epg-sources.yml` — where the EPG grabber pulls from
- `config/nginx.conf` — RTMP/HLS/transcode behavior
- `config/Caddyfile` — reverse proxy / TLS rules
- `api/src/index.ts` — TS M3U/XMLTV generation + auth

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
