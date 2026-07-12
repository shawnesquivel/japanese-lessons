(function () {
  "use strict";

  var STORE_KEY = "japaneseLessons.progress.v1";
  var DAY = 24 * 60 * 60 * 1000;
  var MINUTE = 60 * 1000;

  function emptyStore() {
    return {
      version: 1,
      cards: {},
      sessions: [],
      studyMs: {},
      xp: 0,
      streak: { count: 0, lastDay: "" },
    };
  }

  function ensureStudyMs(data) {
    data.sessions = data.sessions || [];
    if (data.studyMs && typeof data.studyMs === "object") return;
    data.studyMs = {};
    data.sessions.forEach(function (session) {
      var duration = Math.max(0, Number(session.durationMs) || 0);
      if (!duration) return;
      var kind = session.kind || "other";
      data.studyMs[kind] = (data.studyMs[kind] || 0) + duration;
    });
  }

  function load() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORE_KEY));
      if (parsed && parsed.version === 1) {
        parsed.cards = parsed.cards || {};
        parsed.sessions = parsed.sessions || [];
        ensureStudyMs(parsed);
        parsed.xp = parsed.xp || 0;
        parsed.streak = parsed.streak || { count: 0, lastDay: "" };
        return parsed;
      }
    } catch (_) {}
    return emptyStore();
  }

  var store = load();

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }

  function dayKey(date) {
    var d = date || new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  }

  function yesterdayKey() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return dayKey(d);
  }

  function touchStreak() {
    var today = dayKey();
    if (store.streak.lastDay === today) return;
    store.streak.count = store.streak.lastDay === yesterdayKey() ? store.streak.count + 1 : 1;
    store.streak.lastDay = today;
  }

  function freshCard(id) {
    return {
      id: id,
      reviews: 0,
      correct: 0,
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
      lapses: 0,
      ease: 2.5,
      intervalDays: 0,
      due: 0,
      lastReviewed: 0,
      lastRating: "",
      subject: "",
      type: "",
    };
  }

  function card(id) {
    return store.cards[id] || freshCard(id);
  }

  function intervalFor(state, rating) {
    if (rating === "again") return 1 / 1440;
    if (!state.reviews) {
      if (rating === "hard") return 0.25;
      if (rating === "easy") return 4;
      return 1;
    }
    if (rating === "hard") return Math.max(0.25, state.intervalDays * 1.2);
    if (rating === "easy") return Math.max(4, state.intervalDays * state.ease * 1.3);
    return Math.max(1, state.intervalDays * state.ease);
  }

  function record(id, rating, meta) {
    var state = store.cards[id] || freshCard(id);
    var now = Date.now();
    var valid = ["again", "hard", "good", "easy"].indexOf(rating) !== -1 ? rating : "again";

    state.reviews += 1;
    state[valid] += 1;
    state.lastRating = valid;
    state.lastReviewed = now;
    state.subject = (meta && meta.subject) || state.subject;
    state.type = (meta && meta.type) || state.type;
    if (valid === "again") {
      state.lapses += 1;
      state.ease = Math.max(1.3, state.ease - 0.2);
    } else {
      state.correct += 1;
      if (valid === "hard") state.ease = Math.max(1.3, state.ease - 0.15);
      if (valid === "easy") state.ease = Math.min(3.2, state.ease + 0.15);
    }

    state.intervalDays = intervalFor(state, valid);
    state.due = now + (state.intervalDays < 1 ? state.intervalDays * DAY : Math.round(state.intervalDays) * DAY);
    store.cards[id] = state;
    store.xp += { again: 1, hard: 3, good: 6, easy: 8 }[valid];
    touchStreak();
    save();
    return state;
  }

  function isDue(id, now) {
    var state = store.cards[id];
    return !state || !state.due || state.due <= (now || Date.now());
  }

  function strength(id) {
    var state = store.cards[id];
    if (!state || !state.reviews) return 0;
    var accuracy = Math.max(0, state.correct) / state.reviews;
    var interval = Math.min(1, state.intervalDays / 30);
    return Math.round((accuracy * 0.65 + interval * 0.35) * 100);
  }

  function priority(item) {
    var state = store.cards[item.id];
    if (!state) return 120 + Math.random() * 15;
    var dueBoost = state.due <= Date.now() ? 80 + Math.min(50, (Date.now() - state.due) / DAY) : 0;
    var weakBoost = (100 - strength(item.id)) * 0.75 + state.lapses * 8 + state.again * 3;
    var recentPenalty = state.due > Date.now() ? Math.min(70, (state.due - Date.now()) / DAY * 4) : 0;
    return dueBoost + weakBoost - recentPenalty + Math.random() * 12;
  }

  function order(items) {
    return items.slice().sort(function (a, b) {
      return priority(b) - priority(a);
    });
  }

  function due(items) {
    return order(items.filter(function (item) { return isDue(item.id); }));
  }

  function summary(ids) {
    var selected = ids && ids.length ? ids : Object.keys(store.cards);
    var reviewed = selected.filter(function (id) { return store.cards[id] && store.cards[id].reviews; });
    var dueCount = selected.filter(function (id) { return isDue(id); }).length;
    var mastered = reviewed.filter(function (id) {
      var state = store.cards[id];
      return strength(id) >= 80 && state.intervalDays >= 14;
    }).length;
    var reviews = reviewed.reduce(function (sum, id) { return sum + store.cards[id].reviews; }, 0);
    var correct = reviewed.reduce(function (sum, id) { return sum + Math.max(0, store.cards[id].correct); }, 0);
    return {
      total: selected.length,
      studied: reviewed.length,
      due: dueCount,
      mastered: mastered,
      reviews: reviews,
      accuracy: reviews ? Math.round(correct / reviews * 100) : 0,
      xp: store.xp,
      level: Math.floor(store.xp / 100) + 1,
      levelProgress: store.xp % 100,
      streak: store.streak.count,
    };
  }

  function addSession(session) {
    var entry = Object.assign({ ts: Date.now() }, session);
    var duration = Math.max(0, Number(entry.durationMs) || 0);
    store.sessions.push(entry);
    store.sessions = store.sessions.slice(-50);
    store.studyMs = store.studyMs || {};
    if (duration) {
      var kind = entry.kind || "other";
      store.studyMs[kind] = (store.studyMs[kind] || 0) + duration;
    }
    save();
  }

  function studyTime(kind) {
    return Math.max(0, Number(store.studyMs && store.studyMs[kind]) || 0);
  }

  function exportData() {
    return JSON.stringify(store, null, 2);
  }

  function importData(value) {
    var parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || parsed.version !== 1 || !parsed.cards) throw new Error("Invalid progress file");
    ensureStudyMs(parsed);
    store = parsed;
    save();
  }

  function reset() {
    store = emptyStore();
    save();
  }

  function nextLabel(id) {
    var state = store.cards[id];
    if (!state || !state.due) return "new";
    var delta = state.due - Date.now();
    if (delta <= 0) return "due";
    if (delta < 60 * MINUTE) return Math.max(1, Math.round(delta / MINUTE)) + "m";
    if (delta < DAY) return Math.max(1, Math.round(delta / (60 * MINUTE))) + "h";
    return Math.max(1, Math.round(delta / DAY)) + "d";
  }

  window.JL_PROGRESS = {
    key: STORE_KEY,
    card: card,
    record: record,
    isDue: isDue,
    strength: strength,
    order: order,
    due: due,
    summary: summary,
    sessions: function () { return store.sessions.slice(); },
    addSession: addSession,
    studyTime: studyTime,
    exportData: exportData,
    importData: importData,
    reset: reset,
    nextLabel: nextLabel,
  };
})();
