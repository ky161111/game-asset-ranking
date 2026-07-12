(() => {
  const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
  const parseCsv = (text) => {
    const [header, ...rows] = text.trim().split(/\r?\n/);
    const keys = header.split(",");
    return rows.map((row) => Object.fromEntries(row.split(",").map((value, index) => [keys[index], value]))).map((row) => ({
      ...row,
      used_sale_price: Number(row.used_sale_price),
      buyback_price: Number(row.buyback_price)
    }));
  };
  const monthLabel = (month) => month ? month.replace("-", "年") + "月" : "";
  const defaultPath = location.pathname.includes("/pages/games/") ? "../../data/price-history.csv"
    : location.pathname.includes("/pages/") ? "../data/price-history.csv"
      : "data/price-history.csv";
  const path = document.documentElement.dataset.priceHistoryPath || defaultPath;

  const byGame = (rows) => rows.reduce((groups, row) => {
    (groups[row.game_id] ||= []).push(row);
    return groups;
  }, {});
  const latest = (items) => [...items].sort((a, b) => a.month.localeCompare(b.month)).at(-1);

  const line = (points, key, color, min, max) => points.map((point, index) => {
    const x = 36 + (points.length === 1 ? 154 : index * 308 / (points.length - 1));
    const y = 168 - ((point[key] - min) / Math.max(1, max - min)) * 126;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const renderChart = (host, rows) => {
    const values = rows.flatMap((item) => [item.used_sale_price, item.buyback_price]).filter(Boolean);
    const min = Math.floor(Math.min(...values) / 500) * 500;
    const max = Math.ceil(Math.max(...values) / 500) * 500;
    const xLabels = rows.map((item, index) => {
      const x = 36 + (rows.length === 1 ? 154 : index * 308 / (rows.length - 1));
      return `<text x="${x}" y="194" text-anchor="middle" font-size="11" fill="#667085">${monthLabel(item.month)}</text>`;
    }).join("");
    const dots = (key, color) => rows.map((point, index) => {
      const x = 36 + (rows.length === 1 ? 154 : index * 308 / (rows.length - 1));
      const y = 168 - ((point[key] - min) / Math.max(1, max - min)) * 126;
      return `<circle cx="${x}" cy="${y}" r="4" fill="${color}"><title>${monthLabel(point.month)}：${yen.format(point[key])}</title></circle>`;
    }).join("");
    host.innerHTML = `
      <div class="price-legend"><span><i class="used"></i>中古販売</span><span><i class="buyback"></i>買取</span></div>
      <svg class="price-chart" viewBox="0 0 380 208" role="img" aria-label="中古販売価格と買取価格の推移">
        <line x1="36" y1="168" x2="344" y2="168" stroke="#d8dee8"/><line x1="36" y1="42" x2="36" y2="168" stroke="#d8dee8"/>
        <text x="30" y="48" text-anchor="end" font-size="11" fill="#667085">${yen.format(max)}</text>
        <text x="30" y="172" text-anchor="end" font-size="11" fill="#667085">${yen.format(min)}</text>
        <path d="${line(rows, "used_sale_price", "#14745a", min, max)}" fill="none" stroke="#14745a" stroke-width="3"/>
        <path d="${line(rows, "buyback_price", "#c25b22", min, max)}" fill="none" stroke="#c25b22" stroke-width="3"/>
        ${dots("used_sale_price", "#14745a")}${dots("buyback_price", "#c25b22")}${xLabels}
      </svg>`;
  };

  const renderGameCards = (rows) => {
    const groups = byGame(rows);
    document.querySelectorAll("[data-price-history-game]").forEach((host) => {
      const items = groups[host.dataset.priceHistoryGame] || [];
      if (!items.length) return;
      const current = latest(items);
      const previous = items.length > 1 ? items.at(-2) : null;
      const rate = Math.round((current.buyback_price / current.used_sale_price) * 100);
      const change = previous ? current.used_sale_price - previous.used_sale_price : null;
      host.innerHTML = `<p><strong>${monthLabel(current.month)}の参考相場：</strong>中古販売 ${yen.format(current.used_sale_price)} ／ 買取 ${yen.format(current.buyback_price)}（買取率 ${rate}%）</p>
        <p class="note">${change === null ? "価格推移はこの月から記録を開始しました。次回更新後に前月比を表示します。" : `中古販売価格の前月比：${change >= 0 ? "+" : ""}${yen.format(change)}`} 出典：<a class="text-link" href="${current.source_url}" target="_blank" rel="nofollow noopener">${current.source_name}</a></p>`;
    });
  };

  const renderMonthly = (rows) => {
    const host = document.getElementById("monthly-ranking");
    if (!host) return;
    const groups = byGame(rows);
    const items = Object.values(groups).map((values) => {
      const ordered = values.sort((a, b) => a.month.localeCompare(b.month));
      const current = ordered.at(-1);
      const previous = ordered.at(-2);
      return { current, change: previous ? current.used_sale_price - previous.used_sale_price : null, rate: current.buyback_price / current.used_sale_price };
    });
    const rank = (list, label, formatter) => `<div class="card"><h3>${label}</h3><ol>${list.slice(0, 3).map((item) => `<li><a href="pages/price-history.html#${item.current.game_id}">${item.current.title}</a><br><strong>${formatter(item)}</strong></li>`).join("")}</ol></div>`;
    const changes = items.filter((item) => item.change !== null);
    if (!changes.length) {
      host.innerHTML = `<div class="panel"><h2>今月の相場トピック</h2><p>2026年6月を基準月として30作品の相場記録を開始しました。次回更新後に急騰・急落ランキングを公開します。</p></div>${rank([...items].sort((a, b) => b.rate - a.rate), "いまの買取率 上位3本", (item) => `買取率 ${Math.round(item.rate * 100)}%`)}`;
      return;
    }
    host.innerHTML = `<div class="panel"><h2>今月の相場トピック</h2><p>最新月の中古販売価格を前月と比較しています。</p></div>${rank([...changes].sort((a, b) => b.change - a.change), "値上がり 上位3本", (item) => `+${yen.format(item.change)}`)}${rank([...changes].sort((a, b) => a.change - b.change), "値下がり 上位3本", (item) => yen.format(item.change))}${rank([...items].sort((a, b) => b.rate - a.rate), "買取率 上位3本", (item) => `買取率 ${Math.round(item.rate * 100)}%`)}`;
  };

  const renderHistoryPage = (rows) => {
    const host = document.getElementById("price-history-app");
    if (!host) return;
    const groups = byGame(rows);
    const ids = Object.keys(groups).sort((a, b) => groups[a][0].title.localeCompare(groups[b][0].title, "ja"));
    host.innerHTML = `<label class="history-select-label" for="game-select">ソフトを選ぶ</label><select id="game-select">${ids.map((id) => `<option value="${id}">${groups[id][0].title}</option>`).join("")}</select><div id="history-result"></div>`;
    const select = host.querySelector("#game-select");
    const update = () => {
      const items = groups[select.value].sort((a, b) => a.month.localeCompare(b.month));
      const current = latest(items);
      const used = items.map((item) => item.used_sale_price);
      const buyback = items.map((item) => item.buyback_price);
      const rate = Math.round((current.buyback_price / current.used_sale_price) * 100);
      const previous = items.length > 1 ? items.at(-2) : null;
      const change = previous ? current.used_sale_price - previous.used_sale_price : null;
      const result = host.querySelector("#history-result");
      result.innerHTML = `<div class="history-summary"><div><span>最新の中古販売</span><strong>${yen.format(current.used_sale_price)}</strong></div><div><span>最新の買取</span><strong>${yen.format(current.buyback_price)}</strong></div><div><span>買取率</span><strong>${rate}%</strong></div><div><span>前月比</span><strong>${change === null ? "蓄積中" : `${change >= 0 ? "+" : ""}${yen.format(change)}`}</strong></div></div><div class="chart-shell"></div><p class="note">記録開始：${monthLabel(items[0].month)} ／ 販売価格の最高：${yen.format(Math.max(...used))} ／ 最安：${yen.format(Math.min(...used))} ／ 出典：<a class="text-link" href="${current.source_url}" target="_blank" rel="nofollow noopener">${current.source_name}</a></p>`;
      renderChart(result.querySelector(".chart-shell"), items);
      history.replaceState(null, "", "#" + select.value);
    };
    select.value = location.hash.slice(1) in groups ? location.hash.slice(1) : ids[0];
    select.addEventListener("change", update);
    update();
  };

  fetch(path).then((response) => {
    if (!response.ok) throw new Error("価格履歴を読み込めませんでした");
    return response.text();
  }).then(parseCsv).then((rows) => {
    renderGameCards(rows);
    renderMonthly(rows);
    renderHistoryPage(rows);
  }).catch((error) => {
    document.querySelectorAll("[data-price-history-game], #monthly-ranking, #price-history-app").forEach((host) => {
      host.innerHTML = `<p class="note">${error.message}</p>`;
    });
  });
})();
