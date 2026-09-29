/* ------------------------------------------------------------------ *
 * Shell: the page frame for the game.
 *
 * mountShell({
 *   id, name: 'Ludo',               // id keeps rooms apart; name is used in share text
 *   wordmark: 'LUDO',               // drawn letter by letter in the four player colours
 *   tagline, badge,                 // short line under the wordmark, and the maker badge
 *   heroHtml,                       // optional trusted markup above the wordmark (decoration)
 *   footer,                         // optional line at the bottom of the home screen
 *   rulesHtml,
 *   online: {                       // optional: room-code multiplayer
 *     minPlayers, maxPlayers,
 *     settings: [{ key, label, options: [{ value, label }], default }],
 *     init, onAction, onLeave,      // see room.js
 *     render(root, ctx),            // draw the game; called on every update
 *   },
 *   local: [{ id, label, hint, icon, tone }], // optional: modes played on this device
 *   startLocal(root, modeId, ctx),  // start a local mode; return a cleanup function
 * })
 *
 * Online ctx: { view, act(action), isHost, mySeat, rematch(), toLobby(), toast(msg) }
 * Local ctx:  { exit(), toast(msg), name }
 * ------------------------------------------------------------------ */
import { createRoom, cleanName } from './room.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#c9ccd6');
export const initial = (name) => esc((Array.from(String(name || '?').trim())[0] || '?').toUpperCase());

// Room colours drawn in this site's brighter candy palette.
const CANDY = {
  '#ffc93c': '#facc15', '#5ec8f2': '#38bdf8', '#ff7ab6': '#f472b6', '#7be495': '#4ade80',
  '#ff9a52': '#fb923c', '#b99bff': '#a78bfa', '#ff6b5e': '#f87171', '#4fd1c5': '#2dd4bf',
};
export const avatar = (p) => {
  const c = safeColor(CANDY[String(p?.color || '').toLowerCase()] || p?.color);
  return `<span class="avatar" style="--av:${c}">${initial(p?.name)}</span>`;
};

/** A word drawn letter by letter, cycling through the four player colours. */
export const wordmark = (text) => `<span class="wm" aria-hidden="true">${Array.from(String(text))
  .map((ch, i) => `<span class="wm-l wm-${i % 4}">${esc(ch)}</span>`).join('')}</span>`;

const ICON_SHARE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_HEART = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z" fill="currentColor"/></svg>';

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById('gn-toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

export function mountShell(cfg) {
  const online = cfg.online || null;
  const localModes = cfg.local || [];
  const name = cfg.name || cfg.wordmark || 'Game';
  const $ = (sel) => document.querySelector(sel);

  document.body.insertAdjacentHTML('afterbegin', `
    <header class="topbar">
      <span class="brand"><span class="sr-only">${esc(name)}</span>${wordmark(cfg.wordmark || name)}</span>
      <span class="spacer"></span>
      <span id="gn-room" class="chip" hidden>Room <b id="gn-code">----</b></span>
      <span id="gn-dot" class="dot" hidden role="status" aria-label="Connected"></span>
      <button id="gn-rules-btn" class="icon-btn" type="button" aria-label="How to play">?</button>
      <button id="gn-leave" class="icon-btn" type="button" aria-label="Leave" hidden>&#x2715;</button>
    </header>
    <div id="gn-banner" class="banner" role="status" hidden></div>
    <main class="wrap">
      <section id="gn-home" class="screen home">
        <div class="hero">
          ${cfg.heroHtml || ''}
          <h1 class="title"><span class="sr-only">${esc(name)}</span>${wordmark(cfg.wordmark || name)}</h1>
          <p class="lede">${esc(cfg.tagline)}</p>
          ${cfg.badge ? `<p class="maker">${ICON_HEART}<span>${esc(cfg.badge)}</span></p>` : ''}
        </div>
        <div class="card stack entry" id="gn-entry">
          ${online ? `
          <div>
            <label for="gn-name">Your name</label>
            <input id="gn-name" maxlength="16" autocomplete="nickname" placeholder="e.g. Sam">
          </div>
          <div class="tabs" role="tablist" aria-label="Join or host">
            <button type="button" role="tab" id="gn-tab-join" aria-selected="true">Join a game</button>
            <button type="button" role="tab" id="gn-tab-host" aria-selected="false">Host a game</button>
          </div>
          <form id="gn-join" class="stack tight">
            <label for="gn-code-in" style="margin:0">Room code</label>
            <input id="gn-code-in" class="code-input" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD">
            <button class="btn primary" type="submit">Join game</button>
          </form>
          <div id="gn-host" class="stack tight" hidden>
            <p class="hint">You'll get a 4-letter room code to share with ${online.maxPlayers === 2 ? 'your opponent' : 'friends'}.</p>
            <button id="gn-host-btn" class="btn primary" type="button">Create a room</button>
          </div>` : ''}
          ${localModes.length ? `
          ${online ? '<p class="divider"><span>or play on this device</span></p>' : ''}
          <div class="modes">
            ${localModes.map((m) => `
              <button class="mode tone-${esc(m.tone || 'blue')}" type="button" data-local="${esc(m.id)}">
                ${m.icon ? `<span class="mode-ic" aria-hidden="true">${m.icon}</span>` : ''}
                <span class="mode-txt"><b>${esc(m.label)}</b>${m.hint ? `<small>${esc(m.hint)}</small>` : ''}</span>
              </button>`).join('')}
          </div>` : ''}
          <p id="gn-error" class="error" role="alert"></p>
        </div>
        <section class="card rules">${cfg.rulesHtml}</section>
        ${cfg.footer ? `<footer class="home-foot"><p>${esc(cfg.footer)}</p></footer>` : ''}
      </section>

      <section id="gn-lobby" class="screen lobby" hidden>
        <div class="card code-card">
          <p class="kicker">Room code</p>
          <div id="gn-lobby-code" class="code-tiles" aria-live="polite"><span>-</span><span>-</span><span>-</span><span>-</span></div>
          <p class="hint small">Friends can type this code on their device, or open your invite link.</p>
          <button id="gn-share" class="btn ghost" type="button">${ICON_SHARE}Share invite link</button>
          <p id="gn-share-url" class="share-url"></p>
        </div>
        <div class="card">
          <h2 class="h">Players <span id="gn-count" class="pill"></span></h2>
          <ul id="gn-players" class="players"></ul>
          <p id="gn-seat-note" class="hint small" style="margin-top:12px"></p>
        </div>
        <div id="gn-host-panel" class="card" hidden>
          <div id="gn-settings"></div>
          <button id="gn-start" class="btn primary big" type="button">Start game</button>
          <p id="gn-start-hint" class="hint center" style="margin-top:12px"></p>
        </div>
        <div id="gn-guest-wait" class="card waiting" hidden>
          <div class="pulse" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <p>Waiting for <b id="gn-host-name">the host</b> to start&hellip;</p>
          <p id="gn-guest-settings" class="hint small"></p>
        </div>
      </section>

      <section id="gn-play" class="screen" hidden><div id="gn-game"></div></section>

      <section id="gn-msg" class="screen" hidden>
        <div class="card center stack msg-card">
          <h2 id="gn-msg-title"></h2>
          <p id="gn-msg-body"></p>
          <button id="gn-msg-home" class="btn primary" type="button">Back</button>
        </div>
      </section>
    </main>
    <div id="gn-busy" class="busy" hidden>
      <div class="busy-card">
        <div class="spinner" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <p id="gn-busy-text">Connecting&hellip;</p>
        <button id="gn-busy-cancel" class="btn ghost small" type="button" hidden>Cancel</button>
      </div>
    </div>
    <div id="gn-toast" class="toast" role="status" hidden></div>
    <dialog id="gn-rules" aria-label="How to play">
      <div class="rules">${cfg.rulesHtml}</div>
      <form method="dialog"><button class="btn primary" type="submit">Got it</button></form>
    </dialog>`);

  let curScreen = null;
  let localCleanup = null;
  let lastRenderKey = '';

  function show(id) {
    for (const s of document.querySelectorAll('main > .screen')) s.hidden = s.id !== id;
    $('main').dataset.screen = id;
    if (id !== curScreen) { curScreen = id; window.scrollTo(0, 0); }
  }
  const showBusy = (text, cancellable = false) => {
    $('#gn-busy-text').textContent = text;
    $('#gn-busy-cancel').hidden = !cancellable;
    $('#gn-busy').hidden = false;
  };
  const hideBusy = () => { $('#gn-busy').hidden = true; };
  const showError = (msg) => { const e = $('#gn-error'); if (e) e.textContent = msg; };
  const setBanner = (msg) => {
    const el = $('#gn-banner');
    el.hidden = !msg;
    if (msg && el.textContent !== msg) el.textContent = msg;
  };
  function showMsg(title, body) {
    $('#gn-msg-title').textContent = title;
    $('#gn-msg-body').textContent = body;
    setOnlineChrome(false);
    show('gn-msg');
  }
  function setOnlineChrome(on) {
    $('#gn-room').hidden = !on;
    $('#gn-dot').hidden = !on;
    $('#gn-leave').hidden = !on && !localCleanup;
    if (!on) setBanner(null);
  }
  function goHome() {
    if (localCleanup) { try { localCleanup(); } catch (err) { console.warn(err); } localCleanup = null; }
    $('#gn-game').innerHTML = '';
    setOnlineChrome(false);
    show('gn-home');
  }

  $('#gn-rules-btn').addEventListener('click', () => $('#gn-rules').showModal());
  $('#gn-msg-home').addEventListener('click', goHome);

  /* ---------------- local modes ---------------- */
  for (const b of document.querySelectorAll('[data-local]')) {
    b.addEventListener('click', () => {
      showError('');
      const root = $('#gn-game');
      root.innerHTML = '';
      show('gn-play');
      const playerName = online ? cleanName($('#gn-name').value) : '';
      localCleanup = cfg.startLocal(root, b.dataset.local, {
        exit: goHome,
        toast,
        name: playerName,
      }) || (() => {});
      $('#gn-leave').hidden = false;
    });
  }

  if (!online) {
    $('#gn-leave').addEventListener('click', goHome);
    show('gn-home');
    return { toast };
  }

  /* ---------------- online ---------------- */
  const settingsDefaults = Object.fromEntries((online.settings || []).map((s) => [s.key, s.default]));
  const room = createRoom({
    game: cfg.id,
    minPlayers: online.minPlayers,
    maxPlayers: online.maxPlayers,
    init: online.init,
    onAction: online.onAction,
    onLeave: online.onLeave,
    onUpdate: (view) => render(view),
    onError: (msg) => toast(msg),
  });

  const readName = () => {
    const n = cleanName($('#gn-name').value);
    if (!n) { showError('Enter your name first.'); $('#gn-name').focus(); return null; }
    return n;
  };
  const selectTab = (which) => {
    const join = which === 'join';
    $('#gn-tab-join').setAttribute('aria-selected', String(join));
    $('#gn-tab-host').setAttribute('aria-selected', String(!join));
    $('#gn-join').hidden = !join;
    $('#gn-host').hidden = join;
    showError('');
  };
  $('#gn-tab-join').addEventListener('click', () => selectTab('join'));
  $('#gn-tab-host').addEventListener('click', () => selectTab('host'));
  $('#gn-code-in').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  $('#gn-name').value = room.savedName();

  $('#gn-join').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const playerName = readName();
    if (!playerName) return;
    const code = $('#gn-code-in').value.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) { showError('Room codes are 4 letters, like ABCD.'); return; }
    const params = new URLSearchParams(location.search);
    const hintRaw = (params.get('room') || '').toUpperCase() === code ? params.get('b') : null;
    showBusy(`Looking for room ${code}…`, true);
    try {
      await room.join(code, playerName, hintRaw === null ? null : Number(hintRaw));
    } catch (err) {
      hideBusy();
      if (err.message !== 'cancelled') showError(err.message);
    }
  });

  $('#gn-host-btn').addEventListener('click', async () => {
    showError('');
    const playerName = readName();
    if (!playerName) return;
    showBusy('Creating your room…');
    try {
      await room.host(playerName, settingsDefaults);
      hideBusy();
    } catch (err) {
      hideBusy();
      showError(err.message);
    }
  });

  $('#gn-busy-cancel').addEventListener('click', () => {
    room.cancelJoin();
    hideBusy();
    goHome();
  });

  $('#gn-leave').addEventListener('click', () => {
    if (localCleanup) { goHome(); return; }
    if (room.role === 'host' && !confirm('Leave and close this room for everyone?')) return;
    if (room.role === 'player' && !confirm('Leave this game?')) return;
    room.leave();
    goHome();
  });

  $('#gn-share').addEventListener('click', async () => {
    const url = room.inviteUrl();
    if (navigator.share) {
      try { await navigator.share({ title: name, text: `Join my ${name} game! Room code ${room.view?.code}`, url }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); toast('Invite link copied'); } catch { toast('Copy the link shown below'); }
  });

  $('#gn-start').addEventListener('click', () => {
    const err = room.start();
    if (err) toast(err);
  });

  $('#gn-settings').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-key]');
    if (!b) return;
    const setting = online.settings.find((s) => s.key === b.dataset.key);
    const opt = setting && setting.options.find((o) => String(o.value) === b.dataset.value);
    if (opt) room.setSettings({ [setting.key]: opt.value });
  });

  const ctx = {
    get view() { return room.view; },
    act: (action) => room.act(action),
    get isHost() { return room.view?.me.isHost; },
    get mySeat() { return room.view?.me.seat; },
    rematch: () => { room.backToLobby(); const err = room.start(); if (err) toast(err); },
    toLobby: () => room.backToLobby(),
    toast,
  };

  function render(v) {
    if (!v) return;
    if (localCleanup) return;
    $('#gn-code').textContent = v.code;
    const dot = $('#gn-dot');
    dot.classList.toggle('warn', v.connection === 'warn');
    dot.classList.toggle('bad', v.connection === 'bad');
    setBanner(v.hostSilent ? "Can't reach the host right now. Waiting for them to reconnect…" : null);

    if (v.phase === 'closed') {
      if (!v.me.isHost) { room.leave(); showMsg('Room closed', 'The host closed this room. Thanks for playing!'); }
      return;
    }
    if (v.me.rejected) { room.leave(); showMsg('Room is full', `Room ${v.code} is full. Ask the host to start a new room.`); return; }
    setOnlineChrome(true);
    if (!v.me.joined) {
      showBusy(v.hostSilent ? `Room ${v.code} isn't answering. The host may have left, or their phone may be asleep.` : `Joining room ${v.code}…`, true);
      return;
    }
    hideBusy();

    if (v.phase === 'lobby') { lastRenderKey = ''; renderLobby(v); return; }
    show('gn-play');
    const key = JSON.stringify([v.seq > 0 ? v.game : null, v.players, v.me, v.waiting]);
    if (key === lastRenderKey) return;
    lastRenderKey = key;
    online.render($('#gn-game'), ctx);
  }

  function renderLobby(v) {
    show('gn-lobby');
    const codeEl = $('#gn-lobby-code');
    if (codeEl.textContent !== v.code) codeEl.innerHTML = Array.from(String(v.code)).map((ch) => `<span>${esc(ch)}</span>`).join('');
    $('#gn-share-url').textContent = room.inviteUrl();
    const present = v.players.filter((p) => !p.left);
    $('#gn-count').textContent = `${present.length}`;
    const items = present.map((p, i) => `
      <li>
        ${avatar(p)}
        <span class="name">${esc(p.name)}</span>
        ${p.id === v.host ? '<span class="tag host">Host</span>' : ''}
        ${p.id === v.me.id ? '<span class="tag you">You</span>' : ''}
        ${p.away ? '<span class="tag away">Away</span>' : ''}
        ${i >= online.maxPlayers ? '<span class="tag">Watching</span>' : ''}
      </li>`);
    if (present.length < online.minPlayers) items.push('<li class="empty">Waiting for players to join…</li>');
    $('#gn-players').innerHTML = items.join('');
    $('#gn-seat-note').textContent = online.maxPlayers === online.minPlayers
      ? `${online.maxPlayers} players. Anyone else who joins can watch.`
      : `${online.minPlayers} to ${online.maxPlayers} players. Anyone else who joins can watch.`;

    const isHost = v.me.isHost;
    $('#gn-host-panel').hidden = !isHost;
    $('#gn-guest-wait').hidden = isHost;
    const summary = (online.settings || []).map((s) => {
      const opt = s.options.find((o) => o.value === v.settings?.[s.key]);
      return opt ? `${s.label}: ${opt.label}` : '';
    }).filter(Boolean).join(' · ');
    if (isHost) {
      $('#gn-settings').innerHTML = (online.settings || []).map((s) => `
        <p class="label">${esc(s.label)}</p>
        <div class="seg" role="radiogroup" aria-label="${esc(s.label)}">
          ${s.options.map((o) => `<button type="button" role="radio" data-key="${esc(s.key)}" data-value="${esc(o.value)}" aria-checked="${v.settings?.[s.key] === o.value}">${esc(o.label)}</button>`).join('')}
        </div>`).join('');
      const ready = present.filter((p) => !p.away || p.id === v.host).length;
      $('#gn-start').disabled = ready < online.minPlayers;
      $('#gn-start-hint').textContent = ready < online.minPlayers
        ? `Share the room code. You need at least ${online.minPlayers} players.`
        : `${Math.min(ready, online.maxPlayers)} player${Math.min(ready, online.maxPlayers) === 1 ? '' : 's'} ready.`;
    } else {
      const host = v.players.find((p) => p.id === v.host);
      $('#gn-host-name').textContent = host ? host.name : 'the host';
      $('#gn-guest-settings').textContent = summary;
    }
  }

  // Start: resume a room after a refresh, or pre-fill an invite link.
  const params = new URLSearchParams(location.search);
  const urlRoom = (params.get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  show('gn-home');
  const resumed = room.resume(() => showBusy('Still reconnecting… Check your internet connection.', true));
  if (resumed) {
    showBusy('Reconnecting to your room…', true);
    resumed.then((ok) => { if (!ok) { hideBusy(); goHome(); } }).catch((err) => { hideBusy(); goHome(); if (err.message !== 'cancelled') showError(err.message); });
  } else if (urlRoom.length === 4) {
    selectTab('join');
    $('#gn-code-in').value = urlRoom;
    if (!$('#gn-name').value) $('#gn-name').focus();
  }

  // Read-only hooks for automated browser tests.
  window.__gn = { view: () => room.view, role: () => room.role };
  return { room, toast };
}
