import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const parseCsv = (text) => {
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const keys = header.split(",");
  return rows.map((row) => Object.fromEntries(row.split(",").map((value, index) => [keys[index], value])));
};
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

const observations = parseCsv(await readFile(path.join(root, "data/price-observations.csv"), "utf8"))
  .map((row) => ({ ...row, price: Number(row.price) }));
const history = parseCsv(await readFile(path.join(root, "data/price-history.csv"), "utf8"))
  .map((row) => ({ ...row, used_sale_price: Number(row.used_sale_price), buyback_price: Number(row.buyback_price) }));
const byGame = observations.reduce((groups, row) => {
  (groups[row.game_id] ||= []).push(row);
  return groups;
}, {});
const previousByGame = history.reduce((latest, row) => {
  if (!latest[row.game_id] || latest[row.game_id].month < row.month) latest[row.game_id] = row;
  return latest;
}, {});

const summaries = Object.entries(byGame).map(([gameId, rows]) => {
  const checkedAt = rows.map((row) => row.observed_at).sort().at(-1);
  const currentRows = rows.filter((row) => row.observed_at === checkedAt && row.price_type === "sale");
  const prices = currentRows.map((row) => row.price);
  const currentMedian = median(prices);
  const previous = previousByGame[gameId];
  const difference = previous ? currentMedian - previous.used_sale_price : null;
  const differenceRate = previous ? Math.round((difference / previous.used_sale_price) * 1000) / 10 : null;
  const buybackRate = previous?.buyback_price ? Math.round((previous.buyback_price / currentMedian) * 100) : null;
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
    checked_at: checkedAt,
    edition: currentRows[0].edition,
    condition: currentRows[0].condition,
    sale: {
      median: currentMedian,
      min: Math.min(...prices),
      max: Math.max(...prices),
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
    sellers: currentRows.map(({ seller_name, price, source_name, source_url }) => ({ seller_name, price, source_name, source_url }))
  };
}).sort((a, b) => a.game_id.localeCompare(b.game_id));

await writeFile(path.join(root, "data/market-summary.json"), JSON.stringify({
  generated_from: "data/price-observations.csv",
  methodology: "same-condition seller observations; median of selected listings",
  items: summaries
}, null, 2) + "\n");
console.log(`Market data complete: ${summaries.length} games, ${observations.length} observations`);
