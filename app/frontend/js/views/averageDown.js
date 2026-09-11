const fmt = (value, digits = 2) => {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits }).format(value);
};

const readNumber = (root, id) => {
  const raw = root.querySelector(`#${id}`)?.value?.replaceAll(',', '').trim() ?? '';
  if (!raw) return NaN;
  return Number(raw);
};

function resultCard(label, value, sub = '') {
  return `<article style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.04)">
    <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:700">${label}</p>
    <strong style="display:block;color:#0f172a;font-size:24px;line-height:1.2">${value}</strong>
    ${sub ? `<small style="display:block;margin-top:7px;color:#64748b;line-height:1.5">${sub}</small>` : ''}
  </article>`;
}

export function averageDownView(container) {
  container.innerHTML = `
    <section style="max-width:1120px;margin:0 auto">
      <div class="page-heading">
        <div>
          <h1><i class="fa-solid fa-calculator"></i> 물타기 계산기</h1>
          <p>추가 매수 뒤의 평균 매수가와 목표 평단에 필요한 추가 매수량을 계산합니다.</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:22px;align-items:start" class="avg-down-layout">
        <section style="padding:22px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 8px 28px rgba(15,23,42,.05)">
          <h2 style="margin:0 0 6px;font-size:18px;color:#0f172a">현재 보유 + 추가 매수</h2>
          <p style="margin:0 0 20px;color:#64748b;font-size:13px;line-height:1.6">가격과 수량은 주식·ETF·코인 등 단위에 맞춰 같은 기준으로 입력하세요.</p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <label style="display:grid;gap:7px"><span style="font-size:13px;font-weight:700;color:#334155">현재 평균가</span><input class="param-input" id="avg-current-price" inputmode="decimal" value="80000" placeholder="예: 80,000"></label>
            <label style="display:grid;gap:7px"><span style="font-size:13px;font-weight:700;color:#334155">현재 보유수량</span><input class="param-input" id="avg-current-qty" inputmode="decimal" value="10" placeholder="예: 10"></label>
            <label style="display:grid;gap:7px"><span style="font-size:13px;font-weight:700;color:#334155">추가 매수가</span><input class="param-input" id="avg-buy-price" inputmode="decimal" value="65000" placeholder="예: 65,000"></label>
            <label style="display:grid;gap:7px"><span style="font-size:13px;font-weight:700;color:#334155">추가 매수수량</span><input class="param-input" id="avg-buy-qty" inputmode="decimal" value="5" placeholder="예: 5"></label>
          </div>

          <hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0">
          <label style="display:grid;gap:7px"><span style="font-size:13px;font-weight:700;color:#334155">목표 평균가 <small style="font-weight:500;color:#94a3b8">(선택)</small></span><input class="param-input" id="avg-target-price" inputmode="decimal" value="72000" placeholder="추가 매수가와 현재 평균가 사이"></label>

          <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">
            <button type="button" class="run-btn" id="avg-calc"><i class="fa-solid fa-calculator"></i> 계산하기</button>
            <button type="button" id="avg-example" style="border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer">예시값</button>
            <button type="button" id="avg-reset" style="border:0;background:transparent;color:#64748b;padding:10px 8px;font-weight:700;cursor:pointer">초기화</button>
          </div>
          <p id="avg-error" role="alert" style="display:none;margin:14px 0 0;padding:11px 12px;border-radius:9px;background:#fff1f2;color:#be123c;font-size:13px;line-height:1.5"></p>
        </section>

        <section>
          <div id="avg-summary" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px"></div>
          <section id="avg-target-result" style="margin-top:14px;padding:18px;border:1px solid #dbeafe;border-radius:14px;background:#eff6ff"></section>
          <aside style="margin-top:14px;padding:16px 18px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;font-size:13px;line-height:1.65">
            <strong style="color:#0f172a"><i class="fa-solid fa-circle-info"></i> 계산 기준</strong><br>
            새 평균가 = (기존 매입금액 + 추가 매입금액) ÷ 총수량입니다. 수수료·세금·슬리피지는 반영하지 않습니다. 목표 평단 역산은 <b>추가 매수가 &lt; 목표 평균가 &lt; 현재 평균가</b>일 때만 가능합니다.
          </aside>
        </section>
      </div>

      <p style="margin:18px 2px 0;color:#64748b;font-size:12px;line-height:1.6">교육용 계산 도구이며 추가 매수를 권유하지 않습니다. 손실 종목의 비중 확대는 전체 포트폴리오 위험을 높일 수 있습니다.</p>
    </section>
    <style>
      @media (max-width: 820px) {
        .avg-down-layout { grid-template-columns: 1fr !important; }
        #avg-summary { grid-template-columns: 1fr !important; }
      }
    </style>`;

  const errorBox = container.querySelector('#avg-error');
  const summary = container.querySelector('#avg-summary');
  const targetBox = container.querySelector('#avg-target-result');

  const calculate = () => {
    errorBox.style.display = 'none';
    errorBox.textContent = '';

    const currentPrice = readNumber(container, 'avg-current-price');
    const currentQty = readNumber(container, 'avg-current-qty');
    const buyPrice = readNumber(container, 'avg-buy-price');
    const buyQty = readNumber(container, 'avg-buy-qty');
    const targetPrice = readNumber(container, 'avg-target-price');

    const required = [currentPrice, currentQty, buyPrice, buyQty];
    if (required.some((value) => !Number.isFinite(value) || value <= 0)) {
      errorBox.textContent = '현재 평균가·보유수량·추가 매수가·추가 매수수량을 0보다 큰 숫자로 입력해 주세요.';
      errorBox.style.display = 'block';
      summary.innerHTML = '';
      targetBox.innerHTML = '<strong>입력값을 확인하면 목표 평단 계산도 함께 표시됩니다.</strong>';
      return;
    }

    const currentCost = currentPrice * currentQty;
    const addedCost = buyPrice * buyQty;
    const totalQty = currentQty + buyQty;
    const totalCost = currentCost + addedCost;
    const newAverage = totalCost / totalQty;
    const improvement = currentPrice - newAverage;
    const improvementPct = (improvement / currentPrice) * 100;

    summary.innerHTML = [
      resultCard('새 평균 매수가', `${fmt(newAverage)} 원`, `기존 대비 ${fmt(improvement)} 원 · ${fmt(improvementPct)}% 낮아짐`),
      resultCard('총 보유수량', fmt(totalQty, 4), `기존 ${fmt(currentQty, 4)} + 추가 ${fmt(buyQty, 4)}`),
      resultCard('추가 투입금액', `${fmt(addedCost)} 원`, `추가 매수가 ${fmt(buyPrice)} × ${fmt(buyQty, 4)}`),
      resultCard('총 매입금액', `${fmt(totalCost)} 원`, `기존 ${fmt(currentCost)} + 추가 ${fmt(addedCost)}`),
    ].join('');

    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      targetBox.innerHTML = '<strong style="color:#1e3a8a">목표 평균가 역산</strong><p style="margin:7px 0 0;color:#475569">목표 평균가를 입력하면 필요한 추가 매수량과 금액을 계산합니다.</p>';
      return;
    }

    if (!(buyPrice < targetPrice && targetPrice < currentPrice)) {
      targetBox.innerHTML = `<strong style="color:#9f1239">목표 평균가를 다시 확인해 주세요.</strong><p style="margin:7px 0 0;color:#64748b">현재 입력 기준으로 목표 평균가는 추가 매수가 ${fmt(buyPrice)}원보다 높고, 현재 평균가 ${fmt(currentPrice)}원보다 낮아야 합니다.</p>`;
      return;
    }

    const neededQty = (currentQty * (currentPrice - targetPrice)) / (targetPrice - buyPrice);
    const neededCost = neededQty * buyPrice;
    const resultingQty = currentQty + neededQty;
    targetBox.innerHTML = `
      <strong style="display:block;color:#1e3a8a;font-size:15px">목표 평균가 ${fmt(targetPrice)}원 도달 예상</strong>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px">
        <div><small style="color:#64748b">필요 추가수량</small><b style="display:block;margin-top:3px;color:#0f172a;font-size:19px">${fmt(neededQty, 4)}</b></div>
        <div><small style="color:#64748b">필요 추가금액</small><b style="display:block;margin-top:3px;color:#0f172a;font-size:19px">${fmt(neededCost)}원</b></div>
        <div><small style="color:#64748b">도달 후 총수량</small><b style="display:block;margin-top:3px;color:#0f172a;font-size:19px">${fmt(resultingQty, 4)}</b></div>
      </div>`;
  };

  container.querySelector('#avg-calc').addEventListener('click', calculate);
  container.querySelectorAll('input').forEach((input) => input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') calculate();
  }));
  container.querySelector('#avg-example').addEventListener('click', () => {
    container.querySelector('#avg-current-price').value = '80000';
    container.querySelector('#avg-current-qty').value = '10';
    container.querySelector('#avg-buy-price').value = '65000';
    container.querySelector('#avg-buy-qty').value = '5';
    container.querySelector('#avg-target-price').value = '72000';
    calculate();
  });
  container.querySelector('#avg-reset').addEventListener('click', () => {
    container.querySelectorAll('input').forEach((input) => { input.value = ''; });
    summary.innerHTML = '';
    targetBox.innerHTML = '<strong style="color:#1e3a8a">값을 입력하고 계산하기를 눌러 주세요.</strong>';
    errorBox.style.display = 'none';
  });

  calculate();
}
