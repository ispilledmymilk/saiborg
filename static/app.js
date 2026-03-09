(function () {
  const API = "/api";
  const messagesEl = document.getElementById("messages");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const micBtn = document.getElementById("mic-btn");
  const tabs = document.querySelectorAll(".tab");
  const panelChat = document.getElementById("panel-chat");
  const panelCalendar = document.getElementById("panel-calendar");
  const panelSearch = document.getElementById("panel-search");
  const eventList = document.getElementById("event-list");
  const calendarStatus = document.getElementById("calendar-status");
  const addEventForm = document.getElementById("add-event-form");
  const searchHistoryEl = document.getElementById("search-history");
  const searchResultsDisplay = document.getElementById("search-results-display");
  const searchResultsQuery = document.getElementById("search-results-query");
  const searchResultsList = document.getElementById("search-results-list");
  const icalLinkBtn = document.getElementById("ical-link-btn");
  const icalDownloadBtn = document.getElementById("ical-download-btn");
  const icalLinkBox = document.getElementById("ical-link-box");
  const icalLinkInput = document.getElementById("ical-link-input");
  const icalCopyBtn = document.getElementById("ical-copy-btn");

  let recognition = null;
  let currentTab = "calendar";
  const searchHistory = [];

  function supportsSpeech() {
    return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  }

  function initSpeech() {
    if (!supportsSpeech()) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = function (e) {
      const last = e.results.length - 1;
      const text = e.results[last][0].transcript;
      if (e.results[last].isFinal) {
        chatInput.value = text;
        sendMessage(text);
      }
    };
    recognition.onerror = function () {
      micBtn.classList.remove("listening");
    };
    recognition.onend = function () {
      micBtn.classList.remove("listening");
    };
  }

  micBtn.addEventListener("mousedown", function () {
    if (!recognition) return;
    recognition.start();
    micBtn.classList.add("listening");
  });
  micBtn.addEventListener("mouseup", function () {
    if (recognition) recognition.stop();
  });
  micBtn.addEventListener("mouseleave", function () {
    if (recognition) recognition.stop();
  });

  function linkify(text) {
    if (!text || typeof text !== "string") return "";
    const urlRe = /https?:\/\/[^\s<>"']+/gi;
    const parts = [];
    let last = 0;
    let m;
    while ((m = urlRe.exec(text)) !== null) {
      parts.push({ type: "text", value: text.slice(last, m.index) });
      parts.push({ type: "url", value: m[0] });
      last = urlRe.lastIndex;
    }
    parts.push({ type: "text", value: text.slice(last) });
    return parts
      .map(function (p) {
        if (p.type === "text") return escapeHtml(p.value);
        return '<a href="' + escapeAttr(p.value) + '" target="_blank" rel="noopener" class="msg-link">' + escapeHtml(p.value) + "</a>";
      })
      .join("");
  }

  function escapeAttr(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML.replace(/"/g, "&quot;");
  }

  function addMessage(role, text, meta) {
    const div = document.createElement("div");
    div.className = "message " + role;
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "You" : "✦";
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    const hasUrls = role === "assistant" && text && /https?:\/\//i.test(text);
    if (hasUrls) {
      bubble.innerHTML = linkify(text).replace(/\n/g, "<br>");
    } else {
      const hasNewlines = role === "assistant" && text && /\n/.test(text);
      if (hasNewlines) {
        bubble.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
      } else {
        bubble.textContent = text || "";
      }
    }
    if (meta) {
      const metaEl = document.createElement("div");
      metaEl.className = "message-meta";
      metaEl.textContent = meta;
      bubble.appendChild(metaEl);
    }
    div.appendChild(avatar);
    div.appendChild(bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function sendMessage(text) {
    text = (text || "").trim();
    if (!text) return;
    addMessage("user", text);
    chatInput.value = "";

    fetch(API + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((r) => r.json())
      .then((data) => {
        addMessage("assistant", data.response);
        if (data.action === "search" && data.data && data.data.query) {
          searchHistory.push({
            query: data.data.query,
            results: data.data.results || [],
          });
          renderSearchHistory();
          showTab("search");
        }
        if (data.action === "calendar" && data.data && data.data.events) {
          showTab("calendar");
          renderEvents(data.data.events);
        }
      })
      .catch(() => addMessage("assistant", "Something went wrong. Try again."));
  }

  chatForm.addEventListener("submit", function (e) {
    e.preventDefault();
    sendMessage(chatInput.value);
  });

  function showTab(name) {
    currentTab = name;
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    panelCalendar.classList.toggle("hidden", name !== "calendar");
    panelSearch.classList.toggle("hidden", name !== "search");
  }

  tabs.forEach((t) => {
    t.addEventListener("click", function () {
      showTab(this.dataset.tab);
      if (this.dataset.tab === "calendar") loadCalendar();
    });
  });

  function renderSearchHistory() {
    searchHistoryEl.innerHTML = "";
    if (!searchHistory.length) {
      searchHistoryEl.innerHTML = "<p class='text-muted'>No searches yet.</p>";
      return;
    }
    searchHistory.forEach(function (entry, index) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "search-history-item";
      item.textContent = entry.query;
      item.dataset.index = index;
      item.addEventListener("click", function () {
        showSearchResults(index);
      });
      searchHistoryEl.appendChild(item);
    });
  }

  function showSearchResults(index) {
    const entry = searchHistory[index];
    if (!entry) return;
    searchResultsQuery.textContent = entry.query;
    searchResultsList.innerHTML = "";
    const results = entry.results || [];
    if (!results.length) {
      searchResultsList.innerHTML = "<p class='text-muted'>No results.</p>";
    } else {
      results.forEach(function (r) {
        const title = (r.title || r.title === 0) ? String(r.title) : "Link";
        const snippet = String(r.snippet || "").slice(0, 300);
        const url = (r.url && String(r.url).trim()) ? String(r.url).trim() : "#";
        const card = document.createElement("div");
        card.className = "search-result-card";
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = title;
        card.appendChild(link);
        if (snippet) {
          const p = document.createElement("p");
          p.textContent = snippet;
          card.appendChild(p);
        }
        searchResultsList.appendChild(card);
      });
    }
    searchResultsDisplay.classList.remove("hidden");
  }

  function renderEvents(events) {
    eventList.innerHTML = "";
    if (!events.length) {
      eventList.innerHTML = "<li>No upcoming events.</li>";
      return;
    }
    events.forEach((e) => {
      const li = document.createElement("li");
      li.innerHTML =
        "<strong>" +
        escapeHtml(e.summary) +
        "</strong><span>" +
        formatEventTime(e.start) +
        (e.end ? " – " + formatEventTime(e.end) : "") +
        "</span>";
      eventList.appendChild(li);
    });
  }

  function formatEventTime(s) {
    if (!s) return "";
    if (s.length === 10) return s;
    try {
      const d = new Date(s);
      return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    } catch (_) {
      return s;
    }
  }

  function loadCalendar() {
    fetch(API + "/calendar/events")
      .then((r) => r.json())
      .then((data) => {
        if (data.configured) {
          calendarStatus.textContent = data.events.length + " event(s) coming up.";
          renderEvents(data.events || []);
        } else {
          calendarStatus.textContent = "Calendar isn't connected yet. Add google_credentials.json and sign in once.";
          eventList.innerHTML = "";
        }
      })
      .catch(() => {
        calendarStatus.textContent = "Couldn't load calendar.";
        eventList.innerHTML = "";
      });
  }

  addEventForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const form = e.target;
    const start = form.start.value;
    const end = form.end.value || null;
    const summary = form.summary.value.trim();
    const description = (form.description && form.description.value) || "";
    if (!summary || !start) return;
    fetch(API + "/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        start: new Date(start).toISOString(),
        end: end ? new Date(end).toISOString() : null,
        description,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then(() => {
        form.reset();
        loadCalendar();
        addMessage("assistant", "Done — I added that to your calendar.");
      })
      .catch(() => addMessage("assistant", "Couldn't add that. Is your calendar connected?"));
  });

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function buildIcalUrl() {
    const form = addEventForm;
    const summary = (form.summary && form.summary.value || "").trim();
    const start = form.start && form.start.value;
    const end = form.end && form.end.value || "";
    const description = (form.description && form.description.value || "").trim();
    if (!summary || !start) return null;
    const params = new URLSearchParams({
      summary: summary,
      start: new Date(start).toISOString(),
    });
    if (end) params.set("end", new Date(end).toISOString());
    if (description) params.set("description", description);
    return window.location.origin + API + "/calendar/ical?" + params.toString();
  }

  icalLinkBtn.addEventListener("click", function () {
    const url = buildIcalUrl();
    if (!url) {
      addMessage("assistant", "Fill in at least the event title and start time.");
      return;
    }
    icalLinkInput.value = url;
    icalLinkBox.classList.remove("hidden");
  });

  icalDownloadBtn.addEventListener("click", function () {
    const url = buildIcalUrl();
    if (!url) {
      addMessage("assistant", "Fill in at least the event title and start time.");
      return;
    }
    window.open(url, "_blank");
  });

  icalCopyBtn.addEventListener("click", function () {
    icalLinkInput.select();
    document.execCommand("copy");
    icalCopyBtn.textContent = "Copied!";
    setTimeout(function () { icalCopyBtn.textContent = "Copy link"; }, 2000);
  });

  addMessage("assistant", "Hey! Ask me anything — I can look things up, show your calendar, or add events. Type or use the mic.");
  initSpeech();
  showTab("calendar");
})();
