"""Spotify integration: OAuth and currently playing track."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "").strip()
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "").strip()
# Must match redirect URI in Spotify Developer Dashboard (e.g. http://127.0.0.1:2987/api/spotify/callback)
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:2987/api/spotify/callback").strip()
SCOPES = "user-read-currently-playing user-read-playback-state user-modify-playback-state playlist-read-private"

TOKEN_PATH = Path(__file__).resolve().parent.parent / "spotify_token.json"


def configured():
    return bool(SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET)


def has_token():
    return TOKEN_PATH.exists()


def _load_tokens():
    if not TOKEN_PATH.exists():
        return None
    import json
    try:
        with open(TOKEN_PATH) as f:
            return json.load(f)
    except Exception:
        return None


def _save_tokens(data):
    import json
    with open(TOKEN_PATH, "w") as f:
        json.dump(data, f, indent=2)


def get_auth_url():
    import urllib.parse
    base = "https://accounts.spotify.com/authorize"
    params = {
        "client_id": SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "scope": SCOPES,
    }
    return base + "?" + urllib.parse.urlencode(params)


def exchange_code_for_tokens(code: str):
    import base64
    import json
    import urllib.parse

    auth = base64.b64encode(f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}".encode()).decode()
    body = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": SPOTIFY_REDIRECT_URI,
    }
    import httpx
    r = httpx.post(
        "https://accounts.spotify.com/api/token",
        data=body,
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    _save_tokens({
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "expires_at": data.get("expires_in", 3600) + (__import__("time").time()),
    })
    return True


def _ensure_access_token():
    data = _load_tokens()
    if not data:
        return None
    import time
    if data.get("expires_at", 0) <= time.time() + 60 and data.get("refresh_token"):
        # refresh
        import base64
        import httpx
        auth = base64.b64encode(f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}".encode()).decode()
        r = httpx.post(
            "https://accounts.spotify.com/api/token",
            data={"grant_type": "refresh_token", "refresh_token": data["refresh_token"]},
            headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
        if r.status_code != 200:
            return None
        resp = r.json()
        data["access_token"] = resp["access_token"]
        data["expires_at"] = resp.get("expires_in", 3600) + time.time()
        _save_tokens(data)
    return data.get("access_token")


def get_now_playing():
    token = _ensure_access_token()
    if not token:
        return None
    import httpx
    r = httpx.get(
        "https://api.spotify.com/v1/me/player/currently-playing",
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    if r.status_code == 204 or r.status_code != 200:
        return None
    data = r.json()
    item = data.get("item")
    if not item:
        return None
    art = item.get("album", {}).get("images")
    image_url = (art[0]["url"] if art else None) if isinstance(art, list) else None
    duration_ms = item.get("duration_ms") or 0
    return {
        "title": item.get("name", "—"),
        "artist": ", ".join(a.get("name", "") for a in item.get("artists", [])),
        "image_url": image_url,
        "track_url": item.get("external_urls", {}).get("spotify"),
        "is_playing": data.get("is_playing", False),
        "progress_ms": data.get("progress_ms", 0) or 0,
        "duration_ms": duration_ms,
        "uri": item.get("uri", ""),
    }


def _api_request(method: str, endpoint: str, json_body: dict = None, params: dict = None):
    token = _ensure_access_token()
    if not token:
        return None, None
    import httpx
    r = httpx.request(
        method,
        "https://api.spotify.com/v1" + endpoint,
        headers={"Authorization": f"Bearer {token}"},
        json=json_body,
        params=params or {},
        timeout=8,
    )
    if r.status_code in (200, 204):
        return (r.json() if r.content else {}), r.status_code
    return None, r.status_code


def _api_request_ok(method: str, endpoint: str, json_body: dict = None, params: dict = None):
    """Returns (True, None) on success, (False, status_code) on failure."""
    result, status = _api_request(method, endpoint, json_body=json_body, params=params)
    if result is not None:
        return True, None
    return False, status


def play():
    ok, status = _api_request_ok("PUT", "/me/player/play")
    return ok, status


def pause():
    ok, status = _api_request_ok("PUT", "/me/player/pause")
    return ok, status


def next_track():
    ok, status = _api_request_ok("POST", "/me/player/next")
    return ok, status


def previous_track():
    ok, status = _api_request_ok("POST", "/me/player/previous")
    return ok, status


def seek(position_ms: int):
    ok, status = _api_request_ok("PUT", "/me/player/seek", params={"position_ms": position_ms})
    return ok, status


def set_shuffle(state: bool):
    ok, _ = _api_request_ok("PUT", "/me/player/shuffle", params={"state": "true" if state else "false"})
    return ok


def set_repeat(state: str):
    if state not in ("track", "context", "off"):
        state = "off"
    ok, _ = _api_request_ok("PUT", "/me/player/repeat", params={"state": state})
    return ok


def get_playback_state():
    token = _ensure_access_token()
    if not token:
        return None
    import httpx
    r = httpx.get(
        "https://api.spotify.com/v1/me/player",
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    if r.status_code != 200:
        return None
    return r.json()


def get_queue():
    data, _ = _api_request("GET", "/me/player/queue")
    if not data:
        return None
    currently_playing = data.get("currently_playing")
    queue = data.get("queue", [])

    def norm_track(t):
        if not t:
            return None
        art = (t.get("album") or {}).get("images") or []
        img = art[0].get("url") if art else None
        artists = t.get("artists") or []
        artist = ", ".join(a.get("name", "") for a in artists)
        return {
            "title": t.get("name", "—"),
            "artist": artist,
            "uri": t.get("uri", ""),
            "image_url": img,
        }

    return {
        "currently_playing": norm_track(currently_playing) if currently_playing else None,
        "queue": [norm_track(t) for t in queue],
    }


def get_player_state():
    """Returns shuffle and repeat state from playback state."""
    data = get_playback_state()
    if not data:
        return None
    return {
        "shuffle_state": data.get("shuffle_state", False),
        "repeat_state": data.get("repeat_state", "off"),
    }


def add_to_queue(uri: str):
    ok, _ = _api_request_ok("POST", "/me/player/queue", params={"uri": uri})
    return ok


def get_playlists(limit: int = 50, offset: int = 0):
    data, _ = _api_request("GET", "/me/playlists", params={"limit": limit, "offset": offset})
    if not data:
        return None
    items = data.get("items", [])
    return {
        "items": [
            {
                "id": p.get("id"),
                "name": p.get("name", ""),
                "uri": p.get("uri", ""),
                "tracks_total": p.get("tracks", {}).get("total", 0),
                "image_url": (p.get("images", []) or [{}])[0].get("url") if p.get("images") else None,
            }
            for p in items
        ],
        "total": data.get("total", 0),
    }


def play_playlist(playlist_uri: str):
    ok, _ = _api_request_ok("PUT", "/me/player/play", json_body={"context_uri": playlist_uri})
    return ok
