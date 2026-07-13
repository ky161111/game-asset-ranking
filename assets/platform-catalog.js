(() => {
  const host = document.getElementById("platform-catalog");
  if (!host) return;
  const platform = document.documentElement.dataset.platform;
  const labels = { switch: "Nintendo Switch", ps5: "PS5", ps4: "PS4" };
  const parse = (text) => {
    const [header, ...rows] = text.trim().split(/\r?\n/);
    const keys = header.split(",");
    return rows.map((row) => Object.fromEntries(row.split(",").map((value, index) => [keys[index], value])));
  };
  fetch("../data/game-catalog.csv").then((response) => {
    if (!response.ok) throw new Error("作品一覧を読み込めませんでした");
    return response.text();
  }).then(parse).then((games) => {
    const items = games.filter((game) => game.platform === platform);
    host.innerHTML = `<p class="note">${labels[platform]}のパッケージ通常版を対象に、月次の中古販売・買取相場を記録します。</p><div class="catalog-grid">${items.map((game) => `<article class="card"><h2>${game.title}</h2><p><span class="badge ${game.status === "tracking" ? "" : "muted"}">${game.status === "tracking" ? "相場を記録中" : "初回相場を確認中"}</span></p><p>${game.status === "tracking" ? "価格推移ページで月次相場を確認できます。" : "通常版の中古販売価格・買取価格・出典を確認後に掲載します。"}</p><a class="text-link" href="games/${game.game_id}.html">作品ページを見る</a></article>`).join("")}</div>`;
  }).catch((error) => { host.innerHTML = `<p class="note">${error.message}</p>`; });
})();
