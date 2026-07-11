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
const PARTICLES_DIR = join(AUDIO_DIR, "particles");
const PARTICLE_WORDS_DIR = join(PARTICLES_DIR, "words");
const FLASHCARDS_PATH = join(AUDIO_DIR, "flashcards.json");
const AGE_MANIFEST_PATH = join(AUDIO_DIR, "age-days-months.json");
const TIME_MANIFEST_PATH = join(AUDIO_DIR, "time-parts.json");
const PARTICLES_MANIFEST_PATH = join(AUDIO_DIR, "particles.json");

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
  // locations
  { kana: "ジム", romaji: "jimu", en: "gym", group: "locations" },
  { kana: "かいしゃ", romaji: "kaisha", en: "office / work", group: "locations" },
  { kana: "こうえん", romaji: "kouen", en: "park", group: "locations" },
  { kana: "レストラン", romaji: "resutoran", en: "restaurant", group: "locations" },
  { kana: "いえ", romaji: "ie", en: "home", group: "locations" },
  { kana: "えいがかん", romaji: "eigakan", en: "movie theater", group: "locations" },
  { kana: "スーパー", romaji: "suupaa", en: "grocery store", group: "locations" },
  // particles lesson: markers and single-word vocabulary
  { kana: "は", romaji: "wa", en: "topic marker", group: "particles" },
  { kana: "が", romaji: "ga", en: "subject marker", group: "particles" },
  { kana: "を", romaji: "o", en: "object marker", group: "particles" },
  { kana: "も", romaji: "mo", en: "also / too", group: "particles" },
  { kana: "で", romaji: "de", en: "at / by means of", group: "particles" },
  { kana: "と", romaji: "to", en: "and / with", group: "particles" },
  { kana: "わたし", romaji: "watashi", en: "I / me", group: "particles", audio: "audio/particles/words/watashi.mp3" },
  { kana: "ひと", romaji: "hito", en: "person", group: "particles", audio: "audio/particles/words/hito.mp3" },
  { kana: "ともだち", romaji: "tomodachi", en: "friend", group: "particles", audio: "audio/particles/words/tomodachi.mp3" },
  { kana: "こんやくしゃ", romaji: "kon-yakusha", en: "fiancée", group: "particles", audio: "audio/particles/words/kon-yakusha.mp3" },
  { kana: "かぞく", romaji: "kazoku", en: "family", group: "particles", audio: "audio/particles/words/kazoku.mp3" },
  { kana: "にほんご", romaji: "nihongo", en: "Japanese language", group: "particles", audio: "audio/particles/words/nihongo.mp3" },
  { kana: "しごと", romaji: "shigoto", en: "work / job", group: "particles", audio: "audio/particles/words/shigoto.mp3" },
  { kana: "パソコン", romaji: "pasokon", en: "computer", group: "particles", audio: "audio/particles/words/pasokon.mp3" },
  { kana: "コーヒー", romaji: "koohii", en: "coffee", group: "particles", audio: "audio/particles/words/koohii.mp3" },
  { kana: "バスケットボール", romaji: "basuketto-booru", en: "basketball", group: "particles", audio: "audio/particles/words/basuketto-booru.mp3" },
  { kana: "ウェイトトレーニング", romaji: "ueito-toreeningu", en: "weight training", group: "particles", audio: "audio/particles/words/ueito-toreeningu.mp3" },
  { kana: "サンフランシスコ", romaji: "san-furanshisuko", en: "San Francisco", group: "particles" },
  { kana: "にほん", romaji: "nihon", en: "Japan", group: "particles" },
  { kana: "タイ", romaji: "tai", en: "Thailand", group: "particles", audio: "audio/particles/words/tai.mp3" },
  { kana: "インドネシア", romaji: "indoneshia", en: "Indonesia", group: "particles", audio: "audio/particles/words/indoneshia.mp3" },
  { kana: "バス", romaji: "basu", en: "bus", group: "particles", audio: "audio/particles/words/basu.mp3" },
  { kana: "だれ", romaji: "dare", en: "who", group: "particles", audio: "audio/particles/words/dare.mp3" },
  { kana: "なに", romaji: "nani", en: "what", group: "particles", audio: "audio/particles/words/nani.mp3" },
  { kana: "いま", romaji: "ima", en: "now", group: "particles", audio: "audio/particles/words/ima.mp3" },
  { kana: "ちかく", romaji: "chikaku", en: "nearby", group: "particles", audio: "audio/particles/words/chikaku.mp3" },
  { kana: "いっしょに", romaji: "isshoni", en: "together", group: "particles" },
  { kana: "すき", romaji: "suki", en: "liked / favorite", group: "particles", audio: "audio/particles/words/suki.mp3" },
  // verb forms used by the particles and locations lessons
  { kana: "いく", romaji: "iku", en: "to go · casual", group: "verbs" },
  { kana: "いきます", romaji: "ikimasu", en: "to go · formal", group: "verbs" },
  { kana: "いきました", romaji: "ikimashita", en: "went · formal", group: "verbs" },
  { kana: "いった", romaji: "itta", en: "went · casual", group: "verbs" },
  { kana: "いきましょう", romaji: "ikimashou", en: "let's go · formal", group: "verbs" },
  { kana: "いこう", romaji: "ikou", en: "let's go · casual", group: "verbs" },
  { kana: "いきませんか", romaji: "ikimasen-ka", en: "want to go? · formal", group: "verbs" },
  { kana: "いかない", romaji: "ikanai", en: "not go / wanna go? · casual", group: "verbs" },
  { kana: "いる", romaji: "iru", en: "to be / exist (living) · casual", group: "verbs" },
  { kana: "います", romaji: "imasu", en: "to be / exist (living) · formal", group: "verbs" },
  { kana: "ある", romaji: "aru", en: "to exist (not living) · casual", group: "verbs" },
  { kana: "あります", romaji: "arimasu", en: "to exist (not living) · formal", group: "verbs" },
  { kana: "する", romaji: "suru", en: "to do · casual", group: "verbs" },
  { kana: "します", romaji: "shimasu", en: "to do · formal", group: "verbs" },
  { kana: "している", romaji: "shite-iru", en: "doing · casual", group: "verbs" },
  { kana: "しています", romaji: "shite-imasu", en: "doing · formal", group: "verbs" },
  { kana: "べんきょうする", romaji: "benkyou-suru", en: "to study · casual", group: "verbs" },
  { kana: "べんきょうします", romaji: "benkyou-shimasu", en: "to study · formal", group: "verbs" },
  { kana: "べんきょうしている", romaji: "benkyou-shite-iru", en: "studying · casual", group: "verbs" },
  { kana: "べんきょうしてる", romaji: "benkyou-shiteru", en: "studying · spoken casual", group: "verbs" },
  { kana: "べんきょうしています", romaji: "benkyou-shite-imasu", en: "studying · formal", group: "verbs" },
  { kana: "はたらく", romaji: "hataraku", en: "to work · casual", group: "verbs" },
  { kana: "はたらいている", romaji: "hataraite-iru", en: "working · casual", group: "verbs" },
  { kana: "はたらいてる", romaji: "hataraiteru", en: "working · spoken casual", group: "verbs" },
  { kana: "はたらいています", romaji: "hataraite-imasu", en: "working · formal", group: "verbs" },
  { kana: "のむ", romaji: "nomu", en: "to drink · casual", group: "verbs" },
  { kana: "のみます", romaji: "nomimasu", en: "to drink · formal", group: "verbs" },
  { kana: "のみました", romaji: "nomimashita", en: "drank · formal", group: "verbs" },
  { kana: "のんだ", romaji: "nonda", en: "drank · casual", group: "verbs" },
  { kana: "はなす", romaji: "hanasu", en: "to speak · casual", group: "verbs" },
  { kana: "はなします", romaji: "hanashimasu", en: "to speak · formal", group: "verbs" },
  { kana: "みる", romaji: "miru", en: "to watch / see · casual", group: "verbs" },
  { kana: "みます", romaji: "mimasu", en: "to watch / see · formal", group: "verbs" },
  { kana: "みた", romaji: "mita", en: "watched · casual", group: "verbs" },
  { kana: "みました", romaji: "mimashita", en: "watched · formal", group: "verbs" },
  { kana: "すむ", romaji: "sumu", en: "to live · casual", group: "verbs" },
  { kana: "すんでいる", romaji: "sunde-iru", en: "living · casual", group: "verbs" },
  { kana: "すんでる", romaji: "sunderu", en: "living · spoken casual", group: "verbs" },
  { kana: "すんでいます", romaji: "sunde-imasu", en: "living · formal", group: "verbs" },
  { kana: "すんでいた", romaji: "sunde-ita", en: "lived · casual", group: "verbs" },
  { kana: "すんでた", romaji: "sundeta", en: "lived · spoken casual", group: "verbs" },
  { kana: "すんでいました", romaji: "sunde-imashita", en: "lived · formal", group: "verbs" },
  { kana: "かえる", romaji: "kaeru", en: "to return home · casual", group: "verbs" },
  { kana: "かえります", romaji: "kaerimasu", en: "to return home · formal", group: "verbs" },
  { kana: "かえりました", romaji: "kaerimashita", en: "returned home · formal", group: "verbs" },
  { kana: "かえった", romaji: "kaetta", en: "returned home · casual", group: "verbs" },
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

// Audio-only comprehension for the particles lesson.
// Learners hear the question first, answer its meaning in English, then reveal.
const PARTICLE_QUESTIONS = [
  { kana: "なにがすきですか。", romaji: "nani ga suki desu ka.", en: "What do you like?", answer: "I like basketball and weight training." },
  { kana: "どこにすんでいますか。", romaji: "doko ni sunde imasu ka.", en: "Where do you live?", answer: "I live in San Francisco." },
  { kana: "どこではたらいていますか。", romaji: "doko de hataraite imasu ka.", en: "Where do you work?", answer: "I work at a startup." },
  { kana: "しごとはなんですか。", romaji: "shigoto wa nan desu ka.", en: "What do you do for work?", answer: "I'm a software engineer." },
  { kana: "なにをべんきょうしていますか。", romaji: "nani o benkyou shite imasu ka.", en: "What are you studying?", answer: "I'm studying Japanese." },
  { kana: "どこでウェイトトレーニングをしますか。", romaji: "doko de ueito toreeningu o shimasu ka.", en: "Where do you do weight training?", answer: "I do weight training at the gym." },
  { kana: "だれとにほんにいきますか。", romaji: "dare to nihon ni ikimasu ka.", en: "Who are you going to Japan with?", answer: "I'm going with my fiancée." },
  { kana: "いつにほんにいきますか。", romaji: "itsu nihon ni ikimasu ka.", en: "When are you going to Japan?", answer: "I'm going in September." },
  { kana: "どこにすんでいましたか。", romaji: "doko ni sunde imashita ka.", en: "Where did you live?", answer: "I lived in Thailand and Indonesia." },
  { kana: "なにをのみますか。", romaji: "nani o nomimasu ka.", en: "What do you drink?", answer: "I drink coffee and tea." },
  { kana: "ちかくになにがありますか。", romaji: "chikaku ni nani ga arimasu ka.", en: "What is nearby?", answer: "There is a gym nearby." },
  { kana: "にほんごでだれとはなしたいですか。", romaji: "nihongo de dare to hanashitai desu ka.", en: "Who do you want to speak with in Japanese?", answer: "I want to speak with my fiancée's family." },
];

// Isolated-word listening. The page exposes only the sound until reveal.
const PARTICLE_WORDS = [
  { kana: "わたし", romaji: "watashi", en: "I / me" },
  { kana: "だれ", romaji: "dare", en: "who" },
  { kana: "なに", romaji: "nani", en: "what" },
  { kana: "ひと", romaji: "hito", en: "person" },
  { kana: "ともだち", romaji: "tomodachi", en: "friend" },
  { kana: "こんやくしゃ", romaji: "kon-yakusha", en: "fiancée" },
  { kana: "かぞく", romaji: "kazoku", en: "family" },
  { kana: "にほんご", romaji: "nihongo", en: "Japanese language" },
  { kana: "しごと", romaji: "shigoto", en: "work / job" },
  { kana: "かいしゃ", romaji: "kaisha", en: "company / office" },
  { kana: "ジム", romaji: "jimu", en: "gym" },
  { kana: "こうえん", romaji: "kouen", en: "park" },
  { kana: "いえ", romaji: "ie", en: "home / house" },
  { kana: "バス", romaji: "basu", en: "bus" },
  { kana: "パソコン", romaji: "pasokon", en: "computer" },
  { kana: "コーヒー", romaji: "koohii", en: "coffee" },
  { kana: "おちゃ", romaji: "ocha", en: "tea" },
  { kana: "バスケットボール", romaji: "basuketto-booru", en: "basketball" },
  { kana: "ウェイトトレーニング", romaji: "ueito-toreeningu", en: "weight training" },
  { kana: "すき", romaji: "suki", en: "liked / favorite" },
  { kana: "ちかく", romaji: "chikaku", en: "nearby" },
  { kana: "いま", romaji: "ima", en: "now" },
  { kana: "タイ", romaji: "tai", en: "Thailand" },
  { kana: "インドネシア", romaji: "indoneshia", en: "Indonesia" },
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
  return items.map((p) => ({ ...p, id: slug(p.romaji), audio: p.audio || `${audioPrefix}/${slug(p.romaji)}.mp3`, voice: voice || VOICE_ID }));
}

const phrases = withMeta(PHRASES, "audio");
const words = withMeta(WORDS, "audio/words");
const timeParts = withMeta(TIME_PARTS, "audio/time", VOICE_B);
const l5Listen = withMeta(L5_LISTEN, "audio/age", VOICE_B);
const particleQuestions = withMeta(PARTICLE_QUESTIONS, "audio/particles", VOICE_B);
const particleWords = withMeta(PARTICLE_WORDS, "audio/particles/words", VOICE_B);
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

function writeParticlesManifest(path, questions, words, hasAudio) {
  writeManifestFile(path, "JL_PARTICLES", {
    generatedAt: hasAudio ? new Date().toISOString() : null,
    voice: VOICE_B,
    model: MODEL,
    hasAudio,
    questions,
    words,
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
  mkdirSync(PARTICLES_DIR, { recursive: true });
  mkdirSync(PARTICLE_WORDS_DIR, { recursive: true });

  if (!API_KEY) {
    writeManifest(MANIFEST_PATH, "phrases", phrases, false, "JL_LISTENING");
    writeManifest(FLASHCARDS_PATH, "words", words, false, "JL_FLASHCARDS");
    writeAgeManifest(AGE_MANIFEST_PATH, l5Listen, l5Convo, false);
    writeTimeManifest(TIME_MANIFEST_PATH, timeParts, false);
    writeParticlesManifest(PARTICLES_MANIFEST_PATH, particleQuestions, particleWords, false);
    console.log("No ELEVENLABS_API_KEY found.");
    console.log(`Wrote ${phrases.length} phrases + ${words.length} words + ${l5Listen.length} listen / ${l5Convo.length} convo + ${timeParts.length} time parts + ${particleQuestions.length} particle questions / ${particleWords.length} particle words (hasAudio: false).`);
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
  await generateSet(client, "particles:questions", particleQuestions);
  await generateSet(client, "particles:words", particleWords);

  writeManifest(MANIFEST_PATH, "phrases", phrases, true, "JL_LISTENING");
  writeManifest(FLASHCARDS_PATH, "words", words, true, "JL_FLASHCARDS");
  writeAgeManifest(AGE_MANIFEST_PATH, l5Listen, l5Convo, true);
  writeTimeManifest(TIME_MANIFEST_PATH, timeParts, true);
  writeParticlesManifest(PARTICLES_MANIFEST_PATH, particleQuestions, particleWords, true);
  console.log("\nDone. Manifests: audio/manifest.json, audio/flashcards.json, audio/age-days-months.json, audio/time-parts.json, audio/particles.json");
}

main().catch((err) => {
  console.error("\nAudio generation failed:");
  console.error(err?.message || err);
  process.exit(1);
});
