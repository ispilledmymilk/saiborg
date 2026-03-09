"""Google Calendar integration (list, add, update, delete events)."""

from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

TOKEN_PATH = Path(__file__).resolve().parent.parent / "google_calendar_token.json"
CREDENTIALS_PATH = Path(__file__).resolve().parent.parent / "google_credentials.json"

_calendar_service = None


def _get_credentials():
    if not CREDENTIALS_PATH.exists():
        return None
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request

    creds = None
    if TOKEN_PATH.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), scopes=["https://www.googleapis.com/auth/calendar"])
        except Exception:
            pass
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_PATH), scopes=["https://www.googleapis.com/auth/calendar"])
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, "w") as f:
            f.write(creds.to_json())
    return creds


def get_calendar_service():
    global _calendar_service
    if _calendar_service is not None:
        return _calendar_service
    creds = _get_credentials()
    if not creds:
        return None
    try:
        from googleapiclient.discovery import build
        _calendar_service = build("calendar", "v3", credentials=creds)
        return _calendar_service
    except Exception:
        return None


def list_events(calendar_id="primary", max_results=20, time_min=None, time_max=None):
    service = get_calendar_service()
    if not service:
        return []
    try:
        now = datetime.utcnow()
        if time_min is None:
            time_min = now
        if time_max is None:
            time_max = now + timedelta(days=30)
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min.isoformat() + "Z",
            timeMax=time_max.isoformat() + "Z",
            maxResults=max_results,
            singleEvents=True,
            orderBy="startTime",
        ).execute()
        events = events_result.get("items", [])
        out = []
        for e in events:
            start = e.get("start", {}) or {}
            end = e.get("end", {}) or {}
            out.append({
                "id": e.get("id"),
                "summary": e.get("summary", "(No title)"),
                "start": start.get("dateTime") or start.get("date"),
                "end": end.get("dateTime") or end.get("date"),
                "htmlLink": e.get("htmlLink"),
            })
        return out
    except Exception:
        return []


def add_event(calendar_id, summary, start, end=None, description="", add_meet_link=False, attendees=None):
    service = get_calendar_service()
    if not service:
        return None
    if not end:
        try:
            dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
            end_dt = dt + timedelta(hours=1)
            end = end_dt.isoformat()
        except Exception:
            end = start
    body = {
        "summary": summary,
        "description": description or "",
        "start": {"dateTime": start, "timeZone": "UTC"} if "T" in start else {"date": start[:10]},
        "end": {"dateTime": end, "timeZone": "UTC"} if "T" in (end or "") else {"date": (end or start)[:10]},
    }
    if attendees:
        body["attendees"] = [{"email": e.strip()} for e in attendees if (e and e.strip())]
    if add_meet_link:
        import uuid
        body["conferenceData"] = {
            "createRequest": {
                "requestId": str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        }
    try:
        kwargs = {"calendarId": calendar_id, "body": body}
        if add_meet_link:
            kwargs["conferenceDataVersion"] = 1
        event = service.events().insert(**kwargs).execute()
        return {
            "id": event.get("id"),
            "summary": event.get("summary"),
            "start": event.get("start", {}).get("dateTime") or event.get("start", {}).get("date"),
            "end": event.get("end", {}).get("dateTime") or event.get("end", {}).get("date"),
            "htmlLink": event.get("htmlLink"),
            "hangoutLink": event.get("hangoutLink"),
        }
    except Exception:
        return None


def update_event(calendar_id, event_id, summary=None, start=None, end=None):
    service = get_calendar_service()
    if not service:
        return None
    try:
        event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
        if summary is not None:
            event["summary"] = summary
        if start is not None:
            event["start"] = {"dateTime": start, "timeZone": "UTC"} if "T" in start else {"date": start[:10]}
        if end is not None:
            event["end"] = {"dateTime": end, "timeZone": "UTC"} if "T" in end else {"date": end[:10]}
        updated = service.events().update(calendarId=calendar_id, eventId=event_id, body=event).execute()
        return {
            "id": updated.get("id"),
            "summary": updated.get("summary"),
            "start": updated.get("start", {}).get("dateTime") or updated.get("start", {}).get("date"),
            "end": updated.get("end", {}).get("dateTime") or updated.get("end", {}).get("date"),
            "htmlLink": updated.get("htmlLink"),
        }
    except Exception:
        return None


def delete_event(calendar_id, event_id):
    service = get_calendar_service()
    if not service:
        return False
    try:
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        return True
    except Exception:
        return False


def calendar_configured():
    return CREDENTIALS_PATH.exists()


def calendar_has_token():
    return TOKEN_PATH.exists()


def run_connect_flow_sync():
    """Run OAuth flow (blocking). Opens browser. Call from a thread."""
    global _calendar_service
    _calendar_service = None
    return get_calendar_service() is not None
