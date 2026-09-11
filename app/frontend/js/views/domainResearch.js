import { mountResearch } from '../research/app.js';
import { installTheory } from '../research/theory.js';

const NEWS_RAG_HANDOFF_KEY = 'investment.news-rag-handoff';

export const RESEARCH_PAGES = {
  'domain-research': ['learn', '금융 RAG 질문'],
  'research-documents': ['documents', 'RAG 문서 등록'],
  'research-theory': ['theory', '4일 금융 이론'],
  'research-stocks': ['stocks', '금융 종목 아틀라스'],
  'research-simulation': ['simulation', '자산배분 실습'],
  'research-basis': ['basis', '선물 베이시스'],
  'research-backtest': ['backtest', 'LEAN 전략 실행'],
  'research-calendar': ['calendar', '금융 캘린더'],
  ...Object.fromEntries(['선물 · 옵션', '펀드 · ETF', '채권 · 코인', '자산배분 · 퀀트'].map((name, i) => [`research-day-${i + 1}`, [`day-${i + 1}`, `${i + 1}일차 · ${name}`]])),
};

function consumeNewsHandoff(root, page) {
  if (page !== 'domain-research') return;
  let payload;
  try {
    const raw = sessionStorage.getItem(NEWS_RAG_HANDOFF_KEY);
    if (!raw) return;
    payload = JSON.parse(raw);
    sessionStorage.removeItem(NEWS_RAG_HANDOFF_KEY);
  } catch (error) {
    console.warn('기사 분석 요청을 읽지 못했습니다.', error);
    return;
  }
  if (!payload?.prompt || typeof payload.prompt !== 'string') return;
  const input = root.getElementById('questionInput');
  const sendButton = root.getElementById('sendBtn');
  if (!input || !sendButton) return;
  input.value = payload.prompt;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  // mountResearch가 모든 이벤트를 연결한 다음 클릭을 발생시켜 기존 채팅 흐름을 그대로 사용한다.
  queueMicrotask(() => sendButton.click());
}

// Original code uses document selectors. Scope those selectors and all lifecycle
// resources to this view, keeping the investment shell and its IDs untouched.
function createContext(root, body, initialView, onView) {
  const controller = new AbortController();
  const timers = new Set();
  const intervals = new Set();
  const frames = new Set();
  const charts = new Set();
  const nativeDocument = globalThis.document;
  const scopedDocument = new Proxy(nativeDocument, {
    get(target, key) {
      if (key === 'body') return body;
      if (['querySelector', 'querySelectorAll', 'getElementById'].includes(key)) return root[key].bind(root);
      if (key === 'addEventListener') return (type, fn, options = {}) => root.addEventListener(type, fn, { ...(typeof options === 'boolean' ? { capture: options } : options), signal: controller.signal });
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const trackedCharts = globalThis.ApexCharts ? class extends globalThis.ApexCharts {
    constructor(...args) { super(...args); charts.add(this); }
    destroy() { charts.delete(this); return super.destroy(); }
  } : undefined;
  const values = { API_BASE: '/research', ApexCharts: trackedCharts };
  const scopedWindow = new Proxy(values, { get(target, key) { return key in target ? target[key] : globalThis[key]; } });
  installTheory(scopedWindow);
  return {
    document: scopedDocument, window: scopedWindow, ApexCharts: trackedCharts,
    initialView: initialView.startsWith('day-') ? 'theory' : initialView,
    initialDay: initialView.startsWith('day-') ? Number(initialView.slice(4)) : null,
    onView,
    fetch: (url, options = {}) => globalThis.fetch(url, { ...options, signal: controller.signal }),
    setTimeout(fn, delay) { const id = globalThis.setTimeout(() => { timers.delete(id); fn(); }, delay); timers.add(id); return id; },
    clearTimeout(id) { timers.delete(id); globalThis.clearTimeout(id); },
    setInterval(fn, delay) { const id = globalThis.setInterval(fn, delay); intervals.add(id); return id; },
    clearInterval(id) { intervals.delete(id); globalThis.clearInterval(id); },
    requestAnimationFrame(fn) { const id = globalThis.requestAnimationFrame(() => { frames.delete(id); fn(); }); frames.add(id); return id; },
    dispose() {
      controller.abort();
      timers.forEach(id => globalThis.clearTimeout(id));
      intervals.forEach(id => globalThis.clearInterval(id));
      frames.forEach(id => globalThis.cancelAnimationFrame(id));
      charts.forEach(chart => { try { chart.destroy(); } catch {} });
    },
  };
}

export async function domainResearchView(app, page = 'domain-research') {
  const [view, label] = RESEARCH_PAGES[page] || RESEARCH_PAGES['domain-research'];
  app.innerHTML = '<p role="status">금융 학습 기능을 불러오고 있습니다…</p>';
  const abort = new AbortController();
  let context;
  window._viewCleanup = () => { abort.abort(); context?.dispose(); };
  try {
    const response = await fetch('/js/research/shell.html', { signal: abort.signal });
    if (!response.ok) throw new Error('화면을 불러오지 못했습니다.');
    const html = await response.text();
    if (abort.signal.aborted) return;
    const host = document.createElement('section');
    host.setAttribute('aria-label', label);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<link rel="stylesheet" href="/js/research/style.css">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <link rel="stylesheet" href="/js/research/integration.css">
      <div class="domain-body">${html}</div>`;
    app.replaceChildren(host);
    const body = root.querySelector('.domain-body');
    const onView = active => {
      body.dataset.integratedView = active;
      const match = Object.entries(RESEARCH_PAGES).find(([, value]) => value[0] === active);
      if (!match) return;
      host.setAttribute('aria-label', match[1][1]);
      const breadcrumb = document.getElementById('breadcrumb');
      if (breadcrumb) breadcrumb.textContent = match[1][1];
      document.querySelectorAll('.nav-item[data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === match[0]));
      const url = new URL(location.href); url.searchParams.set('view', match[0]);
      history.replaceState(null, '', url);
    };
    context = createContext(root, body, view, onView);
    mountResearch(context);
    consumeNewsHandoff(root, page);
  } catch (error) {
    if (abort.signal.aborted) return;
    context?.dispose();
    app.replaceChildren();
    const message = document.createElement('p'); message.setAttribute('role', 'alert');
    message.textContent = '금융 학습 기능을 불러오지 못했습니다. 메뉴를 다시 선택해 주세요.';
    app.append(message);
    console.error(error);
  }
}
