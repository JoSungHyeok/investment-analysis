import { mountResearch } from '../research/app.js';
import { installTheory } from '../research/theory.js';

const NEWS_RAG_HANDOFF_KEY = 'investment.news-rag-handoff';
let researchShellHtml = null;
let researchInstance = null;
let pendingDisposeTimer = null;

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

// 앱 모듈이 로드되는 즉시 금융학습 셸을 백그라운드에서 미리 준비한다.
loadResearchShell().catch((error) => console.warn('금융학습 사전 로드 실패', error));

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
  return { title, score: Number(source?.score || 0), content: source?.text || '' };
}

async function researchFetch(url, options = {}, controller) {
  const requestUrl = typeof url === 'string' ? url : String(url?.url || url);
  if (requestUrl === '/research/chat' && String(options.method || 'GET').toUpperCase() === 'POST') {
    let legacyPayload = {};
    try { legacyPayload = options.body ? JSON.parse(options.body) : {}; } catch { legacyPayload = {}; }
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
    return new Response(JSON.stringify({
      answer: data.answer || '관련 문서를 찾지 못했습니다.',
      references: (data.sources || []).map(normalizeResearchReference),
    }), {
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

function updateOuterResearchState(page, label) {
  const host = researchInstance?.host;
  if (host) host.setAttribute('aria-label', label);
  document.title = `${label} · JSH Learning`;
  const breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb) breadcrumb.textContent = label;
  document.querySelectorAll('.nav-item[data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === page));
  const url = new URL(location.href);
  url.searchParams.set('view', page);
  history.replaceState(null, '', url);
}

function switchResearchPage(page) {
  if (!researchInstance) return false;
  const [view, label] = RESEARCH_PAGES[page] || RESEARCH_PAGES['domain-research'];
  const { root } = researchInstance;

  if (view.startsWith('day-')) {
    const day = Number(view.slice(4));
    const button = root.querySelector(`.theory-menu-btn[data-theory-day="${day}"]`);
    if (!button) return false;
    button.click();
  } else {
    const button = root.querySelector(`[data-research-bridge][data-view="${view}"], .brand-nav-btn[data-view="${view}"], [data-go="${view}"]`);
    if (!button) return false;
    button.click();
  }

  updateOuterResearchState(page, label);
  consumeNewsHandoff(root, page);
  return true;
}

function scheduleResearchDispose() {
  if (pendingDisposeTimer) clearTimeout(pendingDisposeTimer);
  pendingDisposeTimer = setTimeout(() => {
    pendingDisposeTimer = null;
    if (!researchInstance) return;
    researchInstance.context?.dispose();
    researchInstance = null;
  }, 0);
}

export async function domainResearchView(app, page = 'domain-research') {
  const [view, label] = RESEARCH_PAGES[page] || RESEARCH_PAGES['domain-research'];

  // navigate()가 기존 화면 cleanup을 먼저 호출하더라도 같은 이벤트 루프 안에서
  // 다른 금융학습 메뉴로 이동하면 dispose 예약을 취소하고 기존 인스턴스를 재사용한다.
  if (pendingDisposeTimer) {
    clearTimeout(pendingDisposeTimer);
    pendingDisposeTimer = null;
  }

  if (researchInstance) {
    if (!app.contains(researchInstance.host)) app.replaceChildren(researchInstance.host);
    if (switchResearchPage(page)) {
      window._viewCleanup = scheduleResearchDispose;
      return;
    }
    researchInstance.context?.dispose();
    researchInstance = null;
  }

  document.title = `${label} · JSH Learning`;
  app.setAttribute('aria-busy', 'true');
  try {
    const html = await loadResearchShell();
    const host = document.createElement('section');
    host.className = 'jsh-learning-module jsh-learning-research';
    host.setAttribute('aria-label', label);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<link rel="stylesheet" href="/js/research/style.css">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <link rel="stylesheet" href="/js/research/integration.css">
      <div class="domain-body">${html}<button type="button" class="brand-nav-btn" data-research-bridge data-view="theory" hidden></button><button type="button" class="brand-nav-btn" data-research-bridge data-view="documents" hidden></button></div>`;
    const body = root.querySelector('.domain-body');
    const onView = active => {
      body.dataset.integratedView = active;
      const match = Object.entries(RESEARCH_PAGES).find(([, value]) => value[0] === active);
      if (!match) return;
      const [activePage, [, activeLabel]] = match;
      updateOuterResearchState(activePage, activeLabel);
    };
    const context = createContext(root, body, view, onView);
    researchInstance = { host, root, body, context };
    mountResearch(context);
    app.replaceChildren(host);
    updateOuterResearchState(page, label);
    consumeNewsHandoff(root, page);
    window._viewCleanup = scheduleResearchDispose;
  } catch (error) {
    researchInstance?.context?.dispose();
    researchInstance = null;
    app.replaceChildren();
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = 'JSH Learning 금융 학습 기능을 불러오지 못했습니다. 메뉴를 다시 선택해 주세요.';
    app.append(message);
    console.error(error);
  } finally {
    app.removeAttribute('aria-busy');
  }
}
