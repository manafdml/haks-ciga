// Hak's Ciga Co — Sales & Inventory (v3: Supabase-backed)
// Auth: Supabase Auth (email + password)
// Data: tables `product_settings`, `purchases`, `sales`

const PRODUCTS = [
  { id: 'gosale',  name: 'Gold Seal', badge: 'GS', cls: 'b-gosale'  },
  { id: 'rothman', name: 'Rothman', badge: 'R', cls: 'b-rothman' },
  { id: 'oris',    name: 'Oris',    badge: 'O', cls: 'b-oris'    },
];

const blankProduct = () => ({
  stock: 0, avgCost: 0, sellingPrice: 0, purchases: [], sales: [],
});
const blankData = () => ({
  products: { gosale: blankProduct(), rothman: blankProduct(), oris: blankProduct() }
});

let supa = null;
let data = blankData();
let currentProductId = null;

// ---- Helpers ----
const $ = (id) => document.getElementById(id);
const fmt = (n) => 'GHS ' + (Number(n) || 0).toFixed(2);
const todayStr = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
};
function toast(msg, type = 'ok') {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('error', type === 'error');
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  $(id).scrollTop = 0;
}
function plClass(v) { return v > 0 ? 'pl-pos' : v < 0 ? 'pl-neg' : 'pl-zero'; }

// ---- Supabase init ----
function initSupabase() {
  const cfg = window.HAKS_CONFIG;
  if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('PASTE') ||
      !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes('PASTE')) {
    return null;
  }
  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase JS SDK not loaded');
    return null;
  }
  return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
}

// ---- Data load + replay ----
async function loadAllData() {
  data = blankData();
  const [settingsRes, purchasesRes, salesRes] = await Promise.all([
    supa.from('product_settings').select('*'),
    supa.from('purchases').select('*').order('created_at', { ascending: true }),
    supa.from('sales').select('*').order('created_at', { ascending: true }),
  ]);
  if (settingsRes.error) throw settingsRes.error;
  if (purchasesRes.error) throw purchasesRes.error;
  if (salesRes.error) throw salesRes.error;

  for (const s of settingsRes.data) {
    if (data.products[s.product_id]) {
      data.products[s.product_id].sellingPrice = Number(s.selling_price) || 0;
    }
  }

  for (const pid of Object.keys(data.products)) {
    const pps = purchasesRes.data.filter(p => p.product_id === pid);
    const sss = salesRes.data.filter(s => s.product_id === pid);
    // Event-replay the timeline so weighted avg cost is correct
    const events = [
      ...pps.map(p => ({ kind: 'buy',  ts: p.created_at, p })),
      ...sss.map(s => ({ kind: 'sell', ts: s.created_at, s })),
    ].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    let stock = 0, avgCost = 0;
    for (const e of events) {
      if (e.kind === 'buy') {
        const pieces = e.p.boxes * e.p.pieces_per_box;
        const cost = e.p.boxes * Number(e.p.cost_per_box);
        const newStock = stock + pieces;
        avgCost = newStock > 0 ? (stock * avgCost + cost) / newStock : 0;
        stock = newStock;
      } else {
        stock -= e.s.qty;
      }
    }
    data.products[pid].stock = stock;
    data.products[pid].avgCost = avgCost;
    data.products[pid].purchases = pps;
    data.products[pid].sales = sss.map(s => ({
      id: s.id,
      qty: s.qty,
      price: Number(s.price),
      cost: Number(s.cost),
      date: s.sale_date,
      ts: new Date(s.created_at).getTime(),
    }));
  }
}

// ---- Stats ----
function productStats(pid) {
  const p = data.products[pid];
  const today = todayStr();
  let revT = 0, costT = 0, qT = 0;
  let revA = 0, costA = 0, qA = 0;
  for (const s of p.sales) {
    revA += s.qty * s.price; costA += s.qty * s.cost; qA += s.qty;
    if (s.date === today) { revT += s.qty * s.price; costT += s.qty * s.cost; qT += s.qty; }
  }
  return {
    stock: p.stock, avgCost: p.avgCost, sellingPrice: p.sellingPrice,
    unitsToday: qT, revToday: revT, plToday: revT - costT,
    unitsAll: qA, revAll: revA, plAll: revA - costA,
  };
}

// ---- Auth ----
async function tryLogin() {
  if (!supa) {
    $('login-error').textContent = 'Database not configured. Open js/config.js and paste your Supabase URL + anon key.';
    return;
  }
  const email = $('login-username').value.trim();
  const password = $('login-password').value;
  if (!email || !password) {
    $('login-error').textContent = 'Enter your email and password';
    return;
  }
  $('btn-login').disabled = true;
  $('btn-login').textContent = 'Signing in...';
  const { error } = await supa.auth.signInWithPassword({ email, password });
  $('btn-login').disabled = false;
  $('btn-login').textContent = 'Login';
  if (error) {
    $('login-error').textContent = error.message;
    return;
  }
  $('login-error').textContent = '';
  $('login-password').value = '';
  try {
    await loadAllData();
    openDashboard();
  } catch (e) {
    $('login-error').textContent = 'Failed to load data: ' + (e.message || e);
  }
}

async function logout() {
  if (supa) await supa.auth.signOut();
  data = blankData();
  showScreen('screen-login');
}

// ---- Dashboard ----
function openDashboard() {
  $('today-label').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
  });
  renderDashboard();
  showScreen('screen-dashboard');
}

function renderDashboard() {
  let revT = 0, plT = 0, qT = 0, stk = 0;
  const grid = $('product-grid');
  grid.innerHTML = '';
  for (const meta of PRODUCTS) {
    const s = productStats(meta.id);
    revT += s.revToday; plT += s.plToday; qT += s.unitsToday; stk += s.stock;
    const tile = document.createElement('div');
    tile.className = 'product-tile';
    tile.innerHTML = `
      <div class="tile-left">
        <div class="tile-badge ${meta.cls}">${meta.badge}</div>
        <div>
          <div class="tile-name">${meta.name}</div>
          <div class="tile-sub">Stock: <b>${s.stock}</b> pcs · Sold today: <b>${s.unitsToday}</b></div>
        </div>
      </div>
      <div class="tile-right">
        <div class="tile-sub">${fmt(s.revToday)}</div>
        <div class="tile-pl ${plClass(s.plToday)}">${s.plToday >= 0 ? '+' : ''}${fmt(s.plToday)}</div>
      </div>
    `;
    tile.addEventListener('click', () => openProduct(meta.id));
    grid.appendChild(tile);
  }
  $('today-revenue').textContent = fmt(revT);
  $('today-profit').textContent = (plT >= 0 ? '+' : '') + fmt(plT);
  $('today-profit').className = 'summary-value ' + plClass(plT);
  $('today-units').textContent = qT;
  $('total-stock').textContent = stk;
}

// ---- Product detail ----
function openProduct(pid) {
  currentProductId = pid;
  const meta = PRODUCTS.find(p => p.id === pid);
  $('product-title').textContent = meta.name;
  $('sale-date').value = todayStr();
  $('sale-qty').value = '';
  $('buy-boxes').value = '';
  $('buy-cost').value = '';
  $('buy-ppb').value = '';
  $('purchase-hint').textContent = '';
  renderProduct();
  showScreen('screen-product');
}

function renderProduct() {
  const pid = currentProductId;
  const s = productStats(pid);
  $('p-stock').textContent = s.stock;
  $('p-cost').textContent = fmt(s.avgCost);
  $('p-sold-today').textContent = s.unitsToday;
  const pl = $('p-pl-today');
  pl.textContent = (s.plToday >= 0 ? '+' : '') + fmt(s.plToday);
  pl.className = 'stat-value ' + plClass(s.plToday);
  $('price-input').value = s.sellingPrice || '';

  const list = $('recent-sales');
  list.innerHTML = '';
  const sales = data.products[pid].sales.slice(-10).reverse();
  if (sales.length === 0) {
    list.innerHTML = '<li style="justify-content:center;color:var(--muted)">No sales recorded yet</li>';
  } else {
    for (const sale of sales) {
      const li = document.createElement('li');
      const pl = (sale.price - sale.cost) * sale.qty;
      li.innerHTML = `
        <span><b>${sale.qty}</b> pcs · ${fmt(sale.qty * sale.price)}
          <span class="${plClass(pl)}"> (${pl >= 0 ? '+' : ''}${fmt(pl)})</span>
        </span>
        <span class="when">${sale.date}</span>
      `;
      list.appendChild(li);
    }
  }
}

async function recordDaySales() {
  const date = $('sale-date').value || todayStr();
  const qty = Number($('sale-qty').value);
  if (!qty || qty < 1) return toast('Enter pieces sold', 'error');
  const p = data.products[currentProductId];
  if (p.sellingPrice <= 0) return toast('Set selling price first', 'error');
  if (p.avgCost <= 0) return toast('Add a purchase first', 'error');
  if (qty > p.stock) return toast(`Only ${p.stock} pcs in stock`, 'error');

  const btn = $('btn-record-day');
  btn.disabled = true;
  const { data: row, error } = await supa.from('sales').insert({
    product_id: currentProductId,
    qty, price: p.sellingPrice, cost: p.avgCost,
    sale_date: date,
  }).select().single();
  btn.disabled = false;
  if (error) return toast('Save failed: ' + error.message, 'error');

  p.stock -= qty;
  p.sales.push({
    id: row.id,
    qty, price: p.sellingPrice, cost: p.avgCost,
    date, ts: new Date(row.created_at).getTime(),
  });
  $('sale-qty').value = '';
  renderProduct();
  toast(`Recorded ${qty} pcs for ${date} ✓`);
}

async function addPurchase() {
  const boxes = Number($('buy-boxes').value);
  const costPerBox = Number($('buy-cost').value);
  const piecesPerBox = Number($('buy-ppb').value);
  if (!boxes || boxes < 1) return toast('Enter number of boxes', 'error');
  if (!costPerBox || costPerBox <= 0) return toast('Enter cost per box', 'error');
  if (!piecesPerBox || piecesPerBox < 1) return toast('Enter pieces per box', 'error');

  const btn = $('btn-add-purchase');
  btn.disabled = true;
  const { data: row, error } = await supa.from('purchases').insert({
    product_id: currentProductId,
    boxes, cost_per_box: costPerBox, pieces_per_box: piecesPerBox,
  }).select().single();
  btn.disabled = false;
  if (error) return toast('Save failed: ' + error.message, 'error');

  const p = data.products[currentProductId];
  const addedPieces = boxes * piecesPerBox;
  const addedCost = boxes * costPerBox;
  const newStock = p.stock + addedPieces;
  p.avgCost = newStock > 0 ? (p.stock * p.avgCost + addedCost) / newStock : 0;
  p.stock = newStock;
  p.purchases.push(row);

  $('buy-boxes').value = '';
  $('buy-cost').value = '';
  $('buy-ppb').value = '';
  $('purchase-hint').textContent =
    `+${addedPieces} pcs added · new avg cost ${fmt(p.avgCost)} / piece`;
  renderProduct();
  toast(`Added ${boxes} box${boxes > 1 ? 'es' : ''} (${addedPieces} pcs)`);
}

async function saveSellingPrice() {
  const price = Number($('price-input').value);
  if (!price || price <= 0) return toast('Enter a valid price', 'error');
  const btn = $('btn-save-price');
  btn.disabled = true;
  const { error } = await supa.from('product_settings')
    .update({ selling_price: price })
    .eq('product_id', currentProductId);
  btn.disabled = false;
  if (error) return toast('Save failed: ' + error.message, 'error');
  data.products[currentProductId].sellingPrice = price;
  renderProduct();
  toast('Selling price saved ✓');
}

async function resetProduct() {
  const meta = PRODUCTS.find(m => m.id === currentProductId);
  if (!confirm(`Reset all data for ${meta.name}? This permanently deletes purchases and sales from the database.`)) return;
  const pid = currentProductId;
  const btn = $('btn-reset-prod');
  btn.disabled = true;
  const [d1, d2, d3] = await Promise.all([
    supa.from('sales').delete().eq('product_id', pid),
    supa.from('purchases').delete().eq('product_id', pid),
    supa.from('product_settings').update({ selling_price: 0 }).eq('product_id', pid),
  ]);
  btn.disabled = false;
  if (d1.error || d2.error || d3.error) {
    return toast('Reset failed', 'error');
  }
  data.products[pid] = blankProduct();
  toast('Reset done');
  showScreen('screen-dashboard');
  renderDashboard();
}

// ---- Combined ----
function openCombined() {
  let revT = 0, plT = 0, revA = 0, plA = 0;
  const wrap = $('combined-breakdown');
  wrap.innerHTML = '';
  for (const meta of PRODUCTS) {
    const s = productStats(meta.id);
    revT += s.revToday; plT += s.plToday; revA += s.revAll; plA += s.plAll;
    const row = document.createElement('div');
    row.className = 'cb-row';
    row.innerHTML = `
      <div class="cb-name">${meta.name}</div>
      <div class="cb-line"><span>Stock left</span><b>${s.stock} pcs</b></div>
      <div class="cb-line"><span>Avg cost / piece</span><b>${fmt(s.avgCost)}</b></div>
      <div class="cb-line"><span>Selling / piece</span><b>${fmt(s.sellingPrice)}</b></div>
      <div class="cb-line"><span>Sold today</span><b>${s.unitsToday} pcs</b></div>
      <div class="cb-line"><span>Revenue today</span><b>${fmt(s.revToday)}</b></div>
      <div class="cb-line"><span>P/L today</span><b class="${plClass(s.plToday)}">${s.plToday >= 0 ? '+' : ''}${fmt(s.plToday)}</b></div>
      <div class="cb-line"><span>All-time pcs sold</span><b>${s.unitsAll}</b></div>
      <div class="cb-line"><span>All-time P/L</span><b class="${plClass(s.plAll)}">${s.plAll >= 0 ? '+' : ''}${fmt(s.plAll)}</b></div>
    `;
    wrap.appendChild(row);
  }
  $('c-today-rev').textContent = fmt(revT);
  $('c-today-pl').textContent = (plT >= 0 ? '+' : '') + fmt(plT);
  $('c-today-pl').className = 'summary-value ' + plClass(plT);
  $('c-all-rev').textContent = fmt(revA);
  $('c-all-pl').textContent = (plA >= 0 ? '+' : '') + fmt(plA);
  $('c-all-pl').className = 'summary-value ' + plClass(plA);
  showScreen('screen-combined');
}

// ---- Wire up ----
document.addEventListener('DOMContentLoaded', async () => {
  $('btn-login').addEventListener('click', tryLogin);
  $('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
  $('login-username').addEventListener('keydown', e => { if (e.key === 'Enter') $('login-password').focus(); });
  $('btn-logout').addEventListener('click', logout);

  $('btn-combined').addEventListener('click', openCombined);
  $('btn-record-day').addEventListener('click', recordDaySales);
  $('btn-add-purchase').addEventListener('click', addPurchase);
  $('btn-save-price').addEventListener('click', saveSellingPrice);
  $('btn-reset-prod').addEventListener('click', resetProduct);

  document.querySelectorAll('[data-back]').forEach(b => {
    b.addEventListener('click', () => {
      const target = b.dataset.back;
      showScreen(target);
      if (target === 'screen-dashboard') renderDashboard();
    });
  });

  supa = initSupabase();
  if (!supa) {
    $('login-error').textContent = 'Setup needed — open js/config.js and paste your Supabase URL + anon key.';
    return;
  }

  // Auto-resume session if previously signed in
  const { data: { session } } = await supa.auth.getSession();
  if (session) {
    try {
      await loadAllData();
      openDashboard();
    } catch (e) {
      console.error(e);
      $('login-error').textContent = 'Could not load data — check the SQL tables exist.';
    }
  }
});
