"""
Voice assistant API: chat, web search, calendar.
Run: uvicorn main:app --reload
"""

import time

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.search import search_web, scrape_page_summary
from services import calendar_google as cal
try:
    from services.llm import format_search_results_with_claude
except ImportError:
    format_search_results_with_claude = None

USER_NAME = "Sai"

# --- Pydantic models ---


class ChatIn(BaseModel):
    text: str


class CalendarEventCreate(BaseModel):
    summary: str
    start: str  # ISO datetime or date
    end: str | None = None
    description: str = ""


class CalendarEventUpdate(BaseModel):
    summary: str | None = None
    start: str | None = None
    end: str | None = None


# --- App ---

app = FastAPI(title="Voice Assistant API", version="1.0")

# Mount static files (frontend)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    return FileResponse("static/index.html")


def _is_search_request(text: str) -> bool:
    """True if the user is asking a question or requesting information (search), even without saying 'search for'."""
    if not text or not text.strip():
        return False
    t = text.strip().lower()
    # Explicit search phrases
    if any(t.startswith(p) or p in t for p in (
        "search", "look up", "lookup", "find ", "find out", "what is ", "who is ", "scrape", "google "
    )):
        return True
    # Question mark
    if "?" in text:
        return True
    # Question words or request phrases (can be at start or in the middle)
    question_starts = (
        "what ", "how ", "why ", "when ", "where ", "which ", "who ",
        "give me", "tell me", "can you", "could you", "find me", "get me",
        "i need", "i want", "recipe", "best way to", "how do i", "what's a good",
        "whats a good", "recommend", "suggest", "ideas for", "good dinner",
        "easy recipe", "capital of", "meaning of", "definition of",
    )
    return any(t.startswith(p) or " " + p in " " + t for p in question_starts)


def _extract_search_query(text: str) -> str:
    """Get the query to search for; strip explicit prefixes like 'search for'."""
    query = (text or "").strip()
    if not query:
        return query
    t = query.lower()
    prefixes = (
        "search for ", "look up ", "find ", "find out ", "what is ", "who is ",
        "scrape ", "google ", "give me ", "tell me ", "can you find ", "could you find ",
    )
    for p in prefixes:
        if t.startswith(p):
            return query[len(p):].strip()
    return query


def _format_search_reply(query: str, results: list) -> str:
    """Build a spaced, readable reply with links — natural tone."""
    if not results:
        return "I couldn't find anything for that. Try different words or have a look in the Search tab."
    n = len(results)
    if n == 1:
        intro = "Here's one result that might help:\n\n"
    else:
        intro = f"Here are {n} results that might help:\n\n"
    blocks = []
    for i, r in enumerate(results[:6], 1):
        title = r.get("title") or "(No title)"
        url = r.get("url") or ""
        snippet = (r.get("snippet") or "").strip()
        if len(snippet) > 120:
            snippet = snippet[:117].rsplit(" ", 1)[0] + "..."
        block = f"• {title}\n  {url}"
        if snippet:
            block += f"\n  {snippet}"
        blocks.append(block)
    return intro + "\n\n".join(blocks)


def _route_and_respond(text: str) -> dict:
    """Route user message to search, calendar, or general; return response + optional data."""
    t = (text or "").strip().lower()
    response_text = ""
    action = "chat"
    data = None

    # Search: explicit "search for" OR any question / request (no need to say "search for")
    if _is_search_request(text):
        query = _extract_search_query(text) or (text or "").strip()
        if query:
            results = search_web(query, max_results=5)
            action = "search"
            data = {"query": query, "results": results}
            response_text = None
            if format_search_results_with_claude:
                response_text = format_search_results_with_claude(query, results)
            if not response_text:
                response_text = _format_search_reply(query, results)
            return {"response": response_text, "action": action, "data": data}

    # Calendar: list events
    if any(w in t for w in ("my calendar", "my events", "what's on my calendar", "upcoming events", "list my events", "show my schedule")):
        events = cal.list_events(max_results=15)
        action = "calendar"
        data = {"events": events}
        if not cal.calendar_configured():
            response_text = "Your calendar isn't set up yet. Add google_credentials.json and run the app to sign in once."
        elif not events:
            response_text = "You're all clear — no events in the next 30 days."
        else:
            response_text = f"You've got {len(events)} coming up. " + ", ".join(f'{e["summary"]} at {e["start"]}' for e in events[:3])
        return {"response": response_text, "action": action, "data": data}

    # Calendar: add event (simple: "add event X at Y" or "schedule X on Y")
    if any(w in t for w in ("add event", "schedule", "create event", "add to calendar", "put on my calendar")):
        # Simple extraction: treat rest as summary; for now we return instructions
        action = "calendar"
        data = {"prompt_add": True, "message": "Use the Calendar panel to add an event with title, date and time."}
        response_text = "You can add an event in the Calendar panel — just pick a title and time. Or tell me what you want to add and I'll point you there."
        return {"response": response_text, "action": action, "data": data}

    # General
    if any(w in t for w in ("hello", "hi", "hey")):
        response_text = f"Hey {USER_NAME}! What can I help you with?"
    elif any(w in t for w in ("time", "clock")):
        response_text = f"It's {time.strftime('%I:%M %p', time.localtime())}."
    elif any(w in t for w in ("help", "what can you do")):
        response_text = "You can ask me anything and I'll look it up — like \"give me a dinner recipe\" or \"what's the capital of France\". I can also show your calendar or help you add events. Just type or use the mic."
    elif any(w in t for w in ("bye", "quit", "exit")):
        response_text = "Bye! Talk to you later."
    else:
        response_text = "Just ask me anything and I'll look it up, or say \"what's on my calendar\" for your schedule."

    return {"response": response_text, "action": action, "data": data}


@app.post("/api/chat")
async def chat(body: ChatIn):
    return _route_and_respond(body.text)


@app.get("/api/search")
async def search(q: str = ""):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Missing query")
    results = search_web(q.strip(), max_results=8)
    return {"query": q.strip(), "results": results}


def _format_ics_datetime(iso_str: str) -> str:
    """Convert ISO datetime to iCal format (UTC): YYYYMMDDTHHMMSSZ."""
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            from datetime import timezone
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.strftime("%Y%m%dT%H%M%SZ")
    except Exception:
        return iso_str[:19].replace("-", "").replace(":", "").replace("T", "T") + "Z"


@app.get("/api/calendar/ical")
async def calendar_ical(
    summary: str = "",
    start: str = "",
    end: str | None = None,
    description: str = "",
):
    """Return a single event as an .ics file (iCal). No auth required."""
    if not summary.strip() or not start.strip():
        raise HTTPException(status_code=400, detail="summary and start are required")
    import uuid
    from datetime import datetime, timedelta, timezone
    uid = str(uuid.uuid4()) + "@voice-assistant"
    dt_start = _format_ics_datetime(start)
    if end and end.strip():
        dt_end = _format_ics_datetime(end)
    else:
        try:
            dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            end_dt = dt + timedelta(hours=1)
            dt_end = end_dt.strftime("%Y%m%dT%H%M%SZ")
        except Exception:
            dt_end = dt_start
    def ics_escape(s: str) -> str:
        return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r", "").replace("\n", "\\n")
    ics = (
        "BEGIN:VCALENDAR\r\n"
        "VERSION:2.0\r\n"
        "PRODID:-//Voice Assistant//EN\r\n"
        "BEGIN:VEVENT\r\n"
        f"UID:{uid}\r\n"
        f"DTSTAMP:{dt_start}\r\n"
        f"DTSTART:{dt_start}\r\n"
        f"DTEND:{dt_end}\r\n"
        f"SUMMARY:{ics_escape(summary.strip())}\r\n"
    )
    if description:
        ics += f"DESCRIPTION:{ics_escape(description.strip())}\r\n"
    ics += "END:VEVENT\r\nEND:VCALENDAR\r\n"
    from fastapi.responses import Response
    return Response(
        content=ics,
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="event.ics"'},
    )


@app.get("/api/calendar/events")
async def calendar_list():
    if not cal.calendar_configured():
        return {"configured": False, "events": []}
    events = cal.list_events(max_results=25)
    return {"configured": True, "events": events}


@app.post("/api/calendar/events")
async def calendar_add(body: CalendarEventCreate):
    if not cal.calendar_configured():
        raise HTTPException(status_code=503, detail="Calendar not configured")
    event = cal.add_event("primary", body.summary, body.start, body.end, body.description)
    if event is None:
        raise HTTPException(status_code=500, detail="Failed to create event")
    return event


@app.patch("/api/calendar/events/{event_id}")
async def calendar_update(event_id: str, body: CalendarEventUpdate):
    if not cal.calendar_configured():
        raise HTTPException(status_code=503, detail="Calendar not configured")
    event = cal.update_event("primary", event_id, body.summary, body.start, body.end)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found or update failed")
    return event


@app.delete("/api/calendar/events/{event_id}")
async def calendar_delete(event_id: str):
    if not cal.calendar_configured():
        raise HTTPException(status_code=503, detail="Calendar not configured")
    ok = cal.delete_event("primary", event_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Event not found or delete failed")
    return {"deleted": True}
