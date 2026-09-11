
import { installTheory } from '../research/theory.js';

const source = {};
installTheory(source);

const THEORY_DAYS = Array.isArray(source.THEORY_DAYS)
  ? source.THEORY_DAYS
  : [];

const PERSPECTIVES = {
  auto: ['자동 선택', []],
  derivatives: [
    '선물 · 옵션',
    ['선물', '옵션', '헤지', '증거금', '마진콜', '만기', '베이시스']
  ],
  etf: [
    'ETF · 펀드',
    ['ETF', '펀드', 'NAV', 'iNAV', '괴리율', '추적오차', '레버리지']
  ],
  rates: [
    '채권 · 금리',
    ['채권', '금리', '수익률', '인플레이션', '듀레이션']
  ],
  allocation: [
    '자산배분',
    ['자산배분', '분산', '상관관계', '포트폴리오', '리밸런싱']
  ],
  quant: [
    '퀀트',
    ['퀀트', '백테스트', '샤프', 'MDD', '변동성', '수익률']
  ],
  risk: [
    '위험관리',
    ['위험', '리스크', '변동성', '손실', 'MDD', '분산', '마진콜']
  ],
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function tokens(text) {
  return [...new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^0-9a-zA-Z가-힣\s]/g, ' ')
      .split(/\s+/)
      .filter(x => x.length >= 2)
  )];
}

function allLessons() {
  const rows = [];

  for (const day of THEORY_DAYS) {
    for (const lesson of day.lessons || []) {
      const title = lesson?.[0] || '';
      const paragraphs = Array.isArray(lesson?.[1])
        ? lesson[1]
        : [];

      rows.push({
        day: day.day,
        dayTitle: day.title || '',
        title,
        paragraphs,
        text: [title, ...paragraphs].join(' '),
      });
    }
  }

  return rows;
}

function selectTheory(question, perspectiveKey) {
  const perspective = PERSPECTIVES[perspectiveKey]
    || PERSPECTIVES.auto;

  const perspectiveTerms = perspective[1];
  const queryTerms = tokens(question);

  const terms = [
    ...new Set([
      ...queryTerms,
      ...perspectiveTerms.map(x => x.toLowerCase()),
    ])
  ];

  const scored = allLessons()
    .map(row => {
      const text = row.text.toLowerCase();
      const title = row.title.toLowerCase();
      let score = 0;

      for (const term of terms) {
        if (text.includes(term)) score += 2;
        if (title.includes(term)) score += 3;
      }

      if (
        perspectiveKey !== 'auto'
        && perspectiveTerms.some(term =>
          text.includes(term.toLowerCase())
        )
      ) {
        score += 4;
      }

      return { ...row, score };
    })
    .sort((a, b) => b.score - a.score);

  let selected = scored
    .filter(row => row.score > 0)
    .slice(0, 6);

  if (!selected.length) {
    selected = scored.slice(0, 4);
  }

  const context = selected.map((row, index) => (
    `[이론 ${index + 1}]\n`
    + `${row.day}일차 · ${row.dayTitle}\n`
    + `${row.title}\n`
    + row.paragraphs.join('\n')
  )).join('\n\n');

  return { selected, context };
}

export function theoryAnalysisView(app) {
  document.title = '이론 기반 AI 분석 · JSH Learning';

  app.innerHTML = `
    <section class="card" style="max-width:1050px;margin:0 auto 16px">
      <h2>
        <i class="fa-solid fa-brain"></i>
        이론 기반 AI 분석
      </h2>

      <p>
        JSH Learning의 실제 금융 이론에서 관련 내용을 먼저 선택하고,
        해당 이론을 근거로 AI가 질문을 분석합니다.
      </p>
    </section>

    <section class="card" style="max-width:1050px;margin:0 auto 16px">
      <form id="theory-analysis-form">

        <label for="theory-perspective">
          분석 관점
        </label>

        <select
          id="theory-perspective"
          class="param-input"
          style="width:100%;margin-top:6px"
        >
          ${Object.entries(PERSPECTIVES).map(
            ([key, value]) =>
              `<option value="${key}">${esc(value[0])}</option>`
          ).join('')}
        </select>

        <label
          for="theory-question"
          style="display:block;margin-top:16px"
        >
          질문
        </label>

        <textarea
          id="theory-question"
          class="param-input"
          rows="5"
          maxlength="2000"
          style="width:100%;margin-top:6px"
          placeholder="예: 한 종목 비중이 40%라면 자산배분 관점에서 어떤 위험이 있나요?"
          required
        ></textarea>

        <div
          style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
            margin-top:12px
          "
        >
          <button
            class="btn btn-primary"
            type="submit"
          >
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            이론으로 분석
          </button>

          <button
            class="btn btn-secondary example-btn"
            type="button"
            data-q="ETF 괴리율이 커지는 이유와 위험을 이론적으로 설명해줘"
          >
            ETF 괴리율
          </button>

          <button
            class="btn btn-secondary example-btn"
            type="button"
            data-q="금리가 급등하면 채권과 주식 포트폴리오에 어떤 영향이 있나요?"
          >
            금리 급등
          </button>

          <button
            class="btn btn-secondary example-btn"
            type="button"
            data-q="한 종목에 자산의 40%를 투자하면 어떤 집중위험이 있나요?"
          >
            집중 투자
          </button>
        </div>
      </form>
    </section>

    <section
      id="selected-theory"
      class="card"
      style="
        max-width:1050px;
        margin:0 auto 16px;
        display:none
      "
    ></section>

    <section
      id="theory-answer"
      class="card"
      style="
        max-width:1050px;
        margin:0 auto;
        display:none
      "
    ></section>
  `;

  const form = app.querySelector('#theory-analysis-form');
  const questionEl = app.querySelector('#theory-question');
  const selectedEl = app.querySelector('#selected-theory');
  const answerEl = app.querySelector('#theory-answer');

  app.querySelectorAll('.example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      questionEl.value = btn.dataset.q || '';
      questionEl.focus();
    });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const question = questionEl.value.trim();

    if (!question) return;

    const perspectiveKey =
      app.querySelector('#theory-perspective').value;

    const perspective =
      PERSPECTIVES[perspectiveKey] || PERSPECTIVES.auto;

    const { selected, context } =
      selectTheory(question, perspectiveKey);

    selectedEl.style.display = '';

    selectedEl.innerHTML = `
      <h3>
        <i class="fa-solid fa-book-open"></i>
        적용한 금융 이론
      </h3>

      <div style="display:grid;gap:8px">
        ${selected.map(item => `
          <div
            style="
              border:1px solid #e2e8f0;
              border-radius:8px;
              padding:10px
            "
          >
            <strong>
              ${esc(item.day)}일차 ·
              ${esc(item.dayTitle)}
            </strong>

            <div>${esc(item.title)}</div>
          </div>
        `).join('')}
      </div>
    `;

    answerEl.style.display = '';

    answerEl.innerHTML =
      '<p role="status">금융 이론을 근거로 분석 중입니다…</p>';

    try {
      const response = await fetch(
        '/api/rag/theory-analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question,
            perspective: perspective[0],
            theory_context: context,
          }),
        }
      );

      const data = await response.json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || 'AI 분석에 실패했습니다.'
        );
      }

      answerEl.innerHTML = `
        <h3>
          <i class="fa-solid fa-robot"></i>
          AI 분석
        </h3>

        <div
          style="
            white-space:pre-wrap;
            line-height:1.75
          "
        >
          ${esc(data.answer || '')}
        </div>

        <p
          style="
            margin-top:16px;
            color:#64748b;
            font-size:.82rem
          "
        >
          JSH Learning의 금융 이론을 근거로 한
          교육용 분석입니다.
        </p>
      `;

    } catch (error) {
      answerEl.innerHTML = `
        <p role="alert">
          분석 실패: ${esc(error.message)}
        </p>
      `;
    }
  });
}
