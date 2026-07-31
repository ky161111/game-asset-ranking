(() => {
  const send = (name, parameters = {}) => {
    if (window.__gameAssetAnalyticsOptOut || typeof window.gtag !== "function") return;
    window.gtag("event", name, parameters);
  };

  const search = document.querySelector("[data-hardware-search]");
  if (search) {
    let timer;
    search.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        send("hardware_search", {
          query_length: search.value.trim().length,
          page_path: location.pathname
        });
      }, 500);
    });
  }

  const sort = document.querySelector("[data-hardware-sort]");
  sort?.addEventListener("change", () => {
    send("hardware_sort", {
      sort: sort.value,
      page_path: location.pathname
    });
  });

  const gameSelect = document.querySelector("#game-select");
  gameSelect?.addEventListener("change", () => {
    send("price_history_game_select", {
      game_id: gameSelect.value,
      page_path: location.pathname
    });
  });

  document.querySelectorAll("a[href^='http']").forEach((link) => {
    if (link.dataset.analyticsEvent || link.dataset.analyticsBound) return;
    if (!link.rel.includes("sponsored")) return;
    link.dataset.analyticsBound = "true";
    link.addEventListener("click", () => {
      send("outbound_sponsored_click", {
        page_path: location.pathname,
        destination_host: new URL(link.href).host
      });
    });
  });
})();
