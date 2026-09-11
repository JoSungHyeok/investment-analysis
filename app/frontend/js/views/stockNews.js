const NEWS_RAG_HANDOFF_KEY = 'investment.news-rag-handoff';

export function stockNewsView(container) {
  container.innerHTML = stockNewsMarkup();
  window._viewCleanup = initStockNews(container);
}

export function stockNewsMarkup() {
  return `<section class="home-stock-news" aria-labelledby="stock-news-title">
    <header class="home-quote-dashboard-head">
      <div><h2 id="stock-news-title">주식 기사</h2><p>시장 흐름과 기업 소식을 확인하고, 기사 제목을 금융 RAG로 넘겨 관련 기업·산업·위험요인을 분석할 수 있습니다.</p></div>
      <button type="button" data-news-refresh>새로고침</button>
    </header>
    <div class="stock-news-filters" role="group" aria-label="뉴스 분류">
      <button type="button" data-news-category="korea" aria-pressed="true">국내 증시</button>
      <button type="button" data-news-category="global" aria-pressed="false">해외 증시</button>
      <button type="button" data-news-category="company" aria-pressed="false">기업 · 실적</button>
    </div>
    <p class="stock-news-status" data-news-status role="status">뉴스를 불러오고 있습니다…</p>
    <div class="stock-news-grid" data-news-list></div>
    <p class="home-quote-note">Google 뉴스 RSS · 10분 간격으로 수집 결과 갱신 · AI 분석은 기사 제목·언론사·링크와 등록된 RAG 문서를 바탕으로 하며 기사 본문을 수집하지 않습니다.</p>
  </section>`;
}

function buildArticlePrompt(item) {
  const published = item.published_at ? new Date(item.published_at) : null;
  const publishedText = published && !Number.isNaN(published.valueOf())
    ? published.toLocaleString('ko-KR')
    : '발행 시각 미표시';
  return [
    '다음 주식 관련 기사를 투자 리서치 관점에서 분석해 주세요.',
    '',
    `기사 제목: ${item.title}`,
    `언론사: ${item.source || '출처 미표시'}`,
    `발행 시각: ${publishedText}`,
    `기사 링크: ${item.url}`,
    '',
    '중요: 현재 제공된 정보는 기사 제목과 메타데이터뿐입니다. 기사 본문을 읽었다고 가정하거나 본문 내용을 만들어내지 마세요.',
    '등록된 RAG 문서에서 근거를 찾을 수 있는 범위에서 아래 형식으로 분석해 주세요.',
    '1. 제목에서 확인되는 핵심 이슈',
    '2. 관련 기업·산업과 연결고리',
    '3. 긍정적 영향과 부정적 영향 시나리오',
    '4. 투자자가 추가로 확인해야 할 지표와 사실',
    '5. 주요 위험요인',
    '6. 사용한 RAG 근거와 근거가 부족한 부분 구분',
  ].join('\n');
}

function openArticleAnalysis(item) {
  const payload = {
    title: item.title,
    source: item.source || '출처 미표시',
    url: item.url,
    published_at: item.published_at || null,
    prompt: buildArticlePrompt(item),
    created_at: new Date().toISOString(),
  };
  try {
    sessionStorage.setItem(NEWS_RAG_HANDOFF_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('기사 분석 요청을 저장하지 못했습니다.', error);
    return;
  }
  const target = new URL(window.location.href);
  target.searchParams.set('view', 'domain-research');
  window.location.assign(target.href);
}

export function initStockNews(container) {
  const section = container.querySelector('.home-stock-news');
  const list = section.querySelector('[data-news-list]');
  const status = section.querySelector('[data-news-status]');
  const refresh = section.querySelector('[data-news-refresh]');
  let category = 'korea';
  let controller;
  let disposed = false;

  async function load() {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    const timeout = setTimeout(() => request.abort(), 20000);
    refresh.disabled = true;
    list.replaceChildren();
    section.setAttribute('aria-busy', 'true');
    status.textContent = '뉴스를 불러오고 있습니다…';
    try {
      const response = await fetch(`/api/home/stock-news?category=${category}`, { signal: request.signal });
      if (!response.ok) throw new Error('News unavailable');
      const data = await response.json();
      if (disposed || controller !== request) return;
      for (const item of data.items || []) {
        const url = new URL(item.url);
        if (!['https:', 'http:'].includes(url.protocol)) continue;
        const normalizedItem = { ...item, url: url.href };
        const article = document.createElement('article');
        article.className = 'stock-news-item';
        const title = document.createElement('h3');
        const link = document.createElement('a');
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = item.title;
        title.append(link);
        const meta = document.createElement('p');
        meta.append(document.createTextNode(item.source + ' · '));
        const date = new Date(item.published_at || '');
        const time = document.createElement('time');
        if (!Number.isNaN(date.valueOf())) {
          time.dateTime = date.toISOString();
          time.textContent = date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } else time.textContent = '발행 시각 미표시';
        meta.append(time);

        const actions = document.createElement('div');
        actions.className = 'stock-news-actions';
        const readLink = document.createElement('a');
        readLink.href = url.href;
        readLink.target = '_blank';
        readLink.rel = 'noopener noreferrer';
        readLink.className = 'stock-news-action-link';
        readLink.textContent = '기사 보기';
        const analyzeButton = document.createElement('button');
        analyzeButton.type = 'button';
        analyzeButton.className = 'stock-news-ai-button';
        analyzeButton.textContent = 'AI 분석';
        analyzeButton.setAttribute('aria-label', `${item.title} AI 분석`);
        analyzeButton.addEventListener('click', () => openArticleAnalysis(normalizedItem));
        actions.append(readLink, analyzeButton);

        article.append(title, meta, actions);
        list.append(article);
      }
      const fetched = new Date(data.fetched_at);
      status.textContent = data.stale ? '최신 수집이 지연되어 이전 뉴스를 표시합니다.'
        : list.childElementCount ? `최근 수집 ${fetched.toLocaleString('ko-KR')} · ${list.childElementCount}개 기사`
        : '현재 표시할 기사가 없습니다. 잠시 후 새로고침해 주세요.';
    } catch {
      if (!disposed && controller === request) status.textContent = '뉴스를 불러오지 못했습니다. 새로고침으로 다시 시도해 주세요.';
    } finally {
      clearTimeout(timeout);
      if (!disposed && controller === request) {
        refresh.disabled = false;
        section.setAttribute('aria-busy', 'false');
      }
    }
  }
  section.querySelectorAll('[data-news-category]').forEach(button => {
    button.addEventListener('click', () => {
      category = button.dataset.newsCategory;
      section.querySelectorAll('[data-news-category]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      load();
    });
  });
  refresh.addEventListener('click', load);
  load();
  return () => { disposed = true; controller?.abort(); };
}
