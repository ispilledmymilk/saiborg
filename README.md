# Voice Assistant — Web app

Run the **web app** (search + calendar + voice in the browser):

```bash
cd /Users/saipranavikasturi/Documents/projects
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open **http://127.0.0.1:8000** in your browser.

---

## Deploy on Vercel

1. **Push the project to GitHub** (if not already).

2. **Import on Vercel**
   - Go to [vercel.com/new](https://vercel.com/new) and import your repository.
   - Vercel will detect the FastAPI app via `pyproject.toml` and `main.py`.

3. **Environment variables**
   - In the Vercel project → **Settings → Environment Variables**, add any keys you use locally (e.g. `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_CSE_ID`).
   - **Note:** Google Calendar (OAuth with local `google_credentials.json` / `google_calendar_token.json`) is not supported on serverless; calendar features will show “not configured” unless you use another auth approach.

4. **Deploy**
   - Deploy from the Vercel dashboard or run:
     ```bash
     npx vercel
     ```
   - Your site will be available at the URL Vercel provides.

---

## Features

- **Chat** — Type or use the mic (browser speech recognition). Say things like:
  - *"Search for …"* / *"Look up …"* → web search
  - *"What's on my calendar"* / *"My events"* → list upcoming events
  - *"Add event"* → instructions to add via the Calendar panel
- **Search** — Web search with **links** in the reply and in the Search tab.
  - **Google Custom Search (optional):** For reliable links, set `GOOGLE_API_KEY` and `GOOGLE_CSE_ID` in `.env`. Create a Programmable Search Engine at [Google CSE](https://programmablesearchengine.google.com/) and enable the Custom Search API in [Google Cloud Console](https://console.cloud.google.com/). Free tier: 100 queries/day.
  - **Claude (optional):** Set `ANTHROPIC_API_KEY` in `.env` to have Claude format search results into a friendly reply that includes each link. Without it, the app still lists links in the chat and in the Search tab.
  - Without Google or Claude, search uses **ddgs** (no API key); results and links still appear in the Search tab.
- **Calendar** — List events and add new ones (Google Calendar). Connect once (see below).

---

## Google Calendar setup (optional)

1. **Google Cloud Console**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a project (or pick one) → **APIs & Services** → **Enable APIs** → enable **Google Calendar API**.
   - **Credentials** → **Create credentials** → **OAuth client ID**.
   - Application type: **Desktop app**.
   - Download the JSON and save it in the project folder as **`google_credentials.json`**.

2. **One-time sign-in**
   - From the project folder, with the venv activated, run:
     ```bash
     python -c "from services.calendar_google import get_calendar_service; get_calendar_service()"
     ```
   - A browser window opens; sign in and allow access. A **`google_calendar_token.json`** file is created.
   - After that, the web app can list and add events without opening the browser again.

---

## CLI voice assistant (no browser)

For the original terminal + mic assistant (Whisper + pyttsx3, no web):

```bash
source venv/bin/activate
python voice_assistant.py
```

No API keys needed for the CLI.

---

## Optional: Google Custom Search (for search links)

To use **Google** for web search (reliable links, 100 free queries/day):

1. [Create a Programmable Search Engine](https://programmablesearchengine.google.com/) (get the **Search engine ID**).
2. [Enable Custom Search API](https://console.cloud.google.com/apis/library/customsearch.googleapis.com) and create an **API key**.
3. In `.env` add:
   ```
   GOOGLE_API_KEY=your_api_key
   GOOGLE_CSE_ID=your_search_engine_id
   ```

## Optional: Claude (to format search replies)

To have **Claude** turn search results into a short reply with links:

1. Get an API key from [Anthropic](https://console.anthropic.com/).
2. In `.env` add:
   ```
   ANTHROPIC_API_KEY=your_anthropic_key
   ```
   Optionally set `ANTHROPIC_MODEL` (e.g. `claude-3-5-haiku-20241022` or a newer model).
