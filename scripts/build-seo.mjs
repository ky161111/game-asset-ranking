import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const baseUrl = "https://ky161111.github.io/game-asset-ranking/";
const managedHead = /(?:\n\s*)?<!-- seo-managed:start -->[\s\S]*?<!-- seo-managed:end -->(?:\n\s*)?/;
const managedFooter = /\s*<!-- trust-links:start -->[\s\S]*?<!-- trust-links:end -->\s*/;
const managedPolicy = /(?:\n\s*)?<!-- data-policy:start -->[\s\S]*?<!-- data-policy:end -->(?:\n\s*)?/;
const managedMarket = /(?:\n\s*)?<!-- market-insight:start -->[\s\S]*?<!-- market-insight:end -->(?:\n\s*)?/;
const managedAnalyticsGuard = /(?:\n\s*)?<!-- analytics-guard:start -->[\s\S]*?<!-- analytics-guard:end -->(?:\n\s*)?/;

const csvRows = (text) => {
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const keys = header.split(",");
  return rows.map((row) => Object.fromEntries(row.split(",").map((value, index) => [keys[index], value])));
};

const catalog = csvRows(await readFile(path.join(root, "data/game-catalog.csv"), "utf8"));
const history = csvRows(await readFile(path.join(root, "data/price-history.csv"), "utf8"));
const observations = csvRows(await readFile(path.join(root, "data/price-observations.csv"), "utf8"));
const hardwareObservations = csvRows(await readFile(path.join(root, "data/hardware-observations.csv"), "utf8"));
const today = [...observations, ...hardwareObservations].map((row) => row.observed_at).sort().at(-1);
const games = new Map(catalog.map((game) => [game.game_id, game]));
const marketGameIds = new Set(observations.map((row) => row.game_id));
const observationsByGame = observations.reduce((groups, row) => {
  (groups[row.game_id] ||= []).push(row);
  return groups;
}, {});
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
const japaneseDate = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
};

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
  } else if (["pages/hardware/new3dsll-metallic-blue.html", "pages/hardware/ps2-90000-charcoal.html", "pages/hardware/gba-sp-pearl-blue.html"].includes(relative)) {
    items.push({ name: "レトロゲーム本体の中古相場", url: new URL("pages/retro-hardware.html", baseUrl).href });
  } else if (relative.startsWith("pages/hardware/")) {
    items.push({ name: "ゲーム機本体の中古相場", url: new URL("pages/hardware.html", baseUrl).href });
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
  html = html.replace(managedHead, "\n").replace(managedFooter, "\n").replace(managedPolicy, "\n").replace(managedMarket, "\n").replace(managedAnalyticsGuard, "\n");

  const analyticsGuard = `
  <!-- analytics-guard:start -->
  <script>
    (function () {
      try {
        var params = new URLSearchParams(location.search);
        var key = "gameAssetAnalyticsOptOut";
        if (params.get("analytics") === "off") localStorage.setItem(key, "1");
        if (params.get("analytics") === "on") localStorage.removeItem(key);
        if (localStorage.getItem(key) === "1") {
          window["ga-disable-G-YEM0Q8ZTXC"] = true;
          window.__gameAssetAnalyticsOptOut = true;
        }
      } catch (error) {}
    }());
  </script>
  <!-- analytics-guard:end -->`;
  html = html.replace(/<head>/i, `<head>${analyticsGuard}`);

  const id = path.basename(file, ".html");
  const game = games.get(id);
  const depth = relative.split("/").length - 1;
  const prefix = depth ? "../".repeat(depth) : "";
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
  if (marketGameIds.has(id) || relative === "index.html") {
    headParts.push(`<link rel="stylesheet" href="${prefix}assets/market-insights.css">`);
    headParts.push(`<script defer src="${prefix}assets/market-insights.js"></script>`);
  }
  if (!redirect) headParts.push(`<script defer src="${prefix}assets/analytics.js"></script>`);
  if (relative !== "index.html" && !redirect) {
    headParts.push(`<script type="application/ld+json">\n${breadcrumbJson(breadcrumbs(relative, html, game))}\n</script>`);
  }
  if (headParts.length) {
    const block = `\n  <!-- seo-managed:start -->\n  ${headParts.join("\n  ")}\n  <!-- seo-managed:end -->`;
    html = html.replace(/<\/head>/i, `${block}\n</head>`);
  }

  const trustLinks = `  <!-- trust-links:start -->\n  <p class="trust-links"><a href="${prefix}pages/methodology.html">価格の調べ方</a> · <a href="${prefix}pages/about.html">このサイトについて</a> · <a href="${prefix}pages/disclaimer.html">免責・広告表記</a></p>\n  <!-- trust-links:end -->`;
  html = html.replace(/<\/footer>/i, `${trustLinks}\n</footer>`);

  if (marketGameIds.has(id)) {
    const marketBlock = `\n    <!-- market-insight:start -->\n    <section class="panel" data-market-insight-game="${id}"><h2>現在価格を読み込んでいます</h2><p class="note">3店舗の確認価格を集計しています。</p></section>\n    <!-- market-insight:end -->\n`;
    html = html.replace(/(<section class="panel" data-price-history-game=)/i, `${marketBlock}$1`);
  }

  if (game?.status === "tracking") {
    const latest = latestByGame.get(game.game_id);
    const marketRows = observationsByGame[game.game_id] || [];
    const latestMarketRow = marketRows.sort((a, b) => a.observed_at.localeCompare(b.observed_at)).at(-1);
    const checkedLabel = latestMarketRow ? japaneseDate(latestMarketRow.observed_at) : latest?.month ? latest.month.replace("-", "年") + "月" : "記録開始月";
    const sourceLabel = marketRows.length ? `${marketRows.length}店舗の中古通常版` : `${latest?.source_name || "公開価格情報"}の単一価格`;
    const policy = `\n  <!-- data-policy:start -->\n  <section class="panel data-policy" aria-labelledby="data-policy-title"><h2 id="data-policy-title">この価格データについて</h2><p>${checkedLabel}に確認した${sourceLabel}を記録しています。商品の状態、送料、店舗、在庫により実際の価格は変わります。</p><p><a class="text-link" href="${prefix}pages/methodology.html">価格の調査条件と更新方法を見る</a></p></section>\n  <!-- data-policy:end -->`;
    html = html.replace(/<\/main>/i, `${policy}\n</main>`);
  }

  await writeFile(file, html);
  if (!pending && !redirect) sitemapUrls.push(pageUrl(relative));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(root, "sitemap.xml"), sitemap);
await writeFile(path.join(root, ".nojekyll"), "");

console.log(`SEO build complete: ${files.length} HTML files, ${sitemapUrls.length} indexable URLs`);
