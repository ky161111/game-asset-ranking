(() => {
  const money = (value) => `¥${Number(value).toLocaleString("ja-JP")}`;
  const date = (value) => {
    const [year, month, day] = value.split("-");
    return `${year}年${Number(month)}月${Number(day)}日`;
  };
  const depth = location.pathname.includes("/pages/hardware/") ? "../../" : "../";
  const detailHref = (item) => location.pathname.includes("/pages/hardware/")
    ? `${item.slug}.html`
    : `hardware/${item.slug}.html`;

  fetch(`${depth}data/hardware-summary.json`)
    .then((response) => {
      if (!response.ok) throw new Error("hardware data unavailable");
      return response.json();
    })
    .then(({ items }) => {
      const grid = document.querySelector("[data-hardware-grid]");
      if (grid) {
        grid.innerHTML = items.map((item) => `
          <article class="hardware-card">
            <span class="evidence ${item.evidence.key}">${item.evidence.label}</span>
            <h2>${item.title}</h2>
            <p class="model">${item.model_number}｜${item.platform}</p>
            <p class="hardware-price">${money(item.sale.median)} <small>確認中央値</small></p>
            <div class="hardware-metrics">
              <div class="hardware-metric"><span>公式価格比</span><strong>${item.value_retention_rate}%</strong></div>
              <div class="hardware-metric"><span>公式価格との差</span><strong>${item.saving_vs_official >= 0 ? "−" : "+"}${money(Math.abs(item.saving_vs_official))}</strong></div>
            </div>
            <p class="note">${date(item.checked_at)}確認・${item.sale.observation_count}件。${item.evidence.note}</p>
            <p class="actions"><a class="button" href="${detailHref(item)}">型番別の価格を見る</a></p>
          </article>`).join("");
      }

      const host = document.querySelector("[data-hardware-id]");
      if (!host) return;
      const item = items.find((candidate) => candidate.hardware_id === host.dataset.hardwareId);
      if (!item) throw new Error("hardware model not found");
      document.querySelectorAll("[data-hardware-title]").forEach((node) => { node.textContent = item.title; });
      host.innerHTML = `
        <section class="panel">
          <span class="evidence ${item.evidence.key}">${item.evidence.label}</span>
          <h2>中古販売価格</h2>
          <div class="detail-price-grid">
            <div class="hardware-metric"><span>確認中央値</span><strong>${money(item.sale.median)}</strong></div>
            <div class="hardware-metric"><span>確認範囲</span><strong>${item.sale.min === item.sale.max ? money(item.sale.min) : `${money(item.sale.min)}〜${money(item.sale.max)}`}</strong></div>
            <div class="hardware-metric"><span>${item.official_price_label}</span><strong>${money(item.official_price)}</strong></div>
            <div class="hardware-metric"><span>公式価格比</span><strong>${item.value_retention_rate}%</strong></div>
          </div>
          <p class="hardware-note">${date(item.checked_at)}に${item.sale.observation_count}件を確認。${item.condition_scope}だけを集計し、欠品・状態難・ランクBは除外しています。</p>
        </section>
        <section class="panel">
          <h2>確認した販売価格</h2>
          <ul class="source-list">${item.sellers.map((seller) => `
            <li><span>${seller.seller_name}<small>${seller.condition}｜${seller.note}</small></span><span><strong>${money(seller.price)}</strong><small><a href="${seller.source_url}" target="_blank" rel="nofollow noopener">出典</a></small></span></li>`).join("")}</ul>
          <p class="note">同じ取扱店舗一覧内の販売者を比較しています。独立した複数サービスの横断比較ではありません。</p>
        </section>
        <section class="panel">
          <h2>型番と公式価格</h2>
          <dl class="kv">
            <dt>型番</dt><dd>${item.model_number}</dd>
            <dt>発売日</dt><dd>${date(item.release_date)}</dd>
            <dt>価格の基準</dt><dd>${item.official_price_label} ${money(item.official_price)}</dd>
            <dt>公式情報</dt><dd><a href="${item.official_source_url}" target="_blank" rel="noopener">メーカーのページで確認</a></dd>
          </dl>
        </section>`;
    })
    .catch(() => {
      document.querySelectorAll("[data-hardware-grid],[data-hardware-id]").forEach((node) => {
        node.innerHTML = '<p class="panel">価格データを読み込めませんでした。時間をおいて再度お試しください。</p>';
      });
    });
})();
