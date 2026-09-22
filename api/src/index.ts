import express, { NextFunction, Request, Response } from "express";
import yaml from "yaml";
import fs from "fs";
import path from "path";

const CHANNELS_FILE = path.join(__dirname, "..", "config", "channels", "channels.yml");
const EPG_FILE = path.join("/app/data", "guide.xml");

interface Channel {
  id: string;
  name: string;
  logo: string;
  url: string;
  group: string;
}

interface ChannelFile {
  channels: Channel[];
}

function loadChannels(): Channel[] {
  const raw = fs.readFileSync(CHANNELS_FILE, "utf8");
  const parsed = yaml.parse(raw) as ChannelFile;
  return parsed.channels;
}

const AUTH_USERS = new Map<string, string>(); // user -> pass
if (process.env.PLAYLIST_USER && process.env.PLAYLIST_PASS) {
  AUTH_USERS.set(process.env.PLAYLIST_USER, process.env.PLAYLIST_PASS);
}

function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const [, token = ""] = header.split(" ");
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const [user, pass] = decoded.split(":");

  if (user && AUTH_USERS.has(user) && AUTH_USERS.get(user) === pass) {
    return next();
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="IPTV"');
  res.status(401).send("Unauthorized");
}

const app = express();

app.get("/playlist.m3u", basicAuth, (req: Request, res: Response) => {
  const channels = loadChannels();
  let out = "#EXTM3U\n";
  for (const c of channels) {
    out += `#EXTINF:-1 tvg-id="${c.id}" tvg-logo="${c.logo}" group-title="${c.group}",${c.name}\n`;
    out += `${c.url}\n`;
  }
  res.type("audio/x-mpegurl").send(out);
});

app.get("/epg.xml", basicAuth, (req: Request, res: Response) => {
  if (!fs.existsSync(EPG_FILE)) {
    res.status(404).send("EPG not generated yet");
    return;
  }
  res.type("application/xml").sendFile(EPG_FILE);
});

app.get("/channels", basicAuth, (req: Request, res: Response) => res.json(loadChannels()));

app.get("/health", (req: Request, res: Response) => res.json({ status: "ok" }));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`IPTV API listening on :${port}`));
