(() => {
  const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
  const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const dateLabel = (date) => {
    const [year, month, day] = date.split("-").map(Number);
    return `${year}年${month}月${day}日`;
  };
  const monthLabel = (month) => month.replace("-", "年") + "月";
  const pathPrefix = location.pathname.includes("/pages/games/") ? "../../" : location.pathname.includes("/pages/") ? "../" : "";
  const dataPath = `${pathPrefix}data/market-summary.json`;
  const gameHref = (id) => `${pathPrefix}pages/games/${id}.html`;
  const delta = (item) => {
    if (item.reference_difference === null) return "蓄積中";
    const sign = item.reference_difference >= 0 ? "+" : "";
    return `${sign}${yen.format(item.reference_difference)}（${sign}${item.reference_difference_rate}%）`;
  };
  const renderDetail = (host, item) => {
    const sourceItems = item.sellers.map((source) => `<li>${escape(source.seller_name)}：<strong>${yen.format(source.price)}</strong></li>`).join("");
    host.innerHTML = `<h2>${escape(item.title)}の現在価格</h2>
      <p><span class="market-verdict ${item.verdict.key}">${escape(item.verdict.label)}</span> ${escape(item.verdict.reason)}</p>
      <div class="market-summary">
        <div><span>確認価格の中央値</span><strong>${yen.format(item.sale.median)}</strong></div>
        <div><span>確認範囲</span><strong>${yen.format(item.sale.min)}〜${yen.format(item.sale.max)}</strong></div>
        <div><span>前回記録との参考差</span><strong class="market-delta ${item.reference_difference >= 0 ? "up" : "down"}">${delta(item)}</strong></div>
        <div><span>前回買取率</span><strong>${item.buyback_rate === null ? "蓄積中" : `${item.buyback_rate}%`}</strong></div>
      </div>
      <p class="note">確認日：${dateLabel(item.checked_at)} ／ ${escape(item.edition)}・${escape(item.condition)} ／ 3か月・6か月変動は蓄積中</p>
      <details><summary>${item.sale.observation_count}店舗の確認価格と出典</summary><ul class="market-sources">${sourceItems}</ul><p class="note"><a class="text-link" href="${escape(item.sellers[0].source_url)}" target="_blank" rel="nofollow noopener">取扱店舗一覧で現在価格を確認</a></p></details>
      <p class="note">${item.previous ? `前回記録：${monthLabel(item.previous.month)} 中古販売 ${yen.format(item.previous.sale_price)} ／ 買取 ${yen.format(item.previous.buyback_price)}` : "前回記録なし"}。調査方法が異なるため、参考差は市場全体の騰落率を表すものではありません。</p>`;
  };
  const card = (item) => `<article class="card"><h2><a class="text-link" href="${gameHref(item.game_id)}">${escape(item.title)}</a></h2><p><span class="market-verdict ${item.verdict.key}">${escape(item.verdict.label)}</span></p><div class="market-summary"><div><span>中央値</span><strong>${yen.format(item.sale.median)}</strong></div><div><span>確認範囲</span><strong>${yen.format(item.sale.min)}〜${yen.format(item.sale.max)}</strong></div></div><p class="market-delta ${item.reference_difference >= 0 ? "up" : "down"}">前回記録との参考差：<strong>${delta(item)}</strong></p><p class="note">${dateLabel(item.checked_at)}・${item.sale.observation_count}店舗確認</p></article>`;
  fetch(dataPath).then((response) => {
    if (!response.ok) throw new Error("市場価格データを読み込めませんでした");
    return response.json();
  }).then(({ items }) => {
    const byId = Object.fromEntries(items.map((item) => [item.game_id, item]));
    document.querySelectorAll("[data-market-insight-game]").forEach((host) => {
      const item = byId[host.dataset.marketInsightGame];
      if (item) renderDetail(host, item);
    });
    const watch = document.getElementById("market-watch-app");
    if (watch) watch.innerHTML = `<div class="market-grid">${[...items].sort((a, b) => a.reference_difference_rate - b.reference_difference_rate).map(card).join("")}</div>`;
    const teaser = document.getElementById("market-watch-teaser");
    if (teaser) teaser.innerHTML = [...items].sort((a, b) => Math.abs(b.reference_difference_rate) - Math.abs(a.reference_difference_rate)).slice(0, 3).map(card).join("");
  }).catch((error) => {
    document.querySelectorAll("[data-market-insight-game], #market-watch-app, #market-watch-teaser").forEach((host) => {
      host.innerHTML = `<p class="note">${escape(error.message)}</p>`;
    });
  });
})();
