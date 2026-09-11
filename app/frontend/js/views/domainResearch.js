
import { ragChatView } from './ragChat.js';
import { ragDocumentsView } from './ragDocuments.js';
import { financialKnowledgeView } from './financialKnowledge.js';
import { quantView } from './quant.js';
import { financeTheoryView, basisLabView, financeCalendarView, stockAtlasView } from './nativeResearchViews.js';

import { theoryAnalysisView } from './theoryAnalysis.js';
const NEWS_RAG_HANDOFF_KEY = 'investment.news-rag-handoff';

export const RESEARCH_PAGES = {
  'research-ai-analysis': ['theory-ai', '이론 기반 AI 분석'],
  'domain-research': ['learn', 'AI 금융 질문'],
  'research-documents': ['documents', '학습 문서 등록'],
  'research-theory': ['theory', '4일 금융 이론'],
  'research-stocks': ['stocks', '종목 아틀라스'],
  'research-simulation': ['simulation', '자산배분 실습'],
  'research-basis': ['basis', '선물 베이시스'],
  'research-backtest': ['backtest', 'LEAN 전략 실행'],
  'research-calendar': ['calendar', '금융 캘린더'],
  ...Object.fromEntries(['선물 · 옵션','펀드 · ETF','채권 · 코인','자산배분 · 퀀트']
    .map((name,i)=>[`research-day-${i+1}`,[`day-${i+1}`,`${i+1}일차 · ${name}`]])),
};

function consumeNewsHandoff(app) {
  try {
    const raw = sessionStorage.getItem(NEWS_RAG_HANDOFF_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw);
    const input = app.querySelector('#rag-input');
    const form = app.querySelector('#rag-form');
    if (!payload?.prompt || !input || !form) return;
    sessionStorage.removeItem(NEWS_RAG_HANDOFF_KEY);
    input.value = payload.prompt;
    queueMicrotask(() => form.requestSubmit());
  } catch {}
}

export async function domainResearchView(app, page = 'domain-research') {
  if (page === 'research-ai-analysis') {
    return theoryAnalysisView(app);
  }

  const label = RESEARCH_PAGES[page]?.[1] || 'AI 금융 질문';
  document.title = `${label} · JSH Learning`;
  window._viewCleanup = null;

  if (page === 'domain-research') { ragChatView(app); consumeNewsHandoff(app); return; }
  if (page === 'research-documents') return ragDocumentsView(app);
  if (page === 'research-theory') return financeTheoryView(app);
  if (/^research-day-[1-4]$/.test(page)) return financeTheoryView(app, Number(page.slice(-1)));
  if (page === 'research-stocks') return stockAtlasView(app);
  if (page === 'research-simulation') return financialKnowledgeView(app);
  if (page === 'research-basis') return basisLabView(app);
  if (page === 'research-backtest') return quantView(app);
  if (page === 'research-calendar') return financeCalendarView(app);
  ragChatView(app);
}
