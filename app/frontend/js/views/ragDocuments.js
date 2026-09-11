
import { ingestResearchFile, ingestResearchText } from '../research/nativeApi.js';

export function ragDocumentsView(container) {
  container.innerHTML = `
    <section class="card" style="max-width:900px;margin:0 auto 16px">
      <h2><i class="fa-solid fa-file-arrow-up"></i> 학습 문서 등록</h2>
      <p>JSH Learning의 공통 Qdrant 컬렉션에 파일 또는 텍스트를 직접 등록합니다.</p>
    </section>
    <section class="card" style="max-width:900px;margin:0 auto 16px">
      <h3>파일 등록</h3>
      <form id="rag-file-form">
        <input id="rag-file" class="param-input" type="file" accept=".txt,.md,.mdx,.pdf" required />
        <button class="btn btn-primary" type="submit" style="margin-top:12px">파일 등록</button>
      </form>
    </section>
    <section class="card" style="max-width:900px;margin:0 auto">
      <h3>텍스트 직접 등록</h3>
      <form id="rag-text-form">
        <input id="rag-title" class="param-input" maxlength="300" required placeholder="문서 제목" />
        <textarea id="rag-content" class="param-input" rows="12" required placeholder="RAG에 등록할 내용"></textarea>
        <button class="btn btn-primary" type="submit" style="margin-top:12px">텍스트 등록</button>
      </form>
    </section>
    <p id="rag-ingest-status" role="status" style="max-width:900px;margin:14px auto;color:#64748b"></p>`;

  const status = container.querySelector('#rag-ingest-status');

  container.querySelector('#rag-file-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = container.querySelector('#rag-file').files[0];
    if (!file) return;
    status.textContent = '파일을 분석하고 임베딩하는 중…';
    try {
      const result = await ingestResearchFile(file);
      status.textContent = `등록 완료: ${result.title || result.document_id} · ${result.chunks || 0}개 청크`;
    } catch (error) {
      status.textContent = `등록 실패: ${error.message}`;
    }
  });

  container.querySelector('#rag-text-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = container.querySelector('#rag-title').value.trim();
    const content = container.querySelector('#rag-content').value.trim();
    if (!title || !content) return;
    status.textContent = '텍스트를 임베딩하고 등록하는 중…';
    try {
      const result = await ingestResearchText({
        documentId: `manual-${Date.now()}`, title, content
      });
      status.textContent = `등록 완료: ${result.title || result.document_id} · ${result.chunks || 0}개 청크`;
    } catch (error) {
      status.textContent = `등록 실패: ${error.message}`;
    }
  });
}
