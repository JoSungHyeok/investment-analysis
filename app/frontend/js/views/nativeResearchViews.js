
import { installTheory } from '../research/theory.js';

const holder = {};
installTheory(holder);
const DAYS = holder.THEORY_DAYS || [];

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}

export function financeTheoryView(container, selectedDay = null) {
  const days = selectedDay ? DAYS.filter(d => Number(d.day) === Number(selectedDay)) : DAYS;
  container.innerHTML = `
    <h1 style="font-size:1.25rem"><i class="fa-solid fa-graduation-cap"></i> 4일 금융 이론</h1>
    <div style="display:grid;gap:16px">
      ${days.map(day => `<section class="card">
        <h2>${day.day}일차 · ${esc(day.title)}</h2>
        <p style="color:#64748b">${esc(day.subtitle || '')}</p>
        <p><strong>학습 목표</strong><br>${esc(day.goal || '')}</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0">
          ${(day.keywords || []).map(k => `<span class="badge badge-gray">${esc(k)}</span>`).join('')}
        </div>
        ${(day.lessons || []).map((lesson,i) => `<details ${i===0?'open':''}
          style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-top:8px">
          <summary style="cursor:pointer;font-weight:700">${esc(lesson[0])}</summary>
          ${(lesson[1] || []).map(p => `<p style="line-height:1.7;color:#475569">${esc(p)}</p>`).join('')}
        </details>`).join('')}
      </section>`).join('')}
    </div>`;
}

export function basisLabView(container) {
  container.innerHTML = `<section class="card" style="max-width:900px;margin:auto">
    <h2><i class="fa-solid fa-calculator"></i> 선물 베이시스</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
      <label>현물가격<input id="basis-spot" class="param-input" type="number" step=".01" value="400"></label>
      <label>선물가격<input id="basis-future" class="param-input" type="number" step=".01" value="402"></label>
      <label>잔존일수<input id="basis-days" class="param-input" type="number" min="1" value="30"></label>
    </div>
    <button id="basis-run" class="btn btn-primary" style="margin-top:14px">계산</button>
    <div id="basis-result" style="margin-top:16px"></div>
  </section>`;
  const run = () => {
    const spot = Number(container.querySelector('#basis-spot').value);
    const future = Number(container.querySelector('#basis-future').value);
    const days = Math.max(1, Number(container.querySelector('#basis-days').value));
    const basis = future - spot;
    const pct = spot ? basis / spot * 100 : 0;
    const annualized = spot ? (future / spot - 1) * (365 / days) * 100 : 0;
    container.querySelector('#basis-result').innerHTML =
      `<p><strong>베이시스 ${basis.toFixed(2)}</strong> · ${pct.toFixed(3)}% · 단순 연환산 ${annualized.toFixed(2)}%</p>
       <p style="color:#64748b">양수는 콘탱고, 음수는 백워데이션입니다. 교육용 단순 계산입니다.</p>`;
  };
  container.querySelector('#basis-run').addEventListener('click', run);
  run();
}

const CALENDAR = [
  ['2026-09-10','한국','코스피200 선물·옵션 동시만기일'],
  ['2026-09-11','미국','8월 CPI 발표'],
  ['2026-09-17','미국','FOMC 9월 정례회의 금리 결정'],
  ['2026-09-18','미국','주가지수·주식 파생상품 동시만기'],
];

export function financeCalendarView(container) {
  container.innerHTML = `<h1 style="font-size:1.25rem"><i class="fa-solid fa-calendar-days"></i> 금융 캘린더</h1>
    <section class="card">${CALENDAR.map(([date,market,title]) =>
      `<article style="display:grid;grid-template-columns:110px 70px 1fr;gap:12px;padding:12px;border-bottom:1px solid #e2e8f0">
        <time>${date}</time><strong>${market}</strong><span>${title}</span>
      </article>`).join('')}</section>`;
}

export function stockAtlasView(container) {
  container.innerHTML = `<section class="card">
    <h2><i class="fa-solid fa-magnifying-glass-chart"></i> 종목 아틀라스</h2>
    <form id="atlas-form" style="display:flex;gap:8px">
      <input id="atlas-query" class="param-input" value="삼성전자" placeholder="삼성전자, NVDA, Apple">
      <button class="btn btn-primary" type="submit">검색</button>
    </form>
    <div id="atlas-result" style="margin-top:16px"></div>
  </section>`;
  const result = container.querySelector('#atlas-result');
  async function search() {
    const q = container.querySelector('#atlas-query').value.trim();
    if (!q) return;
    result.textContent = '검색 중…';
    try {
      const res = await fetch(`/api/home/chart-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '검색 실패');
      result.innerHTML = (data.items || []).map(item =>
        `<button type="button" class="atlas-item" data-ticker="${esc(item.ticker)}"
          style="display:block;width:100%;text-align:left;padding:12px;margin:8px 0;border:1px solid #e2e8f0;border-radius:10px;background:#fff">
          <strong>${esc(item.name)}</strong> <small>${esc(item.ticker)} · ${esc(item.exchange || '')}</small>
        </button>`).join('') || '검색 결과가 없습니다.';
      result.querySelectorAll('.atlas-item').forEach(btn => btn.addEventListener('click', async () => {
        const ticker = btn.dataset.ticker;
        const span = document.createElement('span');
        span.style.marginLeft = '10px';
        span.textContent = '조회 중…';
        btn.append(span);
        try {
          const r = await fetch(`/api/home/market-candle?ticker=${encodeURIComponent(ticker)}&timeframe=1d`);
          const d = await r.json();
          const last = (d.ohlcv || []).at(-1);
          span.textContent = last ? `최근 종가 ${Number(last.c).toLocaleString('ko-KR')}` : '가격 없음';
        } catch { span.textContent = '가격 조회 실패'; }
      }));
    } catch (e) { result.textContent = e.message; }
  }
  container.querySelector('#atlas-form').addEventListener('submit', e => { e.preventDefault(); search(); });
  search();
}
