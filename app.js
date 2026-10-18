/* Banco de Horas — interface. Todos os dados ficam no aparelho (localStorage). */
(function () {
  'use strict';

  var L = window.Logic;
  var APP_VERSION = '1.1.0';
  var KEY = 'bancoDeHoras.v1';
  var KEY_LAST_JOB = 'bancoDeHoras.lastJob';
  var KEY_IOS_HINT = 'bancoDeHoras.iosHintDismissed';

  /* =============== DOM helpers =============== */

  function $(id) { return document.getElementById(id); }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function append(el, kids) {
    kids.forEach(function (c) {
      if (Array.isArray(c)) append(el, c);
      else if (c == null || c === false) return;
      else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    });
  }
  function h(tag, props) {
    var el = document.createElement(tag), value;
    var kids = Array.prototype.slice.call(arguments, 2);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'value') value = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    append(el, kids);
    if (value !== undefined) el.value = value;
    return el;
  }
  var ICONS = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    house: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    sliders: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>'
  };
  function icon(name) {
    var s = document.createElement('span');
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
    return s.firstChild;
  }
  function field(label, hintSmall) {
    var kids = Array.prototype.slice.call(arguments, 2);
    return h('div', { class: 'field' },
      h('span', { class: 'label' }, label, hintSmall ? h('small', null, ' ' + hintSmall) : null), kids);
  }

  /* =============== Estado e armazenamento =============== */

  var loadProblem = null;
  function loadState() {
    var raw = null;
    try {
      raw = localStorage.getItem(KEY);
      if (!raw) return L.defaultState();
      return L.normalizeState(JSON.parse(raw)).state;
    } catch (e) {
      loadProblem = true;
      try { if (raw) localStorage.setItem(KEY + '.corrompido', raw); } catch (e2) { /* sem espaço */ }
      return L.defaultState();
    }
  }
  var state = loadState();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) {
      toast('Não foi possível salvar neste aparelho. Faça um backup agora.');
      return false;
    }
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignora */ } }

  var now0 = new Date();
  var ui = {
    tab: 'home',
    jobId: lsGet(KEY_LAST_JOB),
    date: L.todayISO(),
    dateTouched: false,
    todayStamp: L.todayISO(),
    hist: { year: now0.getFullYear(), month: now0.getMonth(), jobId: null },
    rep: (function () { var r = L.monthRange(now0.getFullYear(), now0.getMonth()); return { start: r.start, end: r.end }; })()
  };

  function jobExists(id) { return !!id && state.jobs.some(function (j) { return j.id === id; }); }
  function jobName(id) {
    for (var i = 0; i < state.jobs.length; i++) if (state.jobs[i].id === id) return state.jobs[i].name;
    return 'Emprego removido';
  }
  function monthReport(year, month) {
    var r = L.monthRange(year, month);
    return L.buildReport(state, r.start, r.end);
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* =============== Aviso rápido, janelas =============== */

  var toastTimer = null;
  function toast(msg, actionLabel, actionFn) {
    var el = $('toast');
    clear(el);
    el.appendChild(h('span', null, msg));
    if (actionLabel) {
      el.appendChild(h('button', { class: 'toast-action', type: 'button', onclick: function () {
        el.classList.remove('show'); clearTimeout(toastTimer); actionFn();
      } }, actionLabel));
    }
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, actionLabel ? 7000 : 3600);
  }

  var openLayers = [];
  function openSheet(title, build, onClose) {
    var layer = h('div', { class: 'layer' });
    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      openLayers = openLayers.filter(function (l) { return l !== api; });
      layer.classList.remove('open');
      setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 220);
      if (!openLayers.length) document.body.classList.remove('noscroll');
      if (onClose) onClose();
    }
    var api = { close: close, el: layer };
    var body = h('div', { class: 'sheet-body' });
    var sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'sheet-head' },
        h('h2', null, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Fechar', onclick: close }, '×')),
      body);
    layer.appendChild(h('div', { class: 'backdrop', onclick: close }));
    layer.appendChild(sheet);
    $('sheet-root').appendChild(layer);
    document.body.classList.add('noscroll');
    openLayers.push(api);
    build(body, close);
    requestAnimationFrame(function () { requestAnimationFrame(function () { layer.classList.add('open'); }); });
    return api;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openLayers.length) openLayers[openLayers.length - 1].close();
  });

  function confirmSheet(opts, onYes) {
    openSheet(opts.title, function (body, close) {
      body.appendChild(h('p', { class: 'confirm-msg' }, opts.message));
      body.appendChild(h('div', { class: 'btn-row' },
        h('button', { class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'), type: 'button', onclick: function () { close(); onYes(); } }, opts.confirmLabel),
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: close }, 'Cancelar')));
    });
  }

  /* =============== Componentes: emprego, duração, observação =============== */

  function jobPicker(getId, setId) {
    var el = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Emprego' });
    function paint() {
      clear(el);
      if (!state.jobs.length) {
        el.appendChild(h('button', { class: 'btn btn-secondary', type: 'button', onclick: function () { go('jobs'); openJobSheet(); } }, 'Cadastrar o primeiro emprego'));
        return;
      }
      state.jobs.forEach(function (j) {
        var on = getId() === j.id;
        el.appendChild(h('button', {
          type: 'button', class: 'chip chip-lg' + (on ? ' on' : ''), role: 'radio', 'aria-checked': String(on),
          onclick: function () { setId(j.id); paint(); }
        }, j.name));
      });
    }
    paint();
    return { el: el, paint: paint };
  }

  function quickLabel(q) {
    var hh = Math.floor(q / 60), mm = q % 60;
    if (!hh) return mm + ' min';
    return mm ? hh + 'h' + mm : hh + 'h';
  }
  var QUICK = [90, 105, 180, 480, 660]; // 1h30, 1h45, 3h, 8h, 11h

  function durationPicker(initial, onChange) {
    var minutes = 0;
    var readout = h('div', { class: 'readout', role: 'img' });
    var hourSel = h('select', { class: 'select', 'aria-label': 'Horas' });
    var minSel = h('select', { class: 'select', 'aria-label': 'Minutos' });
    var i;
    for (i = 0; i <= 16; i++) hourSel.appendChild(h('option', { value: String(i) }, i + (i === 1 ? ' hora' : ' horas')));
    for (i = 0; i < 60; i += 5) minSel.appendChild(h('option', { value: String(i) }, L.pad2(i) + ' min'));

    var chips = QUICK.map(function (q) {
      return h('button', { type: 'button', class: 'chip chip-sm', 'data-m': String(q), onclick: function () { set(q, true); } }, quickLabel(q));
    });

    function ensure(sel, val, label) {
      if (sel.querySelector('option[value="' + val + '"]')) return;
      var opts = Array.prototype.slice.call(sel.options);
      opts.push(h('option', { value: String(val) }, label));
      opts.sort(function (a, b) { return +a.value - +b.value; });
      opts.forEach(function (o) { sel.appendChild(o); });
    }
    function set(m, notify) {
      m = Math.max(0, Math.min(L.MAX_ENTRY_MINUTES, Math.round(m) || 0));
      minutes = m;
      var hh = Math.floor(m / 60), mm = m % 60;
      ensure(hourSel, hh, hh + ' h'); ensure(minSel, mm, L.pad2(mm) + ' min');
      hourSel.value = String(hh); minSel.value = String(mm);
      clear(readout);
      readout.appendChild(h('span', null, String(hh)));
      readout.appendChild(h('span', { class: 'u' }, 'h'));
      readout.appendChild(h('span', null, L.pad2(mm)));
      readout.setAttribute('aria-label', hh + ' horas e ' + mm + ' minutos');
      readout.classList.toggle('empty', m === 0);
      chips.forEach(function (c) { c.classList.toggle('on', +c.getAttribute('data-m') === m); });
      if (notify && onChange) onChange(m);
    }
    function fromSelects() { set(+hourSel.value * 60 + +minSel.value, true); }
    hourSel.addEventListener('change', fromSelects);
    minSel.addEventListener('change', fromSelects);

    var el = h('div', null,
      h('div', { class: 'panel' }, readout, h('div', { class: 'panel-cap' }, 'duração do serviço')),
      h('div', { class: 'chips quick' }, chips),
      h('div', { class: 'row2' }, hourSel, minSel));
    set(initial || 0, false);
    return { el: el, get: function () { return minutes; }, set: function (m) { set(m, false); } };
  }

  function noteField() {
    var input = h('input', {
      type: 'text', class: 'input', maxlength: '120', autocomplete: 'off', enterkeyhint: 'done',
      placeholder: 'Ex.: feriado, lavanderia…', 'aria-label': 'Observação do dia'
    });
    var chips = h('div', { class: 'chips', style: 'margin-top:10px' });
    var listeners = [];
    function parts() { return input.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
    function paint() {
      clear(chips);
      var cur = parts().map(function (p) { return p.toLowerCase(); });
      state.settings.templates.forEach(function (t) {
        var on = cur.indexOf(t.toLowerCase()) >= 0;
        chips.appendChild(h('button', {
          type: 'button', class: 'chip chip-sm' + (on ? ' on' : ''), 'aria-pressed': String(on),
          onclick: function () { toggle(t); }
        }, t));
      });
    }
    function toggle(t) {
      var p = parts(), idx = -1;
      p.forEach(function (x, i) { if (x.toLowerCase() === t.toLowerCase()) idx = i; });
      if (idx >= 0) p.splice(idx, 1); else p.push(t);
      input.value = p.join(', ');
      paint(); fire();
    }
    function fire() { listeners.forEach(function (fn) { fn(input.value); }); }
    input.addEventListener('input', function () { paint(); fire(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
    paint();
    return {
      el: h('div', null, input, chips),
      get: function () { return input.value.trim(); },
      set: function (v) { input.value = v || ''; paint(); fire(); },
      onInput: function (fn) { listeners.push(fn); },
      paint: paint
    };
  }

  /* =============== Navegação =============== */

  var TABS = [
    { id: 'home', label: 'Lançar', icon: 'clock' },
    { id: 'history', label: 'Histórico', icon: 'calendar' },
    { id: 'jobs', label: 'Empregos', icon: 'house' },
    { id: 'report', label: 'Relatório', icon: 'doc' },
    { id: 'settings', label: 'Ajustes', icon: 'sliders' }
  ];
  var views = {};

  function buildShell() {
    var app = $('app');
    TABS.forEach(function (t) {
      var sec = h('section', { id: 'view-' + t.id, hidden: true, 'aria-label': t.label });
      views[t.id] = sec;
      app.appendChild(sec);
    });
    var tabs = h('div', { class: 'tabs', role: 'tablist' });
    TABS.forEach(function (t) {
      tabs.appendChild(h('button', { class: 'tab', type: 'button', 'data-tab': t.id, onclick: function () { go(t.id); } }, icon(t.icon), t.label));
    });
    $('tabbar').appendChild(tabs);
  }

  function go(id) {
    ui.tab = id;
    TABS.forEach(function (t) {
      views[t.id].hidden = t.id !== id;
      var btn = document.querySelector('.tab[data-tab="' + t.id + '"]');
      if (t.id === id) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    });
    if (id === 'home') home.syncDay();
    refreshAll();
    window.scrollTo(0, 0);
  }

  function pageHead(title, sub) {
    return h('header', { class: 'page-head' }, h('h1', null, title), sub ? h('p', null, sub) : null);
  }

  /* =============== Aba: Lançar =============== */

  var home = {};

  function buildHome() {
    var root = views.home;
    home.banners = h('div');
    home.hero = h('section', { class: 'card hero' });
    home.recent = h('div', { class: 'list' });

    home.jobPicker = jobPicker(function () { return ui.jobId; }, function (id) { ui.jobId = id; lsSet(KEY_LAST_JOB, id); });
    home.dayHint = h('p', { class: 'hint' });
    home.date = h('input', { type: 'date', class: 'input', value: ui.date, 'aria-label': 'Data' });
    home.date.addEventListener('change', function () {
      if (!L.isValidISO(home.date.value)) { home.date.value = ui.date; return; }
      ui.date = home.date.value; ui.dateTouched = true; home.syncDay();
    });
    home.dur = durationPicker(0);
    home.note = noteField();
    home.noteOnly = h('button', { class: 'btn btn-secondary', type: 'button', disabled: true, onclick: saveNoteOnly }, 'Salvar só a observação');
    home.note.onInput(function (v) { home.noteOnly.disabled = !v.trim(); });
    home.saveBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: saveEntry }, 'Salvar horas');

    root.appendChild(pageHead('Lançar horas', 'Registre o que você trabalhou hoje ou em outro dia.'));
    root.appendChild(home.banners);
    root.appendChild(home.hero);
    root.appendChild(h('section', { class: 'card' },
      h('h2', null, 'Novo lançamento'),
      field('Emprego', '', home.jobPicker.el),
      field('Data', '', home.date, home.dayHint),
      field('Duração', '', home.dur.el),
      field('Observação do dia', '(opcional)', home.note.el),
      h('div', { class: 'btn-row' }, home.saveBtn, home.noteOnly)));
    root.appendChild(h('section', { class: 'card' }, h('h2', null, 'Últimos lançamentos'), home.recent));

    home.syncDay = function () {
      home.date.value = ui.date;
      home.note.set(state.notes[ui.date] || '');
      home.updateHint();
    };
    home.updateHint = function () {
      var mins = L.minutesOnDay(state, ui.date);
      var txt = mins ? 'Neste dia já há ' + L.formatMinutes(mins) + ' lançadas.' : 'Ainda não há horas lançadas neste dia.';
      home.dayHint.textContent = L.weekdayName(ui.date) + ' · ' + txt;
    };
  }

  var saving = false;
  function guardDouble() {
    if (saving) return true;
    saving = true; setTimeout(function () { saving = false; }, 600);
    return false;
  }

  function saveEntry() {
    if (guardDouble()) return;
    var date = ui.date, mins = home.dur.get();
    if (!jobExists(ui.jobId)) { toast('Escolha o emprego antes de salvar.'); return; }
    if (!L.isValidISO(date)) { toast('Escolha a data.'); return; }
    if (mins <= 0) { toast('Escolha a duração do serviço.'); return; }

    var entry = { id: L.newId(), jobId: ui.jobId, date: date, minutes: mins };
    state.entries.push(entry);
    var txt = home.note.get(), prevNote = state.notes[date], noteChanged = false;
    if (txt && txt !== prevNote) { state.notes[date] = txt; noteChanged = true; }
    save();
    home.dur.set(0);
    refreshAll();
    toast(L.formatMinutes(mins) + ' salvas em ' + jobName(entry.jobId) + ' (' + L.formatDateShort(date) + ').', 'Desfazer', function () {
      state.entries = state.entries.filter(function (e) { return e.id !== entry.id; });
      if (noteChanged) { if (prevNote) state.notes[date] = prevNote; else delete state.notes[date]; }
      save(); refreshAll(); home.syncDay();
    });
  }

  function saveNoteOnly() {
    if (guardDouble()) return;
    var txt = home.note.get(), date = ui.date;
    if (!txt) { toast('Escreva ou escolha uma observação.'); return; }
    if (!L.isValidISO(date)) { toast('Escolha a data.'); return; }
    var prev = state.notes[date];
    state.notes[date] = txt;
    save(); refreshAll();
    toast('Observação salva em ' + L.formatDateShort(date) + '.', 'Desfazer', function () {
      if (prev) state.notes[date] = prev; else delete state.notes[date];
      save(); refreshAll(); home.syncDay();
    });
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isStandalone() {
    return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function needsBackup() {
    if (!state.entries.length) return false;
    var lb = state.settings.lastBackup;
    if (!lb || !L.isValidISO(lb)) return true;
    var days = Math.round((L.parseISO(L.todayISO()) - L.parseISO(lb)) / 86400000);
    return days >= 30;
  }

  function refreshHome() {
    if (!jobExists(ui.jobId)) ui.jobId = state.jobs.length === 1 ? state.jobs[0].id : null;
    home.jobPicker.paint();
    home.note.paint();
    home.updateHint();

    clear(home.banners);
    if (isIOS() && !isStandalone() && !lsGet(KEY_IOS_HINT)) {
      home.banners.appendChild(h('div', { class: 'banner' },
        h('strong', null, 'Instale o app no iPhone'),
        'Toque em Compartilhar (o quadrado com a seta) e depois em Adicionar à Tela de Início. Use sempre o ícone instalado: os dados do Safari e os do app instalado são separados. ',
        h('button', { class: 'link-btn', type: 'button', onclick: function () { lsSet(KEY_IOS_HINT, '1'); refreshHome(); } }, 'Entendi')));
    }
    if (needsBackup()) {
      home.banners.appendChild(h('div', { class: 'banner' },
        h('strong', null, 'Faça um backup dos seus dados'),
        'Se o celular for trocado ou o app for apagado, as horas somem. ',
        h('button', { class: 'link-btn', type: 'button', onclick: function () { go('settings'); } }, 'Fazer backup agora')));
    }

    var now = new Date(), rep = monthReport(now.getFullYear(), now.getMonth());
    clear(home.hero);
    home.hero.appendChild(h('div', { class: 'hero-top' },
      h('span', null, L.monthName(now.getMonth()) + ' de ' + now.getFullYear()),
      h('span', null, rep.workedDays === 1 ? '1 dia trabalhado' : rep.workedDays + ' dias trabalhados')));
    home.hero.appendChild(h('div', { class: 'hero-main' },
      h('div', { class: 'hero-hours' }, L.formatMinutes(rep.totalMinutes)),
      h('div', { class: 'hero-money' }, L.formatMoneyCents(L.amountCents(rep.totalMinutes, state.settings.rateCents)))));
    home.hero.appendChild(h('div', { class: 'hero-sub' }, 'horas no mês e valor a receber'));

    clear(home.recent);
    var last = state.entries.slice(-5).reverse();
    if (!last.length) {
      home.recent.appendChild(h('div', { class: 'empty-state' }, h('strong', null, 'Nenhum lançamento ainda'), 'Os últimos que você salvar aparecem aqui.'));
    }
    last.forEach(function (e) { home.recent.appendChild(entryRow(e, true)); });
  }

  function entryRow(e, showDate) {
    return h('button', { class: 'row', type: 'button', onclick: function () { openEntrySheet(e); } },
      h('div', null,
        h('div', { class: 'row-title' }, jobName(e.jobId)),
        showDate ? h('div', { class: 'row-sub' }, L.weekdayShort(e.date) + ' ' + L.formatDateBR(e.date)) : null),
      h('div', { class: 'row-val' }, L.formatMinutes(e.minutes)));
  }

  /* =============== Janelas de edição =============== */

  function openEntrySheet(entry) {
    openSheet('Editar lançamento', function (body, close) {
      var jobId = entry.jobId;
      var picker = jobPicker(function () { return jobId; }, function (id) { jobId = id; });
      var date = h('input', { type: 'date', class: 'input', value: entry.date, 'aria-label': 'Data' });
      var dur = durationPicker(entry.minutes);
      body.appendChild(h('div', { class: 'card' },
        field('Emprego', '', picker.el),
        field('Data', '', date),
        field('Duração', '', dur.el)));
      body.appendChild(h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: function () {
          if (!jobExists(jobId)) { toast('Escolha o emprego.'); return; }
          if (!L.isValidISO(date.value)) { toast('Escolha a data.'); return; }
          if (dur.get() <= 0) { toast('Escolha a duração.'); return; }
          entry.jobId = jobId; entry.date = date.value; entry.minutes = dur.get();
          save(); close(); refreshAll(); toast('Lançamento atualizado.');
        } }, 'Salvar alterações'),
        h('button', { class: 'btn btn-danger', type: 'button', onclick: function () {
          confirmSheet({
            title: 'Excluir lançamento?',
            message: L.formatMinutes(entry.minutes) + ' em ' + jobName(entry.jobId) + ', ' + L.formatDateBR(entry.date) + '. Isso não pode ser desfeito.',
            confirmLabel: 'Excluir lançamento', danger: true
          }, function () {
            state.entries = state.entries.filter(function (e) { return e.id !== entry.id; });
            save(); close(); refreshAll(); toast('Lançamento excluído.');
          });
        } }, 'Excluir lançamento')));
    });
  }

  function openNoteSheet(date) {
    openSheet('Observação do dia', function (body, close) {
      var note = noteField();
      note.set(state.notes[date] || '');
      body.appendChild(h('div', { class: 'card' },
        h('h2', null, L.weekdayName(date) + ', ' + L.formatDateBR(date)),
        note.el));
      var actions = [
        h('button', { class: 'btn btn-primary', type: 'button', onclick: function () {
          var t = note.get();
          if (!t) { toast('Escreva uma observação ou use Excluir observação.'); return; }
          state.notes[date] = t; save(); close(); refreshAll(); home.syncDay(); toast('Observação salva.');
        } }, 'Salvar observação')
      ];
      if (state.notes[date]) {
        actions.push(h('button', { class: 'btn btn-danger', type: 'button', onclick: function () {
          delete state.notes[date]; save(); close(); refreshAll(); home.syncDay(); toast('Observação excluída.');
        } }, 'Excluir observação'));
      }
      body.appendChild(h('div', { class: 'btn-row' }, actions));
    });
  }

  function openJobSheet(job) {
    var isNew = !job;
    openSheet(isNew ? 'Novo emprego' : 'Editar emprego', function (body, close) {
      var name = h('input', { type: 'text', class: 'input', maxlength: '60', autocomplete: 'off', placeholder: 'Ex.: Casa da Maria', value: job ? job.name : '', 'aria-label': 'Apelido do emprego' });
      var addr = h('textarea', { class: 'input', rows: '2', maxlength: '200', placeholder: 'Rua, número, cidade', 'aria-label': 'Endereço' });
      addr.value = job ? job.address : '';
      body.appendChild(h('div', { class: 'card' },
        field('Apelido', 'para você reconhecer o emprego', name),
        field('Endereço', '(opcional)', addr)));
      var actions = [h('button', { class: 'btn btn-primary', type: 'button', onclick: function () {
        var n = name.value.trim();
        if (!n) { toast('Escreva o apelido do emprego.'); name.focus(); return; }
        var dup = state.jobs.some(function (j) { return j.name.toLowerCase() === n.toLowerCase() && (!job || j.id !== job.id); });
        if (dup) { toast('Já existe um emprego com esse apelido.'); return; }
        if (isNew) {
          var j = { id: L.newId(), name: n, address: addr.value.trim() };
          state.jobs.push(j); ui.jobId = j.id; lsSet(KEY_LAST_JOB, j.id);
        } else { job.name = n; job.address = addr.value.trim(); }
        save(); close(); refreshAll(); toast('Emprego salvo.');
      } }, 'Salvar emprego')];
      if (!isNew) {
        actions.push(h('button', { class: 'btn btn-danger', type: 'button', onclick: function () {
          var mine = state.entries.filter(function (e) { return e.jobId === job.id; });
          var msg = mine.length
            ? 'Isso também apaga os ' + mine.length + ' lançamentos deste emprego (' + L.formatMinutes(L.sumMinutes(mine)) + ' no total). Não pode ser desfeito.'
            : 'Este emprego não tem lançamentos.';
          confirmSheet({ title: 'Excluir "' + job.name + '"?', message: msg, confirmLabel: 'Excluir emprego', danger: true }, function () {
            state.jobs = state.jobs.filter(function (j) { return j.id !== job.id; });
            state.entries = state.entries.filter(function (e) { return e.jobId !== job.id; });
            if (ui.jobId === job.id) ui.jobId = null;
            if (ui.hist.jobId === job.id) ui.hist.jobId = null;
            save(); close(); refreshAll(); toast('Emprego excluído.');
          });
        } }, 'Excluir emprego'));
      }
      body.appendChild(h('div', { class: 'btn-row' }, actions));
      if (isNew) setTimeout(function () { name.focus(); }, 300);
    });
  }

  /* =============== Aba: Histórico =============== */

  var hist = {};

  function buildHistory() {
    var root = views.history;
    hist.label = h('div', { class: 'month-label' });
    hist.summary = h('section', { class: 'card hero' });
    hist.chips = h('div', { class: 'chips', style: 'margin-bottom:14px' });
    hist.days = h('div');
    root.appendChild(pageHead('Histórico', 'Veja os dias e as horas de cada mês.'));
    root.appendChild(h('div', { class: 'month-nav' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mês anterior', onclick: function () { shiftHist(-1); } }, '‹'),
      hist.label,
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Próximo mês', onclick: function () { shiftHist(1); } }, '›')));
    root.appendChild(hist.summary);
    root.appendChild(hist.chips);
    root.appendChild(hist.days);
  }
  function shiftHist(d) {
    var s = L.shiftMonth(ui.hist.year, ui.hist.month, d);
    ui.hist.year = s.year; ui.hist.month = s.month; ui.hist.jobId = null;
    refreshHistory();
  }

  function refreshHistory() {
    var hs = ui.hist, range = L.monthRange(hs.year, hs.month);
    var rep = L.buildReport(state, range.start, range.end);
    if (hs.jobId && !rep.byJob.some(function (b) { return b.jobId === hs.jobId; })) hs.jobId = null;

    clear(hist.label);
    hist.label.appendChild(document.createTextNode(L.monthName(hs.month) + ' ' + hs.year));
    var today = new Date();
    if (hs.year !== today.getFullYear() || hs.month !== today.getMonth()) {
      hist.label.appendChild(h('button', { class: 'link-btn', type: 'button', onclick: function () {
        hs.year = today.getFullYear(); hs.month = today.getMonth(); hs.jobId = null; refreshHistory();
      } }, 'Voltar ao mês atual'));
    }

    var sel = hs.jobId ? rep.byJob.filter(function (b) { return b.jobId === hs.jobId; })[0] : null;
    var mins = sel ? sel.minutes : rep.totalMinutes;
    var days = sel ? sel.days : rep.workedDays;
    clear(hist.summary);
    hist.summary.appendChild(h('div', { class: 'hero-top' },
      h('span', null, sel ? sel.name : 'Todos os empregos'),
      h('span', null, days === 1 ? '1 dia trabalhado' : days + ' dias trabalhados')));
    hist.summary.appendChild(h('div', { class: 'hero-main' },
      h('div', { class: 'hero-hours' }, L.formatMinutes(mins)),
      h('div', { class: 'hero-money' }, L.formatMoneyCents(L.amountCents(mins, state.settings.rateCents)))));

    clear(hist.chips);
    if (rep.byJob.length > 1 || hs.jobId) {
      hist.chips.appendChild(h('button', { type: 'button', class: 'chip stack' + (!hs.jobId ? ' on' : ''), 'aria-pressed': String(!hs.jobId),
        onclick: function () { hs.jobId = null; refreshHistory(); } }, 'Todos', h('small', null, plural(rep.dayCount, 'dia', 'dias'))));
      rep.byJob.forEach(function (b) {
        var on = hs.jobId === b.jobId;
        hist.chips.appendChild(h('button', { type: 'button', class: 'chip stack' + (on ? ' on' : ''), 'aria-pressed': String(on),
          onclick: function () { hs.jobId = on ? null : b.jobId; refreshHistory(); } },
          b.name, h('small', null, plural(b.days, 'dia', 'dias') + ' · ' + L.formatMinutes(b.minutes))));
      });
    }

    clear(hist.days);
    var list = L.entriesByDay(state, range.start, range.end, hs.jobId);
    if (!list.length) {
      hist.days.appendChild(h('div', { class: 'card empty-state' },
        h('strong', null, 'Nada lançado neste mês'),
        'Quando você salvar horas na aba Lançar, elas aparecem aqui.'));
      return;
    }
    list.forEach(function (d) {
      var head = h('div', { class: 'day-head' },
        h('div', { class: 'day-title' }, L.weekdayName(d.date) + ', ' + L.formatDateShort(d.date)),
        d.minutes ? h('div', { class: 'day-total' }, L.formatMinutes(d.minutes)) : null,
        d.note ? null : h('button', { class: 'link-btn', type: 'button', onclick: function () { openNoteSheet(d.date); } }, '+ observação'));
      var box = h('div', { class: 'day' }, head);
      if (d.note) box.appendChild(h('button', { class: 'daynote', type: 'button', 'aria-label': 'Editar observação: ' + d.note, onclick: function () { openNoteSheet(d.date); } }, d.note));
      d.entries.forEach(function (e) { box.appendChild(entryRow(e, false)); });
      hist.days.appendChild(box);
    });
  }

  /* =============== Aba: Empregos =============== */

  var jobsView = {};

  function buildJobs() {
    var root = views.jobs;
    jobsView.list = h('div', { class: 'list' });
    root.appendChild(pageHead('Empregos', 'Os lugares onde você trabalha.'));
    root.appendChild(h('div', { class: 'btn-row', style: 'margin-bottom:14px' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: function () { openJobSheet(); } }, 'Novo emprego')));
    root.appendChild(h('section', { class: 'card' }, jobsView.list));
  }

  function refreshJobs() {
    clear(jobsView.list);
    if (!state.jobs.length) {
      jobsView.list.appendChild(h('div', { class: 'empty-state' },
        h('strong', null, 'Nenhum emprego cadastrado'),
        'Cadastre cada lugar com um apelido e o endereço. Depois é só escolher na hora de lançar as horas.'));
      return;
    }
    var now = new Date(), rep = monthReport(now.getFullYear(), now.getMonth()), byId = {};
    rep.byJob.forEach(function (b) { byId[b.jobId] = b; });
    state.jobs.forEach(function (j) {
      var b = byId[j.id];
      jobsView.list.appendChild(h('button', { class: 'row', type: 'button', onclick: function () { openJobSheet(j); } },
        h('div', null,
          h('div', { class: 'row-title' }, j.name),
          h('div', { class: 'row-sub' }, j.address || 'Sem endereço')),
        h('div', { style: 'text-align:right' },
          h('div', { class: 'row-val' }, L.formatMinutes(b ? b.minutes : 0)),
          h('div', { class: 'row-sub' }, 'neste mês')),
        h('span', { class: 'row-chev', 'aria-hidden': 'true' }, '›')));
    });
  }

  /* =============== Aba: Relatório =============== */

  var rep = {};

  function buildReportView() {
    var root = views.report;
    rep.presets = h('div', { class: 'chips' });
    rep.start = h('input', { type: 'date', class: 'input', 'aria-label': 'Data inicial' });
    rep.end = h('input', { type: 'date', class: 'input', 'aria-label': 'Data final' });
    function onDates() {
      if (L.isValidISO(rep.start.value)) ui.rep.start = rep.start.value;
      if (L.isValidISO(rep.end.value)) ui.rep.end = rep.end.value;
      refreshReport();
    }
    rep.start.addEventListener('change', onDates);
    rep.end.addEventListener('change', onDates);
    rep.warn = h('p', { class: 'hint warn', hidden: true }, 'A data final precisa ser igual ou depois da inicial.');
    rep.preview = h('section', { class: 'card' });
    rep.amount = h('input', { type: 'checkbox', id: 'rep-amount' });
    rep.amount.addEventListener('change', function () {
      state.settings.reportShowAmount = rep.amount.checked; save(); refreshReport();
    });
    rep.share = h('button', { class: 'btn btn-primary', type: 'button', onclick: function () { reportAction('share'); } }, 'Compartilhar PDF');
    rep.download = h('button', { class: 'btn btn-secondary', type: 'button', onclick: function () { reportAction('download'); } }, 'Baixar PDF');

    root.appendChild(pageHead('Relatório', 'Ficha de horas para enviar no fim do mês.'));
    root.appendChild(h('section', { class: 'card' },
      h('h2', null, 'Período'),
      rep.presets,
      h('div', { class: 'row2', style: 'margin-top:12px' },
        h('div', null, h('span', { class: 'label' }, 'De'), rep.start),
        h('div', null, h('span', { class: 'label' }, 'Até'), rep.end)),
      rep.warn));
    root.appendChild(rep.preview);
    root.appendChild(h('section', { class: 'card' },
      h('label', { class: 'check', for: 'rep-amount' }, rep.amount, h('span', null, 'Mostrar o valor a receber (€) no PDF')),
      h('div', { class: 'btn-row', style: 'margin-top:10px' }, rep.share, rep.download)));
  }

  function setPeriod(start, end) { ui.rep.start = start; ui.rep.end = end; refreshReport(); }

  function refreshReport() {
    var t = new Date(), cur = L.monthRange(t.getFullYear(), t.getMonth());
    var pm = L.shiftMonth(t.getFullYear(), t.getMonth(), -1), prev = L.monthRange(pm.year, pm.month);
    clear(rep.presets);
    [['Este mês', cur], ['Mês passado', prev]].forEach(function (p) {
      var on = ui.rep.start === p[1].start && ui.rep.end === p[1].end;
      rep.presets.appendChild(h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': String(on),
        onclick: function () { setPeriod(p[1].start, p[1].end); } }, p[0]));
    });
    rep.start.value = ui.rep.start; rep.end.value = ui.rep.end;
    rep.amount.checked = !!state.settings.reportShowAmount;

    var bad = ui.rep.start > ui.rep.end;
    rep.warn.hidden = !bad;
    var r = bad ? L.buildReport(state, '9999-01-01', '9999-01-01') : L.buildReport(state, ui.rep.start, ui.rep.end);
    var empty = !r.rows.length;
    rep.share.disabled = empty; rep.download.disabled = empty;

    clear(rep.preview);
    rep.preview.appendChild(h('h2', null, 'Prévia', h('small', null, L.formatDateBR(ui.rep.start) + ' a ' + L.formatDateBR(ui.rep.end))));
    if (empty) {
      rep.preview.appendChild(h('div', { class: 'empty-state' },
        h('strong', null, bad ? 'Período inválido' : 'Nada lançado neste período'),
        bad ? 'Ajuste as datas acima.' : 'Escolha outro período ou lance horas na aba Lançar.'));
      return;
    }
    r.rows.forEach(function (row) {
      rep.preview.appendChild(h('div', { class: 'rep-row' },
        h('div', { class: 'rep-date' }, row.firstOfDay ? [L.formatDateShort(row.date), h('small', null, L.weekdayShort(row.date))] : ''),
        h('div', null,
          h('div', { class: 'row-title' }, row.jobId ? row.jobName : 'Sem horas'),
          row.note ? h('span', { class: 'rep-note' }, row.note) : null),
        h('div', { class: 'rep-hours' }, row.jobId ? L.formatMinutes(row.minutes) : '-')));
    });
    rep.preview.appendChild(h('div', { class: 'rep-total' }, h('span', null, 'Total'),
      h('span', null, L.formatMinutes(r.totalMinutes), h('small', null, L.formatDecimalHours(r.totalMinutes) + ' h'))));
    rep.preview.appendChild(h('div', { style: 'margin-top:10px' },
      h('div', { class: 'kv' }, h('span', null, 'Dias trabalhados'), h('span', null, String(r.workedDays))),
      state.settings.reportShowAmount
        ? h('div', { class: 'kv' }, h('span', null, 'Valor a receber'), h('span', null, L.formatMoneyCents(L.amountCents(r.totalMinutes, state.settings.rateCents))))
        : null));
    r.byJob.forEach(function (b) {
      rep.preview.appendChild(h('div', { class: 'kv' }, h('span', null, b.name + ' · ' + plural(b.days, 'dia', 'dias')), h('span', null, L.formatMinutes(b.minutes))));
    });
  }

  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  }

  function buildPdfBlob() {
    if (!(window.jspdf && window.jspdf.jsPDF && window.autoTable)) {
      toast('O gerador de PDF não carregou. Feche e abra o app com internet uma vez.');
      return null;
    }
    var r = L.buildReport(state, ui.rep.start, ui.rep.end);
    if (!r.rows.length) { toast('Não há lançamentos neste período.'); return null; }
    var doc = window.ReportPdf.build(window.jspdf.jsPDF, window.autoTable, r, {
      name: state.settings.name, showAmount: !!state.settings.reportShowAmount,
      rateCents: state.settings.rateCents, generatedAt: L.todayISO()
    });
    return doc.output('blob');
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  // Abre a folha de compartilhamento do celular (WhatsApp, e-mail, Arquivos); se não houver, baixa o arquivo.
  function shareFile(blob, filename, title) {
    var file = null;
    try { file = new File([blob], filename, { type: blob.type }); } catch (e) { file = null; }
    if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: title }).then(function () { return true; }, function (err) {
        if (err && err.name === 'AbortError') return false;
        downloadBlob(blob, filename); return true;
      });
    }
    downloadBlob(blob, filename);
    return Promise.resolve(true);
  }

  function reportAction(kind) {
    var blob = buildPdfBlob();
    if (!blob) return;
    var nm = slug(state.settings.name);
    var filename = 'ficha-de-horas' + (nm ? '_' + nm : '') + '_' + ui.rep.start + '_a_' + ui.rep.end + '.pdf';
    if (kind === 'download') { downloadBlob(blob, filename); toast('PDF baixado.'); }
    else shareFile(blob, filename, 'Ficha de horas');
  }

  /* =============== Aba: Ajustes =============== */

  var sett = {};

  function buildSettings() {
    var root = views.settings;
    sett.name = h('input', { type: 'text', class: 'input', maxlength: '80', autocomplete: 'name', placeholder: 'Como aparece na ficha' });
    sett.name.addEventListener('change', function () { state.settings.name = sett.name.value.trim(); save(); toast('Nome salvo.'); });
    sett.rate = h('input', { type: 'text', class: 'input', inputmode: 'decimal', placeholder: '10,00' });
    sett.rate.addEventListener('change', function () {
      var c = L.parseRateToCents(sett.rate.value);
      if (c == null) { toast('Valor inválido. Exemplo: 10,00'); sett.rate.value = L.formatRateInput(state.settings.rateCents); return; }
      state.settings.rateCents = c; save(); refreshAll(); toast('Valor por hora salvo.');
    });
    sett.tplChips = h('div', { class: 'chips' });
    sett.tplInput = h('input', { type: 'text', class: 'input', maxlength: '40', placeholder: 'Nova observação pronta', enterkeyhint: 'done' });
    function addTpl() {
      var v = sett.tplInput.value.replace(/,/g, ' ').trim();
      if (!v) return;
      if (state.settings.templates.some(function (t) { return t.toLowerCase() === v.toLowerCase(); })) { toast('Essa observação já existe.'); return; }
      if (state.settings.templates.length >= 30) { toast('Limite de 30 observações prontas.'); return; }
      state.settings.templates.push(v); sett.tplInput.value = ''; save(); refreshAll();
    }
    sett.tplInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addTpl(); } });
    sett.backupInfo = h('p', { class: 'hint' });
    sett.file = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
    sett.file.addEventListener('change', onImportFile);

    root.appendChild(pageHead('Ajustes', 'Seus dados e preferências.'));
    root.appendChild(h('section', { class: 'card' },
      h('h2', null, 'Seus dados'),
      field('Nome', '(aparece na ficha em PDF)', sett.name),
      field('Valor por hora (€)', '', sett.rate)));
    root.appendChild(h('section', { class: 'card' },
      h('h2', null, 'Observações prontas'),
      sett.tplChips,
      h('div', { style: 'margin-top:12px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center' },
        sett.tplInput,
        h('button', { class: 'chip', type: 'button', onclick: addTpl }, 'Adicionar'))));
    root.appendChild(h('section', { class: 'card' },
      h('h2', null, 'Backup'),
      h('p', { class: 'hint', style: 'margin-top:0' }, 'Seus dados ficam só neste aparelho. Guarde uma cópia no iCloud, no Drive ou mande para você mesma no WhatsApp.'),
      sett.backupInfo,
      h('div', { class: 'btn-row', style: 'margin-top:12px' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: exportBackup }, 'Salvar backup'),
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: function () { sett.file.click(); } }, 'Restaurar de um backup')),
      sett.file));
    root.appendChild(h('p', { class: 'hint', style: 'text-align:center' }, 'Banco de Horas · versão ' + APP_VERSION));
  }

  function refreshSettings() {
    if (document.activeElement !== sett.name) sett.name.value = state.settings.name;
    if (document.activeElement !== sett.rate) sett.rate.value = L.formatRateInput(state.settings.rateCents);
    clear(sett.tplChips);
    if (!state.settings.templates.length) sett.tplChips.appendChild(h('span', { class: 'hint', style: 'margin:0' }, 'Nenhuma observação pronta.'));
    state.settings.templates.forEach(function (t) {
      sett.tplChips.appendChild(h('button', { type: 'button', class: 'chip', 'aria-label': 'Remover ' + t, onclick: function () {
        state.settings.templates = state.settings.templates.filter(function (x) { return x !== t; });
        save(); refreshAll();
      } }, t, h('span', { class: 'x', 'aria-hidden': 'true' }, '×')));
    });
    var lb = state.settings.lastBackup;
    sett.backupInfo.textContent = lb && L.isValidISO(lb) ? 'Último backup: ' + L.formatDateBR(lb) + '.' : 'Você ainda não fez nenhum backup.';
  }

  function exportBackup() {
    var json = JSON.stringify(state, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    shareFile(blob, 'banco-de-horas-backup-' + L.todayISO() + '.json', 'Backup do Banco de Horas').then(function (ok) {
      if (!ok) return;
      state.settings.lastBackup = L.todayISO(); save(); refreshAll();
      toast('Backup salvo. Guarde esse arquivo em um lugar seguro.');
    });
  }

  function onImportFile() {
    var f = sett.file.files && sett.file.files[0];
    sett.file.value = '';
    if (!f) return;
    var reader = new FileReader();
    reader.onerror = function () { toast('Não foi possível ler o arquivo.'); };
    reader.onload = function () {
      var res;
      try { res = L.normalizeState(JSON.parse(String(reader.result))); }
      catch (e) { toast('Esse arquivo não é um backup do Banco de Horas.'); return; }
      var st = res.state;
      var extra = res.dropped ? ' (' + plural(res.dropped, 'item inválido foi ignorado', 'itens inválidos foram ignorados') + ')' : '';
      confirmSheet({
        title: 'Restaurar este backup?',
        message: 'O backup tem ' + plural(st.jobs.length, 'emprego', 'empregos') + ' e ' + plural(st.entries.length, 'lançamento', 'lançamentos') + extra +
          '. Os dados atuais deste aparelho (' + plural(state.jobs.length, 'emprego', 'empregos') + ', ' + plural(state.entries.length, 'lançamento', 'lançamentos') + ') serão substituídos.',
        confirmLabel: 'Substituir os dados', danger: true
      }, function () {
        lsSet(KEY + '.antes-da-restauracao', JSON.stringify(state));
        state = st; save();
        ui.jobId = lsGet(KEY_LAST_JOB); ui.hist.jobId = null;
        refreshAll(); home.syncDay(); toast('Backup restaurado.');
      });
    };
    reader.readAsText(f);
  }

  /* =============== Atualização geral =============== */

  function refreshAll() {
    refreshHome(); refreshHistory(); refreshJobs(); refreshReport(); refreshSettings();
  }

  /* =============== Início =============== */

  function init() {
    buildShell();
    buildHome(); buildHistory(); buildJobs(); buildReportView(); buildSettings();
    go('home');
    if (loadProblem) {
      openSheet('Não consegui ler os dados salvos', function (body, close) {
        body.appendChild(h('p', { class: 'confirm-msg' }, 'Os dados guardados neste aparelho estavam danificados. Uma cópia deles foi mantida e o app começou vazio. Se você tem um backup, restaure em Ajustes.'));
        body.appendChild(h('button', { class: 'btn btn-primary', type: 'button', onclick: close }, 'Entendi'));
      });
    }
    // Se o app ficou aberto de um dia para o outro, avança "hoje" (se a data não foi mexida).
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      var t = L.todayISO();
      if (t !== ui.todayStamp) {
        ui.todayStamp = t;
        if (!ui.dateTouched) { ui.date = t; home.syncDay(); }
        refreshAll();
      }
    });
    if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) { /* ignora */ } }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* funciona sem offline */ });
    }
  }

  init();
})();
