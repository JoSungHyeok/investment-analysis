/**
 * includeSidebar.js — 정적 MPA 페이지(pages/*.html)에서 공통 사이드바 내비게이션을
 * partials/sidebar-nav.html로부터 fetch 하여 주입한다.
 */
(async function includeSidebar() {
  const slot = document.getElementById('sidebar-nav-slot');
  if (!slot) return;

  try {
    const res = await fetch('partials/sidebar-nav.html');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    slot.outerHTML = await res.text();
  } catch (err) {
    slot.innerHTML = `<p style="padding:16px;color:var(--text-muted);font-size:.82rem;">메뉴를 불러오지 못했습니다. <a href="../index.html">대시보드로 이동</a></p>`;
    console.error('사이드바 로드 실패:', err);
    return;
  }

  const nav = document.querySelector('.sidebar-nav');
  if (nav && !nav.querySelector('#nav-paper-tools')) {
    const tools = document.createElement('div');
    tools.className = 'nav-section';
    tools.innerHTML = `
      <button class="nav-section-hdr" onclick="toggleNav('paper-tools')">
        <span><i class="fa-solid fa-money-bill-trend-up"></i>모의투자 · 실습</span>
        <i class="fa-solid fa-chevron-down nav-chev" id="chev-paper-tools"></i>
      </button>
      <div class="nav-children" id="nav-paper-tools">
        <a href="paper-trading.html" class="nav-item" data-page="paper-trading"><i class="fa-solid fa-arrow-right-arrow-left"></i>주식·코인 모의투자</a>
        <a href="avg-down.html" class="nav-item" data-page="avg-down"><i class="fa-solid fa-calculator"></i>물타기 계산기</a>
        <a href="/docs" target="_blank" rel="noopener" class="nav-item"><i class="fa-solid fa-code"></i>OpenAPI · Swagger</a>
      </div>`;
    const firstSection = nav.querySelector('.nav-section');
    if (firstSection) nav.insertBefore(tools, firstSection); else nav.append(tools);
  }

  if (typeof window._orderSidebarSections === 'function') window._orderSidebarSections();
  if (typeof window._ensureSidebarChatbot === 'function') window._ensureSidebarChatbot();

  const page = document.body.dataset.page;
  if (page) {
    const link = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (link) {
      link.classList.add('active');
      if (link.closest('#nav-paper-tools')) window._openNavSection?.('paper-tools');
    }
  }
})();
