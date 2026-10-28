import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "data", "smartphone");
const appDir = path.join(root, "app");
const distDir = path.join(root, "dist");

if (!fs.existsSync(sourceDir)) {
  console.error("Missing data/smartphone. Keep the TechAPI repository's data folder.");
  process.exit(1);
}
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(path.join(distDir, "data"), { recursive: true });

function walk(dir) {
  let files = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) files = files.concat(walk(p));
    else if (ent.isFile() && ent.name.toLowerCase().endsWith(".json")) files.push(p);
  }
  return files;
}
const phones = [];
let skipped = 0;
for (const file of walk(sourceDir)) {
  try {
    const r = JSON.parse(fs.readFileSync(file, "utf8"));
    const brand = String(r.brand || path.relative(sourceDir, file).split(path.sep)[0] || "").trim();
    const name = String(r.name || r.slug || "").trim();
    if (!name) { skipped++; continue; }
    phones.push({
      id: `${brand}-${r.slug || name}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      brand, name, slug: r.slug || "",
      release_date: r.release_date ?? null, msrp_usd: r.msrp_usd ?? null,
      soc: r.soc ?? null, ram_gb: r.ram_gb ?? null,
      storage_options_gb: Array.isArray(r.storage_options_gb) ? r.storage_options_gb : [],
      display: r.display ?? {}, cameras: Array.isArray(r.cameras) ? r.cameras : [],
      battery_mah: r.battery_mah ?? null, charging_wired_w: r.charging_wired_w ?? null,
      charging_wireless_w: r.charging_wireless_w ?? null, weight_g: r.weight_g ?? null,
      dimensions: r.dimensions ?? {}, ip_rating: r.ip_rating ?? null,
      os: r.os ?? null, os_version: r.os_version ?? null,
      connectivity: r.connectivity ?? {}, image_url: r.image_url ?? null,
      source_urls: Array.isArray(r.source_urls) ? r.source_urls : []
    });
  } catch { skipped++; }
}
phones.sort((a,b) => `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`));
fs.writeFileSync(path.join(distDir, "data", "phones.json"), JSON.stringify(phones));
for (const name of ["index.html", "styles.css", "app.js"]) {
  fs.copyFileSync(path.join(appDir, name), path.join(distDir, name));
}
fs.writeFileSync(path.join(distDir, "_headers"),
`/data/*
  Cache-Control: public, max-age=3600
  X-Content-Type-Options: nosniff

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`);
console.log(`Built ${phones.length} phone records; skipped ${skipped}.`);
