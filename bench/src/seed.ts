// Seeds a realistic demo vault (used for screenshots and manual testing).
//   Dev #1: 20 photos (mostly encrypted), 5 albums, shares with Dev #2.
//   Dev #2: 4 photos, shares with Dev #1.
// Idempotent: skips if Dev #1 already has files. Photos: Unsplash CDN (free license).
import type { Album, UploadResult } from "@asgard/shared";
import { Client, DEV_KEYS, loadConfig } from "./client.js";

type Photo = { id: string; title: string; tags: string[]; album?: string; portrait?: boolean; public?: boolean };

const DEV1: Photo[] = [
  { id: "1506744038136-46273834b3fb", title: "Yosemite valley at dusk", tags: ["mountains", "nature"], album: "Mountains & Lakes" },
  { id: "1501785888041-af3ef285b470", title: "Lago di Braies", tags: ["lake", "travel"], album: "Travel 2026" },
  { id: "1470071459604-3b5ec3a7fe05", title: "Highlands sunrise", tags: ["mountains", "sunrise"], album: "Mountains & Lakes" },
  { id: "1441974231531-c6227db76b6e", title: "Forest path", tags: ["forest", "nature"], portrait: true },
  { id: "1507525428034-b723cf961d3e", title: "Beach at first light", tags: ["beach", "sunrise"], album: "Travel 2026", public: true },
  { id: "1500530855697-b586d89ba3ee", title: "Valley of Fire road trip", tags: ["roadtrip", "travel"], album: "Travel 2026" },
  { id: "1472214103451-9374bd1c798e", title: "Fairy Glen, Skye", tags: ["nature", "travel"], album: "Travel 2026" },
  { id: "1519681393784-d120267933ba", title: "Milky Way over the peaks", tags: ["night", "mountains"], album: "Mountains & Lakes", portrait: true },
  { id: "1464822759023-fed622ff2c3b", title: "Alpine overlook", tags: ["mountains"], album: "Mountains & Lakes" },
  { id: "1493246507139-91e8fad9978e", title: "Moraine Lake", tags: ["lake", "mountains"], album: "Mountains & Lakes" },
  { id: "1490750967868-88aa4486c946", title: "Poppy field", tags: ["flowers", "nature"], portrait: true, public: true },
  { id: "1543466835-00a7907e9de1", title: "Biscuit the beagle", tags: ["pets", "dog"], album: "Pets", portrait: true },
  { id: "1514888286974-6c03e2ca1dba", title: "Miso on the windowsill", tags: ["pets", "cat"], album: "Pets" },
  { id: "1477959858617-67f85cf4f1df", title: "Chicago from above", tags: ["city"], album: "City Lights" },
  { id: "1480714378408-67cf0d13bc1b", title: "Manhattan golden hour", tags: ["city", "sunset"], album: "City Lights", portrait: true },
  { id: "1449824913935-59a10b8d2000", title: "Fifth Avenue", tags: ["city", "street"], album: "City Lights" },
  { id: "1476514525535-07fb3b4ae5f1", title: "Boat on Braies", tags: ["lake", "travel"], album: "Travel 2026", portrait: true },
  { id: "1502602898657-3e91760cbb34", title: "Paris, Eiffel at dusk", tags: ["paris", "travel"], album: "Travel 2026" },
  { id: "1533105079780-92b9be482077", title: "Santorini steps", tags: ["greece", "travel"], album: "Travel 2026", portrait: true, public: true },
  { id: "1488646953014-85cb44e25828", title: "Packing for the trip", tags: ["travel"] },
];

const DEV2: Photo[] = [
  { id: "1504674900247-0877df9cc836", title: "Sunday lunch", tags: ["food"] },
  { id: "1513104890138-7c749659a591", title: "Homemade pizza", tags: ["food"], portrait: true },
  { id: "1518837695005-2083093ee35b", title: "Wave study", tags: ["ocean"] },
  { id: "1469474968028-56623f02e42e", title: "Misty valley", tags: ["nature"] },
];

async function fetchBytes(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function uploadAll(c: Client, photos: Photo[]): Promise<{ photo: Photo; res: UploadResult }[]> {
  const out = [];
  for (const p of photos) {
    const [w, h] = p.portrait ? [1200, 1500] : [1600, 1067];
    const [tw, th] = p.portrait ? [480, 600] : [480, 320];
    const base = `https://images.unsplash.com/photo-${p.id}?fit=crop&crop=entropy`;
    const [bytes, thumb] = await Promise.all([
      fetchBytes(`${base}&w=${w}&h=${h}&q=82&fm=jpg`),
      fetchBytes(`${base}&w=${tw}&h=${th}&q=70&fm=webp`),
    ]);
    const res = await c.upload({ bytes, thumb, mime: "image/jpeg", width: w, height: h, title: p.title, tags: p.tags, encrypt: !p.public });
    console.log(`  ↑ ${p.title} (${(bytes.byteLength / 1024).toFixed(0)} KB${p.public ? ", public" : ", encrypted"})`);
    out.push({ photo: p, res });
  }
  return out;
}

async function main() {
  const cfg = await loadConfig();
  const [dev1, dev2] = [new Client(DEV_KEYS[0], cfg), new Client(DEV_KEYS[1], cfg)];
  await dev1.login();
  await dev2.login();
  const me = await dev1.req<{ usage: { files: number } }>("GET", "/me");
  if (me.usage.files > 0) {
    console.log("Dev #1 already has files — seed skipped.");
    return;
  }
  await dev1.unlock();
  await dev2.unlock();

  console.log("Dev #1 uploading…");
  const up1 = await uploadAll(dev1, DEV1);
  const r1 = await dev1.addFiles(up1.map((u) => u.res));
  console.log(`  ⛓ registered ${up1.length} files in one tx (gas ${r1.gasUsed})`);

  const albums = new Map<string, number>();
  for (const name of ["Travel 2026", "Mountains & Lakes", "City Lights", "Pets", "Food"]) {
    const a = await dev1.req<Album>("POST", "/albums", { name });
    albums.set(name, a.id);
  }
  for (const [name, id] of albums) {
    const ids = up1.filter((u) => u.photo.album === name).map((u) => u.res.file.id);
    if (ids.length) await dev1.req("POST", `/albums/${id}/files`, { fileIds: ids });
  }

  console.log("Dev #2 uploading…");
  const up2 = await uploadAll(dev2, DEV2);
  await dev2.addFiles(up2.map((u) => u.res));

  console.log("Sharing both ways…");
  await dev1.grant(dev2.address);
  await dev2.grant(dev1.address);
  await dev1.waitConfirmed(up1.map((u) => u.res.file.id));
  await dev2.waitConfirmed(up2.map((u) => u.res.file.id));
  await dev1.until(() => dev1.req<{ viewers: unknown[] }>("GET", "/shares"), (r) => r.viewers.length > 0);
  await dev2.until(() => dev2.req<{ viewers: unknown[] }>("GET", "/shares"), (r) => r.viewers.length > 0);
  console.log(`  🔑 wrapped ${await dev1.syncKeys()} + ${await dev2.syncKeys()} file keys`);
  console.log("\nSeed complete. Open http://localhost:3000 → Open vault → Dev #1.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
