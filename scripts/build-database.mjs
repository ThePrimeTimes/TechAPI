
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const startedAt = performance.now();
const root = process.cwd();
const sourceDir = path.join(root, "data", "smartphone");
const appDir = path.join(root, "app");
const distDir = path.join(root, "dist");

function log(message) {
  const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
  console.log(`[${elapsed}s] ${message}`);
}

function fail(message) {
  console.error(`BUILD ERROR: ${message}`);
  process.exit(1);
}

log("Starting TechAPI database build...");
log(`Repository root: ${root}`);

if (!fs.existsSync(sourceDir)) {
  fail(`Missing source directory: ${sourceDir}`);
}

if (!fs.existsSync(appDir)) {
  fail(`Missing app directory: ${appDir}`);
}

// Verify required frontend files before processing the database.
const requiredFiles = ["index.html", "styles.css", "app.js"];

for (const name of requiredFiles) {
  const filePath = path.join(appDir, name);

  if (!fs.existsSync(filePath)) {
    fail(`Missing required frontend file: app/${name}`);
  }

  if (!fs.statSync(filePath).isFile()) {
    fail(`Expected a file at app/${name}`);
  }
}

log("Frontend files verified.");

// Collect JSON file paths recursively.
function walk(dir, result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, result);
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".json")
    ) {
      result.push(fullPath);
    }
  }

  return result;
}

log("Scanning smartphone JSON files...");

const files = walk(sourceDir);

log(`Found ${files.length} JSON files.`);

if (files.length === 0) {
  fail("No JSON files found inside data/smartphone.");
}

// Recreate the output directory.
fs.rmSync(distDir, { recursive: true, force: true });

fs.mkdirSync(path.join(distDir, "data"), {
  recursive: true
});

log("Output directory prepared.");

const phones = [];
let skipped = 0;
let processed = 0;

for (const file of files) {
  processed++;

  try {
    const raw = fs.readFileSync(file, "utf8");
    const record = JSON.parse(raw);

    if (
      !record ||
      typeof record !== "object" ||
      Array.isArray(record)
    ) {
      skipped++;
      continue;
    }

    const relativePath = path.relative(sourceDir, file);
    const firstFolder = relativePath.split(path.sep)[0];

    const brand = String(
      record.brand || firstFolder || ""
    ).trim();

    const name = String(
      record.name || record.slug || ""
    ).trim();

    if (!name) {
      skipped++;
      continue;
    }

    const slug = String(record.slug || name).trim();

    const id = `${brand}-${slug}`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    phones.push({
      id,
      brand,
      name,
      slug: record.slug || "",
      release_date: record.release_date ?? null,
      msrp_usd: record.msrp_usd ?? null,
      soc: record.soc ?? null,
      ram_gb: record.ram_gb ?? null,

      storage_options_gb: Array.isArray(
        record.storage_options_gb
      )
        ? record.storage_options_gb
        : [],

      display: record.display ?? {},

      cameras: Array.isArray(record.cameras)
        ? record.cameras
        : [],

      battery_mah: record.battery_mah ?? null,
      charging_wired_w: record.charging_wired_w ?? null,
      charging_wireless_w: record.charging_wireless_w ?? null,
      weight_g: record.weight_g ?? null,
      dimensions: record.dimensions ?? {},
      ip_rating: record.ip_rating ?? null,
      os: record.os ?? null,
      os_version: record.os_version ?? null,
      connectivity: record.connectivity ?? {},
      image_url: record.image_url ?? null,

      source_urls: Array.isArray(record.source_urls)
        ? record.source_urls
        : []
    });
  } catch (error) {
    skipped++;

    console.warn(
      `Skipping invalid file: ${path.relative(root, file)}`
    );
  }

  if (processed % 500 === 0 || processed === files.length) {
    log(`Processed ${processed}/${files.length} files.`);
  }
}

log(`Valid phone records: ${phones.length}`);
log(`Skipped records: ${skipped}`);

phones.sort((a, b) =>
  `${a.brand} ${a.name}`.localeCompare(
    `${b.brand} ${b.name}`
  )
);

// Write compact JSON to reduce output size.
const databasePath = path.join(
  distDir,
  "data",
  "phones.json"
);

fs.writeFileSync(
  databasePath,
  JSON.stringify(phones),
  "utf8"
);

log("Generated dist/data/phones.json.");

// Copy frontend files.
for (const name of requiredFiles) {
  const source = path.join(appDir, name);
  const destination = path.join(distDir, name);

  fs.copyFileSync(source, destination);

  log(`Copied app/${name} -> dist/${name}`);
}

// Cloudflare Pages response headers.
const headers = `/data/*
  Cache-Control: public, max-age=3600
  X-Content-Type-Options: nosniff

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`;

fs.writeFileSync(
  path.join(distDir, "_headers"),
  headers,
  "utf8"
);

// Verify generated files.
const outputFiles = [
  path.join(distDir, "index.html"),
  path.join(distDir, "styles.css"),
  path.join(distDir, "app.js"),
  databasePath,
  path.join(distDir, "_headers")
];

for (const file of outputFiles) {
  if (!fs.existsSync(file)) {
    fail(`Expected output was not generated: ${file}`);
  }
}

const databaseSizeMB = (
  fs.statSync(databasePath).size /
  (1024 * 1024)
).toFixed(2);

log(`Database size: ${databaseSizeMB} MB`);
log(`Build completed in ${((performance.now() - startedAt) / 1000).toFixed(1)} seconds.`);
console.log(`SUCCESS: Built ${phones.length} phone records; skipped ${skipped}.`);
