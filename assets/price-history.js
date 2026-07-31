(() => {
  const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
  const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const path = document.documentElement.dataset.priceHistoryPath || (
    location.pathname.includes("/pages/games/") ? "../../data/price-trends.json"
      : location.pathname.includes("/pages/") ? "../data/price-trends.json"
        : "data/price-trends.json"
  );
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const monthLabel = (month) => month ? month.replace("-", "年") + "月" : "";
  const signedYen = (value) => (value >= 0 ? "+" : "−") + yen.format(Math.abs(value));
  const signedRate = (value) => (value >= 0 ? "+" : "−") + Math.abs(value) + "%";

  const pointValue = (point, key) => number(point[key]);
  const chartX = (points, index) => 36 + (points.length === 1 ? 154 : index * 308 / (points.length - 1));
  const chartY = (value, min, max) => 168 - ((value - min) / Math.max(1, max - min)) * 126;
  const linePath = (points, key, min, max) => {
    let pathValue = "";
    let connected = false;
    points.forEach((point, index) => {
      const value = pointValue(point, key);
      if (value === null) {
        connected = false;
        return;
      }
      pathValue += (connected ? "L" : "M") + chartX(points, index).toFixed(1) + "," + chartY(value, min, max).toFixed(1) + " ";
      connected = true;
    });
    return pathValue.trim();
  };

  const renderChart = (host, points) => {
    const values = points.flatMap((point) => [pointValue(point, "used_sale_price"), pointValue(point, "buyback_price")]).filter((value) => value !== null);
    if (!values.length) {
      host.innerHTML = '<p class="note">グラフ化できる価格データがありません。</p>';
      return;
    }
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const min = rawMin === rawMax ? Math.max(0, Math.floor((rawMin - 500) / 500) * 500) : Math.floor(rawMin / 500) * 500;
    const max = rawMin === rawMax ? Math.ceil((rawMax + 500) / 500) * 500 : Math.ceil(rawMax / 500) * 500;
    const xLabels = points.map((point, index) => '<text x="' + chartX(points, index) + '" y="194" text-anchor="middle" font-size="11" fill="#667085">' + escape(point.label) + "</text>").join("");
    const dots = (key, color) => points.map((point, index) => {
      const value = pointValue(point, key);
      if (value === null) return "";
      return '<circle cx="' + chartX(points, index) + '" cy="' + chartY(value, min, max) + '" r="4" fill="' + color + '"><title>' + escape(point.label) + "：" + yen.format(value) + "</title></circle>";
    }).join("");
    const salePath = linePath(points, "used_sale_price", min, max);
    const buybackPath = linePath(points, "buyback_price", min, max);
    host.innerHTML = [
      '<div class="price-legend"><span><i class="used"></i>中古販売</span><span><i class="buyback"></i>買取</span></div>',
      '<svg class="price-chart" viewBox="0 0 380 208" role="img" aria-label="中古販売価格と買取価格の推移">',
      '<line x1="36" y1="168" x2="344" y2="168" stroke="#d8dee8"/><line x1="36" y1="42" x2="36" y2="168" stroke="#d8dee8"/>',
      '<text x="30" y="48" text-anchor="end" font-size="11" fill="#667085">' + yen.format(max) + "</text>",
      '<text x="30" y="172" text-anchor="end" font-size="11" fill="#667085">' + yen.format(min) + "</text>",
      salePath ? '<path d="' + salePath + '" fill="none" stroke="#14745a" stroke-width="3"/>' : "",
      buybackPath ? '<path d="' + buybackPath + '" fill="none" stroke="#c25b22" stroke-width="3"/>' : "",
      dots("used_sale_price", "#14745a"),
      dots("buyback_price", "#c25b22"),
      xLabels,
      "</svg>"
    ].join("");
  };

  const latestBuybackLabel = (item) => {
    if (item.latest?.buyback_price === null || item.latest?.buyback_price === undefined) return "蓄積中";
    const suffix = item.latest.buyback_period === item.latest.period ? "最新" : (item.latest.buyback_period || "直近") + "記録";
    return yen.format(item.latest.buyback_price) + "（" + suffix + "）";
  };
  const saleDelta = (item) => {
    if (item.sale_change === null || item.sale_change === undefined) return "蓄積中";
    const rate = item.sale_change_rate === null ? "" : "（" + signedRate(item.sale_change_rate) + "）";
    return signedYen(item.sale_change) + rate;
  };

  const renderGameCards = (items) => {
    const byGame = Object.fromEntries(items.map((item) => [item.game_id, item]));
    document.querySelectorAll("[data-price-history-game]").forEach((host) => {
      const item = byGame[host.dataset.priceHistoryGame];
      if (!item?.latest) return;
      const latest = item.latest;
      const latestPoint = item.points.at(-1);
      host.innerHTML = [
        "<p><strong>" + escape(latest.label) + "の参考相場：</strong>中古販売 " + yen.format(latest.used_sale_price) + " ／ 買取 " + latestBuybackLabel(item) + "</p>",
        '<p class="note">中古販売の前回比較：<strong class="history-delta ' + (item.sale_change >= 0 ? "up" : "down") + '">' + saleDelta(item) + "</strong> ／ 販売確認" + item.sale_point_count + "点・買取確認" + item.buyback_point_count + "点。出典：<a class=\"text-link\" href=\"" + escape(latest.source_url) + "\" target=\"_blank\" rel=\"nofollow noopener\">" + escape(latest.source_name) + "</a></p>",
        '<p class="note">' + escape(latestPoint?.note || "価格は確認時点の参考値です。") + "</p>"
      ].join("");
    });
  };

  const historyHref = location.pathname.includes("/pages/") ? "price-history.html#" : "pages/price-history.html#";
  const rankCard = (list, label, formatter) => '<div class="card"><h3>' + label + "</h3><ol>" + list.slice(0, 3).map((item) => '<li><a href="' + historyHref + escape(item.game_id) + '">' + escape(item.title) + "</a><br><strong>" + formatter(item) + "</strong></li>").join("") + "</ol></div>";

  const renderMonthly = (items) => {
    const host = document.getElementById("monthly-ranking");
    if (!host) return;
    const changes = items.filter((item) => item.sale_change !== null && item.sale_change !== undefined);
    if (!changes.length) {
      host.innerHTML = '<div class="panel"><h2>今月の相場トピック</h2><p>複数時点の価格がそろった作品から、値上がり・値下がりを表示します。</p></div>';
      return;
    }
    host.innerHTML = [
      '<div class="panel"><h2>今月の相場トピック</h2><p>月次履歴と、最新の複数店舗確認を比較した参考ランキングです。市場全体の騰落率を保証するものではありません。</p></div>',
      rankCard([...changes].sort((a, b) => b.sale_change - a.sale_change), "値上がり 上位3本", (item) => saleDelta(item)),
      rankCard([...changes].sort((a, b) => a.sale_change - b.sale_change), "値下がり 上位3本", (item) => saleDelta(item)),
      rankCard([...items].sort((a, b) => (b.latest?.buyback_price || 0) / (b.latest?.used_sale_price || 1) - (a.latest?.buyback_price || 0) / (a.latest?.used_sale_price || 1)), "直近の買取率 上位3本", (item) => item.latest?.buyback_price ? "買取率 " + Math.round(item.latest.buyback_price / item.latest.used_sale_price * 100) + "%" : "買取データ蓄積中")
    ].join("");
  };

  const renderHistoryPage = (items) => {
    const host = document.getElementById("price-history-app");
    if (!host) return;
    const sortedItems = [...items].sort((a, b) => a.title.localeCompare(b.title, "ja"));
    const byId = Object.fromEntries(sortedItems.map((item) => [item.game_id, item]));
    host.innerHTML = '<label class="history-select-label" for="game-select">ソフトを選ぶ</label><select id="game-select">' + sortedItems.map((item) => '<option value="' + escape(item.game_id) + '">' + escape(item.title) + "</option>").join("") + '</select><div id="history-result"></div>';
    const select = host.querySelector("#game-select");
    const update = () => {
      const item = byId[select.value];
      if (!item?.latest) return;
      const latest = item.latest;
      const result = host.querySelector("#history-result");
      result.innerHTML = [
        '<div class="history-summary"><div><span>最新の中古販売</span><strong>' + yen.format(latest.used_sale_price) + '</strong></div><div><span>買取の直近記録</span><strong>' + latestBuybackLabel(item) + '</strong></div><div><span>販売価格の確認点</span><strong>' + item.sale_point_count + '点</strong></div><div><span>前回比較</span><strong class="history-delta ' + (item.sale_change >= 0 ? "up" : "down") + '">' + saleDelta(item) + "</strong></div></div>",
        '<div class="chart-shell"></div>',
        '<p class="note">最新確認：' + escape(latest.label) + ' ／ 中古販売の出典：<a class="text-link" href="' + escape(latest.source_url) + '" target="_blank" rel="nofollow noopener">' + escape(latest.source_name) + "</a></p>",
        '<p class="note">点線になる箇所は、同じ時点の買取価格を確認していないためです。価格は確認時点の参考値です。</p>'
      ].join("");
      renderChart(result.querySelector(".chart-shell"), item.points);
      history.replaceState(null, "", "#" + item.game_id);
    };
    select.value = byId[location.hash.slice(1)] ? location.hash.slice(1) : sortedItems[0]?.game_id;
    select.addEventListener("change", update);
    update();
  };

  fetch(path).then((response) => {
    if (!response.ok) throw new Error("価格履歴を読み込めませんでした");
    return response.json();
  }).then(({ items }) => {
    renderGameCards(items);
    renderMonthly(items);
    renderHistoryPage(items);
  }).catch((error) => {
    document.querySelectorAll("[data-price-history-game], #monthly-ranking, #price-history-app").forEach((host) => {
      host.innerHTML = '<p class="note">' + escape(error.message) + "</p>";
    });
  });
})();
