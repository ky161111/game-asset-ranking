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

const catalog = parseCsv(await readFile(path.join(root, "data/hardware-catalog.csv"), "utf8"))
  .map((row) => ({ ...row, official_price: Number(row.official_price) }));
const observations = parseCsv(await readFile(path.join(root, "data/hardware-observations.csv"), "utf8"))
  .map((row) => ({ ...row, price: Number(row.price) }));

const items = catalog.map((hardware) => {
  const rows = observations.filter((row) => row.hardware_id === hardware.hardware_id);
  const checkedAt = rows.map((row) => row.observed_at).sort().at(-1);
  const current = rows.filter((row) => row.observed_at === checkedAt);
  const prices = current.map((row) => row.price);
  const currentMedian = median(prices);
  const saving = hardware.official_price - currentMedian;
  const evidence = current.length >= 3
    ? { key: "standard", label: "参考度：標準", note: "同じ条件の3店舗価格を確認" }
    : { key: "limited", label: "参考度：低", note: `${current.length}件のみ確認。価格幅は未把握` };
  return {
    ...hardware,
    checked_at: checkedAt,
    sale: {
      median: currentMedian,
      min: Math.min(...prices),
      max: Math.max(...prices),
      observation_count: current.length
    },
    value_retention_rate: Math.round((currentMedian / hardware.official_price) * 100),
    saving_vs_official: saving,
    evidence,
    sellers: current.map(({ seller_name, price, condition, source_name, source_url, note }) => ({
      seller_name, price, condition, source_name, source_url, note
    }))
  };
});

await writeFile(path.join(root, "data/hardware-summary.json"), JSON.stringify({
  generated_from: ["data/hardware-catalog.csv", "data/hardware-observations.csv"],
  methodology: "same-model complete used listings; median of verified observations",
  items
}, null, 2) + "\n");

console.log(`Hardware data complete: ${items.length} models, ${observations.length} observations`);
