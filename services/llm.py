"""Optional LLM formatting: Claude or Gemini to turn search results into a reply with links."""

import os

from dotenv import load_dotenv
load_dotenv()

def _build_search_prompt(query: str, results: list) -> str:
    text_results = "\n".join(
        f"- {r.get('title', '')}: {r.get('snippet', '')} | {r.get('url', '')}" for r in results[:8]
    )
    return f"""The user asked: "{query}"

Web search results (title, snippet, URL):
{text_results}

Write a short, natural-language answer (2–5 sentences) that directly addresses the question and summarizes what you found. Then list each source on its own line as: "Title" — URL. Keep the tone helpful and clear. Include every URL so the user can click. Use plain "Title — URL" lines, no markdown."""


def format_search_results_with_gemini(query: str, results: list) -> str | None:
    """Use Google Gemini to format search results into a short reply. Returns None if not configured or on error."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or not results:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model_name = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(
            _build_search_prompt(query, results),
            generation_config={"max_output_tokens": 600},
        )
        if response.text:
            return response.text.strip()
    except Exception:
        pass
    return None


def format_search_results_with_claude(query: str, results: list) -> str | None:
    """Use Claude to format search results into a short reply that includes links. Returns None if not configured or on error."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key or not results:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        text_results = "\n".join(
            f"- {r.get('title', '')}: {r.get('snippet', '')} | {r.get('url', '')}" for r in results[:8]
        )
        msg = client.messages.create(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022"),
            max_tokens=600,
            messages=[{
                "role": "user",
                "content": _build_search_prompt(query, results),
            }],
        )
        if msg.content and isinstance(msg.content, list) and len(msg.content) > 0:
            block = msg.content[0]
            if hasattr(block, "text"):
                return block.text.strip()
    except Exception:
        pass
    return None


def format_search_results(query: str, results: list) -> str | None:
    """Use Gemini if configured, else Claude, to format search results. Returns None if neither is configured."""
    if os.environ.get("GEMINI_API_KEY"):
        out = format_search_results_with_gemini(query, results)
        if out:
            return out
    if os.environ.get("ANTHROPIC_API_KEY"):
        return format_search_results_with_claude(query, results)
    return None
