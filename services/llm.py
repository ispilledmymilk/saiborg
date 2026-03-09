"""Optional LLM formatting: Claude API to turn search results into a reply with links."""

import os
import json

from dotenv import load_dotenv
load_dotenv()

def format_search_results_with_claude(query: str, results: list) -> str | None:
    """Use Claude to format search results into a short reply that includes links. Returns None if not configured or on error."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key or not results:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        text_results = "\n".join(
            f"- {r.get('title', '')}: {r.get('url', '')}" for r in results[:8]
        )
        msg = client.messages.create(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022"),
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": f"""The user asked: "{query}"

Here are web search results (title and URL each line):
{text_results}

Write a short, friendly reply (2-4 sentences) that summarizes what you found and lists each result as a clear clickable line: "Title" — URL. Include every URL so the user can click. Do not use markdown links; use plain "Title — URL" so URLs are visible."""
            }],
        )
        if msg.content and isinstance(msg.content, list) and len(msg.content) > 0:
            block = msg.content[0]
            if hasattr(block, "text"):
                return block.text.strip()
    except Exception:
        pass
    return None
