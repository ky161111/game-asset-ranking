import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const parseCsvLine = (line) => {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
};

const parseCsv = (text) => {
  const [header, ...rows] = text.trim().split(/\r?\n/).filter(Boolean);
  const keys = parseCsvLine(header);
  return rows.map((row) => Object.fromEntries(parseCsvLine(row).map((value, index) => [keys[index], value])));
};

const numberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

const percentChange = (current, previous) => {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

const monthLabel = (month) => month.replace("-", "年") + "月";
const dateLabel = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
};

const observations = parseCsv(await readFile(path.join(root, "data/price-observations.csv"), "utf8"))
  .map((row) => ({ ...row, price: Number(row.price) }))
  .filter((row) => Number.isFinite(row.price) && row.price > 0);
const history = parseCsv(await readFile(path.join(root, "data/price-history.csv"), "utf8"))
  .map((row) => ({
    ...row,
    used_sale_price: numberOrNull(row.used_sale_price),
    buyback_price: numberOrNull(row.buyback_price)
  }));

const observationsByGame = observations.reduce((groups, row) => {
  (groups[row.game_id] ||= []).push(row);
  return groups;
}, {});
const historyByGame = history.reduce((groups, row) => {
  (groups[row.game_id] ||= []).push(row);
  return groups;
}, {});
const gameIds = [...new Set([...history, ...observations].map((row) => row.game_id))].sort();
const previousByGame = history.reduce((latest, row) => {
  if (!latest[row.game_id] || latest[row.game_id].month < row.month) latest[row.game_id] = row;
  return latest;
}, {});

const latestMarketDate = observations.map((row) => row.observed_at).sort().at(-1) || null;

const currentSnapshot = (gameId) => {
  const rows = observationsByGame[gameId] || [];
  const checkedAt = rows.map((row) => row.observed_at).sort().at(-1);
  if (!checkedAt) return null;
  const currentRows = rows.filter((row) => row.observed_at === checkedAt && row.price_type === "sale");
  if (!currentRows.length) return null;
  const prices = currentRows.map((row) => row.price);
  return {
    checkedAt,
    rows: currentRows,
    median: median(prices),
    min: Math.min(...prices),
    max: Math.max(...prices),
    sellers: [...new Set(currentRows.map((row) => row.seller_name))]
  };
};

const trendPoints = (gameId) => {
  const monthly = (historyByGame[gameId] || []).map((row) => ({
    period: row.month,
    label: monthLabel(row.month),
    observed_at: `${row.month}-01`,
    used_sale_price: row.used_sale_price,
    buyback_price: row.buyback_price,
    source_name: row.source_name,
    source_url: row.source_url,
    note: row.note,
    source_type: "monthly"
  }));
  const snapshot = currentSnapshot(gameId);
  if (snapshot) {
    const first = snapshot.rows[0];
    monthly.push({
      period: snapshot.checkedAt,
      label: dateLabel(snapshot.checkedAt),
      observed_at: snapshot.checkedAt,
      used_sale_price: snapshot.median,
      buyback_price: null,
      source_name: `${snapshot.sellers.length}店舗の確認中央値`,
      source_url: first.source_url,
      note: "同じ版・状態の中古販売価格を複数店舗で確認した中央値",
      source_type: "multi_store"
    });
  }
  return monthly.sort((a, b) => a.observed_at.localeCompare(b.observed_at));
};

const trendItems = gameIds.map((gameId) => {
  const points = trendPoints(gameId);
  const salePoints = points.filter((point) => Number.isFinite(point.used_sale_price));
  const buybackPoints = points.filter((point) => Number.isFinite(point.buyback_price));
  const current = salePoints.at(-1) || null;
  const previous = salePoints.at(-2) || null;
  const latestBuyback = buybackPoints.at(-1) || null;
  return {
    game_id: gameId,
    title: points[0]?.title || historyByGame[gameId]?.[0]?.title || observationsByGame[gameId]?.[0]?.title || gameId,
    platform: historyByGame[gameId]?.[0]?.platform || observationsByGame[gameId]?.[0]?.platform || "",
    points,
    latest: current ? {
      period: current.period,
      label: current.label,
      used_sale_price: current.used_sale_price,
      buyback_price: latestBuyback?.buyback_price ?? null,
      buyback_period: latestBuyback?.period ?? null,
      source_name: current.source_name,
      source_url: current.source_url,
      source_type: current.source_type
    } : null,
    sale_point_count: salePoints.length,
    buyback_point_count: buybackPoints.length,
    sale_change: current && previous ? current.used_sale_price - previous.used_sale_price : null,
    sale_change_rate: current && previous ? percentChange(current.used_sale_price, previous.used_sale_price) : null,
    data_status: current?.source_type === "multi_store" ? "current_snapshot" : "history_only"
  };
});

const summaries = gameIds
  .map((gameId) => {
    const snapshot = currentSnapshot(gameId);
    if (!snapshot) return null;
    const currentRows = snapshot.rows;
    const previous = previousByGame[gameId];
    const difference = previous ? snapshot.median - previous.used_sale_price : null;
    const differenceRate = percentChange(snapshot.median, previous?.used_sale_price);
    const buybackRate = previous?.buyback_price ? Math.round((previous.buyback_price / snapshot.median) * 100) : null;
    let verdict = { key: "watch", label: "様子見", reason: "同じ調査方法の価格履歴を蓄積中です。" };
    if (differenceRate !== null && differenceRate <= -10) {
      verdict = { key: "buy", label: "買い時候補", reason: "前回の単一価格より確認中央値が10%以上低い状態です。" };
    } else if (differenceRate !== null && differenceRate >= 10) {
      verdict = { key: "sell", label: "売り時候補", reason: "前回の単一価格より確認中央値が10%以上高い状態です。" };
    } else if (buybackRate !== null && buybackRate >= 70) {
      verdict = { key: "hold", label: "価格維持型", reason: "前回確認の買取価格が現在の確認中央値の70%以上です。" };
    }
    return {
      game_id: gameId,
      platform: currentRows[0].platform,
      title: currentRows[0].title,
      checked_at: snapshot.checkedAt,
      edition: currentRows[0].edition,
      condition: currentRows[0].condition,
      sale: {
        median: snapshot.median,
        min: snapshot.min,
        max: snapshot.max,
        observation_count: currentRows.length
      },
      previous: previous ? {
        month: previous.month,
        sale_price: previous.used_sale_price,
        buyback_price: previous.buyback_price,
        source_name: previous.source_name,
        source_url: previous.source_url
      } : null,
      reference_difference: difference,
      reference_difference_rate: differenceRate,
      buyback_rate: buybackRate,
      verdict,
      data_quality: {
        distinct_sellers: snapshot.sellers.length,
        same_condition: true,
        current_snapshot: true
      },
      sellers: currentRows.map(({ seller_name, price, source_name, source_url }) => ({ seller_name, price, source_name, source_url }))
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.game_id.localeCompare(b.game_id));

await writeFile(path.join(root, "data/price-trends.json"), JSON.stringify({
  generated_from: ["data/price-history.csv", "data/price-observations.csv"],
  methodology: "monthly history plus the latest same-condition multi-store sale snapshot when available",
  latest_market_observation: latestMarketDate,
  items: trendItems
}, null, 2) + "\n");

await writeFile(path.join(root, "data/market-summary.json"), JSON.stringify({
  generated_from: "data/price-observations.csv",
  methodology: "same-condition seller observations; median of selected listings",
  latest_market_observation: latestMarketDate,
  items: summaries
}, null, 2) + "\n");

console.log(`Market data complete: ${summaries.length} current games, ${trendItems.length} trend items, ${observations.length} observations`);
