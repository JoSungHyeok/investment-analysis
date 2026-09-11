export function stockNewsView(container) {
  container.innerHTML = stockNewsMarkup();
  window._viewCleanup = initStockNews(container);
}

export function stockNewsMarkup() {
  return `<section class="home-stock-news" aria-labelledby="stock-news-title">
    <header class="home-quote-dashboard-head">
      <div><h2 id="stock-news-title">주식 기사</h2><p>시장 흐름과 기업 소식을 확인하세요. 제목을 누르면 기사 링크가 새 창으로 열립니다.</p></div>
      <button type="button" data-news-refresh>새로고침</button>
    </header>
    <div class="stock-news-filters" role="group" aria-label="뉴스 분류">
      <button type="button" data-news-category="korea" aria-pressed="true">국내 증시</button>
      <button type="button" data-news-category="global" aria-pressed="false">해외 증시</button>
      <button type="button" data-news-category="company" aria-pressed="false">기업 · 실적</button>
    </div>
    <p class="stock-news-status" data-news-status role="status">뉴스를 불러오고 있습니다…</p>
    <div class="stock-news-grid" data-news-list></div>
    <p class="home-quote-note">Google 뉴스 RSS · 10분 간격으로 수집 결과 갱신 · 기사 저작권은 각 언론사에 있습니다.</p>
  </section>`;
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
        article.append(title, meta);
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
