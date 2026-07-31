import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const errors = [];

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(full));
    else if (entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

for (const file of await htmlFiles(root)) {
  const relative = path.relative(root, file);
  const html = await readFile(file, "utf8");
  const redirect = /<meta[^>]+http-equiv=["']refresh["']/i.test(html);
  const noindex = /<meta\s+name=["']robots["'][^>]+noindex/i.test(html);
  if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${relative}: title missing`);
  if (!redirect && !/<meta\s+name=["']description["'][^>]+content=["'][^"']+/i.test(html)) errors.push(`${relative}: description missing`);
  if (!/<link\s+rel=["']canonical["'][^>]+href=["']https:\/\//i.test(html)) errors.push(`${relative}: canonical missing`);
  if (/pages[\\/]games[\\/](ps4|ps5)-\d+\.html$/.test(relative) && !noindex) errors.push(`${relative}: pending page must be noindex`);
  if (/pages[\\/](ps4|ps5)\.html$/.test(relative) && !noindex) errors.push(`${relative}: pending platform page must be noindex`);
  if (/pages[\\/]games[\\/]game-\d+\.html$/.test(relative) && noindex) errors.push(`${relative}: tracking page must be indexable`);
  if (/pages[\\/]games[\\/]game-00[1-9]\.html$|pages[\\/]games[\\/]game-010\.html$/.test(relative)) {
    if (!/data-market-insight-game=/.test(html)) errors.push(`${relative}: market insight host missing`);
    if (!/market-insights\.js/.test(html) || !/market-insights\.css/.test(html)) errors.push(`${relative}: market insight assets missing`);
  }
  for (const match of html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(match[1]); } catch (error) { errors.push(`${relative}: invalid JSON-LD (${error.message})`); }
  }
  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"']+)["']/gi)) {
    const href = match[1];
    if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) continue;
    const target = path.resolve(path.dirname(file), decodeURIComponent(href.split(/[?#]/)[0]));
    try { await access(target); } catch { errors.push(`${relative}: broken internal link ${href}`); }
  }
}

const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
for (const forbidden of ["pages/games/ps4-", "pages/games/ps5-", "pages/ps4.html", "pages/ps5.html", "pages/switch.html"]) {
  if (sitemap.includes(forbidden)) errors.push(`sitemap.xml: contains excluded URL ${forbidden}`);
}
for (const required of ["pages/methodology.html", "pages/about.html", "pages/market-watch.html", "pages/hardware.html", "pages/hardware-compare.html", "pages/retro-hardware.html", "pages/hardware/switch2-japanese.html", "pages/hardware/switch-oled-white.html", "pages/hardware/ps5-slim-disc.html", "pages/hardware/new3dsll-metallic-blue.html", "pages/hardware/ps2-90000-charcoal.html", "pages/hardware/gba-sp-pearl-blue.html", "pages/games/game-001.html"]) {
  if (!sitemap.includes(required)) errors.push(`sitemap.xml: missing ${required}`);
}

const comparePage = await readFile(path.join(root, "pages/hardware-compare.html"), "utf8");
if (!/data-hardware-table/.test(comparePage) || !/data-hardware-search/.test(comparePage)) errors.push("pages/hardware-compare.html: comparison controls missing");

const marketSummary = JSON.parse(await readFile(path.join(root, "data/market-summary.json"), "utf8"));
if (marketSummary.items.length !== 10) errors.push(`market-summary.json: expected 10 games, got ${marketSummary.items.length}`);
for (const item of marketSummary.items) {
  if (item.sale.observation_count !== 3) errors.push(`market-summary.json: ${item.game_id} must have 3 observations`);
  if (!item.sale.min || !item.sale.max || !item.sale.median) errors.push(`market-summary.json: ${item.game_id} has invalid prices`);
  if (new Set(item.sellers.map((seller) => seller.seller_name)).size !== 3) errors.push(`market-summary.json: ${item.game_id} must have 3 distinct sellers`);
  if (item.sellers.some((seller) => !seller.source_url.startsWith("https://"))) errors.push(`market-summary.json: ${item.game_id} has invalid source URL`);
}

const hardwareSummary = JSON.parse(await readFile(path.join(root, "data/hardware-summary.json"), "utf8"));
if (hardwareSummary.items.length !== 6) errors.push(`hardware-summary.json: expected 6 models, got ${hardwareSummary.items.length}`);
for (const item of hardwareSummary.items) {
  if (item.sale.observation_count < 1) errors.push(`hardware-summary.json: ${item.hardware_id} has no observations`);
  if (!item.sale.min || !item.sale.max || !item.sale.median || !item.official_price) errors.push(`hardware-summary.json: ${item.hardware_id} has invalid prices`);
  if (new Set(item.sellers.map((seller) => seller.seller_name)).size !== item.sale.observation_count) errors.push(`hardware-summary.json: ${item.hardware_id} has duplicate sellers`);
  if (item.sellers.some((seller) => !seller.source_url.startsWith("https://"))) errors.push(`hardware-summary.json: ${item.hardware_id} has invalid source URL`);
  if (item.sale.observation_count < 3 && item.evidence.key !== "limited") errors.push(`hardware-summary.json: ${item.hardware_id} must disclose limited evidence`);
  if (!["modern", "retro"].includes(item.era)) errors.push(`hardware-summary.json: ${item.hardware_id} has invalid era`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Site validation passed");
