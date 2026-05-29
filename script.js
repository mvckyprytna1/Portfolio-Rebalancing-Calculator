/** =========================================
 * 1. STORAGE & STATE MANAGEMENT
 * ========================================== */
const Storage = {
  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } 
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem(key); }
};

// Default Dummy Data
const defaultPortfolio = [
  { id: "1", code: "BBCA", name: "Bank Central Asia", lots: 10, buyPrice: 9000, currentPrice: 9500, targetPercent: 30 },
  { id: "2", code: "TLKM", name: "Telkom Indonesia", lots: 15, buyPrice: 3200, currentPrice: 3000, targetPercent: 20 }
];

const defaultSettings = {
  capital: 15000000,
  lotSize: 100,
  feeBuy: 0.15,
  feeSell: 0.25
};

let portfolio = Storage.get('prc_portfolio', defaultPortfolio);
let settings = Storage.get('prc_settings', defaultSettings);

/** =========================================
 * 2. FORMATTING HELPERS
 * ========================================== */
const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
const formatNumber = (val) => new Intl.NumberFormat('id-ID').format(val);
const formatPercent = (val) => Number(val).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
const parseIdString = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

/** =========================================
 * 3. CORE CALCULATIONS
 * ========================================== */
function calculateMetrics() {
  let totalInvested = 0;
  let totalMarketValue = 0;
  let totalNetProfit = 0;
  
  // Calculate individual stock metrics
  const processedPortfolio = portfolio.map(stock => {
    const totalShares = stock.lots * settings.lotSize;
    
    // Beli
    const nominalBeli = totalShares * stock.buyPrice;
    const feeBeliNominal = nominalBeli * (settings.feeBuy / 100);
    const totalCost = nominalBeli + feeBeliNominal;
    
    // Jual / Market Value
    const marketValue = totalShares * stock.currentPrice;
    const feeJualNominal = marketValue * (settings.feeSell / 100);
    const marketValueAfterFee = marketValue - feeJualNominal;
    
    // Profit
    const netProfit = marketValueAfterFee - totalCost;
    const netProfitPercent = (netProfit / totalCost) * 100;
    
    totalInvested += totalCost;
    totalMarketValue += marketValueAfterFee;
    totalNetProfit += netProfit;

    return {
      ...stock,
      totalShares,
      totalCost,
      marketValue: marketValueAfterFee,
      netProfit,
      netProfitPercent,
      isProfit: netProfit >= 0
    };
  });

  const sisaCash = settings.capital - totalInvested;
  const totalPortfolioValue = totalMarketValue + Math.max(0, sisaCash); // Asumsi cash dihitung sebagai aset liquid
  
  // Calculate allocations based on updated total portfolio value
  processedPortfolio.forEach(stock => {
    stock.allocationPercent = totalPortfolioValue > 0 ? (stock.marketValue / totalPortfolioValue) * 100 : 0;
  });

  return { 
    portfolio: processedPortfolio, 
    totalInvested, 
    totalMarketValue, 
    sisaCash, 
    totalNetProfit,
    totalPortfolioValue,
    netProfitPercent: totalInvested > 0 ? (totalNetProfit / totalInvested) * 100 : 0
  };
}

/** =========================================
 * 4. UI RENDERERS
 * ========================================== */
function renderApp() {
  const metrics = calculateMetrics();
  updateHeader(metrics);
  renderDashboardCards(metrics);
  renderTable(metrics);
  renderPieChart(metrics);
  populateSettingsForm();
}

function updateHeader(metrics) {
  document.getElementById('header-modal').textContent = formatCurrency(settings.capital);
  document.getElementById('header-market').textContent = formatCurrency(metrics.totalMarketValue);
  document.getElementById('header-cash').textContent = formatCurrency(metrics.sisaCash);
  
  const profitEl = document.getElementById('header-profit');
  profitEl.textContent = `${metrics.totalNetProfit >= 0 ? '+' : ''}${formatCurrency(metrics.totalNetProfit)} (${metrics.totalNetProfit >= 0 ? '+' : ''}${formatPercent(metrics.netProfitPercent)})`;
  profitEl.className = `text-lg md:text-xl font-bold ${metrics.totalNetProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`;
}

function renderDashboardCards(metrics) {
  document.getElementById('stat-invested').textContent = formatCurrency(metrics.totalInvested);
  document.getElementById('stat-count').textContent = `${metrics.portfolio.length} Emiten`;
  
  let best = { code: '-', netProfitPercent: -Infinity };
  let worst = { code: '-', netProfitPercent: Infinity };
  
  metrics.portfolio.forEach(s => {
    if (s.netProfitPercent > best.netProfitPercent) best = s;
    if (s.netProfitPercent < worst.netProfitPercent) worst = s;
  });

  document.getElementById('stat-best').textContent = best.code !== '-' ? `${best.code} (+${formatPercent(best.netProfitPercent)})` : '-';
  document.getElementById('stat-worst').textContent = worst.code !== '-' ? `${worst.code} (${formatPercent(worst.netProfitPercent)})` : '-';
}

function renderTable(metrics) {
  const tbody = document.getElementById('stock-table-body');
  tbody.innerHTML = '';
  
  if (metrics.portfolio.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-gray-500">Belum ada saham. Silakan tambah data.</td></tr>`;
    return;
  }

  metrics.portfolio.forEach(stock => {
    const profitClass = stock.isProfit ? 'text-profit font-semibold' : 'text-loss font-semibold';
    const profitSign = stock.isProfit ? '+' : '';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-4 py-3 font-bold text-slate-800">${stock.code}</td>
      <td class="px-4 py-3">${formatNumber(stock.lots)}</td>
      <td class="px-4 py-3">${formatCurrency(stock.buyPrice)}</td>
      <td class="px-4 py-3 font-medium">${formatCurrency(stock.currentPrice)}</td>
      <td class="px-4 py-3">${formatCurrency(stock.marketValue)}</td>
      <td class="px-4 py-3 ${profitClass}">${profitSign}${formatCurrency(stock.netProfit)} <br><span class="text-xs">(${profitSign}${formatPercent(stock.netProfitPercent)})</span></td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="w-8">${formatPercent(stock.allocationPercent)}</span>
          <div class="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div class="h-full bg-blue-500" style="width: ${stock.allocationPercent}%"></div>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-center">
        <button onclick="editStock('${stock.id}')" class="text-blue-600 hover:text-blue-800 p-1 mx-1" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button onclick="deleteStock('${stock.id}')" class="text-red-600 hover:text-red-800 p-1 mx-1" title="Hapus"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderPieChart(metrics) {
  const chart = document.getElementById('pie-chart');
  const legend = document.getElementById('pie-legend');
  legend.innerHTML = '';

  if (metrics.portfolio.length === 0 && metrics.sisaCash <= 0) {
    chart.style.background = 'conic-gradient(#e2e8f0 0% 100%)';
    return;
  }

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6366f1'];
  let conicData = [];
  let currentDegree = 0;
  
  // Add Cash to pie chart
  const cashPercent = metrics.totalPortfolioValue > 0 ? (metrics.sisaCash / metrics.totalPortfolioValue) * 100 : 0;
  if (cashPercent > 0) {
    const endDegree = currentDegree + (cashPercent * 3.6);
    conicData.push(`#94a3b8 ${currentDegree}deg ${endDegree}deg`); // Gray for cash
    currentDegree = endDegree;
    legend.innerHTML += `<div class="flex justify-between items-center"><span class="flex items-center"><span class="w-3 h-3 rounded-full mr-2" style="background:#94a3b8"></span>Cash</span><span>${formatPercent(cashPercent)}</span></div>`;
  }

  // Add Stocks
  metrics.portfolio.forEach((stock, idx) => {
    const color = colors[idx % colors.length];
    const pct = stock.allocationPercent;
    if (pct > 0) {
      const endDegree = currentDegree + (pct * 3.6);
      conicData.push(`${color} ${currentDegree}deg ${endDegree}deg`);
      currentDegree = endDegree;
      legend.innerHTML += `<div class="flex justify-between items-center"><span class="flex items-center"><span class="w-3 h-3 rounded-full mr-2" style="background:${color}"></span>${stock.code}</span><span>${formatPercent(pct)}</span></div>`;
    }
  });

  chart.style.background = `conic-gradient(${conicData.join(', ')})`;
}

/** =========================================
 * 5. REBALANCING LOGIC
 * ========================================== */
function runRebalance() {
  const metrics = calculateMetrics();
  const tbody = document.getElementById('rebalance-table-body');
  const warningEl = document.getElementById('rebalance-warning');
  const warningText = document.getElementById('warning-text');
  
  tbody.innerHTML = '';
  warningEl.classList.add('hidden');

  let totalTargetPercent = portfolio.reduce((sum, stock) => sum + parseFloat(stock.targetPercent), 0);
  
  if (totalTargetPercent > 100) {
    warningText.textContent = `Peringatan: Total target alokasi melebihi 100% (${totalTargetPercent}%). Mohon sesuaikan di menu edit saham.`;
    warningEl.classList.remove('hidden');
  } else if (totalTargetPercent < 100) {
    warningText.textContent = `Info: Terdapat sisa target alokasi sebesar ${formatPercent(100 - totalTargetPercent)} yang akan menjadi Cash.`;
    warningEl.classList.remove('hidden');
  }

  // Calculate target based on TOTAL PORTFOLIO VALUE (Cash + Market Value)
  const totalValue = metrics.totalPortfolioValue;

  metrics.portfolio.forEach(stock => {
    const targetValue = totalValue * (stock.targetPercent / 100);
    const diffValue = targetValue - stock.marketValue;
    
    let action = 'HOLD';
    let badgeClass = 'bg-hold';
    let estLots = 0;
    let estDana = 0;
    const pricePerLot = stock.currentPrice * settings.lotSize;

    // Tolerance of 1 lot value to prevent micro-adjustments
    if (Math.abs(diffValue) > pricePerLot) {
      if (diffValue > 0) {
        action = 'BUY';
        badgeClass = 'bg-blue-100 text-blue-800';
        estLots = Math.floor(diffValue / pricePerLot); // Conservative buy (floor)
        estDana = estLots * pricePerLot;
      } else {
        action = 'SELL';
        badgeClass = 'bg-red-100 text-red-800';
        estLots = Math.ceil(Math.abs(diffValue) / pricePerLot); // Conservative sell (ceil to get closer to target)
        // ensure we don't sell more than we have
        estLots = Math.min(estLots, stock.lots); 
        estDana = estLots * pricePerLot;
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-4 py-3 font-bold">${stock.code}</td>
      <td class="px-4 py-3 text-center">${formatPercent(stock.allocationPercent)}</td>
      <td class="px-4 py-3 text-center">${formatPercent(stock.targetPercent)}</td>
      <td class="px-4 py-3 text-center"><span class="badge ${badgeClass}">${action}</span></td>
      <td class="px-4 py-3 text-right font-semibold">${action !== 'HOLD' ? formatNumber(estLots) : '-'}</td>
      <td class="px-4 py-3 text-right text-gray-600">${action !== 'HOLD' ? formatCurrency(estDana) : '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

/** =========================================
 * 6. FORM & DATA HANDLERS
 * ========================================== */
document.getElementById('stock-form').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const id = document.getElementById('edit-id').value;
  const newStock = {
    id: id || parseIdString(),
    code: document.getElementById('input-code').value.toUpperCase(),
    name: document.getElementById('input-name').value,
    lots: parseFloat(document.getElementById('input-lots').value),
    targetPercent: parseFloat(document.getElementById('input-target').value),
    buyPrice: parseFloat(document.getElementById('input-buy').value),
    currentPrice: parseFloat(document.getElementById('input-current').value),
  };

  if (id) {
    const index = portfolio.findIndex(s => s.id === id);
    if (index !== -1) portfolio[index] = newStock;
    showToast('Saham berhasil diupdate', 'success');
  } else {
    portfolio.push(newStock);
    showToast('Saham berhasil ditambahkan', 'success');
  }

  Storage.set('prc_portfolio', portfolio);
  resetForm();
  renderApp();
  navigate('dashboard');
});

function editStock(id) {
  const stock = portfolio.find(s => s.id === id);
  if (!stock) return;

  document.getElementById('form-title').textContent = 'Edit Saham';
  document.getElementById('edit-id').value = stock.id;
  document.getElementById('input-code').value = stock.code;
  document.getElementById('input-name').value = stock.name || '';
  document.getElementById('input-lots').value = stock.lots;
  document.getElementById('input-target').value = stock.targetPercent;
  document.getElementById('input-buy').value = stock.buyPrice;
  document.getElementById('input-current').value = stock.currentPrice;

  navigate('add-stock');
}

function deleteStock(id) {
  if (confirm('Yakin ingin menghapus saham ini?')) {
    portfolio = portfolio.filter(s => s.id !== id);
    Storage.set('prc_portfolio', portfolio);
    renderApp();
    showToast('Saham dihapus', 'info');
  }
}

function resetForm() {
  document.getElementById('stock-form').reset();
  document.getElementById('edit-id').value = '';
  document.getElementById('form-title').textContent = 'Tambah Saham Baru';
}

/** =========================================
 * 7. SETTINGS & UTILS
 * ========================================== */
function populateSettingsForm() {
  document.getElementById('setting-capital').value = settings.capital;
  document.getElementById('setting-fee-buy').value = settings.feeBuy;
  document.getElementById('setting-fee-sell').value = settings.feeSell;
}

function saveSettings() {
  settings.capital = parseFloat(document.getElementById('setting-capital').value) || 0;
  settings.feeBuy = parseFloat(document.getElementById('setting-fee-buy').value) || 0;
  settings.feeSell = parseFloat(document.getElementById('setting-fee-sell').value) || 0;
  
  Storage.set('prc_settings', settings);
  renderApp();
  showToast('Pengaturan disimpan', 'success');
}

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ settings, portfolio }));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", "portfolio_backup.json");
  dlAnchorElem.click();
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.settings) { settings = data.settings; Storage.set('prc_settings', settings); }
      if (data.portfolio) { portfolio = data.portfolio; Storage.set('prc_portfolio', portfolio); }
      renderApp();
      showToast('Data berhasil diimport', 'success');
    } catch (err) {
      showToast('Gagal import file JSON', 'error');
    }
  };
  reader.readAsText(file);
}

function resetData() {
  if (confirm('PERINGATAN! Semua data saham dan pengaturan akan hilang. Lanjutkan?')) {
    Storage.remove('prc_portfolio');
    Storage.remove('prc_settings');
    portfolio = [];
    settings = defaultSettings;
    renderApp();
    showToast('Data telah direset', 'info');
  }
}

/** =========================================
 * 8. NAVIGATION & EFFECTS
 * ========================================== */
function navigate(sectionId) {
  // Hide all sections
  document.querySelectorAll('.page-section').forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('block');
  });
  
  // Remove active state from nav
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  
  // Show target section
  document.getElementById(`sec-${sectionId}`).classList.remove('hidden');
  document.getElementById(`sec-${sectionId}`).classList.add('block');
  
  // Update nav active state (Desktop)
  const targetNav = document.querySelector(`nav a[onclick="navigate('${sectionId}')"]`);
  if (targetNav) targetNav.classList.add('active');

  // Specific triggers based on navigation
  if (sectionId === 'rebalance') runRebalance();
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const iconEl = document.getElementById('toast-icon');

  msgEl.textContent = msg;
  if (type === 'success') {
    iconEl.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i>';
  } else if (type === 'error') {
    iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark text-red-400"></i>';
  } else {
    iconEl.innerHTML = '<i class="fa-solid fa-circle-info text-blue-400"></i>';
  }

  toast.classList.add('slide-up');
  
  setTimeout(() => {
    toast.classList.remove('slide-up');
  }, 3000);
}

// INIT
window.addEventListener('DOMContentLoaded', () => {
  renderApp();
});