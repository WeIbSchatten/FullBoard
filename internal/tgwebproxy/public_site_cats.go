package tgwebproxy

// CatsPublicSiteHTML is the second built-in landing: a self-contained
// "maintenance" page where cats repair the connection (no external assets).
const CatsPublicSiteHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connection maintenance</title>
<style>
  :root {
    --bg: #fff8ef;
    --ink: #2b2118;
    --muted: #7a6a5b;
    --card: #ffffff;
    --line: #f0e2cf;
    --accent: #ff8a3d;
    --accent-2: #2bb3a3;
    --fur-a: #f2a65a;
    --fur-b: #5b5b66;
    --fur-c: #efe6da;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #17140f;
      --ink: #f6eee4;
      --muted: #b3a493;
      --card: #211c16;
      --line: #342b22;
    }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    font-family: ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, sans-serif;
    background:
      radial-gradient(900px 500px at 15% -10%, rgba(255, 138, 61, 0.18), transparent 60%),
      radial-gradient(800px 500px at 100% 0%, rgba(43, 179, 163, 0.14), transparent 55%),
      var(--bg);
    color: var(--ink);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    place-items: center;
    padding: 24px 16px;
  }
  main { width: 100%; max-width: 760px; text-align: center; }
  .badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px; border-radius: 999px;
    background: var(--card); border: 1px solid var(--line);
    font-size: 13px; font-weight: 600; color: var(--muted);
  }
  .badge i {
    width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
    animation: blink 1.2s ease-in-out infinite;
  }
  h1 { font-size: clamp(28px, 5vw, 44px); line-height: 1.1; margin: 18px 0 10px; letter-spacing: -0.02em; }
  p.lead { margin: 0 auto; max-width: 520px; color: var(--muted); font-size: 17px; line-height: 1.55; }
  .scene {
    position: relative; margin: 28px auto 18px; max-width: 640px;
    background: var(--card); border: 1px solid var(--line); border-radius: 28px;
    padding: 18px 12px 8px; box-shadow: 0 20px 60px rgba(60, 35, 10, 0.08);
  }
  svg { width: 100%; height: auto; display: block; }
  .tail-a { transform-origin: 112px 196px; animation: wag 1.1s ease-in-out infinite; }
  .tail-b { transform-origin: 282px 226px; animation: wag 1.6s ease-in-out infinite reverse; }
  .tail-c { transform-origin: 492px 196px; animation: wag 0.9s ease-in-out infinite; }
  .wrench { transform-origin: 176px 150px; animation: twist 0.8s ease-in-out infinite; }
  .yarn { transform-origin: 360px 226px; animation: roll 3s linear infinite; }
  .spark { animation: spark 0.9s steps(2) infinite; }
  .led { animation: blink 0.7s steps(2) infinite; }
  .led.l2 { animation-delay: 0.2s; }
  .led.l3 { animation-delay: 0.4s; }
  .eye { animation: look 4s ease-in-out infinite; }
  .progress {
    margin: 6px auto 0; max-width: 420px; height: 10px; border-radius: 999px;
    background: var(--line); overflow: hidden;
  }
  .progress b {
    display: block; height: 100%; width: 30%; border-radius: inherit;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    animation: load 6s ease-in-out infinite;
  }
  .status { margin-top: 12px; min-height: 22px; font-size: 14px; color: var(--muted); }
  .status strong { color: var(--ink); }
  ul.crew {
    list-style: none; padding: 0; margin: 26px auto 0; display: grid; gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); max-width: 640px; text-align: left;
  }
  ul.crew li {
    background: var(--card); border: 1px solid var(--line); border-radius: 16px;
    padding: 12px 14px; font-size: 14px; line-height: 1.4;
  }
  ul.crew li b { display: block; font-size: 15px; margin-bottom: 2px; }
  ul.crew li span { color: var(--muted); }
  footer { margin-top: 26px; font-size: 12px; color: var(--muted); }
  @keyframes wag { 0%, 100% { transform: rotate(-12deg); } 50% { transform: rotate(14deg); } }
  @keyframes twist { 0%, 100% { transform: rotate(-18deg); } 50% { transform: rotate(16deg); } }
  @keyframes roll { to { transform: rotate(360deg); } }
  @keyframes blink { 50% { opacity: 0.25; } }
  @keyframes spark { 50% { opacity: 0; } }
  @keyframes look { 0%, 40%, 100% { transform: translateX(0); } 50%, 80% { transform: translateX(2px); } }
  @keyframes load { 0% { width: 8%; } 60% { width: 86%; } 75% { width: 91%; } 100% { width: 8%; } }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; }
  }
</style>
</head>
<body>
<main>
  <span class="badge"><i></i><span data-t="badge">Scheduled maintenance</span></span>
  <h1 data-t="title">Our cats are fixing the connection</h1>
  <p class="lead" data-t="lead">Someone chewed through a cable again. The repair crew is on it — please check back in a few minutes.</p>

  <div class="scene" aria-hidden="true">
    <svg viewBox="0 0 600 280" role="img">
      <!-- floor -->
      <ellipse cx="300" cy="252" rx="270" ry="14" fill="currentColor" opacity="0.06"/>
      <!-- server rack -->
      <g transform="translate(250 70)">
        <rect width="100" height="150" rx="10" fill="#3b3f4a"/>
        <rect x="10" y="14" width="80" height="22" rx="4" fill="#4d5260"/>
        <rect x="10" y="44" width="80" height="22" rx="4" fill="#4d5260"/>
        <rect x="10" y="74" width="80" height="22" rx="4" fill="#4d5260"/>
        <circle class="led" cx="78" cy="25" r="3.5" fill="#2bd67b"/>
        <circle class="led l2" cx="78" cy="55" r="3.5" fill="#ffb02e"/>
        <circle class="led l3" cx="78" cy="85" r="3.5" fill="#ff5a5a"/>
        <rect x="18" y="112" width="64" height="6" rx="3" fill="#5f6573"/>
        <rect x="18" y="124" width="44" height="6" rx="3" fill="#5f6573"/>
      </g>
      <!-- tangled cable -->
      <path d="M350 200 C 390 150, 430 250, 470 190 S 540 170, 560 228" fill="none" stroke="#2bb3a3" stroke-width="6" stroke-linecap="round"/>
      <path d="M250 196 C 210 240, 170 180, 120 236" fill="none" stroke="#ff8a3d" stroke-width="6" stroke-linecap="round"/>
      <g class="spark" transform="translate(242 188)">
        <path d="M0 -14 L4 -4 L14 -6 L6 2 L10 12 L0 6 L-10 12 L-6 2 L-14 -6 L-4 -4 Z" fill="#ffd23f"/>
      </g>

      <!-- cat A: ginger mechanic with wrench -->
      <g>
        <path class="tail-a" d="M112 196 C 70 190, 60 150, 84 132" fill="none" stroke="var(--fur-a)" stroke-width="12" stroke-linecap="round"/>
        <ellipse cx="140" cy="206" rx="46" ry="34" fill="var(--fur-a)"/>
        <circle cx="168" cy="160" r="30" fill="var(--fur-a)"/>
        <path d="M146 140 L150 112 L166 134 Z" fill="var(--fur-a)"/>
        <path d="M178 134 L192 112 L192 142 Z" fill="var(--fur-a)"/>
        <g class="eye"><circle cx="160" cy="158" r="3.6" fill="#2b2118"/><circle cx="178" cy="158" r="3.6" fill="#2b2118"/></g>
        <path d="M165 168 q4 4 8 0" fill="none" stroke="#2b2118" stroke-width="2" stroke-linecap="round"/>
        <rect x="150" y="132" width="40" height="8" rx="4" fill="#ffd23f"/>
        <g class="wrench">
          <rect x="176" y="146" width="44" height="8" rx="4" fill="#9aa1ad"/>
          <circle cx="222" cy="150" r="9" fill="none" stroke="#9aa1ad" stroke-width="6"/>
        </g>
      </g>

      <!-- cat B: grey cat with yarn-cable -->
      <g>
        <path class="tail-b" d="M282 226 C 256 230, 248 204, 262 190" fill="none" stroke="var(--fur-b)" stroke-width="11" stroke-linecap="round"/>
        <ellipse cx="306" cy="228" rx="32" ry="22" fill="var(--fur-b)"/>
        <circle cx="326" cy="196" r="22" fill="var(--fur-b)"/>
        <path d="M310 182 L312 160 L324 176 Z" fill="var(--fur-b)"/>
        <path d="M330 176 L342 160 L344 184 Z" fill="var(--fur-b)"/>
        <g class="eye"><circle cx="320" cy="194" r="3" fill="#ffd23f"/><circle cx="334" cy="194" r="3" fill="#ffd23f"/></g>
        <path d="M324 203 q3 3 6 0" fill="none" stroke="#2b2118" stroke-width="2" stroke-linecap="round"/>
        <g class="yarn"><circle cx="360" cy="226" r="18" fill="#2bb3a3"/><path d="M346 220 q14 -10 28 0 M344 230 q16 10 32 0" stroke="#1d8a7e" stroke-width="3" fill="none"/></g>
      </g>

      <!-- cat C: cream cat with laptop -->
      <g>
        <path class="tail-c" d="M492 196 C 540 196, 552 156, 528 136" fill="none" stroke="var(--fur-c)" stroke-width="12" stroke-linecap="round"/>
        <ellipse cx="462" cy="210" rx="44" ry="30" fill="var(--fur-c)"/>
        <circle cx="440" cy="166" r="28" fill="var(--fur-c)"/>
        <path d="M418 148 L420 120 L436 142 Z" fill="var(--fur-c)"/>
        <path d="M448 142 L462 120 L462 150 Z" fill="var(--fur-c)"/>
        <g class="eye"><circle cx="432" cy="164" r="3.4" fill="#2b2118"/><circle cx="450" cy="164" r="3.4" fill="#2b2118"/></g>
        <path d="M437 174 q4 4 8 0" fill="none" stroke="#2b2118" stroke-width="2" stroke-linecap="round"/>
        <g transform="translate(380 196)">
          <rect width="56" height="34" rx="4" fill="#3b3f4a"/>
          <rect x="5" y="5" width="46" height="24" rx="2" fill="#1d2129"/>
          <path class="led" d="M10 12 h20 M10 18 h30 M10 24 h14" stroke="#2bd67b" stroke-width="3" stroke-linecap="round"/>
          <rect x="-6" y="34" width="68" height="6" rx="3" fill="#5f6573"/>
        </g>
      </g>
    </svg>
    <div class="progress"><b></b></div>
    <div class="status" id="status" data-t="status0"><strong>Crew:</strong> untangling the cable…</div>
  </div>

  <ul class="crew">
    <li><b data-t="c1">Ginger</b><span data-t="c1s">Lead engineer, tightens every bolt twice</span></li>
    <li><b data-t="c2">Smokey</b><span data-t="c2s">Cable specialist, mostly plays with it</span></li>
    <li><b data-t="c3">Milk</b><span data-t="c3s">Monitoring, types with all four paws</span></li>
  </ul>

  <footer data-t="foot">Thank you for your patience. No cats were harmed during maintenance.</footer>
</main>
<script>
  (function () {
    var ru = /^ru|^uk|^be|^kk/i.test(navigator.language || "");
    var text = ru ? {
      badge: "Плановые работы",
      title: "Котики чинят подключение",
      lead: "Кто-то снова перегрыз кабель. Ремонтная бригада уже на месте — загляните через пару минут.",
      c1: "Рыжик", c1s: "Главный инженер, затягивает каждый болт дважды",
      c2: "Дымок", c2s: "Специалист по кабелям, в основном играет с ними",
      c3: "Молочко", c3s: "Мониторинг, печатает всеми четырьмя лапами",
      foot: "Спасибо за терпение. Ни один котик не пострадал во время работ.",
      crew: "Бригада:",
      steps: ["распутывает кабель…", "проверяет разъёмы носом…", "перезагружает роутер лапой…", "ищет потерянные пакеты под диваном…", "почти готово, осталось помурчать…"]
    } : {
      crew: "Crew:",
      steps: ["untangling the cable…", "sniffing the connectors…", "rebooting the router with a paw…", "looking for lost packets under the sofa…", "almost done, purring for stability…"]
    };
    if (ru) {
      document.documentElement.lang = "ru";
      document.title = "Технические работы";
      Array.prototype.forEach.call(document.querySelectorAll("[data-t]"), function (el) {
        var v = text[el.getAttribute("data-t")];
        if (v) el.textContent = v;
      });
    }
    var status = document.getElementById("status");
    var i = 0;
    function tick() {
      status.innerHTML = "";
      var b = document.createElement("strong");
      b.textContent = text.crew + " ";
      status.appendChild(b);
      status.appendChild(document.createTextNode(text.steps[i % text.steps.length]));
      i++;
    }
    tick();
    setInterval(tick, 2400);
  })();
</script>
</body>
</html>
`
