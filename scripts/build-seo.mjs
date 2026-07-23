import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const baseUrl = "https://ky161111.github.io/game-asset-ranking/";
const today = new Date().toISOString().slice(0, 10);
const managedHead = /(?:\n\s*)?<!-- seo-managed:start -->[\s\S]*?<!-- seo-managed:end -->(?:\n\s*)?/;
const managedFooter = /(?:\n\s*)?<!-- trust-links:start -->[\s\S]*?<!-- trust-links:end -->(?:\n\s*)?/;
const managedPolicy = /(?:\n\s*)?<!-- data-policy:start -->[\s\S]*?<!-- data-policy:end -->(?:\n\s*)?/;

const csvRows = (text) => {
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const keys = header.split(",");
  return rows.map((row) => Object.fromEntries(row.split(",").map((value, index) => [keys[index], value])));
};

const catalog = csvRows(await readFile(path.join(root, "data/game-catalog.csv"), "utf8"));
const history = csvRows(await readFile(path.join(root, "data/price-history.csv"), "utf8"));
const games = new Map(catalog.map((game) => [game.game_id, game]));
const latestByGame = new Map();
for (const row of history) {
  if (!latestByGame.has(row.game_id) || latestByGame.get(row.game_id).month < row.month) {
    latestByGame.set(row.game_id, row);
  }
}

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

const escapeAttr = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const extract = (html, expression) => html.match(expression)?.[1]?.trim() || "";
const pageUrl = (relative) => relative === "index.html" ? baseUrl : new URL(relative, baseUrl).href;
const pageTitle = (html) => extract(html, /<title>([\s\S]*?)<\/title>/i).replace(/\s*\|\s*ゲーム売買相場ナビ\s*$/, "");
const platformLabel = { switch: "Nintendo Switch", ps5: "PS5", ps4: "PS4" };

function descriptionFor(relative, html, game) {
  if (game) {
    const platform = platformLabel[game.platform] || game.platform;
    if (game.status === "tracking") {
      return `${game.title}（${platform}）の中古販売価格、買取価格、価格推移と買取率を掲載。買い時・売り時の判断に使える確認日・出典付きの参考相場です。`;
    }
    return `${game.title}（${platform}）通常版の中古販売価格と買取価格を記録する準備ページです。価格確認後に相場と出典を公開します。`;
  }
  const title = pageTitle(html);
  return `${title}について、ゲームの中古販売価格・買取価格・価格推移を確認できるゲーム売買相場ナビのページです。`;
}

function breadcrumbs(relative, html, game) {
  const items = [{ name: "ゲーム売買相場ナビ", url: baseUrl }];
  if (relative === "index.html") return items;
  if (game) {
    const platformPage = game.platform === "switch" ? "pages/price-history.html" : `pages/${game.platform}.html`;
    items.push({ name: platformLabel[game.platform], url: new URL(platformPage, baseUrl).href });
  } else if (relative.startsWith("pages/articles/")) {
    items.push({ name: "相場の読み方", url: new URL("pages/articles/value-retention.html", baseUrl).href });
  }
  items.push({ name: pageTitle(html), url: pageUrl(relative) });
  return items;
}

function breadcrumbJson(items) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  }, null, 2);
}

const files = (await htmlFiles(root)).sort();
const sitemapUrls = [];
for (const file of files) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  let html = await readFile(file, "utf8");
  html = html.replace(managedHead, "\n").replace(managedFooter, "\n").replace(managedPolicy, "\n");

  const id = path.basename(file, ".html");
  const game = games.get(id);
  const pending = game?.status === "pending" || relative === "pages/ps4.html" || relative === "pages/ps5.html";
  const redirect = /<meta[^>]+http-equiv=["']refresh["']/i.test(html);
  const hasDescription = /<meta\s+name=["']description["']/i.test(html);
  const hasCanonical = /<link\s+rel=["']canonical["']/i.test(html);
  const headParts = [];
  if (!hasDescription) {
    headParts.push(`<meta name="description" content="${escapeAttr(descriptionFor(relative, html, game))}">`);
  }
  if (!hasCanonical) {
    headParts.push(`<link rel="canonical" href="${pageUrl(relative)}">`);
  }
  if (pending) headParts.push('<meta name="robots" content="noindex,follow">');
  if (relative !== "index.html" && !redirect) {
    headParts.push(`<script type="application/ld+json">\n${breadcrumbJson(breadcrumbs(relative, html, game))}\n</script>`);
  }
  if (headParts.length) {
    const block = `\n  <!-- seo-managed:start -->\n  ${headParts.join("\n  ")}\n  <!-- seo-managed:end -->`;
    html = html.replace(/<\/head>/i, `${block}\n</head>`);
  }

  const depth = relative.split("/").length - 1;
  const prefix = depth ? "../".repeat(depth) : "";
  const trustLinks = `\n  <!-- trust-links:start -->\n  <p class="trust-links"><a href="${prefix}pages/methodology.html">価格の調べ方</a> · <a href="${prefix}pages/about.html">このサイトについて</a> · <a href="${prefix}pages/disclaimer.html">免責・広告表記</a></p>\n  <!-- trust-links:end -->`;
  html = html.replace(/<\/footer>/i, `${trustLinks}\n</footer>`);

  if (game?.status === "tracking") {
    const latest = latestByGame.get(game.game_id);
    const checkedMonth = latest?.month ? latest.month.replace("-", "年") + "月" : "記録開始月";
    const policy = `\n  <!-- data-policy:start -->\n  <section class="panel data-policy" aria-labelledby="data-policy-title"><h2 id="data-policy-title">この価格データについて</h2><p>${checkedMonth}に、${latest?.source_name || "公開価格情報"}で確認した${platformLabel[game.platform]}パッケージ通常版の参考価格です。商品の状態、送料、店舗、在庫により実際の価格は変わります。</p><p><a class="text-link" href="${prefix}pages/methodology.html">価格の調査条件と更新方法を見る</a></p></section>\n  <!-- data-policy:end -->`;
    html = html.replace(/<\/main>/i, `${policy}\n</main>`);
  }

  await writeFile(file, html);
  if (!pending && !redirect) sitemapUrls.push(pageUrl(relative));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(root, "sitemap.xml"), sitemap);
await writeFile(path.join(root, ".nojekyll"), "");

console.log(`SEO build complete: ${files.length} HTML files, ${sitemapUrls.length} indexable URLs`);
