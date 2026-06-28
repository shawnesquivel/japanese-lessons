// Generates Japanese audio for the listening drill using ElevenLabs.
//
//   1. cp .env.example .env  and add ELEVENLABS_API_KEY
//   2. npm install
//   3. npm run generate:audio          (skips phrases that already have mp3s)
//      npm run generate:audio:force    (regenerates everything)
//
// Without an API key it still (re)writes audio/manifest.json with hasAudio:false
// so the web UI renders the cards locally before any audio exists.

import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const AUDIO_DIR = join(ROOT, "audio");
const MANIFEST_PATH = join(AUDIO_DIR, "manifest.json");
const WORDS_DIR = join(AUDIO_DIR, "words");
const AGE_DIR = join(AUDIO_DIR, "age");
const TIME_DIR = join(AUDIO_DIR, "time");
const FLASHCARDS_PATH = join(AUDIO_DIR, "flashcards.json");
const AGE_MANIFEST_PATH = join(AUDIO_DIR, "age-days-months.json");
const TIME_MANIFEST_PATH = join(AUDIO_DIR, "time-parts.json");

// ---- minimal .env loader (no dependency) ----
(function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
})();

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "C8e2F6Cm3l58PjXaVpUW"; // Asahi (native JP, male)
// Second voice for two-person conversations (defaults to Konoha, native JP female).
const VOICE_A = process.env.ELEVENLABS_VOICE_ID_A || "T7yYq3WpB94yAuOXraRi"; // Aya (female)
const VOICE_B = process.env.ELEVENLABS_VOICE_ID_B || VOICE_ID;               // Ken (male)
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
const FORCE = process.argv.includes("--force");

// Conversation listening set for the こそあど lesson.
// `reply` = what you could say back (text only, no audio).
// `context` = English note on the situation / what a vague word points at.
// `zone` = ko | so | a → draws a small "you / them / over there" distance map.
const PHRASES = [
  {
    kana: "これはなんですか。", romaji: "kore wa nan desu ka.", en: "What is this?",
    context: "They hold something up near themselves and ask you to name it. Refer to THEIR item with それ (sore).",
    reply: { kana: "それは さかなです。", romaji: "sore wa sakana desu.", en: "That is a fish." },
  },
  {
    kana: "それはなんですか。", romaji: "sore wa nan desu ka.", en: "What is that (by you)?",
    context: "They ask about something near YOU. Answer about your own item with これ (kore).",
    reply: { kana: "これは トマトです。", romaji: "kore wa tomato desu.", en: "This is a tomato." },
  },
  {
    kana: "あれはなんですか。", romaji: "are wa nan desu ka.", en: "What is that over there?",
    context: "They ask about something far from both of you. Answer with あれ (are).",
    reply: { kana: "あれは バナナです。", romaji: "are wa banana desu.", en: "That over there is a banana." },
  },
  {
    kana: "これはりんごです。", romaji: "kore wa ringo desu.", en: "This is an apple.", zone: "ko",
    context: "They show you an apple in their hand. これ points at the thing nearest the speaker.",
    reply: { kana: "そうですか。", romaji: "sou desu ka.", en: "Oh, I see." },
  },
  {
    kana: "それはトマトです。", romaji: "sore wa tomato desu.", en: "That is a tomato.", zone: "so",
    context: "Said about the item by you. それ points at the thing nearest the listener (you).",
    reply: { kana: "ありがとうございます。", romaji: "arigatou gozaimasu.", en: "Thank you." },
  },
  {
    kana: "あれはぶどうです。", romaji: "are wa budou desu.", en: "That over there is a grape.", zone: "a",
    context: "Said about something across the room. あれ points at the thing far from both.",
    reply: { kana: "そうですか。", romaji: "sou desu ka.", en: "Oh, I see." },
  },
  {
    kana: "どこですか。", romaji: "doko desu ka.", en: "Where is it?",
    context: "They're asking where something is. Point and answer with a place word.",
    reply: { kana: "あそこです。", romaji: "asoko desu.", en: "It's over there." },
  },
  {
    kana: "ここです。", romaji: "koko desu.", en: "It's here.", zone: "ko",
    context: "here = right where the speaker is standing.",
    reply: { kana: "ありがとうございます。", romaji: "arigatou gozaimasu.", en: "Thank you." },
  },
  {
    kana: "そこです。", romaji: "soko desu.", en: "It's there.", zone: "so",
    context: "there = right where you (the listener) are.",
    reply: { kana: "わかりました。", romaji: "wakarimashita.", en: "Got it." },
  },
  {
    kana: "あそこです。", romaji: "asoko desu.", en: "It's over there.", zone: "a",
    context: "over there = away from both of you.",
    reply: { kana: "ありがとうございます。", romaji: "arigatou gozaimasu.", en: "Thank you." },
  },
  {
    kana: "どれですか。", romaji: "dore desu ka.", en: "Which one is it?",
    context: "They ask which one, of several. Point to your pick with これ / それ / あれ.",
    reply: { kana: "これです。", romaji: "kore desu.", en: "This one." },
  },
  {
    kana: "どのさいふですか。", romaji: "dono saifu desu ka.", en: "Which wallet is it?",
    context: "They ask which wallet. Answer with この / その / あの + the noun.",
    reply: { kana: "この さいふです。", romaji: "kono saifu desu.", en: "This wallet." },
  },
  {
    kana: "どのりんごですか。", romaji: "dono ringo desu ka.", en: "Which apple is it?",
    context: "They ask which apple. Answer with この / その / あの + the noun.",
    reply: { kana: "あの りんごです。", romaji: "ano ringo desu.", en: "That apple over there." },
  },
  {
    kana: "りんごをください。", romaji: "ringo o kudasai.", en: "An apple, please.",
    context: "A customer asks you (the shopkeeper) for an apple.",
    reply: { kana: "はい、どうぞ。", romaji: "hai, douzo.", en: "Sure, here you go." },
  },
  {
    kana: "これをください。", romaji: "kore o kudasai.", en: "This one, please.", zone: "ko",
    context: "Customer points at the item near themselves: 'this one, please.'",
    reply: { kana: "はい、どうぞ。", romaji: "hai, douzo.", en: "Sure, here you go." },
  },
  {
    kana: "おねがいします。", romaji: "onegaishimasu.", en: "Please. (polite)",
    context: "A polite 'please' that closes off a request.",
    reply: { kana: "かしこまりました。", romaji: "kashikomarimashita.", en: "Certainly." },
  },
];

// Catch-all vocab for the FLASHCARDS review page (from the lesson slides).
const WORDS = [
  // demonstratives
  { kana: "これ", romaji: "kore", en: "this one", group: "kosoado" },
  { kana: "それ", romaji: "sore", en: "that one (by you)", group: "kosoado" },
  { kana: "あれ", romaji: "are", en: "that one over there", group: "kosoado" },
  { kana: "この", romaji: "kono", en: "this ___", group: "kosoado" },
  { kana: "その", romaji: "sono", en: "that ___ (by you)", group: "kosoado" },
  { kana: "あの", romaji: "ano", en: "that ___ over there", group: "kosoado" },
  { kana: "ここ", romaji: "koko", en: "here", group: "kosoado" },
  { kana: "そこ", romaji: "soko", en: "there (by you)", group: "kosoado" },
  { kana: "あそこ", romaji: "asoko", en: "over there", group: "kosoado" },
  { kana: "どこ", romaji: "doko", en: "where", group: "kosoado" },
  // food
  { kana: "たべもの", romaji: "tabemono", en: "food", group: "food" },
  { kana: "パン", romaji: "pan", en: "bread", group: "food" },
  { kana: "こめ", romaji: "kome", en: "rice (uncooked)", group: "food" },
  { kana: "たまご", romaji: "tamago", en: "egg", group: "food" },
  { kana: "にく", romaji: "niku", en: "meat", group: "food" },
  { kana: "ぶたにく", romaji: "butaniku", en: "pork", group: "food" },
  { kana: "とりにく", romaji: "toriniku", en: "chicken", group: "food" },
  { kana: "ぎゅうにく", romaji: "gyuuniku", en: "beef", group: "food" },
  { kana: "さかな", romaji: "sakana", en: "fish", group: "food" },
  { kana: "やさい", romaji: "yasai", en: "vegetable", group: "food" },
  // vegetables & seasonings
  { kana: "レタス", romaji: "retasu", en: "lettuce", group: "vegetable" },
  { kana: "たまねぎ", romaji: "tamanegi", en: "onion", group: "vegetable" },
  { kana: "ガーリック", romaji: "gaarikku", en: "garlic", group: "vegetable" },
  { kana: "こしょう", romaji: "koshou", en: "pepper", group: "vegetable" },
  { kana: "にんじん", romaji: "ninjin", en: "carrot", group: "vegetable" },
  { kana: "トマト", romaji: "tomato", en: "tomato", group: "vegetable" },
  // fruit
  { kana: "くだもの", romaji: "kudamono", en: "fruit", group: "fruit" },
  { kana: "りんご", romaji: "ringo", en: "apple", group: "fruit" },
  { kana: "バナナ", romaji: "banana", en: "banana", group: "fruit" },
  { kana: "すいか", romaji: "suika", en: "watermelon", group: "fruit" },
  { kana: "いちご", romaji: "ichigo", en: "strawberry", group: "fruit" },
  { kana: "ぶどう", romaji: "budou", en: "grape", group: "fruit" },
  // drinks & sweeteners
  { kana: "のみもの", romaji: "nomimono", en: "drink", group: "drink" },
  { kana: "ぎゅうにゅう", romaji: "gyuunyuu", en: "milk", group: "drink" },
  { kana: "おちゃ", romaji: "ocha", en: "tea", group: "drink" },
  { kana: "さとう", romaji: "satou", en: "sugar", group: "drink" },
  { kana: "はちみつ", romaji: "hachimitsu", en: "honey", group: "drink" },
];

// ---- Lesson 5: age, days of the week, dates & months ----
// Listening drill: a native voice says it, the learner guesses, then taps to reveal.
const L5_LISTEN = [
  { kana: "なんさいですか。", romaji: "nan sai desu ka.", en: "How old are you?" },
  { kana: "はたちです。", romaji: "hatachi desu.", en: "I'm 20 years old." },
  { kana: "じゅっさいです。", romaji: "jussai desu.", en: "I'm 10 years old." },
  { kana: "きょうはなんようびですか。", romaji: "kyou wa nan youbi desu ka.", en: "What day of the week is it today?" },
  { kana: "げつようびです。", romaji: "getsu youbi desu.", en: "It's Monday." },
  { kana: "きんようびです。", romaji: "kin youbi desu.", en: "It's Friday." },
  { kana: "しがつです。", romaji: "shi gatsu desu.", en: "It's April." },
  { kana: "くがつです。", romaji: "ku gatsu desu.", en: "It's September." },
  { kana: "ついたちです。", romaji: "tsuitachi desu.", en: "It's the 1st." },
  { kana: "はつかです。", romaji: "hatsuka desu.", en: "It's the 20th." },
  { kana: "おたんじょうびはいつですか。", romaji: "o-tanjoubi wa itsu desu ka.", en: "When is your birthday?" },
  { kana: "しがつついたちです。", romaji: "shi gatsu tsuitachi desu.", en: "April 1st." },
];

// Two-person conversation. speaker a = Aya (female), b = Ken (male).
const L5_CONVO = [
  { speaker: "a", kana: "すみません、きょうはなんようびですか。", romaji: "sumimasen, kyou wa nan youbi desu ka.", en: "Excuse me, what day of the week is it today?" },
  { speaker: "b", kana: "きょうはきんようびです。", romaji: "kyou wa kin youbi desu.", en: "Today is Friday." },
  { speaker: "a", kana: "ありがとう。おたんじょうびはいつですか。", romaji: "arigatou. o-tanjoubi wa itsu desu ka.", en: "Thanks. When is your birthday?" },
  { speaker: "b", kana: "しがつついたちです。", romaji: "shi gatsu tsuitachi desu.", en: "April 1st." },
  { speaker: "a", kana: "おいくつですか。", romaji: "o-ikutsu desu ka.", en: "How old are you?" },
  { speaker: "b", kana: "はたちです。あやさんはなんさいですか。", romaji: "hatachi desu. aya-san wa nan sai desu ka.", en: "I'm 20. Aya, how old are you?" },
  { speaker: "a", kana: "わたしはじゅうきゅうさいです。", romaji: "watashi wa juukyuu sai desu.", en: "I'm 19." },
];

// ---- Time-telling component clips for the games page ----
// The game plays a random time as a sequence of these clips (gozen/gogo +
// hour + minute + desu), so any time 1:00–12:59 is covered by ~35 files.
// romaji values MUST match the slugs the games page computes.
const TIME_PARTS = [
  { kana: "ごぜん", romaji: "gozen" },
  { kana: "ごご", romaji: "gogo" },
  { kana: "です", romaji: "desu" },
  { kana: "はん", romaji: "han" },
  // hours (number + じ)
  { kana: "いちじ", romaji: "ichi ji" }, { kana: "にじ", romaji: "ni ji" },
  { kana: "さんじ", romaji: "san ji" }, { kana: "よじ", romaji: "yo ji" },
  { kana: "ごじ", romaji: "go ji" }, { kana: "ろくじ", romaji: "roku ji" },
  { kana: "しちじ", romaji: "shichi ji" }, { kana: "はちじ", romaji: "hachi ji" },
  { kana: "くじ", romaji: "ku ji" }, { kana: "じゅうじ", romaji: "juu ji" },
  { kana: "じゅういちじ", romaji: "juuichi ji" }, { kana: "じゅうにじ", romaji: "juuni ji" },
  // minute ones (1–9)
  { kana: "いっぷん", romaji: "ippun" }, { kana: "にふん", romaji: "nifun" },
  { kana: "さんぷん", romaji: "sanpun" }, { kana: "よんぷん", romaji: "yonpun" },
  { kana: "ごふん", romaji: "gofun" }, { kana: "ろっぷん", romaji: "roppun" },
  { kana: "ななふん", romaji: "nanafun" }, { kana: "はっぷん", romaji: "happun" },
  { kana: "きゅうふん", romaji: "kyuufun" },
  // minute exact tens (10,20,40,50 — 30 uses はん)
  { kana: "じゅっぷん", romaji: "juppun" }, { kana: "にじゅっぷん", romaji: "nijuppun" },
  { kana: "さんじゅっぷん", romaji: "sanjuppun" }, { kana: "よんじゅっぷん", romaji: "yonjuppun" },
  { kana: "ごじゅっぷん", romaji: "gojuppun" },
  // minute tens prefix for compounds (e.g. 25 = にじゅう + ごふん)
  { kana: "じゅう", romaji: "juu" }, { kana: "にじゅう", romaji: "nijuu" },
  { kana: "さんじゅう", romaji: "sanjuu" }, { kana: "よんじゅう", romaji: "yonjuu" },
  { kana: "ごじゅう", romaji: "gojuu" },
];

function slug(romaji) {
  return romaji.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function withMeta(items, audioPrefix, voice) {
  return items.map((p) => ({ ...p, id: slug(p.romaji), audio: `${audioPrefix}/${slug(p.romaji)}.mp3`, voice: voice || VOICE_ID }));
}

const phrases = withMeta(PHRASES, "audio");
const words = withMeta(WORDS, "audio/words");
const timeParts = withMeta(TIME_PARTS, "audio/time", VOICE_B);
const l5Listen = withMeta(L5_LISTEN, "audio/age", VOICE_B);
const l5Convo = L5_CONVO.map((p, i) => ({
  ...p,
  id: `c${i + 1}-${slug(p.romaji)}`,
  audio: `audio/age/c${i + 1}-${slug(p.romaji)}.mp3`,
  voice: p.speaker === "a" ? VOICE_A : VOICE_B,
}));

// Write each manifest twice: a .json (for http/https fetch) and a .js companion
// that assigns a global, so pages also work when opened directly via file://
// (where fetch() of local files is blocked by the browser).
function writeManifestFile(jsonPath, globalName, manifest) {
  const json = JSON.stringify(manifest, null, 2) + "\n";
  writeFileSync(jsonPath, json);
  const jsPath = jsonPath.replace(/\.json$/, ".js");
  writeFileSync(jsPath, `window.${globalName} = ${json}`);
}

function writeManifest(path, key, items, hasAudio, globalName) {
  const manifest = {
    generatedAt: hasAudio ? new Date().toISOString() : null,
    voiceId: VOICE_ID,
    model: MODEL,
    hasAudio,
  };
  manifest[key] = items;
  writeManifestFile(path, globalName, manifest);
}

function writeTimeManifest(path, parts, hasAudio) {
  writeManifestFile(path, "JL_TIME", {
    generatedAt: hasAudio ? new Date().toISOString() : null,
    voice: VOICE_B,
    model: MODEL,
    hasAudio,
    parts,
  });
}

function writeAgeManifest(path, listen, convo, hasAudio) {
  writeManifestFile(path, "JL_AGE", {
    generatedAt: hasAudio ? new Date().toISOString() : null,
    voiceA: VOICE_A,
    voiceB: VOICE_B,
    model: MODEL,
    hasAudio,
    listen,
    convo,
  });
}

async function generateSet(client, label, items) {
  let made = 0;
  let skipped = 0;
  console.log(`\n[${label}]`);
  for (const p of items) {
    const outPath = join(ROOT, p.audio);
    mkdirSync(dirname(outPath), { recursive: true });
    if (!FORCE && existsSync(outPath)) {
      skipped++;
      continue;
    }
    process.stdout.write(`  ${p.romaji} … `);
    const audio = await client.textToSpeech.convert(p.voice || VOICE_ID, {
      text: p.kana,
      modelId: MODEL,
      outputFormat: OUTPUT_FORMAT,
    });
    const nodeStream = typeof audio.pipe === "function" ? audio : Readable.fromWeb(audio);
    await pipeline(nodeStream, createWriteStream(outPath));
    made++;
    console.log("ok");
  }
  console.log(`  generated ${made}, skipped ${skipped}`);
}

async function main() {
  mkdirSync(AUDIO_DIR, { recursive: true });
  mkdirSync(WORDS_DIR, { recursive: true });
  mkdirSync(AGE_DIR, { recursive: true });
  mkdirSync(TIME_DIR, { recursive: true });

  if (!API_KEY) {
    writeManifest(MANIFEST_PATH, "phrases", phrases, false, "JL_LISTENING");
    writeManifest(FLASHCARDS_PATH, "words", words, false, "JL_FLASHCARDS");
    writeAgeManifest(AGE_MANIFEST_PATH, l5Listen, l5Convo, false);
    writeTimeManifest(TIME_MANIFEST_PATH, timeParts, false);
    console.log("No ELEVENLABS_API_KEY found.");
    console.log(`Wrote ${phrases.length} phrases + ${words.length} words + ${l5Listen.length} listen / ${l5Convo.length} convo + ${timeParts.length} time parts (hasAudio: false).`);
    console.log("The web UI will render the cards; add a key and re-run to enable playback.");
    return;
  }

  const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
  const client = new ElevenLabsClient({ apiKey: API_KEY });

  console.log(`Voice: ${VOICE_ID}  A: ${VOICE_A}  B: ${VOICE_B}  Model: ${MODEL}  Format: ${OUTPUT_FORMAT}`);
  await generateSet(client, "listening", phrases);
  await generateSet(client, "flashcards", words);
  await generateSet(client, "age:listen", l5Listen);
  await generateSet(client, "age:convo", l5Convo);
  await generateSet(client, "time:parts", timeParts);

  writeManifest(MANIFEST_PATH, "phrases", phrases, true, "JL_LISTENING");
  writeManifest(FLASHCARDS_PATH, "words", words, true, "JL_FLASHCARDS");
  writeAgeManifest(AGE_MANIFEST_PATH, l5Listen, l5Convo, true);
  writeTimeManifest(TIME_MANIFEST_PATH, timeParts, true);
  console.log("\nDone. Manifests: audio/manifest.json, audio/flashcards.json, audio/age-days-months.json, audio/time-parts.json");
}

main().catch((err) => {
  console.error("\nAudio generation failed:");
  console.error(err?.message || err);
  process.exit(1);
});
