// RealRisk MVP - main application logic
// Depends on: data.js (PROPERTIES), scoring.js (enrichProperty, etc), Leaflet

const STORAGE_KEY_WATCHLIST = "realrisk_watchlist_v1";
const STORAGE_KEY_WEIGHTS = "realrisk_weights_v1";

// ---------- State ----------
const state = {
  weights: loadWeights(),
  filters: {
    tiers: new Set([1, 2, 3]),
    priceMin: null,
    priceMax: null,
    roiMin: 0,
    city: "",
    floodFreeOnly: false,
    strOnly: false,
    search: ""
  },
  sort: "score",
  listSort: { col: "score", dir: "desc" },
  view: "cards",
  watchlist: loadWatchlist(),
  map: null,
  mapMarkers: []
};

// ---------- LocalStorage helpers ----------
function loadWatchlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WATCHLIST);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    return new Set();
  }
}

function saveWatchlist() {
  try {
    localStorage.setItem(STORAGE_KEY_WATCHLIST, JSON.stringify([...state.watchlist]));
  } catch (e) {}
}

function loadWeights() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WEIGHTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.financial !== undefined && parsed.risk !== undefined) return parsed;
    }
  } catch (e) {}
  return { financial: 0.6, risk: 0.4 };
}

function saveWeights() {
  try {
    localStorage.setItem(STORAGE_KEY_WEIGHTS, JSON.stringify(state.weights));
  } catch (e) {}
}

// ---------- Data pipeline ----------
function getEnriched() {
  return PROPERTIES.map(p => enrichProperty(p, state.weights));
}

function getFiltered() {
  const enriched = getEnriched();
  return enriched.filter(p => {
    if (!state.filters.tiers.has(p.tier)) return false;
    if (state.filters.priceMin != null && p.price < state.filters.priceMin) return false;
    if (state.filters.priceMax != null && p.price > state.filters.priceMax) return false;
    if (state.filters.roiMin > 0 && p.roi * 100 < state.filters.roiMin) return false;
    if (state.filters.city && p.city !== state.filters.city) return false;
    if (state.filters.floodFreeOnly && p.floodZone !== "X") return false;
    if (state.filters.strOnly && !p.strAllowed) return false;
    if (state.filters.search) {
      const q = state.filters.search.toLowerCase();
      const hay = (p.address + " " + p.city + " " + p.zip).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function getSorted(items) {
  const sorted = [...items];
  switch (state.sort) {
    case "score": sorted.sort((a, b) => b.totalScore - a.totalScore); break;
    case "roi": sorted.sort((a, b) => b.roi - a.roi); break;
    case "price-asc": sorted.sort((a, b) => a.price - b.price); break;
    case "price-desc": sorted.sort((a, b) => b.price - a.price); break;
    case "profit": sorted.sort((a, b) => b.profit - a.profit); break;
    case "dom": sorted.sort((a, b) => b.daysOnMarket - a.daysOnMarket); break;
  }
  return sorted;
}

// ---------- Stats ----------
function renderStats() {
  const filtered = getFiltered();
  const total = filtered.length;
  const all = PROPERTIES.length;
  const tier1Count = filtered.filter(p => p.tier === 1).length;
  const tier1Pct = total ? Math.round((tier1Count / total) * 100) : 0;
  const avgRoi = total ? filtered.reduce((s, p) => s + p.roi, 0) / total : 0;
  const avgPpsf = total ? filtered.reduce((s, p) => s + p.pricePerSqft, 0) / total : 0;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statAll").textContent = all;
  document.getElementById("statTier1").textContent = tier1Count;
  document.getElementById("statTier1Pct").textContent = tier1Pct + "%";
  document.getElementById("statRoi").textContent = formatPercent(avgRoi);
  document.getElementById("statPpsf").textContent = "$" + Math.round(avgPpsf);
}

// ---------- Cards view ----------
function renderCards() {
  const grid = document.getElementById("cardsGrid");
  const empty = document.getElementById("cardsEmpty");
  const items = getSorted(getFiltered());

  if (items.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  grid.innerHTML = items.map(p => renderCardHTML(p)).join("");

  grid.querySelectorAll(".card").forEach(card => {
    const id = parseInt(card.dataset.id);
    card.addEventListener("click", e => {
      if (e.target.closest(".card-fav")) return;
      openDetail(id);
    });
    const favBtn = card.querySelector(".card-fav");
    if (favBtn) {
      favBtn.addEventListener("click", e => {
        e.stopPropagation();
        toggleWatchlist(id);
        favBtn.classList.toggle("on", state.watchlist.has(id));
      });
    }
  });
}

function renderCardHTML(p) {
  const flags = getRiskFlags(p);
  const inWatchlist = state.watchlist.has(p.id);
  return `
    <div class="card" data-id="${p.id}">
      <button class="card-fav ${inWatchlist ? "on" : ""}" aria-label="Adicionar a watchlist">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="${inWatchlist ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
      </button>
      <div class="card-top">
        <p class="card-address">${p.address}</p>
        <p class="card-city">${p.city} · ${p.zip}</p>
        <span class="tier-badge tier-${p.tier}">Nivel ${p.tier}</span>
      </div>
      <div class="card-price">${formatCurrencyFull(p.price)}</div>
      <div class="card-metrics">
        <div>
          <span class="metric-label">$/sqft</span>
          <span class="metric-value">$${Math.round(p.pricePerSqft)}</span>
        </div>
        <div>
          <span class="metric-label">ROI est.</span>
          <span class="metric-value">${formatPercent(p.roi)}</span>
        </div>
        <div>
          <span class="metric-label">Lucro</span>
          <span class="metric-value">${formatCurrency(p.profit)}</span>
        </div>
      </div>
      <div class="card-flags">
        ${flags.map(f => `<span class="flag flag-${f.level}">${f.label}</span>`).join("")}
      </div>
    </div>
  `;
}

// ---------- List view ----------
function renderList() {
  const items = getSorted(getFiltered());
  const tbody = document.getElementById("tableBody");

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:var(--text-muted);">Nenhuma oportunidade atende aos filtros.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(p => {
    const flags = getRiskFlags(p);
    const flagsHtml = flags.slice(0, 2).map(f => `<span class="flag flag-${f.level}">${f.label}</span>`).join(" ");
    return `
      <tr data-id="${p.id}">
        <td class="bold">${p.address}</td>
        <td>${p.city}</td>
        <td class="num">${formatCurrencyFull(p.price)}</td>
        <td class="num">$${Math.round(p.pricePerSqft)}</td>
        <td class="num" style="color:${p.roi >= 0.20 ? "var(--ok)" : "var(--text)"}; font-weight:${p.roi >= 0.20 ? 600 : 400};">${formatPercent(p.roi)}</td>
        <td class="num">${formatCurrency(p.profit)}</td>
        <td>${flagsHtml}</td>
        <td><span class="tier-badge tier-${p.tier}">Nivel ${p.tier}</span></td>
        <td><button class="row-action">Detalhes</button></td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("tr").forEach(tr => {
    const id = parseInt(tr.dataset.id);
    tr.addEventListener("click", () => openDetail(id));
  });
}

// ---------- Map view ----------
function initMap() {
  if (state.map) return;
  state.map = L.map("map").setView([28.5384, -81.3789], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(state.map);
}

function renderMap() {
  if (!state.map) initMap();
  // Clear existing markers
  state.mapMarkers.forEach(m => state.map.removeLayer(m));
  state.mapMarkers = [];

  const items = getFiltered();
  items.forEach(p => {
    const icon = L.divIcon({
      className: "",
      html: `<div class="map-pin map-pin-${p.tier}"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    const marker = L.marker([p.lat, p.lng], { icon }).addTo(state.map);
    marker.bindPopup(`
      <strong>${p.address}</strong><br/>
      ${p.city} · ${p.zip}<br/>
      ${formatCurrencyFull(p.price)} · ROI ${formatPercent(p.roi)}<br/>
      <a href="#" data-detail-id="${p.id}" style="color:var(--accent);">Ver detalhes</a>
    `);
    marker.on("popupopen", () => {
      setTimeout(() => {
        const link = document.querySelector("[data-detail-id]");
        if (link) {
          link.addEventListener("click", e => {
            e.preventDefault();
            openDetail(parseInt(link.dataset.detailId));
          });
        }
      }, 50);
    });
    state.mapMarkers.push(marker);
  });

  setTimeout(() => state.map.invalidateSize(), 50);
}

// ---------- Detail modal ----------
function openDetail(id) {
  const p = getEnriched().find(x => x.id === id);
  if (!p) return;

  const flags = getRiskFlags(p);
  const inWatchlist = state.watchlist.has(p.id);

  document.getElementById("modalBody").innerHTML = `
    <div class="modal-header">
      <h2>${p.address}</h2>
      <div class="modal-sub">${p.city}, FL · ${p.zip} · ${p.bedrooms} quartos · ${p.bathrooms} banheiros · ${p.sqft.toLocaleString()} sqft</div>
      <span class="tier-badge tier-${p.tier}" style="margin-top:8px;">Nivel ${p.tier} · Score ${Math.round(p.totalScore)}</span>
      <div class="modal-price">${formatCurrencyFull(p.price)}</div>
    </div>

    <div class="modal-section" style="border-top:0; padding-top:0;">
      <h3>Analise financeira</h3>
      <div class="modal-grid">
        <div class="modal-stat"><div class="modal-stat-label">$/sqft</div><div class="modal-stat-value">$${Math.round(p.pricePerSqft)}</div></div>
        <div class="modal-stat"><div class="modal-stat-label">CAPEX estimado</div><div class="modal-stat-value">${formatCurrency(p.capexEstimated)}</div></div>
        <div class="modal-stat"><div class="modal-stat-label">Closing costs</div><div class="modal-stat-value">${formatCurrency(p.closingCosts)}</div></div>
        <div class="modal-stat"><div class="modal-stat-label">All-in</div><div class="modal-stat-value">${formatCurrency(p.allIn)}</div></div>
        <div class="modal-stat"><div class="modal-stat-label">ARV estimado</div><div class="modal-stat-value">${formatCurrency(p.arvEstimated)}</div></div>
        <div class="modal-stat"><div class="modal-stat-label">Lucro estimado</div><div class="modal-stat-value">${formatCurrency(p.profit)}</div></div>
        <div class="modal-stat"><div class="modal-stat-label">ROI</div><div class="modal-stat-value" style="color:var(--ok);">${formatPercent(p.roi)}</div></div>
        <div class="modal-stat"><div class="modal-stat-label">Holding/mes</div><div class="modal-stat-value">$${Math.round(p.monthlyHoldingCost)}</div></div>
        <div class="modal-stat"><div class="modal-stat-label">DOM</div><div class="modal-stat-value">${p.daysOnMarket}d</div></div>
      </div>
    </div>

    <div class="modal-section">
      <h3>Riscos Florida</h3>
      <div class="card-flags">
        ${flags.map(f => `<span class="flag flag-${f.level}">${f.label}</span>`).join("")}
      </div>
      <p style="margin-top:12px; font-size:12px; color:var(--text-muted);">
        Score financeiro: <strong>${Math.round(p.financialScore)}/100</strong> ·
        Score risco: <strong>${Math.round(p.riskScore)}/100</strong> ·
        Score total: <strong>${Math.round(p.totalScore)}/100</strong>
      </p>
    </div>

    <div class="modal-section">
      <h3>Descricao</h3>
      <p class="modal-description">${p.description}</p>
    </div>

    <div class="modal-actions">
      <button class="btn-primary" id="modalContactBtn">Sinalizar interesse</button>
      <button class="btn-secondary" id="modalFavBtn" style="width:auto; padding:8px 16px;">
        ${inWatchlist ? "Remover da watchlist" : "Adicionar a watchlist"}
      </button>
    </div>
  `;

  document.getElementById("detailModal").hidden = false;

  document.getElementById("modalFavBtn").addEventListener("click", () => {
    toggleWatchlist(p.id);
    openDetail(p.id);
    renderCards();
  });

  document.getElementById("modalContactBtn").addEventListener("click", () => {
    alert("Em producao, este botao bloqueia o deal para outros membros da comunidade (mecanica de exclusividade).");
  });
}

function closeDetail() {
  document.getElementById("detailModal").hidden = true;
}

// ---------- Watchlist ----------
function toggleWatchlist(id) {
  if (state.watchlist.has(id)) state.watchlist.delete(id);
  else state.watchlist.add(id);
  saveWatchlist();
  updateWatchlistCount();
}

function updateWatchlistCount() {
  const count = state.watchlist.size;
  const el = document.getElementById("watchlistCount");
  el.textContent = count;
  el.style.display = count === 0 ? "none" : "";
}

// ---------- View switching ----------
function switchView(view) {
  state.view = view;
  document.querySelectorAll("#viewToggle button").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(view + "View").classList.add("active");

  if (view === "map") {
    setTimeout(() => {
      if (!state.map) initMap();
      renderMap();
    }, 50);
  } else if (view === "list") {
    renderList();
  } else {
    renderCards();
  }
}

// ---------- Render all ----------
function renderAll() {
  renderStats();
  if (state.view === "cards") renderCards();
  else if (state.view === "list") renderList();
  else if (state.view === "map") renderMap();
}

// ---------- Filter handlers ----------
function setupFilters() {
  // Tier chips
  document.querySelectorAll(".chip[data-tier]").forEach(chip => {
    chip.addEventListener("click", () => {
      const tier = parseInt(chip.dataset.tier);
      if (state.filters.tiers.has(tier)) state.filters.tiers.delete(tier);
      else state.filters.tiers.add(tier);
      chip.classList.toggle("active");
      renderAll();
    });
  });

  // Price range
  document.getElementById("priceMin").addEventListener("input", e => {
    state.filters.priceMin = e.target.value ? parseInt(e.target.value) : null;
    renderAll();
  });
  document.getElementById("priceMax").addEventListener("input", e => {
    state.filters.priceMax = e.target.value ? parseInt(e.target.value) : null;
    renderAll();
  });

  // ROI slider
  const roiSlider = document.getElementById("roiMin");
  roiSlider.addEventListener("input", e => {
    state.filters.roiMin = parseInt(e.target.value);
    document.getElementById("roiMinValue").textContent = e.target.value + "%";
    renderAll();
  });

  // City
  const citySelect = document.getElementById("cityFilter");
  const cities = [...new Set(PROPERTIES.map(p => p.city))].sort();
  cities.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    citySelect.appendChild(opt);
  });
  citySelect.addEventListener("change", e => {
    state.filters.city = e.target.value;
    renderAll();
  });

  // Risk checkboxes
  document.getElementById("floodFreeOnly").addEventListener("change", e => {
    state.filters.floodFreeOnly = e.target.checked;
    renderAll();
  });
  document.getElementById("strOnly").addEventListener("change", e => {
    state.filters.strOnly = e.target.checked;
    renderAll();
  });

  // Clear
  document.getElementById("clearFilters").addEventListener("click", () => {
    state.filters = {
      tiers: new Set([1, 2, 3]),
      priceMin: null,
      priceMax: null,
      roiMin: 0,
      city: "",
      floodFreeOnly: false,
      strOnly: false,
      search: state.filters.search
    };
    document.querySelectorAll(".chip[data-tier]").forEach(c => c.classList.add("active"));
    document.getElementById("priceMin").value = "";
    document.getElementById("priceMax").value = "";
    document.getElementById("roiMin").value = 0;
    document.getElementById("roiMinValue").textContent = "0%";
    document.getElementById("cityFilter").value = "";
    document.getElementById("floodFreeOnly").checked = false;
    document.getElementById("strOnly").checked = false;
    renderAll();
  });

  // Search
  document.getElementById("searchInput").addEventListener("input", e => {
    state.filters.search = e.target.value.trim();
    renderAll();
  });
}

function setupWeights() {
  const finSlider = document.getElementById("weightFin");
  const riskSlider = document.getElementById("weightRisk");

  finSlider.value = Math.round(state.weights.financial * 100);
  riskSlider.value = Math.round(state.weights.risk * 100);
  document.getElementById("weightFinValue").textContent = finSlider.value + "%";
  document.getElementById("weightRiskValue").textContent = riskSlider.value + "%";

  finSlider.addEventListener("input", e => {
    const fin = parseInt(e.target.value);
    state.weights.financial = fin / 100;
    state.weights.risk = (100 - fin) / 100;
    riskSlider.value = 100 - fin;
    document.getElementById("weightFinValue").textContent = fin + "%";
    document.getElementById("weightRiskValue").textContent = (100 - fin) + "%";
    saveWeights();
    renderAll();
  });

  riskSlider.addEventListener("input", e => {
    const risk = parseInt(e.target.value);
    state.weights.risk = risk / 100;
    state.weights.financial = (100 - risk) / 100;
    finSlider.value = 100 - risk;
    document.getElementById("weightFinValue").textContent = (100 - risk) + "%";
    document.getElementById("weightRiskValue").textContent = risk + "%";
    saveWeights();
    renderAll();
  });
}

function setupSort() {
  document.getElementById("sortBy").addEventListener("change", e => {
    state.sort = e.target.value;
    renderAll();
  });
}

function setupViewToggle() {
  document.querySelectorAll("#viewToggle button").forEach(b => {
    b.addEventListener("click", () => switchView(b.dataset.view));
  });
}

function setupModal() {
  document.querySelectorAll("[data-close]").forEach(el => {
    el.addEventListener("click", closeDetail);
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDetail();
  });
}

function setupWatchlistButton() {
  document.getElementById("watchlistBtn").addEventListener("click", () => {
    if (state.watchlist.size === 0) {
      alert("Sua watchlist esta vazia. Clique no coracao em qualquer card para adicionar.");
      return;
    }
    state.filters.tiers = new Set([1, 2, 3]);
    state.filters.search = "";
    document.getElementById("searchInput").value = "";
    const allItems = getEnriched();
    const watchedItems = allItems.filter(p => state.watchlist.has(p.id));
    const ids = watchedItems.map(p => p.id);
    alert("Watchlist (" + state.watchlist.size + " imoveis): " + watchedItems.map(p => p.address).join(", "));
  });
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  setupFilters();
  setupWeights();
  setupSort();
  setupViewToggle();
  setupModal();
  setupWatchlistButton();
  updateWatchlistCount();
  renderAll();
});
