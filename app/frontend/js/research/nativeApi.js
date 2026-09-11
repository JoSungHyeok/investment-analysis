
async function jsonRequest(path, options = {}) {
  const response = await fetch(`/api/rag${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.message || '요청을 처리하지 못했습니다.');
  return payload;
}

export function askResearch(question, { topK = 5, provider = 'rag' } = {}) {
  return jsonRequest('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: question, top_k: topK, provider }),
  });
}

export function ingestResearchText({ documentId, title, content, domain = 'finance' }) {
  return jsonRequest('/ingest/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: documentId, title, content, domain }),
  });
}

export function ingestResearchFile(file, domain = 'finance') {
  const body = new FormData();
  body.append('file', file);
  body.append('domain', domain);
  return jsonRequest('/ingest/file', { method: 'POST', body });
}
