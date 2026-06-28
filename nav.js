// Shared lessons hamburger menu. Include on every page with:
//   <script src="nav.js" defer></script>
// It injects its own styles, a fixed hamburger button, an overlay and a drawer,
// and marks the current page automatically.
(function () {
  var LINKS = [
    { href: "index.html", jp: "こそあど", en: "this · that · which" },
    { href: "time.html", jp: "じかん", en: "telling time" },
    { href: "age-days-months.html", jp: "さい・ようび", en: "age, days & months" },
    { href: "flashcards.html", jp: "フラッシュ", en: "flashcards deck" },
    { href: "games.html", jp: "ゲーム", en: "games" },
  ];

  var current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (current === "") current = "index.html";

  var css =
    ".menu-btn{position:fixed;top:16px;left:16px;z-index:30;width:46px;height:46px;border-radius:12px;" +
    "border:1px solid var(--line-strong,#D6CDB6);background:#fff;cursor:pointer;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;gap:5px;box-shadow:0 2px 8px rgba(42,46,36,.08);transition:background .12s}" +
    ".menu-btn:hover{background:#F3EEE1}" +
    ".menu-btn:focus-visible{outline:3px solid var(--so,#E0962C);outline-offset:2px}" +
    ".menu-btn span{display:block;width:22px;height:2px;background:var(--ink,#2A2E24);border-radius:2px;transition:transform .2s,opacity .2s}" +
    "body.menu-open .menu-btn span:nth-child(1){transform:translateY(7px) rotate(45deg)}" +
    "body.menu-open .menu-btn span:nth-child(2){opacity:0}" +
    "body.menu-open .menu-btn span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}" +
    ".menu-overlay{position:fixed;inset:0;background:rgba(42,46,36,.4);opacity:0;visibility:hidden;transition:opacity .2s,visibility .2s;z-index:25}" +
    "body.menu-open .menu-overlay{opacity:1;visibility:visible}" +
    ".menu-drawer{position:fixed;top:0;left:0;height:100%;width:280px;max-width:84vw;background:var(--paper,#FBF8F1);" +
    "border-right:2px solid var(--ink,#2A2E24);box-shadow:4px 0 20px rgba(42,46,36,.12);z-index:26;" +
    "transform:translateX(-100%);transition:transform .24s ease;padding:74px 0 24px;overflow-y:auto}" +
    "body.menu-open .menu-drawer{transform:translateX(0)}" +
    ".menu-drawer .menu-title{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft,#5C6150);font-weight:700;padding:0 22px 10px;margin:0}" +
    ".menu-drawer a{display:flex;align-items:baseline;gap:10px;padding:13px 22px;text-decoration:none;color:var(--ink,#2A2E24);border-top:1px solid var(--line,#E6DFCF);transition:background .12s}" +
    ".menu-drawer a:hover{background:#F3EEE1}" +
    ".menu-drawer a:last-of-type{border-bottom:1px solid var(--line,#E6DFCF)}" +
    ".menu-drawer a.current{background:#F3EEE1;font-weight:700;cursor:default}" +
    ".menu-drawer a .jp-label{font-family:'Zen Antique',serif;font-size:19px}" +
    ".menu-drawer a .en-label{color:var(--ink-soft,#5C6150);font-size:13px}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.className = "menu-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Open lessons menu");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = "<span></span><span></span><span></span>";

  var overlay = document.createElement("div");
  overlay.className = "menu-overlay";

  var drawer = document.createElement("nav");
  drawer.className = "menu-drawer";
  drawer.setAttribute("aria-label", "Lessons");
  drawer.innerHTML =
    '<p class="menu-title">Lessons</p>' +
    LINKS.map(function (l) {
      var cur = l.href.toLowerCase() === current ? ' class="current"' : "";
      return (
        '<a href="' + l.href + '"' + cur + ">" +
        '<span class="jp-label">' + l.jp + "</span>" +
        '<span class="en-label">' + l.en + "</span></a>"
      );
    }).join("");

  function mount() {
    document.body.appendChild(btn);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    function close() {
      document.body.classList.remove("menu-open");
      btn.setAttribute("aria-expanded", "false");
    }
    function open() {
      document.body.classList.add("menu-open");
      btn.setAttribute("aria-expanded", "true");
    }
    btn.addEventListener("click", function () {
      document.body.classList.contains("menu-open") ? close() : open();
    });
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
