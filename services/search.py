"""Web search: Google Custom Search (links) or ddgs, optional Claude formatting."""

import os
import re
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup

from dotenv import load_dotenv
load_dotenv()

# Google Custom Search — returns reliable links (set GOOGLE_API_KEY + GOOGLE_CSE_ID in .env)
def _google_search(query: str, max_results: int = 8) -> list:
    key = os.environ.get("GOOGLE_API_KEY")
    cx = os.environ.get("GOOGLE_CSE_ID") or os.environ.get("GOOGLE_CX")
    if not key or not cx:
        return []
    try:
        r = httpx.get(
            "https://www.googleapis.com/customsearch/v1",
            params={"key": key, "cx": cx, "q": query, "num": min(max_results, 10)},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        items = data.get("items") or []
        return [
            {
                "title": (i.get("title") or "").strip() or "(No title)",
                "snippet": (i.get("snippet") or "").strip(),
                "url": (i.get("link") or "").strip(),
            }
            for i in items
        ]
    except Exception:
        return []

# ddgs fallback (no API key)
try:
    from ddgs import DDGS
    HAS_DDGS = True
except ImportError:
    try:
        from duckduckgo_search import DDGS
        HAS_DDGS = True
    except ImportError:
        HAS_DDGS = False


def _normalize_result(r):
    """Ensure every result has title, snippet, url (string)."""
    return {
        "title": (r.get("title") or r.get("name") or "").strip() or "(No title)",
        "snippet": (r.get("body") or r.get("snippet") or r.get("content") or "").strip(),
        "url": (r.get("href") or r.get("url") or r.get("link") or "").strip(),
    }


def search_web(query: str, max_results: int = 5) -> list:
    """Search the web; return list of {title, snippet, url}. Prefers Google if configured."""
    if not query or not query.strip():
        return []
    q = query.strip()
    results = _google_search(q, max_results=max_results)
    if not results and HAS_DDGS:
        try:
            with DDGS(timeout=10) as ddgs:
                raw = ddgs.text(q, max_results=max_results)
                if raw:
                    results = [_normalize_result(r) for r in raw]
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Search failed: %s", e)
    if not results:
        results = [{
            "title": "Search the web",
            "snippet": f'No results here. Try searching for "{q}" in your browser.',
            "url": f"https://duckduckgo.com/?q={quote_plus(q)}",
        }]
    return results


def scrape_page_summary(url: str, max_chars: int = 500):
    """Fetch a URL and return a short text summary (no JS)."""
    try:
        with httpx.Client(follow_redirects=True, timeout=8) as client:
            r = client.get(url)
            r.raise_for_status()
    except Exception:
        return None
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in ("script", "style", "nav", "footer", "header"):
        for e in soup.find_all(tag):
            e.decompose()
    text = soup.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text)
    if len(text) > max_chars:
        text = text[: max_chars].rsplit(" ", 1)[0] + "\u2026"
    return text or None
