const express = require("express");
const yaml = require("yaml");
const fs = require("fs");
const path = require("path");

const app = express();
const CHANNELS_FILE = path.join(__dirname, "config", "channels", "channels.yml");
const EPG_FILE = path.join("/app/data", "guide.xml");

app.get("/playlist.m3u", (req, res) => {
  const channels = loadChannels();
  let out = "#EXTM3U\n";
  for (const c of channels) {
    out += `#EXTINF:-1 tvg-id="${c.id}" tvg-logo="${c.logo}" group-title="${c.group}",${c.name}\n`;
    out += `${c.url}\n`;
  }
  res.type("audio/x-mpegurl").send(out);
});

app.get("/epg.xml", (req, res) => {
  if (!fs.existsSync(EPG_FILE)) return res.status(404).send("EPG not generated yet");
  res.type("application/xml").sendFile(EPG_FILE);
});

app.get("/channels", (req, res) => res.json(loadChannels()));

function loadChannels() {
  const raw = fs.readFileSync(CHANNELS_FILE, "utf8");
  return yaml.parse(raw).channels;
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`IPTV API listening on :${port}`));
