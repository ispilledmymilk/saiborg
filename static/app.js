(function () {
  const API = "/api";
  const messagesEl = document.getElementById("messages");

  /* Electron: show custom title bar and wire window controls */
  if (typeof window.electronAPI !== "undefined") {
    document.body.classList.add("electron");
    document.body.setAttribute("data-platform", window.electronAPI.platform || "");
  }

  /* Theme: dark / light */
  const themeToggle = document.getElementById("theme-toggle");
  const themeSun = themeToggle && themeToggle.querySelector(".theme-icon.sun");
  const themeMoon = themeToggle && themeToggle.querySelector(".theme-icon.moon");
  function getStoredTheme() {
    try { return localStorage.getItem("saiborg-theme") || "light"; } catch (_) { return "light"; }
  }
  function setTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    if (themeSun && themeMoon) {
      if (theme === "dark") { themeSun.classList.add("hidden"); themeMoon.classList.remove("hidden"); }
      else { themeSun.classList.remove("hidden"); themeMoon.classList.add("hidden"); }
    }
    try { localStorage.setItem("saiborg-theme", theme); } catch (_) {}
  }
  setTheme(getStoredTheme());
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      setTheme(getStoredTheme() === "dark" ? "light" : "dark");
    });
  }

  /* Sidebar: expand / collapse */
  const appEl = document.getElementById("app");
  const sidebarToggleBtn = document.getElementById("sidebar-toggle");
  function getSidebarCollapsed() {
    try { return localStorage.getItem("saiborg-sidebar-collapsed") === "true"; } catch (_) { return false; }
  }
  function setSidebarCollapsed(collapsed) {
    if (appEl) appEl.classList.toggle("sidebar-collapsed", collapsed);
    try { localStorage.setItem("saiborg-sidebar-collapsed", collapsed ? "true" : "false"); } catch (_) {}
    if (sidebarToggleBtn) {
      sidebarToggleBtn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    }
  }
  setSidebarCollapsed(getSidebarCollapsed());
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener("click", function () {
      setSidebarCollapsed(!getSidebarCollapsed());
    });
  }

  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const micBtn = document.getElementById("mic-btn");
  const sidebarSections = document.querySelectorAll(".sidebar-section");
  const panelChat = document.getElementById("panel-chat");
  const eventList = document.getElementById("event-list");
  const calendarStatus = document.getElementById("calendar-status");
  const calendarConnectEl = document.getElementById("calendar-connect");
  const addEventForm = document.getElementById("add-event-form");
  const searchHistoryEl = document.getElementById("search-history");
  const searchResultsDisplay = document.getElementById("search-results-display");
  const searchResultsQuery = document.getElementById("search-results-query");
  const searchResultsList = document.getElementById("search-results-list");
  const searchForm = null;
  const searchInput = null;
  const searchMainView = document.getElementById("search-main-view");
  const icalLinkBtn = document.getElementById("ical-link-btn");
  const icalDownloadBtn = document.getElementById("ical-download-btn");
  const icalLinkBox = document.getElementById("ical-link-box");
  const icalLinkInput = document.getElementById("ical-link-input");
  const icalCopyBtn = document.getElementById("ical-copy-btn");

  const calendarViewTitle = document.getElementById("calendar-view-title");
  const calendarViewGrid = document.getElementById("calendar-view-grid");
  const calendarViewPrev = document.getElementById("calendar-view-prev");
  const calendarViewNext = document.getElementById("calendar-view-next");
  const calendarView = document.getElementById("calendar-view");
  const calendarViewToday = document.getElementById("calendar-view-today");

  const nowPlayingCard = document.getElementById("now-playing-card");
  const nowPlayingConnect = document.getElementById("now-playing-connect");
  const nowPlayingTitle = document.getElementById("now-playing-title");
  const nowPlayingArtist = document.getElementById("now-playing-artist");
  const nowPlayingArt = document.getElementById("now-playing-art");
  const spotifyConnectBtn = document.getElementById("spotify-connect-btn");
  const spotifyPrevBtn = document.getElementById("spotify-prev");
  const spotifyPlayPauseBtn = document.getElementById("spotify-play-pause");
  const spotifyNextBtn = document.getElementById("spotify-next");
  const spotifyMaximizeBtn = document.getElementById("spotify-maximize");
  const spotifyMinimizeBtn = document.getElementById("spotify-minimize");
  const spotifyMinimizeConnectBtn = document.getElementById("spotify-minimize-connect");
  const spotifyModal = document.getElementById("spotify-modal");
  const spotifyModalBackdrop = document.getElementById("spotify-modal-backdrop");
  const spotifyModalMinimize = document.getElementById("spotify-modal-minimize");
  const spotifyModalArt = document.getElementById("spotify-modal-art");
  const spotifyModalTitle = document.getElementById("spotify-modal-title");
  const spotifyModalArtist = document.getElementById("spotify-modal-artist");
  const spotifyProgress = document.getElementById("spotify-progress");
  const spotifyTimeCurrent = document.getElementById("spotify-time-current");
  const spotifyTimeDuration = document.getElementById("spotify-time-duration");
  const spotifyModalShuffle = document.getElementById("spotify-modal-shuffle");
  const spotifyModalPrev = document.getElementById("spotify-modal-prev");
  const spotifyModalPlayPause = document.getElementById("spotify-modal-play-pause");
  const spotifyModalNext = document.getElementById("spotify-modal-next");
  const spotifyModalRepeat = document.getElementById("spotify-modal-repeat");
  const spotifyQueueList = document.getElementById("spotify-queue-list");
  const spotifyQueueEmpty = document.getElementById("spotify-queue-empty");
  const spotifyPlaylistsList = document.getElementById("spotify-playlists-list");
  const spotifyPlaylistsLoading = document.getElementById("spotify-playlists-loading");
  const spotifyModalTabs = document.querySelectorAll(".spotify-modal-tab");
  const spotifyPanelQueue = document.getElementById("spotify-panel-queue");
  const spotifyPanelPlaylists = document.getElementById("spotify-panel-playlists");

  const spotifyMiniTabs = document.querySelectorAll(".spotify-mini-tab");
  const spotifyMiniPanelQueue = document.getElementById("spotify-mini-panel-queue");
  const spotifyMiniPanelPlaylists = document.getElementById("spotify-mini-panel-playlists");
  const spotifyMiniQueueList = document.getElementById("spotify-mini-queue-list");
  const spotifyMiniQueueHint = document.getElementById("spotify-mini-queue-hint");
  const spotifyMiniPlaylistsList = document.getElementById("spotify-mini-playlists-list");
  var openSpotifyModal;
  const spotifyMiniPlaylistsHint = document.getElementById("spotify-mini-playlists-hint");
  const spotifyMiniProgress = document.getElementById("spotify-mini-progress");
  const spotifyMiniTimeCurrent = document.getElementById("spotify-mini-time-current");
  const spotifyMiniTimeDuration = document.getElementById("spotify-mini-time-duration");

  let recognition = null;
  let currentTab = "calendar";
  const searchHistory = [];
  let lastSpeechTranscript = "";
  let speechSubmitted = false;

  function supportsSpeech() {
    return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  }

  function initSpeech() {
    if (!supportsSpeech()) {
      if (micBtn) {
        micBtn.disabled = true;
        micBtn.title = "Voice input not supported in this browser";
      }
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = function (e) {
      const last = e.results.length - 1;
      const text = (e.results[last][0] && e.results[last][0].transcript) ? e.results[last][0].transcript.trim() : "";
      lastSpeechTranscript = text;
      if (e.results[last].isFinal && text) {
        speechSubmitted = true;
        if (chatInput) chatInput.value = text;
        if (currentTab === "search") {
          runNewSearch(text);
          if (chatInput) chatInput.value = "";
        } else {
          sendMessage(text);
        }
      }
    };
    recognition.onerror = function (e) {
      micBtn.classList.remove("listening");
      if (e.error === "not-allowed") {
        if (messagesEl) addMessage("assistant", "Microphone access denied. Allow the mic in your browser or system settings and try again.");
      } else if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
        if (messagesEl) addMessage("assistant", "Voice error: " + (e.error || "unknown"));
      }
    };
    recognition.onend = function () {
      micBtn.classList.remove("listening");
      if (!speechSubmitted && lastSpeechTranscript.trim()) {
        if (chatInput) chatInput.value = lastSpeechTranscript;
        if (currentTab === "search") {
          runNewSearch(lastSpeechTranscript);
          if (chatInput) chatInput.value = "";
        } else {
          sendMessage(lastSpeechTranscript);
        }
      }
      lastSpeechTranscript = "";
      speechSubmitted = false;
    };
  }

  micBtn.addEventListener("mousedown", function () {
    if (!recognition || micBtn.disabled) return;
    lastSpeechTranscript = "";
    speechSubmitted = false;
    try {
      recognition.start();
      micBtn.classList.add("listening");
    } catch (err) {
      if (err.name !== "InvalidStateError") {
        if (messagesEl) addMessage("assistant", "Could not start microphone. Try allowing mic access and try again.");
      }
    }
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
    var text = (chatInput && chatInput.value) ? chatInput.value.trim() : "";
    if (!text) return;
    if (currentTab === "search") {
      runNewSearch(text);
      if (chatInput) chatInput.value = "";
    } else {
      sendMessage(text);
    }
  });

  function showTab(name) {
    currentTab = name;
    if (sidebarSections && sidebarSections.length) {
      sidebarSections.forEach(function (s) {
        s.classList.toggle("expanded", s.dataset.tab === name);
        var header = s.querySelector(".sidebar-section-header");
        if (header) header.setAttribute("aria-expanded", s.dataset.tab === name ? "true" : "false");
      });
    }
    if (calendarView) calendarView.classList.toggle("hidden", name !== "calendar");
    if (searchMainView) searchMainView.classList.toggle("hidden", name !== "search");
    var spotifyViewScene = document.getElementById("spotify-view-scene");
    if (spotifyViewScene) {
      spotifyViewScene.classList.toggle("hidden", name !== "spotify");
      spotifyViewScene.setAttribute("aria-hidden", name !== "spotify" ? "true" : "false");
    }
    var plantView = document.getElementById("plant-view");
    if (plantView) {
      plantView.classList.toggle("hidden", name !== "plant");
      plantView.setAttribute("aria-hidden", name !== "plant" ? "true" : "false");
    }
    if (appEl) {
      appEl.classList.toggle("calendar-tab-active", name === "calendar");
      appEl.classList.toggle("search-tab-active", name === "search" || name === "spotify");
      appEl.classList.toggle("plant-tab-active", name === "plant");
    }
  }

  sidebarSections.forEach(function (section) {
    var header = section.querySelector(".sidebar-section-header");
    var tab = section.dataset.tab;
    if (!header || !tab) return;
    header.addEventListener("click", function () {
      var isExpanded = section.classList.toggle("expanded");
      header.setAttribute("aria-expanded", isExpanded ? "true" : "false");
      showTab(tab);
      if (tab === "spotify") {
        if (typeof openSpotifyModal === "function") openSpotifyModal();
      } else if (tab === "calendar") {
        loadCalendar();
      }
    });
  });

  function runNewSearch(query) {
    query = (query || "").trim();
    if (!query) return;
    fetch(API + "/search?q=" + encodeURIComponent(query))
      .then((r) => r.json())
      .then(function (data) {
        searchHistory.push({ query: data.query, results: data.results || [], answer: data.answer || "" });
        renderSearchHistory();
        showSearchResults(searchHistory.length - 1);
      })
      .catch(function () {
        if (searchHistoryEl) searchHistoryEl.innerHTML = "<p class='text-muted'>Search failed. Try again.</p>";
      });
  }

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
    const searchResultsAnswer = document.getElementById("search-results-answer");
    searchResultsQuery.textContent = entry.query;
    if (searchResultsAnswer) {
      const answer = entry.answer || "";
      if (answer) {
        const escaped = answer.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
        const withLinks = escaped.replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener" class="search-answer-link">$1</a>');
        searchResultsAnswer.innerHTML = withLinks;
        searchResultsAnswer.classList.remove("hidden");
      } else {
        searchResultsAnswer.textContent = "";
        searchResultsAnswer.classList.add("hidden");
      }
    }
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
    fetch(API + "/calendar/status")
      .then((r) => r.json())
      .then((status) => {
        if (status.connected) {
          calendarConnectEl.classList.add("hidden");
          calendarConnectEl.innerHTML = "";
          fetch(API + "/calendar/events")
            .then((r) => r.json())
            .then((data) => {
              calendarStatus.textContent = data.events.length + " event(s) coming up.";
              renderEvents(data.events || []);
              renderCalendarView();
            })
            .catch(() => {
              calendarStatus.textContent = "Couldn't load calendar.";
              eventList.innerHTML = "";
            });
          return;
        }
        eventList.innerHTML = "";
        if (!status.credentials_added) {
          calendarStatus.textContent = "";
          calendarConnectEl.classList.remove("hidden");
          calendarConnectEl.innerHTML =
            "<p class=\"calendar-connect-text\">Connect Google Calendar to see and add events here.</p>" +
            "<ol class=\"calendar-connect-steps\">" +
            "<li>Open <a href=\"https://console.cloud.google.com/\" target=\"_blank\" rel=\"noopener\">Google Cloud Console</a>.</li>" +
            "<li>Create a project → APIs & Services → Enable <strong>Google Calendar API</strong>.</li>" +
            "<li>Credentials → Create credentials → <strong>OAuth client ID</strong> → Application type: <strong>Desktop app</strong>.</li>" +
            "<li>Download the JSON and save it in this app's project folder as <code>google_credentials.json</code>.</li>" +
            "</ol>" +
            "<p class=\"calendar-connect-then\">Then refresh this page and click <strong>Sign in with Google</strong> below.</p>";
          return;
        }
        calendarStatus.textContent = "Sign in to connect your calendar.";
        calendarConnectEl.classList.remove("hidden");
        calendarConnectEl.innerHTML =
          "<p class=\"calendar-connect-text\">Credentials file found. One-time sign-in required.</p>" +
          "<button type=\"button\" class=\"calendar-connect-btn\" id=\"calendar-signin-btn\">Sign in with Google</button>" +
          "<p class=\"calendar-connect-hint\" id=\"calendar-connect-hint\"></p>";
        const signInBtn = document.getElementById("calendar-signin-btn");
        const hintEl = document.getElementById("calendar-connect-hint");
        if (signInBtn) {
          signInBtn.addEventListener("click", function () {
            signInBtn.disabled = true;
            signInBtn.textContent = "Opening browser…";
            hintEl.textContent = "";
            fetch(API + "/calendar/connect", { method: "POST" })
              .then((r) => {
                return r.json().then(function (data) {
                  if (!r.ok) throw new Error(data.detail || r.statusText);
                  return data;
                });
              })
              .then((data) => {
                hintEl.textContent = data.message || "Complete sign-in in the browser that opened, then refresh.";
                signInBtn.textContent = "Sign in with Google";
                signInBtn.disabled = false;
                var pollCount = 0;
                var poll = function () {
                  pollCount++;
                  fetch(API + "/calendar/status")
                    .then((r) => r.json())
                    .then(function (s) {
                      if (s.connected) {
                        loadCalendar();
                        return;
                      }
                      if (pollCount < 15) setTimeout(poll, 2000);
                    })
                    .catch(function () {
                      if (pollCount < 15) setTimeout(poll, 2000);
                    });
                };
                setTimeout(poll, 3000);
              })
              .catch((err) => {
                hintEl.textContent = err.message || "Something went wrong. Try again.";
                signInBtn.textContent = "Sign in with Google";
                signInBtn.disabled = false;
              });
          });
        }
      })
      .catch(() => {
        calendarStatus.textContent = "Couldn't load calendar.";
        calendarConnectEl.classList.add("hidden");
        eventList.innerHTML = "";
      });
  }

  var calendarViewMonth = { year: new Date().getFullYear(), month: new Date().getMonth() };
  var calendarHighlightTodayAfterRender = false;

  var calendarDayModal = document.getElementById("calendar-day-modal");
  var calendarDayModalBackdrop = document.getElementById("calendar-day-modal-backdrop");
  var calendarDayModalTitle = document.getElementById("calendar-day-modal-title");
  var calendarDayModalEvents = document.getElementById("calendar-day-modal-events");
  var calendarDayModalForm = document.getElementById("calendar-day-modal-form");
  var calendarDayModalClose = document.getElementById("calendar-day-modal-close");
  var calendarNewModal = document.getElementById("calendar-new-modal");
  var calendarNewModalBackdrop = document.getElementById("calendar-new-modal-backdrop");
  var calendarNewModalForm = document.getElementById("calendar-new-modal-form");
  var calendarNewModalClose = document.getElementById("calendar-new-modal-close");
  var calendarViewAddBtn = document.getElementById("calendar-view-add-btn");
  var selectedDayDateKey = null;

  function openDayModal(dateKey) {
    selectedDayDateKey = dateKey;
    if (!calendarDayModal || !calendarDayModalTitle || !calendarDayModalEvents) return;
    var d = dateKey.split("-");
    var dateStr = d[1] + "/" + d[2] + "/" + d[0];
    calendarDayModalTitle.textContent = "Events — " + dateStr;
    var startInput = calendarDayModalForm && calendarDayModalForm.querySelector('input[name="start"]');
    if (startInput) startInput.value = dateKey + "T09:00";
    if (calendarDayModalForm) calendarDayModalForm.reset();
    if (startInput) startInput.value = dateKey + "T09:00";
    calendarDayModalEvents.innerHTML = "<p class=\"text-muted\" style=\"margin:0; font-size:0.85rem;\">Loading…</p>";
    calendarDayModal.classList.remove("hidden");
    if (calendarDayModalBackdrop) calendarDayModalBackdrop.classList.remove("hidden");
    var timeMin = dateKey + "T00:00:00.000Z";
    var nextDay = new Date(new Date(dateKey).getTime() + 86400000);
    var timeMax = nextDay.toISOString().slice(0, 10) + "T00:00:00.000Z";
    fetch(API + "/calendar/events?time_min=" + encodeURIComponent(timeMin) + "&time_max=" + encodeURIComponent(timeMax))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var events = data.events || [];
        calendarDayModalEvents.innerHTML = "";
        if (events.length === 0) {
          var p = document.createElement("p");
          p.className = "text-muted";
          p.style.margin = "0";
          p.style.fontSize = "0.85rem";
          p.textContent = "No events this day.";
          calendarDayModalEvents.appendChild(p);
        } else {
          events.forEach(function (ev) {
            var li = document.createElement("div");
            li.className = "day-event-item";
            var link = document.createElement("a");
            link.href = ev.htmlLink || "#";
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = ev.summary || "(No title)";
            li.appendChild(link);
            var actions = document.createElement("div");
            actions.className = "day-event-item-actions";
            var delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.textContent = "Delete";
            delBtn.addEventListener("click", function () {
              if (!confirm("Delete this event?")) return;
              fetch(API + "/calendar/events/" + encodeURIComponent(ev.id), { method: "DELETE" })
                .then(function (r) {
                  if (r.ok) openDayModal(selectedDayDateKey);
                  loadCalendar();
                  renderCalendarView();
                });
            });
            actions.appendChild(delBtn);
            li.appendChild(actions);
            calendarDayModalEvents.appendChild(li);
          });
        }
      })
      .catch(function () {
        calendarDayModalEvents.innerHTML = "<p class=\"text-muted\" style=\"margin:0; font-size:0.85rem;\">Could not load events.</p>";
      });
  }

  function closeDayModal() {
    if (calendarDayModal) calendarDayModal.classList.add("hidden");
    if (calendarDayModalBackdrop) calendarDayModalBackdrop.classList.add("hidden");
    selectedDayDateKey = null;
  }

  function openNewEventModal() {
    if (!calendarNewModal || !calendarNewModalForm) return;
    calendarNewModalForm.reset();
    var start = document.querySelector('#calendar-new-modal-form input[name="start"]');
    if (start) {
      var now = new Date();
      start.value = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0") + "T09:00";
    }
    calendarNewModal.classList.remove("hidden");
    if (calendarNewModalBackdrop) calendarNewModalBackdrop.classList.remove("hidden");
  }

  function closeNewEventModal() {
    if (calendarNewModal) calendarNewModal.classList.add("hidden");
    if (calendarNewModalBackdrop) calendarNewModalBackdrop.classList.add("hidden");
  }

  function renderCalendarView() {
    if (!calendarViewGrid || !calendarViewTitle) return;
    var y = calendarViewMonth.year;
    var m = calendarViewMonth.month;
    var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    calendarViewTitle.textContent = monthNames[m] + " " + y;

    var first = new Date(y, m, 1);
    var last = new Date(y, m + 1, 0);
    var startDay = first.getDay();
    var daysInMonth = last.getDate();
    var prevMonth = new Date(y, m, 0);
    var prevMonthDays = prevMonth.getDate();

    var timeMin = new Date(y, m, 1).toISOString();
    var timeMax = new Date(y, m + 1, 1).toISOString();
    fetch(API + "/calendar/events?time_min=" + encodeURIComponent(timeMin) + "&time_max=" + encodeURIComponent(timeMax))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var eventsByDate = {};
        (data.events || []).forEach(function (ev) {
          var start = ev.start || "";
          var dateKey = start.indexOf("T") >= 0 ? start.slice(0, 10) : start;
          if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
          eventsByDate[dateKey].push(ev);
        });

        var cells = [];
        for (var i = 0; i < startDay; i++) {
          var d = prevMonthDays - startDay + 1 + i;
          var py = prevMonth.getFullYear();
          var pm = prevMonth.getMonth() + 1;
          cells.push({ day: d, other: true, dateKey: py + "-" + String(pm).padStart(2, "0") + "-" + String(d).padStart(2, "0") });
        }
        for (var d = 1; d <= daysInMonth; d++) {
          var dateKey = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
          cells.push({ day: d, other: false, dateKey: dateKey });
        }
        var totalSoFar = cells.length;
        var remaining = totalSoFar % 7 === 0 ? 0 : 7 - (totalSoFar % 7);
        var nextYear = m === 11 ? y + 1 : y;
        var nextMonth = m === 11 ? 1 : m + 1;
        for (var n = 1; n <= remaining; n++) {
          cells.push({ day: n, other: true, dateKey: nextYear + "-" + String(nextMonth).padStart(2, "0") + "-" + String(n).padStart(2, "0") });
        }

        var today = new Date();
        var todayKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

        calendarViewGrid.innerHTML = "";
        cells.forEach(function (cell) {
          var dayEl = document.createElement("div");
          dayEl.className = "calendar-view-day" + (cell.other ? " other-month" : "") + (cell.dateKey === todayKey ? " today" : "");
          dayEl.setAttribute("data-date", cell.dateKey);
          dayEl.setAttribute("role", "button");
          dayEl.setAttribute("tabindex", "0");
          dayEl.title = "Click to add an event on this day";
          var events = eventsByDate[cell.dateKey] || [];
          dayEl.innerHTML = "<span class=\"calendar-view-day-number\">" + cell.day + "</span><ul class=\"calendar-view-day-events\">" +
            events.slice(0, 5).map(function (e) {
              var link = e.htmlLink ? ("<a href=\"" + e.htmlLink + "\" target=\"_blank\" rel=\"noopener\">" + escapeHtml(e.summary) + "</a>") : escapeHtml(e.summary);
              return "<li>" + link + "</li>";
            }).join("") +
            (events.length > 5 ? "<li>+" + (events.length - 5) + " more</li>" : "") +
            "</ul>";
          dayEl.addEventListener("click", function (e) {
            if (e.target.closest("a")) return;
            var dateKey = this.getAttribute("data-date");
            if (!dateKey || !addEventForm) return;
            var startInput = addEventForm.querySelector('input[name="start"]');
            if (startInput) {
              startInput.value = dateKey + "T09:00";
              showTab("calendar");
              var calendarSection = document.querySelector(".sidebar-section[data-tab=\"calendar\"]");
              if (calendarSection) calendarSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          });
          dayEl.addEventListener("dblclick", function (e) {
            e.preventDefault();
            if (e.target.closest("a")) return;
            var dateKey = this.getAttribute("data-date");
            if (dateKey) openDayModal(dateKey);
          });
          dayEl.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.click(); }
          });
          calendarViewGrid.appendChild(dayEl);
        });
        if (calendarHighlightTodayAfterRender) {
          calendarHighlightTodayAfterRender = false;
          var todayCell = calendarViewGrid.querySelector(".calendar-view-day.today");
          if (todayCell) {
            todayCell.classList.add("today-highlight");
            todayCell.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
            setTimeout(function () { todayCell.classList.remove("today-highlight"); }, 2500);
          }
        }
      })
      .catch(function () {
        calendarViewGrid.innerHTML = "<p class=\"text-muted\" style=\"grid-column:1/-1; padding:1rem;\">Could not load calendar events.</p>";
      });
  }

  if (calendarViewPrev) calendarViewPrev.addEventListener("click", function () {
    if (calendarViewMonth.month === 0) { calendarViewMonth.year--; calendarViewMonth.month = 11; } else calendarViewMonth.month--;
    renderCalendarView();
  });
  if (calendarViewNext) calendarViewNext.addEventListener("click", function () {
    if (calendarViewMonth.month === 11) { calendarViewMonth.year++; calendarViewMonth.month = 0; } else calendarViewMonth.month++;
    renderCalendarView();
  });
  if (calendarViewToday) calendarViewToday.addEventListener("click", function () {
    var now = new Date();
    calendarViewMonth.year = now.getFullYear();
    calendarViewMonth.month = now.getMonth();
    calendarHighlightTodayAfterRender = true;
    renderCalendarView();
  });
  if (calendarViewAddBtn) calendarViewAddBtn.addEventListener("click", openNewEventModal);
  if (calendarDayModalClose) calendarDayModalClose.addEventListener("click", closeDayModal);
  if (calendarDayModalBackdrop) calendarDayModalBackdrop.addEventListener("click", closeDayModal);
  if (calendarNewModalClose) calendarNewModalClose.addEventListener("click", closeNewEventModal);
  if (calendarNewModalBackdrop) calendarNewModalBackdrop.addEventListener("click", closeNewEventModal);
  if (calendarDayModalForm) calendarDayModalForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    var summary = form.summary.value.trim();
    var start = form.start.value;
    var end = form.end.value || null;
    var description = (form.description && form.description.value) || "";
    if (!summary || !start) return;
    fetch(API + "/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary, start: new Date(start).toISOString(), end: end ? new Date(end).toISOString() : null, description }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then(function () {
        form.reset();
        var dateKey = selectedDayDateKey;
        if (dateKey) form.querySelector('input[name="start"]').value = dateKey + "T09:00";
        loadCalendar();
        renderCalendarView();
        if (dateKey) openDayModal(dateKey);
      })
      .catch(function () {
        if (messagesEl) addMessage("assistant", "Could not add event. Try again.");
      });
  });
  if (calendarNewModalForm) calendarNewModalForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    var summary = form.summary.value.trim();
    var start = form.start.value;
    var end = form.end.value || null;
    var description = (form.description && form.description.value) || "";
    var addMeet = form.add_meet_link && form.add_meet_link.checked;
    var attendeesStr = (form.attendees && form.attendees.value) || "";
    var attendees = attendeesStr.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    if (!summary || !start) return;
    fetch(API + "/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        start: new Date(start).toISOString(),
        end: end ? new Date(end).toISOString() : null,
        description,
        add_meet_link: addMeet,
        attendees: attendees,
      }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then(function (ev) {
        form.reset();
        closeNewEventModal();
        loadCalendar();
        renderCalendarView();
        if (messagesEl) addMessage("assistant", "Event created." + (ev.hangoutLink ? " Meet: " + ev.hangoutLink : ""));
      })
      .catch(function () {
        if (messagesEl) addMessage("assistant", "Could not create event. Try again.");
      });
  });

  if (addEventForm) {
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
          renderCalendarView();
          addMessage("assistant", "Done — I added that to your calendar.");
        })
        .catch(() => addMessage("assistant", "Couldn't add that. Is your calendar connected?"));
    });
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function buildIcalUrl() {
    if (!addEventForm) return null;
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

  if (icalLinkBtn && icalLinkInput && icalLinkBox) {
    icalLinkBtn.addEventListener("click", function () {
      const url = buildIcalUrl();
      if (!url) {
        addMessage("assistant", "Fill in at least the event title and start time.");
        return;
      }
      icalLinkInput.value = url;
      icalLinkBox.classList.remove("hidden");
    });
  }
  if (icalDownloadBtn) {
    icalDownloadBtn.addEventListener("click", function () {
      const url = buildIcalUrl();
      if (!url) {
        addMessage("assistant", "Fill in at least the event title and start time.");
        return;
      }
      window.open(url, "_blank");
    });
  }
  if (icalCopyBtn && icalLinkInput) {
    icalCopyBtn.addEventListener("click", function () {
      icalLinkInput.select();
      document.execCommand("copy");
      icalCopyBtn.textContent = "Copied!";
      setTimeout(function () { icalCopyBtn.textContent = "Copy link"; }, 2000);
    });
  }

  initSpeech();
  showTab("search");
  renderCalendarView();

  /* Now Playing (Spotify) */
  let nowPlayingPollTimer = null;
  function loadSpotifyStatus() {
    fetch(API + "/spotify/status")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.connected) {
          pollNowPlaying();
        }
      })
      .catch(function () {});
  }
  function updateNowPlayingCard(track) {
    function setSidebarNowPlaying(title, artist, imageUrl) {
      var st = document.getElementById("sidebar-now-playing-title");
      var sa = document.getElementById("sidebar-now-playing-artist");
      var sart = document.getElementById("sidebar-now-playing-art");
      if (st) st.textContent = title || "—";
      if (sa) sa.textContent = artist || "—";
      if (sart) {
        if (imageUrl) {
          sart.innerHTML = "<img src=\"" + imageUrl + "\" alt=\"\" />";
        } else {
          sart.innerHTML = "";
          sart.style.background = "var(--accent)";
        }
      }
    }
    if (!track) {
      setSidebarNowPlaying("Nothing playing", "Play something on Spotify", null);
      var sidebarPlay = document.getElementById("sidebar-spotify-play");
      if (sidebarPlay) sidebarPlay.textContent = "▶";
      return;
    }
    setSidebarNowPlaying(track.title, track.artist, track.image_url || null);
    var sidebarPlay = document.getElementById("sidebar-spotify-play");
    if (sidebarPlay) sidebarPlay.textContent = track.is_playing ? "⏸" : "▶";
  }
  function pollNowPlaying() {
    if (nowPlayingPollTimer) clearTimeout(nowPlayingPollTimer);
    fetch(API + "/spotify/now-playing")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.connected) {
          updateNowPlayingCard(data.playing || null);
        }
        var interval = (spotifyModal && !spotifyModal.classList.contains("hidden")) ? 1000 : 5000;
        nowPlayingPollTimer = setTimeout(pollNowPlaying, interval);
      })
      .catch(function () {
        nowPlayingPollTimer = setTimeout(pollNowPlaying, 10000);
      });
  }
  if (spotifyConnectBtn) {
    spotifyConnectBtn.addEventListener("click", function () {
      fetch(API + "/spotify/auth-url")
        .then(function (r) { return r.json(); })
        .then(function (data) { window.location.href = data.url; })
        .catch(function () {});
    });
  }
  function spotifyControl(action) {
    fetch(API + "/spotify/" + action, { method: "POST" })
      .then(function (r) {
        if (r.ok) {
          setTimeout(pollNowPlaying, 300);
        } else {
          r.json().catch(function () { return {}; }).then(function (body) {
            var msg = (body && body.detail) ? body.detail : "Spotify request failed.";
            if (typeof addMessage === "function") addMessage("assistant", msg);
          });
        }
        setTimeout(pollNowPlaying, 500);
      })
      .catch(function () {
        if (typeof addMessage === "function") addMessage("assistant", "Spotify control failed. Check your connection and try again.");
        setTimeout(pollNowPlaying, 500);
      });
  }
  if (spotifyPrevBtn) spotifyPrevBtn.addEventListener("click", function () { spotifyControl("previous"); });
  if (spotifyPlayPauseBtn) spotifyPlayPauseBtn.addEventListener("click", function () {
    fetch(API + "/spotify/now-playing").then(function (r) { return r.json(); }).then(function (d) {
      spotifyControl(d.playing && d.playing.is_playing ? "pause" : "play");
    }).catch(function () { spotifyControl("play"); });
  });
  if (spotifyNextBtn) spotifyNextBtn.addEventListener("click", function () { spotifyControl("next"); });
  var sidebarSpotifyPrev = document.getElementById("sidebar-spotify-prev");
  var sidebarSpotifyPlay = document.getElementById("sidebar-spotify-play");
  var sidebarSpotifyNext = document.getElementById("sidebar-spotify-next");
  if (sidebarSpotifyPrev) sidebarSpotifyPrev.addEventListener("click", function () { spotifyControl("previous"); });
  if (sidebarSpotifyPlay) sidebarSpotifyPlay.addEventListener("click", function () {
    fetch(API + "/spotify/now-playing").then(function (r) { return r.json(); }).then(function (d) {
      spotifyControl(d.playing && d.playing.is_playing ? "pause" : "play");
    }).catch(function () { spotifyControl("play"); });
  });
  if (sidebarSpotifyNext) sidebarSpotifyNext.addEventListener("click", function () { spotifyControl("next"); });

  /* Mini player: Queue & Playlists */
  var spotifyMiniQueueLoaded = false;
  var spotifyMiniPlaylistsLoaded = false;

  function loadMiniQueue() {
    if (!spotifyMiniQueueList || !spotifyMiniQueueHint) return;
    fetch(API + "/spotify/queue")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        spotifyMiniQueueLoaded = true;
        spotifyMiniQueueList.innerHTML = "";
        var q = data.queue || [];
        if (q.length === 0) {
          spotifyMiniQueueHint.classList.remove("hidden");
          spotifyMiniQueueHint.textContent = "No tracks in queue.";
        } else {
          spotifyMiniQueueHint.classList.add("hidden");
          q.forEach(function (t) {
            var li = document.createElement("li");
            li.innerHTML = "<div class=\"spotify-mini-item-art\">" + (t.image_url ? "<img src=\"" + t.image_url + "\" alt=\"\" />" : "") + "</div>" +
              "<div class=\"spotify-mini-item-info\"><span class=\"spotify-mini-item-title\">" + (t.title || "—") + "</span><span class=\"spotify-mini-item-artist\">" + (t.artist || "") + "</span></div>";
            spotifyMiniQueueList.appendChild(li);
          });
        }
      })
      .catch(function () {
        spotifyMiniQueueHint.classList.remove("hidden");
        spotifyMiniQueueHint.textContent = "Could not load queue.";
      });
  }

  function loadMiniPlaylists() {
    if (!spotifyMiniPlaylistsList || !spotifyMiniPlaylistsHint) return;
    spotifyMiniPlaylistsHint.classList.remove("hidden");
    spotifyMiniPlaylistsHint.textContent = "Loading…";
    spotifyMiniPlaylistsList.innerHTML = "";
    fetch(API + "/spotify/playlists?limit=50")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        spotifyMiniPlaylistsLoaded = true;
        spotifyMiniPlaylistsHint.classList.add("hidden");
        var items = data.items || [];
        if (items.length === 0) {
          spotifyMiniPlaylistsHint.classList.remove("hidden");
          spotifyMiniPlaylistsHint.textContent = "No playlists found.";
        } else {
          items.forEach(function (pl) {
            var li = document.createElement("li");
            li.dataset.uri = pl.uri || "spotify:playlist:" + pl.id;
            li.innerHTML = "<div class=\"spotify-mini-item-art\">" + (pl.image_url ? "<img src=\"" + pl.image_url + "\" alt=\"\" />" : "") + "</div>" +
              "<div class=\"spotify-mini-item-info\"><span class=\"spotify-mini-item-title\">" + (pl.name || "Playlist") + "</span></div>";
            li.addEventListener("click", function () {
              var uri = this.dataset.uri;
              fetch(API + "/spotify/play-playlist?uri=" + encodeURIComponent(uri), { method: "POST" })
                .then(function (r) { if (r.ok) pollNowPlaying(); });
            });
            spotifyMiniPlaylistsList.appendChild(li);
          });
        }
      })
      .catch(function () {
        spotifyMiniPlaylistsHint.classList.remove("hidden");
        spotifyMiniPlaylistsHint.textContent = "Could not load playlists.";
      });
  }

  if (spotifyMiniTabs && spotifyMiniTabs.length) {
    spotifyMiniTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var panelId = this.dataset.miniPanel;
        spotifyMiniTabs.forEach(function (t) { t.classList.remove("active"); });
        this.classList.add("active");
        if (spotifyMiniPanelQueue) spotifyMiniPanelQueue.classList.toggle("active", panelId === "queue");
        if (spotifyMiniPanelPlaylists) spotifyMiniPanelPlaylists.classList.toggle("active", panelId === "playlists");
        if (panelId === "queue" && !spotifyMiniQueueLoaded) loadMiniQueue();
        if (panelId === "playlists" && !spotifyMiniPlaylistsLoaded) loadMiniPlaylists();
      });
    });
  }

  /* When mini player is shown and Queue tab is active, load queue */
  function loadMiniPlayerDataIfNeeded() {}

  /* Spotify maximized modal */
  function formatTime(ms) {
    if (ms == null || !isFinite(ms)) return "0:00";
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function updateSpotifyModal(data) {
    if (!data || !data.connected) return;
    var track = data.playing || null;
    if (spotifyModalTitle) spotifyModalTitle.textContent = track ? (track.title || "—") : "—";
    if (spotifyModalArtist) spotifyModalArtist.textContent = track ? (track.artist || "—") : "—";
    if (spotifyModalArt) {
      if (track && track.image_url) {
        spotifyModalArt.innerHTML = "<img src=\"" + track.image_url + "\" alt=\"\" />";
      } else {
        spotifyModalArt.innerHTML = "";
        spotifyModalArt.style.background = "var(--accent)";
      }
    }
    var progress = track ? (Number(track.progress_ms) || 0) : 0;
    var duration = track ? (Number(track.duration_ms) || 0) : 0;
    if (duration <= 0) duration = 1000;
    if (progress > duration) progress = duration;
    if (spotifyProgress) {
      spotifyProgress.max = duration;
      spotifyProgress.value = progress;
    }
    if (spotifyTimeCurrent) spotifyTimeCurrent.textContent = formatTime(progress);
    if (spotifyTimeDuration) spotifyTimeDuration.textContent = formatTime(duration);
    if (spotifyModalPlayPause) spotifyModalPlayPause.textContent = (track && track.is_playing) ? "⏸" : "▶";
    if (spotifyModalShuffle) spotifyModalShuffle.classList.toggle("active", !!data.shuffle_state);
    if (spotifyModalRepeat) {
      spotifyModalRepeat.classList.toggle("active", data.repeat_state !== "off");
      spotifyModalRepeat.textContent = data.repeat_state === "track" ? "🔂" : "🔁";
    }
  }

  var spotifyProgressDragging = false;
  if (spotifyProgress) {
    spotifyProgress.addEventListener("mousedown", function () { spotifyProgressDragging = true; });
    spotifyProgress.addEventListener("mouseup", function () { spotifyProgressDragging = false; });
    spotifyProgress.addEventListener("mouseleave", function () { spotifyProgressDragging = false; });
    spotifyProgress.addEventListener("input", function () {
      var val = parseInt(spotifyProgress.value, 10);
      if (spotifyTimeCurrent) spotifyTimeCurrent.textContent = formatTime(val);
    });
    spotifyProgress.addEventListener("change", function () {
      var pos = parseInt(spotifyProgress.value, 10);
      if (!isFinite(pos) || pos < 0) return;
      fetch(API + "/spotify/seek?position_ms=" + pos, { method: "POST" })
        .then(function (r) {
          if (r.ok) setTimeout(pollNowPlaying, 200);
        })
        .catch(function () {});
    });
  }

  if (spotifyMiniProgress) {
    spotifyMiniProgress.addEventListener("mousedown", function () { window._spotifyMiniProgressDragging = true; });
    spotifyMiniProgress.addEventListener("mouseup", function () { window._spotifyMiniProgressDragging = false; });
    spotifyMiniProgress.addEventListener("mouseleave", function () { window._spotifyMiniProgressDragging = false; });
    spotifyMiniProgress.addEventListener("input", function () {
      var val = parseInt(spotifyMiniProgress.value, 10);
      if (spotifyMiniTimeCurrent) spotifyMiniTimeCurrent.textContent = formatTime(val);
    });
    spotifyMiniProgress.addEventListener("change", function () {
      var pos = parseInt(spotifyMiniProgress.value, 10);
      if (!isFinite(pos) || pos < 0) return;
      window._spotifyMiniProgressDragging = false;
      fetch(API + "/spotify/seek?position_ms=" + pos, { method: "POST" })
        .then(function (r) {
          if (r.ok) setTimeout(pollNowPlaying, 200);
        })
        .catch(function () {});
    });
  }

  function loadSpotifyQueue() {
    if (!spotifyQueueList || !spotifyQueueEmpty) return;
    fetch(API + "/spotify/queue")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        spotifyQueueList.innerHTML = "";
        var q = data.queue || [];
        if (q.length === 0) {
          spotifyQueueEmpty.classList.remove("hidden");
        } else {
          spotifyQueueEmpty.classList.add("hidden");
          q.forEach(function (t) {
            var li = document.createElement("li");
            li.className = "spotify-queue-item";
            li.innerHTML = "<div class=\"spotify-queue-item-art\">" + (t.image_url ? "<img src=\"" + t.image_url + "\" alt=\"\" />" : "") + "</div>" +
              "<div class=\"spotify-queue-item-info\"><span class=\"spotify-queue-item-title\">" + (t.title || "—") + "</span><span class=\"spotify-queue-item-artist\">" + (t.artist || "") + "</span></div>";
            spotifyQueueList.appendChild(li);
          });
        }
      })
      .catch(function () {
        spotifyQueueEmpty.classList.remove("hidden");
        spotifyQueueEmpty.textContent = "Could not load queue.";
      });
  }

  var spotifyPlaylistsLoaded = false;
  function loadSpotifyPlaylists() {
    if (!spotifyPlaylistsList || !spotifyPlaylistsLoading) return;
    spotifyPlaylistsLoading.classList.remove("hidden");
    spotifyPlaylistsList.innerHTML = "";
    fetch(API + "/spotify/playlists?limit=50")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        spotifyPlaylistsLoaded = true;
        spotifyPlaylistsLoading.classList.add("hidden");
        var items = data.items || [];
        if (items.length === 0) {
          var p = document.createElement("p");
          p.className = "spotify-empty-hint";
          p.textContent = "No playlists found.";
          spotifyPlaylistsList.appendChild(p);
        } else {
          items.forEach(function (pl) {
            var li = document.createElement("li");
            li.className = "spotify-playlist-item";
            li.dataset.uri = pl.uri || "spotify:playlist:" + pl.id;
            li.innerHTML = "<div class=\"spotify-playlist-item-img\">" + (pl.image_url ? "<img src=\"" + pl.image_url + "\" alt=\"\" />" : "") + "</div>" +
              "<div class=\"spotify-playlist-item-info\"><span class=\"spotify-playlist-item-name\">" + (pl.name || "Playlist") + "</span></div>";
            li.addEventListener("click", function () {
              var uri = this.dataset.uri;
              fetch(API + "/spotify/play-playlist?uri=" + encodeURIComponent(uri), { method: "POST" })
                .then(function (r) { if (r.ok) pollNowPlaying(); });
            });
            spotifyPlaylistsList.appendChild(li);
          });
        }
      })
      .catch(function () {
        spotifyPlaylistsLoading.classList.add("hidden");
        spotifyPlaylistsLoading.textContent = "Could not load playlists.";
      });
  }

  var spotifyPlayerEl = document.getElementById("spotify-player");
  openSpotifyModal = function () {
    if (!spotifyModal) return;
    spotifyModal.classList.remove("hidden");
    spotifyModal.setAttribute("aria-hidden", "false");
    if (appEl) appEl.classList.add("spotify-modal-open");
    fetch(API + "/spotify/now-playing")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        updateSpotifyModal(d);
        loadSpotifyQueue();
      });
  };
  if (spotifyMaximizeBtn) spotifyMaximizeBtn.addEventListener("click", openSpotifyModal);
  if (spotifyMinimizeBtn) spotifyMinimizeBtn.addEventListener("click", function () { showTab("calendar"); });
  if (spotifyMinimizeConnectBtn) spotifyMinimizeConnectBtn.addEventListener("click", function () { showTab("calendar"); });
  function closeSpotifyModal() {
    if (spotifyModal) { spotifyModal.classList.add("hidden"); spotifyModal.setAttribute("aria-hidden", "true"); }
    if (appEl) appEl.classList.remove("spotify-modal-open");
  }
  function closeSpotifyPlayer() {
    closeSpotifyModal();
    showTab("calendar");
  }
  if (spotifyModalMinimize) spotifyModalMinimize.addEventListener("click", closeSpotifyModal);
  if (spotifyModalBackdrop) spotifyModalBackdrop.addEventListener("click", closeSpotifyModal);
  var spotifyModalCloseBtn = document.getElementById("spotify-modal-close");
  if (spotifyModalCloseBtn) spotifyModalCloseBtn.addEventListener("click", closeSpotifyPlayer);

  (function () {
    var plantEl = document.getElementById("plant");
    var plantWaterBtn = document.getElementById("plant-water-btn");
    var plantAddToGardenBtn = document.getElementById("plant-add-to-garden-btn");
    var plantStageLabel = document.getElementById("plant-stage-label");
    var plantGardenCountEl = document.getElementById("plant-garden-count");
    var STORAGE_KEY = "saiborg-plant-stage";
    var LAST_WATERED_KEY = "saiborg-plant-last-watered";
    var GARDEN_KEY = "saiborg-plant-garden";
    var DAYS_TO_GROW = 30;
    var STAGE_NAMES = ["Seed", "Sprout", "Growing", "Blooming", "Full grown"];
    var VISUAL_STAGES = 5;

    function getTodayKey() {
      var d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    function getLastWateredKey() {
      try { return localStorage.getItem(LAST_WATERED_KEY) || ""; } catch (_) { return ""; }
    }
    function setLastWateredKey(key) {
      try { localStorage.setItem(LAST_WATERED_KEY, key); } catch (_) {}
    }
    function getGrowthDay() {
      try { return Math.min(DAYS_TO_GROW, Math.max(0, parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10))); } catch (_) { return 0; }
    }
    function setGrowthDay(n) {
      try { localStorage.setItem(STORAGE_KEY, String(n)); } catch (_) {}
    }
    function growthDayToVisualStage(day) {
      if (day >= DAYS_TO_GROW) return VISUAL_STAGES - 1;
      return Math.min(VISUAL_STAGES - 1, Math.floor((day / DAYS_TO_GROW) * VISUAL_STAGES));
    }
    function getGarden() {
      try {
        var raw = localStorage.getItem(GARDEN_KEY);
        if (!raw) return [];
        var arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (_) { return []; }
    }
    function addToGarden() {
      var garden = getGarden();
      garden.push({ id: Date.now(), completedAt: getTodayKey() });
      try { localStorage.setItem(GARDEN_KEY, JSON.stringify(garden)); } catch (_) {}
      setGrowthDay(0);
      setLastWateredKey("");
      updatePlantUI();
    }
    function canWaterToday() {
      return getLastWateredKey() !== getTodayKey();
    }
    function updatePlantUI() {
      var day = getGrowthDay();
      var visualStage = growthDayToVisualStage(day);
      var isFullGrown = day >= DAYS_TO_GROW;
      if (plantEl) plantEl.setAttribute("data-stage", String(visualStage));
      if (plantStageLabel) {
        if (isFullGrown) {
          plantStageLabel.textContent = "Full grown! Add to your garden.";
        } else {
          plantStageLabel.textContent = "Day " + day + " / " + DAYS_TO_GROW + " — " + STAGE_NAMES[visualStage];
        }
      }
      if (plantWaterBtn) {
        if (isFullGrown) {
          plantWaterBtn.classList.add("hidden");
          plantWaterBtn.disabled = true;
        } else {
          plantWaterBtn.classList.remove("hidden");
          if (canWaterToday()) {
            plantWaterBtn.disabled = false;
            plantWaterBtn.textContent = "💧 Water";
            plantWaterBtn.title = "Water once per day (Day " + (day + 1) + " of " + DAYS_TO_GROW + ")";
          } else {
            plantWaterBtn.disabled = true;
            plantWaterBtn.textContent = "Watered today";
            plantWaterBtn.title = "You can water again tomorrow";
          }
        }
      }
      if (plantAddToGardenBtn) {
        if (isFullGrown) {
          plantAddToGardenBtn.classList.remove("hidden");
        } else {
          plantAddToGardenBtn.classList.add("hidden");
        }
      }
      if (plantGardenCountEl) {
        var garden = getGarden();
        var n = garden.length;
        plantGardenCountEl.textContent = n > 0 ? "Your garden: " + n + " plant" + (n === 1 ? "" : "s") : "";
        plantGardenCountEl.style.display = n > 0 ? "" : "none";
      }
    }
    updatePlantUI();
    if (plantWaterBtn) plantWaterBtn.addEventListener("click", function () {
      var day = getGrowthDay();
      if (day >= DAYS_TO_GROW) return;
      if (!canWaterToday()) return;
      setLastWateredKey(getTodayKey());
      setGrowthDay(day + 1);
      updatePlantUI();
    });
    if (plantAddToGardenBtn) plantAddToGardenBtn.addEventListener("click", function () {
      if (getGrowthDay() < DAYS_TO_GROW) return;
      addToGarden();
    });
  })();

  if (spotifyModalTabs && spotifyModalTabs.length) {
    spotifyModalTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var panelId = this.dataset.spotifyPanel;
        spotifyModalTabs.forEach(function (t) { t.classList.remove("active"); });
        this.classList.add("active");
        if (spotifyPanelQueue) spotifyPanelQueue.classList.toggle("active", panelId === "queue");
        if (spotifyPanelPlaylists) spotifyPanelPlaylists.classList.toggle("active", panelId === "playlists");
        if (panelId === "queue") loadSpotifyQueue();
        if (panelId === "playlists" && !spotifyPlaylistsLoaded) loadSpotifyPlaylists();
      });
    });
  }

  if (spotifyModalPrev) spotifyModalPrev.addEventListener("click", function () { spotifyControl("previous"); });
  if (spotifyModalNext) spotifyModalNext.addEventListener("click", function () { spotifyControl("next"); });
  if (spotifyModalPlayPause) spotifyModalPlayPause.addEventListener("click", function () {
    fetch(API + "/spotify/now-playing").then(function (r) { return r.json(); }).then(function (d) {
      spotifyControl(d.playing && d.playing.is_playing ? "pause" : "play");
    }).catch(function () { spotifyControl("play"); });
  });
  if (spotifyModalShuffle) spotifyModalShuffle.addEventListener("click", function () {
    var next = !spotifyModalShuffle.classList.contains("active");
    fetch(API + "/spotify/shuffle?state=" + next, { method: "POST" })
      .then(function (r) { if (r.ok) pollNowPlaying(); });
  });
  if (spotifyModalRepeat) spotifyModalRepeat.addEventListener("click", function () {
    fetch(API + "/spotify/now-playing").then(function (r) { return r.json(); }).then(function (d) {
      var state = (d.repeat_state || "off");
      var next = state === "off" ? "context" : state === "context" ? "track" : "off";
      fetch(API + "/spotify/repeat?state=" + next, { method: "POST" })
        .then(function (r) { if (r.ok) pollNowPlaying(); });
    });
  });

  /* When modal is open, keep now-playing in sync (including progress) */
  var origPollNowPlaying = pollNowPlaying;
  pollNowPlaying = function () {
    if (nowPlayingPollTimer) clearTimeout(nowPlayingPollTimer);
    fetch(API + "/spotify/now-playing")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.connected) {
          updateNowPlayingCard(data.playing || null);
        }
        if (spotifyModal && !spotifyModal.classList.contains("hidden")) {
          updateSpotifyModal(data);
          if (!spotifyProgressDragging) {
            var track = data.playing;
            if (track && spotifyProgress && !spotifyProgressDragging) {
              var p = Number(track.progress_ms) || 0;
              var d = Number(track.duration_ms) || 0;
              if (d > 0) {
                spotifyProgress.value = Math.min(p, d);
                if (spotifyTimeCurrent) spotifyTimeCurrent.textContent = formatTime(p);
              }
            }
          }
        }
        var interval = (spotifyModal && !spotifyModal.classList.contains("hidden")) ? 1000 : 5000;
        nowPlayingPollTimer = setTimeout(pollNowPlaying, interval);
      })
      .catch(function () {
        nowPlayingPollTimer = setTimeout(pollNowPlaying, 10000);
      });
  };

  if (window.location.hash === "#spotify-connected") {
    loadSpotifyStatus();
    history.replaceState(null, "", window.location.pathname);
  } else {
    loadSpotifyStatus();
  }
})();
