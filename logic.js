/* Lógica pura do Banco de Horas: datas, soma de horas, dinheiro, relatório e backup.
   Sem acesso a DOM nem a armazenamento, para poder ser testada no Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Logic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var MAX_ENTRY_MINUTES = 24 * 60;

  /* ---------- datas (sempre como texto AAAA-MM-DD, sem fuso horário) ---------- */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toISO(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isValidISO(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    return toISO(parseISO(s)) === s;
  }
  function todayISO() { return toISO(new Date()); }
  function addDays(iso, n) { var d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
  function formatDateBR(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function formatDateShort(iso) { var p = iso.split('-'); return p[2] + '/' + p[1]; }
  function weekdayName(iso) { return WEEKDAYS[parseISO(iso).getDay()]; }
  function weekdayShort(iso) { return WEEKDAYS_SHORT[parseISO(iso).getDay()]; }
  function monthName(m0) { return MONTHS[m0]; }
  function monthShort(m0) { return MONTHS_SHORT[m0]; }
  function monthRange(year, m0) {
    return { start: year + '-' + pad2(m0 + 1) + '-01', end: toISO(new Date(year, m0 + 1, 0)) };
  }
  function shiftMonth(year, m0, delta) {
    var d = new Date(year, m0 + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }

  /* ---------- horas: tudo é guardado em minutos inteiros ---------- */

  function formatMinutes(min) {
    min = Math.max(0, Math.round(min));
    return Math.floor(min / 60) + 'h' + pad2(min % 60);
  }
  function formatDecimalHours(min) {
    return (Math.round(min / 60 * 100) / 100).toFixed(2).replace('.', ',');
  }
  function sumMinutes(list) {
    var t = 0;
    for (var i = 0; i < list.length; i++) t += list[i].minutes;
    return t;
  }

  /* ---------- dinheiro: tudo em centavos inteiros ---------- */

  function amountCents(minutes, rateCents) { return Math.round(minutes * rateCents / 60); }
  function formatMoneyCents(c) {
    var neg = c < 0; c = Math.abs(c);
    var euros = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + euros + ',' + pad2(c % 100) + ' €';
  }
  function parseRateToCents(str) {
    var s = String(str).replace(/[^\d,.]/g, '').replace(',', '.');
    if (!s) return null;
    var n = Number(s);
    if (!isFinite(n) || n <= 0 || n > 100000) return null;
    return Math.round(n * 100);
  }
  function formatRateInput(cents) {
    return (cents / 100).toFixed(2).replace('.', ',');
  }

  /* ---------- estado ---------- */

  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function defaultState() {
    return {
      version: 1,
      settings: { name: '', rateCents: 1000, templates: ['Lavanderia', 'Feriado'], lastBackup: null, reportShowAmount: false },
      jobs: [],
      entries: [],
      notes: {}
    };
  }

  /* Valida e limpa um estado vindo do armazenamento ou de um backup.
     Lança erro se a estrutura for inválida; devolve { state, dropped }. */
  function normalizeState(obj) {
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.jobs) || !Array.isArray(obj.entries)) {
      throw new Error('Arquivo de backup inválido.');
    }
    var st = defaultState(), dropped = 0, seenJobs = {};
    var s = obj.settings && typeof obj.settings === 'object' ? obj.settings : {};
    if (typeof s.name === 'string') st.settings.name = s.name.slice(0, 80);
    if (typeof s.rateCents === 'number' && s.rateCents > 0 && s.rateCents <= 10000000) st.settings.rateCents = Math.round(s.rateCents);
    if (Array.isArray(s.templates)) {
      st.settings.templates = s.templates.filter(function (t) { return typeof t === 'string' && t.trim(); })
        .map(function (t) { return t.trim().slice(0, 40); }).slice(0, 30);
    }
    if (typeof s.lastBackup === 'string') st.settings.lastBackup = s.lastBackup;
    st.settings.reportShowAmount = s.reportShowAmount === true;

    obj.jobs.forEach(function (j) {
      if (j && typeof j.id === 'string' && j.id && typeof j.name === 'string' && j.name.trim() && !seenJobs[j.id]) {
        seenJobs[j.id] = true;
        st.jobs.push({ id: j.id, name: j.name.trim().slice(0, 60), address: typeof j.address === 'string' ? j.address.trim().slice(0, 200) : '' });
      } else dropped++;
    });
    obj.entries.forEach(function (e) {
      if (e && typeof e.id === 'string' && typeof e.jobId === 'string' && isValidISO(e.date) &&
          typeof e.minutes === 'number' && e.minutes > 0 && e.minutes <= MAX_ENTRY_MINUTES && Math.floor(e.minutes) === e.minutes) {
        st.entries.push({ id: e.id, jobId: e.jobId, date: e.date, minutes: e.minutes });
      } else dropped++;
    });
    if (obj.notes && typeof obj.notes === 'object') {
      Object.keys(obj.notes).forEach(function (date) {
        var t = obj.notes[date];
        if (isValidISO(date) && typeof t === 'string' && t.trim()) st.notes[date] = t.trim().slice(0, 200);
        else dropped++;
      });
    }
    return { state: st, dropped: dropped };
  }

  /* ---------- consultas ---------- */

  function jobsById(state) {
    var m = {};
    state.jobs.forEach(function (j) { m[j.id] = j; });
    return m;
  }
  function cmpName(a, b) { return a.localeCompare(b, 'pt'); }

  /* Relatório de um período: uma linha por (dia, emprego), somando lançamentos repetidos
     do mesmo emprego no mesmo dia. Dias só com observação (ex.: feriado) também aparecem. */
  function buildReport(state, start, end) {
    var byId = jobsById(state), perDay = {};
    state.entries.forEach(function (e) {
      if (e.date < start || e.date > end) return;
      var d = perDay[e.date] || (perDay[e.date] = { jobs: {}, order: [] });
      if (!(e.jobId in d.jobs)) { d.jobs[e.jobId] = 0; d.order.push(e.jobId); }
      d.jobs[e.jobId] += e.minutes;
    });
    Object.keys(state.notes).forEach(function (date) {
      if (date >= start && date <= end && !perDay[date]) perDay[date] = { jobs: {}, order: [] };
    });

    var dates = Object.keys(perDay).sort(), rows = [], totalMinutes = 0, workedDays = 0, agg = {};
    function nameOf(id) { return byId[id] ? byId[id].name : 'Emprego removido'; }

    dates.forEach(function (date, i) {
      var d = perDay[date], note = state.notes[date] || '';
      if (!d.order.length) {
        rows.push({ date: date, dayIndex: i, jobId: null, jobName: null, minutes: 0, note: note, firstOfDay: true });
        return;
      }
      workedDays++;
      d.order.sort(function (a, b) { return cmpName(nameOf(a), nameOf(b)); });
      d.order.forEach(function (jid, k) {
        var mins = d.jobs[jid];
        rows.push({ date: date, dayIndex: i, jobId: jid, jobName: nameOf(jid), minutes: mins, note: k === 0 ? note : '', firstOfDay: k === 0 });
        totalMinutes += mins;
        var b = agg[jid] || (agg[jid] = {
          jobId: jid, name: nameOf(jid), address: byId[jid] ? byId[jid].address : '', minutes: 0, days: 0
        });
        b.minutes += mins; b.days++;
      });
    });

    var byJob = Object.keys(agg).map(function (k) { return agg[k]; }).sort(function (a, b) { return cmpName(a.name, b.name); });
    return { start: start, end: end, rows: rows, totalMinutes: totalMinutes, workedDays: workedDays, byJob: byJob, dayCount: dates.length };
  }

  /* Lista por dia (mais recente primeiro) com os lançamentos editáveis. jobId opcional filtra por emprego. */
  function entriesByDay(state, start, end, jobId) {
    var byId = jobsById(state), days = {};
    state.entries.forEach(function (e) {
      if (e.date < start || e.date > end) return;
      if (jobId && e.jobId !== jobId) return;
      (days[e.date] || (days[e.date] = [])).push(e);
    });
    if (!jobId) {
      Object.keys(state.notes).forEach(function (date) {
        if (date >= start && date <= end && !days[date]) days[date] = [];
      });
    }
    return Object.keys(days).sort().reverse().map(function (date) {
      var list = days[date].slice().sort(function (a, b) {
        var an = byId[a.jobId] ? byId[a.jobId].name : '', bn = byId[b.jobId] ? byId[b.jobId].name : '';
        return cmpName(an, bn);
      });
      return { date: date, entries: list, note: state.notes[date] || '', minutes: sumMinutes(list) };
    });
  }

  function minutesOnDay(state, date) {
    return sumMinutes(state.entries.filter(function (e) { return e.date === date; }));
  }

  return {
    pad2: pad2, toISO: toISO, parseISO: parseISO, isValidISO: isValidISO, todayISO: todayISO, addDays: addDays,
    formatDateBR: formatDateBR, formatDateShort: formatDateShort, weekdayName: weekdayName, weekdayShort: weekdayShort,
    monthName: monthName, monthShort: monthShort, monthRange: monthRange, shiftMonth: shiftMonth,
    formatMinutes: formatMinutes, formatDecimalHours: formatDecimalHours, sumMinutes: sumMinutes,
    amountCents: amountCents, formatMoneyCents: formatMoneyCents, parseRateToCents: parseRateToCents, formatRateInput: formatRateInput,
    newId: newId, defaultState: defaultState, normalizeState: normalizeState,
    jobsById: jobsById, buildReport: buildReport, entriesByDay: entriesByDay, minutesOnDay: minutesOnDay,
    MAX_ENTRY_MINUTES: MAX_ENTRY_MINUTES
  };
});
