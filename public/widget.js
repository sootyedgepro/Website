(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────
  var cfg = window.LQConfig || {};
  var API_BASE = cfg.apiBase || "http://localhost:3000/api";
  var BRAND_NAME = cfg.brandName || "TradePro Elite";

  // ── State ─────────────────────────────────────────────────────────────────
  var sessionId = null;
  var isOpen = false;
  var isWaiting = false;
  var qualificationDone = false;

  // ── DOM Helpers ───────────────────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }

  function createEl(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────
  function buildWidget() {
    // Launcher
    var launcher = createEl("button", { id: "lq-launcher", "aria-label": "Open chat" },
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    );

    // Widget container
    var widget = createEl("div", { id: "lq-widget", role: "dialog", "aria-label": "Chat with " + BRAND_NAME });

    // Header
    var header = createEl("div", { id: "lq-header" });
    header.innerHTML =
      '<div id="lq-avatar">⚡</div>' +
      '<div id="lq-header-text">' +
        '<div id="lq-header-name">' + escHtml(BRAND_NAME) + '</div>' +
        '<div id="lq-header-status">Online now</div>' +
      '</div>' +
      '<button id="lq-close" aria-label="Close chat">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>';

    // Messages
    var messages = createEl("div", { id: "lq-messages", role: "log", "aria-live": "polite" });

    // Typing indicator
    var typing = createEl("div", { id: "lq-typing", class: "lq-msg lq-bot" });
    typing.innerHTML =
      '<div class="lq-typing-bubble">' +
        '<span class="lq-dot"></span><span class="lq-dot"></span><span class="lq-dot"></span>' +
      '</div>';

    // Input area
    var inputArea = createEl("div", { id: "lq-input-area" });
    inputArea.innerHTML =
      '<textarea id="lq-input" placeholder="Type a message..." rows="1" maxlength="2000" aria-label="Chat message"></textarea>' +
      '<button id="lq-send" aria-label="Send message">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
      '</button>';

    // Footer
    var footer = createEl("div", { id: "lq-footer" }, "Powered by AI · Your info is secure");

    messages.appendChild(typing);
    widget.appendChild(header);
    widget.appendChild(messages);
    widget.appendChild(inputArea);
    widget.appendChild(footer);

    document.body.appendChild(launcher);
    document.body.appendChild(widget);
  }

  // ── Render a chat bubble ──────────────────────────────────────────────────
  function appendMessage(role, text) {
    var messages = el("lq-messages");
    var typing = el("lq-typing");

    var msgDiv = createEl("div", { class: "lq-msg lq-" + role });
    var bubble = createEl("div", { class: "lq-bubble" });

    // Linkify URLs
    bubble.innerHTML = linkify(escHtml(text));

    msgDiv.appendChild(bubble);
    messages.insertBefore(msgDiv, typing);
    scrollBottom();
  }

  function scrollBottom() {
    var m = el("lq-messages");
    m.scrollTop = m.scrollHeight;
  }

  // ── Typing indicator ──────────────────────────────────────────────────────
  function showTyping() {
    el("lq-typing").classList.add("lq-visible");
    scrollBottom();
  }
  function hideTyping() {
    el("lq-typing").classList.remove("lq-visible");
  }

  // ── API Calls ─────────────────────────────────────────────────────────────
  function apiPost(endpoint, body) {
    return fetch(API_BASE + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || "Request failed"); });
      return r.json();
    });
  }

  function startSession() {
    showTyping();
    apiPost("/chat/start", {})
      .then(function (data) {
        sessionId = data.sessionId;
        hideTyping();
        appendMessage("bot", data.message);
        setInputEnabled(true);
      })
      .catch(function (err) {
        hideTyping();
        appendMessage("bot", "Hey! Having a tiny hiccup — refresh the page and I'll be right here.");
        console.error("[LQ Widget]", err);
      });
  }

  function sendMessage(text) {
    if (isWaiting || !text.trim()) return;

    appendMessage("user", text);
    clearInput();
    setInputEnabled(false);
    showTyping();

    apiPost("/chat", { message: text, sessionId: sessionId })
      .then(function (data) {
        sessionId = data.sessionId;
        hideTyping();
        appendMessage("bot", data.message);

        if (data.qualificationComplete && !qualificationDone) {
          qualificationDone = true;
        }

        setInputEnabled(!qualificationDone);
        if (qualificationDone) {
          el("lq-input").placeholder = "Conversation complete ✓";
        }
      })
      .catch(function (err) {
        hideTyping();
        appendMessage("bot", "Oops, lost connection for a sec. Mind sending that again?");
        setInputEnabled(true);
        console.error("[LQ Widget]", err);
      });
  }

  // ── Input helpers ─────────────────────────────────────────────────────────
  function setInputEnabled(enabled) {
    isWaiting = !enabled;
    el("lq-input").disabled = !enabled;
    el("lq-send").disabled = !enabled;
  }

  function clearInput() {
    var inp = el("lq-input");
    inp.value = "";
    inp.style.height = "auto";
  }

  function getInputValue() {
    return el("lq-input").value.trim();
  }

  // ── Toggle open/close ─────────────────────────────────────────────────────
  function openWidget() {
    if (isOpen) return;
    isOpen = true;
    var w = el("lq-widget");
    w.style.display = "flex";
    requestAnimationFrame(function () { w.classList.add("lq-open"); });
    el("lq-launcher").classList.remove("has-notification");

    if (!sessionId) {
      setInputEnabled(false);
      startSession();
    }
    setTimeout(function () { el("lq-input").focus(); }, 300);
  }

  function closeWidget() {
    if (!isOpen) return;
    isOpen = false;
    var w = el("lq-widget");
    w.classList.remove("lq-open");
    setTimeout(function () { if (!isOpen) w.style.display = "none"; }, 250);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function linkify(text) {
    // Turn https://... URLs into clickable links
    return text.replace(
      /(https?:\/\/[^\s<"]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  }

  // ── Auto-grow textarea ────────────────────────────────────────────────────
  function autoGrow(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + "px";
  }

  // ── Event Wiring ──────────────────────────────────────────────────────────
  function wireEvents() {
    el("lq-launcher").addEventListener("click", openWidget);
    el("lq-close").addEventListener("click", closeWidget);
    el("lq-send").addEventListener("click", function () { sendMessage(getInputValue()); });

    el("lq-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(getInputValue());
      }
    });

    el("lq-input").addEventListener("input", function () { autoGrow(this); });

    // Close on backdrop click (mobile)
    document.addEventListener("click", function (e) {
      if (isOpen && !el("lq-widget").contains(e.target) && e.target !== el("lq-launcher")) {
        closeWidget();
      }
    });

    // ESC key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen) closeWidget();
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    buildWidget();
    wireEvents();

    // Pulse the launcher after 5s to draw attention
    setTimeout(function () {
      if (!isOpen) el("lq-launcher").classList.add("has-notification");
    }, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
