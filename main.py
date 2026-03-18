"""
Saiborg API: chat, web search, calendar.
Run: uvicorn main:app --reload
"""

import threading
import time

from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.search import search_web, scrape_page_summary
from services import calendar_google as cal
try:
    from services import spotify as spotify_module
except ImportError:
    spotify_module = None
try:
    from services.llm import format_search_results
except ImportError:
    format_search_results = None
try:
    import voice_assistant as voice_module
    def _transcribe_wav_bytes(b: bytes) -> str:
        return voice_module.transcribe_wav_bytes(b)
    _voice_available = True
except ImportError:
    voice_module = None
    _transcribe_wav_bytes = None
    _voice_available = False

USER_NAME = "Sai"

# --- Pydantic models ---


class ChatIn(BaseModel):
    text: str


class CalendarEventCreate(BaseModel):
    summary: str
    start: str  # ISO datetime or date
    end: str | None = None
    description: str = ""
    add_meet_link: bool = False
    attendees: list[str] = []


class CalendarEventUpdate(BaseModel):
    summary: str | None = None
    start: str | None = None
    end: str | None = None


# --- App ---

app = FastAPI(title="Saiborg API", version="1.0")

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
            if format_search_results:
                response_text = format_search_results(query, results)
            if not response_text:
                response_text = _format_search_reply(query, results)
            return {"response": response_text, "action": action, "data": data}

    # Calendar: list events (today)
    if any(w in t for w in ("what do i have today", "what's today", "today's schedule", "events today", "meetings today", "what am i doing today")):
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        events = cal.list_events(max_results=20, time_min=today_start, time_max=today_end)
        action = "calendar"
        data = {"events": events}
        if not cal.calendar_configured():
            response_text = "Your calendar isn't set up yet."
        elif not events:
            response_text = "You're all clear for today — no events."
        else:
            response_text = f"You have {len(events)} event(s) today. " + ", ".join(f'{e["summary"]} at {e["start"]}' for e in events[:5])
        return {"response": response_text, "action": action, "data": data}

    # Calendar: list events (general)
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

    # Spotify: voice control (short, speakable responses)
    if spotify_module and spotify_module.has_token():
        # Next track
        if any(w in t for w in ("next song", "next track", "skip", "skip song", "play next")):
            ok, _ = spotify_module.next_track()
            response_text = "Playing next track." if ok else "Couldn't skip. Open Spotify on a device and try again."
            return {"response": response_text, "action": "spotify", "data": {"command": "next", "ok": ok}}
        # Previous track
        if any(w in t for w in ("previous song", "previous track", "last song", "go back", "play previous")):
            ok, _ = spotify_module.previous_track()
            response_text = "Playing previous track." if ok else "Couldn't go back. Open Spotify on a device and try again."
            return {"response": response_text, "action": "spotify", "data": {"command": "previous", "ok": ok}}
        # Play
        if any(w in t for w in ("play music", "play spotify", "resume", "resume music", "unpause")):
            ok, _ = spotify_module.play()
            response_text = "Playing." if ok else "Couldn't start. Open Spotify on a device first."
            return {"response": response_text, "action": "spotify", "data": {"command": "play", "ok": ok}}
        # Pause
        if any(w in t for w in ("pause music", "pause spotify", "pause song", "stop music")):
            ok, _ = spotify_module.pause()
            response_text = "Paused." if ok else "Couldn't pause. Open Spotify on a device first."
            return {"response": response_text, "action": "spotify", "data": {"command": "pause", "ok": ok}}
        # What's playing
        if any(w in t for w in ("what's playing", "what song is this", "current track", "what am i listening to", "now playing")):
            track = spotify_module.get_now_playing()
            if track and track.get("title"):
                response_text = f"Now playing: {track.get('title', '—')} by {track.get('artist', '—')}."
            else:
                response_text = "Nothing is playing right now. Say \"play music\" to start."
            return {"response": response_text, "action": "spotify", "data": {"command": "now_playing", "track": track}}

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


@app.get("/api/voice/status")
async def voice_status():
    """Return whether server-side voice (Whisper) is available."""
    return {"available": _voice_available}


@app.post("/api/voice/transcribe")
async def voice_transcribe(audio: UploadFile = File(..., description="WAV audio file from browser recording")):
    """Transcribe uploaded WAV audio using Whisper. Works offline."""
    if not _voice_available or not _transcribe_wav_bytes:
        raise HTTPException(
            status_code=503,
            detail="Server voice not available. Install: pip install openai-whisper",
        )
    try:
        body = await audio.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Failed to read audio")
    if len(body) > 10 * 1024 * 1024:  # 10 MB max
        raise HTTPException(status_code=400, detail="Audio file too large")
    try:
        text = _transcribe_wav_bytes(body)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail="Transcription failed. Ensure openai-whisper is installed and the audio is valid WAV.",
        )
    return {"text": text or ""}


@app.get("/api/search")
async def search(q: str = ""):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Missing query")
    query = q.strip()
    results = search_web(query, max_results=8)
    if format_search_results and results:
        answer = format_search_results(query, results)
    else:
        answer = None
    if not answer:
        answer = _format_search_reply(query, results)
    return {"query": query, "results": results, "answer": answer}


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
    uid = str(uuid.uuid4()) + "@saiborg"
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
        "PRODID:-//Saiborg//EN\r\n"
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
async def calendar_list(time_min: str = None, time_max: str = None):
    if not cal.calendar_configured():
        return {"configured": False, "events": []}
    from datetime import datetime, timezone
    t_min = None
    t_max = None
    if time_min:
        try:
            dt = datetime.fromisoformat(time_min.replace("Z", "+00:00"))
            if dt.tzinfo:
                dt = dt.astimezone(timezone.utc)
            t_min = dt.replace(tzinfo=None)
        except Exception:
            pass
    if time_max:
        try:
            dt = datetime.fromisoformat(time_max.replace("Z", "+00:00"))
            if dt.tzinfo:
                dt = dt.astimezone(timezone.utc)
            t_max = dt.replace(tzinfo=None)
        except Exception:
            pass
    events = cal.list_events(max_results=100, time_min=t_min, time_max=t_max)
    return {"configured": True, "events": events}


@app.get("/api/calendar/status")
async def calendar_status():
    """Tell the UI whether credentials file exists and whether we have a token (signed in)."""
    credentials_added = cal.calendar_configured()
    connected = credentials_added and cal.calendar_has_token()
    return {"credentials_added": credentials_added, "connected": connected}


@app.post("/api/calendar/connect")
async def calendar_connect():
    """
    Start Google OAuth flow. A browser window will open to sign in.
    Run only when credentials file exists. Returns immediately; sign-in runs in background.
    """
    if not cal.calendar_configured():
        raise HTTPException(
            status_code=400,
            detail="Add google_credentials.json to the project folder first. See README for how to get it from Google Cloud Console.",
        )
    if cal.calendar_has_token():
        return {"status": "already_connected", "message": "Calendar is already connected."}

    def _run():
        cal.run_connect_flow_sync()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {
        "status": "opening_browser",
        "message": "A browser window will open for sign-in. Complete sign-in there, then refresh the calendar.",
    }


@app.post("/api/calendar/events")
async def calendar_add(body: CalendarEventCreate):
    if not cal.calendar_configured():
        raise HTTPException(status_code=503, detail="Calendar not configured")
    event = cal.add_event(
        "primary", body.summary, body.start, body.end, body.description,
        add_meet_link=body.add_meet_link,
        attendees=body.attendees or [],
    )
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


# --- Spotify / Now Playing ---

@app.get("/api/spotify/status")
async def spotify_status():
    if not spotify_module or not spotify_module.configured():
        return {"configured": False, "connected": False}
    return {"configured": True, "connected": spotify_module.has_token()}


@app.get("/api/spotify/auth-url")
async def spotify_auth_url():
    if not spotify_module or not spotify_module.configured():
        raise HTTPException(status_code=400, detail="Spotify not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env")
    return {"url": spotify_module.get_auth_url()}


@app.get("/api/spotify/callback")
async def spotify_callback(code: str = ""):
    from fastapi.responses import RedirectResponse
    if not spotify_module or not spotify_module.configured() or not code:
        return RedirectResponse(url="/#spotify-error", status_code=302)
    try:
        spotify_module.exchange_code_for_tokens(code)
        return RedirectResponse(url="/#spotify-connected", status_code=302)
    except Exception:
        return RedirectResponse(url="/#spotify-error", status_code=302)


@app.get("/api/spotify/now-playing")
async def spotify_now_playing():
    if not spotify_module or not spotify_module.configured():
        raise HTTPException(status_code=400, detail="Spotify not configured")
    if not spotify_module.has_token():
        return {"playing": None, "connected": False}
    track = spotify_module.get_now_playing()
    state = spotify_module.get_player_state() if track else None
    return {
        "playing": track,
        "connected": True,
        "shuffle_state": state.get("shuffle_state", False) if state else False,
        "repeat_state": state.get("repeat_state", "off") if state else "off",
    }


@app.post("/api/spotify/play")
async def spotify_play():
    if not spotify_module or not spotify_module.has_token():
        raise HTTPException(status_code=400, detail="Spotify not connected")
    ok, status = spotify_module.play()
    if not ok:
        if status == 404:
            raise HTTPException(status_code=503, detail="No active Spotify device. Open Spotify on a device and try again.")
        raise HTTPException(status_code=502, detail="Playback request failed")
    return {"ok": True}


@app.post("/api/spotify/pause")
async def spotify_pause():
    if not spotify_module or not spotify_module.has_token():
        raise HTTPException(status_code=400, detail="Spotify not connected")
    ok, status = spotify_module.pause()
    if not ok:
        if status == 404:
            raise HTTPException(status_code=503, detail="No active Spotify device.")
        raise HTTPException(status_code=502, detail="Pause request failed")
    return {"ok": True}


@app.post("/api/spotify/next")
async def spotify_next():
    if not spotify_module or not spotify_module.has_token():
        raise HTTPException(status_code=400, detail="Spotify not connected")
    ok, status = spotify_module.next_track()
    if not ok:
        if status == 404:
            raise HTTPException(status_code=503, detail="No active Spotify device. Open Spotify on a device and try again.")
        if status in (401, None):
            raise HTTPException(status_code=401, detail="Spotify session expired. Reconnect in settings.")
        if status == 403:
            raise HTTPException(status_code=403, detail="Permission denied. Reconnect Spotify to grant playback control.")
        raise HTTPException(status_code=502, detail=f"Next track failed (Spotify returned {status}). Try opening Spotify on a device first.")
    return {"ok": True}


@app.post("/api/spotify/previous")
async def spotify_previous():
    if not spotify_module or not spotify_module.has_token():
        raise HTTPException(status_code=400, detail="Spotify not connected")
    ok, status = spotify_module.previous_track()
    if not ok:
        if status == 404:
            raise HTTPException(status_code=503, detail="No active Spotify device.")
        raise HTTPException(status_code=502, detail="Previous track failed")
    return {"ok": True}


@app.get("/api/spotify/queue")
async def spotify_queue():
    if not spotify_module or not spotify_module.has_token():
        raise HTTPException(status_code=400, detail="Spotify not connected")
    data = spotify_module.get_queue()
    if data is None:
        raise HTTPException(status_code=502, detail="Failed to get queue")
    return data


@app.post("/api/spotify/seek")
async def spotify_seek(position_ms: int = Query(..., ge=0)):
    if not spotify_module or not spotify_module.has_token():
        raise HTTPException(status_code=400, detail="Spotify not connected")
    ok, status = spotify_module.seek(position_ms)
    if not ok:
        if status == 404:
            raise HTTPException(status_code=503, detail="No active Spotify device. Open Spotify and play something first.")
        raise HTTPException(status_code=502, detail="Seek failed")
    return {"ok": True}


@app.post("/api/spotify/shuffle")
async def spotify_shuffle(state: bool = Query(..., description="true or false")):
    if not spotify_module or not spotify_module.has_token():
        raise HTTPException(status_code=400, detail="Spotify not connected")
    ok = spotify_module.set_shuffle(state)
    if not ok:
        raise HTTPException(status_code=502, detail="Shuffle failed. Make sure a device is playing.")
    return {"ok": True}


@app.post("/api/spotify/repeat")
async def spotify_repeat(state: str = "off"):
    if not spotify_module or not spotify_module.has_token():
        raise HTTPException(status_code=400, detail="Spotify not connected")
    if state not in ("track", "context", "off"):
        state = "off"
    ok = spotify_module.set_repeat(state)
    if not ok:
        raise HTTPException(status_code=502, detail="Repeat failed")
    return {"ok": True}


@app.get("/api/spotify/playlists")
async def spotify_playlists(offset: int = 0, limit: int = 50):
    if not spotify_module or not spotify_module.has_token():
        raise HTTPException(status_code=400, detail="Spotify not connected")
    data = spotify_module.get_playlists(limit=limit, offset=offset)
    if data is None:
        raise HTTPException(status_code=502, detail="Failed to get playlists")
    return data


@app.post("/api/spotify/play-playlist")
async def spotify_play_playlist(uri: str):
    if not spotify_module or not spotify_module.has_token():
        raise HTTPException(status_code=400, detail="Spotify not connected")
    if not uri.startswith("spotify:playlist:"):
        uri = "spotify:playlist:" + uri
    ok = spotify_module.play_playlist(uri)
    if not ok:
        raise HTTPException(status_code=502, detail="Play playlist failed")
    return {"ok": True}


@app.post("/api/spotify/queue/add")
async def spotify_queue_add(uri: str):
    if not spotify_module or not spotify_module.has_token():
        raise HTTPException(status_code=400, detail="Spotify not connected")
    ok = spotify_module.add_to_queue(uri)
    if not ok:
        raise HTTPException(status_code=502, detail="Add to queue failed")
    return {"ok": True}
