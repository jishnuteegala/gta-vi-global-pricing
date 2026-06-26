var REGIONS = [];
var GROUP_ORDER = { Live: 0, Pending: 1, Unavailable: 2 };
var sortField = 'stdUSD', sortDir = 'desc', searchQuery = '', statusFilterVal = 'all';
var live = [];
var selected = new Set();
var mainChart = null, varChart = null, varMode = 'std', varSortMode = 'dynamic';

var presetDefs = {
  all: [],
  default: [],
  g7: ['Canada','France','Germany','Italy','Japan','United Kingdom','United States'],
  europe: ['Austria','Belgium','Bulgaria','Croatia','Cyprus','Czech Republic','Denmark','Finland','France','Germany','Greece','Hungary','Ireland','Italy','Luxembourg','Malta','Netherlands','Norway','Poland','Portugal','Romania','Spain','Sweden','Switzerland','Turkey','Ukraine','United Kingdom'],
  apac: ['Australia','Hong Kong','India','Indonesia','Japan','Malaysia','New Zealand','Singapore','South Korea','Thailand'],
  americas: ['Argentina','Bolivia','Brazil','Canada','Chile','Colombia','Costa Rica','Ecuador','El Salvador','Guatemala','Honduras','Mexico','Nicaragua','Panama','Paraguay','Peru','United States','Uruguay'],
};

var DEFAULT_COUNTRIES = ['Australia','Austria','Belgium','Brazil','Canada','Denmark','France','Germany','Hong Kong','India','Ireland','Italy','Japan','Netherlands','New Zealand','Norway','Poland','Portugal','Romania','Singapore','South Korea','Spain','Sweden','Switzerland','Turkey','UAE','United Kingdom','United States'];

fetch('data/regions.json')
  .then(function(r) { return r.json(); })
  .then(function(data) { init(data); });

function init(data) {
  REGIONS = data.regions.map(function(r) {
    return {
      group: r.status,
      name: r.name,
      currency: r.currency,
      status: r.status,
      std: r.standard_local,
      ult: r.ultimate_local,
      stdUSD: r.standard_usd,
      ultUSD: r.ultimate_usd,
      stores: r.stores
    };
  });
  REGIONS.sort(function(a, b) {
    var g = GROUP_ORDER[a.group] - GROUP_ORDER[b.group];
    return g !== 0 ? g : a.name.localeCompare(b.name);
  });

  live = REGIONS.filter(function(r) { return r.group === 'Live'; }).sort(function(a, b) { return a.stdUSD - b.stdUSD; });

  var totalCount = REGIONS.length;
  var liveCount = REGIONS.filter(function(r) { return r.status === 'Live'; }).length;
  var pendingCount = REGIONS.filter(function(r) { return r.status === 'Pending'; }).length;
  var unavailCount = REGIONS.filter(function(r) { return r.status === 'Unavailable'; }).length;

  document.getElementById('statTotal').textContent = totalCount;
  document.getElementById('statLive').textContent = liveCount;
  document.getElementById('statPending').textContent = pendingCount;
  document.getElementById('statUnavail').textContent = unavailCount;

  var livePriced = live.filter(function(r) { return r.stdUSD !== null; });
  if (livePriced.length > 0) {
    var cheapest = livePriced[0];
    var priciest = livePriced[livePriced.length - 1];
    var cheapPct = Math.abs((cheapest.stdUSD / 79.99 - 1) * 100).toFixed(1);
    var pricePct = ((priciest.stdUSD / 79.99 - 1) * 100).toFixed(1);
    document.getElementById('statCheapest').innerHTML = cheapest.name + ' &mdash; US$' + cheapest.stdUSD.toFixed(2);
    document.getElementById('statCheapestPct').textContent = cheapPct + '% below US baseline';
    document.getElementById('statPriciest').innerHTML = priciest.name + ' &mdash; US$' + priciest.stdUSD.toFixed(2);
    document.getElementById('statPriciestPct').textContent = pricePct + '% above US baseline';
  }

  presetDefs.all = live.map(function(r) { return r.name; });
  presetDefs.default = live.filter(function(r) { return DEFAULT_COUNTRIES.indexOf(r.name) !== -1; }).map(function(r) { return r.name; });
  presetDefs.g7 = live.filter(function(r) { return presetDefs.g7.indexOf(r.name) !== -1; }).map(function(r) { return r.name; });
  presetDefs.europe = live.filter(function(r) { return presetDefs.europe.indexOf(r.name) !== -1; }).map(function(r) { return r.name; });
  presetDefs.apac = live.filter(function(r) { return presetDefs.apac.indexOf(r.name) !== -1; }).map(function(r) { return r.name; });
  presetDefs.americas = live.filter(function(r) { return presetDefs.americas.indexOf(r.name) !== -1; }).map(function(r) { return r.name; });

  selected = new Set(presetDefs.default);

  renderExchangeRates(data.exchange_rates);
  buildCheckboxes();
  setupTableEvents();
  updateSortUI();
  renderTable();
  registerChartPlugin();
  setupVarButtons();
  updateChart();
  updatePresetButtons();
  updateVarButtons();
  setupParallax();
}

function renderExchangeRates(rates) {
  var tbody = document.getElementById('ratesBody');
  var currencies = Object.keys(rates).sort();
  var html = '';
  for (var i = 0; i < currencies.length; i++) {
    var cur = currencies[i];
    var rate = rates[cur];
    var inverse = (1 / rate);
    var bg = i % 2 === 1 ? 'background:var(--surface-2);' : '';
    html += '<tr style="border-bottom:1px solid var(--border);' + bg + '">' +
      '<td class="py-2 px-4 font-medium text-text">' + cur + '</td>' +
      '<td class="py-2 px-4 tabular text-right" style="color:var(--muted);">' + inverse.toFixed(inverse >= 100 ? 0 : inverse >= 1 ? 3 : 6) + '</td>' +
      '<td class="py-2 px-4 tabular text-right" style="color:var(--muted);">US$' + rate + '</td>' +
      '</tr>';
  }
  tbody.innerHTML = html;
}

function fmtLocal(v, cur) {
  if (v === null || v === undefined) return '<span style="color:var(--muted)">\u2014</span>';
  var m = function(s) { return '<span class="tabular">' + s + '</span>'; };
  if (cur === 'EUR') return m('\u20AC' + v.toFixed(2));
  if (cur === 'JPY') return m('\u00A5' + Math.round(v).toLocaleString());
  if (cur === 'KRW') return m('\u20A9' + Math.round(v).toLocaleString());
  if (cur === 'INR') return m('\u20B9' + Math.round(v).toLocaleString());
  return m(cur + ' ' + v.toLocaleString());
}

function renderTable() {
  var tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  var filtered = REGIONS.filter(function(r) {
    if (statusFilterVal !== 'all' && r.group !== statusFilterVal) return false;
    if (searchQuery && r.name.toLowerCase().indexOf(searchQuery.toLowerCase()) === -1) return false;
    return true;
  });
  if (sortField) {
    filtered.sort(function(a, b) {
      var g = function(r, f) {
        if (f === 'name') return r.name;
        if (f === 'currency') return r.currency;
        if (f === 'status') return GROUP_ORDER[r.group];
        if (f === 'stdUSD') return r.stdUSD !== null ? r.stdUSD : -999;
        if (f === 'ultUSD') return r.ultUSD !== null ? r.ultUSD : -999;
        if (f === 'variance') return (r.stdUSD !== null ? r.stdUSD : 79.99) - 79.99;
        return r.name;
      };
      var va = g(a, sortField), vb = g(b, sortField);
      return typeof va === 'string' ? (sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)) : (sortDir === 'asc' ? va - vb : vb - va);
    });
  } else {
    filtered.sort(function(a, b) { var g = GROUP_ORDER[a.group] - GROUP_ORDER[b.group]; return g !== 0 ? g : a.name.localeCompare(b.name); });
  }
  document.getElementById('tableCount').textContent = filtered.length + ' entries';
  if (filtered.length === 0) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="10" class="py-8 text-center text-sm" style="color:var(--muted);">No countries match your search</td>';
    tbody.appendChild(tr);
    return;
  }
  var lastGroup = null, rowNum = 0;
  filtered.forEach(function(r) {
    if (r.group !== lastGroup) {
      var gr = document.createElement('tr');
      var sc = r.group === 'Live' ? '#4ade80' : r.group === 'Pending' ? '#e8b84b' : '#555555';
      gr.innerHTML = '<td colspan="10" class="py-2 px-4 text-xs font-semibold uppercase tracking-wider group-header" style="color:' + sc + '">' + r.group + '</td>';
      tbody.appendChild(gr);
      lastGroup = r.group;
    }
    rowNum++;
    var tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:1px solid var(--border);transition:background 0.15s;';
    tr.onmouseenter = function() { this.style.background = 'rgba(22,22,42,0.5)'; };
    tr.onmouseleave = function() { this.style.background = 'transparent'; };
    var sd = r.status === 'Live' ? '<span style="color:#4ade80">Live</span>' : r.status === 'Pending' ? '<span style="color:#e8b84b">Pending</span>' : '<span style="color:#555555">N/A</span>';
    var stdD = fmtLocal(r.std, r.currency), ultD = fmtLocal(r.ult, r.currency);
    var sUSD = r.stdUSD !== null ? '<span class="tabular">US$' + r.stdUSD.toFixed(2) + '</span>' : '<span style="color:var(--muted)">\u2014</span>';
    var uUSD = r.ultUSD !== null ? '<span class="tabular">US$' + r.ultUSD.toFixed(2) + '</span>' : '<span style="color:var(--muted)">\u2014</span>';
    var var_ = r.stdUSD !== null ? r.stdUSD - 79.99 : null;
    var vD = var_ !== null ? '<span class="tabular" style="color:' + (var_ < 0 ? '#4ade80' : var_ > 0 ? '#e8b84b' : 'var(--muted)') + '">' + (var_ >= 0 ? '+' : '') + 'US$' + var_.toFixed(2) + '</span>' : '<span style="color:var(--muted)">\u2014</span>';
    var links = r.stores.map(function(s) { return '<a href="' + s.url + '" target="_blank" rel="noopener" class="text-xs" style="color:var(--muted)">' + s.slug + '</a>'; }).join(' <span style="color:var(--border)">\u00B7</span> ');
    tr.innerHTML = '<td class="py-2 px-4 text-xs" style="color:var(--muted)">' + rowNum + '</td><td class="py-2 px-4 font-medium" style="color:var(--text)">' + r.name + '</td><td class="py-2 px-4 text-xs tabular" style="color:var(--muted)">' + r.currency + '</td><td class="py-2 px-4">' + sd + '</td><td class="py-2 px-4 tabular text-right">' + sUSD + '</td><td class="py-2 px-4 tabular text-right">' + uUSD + '</td><td class="py-2 px-4 tabular text-right">' + stdD + '</td><td class="py-2 px-4 tabular text-right">' + ultD + '</td><td class="py-2 px-4 tabular text-right">' + vD + '</td><td class="py-2 px-4 text-right text-xs">' + links + '</td>';
    tbody.appendChild(tr);
  });
}

function setupTableEvents() {
  document.getElementById('tableSearch').addEventListener('input', function(e) { searchQuery = e.target.value; renderTable(); });
  document.getElementById('statusFilter').addEventListener('change', function(e) { statusFilterVal = e.target.value; renderTable(); });
  document.querySelectorAll('#regionTable th[data-sort]').forEach(function(th) {
    th.addEventListener('click', function() { handleSort(th); });
    th.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(th); } });
  });
  document.getElementById('resetSort').addEventListener('click', function() { sortField = null; sortDir = 'asc'; updateSortUI(); renderTable(); });
}

function updateSortUI() {
  document.querySelectorAll('#regionTable th[data-sort]').forEach(function(el) {
    el.setAttribute('aria-sort', 'none');
    var ic = el.querySelector('.sort-icon');
    if (ic) ic.textContent = '';
  });
  if (sortField) {
    var active = document.querySelector('#regionTable th[data-sort="' + sortField + '"]');
    if (active) {
      active.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
      var ic = active.querySelector('.sort-icon');
      if (ic) ic.textContent = sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
    }
  }
}

function handleSort(th) {
  var f = th.dataset.sort;
  if (sortField === f) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  else { sortField = f; sortDir = 'asc'; }
  updateSortUI();
  renderTable();
}

function buildCheckboxes() {
  var cc = document.getElementById('checkboxContainer');
  live.forEach(function(r) {
    var label = document.createElement('label');
    label.className = 'checkbox-label inline-flex items-center gap-1.5 text-xs';
    label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;color:#999999;padding:2px 8px 2px 4px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);transition:all 0.15s;cursor:pointer;';
    label.innerHTML = '<input type="checkbox" ' + (selected.has(r.name) ? 'checked' : '') + ' style="accent-color:#e8b84b;border-radius:3px;width:13px;height:13px" data-name="' + r.name + '"> <span>' + r.name + '</span>';
    var cb = label.querySelector('input');
    cb.addEventListener('change', function() {
      if (cb.checked) selected.add(r.name); else selected.delete(r.name);
      updateChart(); updatePresetButtons();
    });
    cc.appendChild(label);
  });

  document.querySelectorAll('[data-preset]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var names = presetDefs[btn.dataset.preset] || [];
      selected = new Set(names);
      cc.querySelectorAll('input[type=checkbox]').forEach(function(cb) { cb.checked = selected.has(cb.dataset.name); });
      updateChart(); updatePresetButtons();
    });
  });
}

function updatePresetButtons() {
  document.querySelectorAll('[data-preset]').forEach(function(btn) {
    var set = new Set(presetDefs[btn.dataset.preset] || []);
    var match = set.size === selected.size && Array.from(set).every(function(n) { return selected.has(n); });
    btn.setAttribute('aria-pressed', match ? 'true' : 'false');
    if (match) { btn.style.background = 'rgba(232,184,75,0.12)'; btn.style.color = '#e8b84b'; btn.style.borderColor = 'rgba(232,184,75,0.3)'; }
    else { btn.style.background = 'var(--surface-2)'; btn.style.color = 'var(--muted)'; btn.style.borderColor = 'var(--border)'; }
  });
}

function fmtLocalShort(r, mode) {
  var v = mode === 'ult' ? r.ult : r.std;
  if (r.currency === 'EUR') return '\u20AC' + v.toFixed(2);
  if (r.currency === 'JPY') return '\u00A5' + Math.round(v).toLocaleString();
  if (r.currency === 'KRW') return '\u20A9' + Math.round(v).toLocaleString();
  if (r.currency === 'INR') return '\u20B9' + Math.round(v).toLocaleString();
  return r.currency + ' ' + v.toLocaleString();
}

function registerChartPlugin() {
  var baselinePlugin = {
    id: 'baselineLine',
    beforeDraw: function(chart) {
      var bl = chart.options.plugins.baselineLine;
      if (!bl || bl.value == null) return;
      var yScale = chart.scales.y;
      var y = yScale.getPixelForValue(bl.value);
      if (y < yScale.top || y > yScale.bottom) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = bl.color || 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.moveTo(chart.chartArea.left, y);
      ctx.lineTo(chart.chartArea.right, y);
      ctx.stroke();
      ctx.restore();
      if (bl.label) {
        ctx.save();
        ctx.font = '10px DM Mono, monospace';
        ctx.fillStyle = bl.labelColor || 'rgba(255,255,255,0.35)';
        ctx.textAlign = 'right';
        ctx.fillText(bl.label, chart.chartArea.right - 4, y - 5);
        ctx.restore();
      }
    }
  };
  Chart.register(baselinePlugin);
}

function makeChart(canvasId, type, labels, datasets, opts) {
  var ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: type,
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: opts.hideLegend ? { display: false } : { labels: { color: '#999999', font: { family: 'DM Sans', size: 11 }, usePointStyle: true, padding: 16 } },
        tooltip: {
          backgroundColor: '#0a0a0a', titleColor: '#ffffff', bodyColor: '#999999',
          borderColor: '#1a1a1a', borderWidth: 1, padding: 12, cornerRadius: 6,
          callbacks: opts.tooltipCallbacks || {}
        },
        baselineLine: opts.baseline || {}
      },
      scales: {
        x: { ticks: { color: '#707070', font: { family: 'DM Sans', size: 10 }, maxRotation: 45, minRotation: 0 }, grid: { display: false } },
        y: { ticks: { color: '#707070', font: { family: 'DM Sans', size: 10 }, callback: function(v) { return 'US$' + v; } }, grid: { color: 'rgba(255,255,255,0.06)' } }
      }
    }
  });
}

function updateChart() {
  var filtered = live.filter(function(r) { return selected.has(r.name); }).sort(function(a, b) { return a.stdUSD - b.stdUSD; });
  document.getElementById('chartCount').textContent = filtered.length + ' countries selected';
  var empty = document.getElementById('mainChartEmpty');
  if (filtered.length === 0) {
    empty.style.display = 'flex';
    if (mainChart) { mainChart.destroy(); mainChart = null; }
    if (varChart) { varChart.destroy(); varChart = null; }
    return;
  }
  empty.style.display = 'none';
  if (mainChart) mainChart.destroy();
  mainChart = makeChart('mainChart', 'bar', filtered.map(function(r) { return r.name; }), [
    { label: 'Standard Edition', data: filtered.map(function(r) { return r.stdUSD; }), backgroundColor: 'rgba(232,184,75,0.85)', borderRadius: 4, borderSkipped: false },
    { label: 'Ultimate Edition', data: filtered.map(function(r) { return r.ultUSD; }), backgroundColor: 'rgba(192,57,43,0.85)', borderRadius: 4, borderSkipped: false }
  ], {
    baseline: { value: 79.99, label: 'US baseline $79.99', color: 'rgba(255,255,255,0.25)', labelColor: 'rgba(255,255,255,0.4)' },
    tooltipCallbacks: {
      afterBody: function(ctx) { var r = filtered[ctx[0].dataIndex]; var mode = ctx[0].datasetIndex === 1 ? 'ult' : 'std'; return 'Local: ' + fmtLocalShort(r, mode); }
    }
  });
  updateVarianceChart();
}

function updateVarianceChart() {
  var sortKey = varSortMode === 'dynamic' ? (varMode === 'std' ? 'stdUSD' : 'ultUSD') : (varSortMode === 'std' ? 'stdUSD' : 'ultUSD');
  var filtered = live.filter(function(r) { return selected.has(r.name); }).sort(function(a, b) { return a[sortKey] - b[sortKey]; });
  var varEmpty = document.getElementById('varChartEmpty');
  if (filtered.length === 0) {
    varEmpty.style.display = 'flex';
    if (varChart) { varChart.destroy(); varChart = null; }
    return;
  }
  varEmpty.style.display = 'none';
  var baseline = varMode === 'std' ? 79.99 : 99.99;
  var label = varMode === 'std' ? 'vs Standard (US$79.99)' : 'vs Ultimate (US$99.99)';
  if (varChart) varChart.destroy();
  varChart = makeChart('varianceChart', 'bar', filtered.map(function(r) { return r.name; }), [{
    label: label,
    data: filtered.map(function(r) { return +((varMode === 'std' ? r.stdUSD : r.ultUSD) - baseline).toFixed(2); }),
    backgroundColor: filtered.map(function(r) { var v = (varMode === 'std' ? r.stdUSD : r.ultUSD) - baseline; return v > 0 ? 'rgba(192,57,43,0.8)' : v < 0 ? 'rgba(232,184,75,0.8)' : 'rgba(85,85,85,0.5)'; }),
    borderRadius: 4, borderSkipped: false
  }], {
    hideLegend: true,
    baseline: { value: 0, color: 'rgba(255,255,255,0.15)' },
    tooltipCallbacks: {
      afterBody: function(ctx) { var r = filtered[ctx[0].dataIndex]; return 'Local: ' + fmtLocalShort(r, varMode); }
    }
  });
}

function updateVarButtons() {
  var stdBtn = document.getElementById('varStdBtn');
  var ultBtn = document.getElementById('varUltBtn');
  var active = 'rgba(232,184,75,0.12)', inactive = 'var(--surface-2)';
  stdBtn.style.background = varMode === 'std' ? active : inactive;
  stdBtn.style.color = varMode === 'std' ? '#e8b84b' : 'var(--muted)';
  stdBtn.style.borderColor = varMode === 'std' ? 'rgba(232,184,75,0.3)' : 'var(--border)';
  ultBtn.style.background = varMode === 'ult' ? active : inactive;
  ultBtn.style.color = varMode === 'ult' ? '#e8b84b' : 'var(--muted)';
  ultBtn.style.borderColor = varMode === 'ult' ? 'rgba(232,184,75,0.3)' : 'var(--border)';
}

function updateVarSortButtons() {
  ['dynamic', 'std', 'ult'].forEach(function(m) {
    var btn = document.getElementById('varSort' + m.charAt(0).toUpperCase() + m.slice(1) + 'Btn');
    if (!btn) return;
    var isActive = varSortMode === m;
    btn.style.background = isActive ? 'rgba(232,184,75,0.12)' : 'var(--surface-2)';
    btn.style.color = isActive ? '#e8b84b' : 'var(--muted)';
    btn.style.borderColor = isActive ? 'rgba(232,184,75,0.3)' : 'var(--border)';
  });
}

function setupVarButtons() {
  document.getElementById('varStdBtn').addEventListener('click', function() { varMode = 'std'; updateVarButtons(); updateVarianceChart(); });
  document.getElementById('varUltBtn').addEventListener('click', function() { varMode = 'ult'; updateVarButtons(); updateVarianceChart(); });
  ['dynamic', 'std', 'ult'].forEach(function(m) {
    var btn = document.getElementById('varSort' + m.charAt(0).toUpperCase() + m.slice(1) + 'Btn');
    if (!btn) return;
    btn.addEventListener('click', function() { varSortMode = m; updateVarSortButtons(); updateVarianceChart(); });
  });
  updateVarSortButtons();
}

function setupParallax() {
  var bgEl = document.querySelector('.bg-parallax');
  if (bgEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(function() {
          var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          var progress = Math.min(window.scrollY / Math.max(maxScroll, 1), 1);
          bgEl.style.transform = 'translate3d(0,' + (-progress * window.innerHeight * 0.2) + 'px,0)';
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
}
