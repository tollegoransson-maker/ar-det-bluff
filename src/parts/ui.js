(function () {
  'use strict';
  var SHARE_URL = 'https://tollegoransson-maker.github.io/ar-det-bluff/';
  var CAN_OCR = false;
  var CAN_SW = false;
  var WEB = false;
  var TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  // Kontrollsumman gör att webbläsaren vägrar köra filen om någon har ändrat den. Räkna om den om versionen byts:
  // curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A
  var TESSERACT_SRI = 'sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F';
  // Den svenska språkdatan med låst version, så att samma fil används tills vi själva byter.
  var TESS_LANG = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/swe@1.0.0/4.0.0_best_int';
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // På webben ska verktyget inte gå att använda inuti någon annans sida, där ett falskt svar kan läggas ovanpå det
  // riktiga. (På claude.ai visas sidan alltid i en ram, så det gäller bara webbversionen.)
  if (WEB && window.top !== window.self) {
    window.bluffReady = true;
    var tool = document.getElementById('verktyg');
    if (tool) tool.innerHTML = '<div class="wrap"><h1 id="titel">Öppna den riktiga sidan</h1><p class="lead">Den här sidan visas inuti en annan webbplats. ' +
      'Öppna den själv i stället, på <strong>' + esc(location.host + location.pathname) + '</strong>.</p></div>';
    return;
  }

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Håller ihop belopp och tal med sin enhet i text som bara visas, så att "4 800 kr" inte bryts mitt itu.
  // Texter som analyseras lämnas orörda, eftersom analysen läser vanliga mellanslag.
  function keep(s) {
    return s.replace(/(\d) (?=\d{3}(?!\d))/g, '$1 ').replace(/(\d) (?=(?:kr|kronor|timmar|timme|minuter|dagar|månader)(?![\p{L}]))/gu, '$1 ');
  }

  /* Räkna användning (bara på webbversionen): endast händelsens namn skickas, aldrig det du skriver */
  function track(name) {
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: name, title: name, event: true }); } catch (e) {}
  }
  var counted = {};
  function trackOnce(name) { if (!counted[name]) { counted[name] = true; track(name); } }

  /* Större text */
  var bigBtn = $('#bigtext');
  function setBig(on) {
    document.documentElement.classList.toggle('big', on);
    bigBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    try { localStorage.setItem('bluff-big', on ? '1' : '0'); } catch (e) {}
  }
  bigBtn.addEventListener('click', function () {
    var on = bigBtn.getAttribute('aria-pressed') !== 'true';
    setBig(on);
    if (on) track('storre-text');
  });
  try { if (localStorage.getItem('bluff-big') === '1') setBig(true); } catch (e) {}

  /* Flikar */
  var TABS = ['meddelande', 'samtal', 'lurad'];
  var tabs = $$('[role="tab"]');
  function selectTab(name, focus) {
    if (TABS.indexOf(name) === -1) return;
    if (name === 'lurad') trackOnce('lurad-oppnad');
    tabs.forEach(function (t) {
      var on = t.id === 'tab-' + name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t.id.slice(4)); });
    t.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) { e.preventDefault(); selectTab(next.id.slice(4), true); }
    });
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-goto]') : null;
    if (!a) return;
    e.preventDefault();
    selectTab(a.getAttribute('data-goto'), true);
    var bar = $('.tabs');
    if (bar && bar.scrollIntoView) bar.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });

  /* Uppläsning: läser beskedet och råden med svensk röst, om webbläsaren har en */
  var canSpeak = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
  function speakButton() {
    return canSpeak ? '<p class="speak"><button class="linkbtn panel-link" type="button" data-speak>Läs upp svaret</button></p>' : '';
  }
  function resetSpeak() { $$('[data-speak]').forEach(function (b) { b.textContent = 'Läs upp svaret'; }); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-speak]') : null;
    if (!b) return;
    var synth = window.speechSynthesis;
    if (synth.speaking) { synth.cancel(); resetSpeak(); return; }
    var box = b.closest('.result, .callresult, .askresult');
    var verdict = box ? box.querySelector('.verdict') : null;
    if (!verdict) return;
    var parts = [];
    Array.prototype.forEach.call(verdict.children, function (el) { if (!el.querySelector('[data-speak]')) parts.push(el.innerText); });
    var todo = box.querySelector('.list');
    if (todo) parts.push('Gör så här. ' + todo.innerText);
    // I samtalsdelen och frågorna om meddelandet står råden under raderna man har kryssat i.
    var ticked = box.classList.contains('callresult') ? '#panel-samtal input:checked' : box.classList.contains('askresult') ? '#askbox input:checked' : null;
    if (ticked) {
      $$(ticked).forEach(function (i) {
        var note = i.nextElementSibling ? i.nextElementSibling.querySelector('.check-note') : null;
        if (note && i.value !== 'caller') parts.push(note.innerText);
      });
    }
    var u = new window.SpeechSynthesisUtterance(parts.join('. ').replace(/\s+/g, ' '));
    u.lang = 'sv-SE';
    var voices = synth.getVoices();
    var sv = voices.filter(function (v) { return /^sv/i.test(v.lang); })[0];
    if (voices.length && !sv) { b.textContent = 'Det finns ingen svensk röst i den här webbläsaren'; return; }
    if (sv) u.voice = sv;
    u.onend = resetSpeak;
    u.onerror = resetSpeak;
    b.textContent = 'Sluta läsa';
    synth.speak(u);
    track('las-upp');
  });

  /* Meddelanden */
  var EX = {
    paket: 'PostNord: Ditt paket kunde inte levereras eftersom tullavgiften (19 kr) inte är betald. Betala inom 24 timmar för att undvika retur: https://postnord.se-tull.example/betala',
    mamma: 'Hej mamma! Det är jag. Jag har tappat min telefon så det här är mitt nya nummer, spara det. Jag måste betala en räkning idag men kommer inte åt min bank. Kan du swisha 4 800 kr? Jag betalar tillbaka imorgon ❤️',
    skatt: 'Skatteverket: Du har en skatteåterbäring på 2 341 kr som inte har kunnat betalas ut. Ange dina kortuppgifter senast idag för att få pengarna: skatteverket-aterbetalning.example',
    blocket: 'Hej! Jag vill köpa din soffa och betalar direkt via Swish. Jag har skickat en betalningsförfrågan. Godkänn med BankID så får du pengarna. Mvh Anna',
    vanligt: 'Hej! Påminnelse om din tid hos tandläkaren torsdag 12 november kl. 14.30. Välkommen! Behöver du avboka, hör av dig senast dagen innan.'
  };
  var VERDICT = {
    high: { title: 'Det här är troligen en bluff', sub: 'Klicka inte på länkar och svara inte. Ring bara nummer som du redan har eller själv har letat upp.' },
    medium: { title: 'Var försiktig', sub: 'Meddelandet har tecken som är vanliga i bluffar. Gör inget av det som meddelandet ber om förrän du själv har kontaktat avsändaren, till exempel på ett nummer du har letat upp.' },
    low: { title: 'Inga tydliga varningstecken', sub: 'Det betyder inte att meddelandet är äkta. Sidan känner bara igen kända knep, och ett meddelande kan vara skrivet så att den inte hittar något. Väntade du dig inte meddelandet? Klicka inte på länkar och lämna inga uppgifter förrän du själv har kontaktat avsändaren, till exempel på ett nummer du har letat upp.' }
  };
  // Står i varje svar: den som redan har agerat ska inte radera bevisen, och ska hitta hjälpen direkt.
  // Ett vanligt meddelande ska inte låta som ett brott, men vägen till hjälpen finns kvar om något ändå känns fel.
  var ALREADY = '<p class="verdict-more">Har du redan klickat, betalat eller lämnat uppgifter? Radera inte meddelandet, det kan behövas som bevis. <a href="#lurad" data-goto="lurad">Se vad du ska göra nu</a>.</p>';
  var ALREADY_LOW = '<p class="verdict-more">Har du redan klickat eller lämnat uppgifter och känns något fel? <a href="#lurad" data-goto="lurad">Se vad du ska göra</a>.</p>';
  // Bedragare kan skriva om ett meddelande tills sidan inte hittar något, och sedan säga "kolla själv där".
  var ALIBI = '<p class="verdict-more">Har någon bett dig kolla meddelandet här, eller sagt att sidan visar att det är äkta? Lita inte på det. Sidan kan aldrig intyga att ett meddelande är äkta.</p>';

  var msg = $('#msg'), out = $('#result'), exKey = null, helpedFor = null, shownFor = null;
  var resultStatus = $('#result-status');
  var coarse = false;
  try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
  // Skärmläsare får bara beskedet upplästa, inte hela svaret med det inklistrade meddelandet.
  function announce(text) {
    resultStatus.textContent = '';
    if (text) setTimeout(function () { resultStatus.textContent = text; }, 60);
  }

  // Varningstecknen numreras i den ordning de står i meddelandet, så att markering och förklaring hör ihop.
  function numbered(flags) {
    var hasLinkFlag = flags.some(function (f) { return /^link_(?:lookalike|mismatch|homograph|hosted)$/.test(f.id); });
    return flags
      .filter(function (f) { return f.matches.length && !(hasLinkFlag && f.id === 'link'); })
      .map(function (f) { return { f: f, first: Math.min.apply(null, f.matches.map(function (m) { return m.s; })) }; })
      .sort(function (a, b) { return a.first - b.first || b.f.w - a.f.w; })
      .map(function (x) { return x.f; });
  }

  function highlight(text, flags) {
    var ranges = [];
    flags.forEach(function (f, i) {
      f.matches.forEach(function (m) { ranges.push({ s: m.s, e: m.e, n: [i + 1], crit: f.w >= 3 }); });
    });
    ranges.sort(function (a, b) { return a.s - b.s || b.e - a.e; });
    var merged = [];
    ranges.forEach(function (r) {
      var last = merged[merged.length - 1];
      if (last && r.s < last.e) {
        if (r.e > last.e) last.e = r.e;
        r.n.forEach(function (n) { if (last.n.indexOf(n) === -1) last.n.push(n); });
        last.crit = last.crit || r.crit;
      } else merged.push({ s: r.s, e: r.e, n: r.n.slice(), crit: r.crit });
    });
    var html = '', pos = 0;
    merged.forEach(function (m) {
      html += esc(text.slice(pos, m.s));
      html += '<mark' + (m.crit ? ' class="crit"' : '') + '>' + esc(text.slice(m.s, m.e)) +
        '<sup>' + m.n.sort(function (a, b) { return a - b; }).join(',') + '</sup></mark>';
      pos = m.e;
    });
    return html + esc(text.slice(pos));
  }

  function render(r, text, asked) {
    if (r.level === 'empty') { out.innerHTML = '<p class="empty">Klistra in eller skriv av ett meddelande i rutan först.</p>'; return; }
    var V = VERDICT[r.level], h = '';
    if (exKey) {
      h += '<p class="example-note">' + (exKey === 'vanligt' ? 'Exemplet är ett påhittat vanligt sms.' : 'Exemplet är ett påhittat bluff-meddelande.') +
        ' Klistra in ditt eget meddelande i rutan för att kolla det.</p>';
    }
    if (r.truncated) h += '<p class="trunc">Meddelandet är mycket långt. Vi har bara kollat de första 20&nbsp;000 tecknen.</p>';
    h += '<div class="verdict ' + r.level + '" id="verdict"><h3 class="verdict-title">' + V.title + '</h3><p>' + V.sub + '</p>' +
      (r.type ? '<p class="verdict-kind">Upplägget liknar: <strong>' + esc(r.type) + '</strong></p>' : '') + (r.level === 'low' ? ALREADY_LOW : ALREADY) + (r.level !== 'high' ? ALIBI : '') + speakButton() + '</div>';
    // Den som inte kan kopiera skriver ibland en beskrivning i stället. Den går inte att kolla, men frågorna kan hjälpa.
    if (r.level === 'low' && text.length < 200 && /(^|[^\p{L}])(sms|sms:et|mejl|mejlet|mail|brev|brevet|samtal|ringde|skrev|skickade|fick ett|de vill|dom vill|han vill|hon vill|vill att jag)(?![\p{L}])/iu.test(text)) {
      h += '<p class="example-note describe">Skrev du en beskrivning av meddelandet? Kollen behöver själva texten, ord för ord. <button class="linkbtn" type="button" data-openask>Svara på frågor om meddelandet i stället</button>.</p>';
    }
    var official = r.links.filter(function (l) { return l.status === 'official' && l.kind === 'url'; });
    // Bara om meddelandet inte ber om något annat: en riktig länk kan vara lockbete bredvid ett falskt telefonnummer.
    var asks = r.flags.some(function (f) { return /^(?:call_number|pay_by_phone|cards|code|code_sms|bankid_use|approve_push|swish_receive|money_request|call_to_stop|refers_self)$/.test(f.id); });
    if (official.length && r.level !== 'high' && !asks) {
      h += '<p class="official">Adressen i länken slutar på <strong>' + esc(official[0].reg) + '</strong>, som hör till ' + esc(official[0].brand.name) +
        '. Det säger inget om resten av meddelandet, till exempel telefonnummer. Öppna hellre appen eller webbplatsen själv.</p>';
    }
    var todos = r.todos.slice(0, 2).map(esc);
    // Bluff-sms kan rapporteras till 7726, som alla mobiloperatörer tar emot (Skatteverket och operatörerna).
    if (r.level === 'high') todos.push('Är det ett sms? Vidarebefordra det till 7726. Dit kan du rapportera bluff-sms, oavsett operatör.');
    if (todos.length && r.level !== 'low') {
      h += '<h4>Gör så här</h4><ul class="list">' + todos.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
    }
    var flags = numbered(r.flags);
    if (flags.length) {
      h += '<h4>' + (r.level === 'low' ? 'Det här reagerade vi på' : 'Varningstecknen i meddelandet') + '</h4>' +
        // Bara den del som har kollats visas markerad. En mycket lång text gjorde annars sidan seg.
        '<div class="marked" id="hl">' + highlight(r.truncated ? text.slice(0, 20000) : text, flags) + (r.truncated ? ' …' : '') + '</div>' +
        '<ol class="key">' + flags.map(function (f) { return '<li><strong>' + esc(f.title) + '.</strong> ' + esc(f.why) + '</li>'; }).join('') + '</ol>';
    }
    if (asked && !exKey && window.goatcounter) {
      h += helpedFor === text ? '<p class="helpful">Tack för att du svarade.</p>'
        : '<p class="helpful" id="helpful">Hjälpte svaret dig? <button class="linkbtn" type="button" data-helpful="ja">Ja</button> eller <button class="linkbtn" type="button" data-helpful="nej">Nej</button></p>';
    }
    out.innerHTML = h;
  }

  var LEVEL_EVENT = { high: 'kollat-troligen-bluff', medium: 'kollat-var-forsiktig', low: 'kollat-inga-tecken' }, lastCounted = '';
  function run(scroll, pasted) {
    if (canSpeak && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    var r = Bluffkoll.analyze(msg.value);
    render(r, msg.value, scroll);
    shownFor = r.level === 'empty' ? null : msg.value;
    announce(r.level === 'empty' ? 'Klistra in eller skriv av ett meddelande i rutan först.' : 'Svar: ' + VERDICT[r.level].title + '.');
    // Ett eget meddelande räknas en gång, med svaret det fick. Exempel och text under skrivning räknas inte.
    if (scroll && !exKey && r.level !== 'empty' && msg.value !== lastCounted) { lastCounted = msg.value; track(LEVEL_EVENT[r.level]); }
    if (scroll) {
      var v = $('#verdict');
      // Efter inklistring på en telefon täcker tangentbordet svaret: stäng det och visa svaret överst.
      var top = pasted && coarse;
      if (top) msg.blur();
      if (v && v.scrollIntoView) v.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: top ? 'start' : 'nearest' });
    }
  }
  function markExamples() {
    $$('[data-ex]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-ex') === exKey ? 'true' : 'false'); });
  }
  function setExample(k, scroll) {
    exKey = k;
    msg.value = EX[k];
    markExamples();
    run(scroll);
  }
  $$('[data-ex]').forEach(function (b) { b.addEventListener('click', function () { setExample(b.getAttribute('data-ex'), true); }); });
  // Svaret kommer när man trycker på knappen eller klistrar in, aldrig medan man skriver.
  // Ändras texten efter ett svar tas det gamla svaret bort, så att det aldrig står bredvid en annan text.
  msg.addEventListener('input', function () {
    if (exKey) { exKey = null; markExamples(); }
    if (canSpeak && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    ocrStatus.textContent = '';
    if (out.innerHTML) { out.innerHTML = msg.value.trim() ? '<p class="empty">Tryck på Kolla meddelandet när du har skrivit klart.</p>' : ''; announce(''); }
  });
  // Ett inklistrat meddelande ersätter exemplet, eller meddelandet som just fick ett svar, i stället för att hamna mitt i det.
  msg.addEventListener('focus', function () { if (exKey) msg.select(); });
  msg.addEventListener('paste', function (e) {
    var pasted = e.clipboardData ? e.clipboardData.getData('text') : '';
    if (pasted && (exKey || (shownFor !== null && msg.value === shownFor))) { e.preventDefault(); msg.value = pasted; }
    setTimeout(function () { exKey = null; markExamples(); ocrStatus.textContent = ''; run(true, true); }, 0);
  });
  $('#check').addEventListener('click', function () { run(true); });
  out.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-helpful]') : null;
    if (!b) return;
    track('hjalpte-' + b.getAttribute('data-helpful'));
    helpedFor = msg.value;
    var p = $('#helpful');
    if (p) p.textContent = 'Tack för att du svarade.';
  });
  $('#clear').addEventListener('click', function () {
    msg.value = ''; exKey = null; shownFor = null; markExamples(); out.innerHTML = ''; announce(''); ocrStatus.textContent = ''; msg.focus();
  });

  /* Skärmbild: texten läses av i webbläsaren, bilden skickas ingenstans */
  var ocrFile = $('#ocr-file'), ocrStatus = $('#ocr-status');
  function loadScript(src, integrity) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function toImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function (e) { URL.revokeObjectURL(img.src); reject(e); };
      img.src = URL.createObjectURL(file);
    });
  }
  // Stora bilder krymps. En iPhone ritar inte en canvas över ungefär 16 miljoner pixlar, utan lämnar den tom,
  // och stora bilder tar lång tid att läsa på en äldre telefon.
  var MAX_PIXELS = 12e6;
  // Gråskala, och mörka skärmbilder vänds till mörk text på ljus botten, som textläsaren klarar bäst.
  function prepare(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var scale = w < 1000 ? 2 : 1;
    if (w * h * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (w * h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    var x = c.getContext('2d');
    x.drawImage(img, 0, 0, c.width, c.height);
    var d = x.getImageData(0, 0, c.width, c.height), p = d.data, sum = 0, i;
    for (i = 0; i < p.length; i += 4) {
      var g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      p[i] = p[i + 1] = p[i + 2] = g;
      sum += g;
    }
    if (sum / (p.length / 4) < 128) for (i = 0; i < p.length; i += 4) p[i] = p[i + 1] = p[i + 2] = 255 - p[i];
    x.putImageData(d, 0, 0);
    return c;
  }
  // Vad textläsaren håller på med, i ord som går att förstå.
  var OCR_STAGE = {
    'loading tesseract core': 'Hämtar textläsaren …',
    'initializing tesseract': 'Startar textläsaren …',
    'loading language traineddata': 'Hämtar svensk språkdata, cirka 2,5 MB …',
    'initializing api': 'Startar textläsaren …'
  };
  // Händer ingenting på två minuter ger vi upp, i stället för att låta en text stå kvar för evigt.
  // Det räcker gott för att hämta språkdatan även på en mycket långsam uppkoppling.
  var OCR_PATIENCE = 120000;
  function readImage(file) {
    // Var det gick fel avgör vad vi säger: bilden, hämtningen av textläsaren eller själva läsningen.
    var canvas, stage = 'bild', worker = null, gaveUp = false, timer = null;
    function fail() {
      ocrStatus.textContent = stage === 'bild' ? 'Bilden gick inte att öppna. Ta en vanlig skärmbild och försök igen, eller skriv av meddelandet.'
        : stage === 'hamta' ? 'Det gick inte att hämta textläsaren. Kontrollera internetanslutningen, eller skriv av meddelandet.'
        : 'Det gick inte att läsa texten i bilden. Prova en tydligare skärmbild, eller skriv av meddelandet.';
      track('skarmbild-fel');
    }
    function patience() {
      clearTimeout(timer);
      timer = setTimeout(function () { gaveUp = true; if (worker) worker.terminate(); fail(); }, OCR_PATIENCE);
    }
    ocrStatus.textContent = 'Läser in bilden …';
    toImage(file).then(function (img) {
      canvas = prepare(img);
      URL.revokeObjectURL(img.src);
      stage = 'hamta';
      patience();
      if (window.Tesseract) return null;
      ocrStatus.textContent = 'Hämtar textläsaren, cirka 4 MB. Första gången kan det ta en stund …';
      return loadScript(TESSERACT, TESSERACT_SRI);
    }).then(function () {
      if (gaveUp) throw new Error('gave up');
      return window.Tesseract.createWorker('swe', 1, {
        langPath: TESS_LANG,
        logger: function (m) {
          if (gaveUp) return;
          patience();
          if (m.status === 'recognizing text') ocrStatus.textContent = 'Läser texten … ' + Math.round(m.progress * 100) + ' %';
          else if (OCR_STAGE[m.status]) ocrStatus.textContent = OCR_STAGE[m.status];
        }
      });
    }).then(function (w) {
      worker = w;
      if (gaveUp) { w.terminate(); throw new Error('gave up'); }
      stage = 'las';
      patience();
      return w.recognize(canvas).then(function (res) { w.terminate(); return res.data.text; },
        function (e) { w.terminate(); throw e; });
    }).then(function (text) {
      clearTimeout(timer);
      if (gaveUp) return;
      // Pratbubblor bryter rader mitt i meningar och länkar. Lägg ihop dem igen, men behåll tomma rader.
      text = String(text || '').replace(/[ \t]+\n/g, '\n').replace(/-\n(?=\S)/g, '-').replace(/([^\n])\n(?!\n)/g, '$1 ').replace(/\n{3,}/g, '\n\n').trim();
      if (!text) { ocrStatus.textContent = 'Vi hittade ingen text i bilden. Prova en tydligare skärmbild, eller skriv av meddelandet.'; return; }
      msg.value = text;
      exKey = null;
      markExamples();
      run(true);
      ocrStatus.textContent = 'Texten är avläst från bilden. Rätta den i rutan om något blev fel.';
      track('skarmbild-last');
    }).catch(function () {
      clearTimeout(timer);
      if (!gaveUp) fail();
    });
  }
  if (CAN_OCR) {
    $('#ocr').hidden = false;
    $('#ocr-pick').addEventListener('click', function () { ocrFile.click(); });
    ocrFile.addEventListener('change', function () {
      if (ocrFile.files && ocrFile.files[0]) readImage(ocrFile.files[0]);
      ocrFile.value = '';
    });
  }

  /* Samtal */
  var TIPS = {
    caller: 'Lägg på och ring upp själv, på ett nummer du har letat upp.',
    transfer: 'Riktiga banker, myndigheter och företag kopplar inte samtal till varandra. Ring själv på ett nummer du har letat upp.',
    bankid: 'Legitimera dig inte. Den som får dig att använda BankID kan ta lån och tömma konton i ditt namn. Frågar appen om samtalet, svara som det är och tryck på Avbryt.',
    codes: 'Säg inga koder eller kortnummer, inte ens om personen redan vet ditt namn och personnummer.',
    money: 'Det finns inga säkra konton. Flytta inga pengar.',
    remote: 'Installera ingenting. Har du redan gjort det: koppla bort internet och stäng av enheten.',
    pickup: 'Polisen och banken hämtar aldrig kort, pengar eller smycken. Öppna inte dörren. Ring 112 om någon är på väg.',
    pressure: 'Brådska är bedragarens viktigaste verktyg. En riktig bank eller myndighet ger dig tid.',
    offer: 'Garanterade vinster och pengar som ”väntar på dig” är lockbeten.',
    family: 'Ring din anhörige på det vanliga numret och fråga efter ert familjeord.'
  };
  var callOut = $('#callresult'), callReset = $('#callreset');
  function updateCall() {
    var on = $$('#panel-samtal input:checked').map(function (i) { return i.value; });
    var stop = on.filter(function (k) { return k !== 'caller'; });
    callReset.hidden = !on.length;
    if (canSpeak && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    if (!on.length) { callOut.innerHTML = ''; return; }
    if (!stop.length) {
      trackOnce('samtal-ring-upp-sjalv');
      callOut.innerHTML = '<div class="verdict medium"><h3 class="verdict-title">Lägg på och ring upp själv</h3><p>Det kan vara äkta, men nummerpresentationen kan vara förfalskad, även när den visar bankens eller polisens riktiga nummer. Ring upp på ett nummer du har letat upp själv, till exempel på bankens webbplats eller på ditt kort. En riktig bank förstår det.</p>' + speakButton() + '</div>';
      return;
    }
    trackOnce('samtal-lagg-pa');
    // Råden står redan under raderna man har kryssat i, så rutan upprepar dem inte.
    callOut.innerHTML = '<div class="verdict high"><h3 class="verdict-title">Lägg på nu</h3><p>Det du har kryssat i är precis så bedragare arbetar. En riktig bank, polis eller myndighet som ringer dig gör aldrig så. Vill du kontrollera, ring själv upp på ett nummer du har letat upp, till exempel på bankens webbplats eller på ditt kort.</p>' +
      (stop.indexOf('pickup') !== -1 ? '<p class="verdict-more"><strong>Öppna inte dörren.</strong> Ring 112 om någon är på väg hem till dig.</p>' : '') +
      '<p class="verdict-more">Har du redan gjort något av det? <a href="#lurad" data-goto="lurad">Se vad du ska göra nu</a>.</p>' + speakButton() + '</div>';
  }
  // Rådet visas direkt under varje ikryssad rad, så att det syns där man är. Varningarna börjar med det viktigaste: lägg på.
  $$('#panel-samtal input').forEach(function (i) {
    var span = i.nextElementSibling;
    if (span && TIPS[i.value]) {
      span.insertAdjacentHTML('beforeend', i.value === 'caller' ? '<span class="check-note calm">' + esc(TIPS.caller) + '</span>'
        : '<span class="check-note"><strong>Lägg på.</strong> ' + esc(TIPS[i.value]) + '</span>');
    }
    i.addEventListener('change', updateCall);
  });
  callReset.addEventListener('click', function () {
    $$('#panel-samtal input').forEach(function (i) { i.checked = false; });
    updateCall();
  });

  /* Frågor om meddelandet, för den som inte kan kopiera det. Vikterna fungerar som i analysen: ett tecken som aldrig
     hör till ett riktigt meddelande räcker, annars krävs två vanliga tecken. Svaret blir aldrig "äkta", eftersom kryss
     inte kan visa att ett meddelande är äkta. */
  var ASK = {
    sender: { w: 0, note: 'Namnet på avsändaren kan vara förfalskat. Kolla i företagets egen app eller ring ett nummer du har letat upp.' },
    link: { w: 2, note: 'Tryck inte på länken. Öppna appen eller skriv in adressen själv.' },
    pay: { w: 2, note: 'Betala aldrig via ett meddelande. Kolla i företagets egen app.' },
    bankid: { w: 2, note: 'Använd inte BankID via meddelandet. Logga bara in i appen eller på en adress du själv har skrivit.' },
    secrets: { w: 3, note: 'Lämna inget. Ingen seriös avsändare ber om det i ett meddelande.' },
    call: { w: 2, note: 'Ring inte numret. Ring bara nummer som du har letat upp själv.' },
    family: { w: 3, note: 'Ring personen på det gamla, vanliga numret innan du gör något.' },
    prize: { w: 2, note: 'Pengar som väntar på dig kräver aldrig att du först betalar eller loggar in.' },
    hurry: { w: 1.5, note: 'Bråttom är ett varningstecken. En riktig avsändare ger dig tid.' },
    chat: { w: 3, note: 'Svara inte. Så börjar många investerings- och kärleksbluffar.' }
  };
  var askOut = $('#askresult'), askReset = $('#askreset');
  function updateAsk() {
    var on = $$('#askbox input:checked').map(function (i) { return i.value; });
    askReset.hidden = !on.length;
    if (canSpeak && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    if (!on.length) { askOut.innerHTML = ''; return; }
    trackOnce('fragor-om-meddelande');
    var score = 0, crit = false;
    on.forEach(function (k) { score += ASK[k].w; if (ASK[k].w >= 3) crit = true; });
    var level = crit || score >= 4 ? 'high' : score >= 1.5 ? 'medium' : 'low';
    var title = level === 'low' ? 'Kontakta avsändaren själv' : VERDICT[level].title;
    var text = level === 'high' ? 'Det du har kryssat i är precis så bedragare arbetar. Gör inget av det som meddelandet ber om. Vill du kontrollera, kontakta avsändaren själv, i deras app eller på ett nummer du har letat upp.'
      : level === 'medium' ? 'Det du har kryssat i är vanligt i bluffar, men kan också finnas i riktiga meddelanden. Gör inget av det som meddelandet ber om förrän du själv har kontaktat avsändaren, till exempel i deras app eller på ett nummer du har letat upp.'
      : 'Det kan vara äkta, men namn och nummer går att förfalska. Kolla i företagets egen app eller ring ett nummer du har letat upp.';
    askOut.innerHTML = '<div class="verdict ' + level + '"><h3 class="verdict-title">' + title + '</h3><p>' + text + '</p>' +
      (level === 'low' ? '' : ALREADY) + speakButton() + '</div>';
  }
  $$('#askbox input').forEach(function (i) {
    var span = i.nextElementSibling;
    if (span && ASK[i.value]) span.insertAdjacentHTML('beforeend', '<span class="check-note' + (ASK[i.value].w ? '' : ' calm') + '">' + esc(ASK[i.value].note) + '</span>');
    i.addEventListener('change', updateAsk);
  });
  askReset.addEventListener('click', function () {
    $$('#askbox input').forEach(function (i) { i.checked = false; });
    updateAsk();
  });
  // Från tipset i ett lugnt svar: öppna frågorna och gå dit.
  out.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-openask]') : null;
    if (!b) return;
    var box = $('#askbox');
    box.open = true;
    if (box.scrollIntoView) box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    var s = box.querySelector('summary');
    if (s) s.focus();
  });

  /* Skriv ut stegen för den som har blivit lurad, med alla hopfällda delar öppna */
  $('#printsteps').addEventListener('click', function () {
    var shut = $$('#panel-lurad details').filter(function (d) { return !d.open; });
    shut.forEach(function (d) { d.open = true; });
    document.documentElement.classList.add('print-lurad');
    function done() {
      document.documentElement.classList.remove('print-lurad');
      shut.forEach(function (d) { d.open = false; });
      window.removeEventListener('afterprint', done);
    }
    window.addEventListener('afterprint', done);
    track('lurad-utskrift');
    window.print();
  });

  /* Kopiera, med reserv när urklipp inte går att använda */
  function copy(text, field, ok, statusEl) {
    function fallback() {
      if (field) {
        field.focus();
        field.select();
        try { field.setSelectionRange(0, field.value.length); } catch (e) {}
        statusEl.textContent = 'Texten är markerad. Kopiera den med Ctrl+C, eller håll fingret på den och välj Kopiera.';
      } else {
        statusEl.textContent = 'Markera och kopiera texten: ' + text;
      }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { statusEl.textContent = ok; }, fallback);
      } else fallback();
    } catch (e) { fallback(); }
  }

  // Telefonens egen delningsmeny (sms, mejl, WhatsApp …) är enklast. Går den inte att öppna kopieras texten i stället.
  var canShare = typeof navigator.share === 'function';
  function share(text, field, ok, statusEl, done) {
    function fallback(err) { if (!err || err.name !== 'AbortError') copy(text, field, ok, statusEl); }
    if (!canShare) { copy(text, field, ok, statusEl); return; }
    try {
      navigator.share({ text: text }).then(function () { statusEl.textContent = ''; if (done) done(); }, fallback);
    } catch (e) { fallback(e); }
  }

  /* Testa dig själv */
  var QUIZ = [
    { from: 'Sms', text: 'Tullverket: Din försändelse har stoppats i tullen. Betala avgiften 29 kr idag för att undvika retur: https://tull-avgift.example', answer: 'bluff',
      why: 'Tullverket skickar aldrig sms. Tull på paket tar fraktbolaget ut, i sin app eller på sin webbplats. Här är det dessutom bråttom och en okänd adress.' },
    { from: 'Sms', text: 'Påminnelse: Din tid hos tandläkaren är tisdag 11 maj kl. 09.30. Välkommen! Behöver du avboka, ring kliniken.', answer: 'akta',
      why: 'En vanlig påminnelse. Ingen länk, inga koder och inget krav på pengar.' },
    { from: 'Sms från ett okänt nummer', text: 'Hej pappa, det är jag. Mobilen gick sönder så jag lånar en kompis telefon. Kan du swisha 3 000 kr? Förklarar sen ❤️', answer: 'bluff',
      why: 'Så låter ”Hej mamma”-bluffen: ny telefon och pengar på en gång. Ring ditt barn på det vanliga numret.' },
    { from: 'Sms, strax efter att du själv loggade in', text: 'Din kod för inloggning är 482917. Ange den bara på sidan du själv öppnade. Dela aldrig koden med någon.', answer: 'akta',
      why: 'Koden kom för att du själv just loggade in. Det är det som avgör, inte vad det står i sms:et, för det kan en bedragare också skriva. Får du en kod utan att ha loggat in: ge den aldrig till någon och byt lösenord.' },
    { from: 'Sms', text: 'Skatteverket: Du har en återbetalning på 1 846 kr. Ange dina kortuppgifter för utbetalning: skatteverket-se.example', answer: 'bluff',
      why: 'Skatteverket frågar aldrig efter kortuppgifter i sms, och adressen är inte skatteverket.se.' },
    { from: 'Telefonsamtal', text: '”Hej, det här är bankens säkerhetsavdelning. Vi ser misstänkta köp på ditt kort. Logga in med BankID så stoppar vi dem.”', answer: 'bluff',
      why: 'Banken ringer aldrig oväntat och ber dig logga in med BankID. Lägg på och ring bankens nummer själv.' },
    { from: 'Avisering i Swish-appen', text: 'Du har fått 250 kr från Anna Berg. Meddelande: Tack för lånet!', answer: 'akta',
      why: 'Pengar som kommer in kräver ingenting av dig. Du behöver inte godkänna något.' },
    { from: 'Sms', text: 'Grattis! Du är utvald att testa en ny mobiltelefon för 19 kr. Svara inom 1 timme: tiny.example/3kTx9q', answer: 'bluff',
      why: 'Vinst, liten avgift, bråttom och en okänd länk. Fyra varningstecken på en gång.' },
    { from: 'Avisering i Blocket-appen', text: 'Någon har skickat ett meddelande om din annons ”Soffa”. Läs det i appen.', answer: 'akta',
      why: 'Ett vanligt besked i appen. Ingen länk att logga in via och inget krav på BankID eller betalning.' },
    { from: 'Någon ringer på dörren', text: 'En man i uniform säger att han är polis. Han vill ta med sig ditt bankkort och dina smycken för att skydda dem från ett gäng.', answer: 'bluff',
      why: 'Polisen hämtar aldrig kort, pengar eller smycken. Stäng dörren och ring 112.' }
  ];
  var quiz = $('#quiz'), qi = 0, qScore = 0;
  function quizQuestion(focus) {
    var q = QUIZ[qi];
    quiz.innerHTML = '<p class="quiz-count" tabindex="-1">' + (qi + 1) + ' av ' + QUIZ.length + '</p>' +
      '<div class="quiz-msg"><p class="quiz-from">' + esc(q.from) + '</p><p class="quiz-text">' + keep(esc(q.text)) + '</p></div>' +
      '<div class="actions"><button class="btn btn-alt" type="button" data-answer="bluff">Det är bluff</button>' +
      '<button class="btn btn-alt" type="button" data-answer="akta">Det är äkta</button></div>' +
      '<div class="quiz-after" aria-live="polite"></div>';
    if (focus) $('.quiz-count', quiz).focus();
  }
  function quizEnd() {
    var comment = qScore >= 9 ? 'Mycket bra. Du känner igen nästan alla knep.'
      : qScore >= 7 ? 'Bra. Läs igenom lappen ovan, så blir det ännu lättare.'
      : 'Bra att du testade. Läs lappen ovan och prova igen.';
    quiz.innerHTML = '<p class="quiz-score" tabindex="-1">Du fick ' + qScore + ' av ' + QUIZ.length + ' rätt.</p><p class="quiz-comment">' + comment + '</p>' +
      '<div class="actions"><button class="btn" type="button" data-copyscore>' + (canShare ? 'Dela resultatet' : 'Kopiera resultatet') + '</button>' +
      '<button class="linkbtn" type="button" data-restart>Gör om testet</button></div><p class="copystatus" id="quiz-status" role="status"></p>';
    $('.quiz-score', quiz).focus();
    track('testet-' + qScore + '-av-' + QUIZ.length);
  }
  quiz.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    if (t.hasAttribute('data-answer')) {
      var q = QUIZ[qi], right = t.getAttribute('data-answer') === q.answer;
      if (right) qScore++;
      $$('[data-answer]', quiz).forEach(function (b) { b.disabled = true; b.setAttribute('aria-pressed', b === t ? 'true' : 'false'); });
      $('.quiz-after', quiz).innerHTML = '<div class="quiz-feedback ' + (right ? 'right' : 'wrong') + '"><h3>' + (right ? 'Rätt.' : 'Inte riktigt.') + ' ' +
        (q.answer === 'bluff' ? 'Det här är en bluff.' : 'Det här är äkta.') + '</h3><p>' + keep(esc(q.why)) + '</p></div>' +
        '<div class="actions"><button class="btn" type="button" data-next>' + (qi + 1 < QUIZ.length ? 'Nästa' : 'Se resultatet') + '</button></div>';
      $('[data-next]', quiz).focus();
    } else if (t.hasAttribute('data-next')) {
      qi++;
      if (qi < QUIZ.length) quizQuestion(true); else quizEnd();
    } else if (t.hasAttribute('data-restart')) {
      qi = 0; qScore = 0; quizQuestion(true);
    } else if (t.hasAttribute('data-copyscore')) {
      track('testet-delat');
      share('Jag fick ' + qScore + ' av ' + QUIZ.length + ' rätt på bluff-testet. Klarar du det? ' + SHARE_URL + '#testa', null, 'Resultatet är kopierat. Klistra in det där du vill dela det.', $('#quiz-status'));
    }
  });

  /* Dela */
  var hasUrl = SHARE_URL.indexOf('http') === 0;
  var shareText = 'Hej! Här är en sida där du kan kolla om ett sms eller ett samtal är en bluff' + (hasUrl ? ': ' + SHARE_URL : '.') +
    '\n\nKom ihåg: ingen bank eller polis ringer oväntat och ber dig använda BankID. Lägg på och ring upp själv. Sidan ber aldrig om BankID, koder eller pengar.';
  var shareMsg = $('#sharemsg'), shareLink = $('#sharelink'), status = $('#copystatus');
  shareMsg.value = shareText;
  if (hasUrl) shareLink.value = SHARE_URL;
  else { $('#linkline').hidden = true; $('#copylink').hidden = true; }
  var copiedMsg = 'Meddelandet är kopierat. Klistra in det i ett sms, ett mejl eller en chatt.';
  if (canShare) { $('#sharenative').hidden = false; $('#copymsg').className = 'linkbtn'; }
  $('#sharenative').addEventListener('click', function () { share(shareText, shareMsg, copiedMsg, status, function () { track('delat-skickat'); }); });
  $('#copymsg').addEventListener('click', function () { track('delat-meddelande'); copy(shareText, shareMsg, copiedMsg, status); });
  $('#copylink').addEventListener('click', function () { track('delat-lank'); copy(SHARE_URL, shareLink, 'Länken är kopierad.', status); });

  /* Start */
  var hash = (location.hash || '').replace('#', '');
  if (TABS.indexOf(hash) !== -1) selectTab(hash);
  updateCall();
  quizQuestion(false);
  window.addEventListener('load', function () {
    // Förbereder analysen medan sidan står still, så att första svaret kommer snabbt även på en långsam telefon.
    setTimeout(function () { try { Bluffkoll.warm(); } catch (e) {} }, 1000);
    // På webbversionen sparas sidan i telefonen, så att den fungerar också utan uppkoppling.
    if (CAN_SW && 'serviceWorker' in navigator && location.protocol === 'https:') {
      try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
    }
  });
  // Talar om för reservskriptet på sidan att allt har startat. Annars visas alla flikar utan skript.
  window.bluffReady = true;
})();
