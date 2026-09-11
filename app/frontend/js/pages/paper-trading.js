const STORAGE_KEY = 'jsh_paper_trading_v1';
const INITIAL_CASH = 100_000_000;
const ASSETS = [
  { symbol: '005930', name: '삼성전자', type: '주식', price: 79000 },
  { symbol: '000660', name: 'SK하이닉스', type: '주식', price: 285000 },
  { symbol: '035420', name: 'NAVER', type: '주식', price: 235000 },
  { symbol: '005380', name: '현대차', type: '주식', price: 226000 },
  { symbol: 'BTC', name: '비트코인', type: '코인', price: 155000000 },
  { symbol: 'ETH', name: '이더리움', type: '코인', price: 6400000 },
  { symbol: 'XRP', name: '리플', type: '코인', price: 4200 },
];

const fmt = (v, digits = 0) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits }).format(Number(v) || 0);
const money = (v) => `${fmt(v)}원`;
const now = () => new Date().toLocaleString('ko-KR');

function initialState() { return { cash: INITIAL_CASH, positions: {}, history: [] }; }
function loadState() {
  try { return { ...initialState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return initialState(); }
}
function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function asset(symbol) { return ASSETS.find((item) => item.symbol === symbol); }

const container = document.getElementById('page-content');
let state = loadState();

function execute(side) {
  const symbol = container.querySelector('#paper-symbol').value;
  const item = asset(symbol);
  const qty = Number(container.querySelector('#paper-qty').value);
  const price = Number(container.querySelector('#paper-price').value);
  const message = container.querySelector('#paper-message');
  if (!item || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
    message.textContent = '가격과 수량을 0보다 큰 숫자로 입력해 주세요.'; message.className = 'paper-message error'; return;
  }
  const amount = price * qty;
  const current = state.positions[symbol] || { symbol, name: item.name, type: item.type, quantity: 0, avgPrice: 0 };
  if (side === 'BUY') {
    if (amount > state.cash) { message.textContent = '보유 현금이 부족합니다.'; message.className = 'paper-message error'; return; }
    const totalCost = current.avgPrice * current.quantity + amount;
    current.quantity += qty;
    current.avgPrice = totalCost / current.quantity;
    state.cash -= amount;
    state.positions[symbol] = current;
  } else {
    if (qty > current.quantity) { message.textContent = '보유 수량보다 많이 매도할 수 없습니다.'; message.className = 'paper-message error'; return; }
    state.cash += amount;
    current.quantity -= qty;
    if (current.quantity <= 0) delete state.positions[symbol]; else state.positions[symbol] = current;
  }
  state.history.unshift({ id: crypto.randomUUID?.() || String(Date.now()), at: now(), side, symbol, name: item.name, type: item.type, quantity: qty, price, amount });
  state.history = state.history.slice(0, 200);
  saveState(state);
  message.textContent = `${item.name} ${side === 'BUY' ? '매수' : '매도'} 모의 체결: ${fmt(qty, 8)} × ${money(price)}`;
  message.className = 'paper-message ok';
  renderAccount();
}

function renderAccount() {
  const positions = Object.values(state.positions);
  const evalAmount = positions.reduce((sum, p) => sum + p.quantity * (asset(p.symbol)?.price || p.avgPrice), 0);
  const costAmount = positions.reduce((sum, p) => sum + p.quantity * p.avgPrice, 0);
  const pnl = evalAmount - costAmount;
  container.querySelector('#paper-summary').innerHTML = `
    <article><span>보유 현금</span><strong>${money(state.cash)}</strong></article>
    <article><span>주식·코인 평가액</span><strong>${money(evalAmount)}</strong></article>
    <article><span>총 모의자산</span><strong>${money(state.cash + evalAmount)}</strong></article>
    <article><span>평가손익</span><strong class="${pnl >= 0 ? 'up' : 'down'}">${pnl >= 0 ? '+' : ''}${money(pnl)}</strong></article>`;

  container.querySelector('#paper-positions').innerHTML = positions.length ? positions.map((p) => {
    const current = asset(p.symbol)?.price || p.avgPrice;
    const value = current * p.quantity;
    const profit = value - p.avgPrice * p.quantity;
    const rate = p.avgPrice ? (current / p.avgPrice - 1) * 100 : 0;
    return `<tr><td><b>${p.name}</b><small>${p.type} · ${p.symbol}</small></td><td>${fmt(p.quantity, 8)}</td><td>${money(p.avgPrice)}</td><td>${money(current)}</td><td>${money(value)}</td><td class="${profit >= 0 ? 'up' : 'down'}">${profit >= 0 ? '+' : ''}${money(profit)}<small>${rate.toFixed(2)}%</small></td></tr>`;
  }).join('') : '<tr><td colspan="6" class="empty">아직 보유한 모의자산이 없습니다.</td></tr>';

  container.querySelector('#paper-history').innerHTML = state.history.length ? state.history.map((h) => `<tr><td>${h.at}</td><td><span class="side ${h.side.toLowerCase()}">${h.side === 'BUY' ? '매수' : '매도'}</span></td><td><b>${h.name}</b><small>${h.type} · ${h.symbol}</small></td><td>${fmt(h.quantity, 8)}</td><td>${money(h.price)}</td><td>${money(h.amount)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">거래이력이 없습니다.</td></tr>';
}

function render() {
  container.innerHTML = `
  <section class="paper-page">
    <div class="page-heading"><div><h1><i class="fa-solid fa-coins"></i> 모의투자 실습</h1><p>참고 서비스의 주식·코인 주문, 보유자산, 거래이력 흐름을 JSH Learning에 맞게 통합한 브라우저 모의계좌입니다.</p></div><button id="paper-reset" class="paper-secondary"><i class="fa-solid fa-rotate-left"></i> 계좌 초기화</button></div>
    <aside class="resource-safety-note"><i class="fa-solid fa-shield-halved"></i><span><b>실제 주문은 전송되지 않습니다.</b> 초기 가상현금 1억원을 브라우저에 저장하며, 현재 단계의 가격은 실습용 기준값입니다. 새로고침해도 같은 브라우저에서는 계좌가 유지됩니다.</span></aside>
    <div id="paper-summary" class="paper-summary"></div>
    <div class="paper-grid">
      <section class="paper-card">
        <div class="paper-card-head"><div><small>ORDER</small><h2>주식 · 코인 모의 주문</h2></div><a href="avg-down.html">물타기 계산기 <i class="fa-solid fa-arrow-right"></i></a></div>
        <label>종목<select id="paper-symbol" class="param-input">${ASSETS.map((a) => `<option value="${a.symbol}">${a.name} · ${a.type} (${a.symbol})</option>`).join('')}</select></label>
        <div class="paper-two"><label>체결 가격<input id="paper-price" class="param-input" type="number" min="0" step="any"></label><label>수량<input id="paper-qty" class="param-input" type="number" min="0" step="any" value="1"></label></div>
        <div id="paper-order-preview" class="paper-preview"></div>
        <div class="paper-actions"><button id="paper-buy" class="paper-buy"><i class="fa-solid fa-arrow-trend-up"></i> 매수</button><button id="paper-sell" class="paper-sell"><i class="fa-solid fa-arrow-trend-down"></i> 매도</button></div>
        <p id="paper-message" class="paper-message"></p>
      </section>
      <section class="paper-card">
        <div class="paper-card-head"><div><small>OPEN API LAB</small><h2>현재 앱 API 실습</h2></div><a href="/docs" target="_blank" rel="noopener">Swagger <i class="fa-solid fa-arrow-up-right-from-square"></i></a></div>
        <p class="paper-copy">기준 앱에 이미 있는 FastAPI를 OpenAPI 실습 화면으로 연결했습니다. 키를 발급하거나 실계좌를 연결하지 않고 읽기/분석 API부터 확인할 수 있습니다.</p>
        <div class="paper-api-list"><code>GET /api/health</code><code>POST /api/market/snapshot</code><code>POST /api/quant/backtest</code><code>POST /api/quant/portfolio</code></div>
        <button id="paper-health" class="paper-secondary"><i class="fa-solid fa-plug-circle-check"></i> API 상태 테스트</button><pre id="paper-api-result">Swagger 문서 또는 상태 테스트를 이용하세요.</pre>
      </section>
    </div>
    <section class="paper-card paper-table-card"><div class="paper-card-head"><div><small>POSITIONS</small><h2>보유자산</h2></div></div><div class="paper-table-wrap"><table><thead><tr><th>자산</th><th>수량</th><th>평균단가</th><th>기준가</th><th>평가금액</th><th>평가손익</th></tr></thead><tbody id="paper-positions"></tbody></table></div></section>
    <section class="paper-card paper-table-card"><div class="paper-card-head"><div><small>HISTORY</small><h2>거래이력</h2></div></div><div class="paper-table-wrap"><table><thead><tr><th>시간</th><th>구분</th><th>자산</th><th>수량</th><th>체결가</th><th>체결금액</th></tr></thead><tbody id="paper-history"></tbody></table></div></section>
  </section>
  <style>
    .paper-page{max-width:1240px;margin:auto}.paper-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}.paper-summary article,.paper-card{background:#fff;border:1px solid #e2e8f0;border-radius:15px;box-shadow:0 5px 20px rgba(15,23,42,.04)}.paper-summary article{padding:16px}.paper-summary span{display:block;color:#64748b;font-size:12px;font-weight:700}.paper-summary strong{display:block;margin-top:7px;font-size:20px;color:#0f172a}.paper-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.paper-card{padding:20px}.paper-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px}.paper-card-head small{font-weight:800;color:#2563eb}.paper-card-head h2{font-size:18px;margin:3px 0 0}.paper-card-head a{font-size:12px;font-weight:700;color:#2563eb;text-decoration:none}.paper-card label{display:grid;gap:6px;font-size:12px;font-weight:700;color:#475569;margin-bottom:12px}.paper-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.paper-preview{padding:11px 12px;border-radius:9px;background:#f8fafc;color:#475569;font-size:13px}.paper-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.paper-actions button,.paper-secondary{border:0;border-radius:9px;padding:11px 14px;font-weight:800;cursor:pointer}.paper-buy{background:#fff1f2;color:#be123c}.paper-sell{background:#eff6ff;color:#1d4ed8}.paper-secondary{background:#f1f5f9;color:#334155}.paper-message{min-height:20px;font-size:13px;margin:12px 0 0}.paper-message.error,.down{color:#2563eb}.paper-message.ok,.up{color:#dc2626}.paper-copy{font-size:13px;color:#64748b;line-height:1.7}.paper-api-list{display:grid;gap:7px;margin:14px 0}.paper-api-list code{padding:9px 11px;background:#0f172a;color:#e2e8f0;border-radius:7px;font-size:12px}.paper-card pre{margin:12px 0 0;padding:12px;background:#f8fafc;border-radius:8px;white-space:pre-wrap;font-size:12px}.paper-table-card{margin-top:16px}.paper-table-wrap{overflow:auto}.paper-table-card table{width:100%;border-collapse:collapse;font-size:13px}.paper-table-card th,.paper-table-card td{text-align:right;padding:11px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.paper-table-card th:first-child,.paper-table-card td:first-child,.paper-table-card td:nth-child(3){text-align:left}.paper-table-card td small{display:block;color:#94a3b8;margin-top:3px}.side{font-weight:800}.side.buy{color:#dc2626}.side.sell{color:#2563eb}.empty{text-align:center!important;color:#94a3b8;padding:30px!important}@media(max-width:900px){.paper-summary{grid-template-columns:1fr 1fr}.paper-grid{grid-template-columns:1fr}}@media(max-width:560px){.paper-summary,.paper-two{grid-template-columns:1fr}.paper-card{padding:15px}}
  </style>`;

  const select = container.querySelector('#paper-symbol'); const price = container.querySelector('#paper-price'); const qty = container.querySelector('#paper-qty'); const preview = container.querySelector('#paper-order-preview');
  const updatePreview = () => { const item = asset(select.value); if (!price.value) price.value = item.price; preview.textContent = `${item.name} · 실습 기준가 ${money(item.price)} · 예상 주문금액 ${money(Number(price.value) * Number(qty.value || 0))}`; };
  select.addEventListener('change', () => { price.value = asset(select.value).price; updatePreview(); }); price.addEventListener('input', updatePreview); qty.addEventListener('input', updatePreview);
  container.querySelector('#paper-buy').addEventListener('click', () => execute('BUY')); container.querySelector('#paper-sell').addEventListener('click', () => execute('SELL'));
  container.querySelector('#paper-reset').addEventListener('click', () => { if (!confirm('모의계좌와 거래이력을 초기화할까요?')) return; state = initialState(); saveState(state); renderAccount(); container.querySelector('#paper-message').textContent = '모의계좌를 초기화했습니다.'; });
  container.querySelector('#paper-health').addEventListener('click', async () => { const out = container.querySelector('#paper-api-result'); out.textContent='조회 중...'; try { const res=await fetch('/api/health'); const data=await res.json(); out.textContent=JSON.stringify(data,null,2); } catch(e){ out.textContent=`API 연결 실패: ${e.message}`; } });
  updatePreview(); renderAccount();
}

if (container) render();
