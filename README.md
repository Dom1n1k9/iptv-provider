# Self-Hosted IPTV Provider (RPi 5)

Personal IPTV provider for home use. Hosts channels, generates the **M3U playlist**
and **XMLTV EPG** that any IPTV app (TiviMate, IPTV Smarters, VLC, Jellyfin) can use.
Designed to run on a Raspberry Pi 5.

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
                              │    API       │  ──/playlist.m3u  ──/epg.xml
                              │ (generates   │
                              │ M3U + XMLTV) │
                              └──────────────┘
```

## Services (Docker Compose)

| Service   | Port | Purpose |
|-----------|------|---------|
| `iptv`    | `1935` (RTMP) / `8080` (HTTP-HLS) | Ingests your encoder feed, serves HLS |
| `epg`     | -    | Pulls XMLTV from configured sources |
| `api`     | `3000` | Serves `/playlist.m3u`, `/epg.xml`, `/channels` |

## Quick start (RPi 5, Raspberry Pi OS 64-bit)

```bash
git clone https://github.com/Dom1n1k9/iptv-provider.git
cd iptv-provider
docker compose up -d --build
```

Then point your IPTV app at:

```
Playlist: http://<pi-ip>:3000/playlist.m3u
EPG:      http://<pi-ip>:3000/epg.xml
```

## Ingest

Push your stream into the Pi over RTMP (e.g. from OBS):

```
rtmp://<pi-ip>:1935/live/main-live
```
which is then available to clients as `http://<pi-ip>:8080/hls/main-live.m3u8`.

## Configuration

- **`config/channels/channels.yml`** — your lineup (turns into M3U)
- **`config/epg/epg-sources.yml`** — where the EPG grabber pulls from
- **`config/nginx.conf`** — RTMP/HLS/transcode behavior
- **`api/index.js`** — the M3U/XMLTV generation endpoint

## RPi 5 tuning notes

- Use **64-bit Raspberry Pi OS**; hardware decode via V4L2 where available.
- Enable the **V4L2 M2M** codec (`v4l2_codec on;` in nginx.conf) to move decode off the CPU.
- External 4K/HEVC sources are heavy for software transcode — prefer passthrough/remux.
- Storage: an SSD over USB3 is much better than an SD card for many streams.

## License

MIT
