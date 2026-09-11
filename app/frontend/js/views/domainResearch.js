import { mountResearch } from '../research/app.js';
import { installTheory } from '../research/theory.js';

const NEWS_RAG_HANDOFF_KEY = 'investment.news-rag-handoff';
let researchShellHtml = null;

// 기존 하단 회사정보 푸터는 전체 학습 앱에서 사용하지 않는다.
document.querySelector('.site-footer')?.remove();

export const RESEARCH_PAGES = {
  'domain-research': ['learn', 'AI 금융 질문'],
  'research-documents': ['documents', '학습 문서 등록'],
  'research-theory': ['theory', '4일 금융 이론'],
  'research-stocks': ['stocks', '종목 아틀라스'],
  'research-simulation': ['simulation', '자산배분 실습'],
  'research-basis': ['basis', '선물 베이시스'],
  'research-backtest': ['backtest', 'LEAN 전략 실행'],
  'research-calendar': ['calendar', '금융 캘린더'],
  ...Object.fromEntries(['선물 · 옵션', '펀드 · ETF', '채권 · 코인', '자산배분 · 퀀트'].map((name, i) => [`research-day-${i + 1}`, [`day-${i + 1}`, `${i + 1}일차 · ${name}`]])),
};

async function loadResearchShell() {
  if (researchShellHtml) return researchShellHtml;
  const response = await fetch('/js/research/shell.html');
  if (!response.ok) throw new Error('화면을 불러오지 못했습니다.');
  researchShellHtml = await response.text();
  return researchShellHtml;
}

function consumeNewsHandoff(root, page) {
  if (page !== 'domain-research') return;
  let payload;
  try {
    const raw = sessionStorage.getItem(NEWS_RAG_HANDOFF_KEY);
    if (!raw) return;
    payload = JSON.parse(raw);
  } catch (error) {
    console.warn('기사 분석 요청을 읽지 못했습니다.', error);
    return;
  }
  if (!payload?.prompt || typeof payload.prompt !== 'string') return;
  const input = root.getElementById('questionInput');
  const sendButton = root.getElementById('sendBtn');
  if (!input || !sendButton) return;
  sessionStorage.removeItem(NEWS_RAG_HANDOFF_KEY);
  input.value = payload.prompt;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  queueMicrotask(() => sendButton.click());
}

function normalizeResearchReference(source) {
  const title = [source?.source_doc, source?.section].filter(Boolean).join(' · ') || '학습 문서';
  return {
    title,
    score: Number(source?.score || 0),
    content: source?.text || '',
  };
}

async function researchFetch(url, options = {}, controller) {
  const requestUrl = typeof url === 'string' ? url : String(url?.url || url);

  // 구형 금융학습 화면은 /research/chat을 사용했지만 현재 백엔드 RAG API는
  // /api/rag/ask를 POST로 제공한다. 여기서 요청/응답 모양을 호환시킨다.
  if (requestUrl === '/research/chat' && String(options.method || 'GET').toUpperCase() === 'POST') {
    let legacyPayload = {};
    try {
      legacyPayload = options.body ? JSON.parse(options.body) : {};
    } catch {
      legacyPayload = {};
    }

    const response = await globalThis.fetch('/api/rag/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: String(legacyPayload.question || '').trim(),
        top_k: Number(legacyPayload.top_k || 4),
        score_threshold: 0,
        provider: 'rag',
      }),
      signal: controller.signal,
    });

    if (!response.ok) return response;
    const data = await response.json();
    const mapped = {
      answer: data.answer || '관련 문서를 찾지 못했습니다.',
      references: (data.sources || []).map(normalizeResearchReference),
    };
    return new Response(JSON.stringify(mapped), {
      status: response.status,
      statusText: response.statusText,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return globalThis.fetch(url, { ...options, signal: controller.signal });
}

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
    fetch: (url, options = {}) => researchFetch(url, options, controller),
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
  document.title = `${label} · JSH Learning`;
  const abort = new AbortController();
  let context;
  window._viewCleanup = () => { abort.abort(); context?.dispose(); };

  // 기존 화면을 바로 지우지 않고 새 금융학습 화면이 준비된 뒤 교체해
  // 메뉴 클릭 시 흰 화면/로딩 문구가 순간적으로 나타나는 현상을 줄인다.
  app.setAttribute('aria-busy', 'true');
  try {
    const html = await loadResearchShell();
    if (abort.signal.aborted) return;
    const host = document.createElement('section');
    host.className = 'jsh-learning-module jsh-learning-research';
    host.setAttribute('aria-label', label);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<link rel="stylesheet" href="/js/research/style.css">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <link rel="stylesheet" href="/js/research/integration.css">
      <div class="domain-body">${html}</div>`;
    const body = root.querySelector('.domain-body');
    const onView = active => {
      body.dataset.integratedView = active;
      const match = Object.entries(RESEARCH_PAGES).find(([, value]) => value[0] === active);
      if (!match) return;
      const [, activeLabel] = match[1];
      host.setAttribute('aria-label', activeLabel);
      document.title = `${activeLabel} · JSH Learning`;
      const breadcrumb = document.getElementById('breadcrumb');
      if (breadcrumb) breadcrumb.textContent = activeLabel;
      document.querySelectorAll('.nav-item[data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === match[0]));
      const url = new URL(location.href); url.searchParams.set('view', match[0]);
      history.replaceState(null, '', url);
    };
    context = createContext(root, body, view, onView);
    mountResearch(context);
    app.replaceChildren(host);
    consumeNewsHandoff(root, page);
  } catch (error) {
    if (abort.signal.aborted) return;
    context?.dispose();
    app.replaceChildren();
    const message = document.createElement('p'); message.setAttribute('role', 'alert');
    message.textContent = 'JSH Learning 금융 학습 기능을 불러오지 못했습니다. 메뉴를 다시 선택해 주세요.';
    app.append(message);
    console.error(error);
  } finally {
    app.removeAttribute('aria-busy');
  }
}
