"""Bounded, cached stock-news RSS ingestion; article bodies are not collected."""
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from threading import Lock
from time import monotonic
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

QUERIES = {
    'korea': '코스피 OR 코스닥 OR 한국증시 when:7d',
    'global': '미국증시 OR 나스닥 OR 뉴욕증시 when:7d',
    'company': '주식 기업 실적 when:7d',
}
TTL = 600
MAX_STALE = 86400
MAX_BYTES = 2_000_000
_cache = {}
_locks = {category: Lock() for category in QUERIES}


def safe_url(value):
    try:
        parsed = urlsplit(value)
        return value if parsed.scheme in ('http', 'https') and parsed.hostname and not parsed.username else ''
    except ValueError:
        return ''


def parse_feed(content):
    if len(content) > MAX_BYTES or b'<!DOCTYPE' in content.upper() or b'<!ENTITY' in content.upper():
        raise ValueError('Invalid RSS payload')
    root = ET.fromstring(content)
    if root.tag != 'rss' or root.find('channel') is None:
        raise ValueError('Expected RSS channel')
    items, seen = [], set()
    for item in root.findall('./channel/item'):
        title = (item.findtext('title') or '').strip()
        link = safe_url((item.findtext('link') or '').strip())
        source = (item.findtext('source') or '').strip()
        if source and title.endswith(' - ' + source):
            title = title[:-(len(source) + 3)].strip()
        if not title or not link or title.casefold() in seen:
            continue
        try:
            published = parsedate_to_datetime(item.findtext('pubDate') or '')
            if published.tzinfo is None:
                published = published.replace(tzinfo=timezone.utc)
            published = published.astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            published = None
        seen.add(title.casefold())
        items.append({'title': title, 'url': link, 'source': source or '출처 미표시', 'published_at': published})
    items.sort(key=lambda item: item['published_at'] or '', reverse=True)
    return items[:12]


def get_news(category='korea'):
    if category not in QUERIES:
        raise ValueError('Unknown news category')
    with _locks[category]:
        cached = _cache.get(category)
        if cached and monotonic() - cached[0] < TTL:
            return {**cached[1], 'stale': False}
        try:
            url = 'https://news.google.com/rss/search?' + urlencode({
                'q': QUERIES[category], 'hl': 'ko', 'gl': 'KR', 'ceid': 'KR:ko',
            })
            request = Request(url, headers={'User-Agent': 'InvestmentResearch/1.0 RSS Reader'})
            with urlopen(request, timeout=12) as response:
                items = parse_feed(response.read(MAX_BYTES + 1))
            result = {'items': items, 'category': category,
                      'fetched_at': datetime.now(timezone.utc).isoformat(), 'provider': 'Google 뉴스 RSS'}
            _cache[category] = (monotonic(), result)
            return {**result, 'stale': False}
        except (OSError, ValueError, ET.ParseError):
            if cached and monotonic() - cached[0] < MAX_STALE:
                return {**cached[1], 'stale': True}
            raise RuntimeError('뉴스를 수집하지 못했습니다. 잠시 후 다시 시도해 주세요.') from None
