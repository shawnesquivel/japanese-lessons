// Genki I Lesson 1 — Review Exercises (まとめのれんしゅう) Q&A prompts.
// Extensible shape (separate from vocab flashcards):
//
//   GENKI_QA.decks[]
//     .prompts[]               one textbook/self-intro question
//       .ask                   the question itself (jp / rj / en)
//       .answer.formal         what YOU say (polite です／ます)
//       .answer.note           optional English nuance
//       .drills                which card types to generate (default both):
//                                "answer" = see JP question → produce your reply
//                                "ask"    = see EN meaning → produce the JP question
//
// Add more prompts (or whole decks) without changing the player — just append data.
window.GENKI_QA = {
  version: 1,
  decks: [
    {
      id: "genki-l1-review-a",
      lesson: 1,
      title: "Review A · Ask & answer",
      source: "Genki I Lesson 1, VII まとめのれんしゅう A",
      prompts: [
        {
          id: "name",
          ask: {
            jp: "おなまえは？",
            rj: "onamae wa?",
            en: "What is your name?"
          },
          answer: {
            formal: {
              jp: "ショーンです。",
              rj: "Shoon desu.",
              en: "I'm Shawn."
            }
          },
          drills: ["answer", "ask"]
        },
        {
          id: "from",
          ask: {
            jp: "どこからきましたか。",
            rj: "doko kara kimashita ka.",
            en: "Where do you come from?"
          },
          answer: {
            formal: {
              jp: "カナダのバンクーバーからきました。フィリピンじんです。",
              rj: "Kanada no Bankuubaa kara kimashita. Firipin-jin desu.",
              en: "I'm from Vancouver, Canada. I'm Filipino."
            },
            note: "Polite past きました + です. Hometown + heritage in one reply."
          },
          drills: ["answer", "ask"]
        },
        {
          id: "job",
          ask: {
            jp: "しごとはなんですか。",
            rj: "shigoto wa nan desu ka.",
            en: "What is your occupation?"
          },
          answer: {
            formal: {
              jp: "ソフトウェアエンジニアとユーチューバーです。",
              rj: "sofutowea enjinia to yuuchuubaa desu.",
              en: "I'm a software engineer and a YouTuber."
            }
          },
          drills: ["answer", "ask"]
        },
        {
          id: "year",
          ask: {
            jp: "なんねんせいですか。",
            rj: "nannensee desu ka.",
            en: "What year are you in (school)?"
          },
          answer: {
            formal: {
              jp: "がくせいじゃないです。",
              rj: "gakusee ja nai desu.",
              en: "I'm not a student."
            },
            note: "More formal: がくせいではありません。 Skip ～ねんせい if you're not in school."
          },
          drills: ["answer", "ask"]
        },
        {
          id: "age",
          ask: {
            jp: "なんさいですか。",
            rj: "nansai desu ka.",
            en: "How old are you?"
          },
          answer: {
            formal: {
              jp: "にじゅうきゅうさいです。",
              rj: "nijuukyuu-sai desu.",
              en: "I'm 29."
            }
          },
          drills: ["answer", "ask"]
        },
        {
          id: "major",
          ask: {
            jp: "せんもんはなんですか。",
            rj: "senmon wa nan desu ka.",
            en: "What is your major?"
          },
          answer: {
            formal: {
              jp: "せんもんはかがくこうがくです。だいがくはブリティッシュコロンビアだいがくです。",
              rj: "senmon wa kagaku kougaku desu. daigaku wa Buritisshu Koronbia daigaku desu.",
              en: "My major is chemical engineering. My university is UBC (University of British Columbia)."
            },
            note: "Lesson-1 style です replies. You can shorten to just the major."
          },
          drills: ["answer", "ask"]
        }
      ]
    }
  ]
};
