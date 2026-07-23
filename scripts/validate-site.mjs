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
for (const required of ["pages/methodology.html", "pages/about.html", "pages/games/game-001.html"]) {
  if (!sitemap.includes(required)) errors.push(`sitemap.xml: missing ${required}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Site validation passed");
