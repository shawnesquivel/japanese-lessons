(function () {
  "use strict";

  var STORE_KEY = "kosuke.flashcardPacks.v1";
  var SCHEMA_VERSION = 1;

  function slug(value) {
    return String(value || "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "pack";
  }

  function uniqueId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function text(value, max) {
    return String(value == null ? "" : value).trim().slice(0, max || 500);
  }

  function normalizeAudio(value) {
    if (!value) return null;
    if (typeof value === "string") return { url: text(value, 1000) };
    if (typeof value !== "object" || !value.url) return null;
    return {
      url: text(value.url, 1000),
      voiceId: text(value.voiceId, 120),
      provider: text(value.provider || "elevenlabs", 40),
    };
  }

  function normalizeCard(card, index) {
    card = card || {};
    var kana = text(card.kana || card.japanese, 160);
    var english = text(card.english || card.en, 300);
    var romaji = text(card.romaji, 200);
    if (!kana || !english || !romaji) {
      throw new Error("Card " + (index + 1) + " needs kana, romaji, and English.");
    }
    return {
      id: text(card.id, 100) || slug(romaji) + "-" + (index + 1),
      type: text(card.type || "vocabulary", 40),
      kana: kana,
      romaji: romaji,
      english: english,
      hint: text(card.hint, 300),
      example: card.example && typeof card.example === "object" ? {
        kana: text(card.example.kana, 300),
        romaji: text(card.example.romaji, 400),
        english: text(card.example.english || card.example.en, 500),
      } : null,
      kanji: text(card.kanji, 160),
      furigana: text(card.furigana, 240),
      tags: Array.isArray(card.tags) ? card.tags.map(function (tag) { return text(tag, 50); }).filter(Boolean).slice(0, 12) : [],
      audio: normalizeAudio(card.audio),
    };
  }

  function normalizePack(pack) {
    if (!pack || typeof pack !== "object") throw new Error("That file is not a flashcard pack.");
    var title = text(pack.title, 120);
    var cards = Array.isArray(pack.cards) ? pack.cards : [];
    if (!title) throw new Error("A pack needs a title.");
    if (!cards.length) throw new Error("A pack needs at least one card.");
    var normalized = {
      schemaVersion: SCHEMA_VERSION,
      id: text(pack.id, 100) || uniqueId(slug(title)),
      title: title,
      description: text(pack.description, 400),
      language: text(pack.language || "ja", 12),
      visibility: ["private", "unlisted", "public"].indexOf(pack.visibility) === -1 ? "private" : pack.visibility,
      author: text(pack.author || "You", 100),
      source: pack.source && typeof pack.source === "object" ? {
        type: text(pack.source.type || "manual", 40),
        title: text(pack.source.title, 160),
        note: text(pack.source.note, 400),
      } : { type: "manual", title: "", note: "" },
      createdAt: text(pack.createdAt, 60) || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cards: cards.map(normalizeCard),
    };
    var seen = {};
    normalized.cards.forEach(function (card, index) {
      if (seen[card.id]) card.id = card.id + "-" + (index + 1);
      seen[card.id] = true;
    });
    return normalized;
  }

  function loadCustom() {
    try {
      var value = JSON.parse(localStorage.getItem(STORE_KEY));
      if (value && value.version === 1 && Array.isArray(value.packs)) {
        return value.packs.map(normalizePack);
      }
    } catch (_) {}
    return [];
  }

  var custom = loadCustom();

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, packs: custom }));
  }

  function builtIns() {
    return Array.isArray(window.KOSUKE_STARTER_PACKS) ? window.KOSUKE_STARTER_PACKS.map(normalizePack) : [];
  }

  function all() {
    return builtIns().concat(custom);
  }

  function get(id) {
    return all().find(function (pack) { return pack.id === id; }) || null;
  }

  function upsert(pack) {
    var normalized = normalizePack(pack);
    var collidesWithStarter = builtIns().some(function (item) { return item.id === normalized.id; });
    var alreadyCustom = custom.some(function (item) { return item.id === normalized.id; });
    if (collidesWithStarter && !alreadyCustom) {
      normalized.id = uniqueId(slug(normalized.title));
      normalized.title += " · remix";
    }
    var index = custom.findIndex(function (item) { return item.id === normalized.id; });
    if (index === -1) custom.unshift(normalized);
    else custom[index] = normalized;
    save();
    return normalized;
  }

  function remove(id) {
    var before = custom.length;
    custom = custom.filter(function (pack) { return pack.id !== id; });
    if (custom.length !== before) save();
    return custom.length !== before;
  }

  function download(pack) {
    var normalized = normalizePack(pack);
    var blob = new Blob([JSON.stringify(normalized, null, 2)], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = slug(normalized.title) + ".kosuke.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function importFile(file) {
    return file.text().then(function (value) {
      return upsert(JSON.parse(value));
    });
  }

  function fromLegacy(manifest) {
    var words = (manifest && manifest.words) || [];
    return normalizePack({
      id: "japanese-lessons-core",
      title: "Japanese Lessons Core",
      description: "Vocabulary collected from the lessons, with generated audio where available.",
      author: "Kosuke",
      visibility: "public",
      source: { type: "lesson-library", title: "Japanese Lessons" },
      cards: words.map(function (word) {
        return {
          id: word.id,
          kana: word.kana,
          romaji: word.romaji,
          english: word.en,
          tags: [word.group],
          audio: word.audio ? { url: word.audio, voiceId: word.voice, provider: "elevenlabs" } : null,
        };
      }),
    });
  }

  window.KOSUKE_PACKS = {
    key: STORE_KEY,
    schemaVersion: SCHEMA_VERSION,
    all: all,
    get: get,
    upsert: upsert,
    remove: remove,
    normalizePack: normalizePack,
    download: download,
    importFile: importFile,
    fromLegacy: fromLegacy,
    slug: slug,
  };
})();
