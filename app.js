/*ENGINE-START*/
var Bluffkoll = (function () {
  'use strict';
  var BID = 'bank[- ]?[il]d';
  var EID = '(?:bank[- ]?[il]d|freja ?e-?id\\+?)';
  var LIMIT = 20000;
  // Paying a fee or a deposit, and getting money or goods: together they make an advance-fee fraud.
  var PAYFEE = '(?:betala|betalar|betalat|swisha|swishar|sätt(?:a)? in|göra en|gör en|överföra|överför|pay|send|transfer)\\s(?:[^\\s.!?\\n]+\\s){0,4}?(?:\\p{L}*avgift(?!sfri)\\w*|\\p{L}*insättning\\w*|\\p{L}*försäkring\\w*|\\p{L}*skatt\\w*|\\p{L}*kostnad\\w*|tull\\w*|frakt\\w*|deposition\\w*|(?:\\p{L}+ )?fee|deposit|(?:\\p{L}+ )?tax|(?:\\p{L}+ )?insurance|clearance)';
  var PAYFEE_NODEP = '(?:betala|betalar|swisha|swishar|överföra|överför|pay|send|transfer)\\s(?:[^\\s.!?\\n]+\\s){0,4}?(?:\\p{L}*avgift(?!sfri)\\w*|(?:\\p{L}+ )?fee)';
  var GETPAID = '(?:betalas ut|betala ut|betalar (?:vi |de )?ut|utbetal\\w*|få ut|ta ut|uttag\\w*|låsa upp|lås upp|frigör\\w*|lånet|lånebeloppet|pengarna|vinsten|beloppet|får (?:du )?tillbaka|får (?:du )?betalt|få betalt|release\\w*|withdraw\\w*|paid out|unlock\\w*|the loan|your (?:money|funds|winnings))';
  function W(src, flags) {
    return new RegExp('(^|[^\\p{L}\\p{N}])(' + src + ')(?![\\p{L}\\p{N}])', flags || 'giu');
  }
  var NEG = /(^|[^\p{L}])(aldrig|inte|ej|icke|never|not|don'?t|do not|utan att)(?![\p{L}])/iu;
  // "Glöm inte" and "tveka inte" push you to act, and so do conditions such as "om du inte" and
  // "kan inte ... utan att": they do not turn a request into a warning.
  var ENCOURAGE = /(?:glöm|tveka|missa|dröj|vänta)\s+(?:inte|ej|aldrig)|(?:don'?t|do not|never)\s+(?:forget|hesitate|miss|wait|delay)|(?:om|ifall|såvida|så länge)\s+(?:du|ni)\s+(?:inte|ej)|(?:inte|ej)(?:\s+[^\s.,;:!?]+){0,6}?\s+utan att|if you (?:do not|don'?t)|unless|(?:inte|ej)\s+bara|(?:inte|ej)(?:\s+[^\s.,;:!?]+){0,3}?\s+(?:annat|mer|mera|längre|senare)\s+än|(?:inte|ej)\s+(?:så\s+|särskilt\s+|alls\s+)?(?:lång|långt|länge|svårt|krångligt|komplicerat|konstigt|farligt|dyrt)(?![\p{L}])|oroa\s+(?:dig|er)\s+inte|var\s+inte\s+(?:orolig|rädd|nervös)|(?:don'?t|do not)\s+worry|not\s+only|no\s+more\s+than/giu;
  // A new clause starts after punctuation, after "men", "but" or "utan" (but not "utan att"),
  // and after "förrän", "innan" and "tills": "kan inte betalas ut förrän du har angett ..." is a demand.
  var CUT = /[,.;:!?\n()]|\s[–—-]\s|\s(?:men|but|utan(?!\s+att)|förrän|innan|tills|until|before)\s/giu;
  var AFTER_NEG = /^\s+(?:inte|aldrig|ej)(?![\p{L}])/iu;

  var RULES = [
    { id: 'safe_account', w: 3,
      title: 'Vill att du flyttar pengar för att ”skydda” dem',
      why: 'Det finns inga säkra konton. Ingen bank, polis eller myndighet ber dig någonsin flytta pengar för att skydda dem.',
      todo: 'Flytta inga pengar. Kontakta din bank själv om du är orolig.',
      re: [
        W('säkert konto|säkra konton|säkra kontot|skyddat konto|skyddade kontot|tryggt konto|säkerhetskonto\\w*|reservkonto\\w*|skyddskonto\\w*|spärrkonto\\w*|tillfälligt konto|ett konto (?:som )?(?:vi|polisen|banken|riksbanken|myndigheten) har öppnat|safe account|secure account'),
        W('(?:flytta|flyttar|för över|föra över|överför|överföra|sätt in|sätta in)[^.!?\\n]{0,25}(?:pengar\\w*|sparpengar\\w*|besparingar\\w*|kapital\\w*|saldo\\w*|tillgångar\\w*)[^.!?\\n]{0,40}(?:säker\\w*|skydd\\w*|trygg\\w*)'),
        W('move your (?:money|savings|funds)|transfer your (?:money|savings|funds)')
      ] },
    { id: 'remote', w: 3,
      title: 'Vill att du installerar en app för fjärrstyrning',
      why: 'Med en sådan app kan någon annan se och styra din telefon eller dator, och kommer då också åt din bank.',
      todo: 'Installera ingenting som någon annan ber dig om. Har du redan gjort det: koppla bort internet direkt och avinstallera appen.',
      re: [W('anydesk|any desk|teamviewer|team viewer|quicksupport|quick support|rustdesk|supremo|ultraviewer|zoho assist|splashtop|logmein|fjärrstyr\\w*|fjärråtkomst|fjärrhjälp|fjärrsupport|dela (?:din |er )?skärm(?:en)?|skärmdelning|remote access|remote support|share your screen|koppla upp (?:sig|mig|oss) (?:mot|till) (?:din |er )?(?:dator|telefon|mobil)\\w*|(?:se|styra|ta över) (?:din|er) (?:skärm|dator|telefon|mobil)\\w*|(?:see|control) your (?:screen|computer|device)')] },
    { id: 'tech_scare', w: 2,
      title: 'Påstår att din dator eller telefon har virus',
      why: 'Falska virusvarningar ska få dig att ringa en ”support” eller installera en app. Microsoft, Apple och andra företag ringer eller skickar aldrig sms om virus.',
      todo: 'Ring inte numret och installera ingenting. Är du orolig, fråga någon du känner som kan datorer.',
      re: [W('(?:din|er|datorn|telefonen|mobilen|enheten)(?: (?:dator|telefon|mobil|enhet))?[^.!?\\n]{0,30}(?:har blockerats|är blockerad|har låsts|är infekterad|är smittad|har infekterats|har hackats|är hackad|har virus)|virus\\w* (?:har )?(?:upptäckts|hittats|upptäckt|hittat)|(?:upptäckt|hittat) (?:ett |flera )?virus|teknisk support|(?:microsoft|apple|windows)[- ]?(?:support|säkerhet)|your (?:computer|device|phone) (?:is|has been) (?:infected|locked|hacked)|virus detected|skadlig (?:kod|programvara|trafik)|skadeprogram\\w*|malware|(?:microsoft|apple|windows)\\w* tekniska? (?:avdelning\\w*|support)')] },
    { id: 'secrecy', w: 3,
      title: 'Ber dig hålla det hemligt',
      why: 'Bedragare vill hindra dig från att prata med någon som kan avslöja bluffen. Riktiga banker och myndigheter säger aldrig så.',
      todo: 'Prata med någon du litar på innan du gör något.',
      re: [W('berätta inte (?:det |detta |något |nåt |om det |om detta )?(?:för|till) (?:någon|nån|banken|polisen|din familj|dina barn|personalen|kassan|mamma|pappa|mormor|morfar|farmor|farfar)|säg (?:inte|inget|ingenting) (?:om det |om detta )?(?:till|för) (?:någon|nån|banken|polisen|personalen|kassan|din familj|dina barn|mamma|pappa)|prata inte med (?:någon|nån|banken|polisen|din familj|dina barn|personalen)|ring inte (?:till )?(?:mamma|pappa|mormor|morfar|farmor|farfar|morsan|farsan|någon|nån|banken|polisen|dina föräldrar)|håll (?:det här|detta|det|affären|ärendet|betalningen) (?:hemligt|konfidentiellt|diskret|för dig själv)|(?:det här|detta) (?:måste )?stanna(?:r)? mellan oss|lägg inte på|inte berätta (?:det )?(?:för|om)|ingen (?:annan )?får veta|don\'?t tell|do not tell|keep (?:this|it) (?:secret|confidential|between us)|stanna kvar i (?:telefonen|luren|samtalet)|avsluta inte samtalet|(?:om|ifall) (?:banken|de|personalen|kassan|någon) frågar[^.!?\\n]{0,30}(?:säg|svara)|säg (?:att|till banken att|till personalen att) (?:pengarna|beloppet|uttaget) (?:ska|är)')] },
    { id: 'extortion', w: 3,
      title: 'Hotar att sprida bilder eller film på dig',
      why: 'Utpressningsmejl där någon påstår sig ha filmat dig eller tagit sig in i din dator skickas till tusentals adresser. Oftast finns ingen film. Den som betalar får bara nya krav.',
      todo: 'Betala inte och svara inte. Spara meddelandet och polisanmäl. Gäller det ett barn: kontakta polisen direkt.',
      re: [
        W('(?:annars|eller så|om du inte (?:betalar|gör det|svarar)|or|otherwise|or else|if you (?:do not|don\'?t) pay)\\s(?:[^.!?\\n]{0,40}?\\s)?(?:skickar|sprider|publicerar|delar|lägger ut|send|share|publish|leak|post|release)\\w*(?: \\p{L}+){0,4} (?:videon|videoklippet|filmen|filmerna|bilderna|bilden|inspelningen|the video|the videos|the photos|the pictures|the recording)'),
        W('(?:jag har|vi har) (?:hackat|full tillgång till|full kontroll över) (?:din|er) (?:dator|telefon|mobil|enhet|webbkamera|e-post|mejl)|(?:spelat in|filmat) dig (?:via|genom|med) (?:din |er )?(?:webbkamera\\w*|kamera\\w*)|i have (?:full access to|full control of|hacked) your (?:device|computer|phone|webcam|camera|email)|recorded you (?:through|with|via) your (?:webcam|camera)')
      ] },
    { id: 'code_mistake', w: 3,
      title: 'Påstår att en kod har skickats till dig av misstag',
      why: 'Det här är ett vanligt sätt att kapa WhatsApp- och e-postkonton. Koden är nyckeln till ditt konto.',
      todo: 'Ge aldrig bort en kod du har fått, oavsett vem som frågar.',
      re: [W('(?:skicka|skickade|skickat|fått|fick|kom)[^.!?\\n]{0,40}(?:kod|koden|koder)[^.!?\\n]{0,40}(?:av misstag|till fel nummer|felaktigt|av en slump)|råkade (?:ange|skriva in|skriva|använda|uppge|lägga in) ditt (?:nummer|telefonnummer|mobilnummer)|(?:sent|send)[^.!?\\n]{0,40}code[^.!?\\n]{0,30}(?:by mistake|wrong number)')] },
    { id: 'code_sms', w: 3, neg: true,
      title: 'Ber dig lämna en kod som du har fått',
      why: 'Koden i ett sms från banken eller en app är nyckeln till ditt konto. Den som får den kan logga in som du, till exempel i WhatsApp eller banken.',
      todo: 'Ge aldrig bort en kod du har fått, oavsett vem som frågar.',
      re: [
        W('(?:skicka|skickar|svara med|lämna|uppge|berätta|läs upp|läsa upp|ge mig|ge oss|vidarebefordra|dela|säg|säga)[^.!?\\n]{0,45}(?:engångskod\\w*|sms-?kod\\w*|verifieringskod\\w*|bekräftelsekod\\w*|säkerhetskod\\w*|aktiveringskod\\w*|inloggningskod\\w*|bank-?[il]d-?kod\\w*|koden (?:du (?:har )?fått|som (?:du )?(?:har )?fått|(?:som )?du (?:just |nyss |precis )?(?:har )?(?:fått|fick|får)|i sms\\w*|från (?:banken|sms\\w*)|vi (?:har )?skickat|vi skickade|som kom))'),
        W('(?:engångskod\\w*|sms-?kod\\w*|verifieringskod\\w*|bekräftelsekod\\w*|säkerhetskod\\w*|aktiveringskod\\w*|inloggningskod\\w*|en kod|koden)[\\s\\S]{0,90}?(?:läsa upp|läs upp|läser upp|skicka|skickar|vidarebefordra|berätta|säga|säg|ge mig|ge oss)\\s+(?:den|dem|koden|siffrorna)'),
        W('(?:sex|fyra|fem|åtta|6|4|5|8)[- ]?siffr\\w*[\\s\\S]{0,60}?(?:läsa upp|läs upp|skicka|skickar|vidarebefordra|berätta|säga|säg|ge mig)\\s+(?:dem|den|siffrorna|koden)'),
        W('(?:send|tell|share|forward|give|read)[^.!?\\n]{0,30}(?:verification code|one-time code|otp|6-digit code|six-digit code|code (?:you|we) (?:got|received|sent))')
      ] },
    { id: 'swish_receive', w: 3, neg: true,
      title: 'Säger att du måste göra något för att ta emot pengar',
      why: 'För att ta emot en Swish eller en vanlig överföring behöver du aldrig använda BankID, godkänna något eller lämna kortuppgifter. Ber någon dig godkänna något, är det i själva verket en betalning från dig.',
      todo: 'Godkänn ingenting och lämna inga uppgifter. Pengar som skickas till dig kommer in utan att du gör något.',
      re: [
        W('(?:ta emot|tar emot|få|motta)[^.!?\\n]{0,40}(?:swish\\w*|betalning\\w*|pengar\\w*|beloppet|ersättning\\w*|återbetalning\\w*|utbetalning\\w*)[^.!?\\n]{0,60}(?:bank[- ]?[il]d|godkänn\\w*|signera\\w*|legitimera\\w*|kortuppgifter\\w*|kortnummer|fyll i|logga in)'),
        W('(?:bank[- ]?[il]d|godkänn\\w*|signera\\w*|legitimera\\w*|bekräfta\\w*|verifiera\\w*|klicka|kortuppgifter\\w*|kortnummer|fyll i|logga in)[^.!?\\n]{0,60}(?:så får du|så kan du (?:få|ta emot)|och få|och ta emot|för att (?:kunna )?(?:få|ta emot|motta|få ut|ta ut)|så att du (?:kan|får)(?: få| ta emot)?|och sen (?:får|kan) du(?: få| ta emot)?|(?:sedan|sen|därefter|då) (?:får|kan) du(?: få| ta emot)?)[^.!?\\n]{0,30}(?:pengar\\w*|betalt|betalning\\w*|beloppet|swish\\w*|ersättning\\w*|återbetalning\\w*|utbetalning\\w*)'),
        W('(?:receive|get|claim)[^.!?\\n]{0,40}(?:payment|money|funds|refund)[^.!?\\n]{0,40}(?:card|bank ?[il]d|log ?in|verify|confirm)'),
        W('för att (?:pengarna|betalningen|beloppet|summan|swishen|överföringen) ska (?:komma in|nå dig|kunna betalas ut|betalas ut|frigöras|sättas in)[^.!?\\n]{0,60}(?:godkänn\\w*|bekräfta\\w*|signera\\w*|legitimera\\w*|verifiera\\w*|logga in|bank-?[il]d|kortuppgifter\\w*)')
      ] },
    { id: 'cards', w: 3, neg: true, ctx: /(?:^|[^\p{L}])(?:jag|vi)\s+$/iu, skip: /(?:våra|vårt|vår|our)\s+(?:\p{L}+\s+)?(?:bankuppgifter|kontouppgifter|kontonummer|bankgiro\w*|betalningsuppgifter|bank details|account details|banking details)/iu,
      title: 'Ber om kortuppgifter, lösenord eller personnummer',
      why: 'Banker, myndigheter och seriösa företag ber aldrig om kortuppgifter eller lösenord i sms, mejl eller chatt. Personnummer ska du bara lämna när du själv har kontaktat företaget.',
      todo: 'Lämna inga kortuppgifter, lösenord eller personnummer.',
      re: [
        W('(?:ange|anger|uppge|uppger|lämna|lämnar|skicka|skickar|svara med|svara på (?:detta|det här) (?:sms|meddelande|mejl)\\w* med|fyll i|fylla i|fyller i|skriv in|skriva in|bekräfta|bekräftar|verifiera|verifierar|uppdatera|uppdaterar|registrera|registrerar|lägg till|lägga till|dela|delar|knappa in|mata in|behöver (?:jag|vi)(?: få)?|vill (?:jag|vi) (?:ha|få)|måste (?:jag|vi) (?:ha|få))[^.!?\\n]{0,45}(?:kortuppgifter\\w*|kortnummer\\w*|kortinformation\\w*|kortdetaljer\\w*|betalkort\\w*|kreditkort\\w*|cvc|cvv|cvv2|bankuppgifter\\w*|kontouppgifter\\w*|kontonummer\\w*|clearingnummer\\w*|betalningsuppgifter\\w*|betaluppgifter\\w*|betalningsinformation\\w*|inloggningsuppgifter\\w*|lösenord\\w*|personnummer\\w*|personnr\\w*|pers\\.? ?nr|bankkortsnummer\\w*|kortets (?:nummer|siffror|giltighetstid|utgångsdatum)|numret på (?:ditt |ert )?(?:bank|betal|kredit)?kort(?:et)?|(?:tre|3) (?:sista )?siffr\\w* på (?:baksidan|kortets baksida)|siffrorna på baksidan|(?:sista )?siffr\\w* (?:i|av) (?:ditt|ert) personnummer)'),
        W('(?:jag|vi) (?:behöver|måste) (?:få |ha )?[^.!?\\n]{0,45}(?:kortuppgifter\\w*|kortnummer\\w*|bankkortsnummer\\w*|cvc|cvv|lösenord\\w*|inloggningsuppgifter\\w*|personnummer\\w*|personnr\\w*|pers\\.? ?nr)'),
        W('(?:enter|provide|confirm|update|send|share|verify|submit)[^.!?\\n]{0,45}(?:card (?:details|number|info\\w*)|cvv|cvc|password|bank (?:details|account)|payment (?:details|info\\w*)|login details|personal (?:identity|id) number|social security number)')
      ] },
    { id: 'police_pickup', w: 3, skip: /(?:hennes|hans|deras|sina|sitt|sin|mitt|min|mina|vårt|vår|våra)\s+(?:smycken|värdesaker|kontanter|pengar|guld|bankkort|kort)/iu,
      title: 'Säger att någon ska hämta kort, kontanter eller smycken',
      why: 'Polisen och banken hämtar aldrig kort, kontanter eller smycken hemma hos dig.',
      todo: 'Öppna inte dörren och lämna inte ifrån dig något. Ring 112 om någon är på väg.',
      re: [
        W('(?:polis\\w*|bank\\w*|kollega\\w*|bud\\w*|kurir\\w*|chaufför\\w*|taxi\\w*|väktare\\w*|vakt\\w*|courier|medarbetare\\w*|tekniker\\w*|handläggare\\w*|utredare\\w*)[^.!?\\n]{0,80}(?:hämta|hämtar|komma och hämta|förvara|förvarar|ta hand om|tar hand om|ta med sig|tar med sig|samla in)[^.!?\\n]{0,40}(?:smycken|värdesaker|kontanter|pengar\\w*|guld\\w*|\\s(?:bank|betal|kredit|konto)?kort(?:et|en)?)'),
        W('(?:vill|ska|kommer att|kommer och|måste|behöver)[^.!?\\n]{0,20}(?:ta med sig|hämta|förvara|ta hand om|samla in|lämna över|överlämna)[^.!?\\n]{0,40}(?:smycken|värdesaker|kontanter|guld\\w*|\\s(?:bank|betal|kredit|konto)?kort(?:et|en)?)'),
        W('hem till dig[^.!?\\n]{0,60}(?:hämta|hämtar|ta hand om|förvara|samla in)[^.!?\\n]{0,40}(?:smycken|värdesaker|kontanter|guld\\w*|bankkort\\w*|kortet|korten|koderna)')
      ] },
    { id: 'guaranteed', w: 3,
      title: 'Lovar garanterad eller orimligt hög vinst',
      why: 'Ingen investering är både snabb, enkel och säker, och ingen seriös placering ger flera procent i månaden. Den som lovar det försöker lura dig.',
      todo: 'Skicka inga pengar och lämna inga uppgifter.',
      re: [W('garanterad (?:avkastning|vinst|inkomst|ränta)|garanterat (?:avkastning|vinst|resultat)|riskfri\\w* (?:investering\\w*|avkastning|vinst)|helt utan risk|(?:avkastning|vinst|tjäna|tjänar|ger|gav|få|får|fick|ökar|ökade|växer|växte)[^.!?\\n]{0,40}\\d+(?:[,.]\\d+)? ?(?:%|procent) (?:i|per|varje|om) (?:månaden|månad|veckan|vecka|dagen|dag|dygnet)|guaranteed (?:returns?|profits?|income)|risk[- ]free|\\d+(?:[,.]\\d+)? ?(?:%|procent) (?:avkastning|ränta|vinst)\\w* (?:i|per|varje|om) (?:månaden|månad|veckan|vecka|dagen|dag|dygnet)|(?:insättning|investering|placering) på \\d[\\d  .]*\\s?(?:kr|kronor|sek|€|\\$|usd)[^.!?\\n]{0,60}?(?:nästa vecka|om en vecka|inom en vecka|på en vecka|i morgon|inom \\d+ dagar|på \\d+ dagar|om \\d+ dagar)[^.!?\\n]{0,30}?\\d[\\d  .]*\\s?(?:kr|kronor|sek|€|\\$|usd)')] },
    { id: 'advance_fee', w: 3, neg: true,
      title: 'Vill att du betalar en avgift för att få pengar',
      why: 'Ett lån, en vinst, en utbetalning eller ett uttag som kräver att du först betalar en avgift är ett känt bedrägeri. Pengarna kommer aldrig, och snart kommer krav på fler avgifter.',
      todo: 'Betala ingenting i förväg. Riktiga lån och utbetalningar kräver inga avgifter i förskott.',
      re: [
        W(PAYFEE + '[^.!?\\n]{0,60}?(?:så|för att|innan|sedan|sen|därefter|then|before|to|so)\\s[^.!?\\n]{0,30}?' + GETPAID),
        W(GETPAID + '[^.!?\\n]{0,60}?(?:behöver du|måste du|ska du|krävs|när du(?: har)?|you (?:must|need to|have to))\\s[^.!?\\n]{0,30}?' + PAYFEE),
        W(PAYFEE_NODEP + '[^.!?\\n]{0,60}?(?:får (?:du )?tillbaka (?:den|det|avgiften|pengarna|beloppet)|(?:will )?get (?:it|the fee|your money) back)'),
        W(GETPAID + '[^.!?\\n]{0,40}?mot en (?:\\p{L}+ )?(?:avgift|fee)\\w*'),
        W('\\p{L}*avgift\\w*[^.!?\\n]{0,20}i förskott|förskottsavgift\\w*|upfront fee|advance fee|pay (?:a fee )?(?:up ?front|in advance)')
      ] },
    { id: 'bankid_fix', w: 2.5, // R3: e-legitimation and English added

      title: 'Påstår att ditt BankID måste åtgärdas',
      why: 'Bedragare skickar ofta meddelanden om att BankID har spärrats eller måste förnyas. Ett spärrat BankID går inte att låsa upp, och nytt BankID skaffar du bara via din bank, aldrig via en länk eller för att någon i telefon säger åt dig.',
      todo: 'Skaffa eller förnya BankID bara via din banks app eller internetbank, som du öppnar själv.',
      re: [
        W('(?:förnya|förnyar|aktivera|aktiverar|återaktivera|reaktivera|uppdatera|uppdaterar|lås upp|låsa upp)[^.!?\\n]{0,45}' + EID),
        W('(?:' + EID + '|e-?legitimation\\w*)[^.!?\\n]{0,45}(?:spärrat|spärrats|spärras|blockerat|blockerats|blockeras|upphör|går ut|har gått ut|löper ut|har löpt ut|ogiltigt|ogiltig|inaktiverat|inaktiveras|måste förnyas|behöver förnyas|(?:måste|behöver) (?:uppdateras|aktiveras|verifieras|bekräftas)|kommer att (?:spärras|inaktiveras|sluta fungera)|slutar (?:att )?fungera|stängs av|har stängts av|avslutas)'),
        W(EID + '[^.!?\\n]{0,30}(?:will be |has been |is |was )(?:suspended|blocked|deactivated|disabled|locked|expired)|(?:renew|reactivate|unlock|reset) your bank ?[il]d')
      ] },
    { id: 'bankid_use', w: 2.5, neg: true,
      title: 'Ber dig använda BankID',
      why: 'BankID är din digitala namnteckning. Den som får dig att legitimera dig eller skriva under kan logga in som du, ta lån och tömma konton.',
      todo: 'Använd BankID bara när du själv har startat något, aldrig för att någon annan ber dig.',
      re: [
        W('(?:legitimera|legitimerar|identifiera|identifierar|signera|signerar|godkänn|godkänna|godkänner|logga(?:r)?(?: du| ni)? in|skriv(?:a|er)?(?: du| ni)? under|bekräfta|bekräftar|verifiera|verifierar|skanna|scanna|läs av)[^.!?\\n]{0,45}' + EID),
        W(EID + '[^.!?\\n]{0,50}(?:skanna(?:r)?|scanna(?:r)?|legitimera(?:r)?|identifiera(?:r)?|signera(?:r)?|godkänn\\w*|logga(?:r)?(?: du| ni)? in|skriv(?:a|er)?(?: du| ni)? under|bekräfta(?:r)?|verifiera(?:r)?)'),
        W('(?:legitimera|identifiera|signera|verifiera|bekräfta) dig (?:i|med|via|genom) (?:appen|bank-?appen|mobilen|telefonen|' + BID + ')'),
        W('(?:verify|confirm|sign|log ?in|identify|approve|scan)[^.!?\\n]{0,45}bank ?[il]d'),
        W('ha (?:ditt|din|ert|er) ' + EID + ' (?:redo|framme|till hands|i närheten)')
      ] },
    { id: 'bankid_claim', w: 2.5,
      title: 'Säger sig komma från BankID',
      why: 'BankID är en app i din telefon, inte någon som ringer eller skickar sms. Den som säger sig vara från BankID är en bedragare.',
      todo: 'Lägg på eller svara inte. Kontakta din bank själv om du är orolig.',
      re: [W('(?:från|ringer från|ringer dig från|kontaktar dig från|hälsningar från|mvh|vi på) ' + EID + '(?:s? (?:support|säkerhet\\w*|kundtjänst|teamet))?|' + EID + '[- ]?(?:support|teamet|kundtjänst|säkerhetsteam\\w*|säkerhetsavdelning\\w*)')] },
    { id: 'code', w: 2.5, neg: true,
      title: 'Ber dig lämna en kod',
      why: 'Koder från banken eller appar är bara till dig. Den som får koden kan ta över ditt konto, till exempel WhatsApp eller e-post.',
      todo: 'Ge aldrig bort en kod du har fått, inte ens till någon som säger sig vara en vän eller från banken.',
      re: [
        W('(?:skicka|skickar|svara med|lämna|uppge|berätta|läs upp|ge mig|ge oss|vidarebefordra|dela|säg|säga)[^.!?\\n]{0,45}(?:koden|koderna|kod|engångskod\\w*|sms-kod\\w*|verifieringskod\\w*|bekräftelsekod\\w*|säkerhetskod\\w*|pinkod\\w*|pin-kod\\w*|siffrorna)'),
        W('(?:send|tell|share|forward|give)[^.!?\\n]{0,45}(?:the code|code|pin|otp|verification code)')
      ] },
    { id: 'gift_card', w: 2.5,
      title: 'Vill att du betalar med presentkort',
      why: 'Presentkort går inte att spåra eller få tillbaka. Därför är de populära hos bedragare.',
      todo: 'Betala aldrig med presentkort till någon du inte känner.',
      re: [
        W('(?:köp|köpa|köper|betala med|betalar med|skicka|skickar)[^.!?\\n]{0,45}(?:presentkort\\w*|gift ?cards?|itunes|google play|steam-?kort\\w*|paysafecard|apple-?kort\\w*|app store-kort\\w*|neosurf|amazon-?kort\\w*)'),
        W('(?:presentkort\\w*|gift ?cards?)[^.!?\\n]{0,45}(?:kod|koden|koderna|code)')
      ] },
    { id: 'mistaken_payment', w: 2.5, skip: /kod|code/iu,
      title: 'Påstår att pengar har skickats till dig av misstag',
      why: 'Bedragare säger att de har swishat dig av misstag och ber dig skicka tillbaka. Ofta har inga pengar kommit in, eller så kommer de från ett annat bedrägeri.',
      todo: 'Kolla i din bank om pengarna verkligen har kommit in. Skicka inget tillbaka själv. Kontakta banken.',
      re: [W('(?:swishade|swishat|skickade|skickat|betalade|betalat|överförde|fört över|förde över|satte in|satt in)[^.!?\\n]{0,40}(?:av misstag|till fel (?:nummer|person|konto)|felaktigt|av en slump)|(?:råkat|råkade) (?:swisha|betala|föra över|överföra|sätta in)|swisha tillbaka (?:dem |pengarna |beloppet )?till (?:min|mitt|ett annat|en annan|detta|det här)|(?:sent|paid|transferred)[^.!?\\n]{0,30}(?:by mistake|by accident|to the wrong)')] },
    { id: 'new_number', w: 2.5,
      title: 'Påstår sig ha ett nytt nummer',
      why: 'Så börjar ”Hej mamma”-bluffen. Någon låtsas vara en anhörig med ny telefon och ber snart om pengar.',
      todo: 'Ring personen på det vanliga numret, eller ställ en fråga som bara hen kan svara på.',
      re: [W('nytt nummer|nya nummer|nytt mobilnummer|nytt telefonnummer|ny telefon|ny mobil|tappat (?:min (?:telefon|mobil)|mobilen|telefonen)|tappade (?:min (?:telefon|mobil)|mobilen|telefonen)|(?:telefonen|mobilen|min telefon|min mobil) (?:gick|är|har gått) sönder|(?:telefonen|mobilen|min telefon|min mobil|min) är på (?:lagning|reparation|service)|skriver från (?:min |en |mitt )?(?:jobbtelefon\\w*|jobbmobil\\w*|kompis\\w* (?:telefon|mobil)|väns (?:telefon|mobil)|lånad\\w* (?:telefon|mobil)|annan (?:telefon|mobil))|spara (?:detta|det här|mitt|det nya) (?:nummer|numret|nya nummer)|spara numret|lånad telefon|lånar (?:en )?kompis(?:ens)? (?:telefon|mobil)|bytt nummer|new number|lost my phone|broke my phone|save (?:this|my) (?:new )?number|(?:using|on|borrowed) (?:a |my )?friend\'?s (?:phone|mobile)')] },
    { id: 'cant_pay_self', hidden: true,
      title: 'Säger att hen inte kommer åt sin bank',
      why: 'Den som skriver från ett nytt nummer och säger att BankID eller banken inte fungerar vill oftast att du betalar åt hen. Så brukar ”Hej mamma”-bluffen gå till.',
      todo: 'Ring personen på det vanliga numret innan du betalar något.',
      re: [W('(?:(?:har|hade) (?:inte|inget|ingen)|inte (?:har|hade)(?: något)?) (?:bank-?[il]d|tillgång till (?:banken|mitt konto|min bank|bank-?[il]d|swish))|(?:kommer|har) inte (?:kommit )?åt (?:banken|min bank|mitt konto|bank-?[il]d|swish|bankappen|internetbanken)|(?:mitt )?(?:bank-?[il]d|bankappen|swish) (?:funkar|fungerar) inte|(?:my )?bank(?:ing)? app (?:doesn\'?t|does not|isn\'?t) work\\w*|can\'?t (?:access|log ?in to|get into) my (?:bank|account)|my (?:bank )?card (?:is|has been|got|was) (?:blocked|frozen|stopped)|(?:mitt (?:bank)?kort|kortet) (?:är|har blivit) spärrat')] },
    { id: 'security_dept', w: 2, ctx: /bedragare|bluffare|utger sig|påstår sig|låtsas|scammers?|pretend/iu,
      title: 'Hänvisar till en ”säkerhetsavdelning”',
      why: 'Falska säkerhetsavdelningar är ett av de vanligaste knepen. När du ringer upp svarar bedragaren och ber dig använda BankID.',
      todo: 'Ring din bank på numret som står på bankens webbplats eller på ditt kort.',
      re: [W('säkerhetsavdelning\\w*|bedrägeriavdelning\\w*|bedrägerienhet\\w*|säkerhetsenhet\\w*|säkerhetsteam\\w*|spärravdelning\\w*|fraud (?:department|team|unit)|security (?:department|team)')] },
    { id: 'account_problem', w: 2,
      title: 'Påstår att något är fel som du måste rätta',
      why: 'Ett påstått problem med kontot, kortet eller adressen är ett vanligt sätt att få dig att logga in på en falsk sida eller ringa ett falskt nummer.',
      todo: 'Öppna appen eller webbplatsen själv, inte via meddelandet, och se om något verkligen är fel.',
      re: [
        W('(?:misstänkt|misstänkta|ovanlig|ovanliga|obehörig|obehöriga|okänd|okända|avvikande|konstig|konstiga|märklig|märkliga) (?:aktivitet\\w*|inloggning\\w*|transaktion\\w*|köp|användning|betalning\\w*|enhet|överföring\\w*|uttag\\w*)'),
        W('(?:ditt|ert|din|er) (?:\\p{L}+-)?(?:konto|kort|bankkort|abonnemang|e-postkonto|mejlkonto|profil|medlemskap)[^.!?\\n]{0,30}(?:spärrat|spärrats|spärras|låst|låsts|låses|stängt|stängts|stängs|blockerat|blockerats|blockeras|inaktiverat|inaktiveras|avstängt|avstängd|fryst|frysts|begränsat|begränsats|pausat|pausats|hackat|hackats|kapat|kapats)'),
        W('(?:ditt|ert) (?:medlemskap|konto) (?:avslutas|kommer att avslutas|har avslutats)'),
        W('(?:ditt|ert) lösenord[^.!?\\n]{0,20}(?:löper ut|går ut|har gått ut|upphör)|password[^.!?\\n]{0,20}(?:expires?|has expired)|säkerhetsproblem|säkerhetsåtgärd\\w*|(?:uppdatera|bekräfta|verifiera|kontrollera|validera|säkra|se över)(?:r)? (?:dina|era|ditt|ert|din|er|mina) (?:uppgifter|konto|identitet|information|betalningsuppgifter|kontouppgifter|profil|adress|leveransadress|adressuppgifter|kontaktuppgifter|personuppgifter|kunduppgifter|betalningsmetod|betalsätt)'),
        W('(?:ditt|ert) (?:kort|bankkort|konto|kreditkort) har (?:använts|missbrukats|kapats|hackats|spärrats|låsts)'),
        W('ofullständig (?:adress|leveransadress|adressinformation|adressuppgift\\w*)|felaktig (?:adress|leveransadress|adressuppgift\\w*)|(?:din |er )?(?:adress|adressen|leveransadress|leveransadressen)[^.!?\\n]{0,20}(?:är ofullständig|är felaktig|saknas)|ny enhet har (?:lagts till|registrerats|kopplats|anslutits)'),
        W('unusual activity|suspicious (?:activity|login|sign-in)|account (?:has been |is |was )?(?:locked|suspended|limited|disabled|compromised)|verify your (?:account|identity|information)|update your (?:payment|billing|account)')
      ] },
    { id: 'debt', w: 2,
      title: 'Hotar med skuld, böter eller Kronofogden',
      why: 'Hot om skulder och böter ska skrämma dig att betala snabbt. Kontrollera alltid själv, till exempel på kronofogden.se eller hos företaget.',
      todo: 'Betala inget via meddelandet. Kontrollera skulden själv, på ett sätt du väljer.',
      re: [W('obetald\\w* (?:skuld\\w*|faktura\\w*|räkning\\w*|avgift\\w*|böter|parkeringsavgift\\w*|skatt|vägtull\\w*|trängselskatt|trafikbot\\w*|parkeringsbot\\w*)|skuld (?:hos|till)|betalningskrav\\w*|betalningspåminnelse\\w*|kravbrev\\w*|restskatt\\w*|tilläggsavgift\\w*|inkasso\\w*|utmätning\\w*|betalningsanmärkning\\w*|betalningsföreläggande\\w*|trafikbot\\w*|parkeringsbot\\w*|fortkörningsbot\\w*|ordningsbot\\w*|böter|bötesbelopp\\w*|kontrollavgift\\w*|rättsliga åtgärder|stämning|(?:skickas|lämnas|överlämnas|går|gå vidare|går vidare|vidare) till kronofogden|skatteskuld\\w*|indrivning\\w*|debt collect\\w*|legal action|unpaid (?:invoice|bill|fee|toll|fine)|outstanding (?:amount|balance|toll|payment)|toll road|late fee')] },
    { id: 'legal_threat', w: 2,
      title: 'Hotar med polis, åtal eller domstol',
      why: 'Falska kallelser från ”polisen”, ”Europol” eller en domstol ska skrämma dig att svara, betala eller lämna uppgifter. Riktiga kallelser kommer inte som sms eller mejl med krav på snabbt svar.',
      todo: 'Svara inte. Vill du kontrollera, ring polisen på 114 14.',
      re: [W('kallats till förhör|kallelse till förhör|kallad till förhör|efterlys\\w*|warrant (?:has been issued )?for your arrest|you are (?:now )?wanted|(?:har använts|användes) (?:vid|i|för) (?:ett |flera )?(?:allvarligt |grovt )?brott|(?:has been|was) used in (?:a |an )?(?:serious )?crime|förhör (?:hos|på|med) polisen|åklagar\\w*|åtal\\w*|rättegång\\w*|arresteringsorder|häktningsorder|anhållningsorder|brottsmisstänkt|misstänkt för (?:brott|bedrägeri|penningtvätt)|penningtvätt|europol|interpol|polisanmäl\\w* (?:dig|er)|arrest warrant|court summons|legal proceedings')] },
    { id: 'lure', w: 2,
      title: 'Lockar med pengar, vinst eller gåva',
      why: 'Löften om pengar tillbaka, vinster eller gåvor är ett vanligt lockbete för att komma åt dina kortuppgifter.',
      todo: 'Kontrollera själv hos avsändaren. Pengar du har rätt till får du utan att lämna kortuppgifter.',
      re: [W('skatteåterbäring\\w*|återbäring\\w*|återbetalning\\w*|pengar tillbaka|pengar att få tillbaka|(?:få|får) tillbaka \\d[\\d  ]* ?(?:kr|kronor)|betalat för mycket|överskjutande skatt|du har vunnit|du har valts ut|(?:har )?blivit utvald\\w*|du är utvald|vinnare|belöning\\w*|lojalitetsbonus|gratis (?:iphone|ipad|presentkort|produkt\\w*|gåva)|ett presentkort|presentkort (?:på|värt)|kundundersökning\\w*|bortglömd\\w* (?:pension|pengar)|pengar att hämta|outtagna pengar|unclaimed (?:money|funds)|refund\\w*|you (?:have )?won|winner|congratulations|reward|free gift|claim your')] },
    { id: 'investment', w: 2,
      title: 'Handlar om investering eller snabba pengar',
      why: 'Investeringsbedrägerier lockar med hög avkastning, ofta via falska kändisannonser eller en ”mentor”. Pengarna försvinner och sedan kommer krav på mer.',
      todo: 'Investera aldrig via någon som har kontaktat dig. Kontrollera företaget på fi.se.',
      re: [W('passiv inkomst|tjäna (?:pengar|stora pengar|massor|extra) (?:snabbt|hemifrån|enkelt|på nätet)|dubbla (?:dina|era) pengar|investera\\w*|investering(?!ssparkonto)\\w*|krypto\\w*|bitcoin|ethereum|digitala tillgångar|tradingrobot\\w*|börsrobot\\w*|ai-?robot\\w*|ai[- ]trading|ai-?handel\\w*|ai-?plattform\\w*|tradingplattform\\w*|handelsplattform\\w*|startinsättning\\w*|minsta insättning\\w*|bankerna (?:är )?(?:rasande|hatar|vill inte)|banks hate|(?:avslöjar|avslöjade|berättar|reveals?) (?:hur|how)[^.!?\\n]{0,40}(?:tjän\\w*|blev rik|rik på|earn\\w*|got rich)|(?:mentor|coach)[^.!?\\n]{0,40}(?:tjäna|pengar|investera|trading|avkastning)|aktietips|forex|minsta (?:belopp\\w*|insättning\\w*|investering\\w*)|(?:fond\\w*|portfölj\\w*)[^.!?\\n]{0,40}(?:ger|kommer att ge|kan ge|lovar|garanterar|väntas ge)[^.!?\\n]{0,20}\\d+ ?(?:%|procent)|passive income|double your money|crypto\\w*|investment\\w*')] },
    { id: 'easy_money', w: 2,
      title: 'Lovar mycket pengar på kort tid',
      why: 'Löften om att tjäna tusentals kronor om dagen eller i veckan, utan att det framgår hur, är typiska för investerings- och jobbluffar.',
      todo: 'Svara inte. Ingen seriös arbetsgivare eller investering lovar sådana summor i ett oväntat meddelande.',
      re: [W('(?:tjäna|tjänar|tjänade) \\d[\\d  .,–-]* ?(?:kr|kronor|sek|:-|\\$|€)? ?(?:per|om|i|varje|på en) (?:dag|dagen|timme|timmen|vecka|veckan|månad|månaden)|(?:lön|lönen|ersättning|ersättningen|inkomst|betalt|arvode)\\s(?:(?:är|blir|ligger på)\\s)?(?:på\\s)?(?:upp till\\s|mellan\\s|cirka\\s|ca\\s)?\\d[\\d  .,–-]* ?(?:kr|kronor|sek|:-|\\$|€|usd|eur)? ?(?:per|om|i|varje|/) ?(?:dag|dagen|vecka|veckan)|(?:får|tjänar|betalar vi|ger vi) (?:du )?(?:upp till |mellan |minst )?\\d[\\d  .,–-]* ?(?:kr|kronor|sek|:-|\\$|€)? ?(?:per|om|i|varje|/) ?(?:dag|dagen|vecka|veckan)|earn\\w* \\$?\\d[\\d,.]*(?:[–-]\\$?\\d[\\d,.]*)? ?(?:usd|sek|eur|dollars?|kr)? ?(?:per (?:day|hour|week|month)|a (?:day|week)|every (?:day|week)|daily|weekly)')] },
    { id: 'task', w: 3,
      title: 'Erbjuder betalt för att gilla eller titta på klipp',
      why: 'Det här är ett känt bedrägeri. Först får du små summor, sedan måste du sätta in egna pengar för att få ut din ”lön”, och de pengarna försvinner.',
      todo: 'Svara inte. Riktiga arbetsgivare betalar inte för att du gillar klipp och kräver aldrig att du sätter in pengar.',
      re: [W('(?:betalt|ersättning|provision|\\d+ ?kr|\\$\\d+)[^.!?\\n]{0,30}(?:per|för varje) (?:gillad\\w*|gilla-?markering\\w*|like|klipp|video\\w*|uppgift|recension\\w*|betyg\\w*|omdöme\\w*|order|beställning\\w*|review\\w*|rating\\w*|task\\w*)|låsa upp (?:nästa|en högre) nivå|unlock the next level|för varje (?:\\p{L}+ ){0,2}(?:du |som du )(?:recenserar|gillar|betygsätter|tittar på|delar|klickar på|laddar upp)|for (?:each|every) (?:\\w+ ){0,2}(?:you )?(?:review|like|rate|watch)\\w*|(?:ge (?:dem|det|klippen|videorna|inläggen) tummen upp|gilla (?:videor|videos|klipp)|titta på (?:korta )?(?:klipp|videor|videos))[\\s\\S]{0,80}?(?:betalt|ersättning|provision|\\d+ ?kr|tjäna)|(?:betalt|tjäna pengar|ersättning|lön) för att (?:gilla|titta|recensera|betygsätta|skriva recensioner|följa)|gilla (?:videor|videos|klipp)|like videos|paid (?:to|for) (?:like|watch|review)\\w*|per like')] },
    { id: 'job', w: 2,
      title: 'Jobberbjudande som låter för bra',
      why: 'Falska jobb lockar med lätta pengar för enkla uppgifter. Snart måste du ”sätta in pengar” för att få ut din lön.',
      todo: 'Svara inte. Riktiga arbetsgivare kräver aldrig att du betalar något.',
      re: [W('extrajobb|deltidsjobb|deltidsuppdrag|distansjobb|onlinejobb|online-jobb|jobba hemifrån|jobb hemifrån|arbeta hemifrån|flexibelt (?:jobb|arbete|extrajobb|distansjobb)|work from home|part[- ]time (?:job|jobs|work\\w*|online|position)|online (?:job|jobs|work\\w*)')] },
    { id: 'mule', w: 2.5,
      title: 'Vill använda ditt konto för andras pengar',
      why: 'Den som tar emot pengar och skickar dem vidare åt någon annan blir en del av penningtvätt och kan själv bli polisanmäld. Bedragare lockar med ”extrajobb” eller en procentsats.',
      todo: 'Säg nej. Låt aldrig någon annan använda ditt konto, ditt kort eller din Swish.',
      re: [W('ta emot (?:betalningar|pengar|överföringar|swish\\w*)[^.!?\\n]{0,60}(?:för vidare|föra vidare|skicka vidare|skickar vidare|för över dem|vidarebefordra\\w*|överföra dem)|(?:låna ut|hyra ut) ditt (?:konto|bankkonto|swish\\w*|bankkort)|(?:sätter in|sätta in|för över|skickar|överför) pengar (?:på|till) ditt (?:bank)?konto[^.!?\\n]{0,80}(?:tar ut|ta ut|för vidare|föra vidare|skickar vidare|skicka vidare|lämnar|swishar vidare)|(?:receive|accept) (?:payments|money|funds|transfers)[^.!?\\n]{0,60}(?:forward|transfer (?:it|them)|send (?:it|them) on)')] },
    { id: 'new_account', w: 2,
      title: 'Säger att betalningar ska gå till ett nytt konto',
      why: 'Bedragare kapar eller förfalskar mejl från leverantörer och chefer och ber dig betala till ett nytt kontonummer eller bankgiro. Pengarna går då till bedragaren.',
      todo: 'Ring avsändaren på ett nummer du redan har och kontrollera innan du betalar.',
      re: [W('(?:nytt|nya|ändrat|ändrade) (?:kontonummer|bankgiro\\w*|plusgiro\\w*|kontouppgifter|bankuppgifter|betalningsuppgifter)|(?:vi )?har (?:bytt|ändrat|uppdaterat) (?:bank|bankgiro|kontonummer|konto|våra bankuppgifter|våra kontouppgifter)|(?:vi )?har bytt (?:bank|bankgiro|kontonummer|konto)|new (?:bank )?(?:account|banking) details|(?:changed|updated) (?:our )?(?:bank|account|banking) details')] },
    { id: 'payment_request', w: 1.5,
      title: 'Nämner en betalningsförfrågan',
      why: 'En betalningsförfrågan i Swish betyder att du ska betala, inte att du får pengar. Bedragare påstår ofta motsatsen.',
      todo: 'Läs noga i Swish vem som betalar till vem innan du godkänner något.',
      re: [W('betalningsförfrågan|betalförfrågan|swish-?förfrågan|förfrågan i swish')] },
    { id: 'money_request', w: 1.5,
      title: 'Ber dig skicka pengar',
      why: 'En oväntad begäran om pengar, särskilt via Swish, är ett av de vanligaste tecknen på bedrägeri. En Swish-betalning går inte att ångra.',
      todo: 'Skicka inga pengar bara för att någon ber om det i ett meddelande.',
      re: [
        W('(?:kan du|skulle du kunna|kan ni|snälla|jag behöver|behöver|måste du)[^.!?\\n]{0,45}(?:swisha|låna mig|låna ut|betala|föra över|överföra|skicka pengar|lägga ut|sätta in pengar)'),
        W('swisha (?:mig |hit |till mig |till det här numret )?\\d[\\d  ]*(?:kr|kronor|:-|sek)?|swisha (?:mig|hit|till mig|till det här numret)'),
        W('(?:jag behöver|behöver|måste få|behöver låna)[^.!?\\n]{0,30}\\d[\\d  ]* ?(?:kr|kronor|:-|sek|euro|dollar|pund)'),
        W('(?:kan du|skulle du kunna|snälla)[^.!?\\n]{0,20}(?:skicka|föra över|överföra|sätta in|swisha) \\d[\\d  ]* ?(?:kr|kronor|sek|:-|euro|€|dollar|\\$|pund|£)'),
        W('hjälp med pengar|låna pengar|behöver pengar|skicka pengar|hjälpa mig med (?:en |lite )?(?:betalning|räkning|pengar|faktura)|skicka tillbaka (?:dem|pengarna|beloppet|summan)'),
        W('(?:can you|could you|please|i need)[^.!?\\n]{0,45}(?:send|transfer|lend|pay)[^.!?\\n]{0,30}(?:money|\\$|€|£|\\d)'),
        W('(?:can you|could you|please)[^.!?\\n]{0,20}help me (?:to )?pay|help me pay (?:a|my|the|this) (?:bill|invoice|rent)')
      ] },
    { id: 'urgency', w: 1.5,
      title: 'Försöker stressa dig',
      why: 'Tidspress är bedragarens viktigaste verktyg. Den som är stressad hinner inte tänka efter.',
      todo: 'Ta det lugnt. Riktiga banker och myndigheter ger dig tid att tänka.',
      re: [W('inom (?:\\d+|en|ett|två|tre|fyra|fem|sex|tolv|tjugofyra|fyrtioåtta) ?(?:timme|timmar|tim|h|minuter|min)|inom (?:[1-7]|en|ett|två|tre|fyra|fem|sex|sju) ?(?:dagar|dygn)|(?:du|ni) har (?:\\d+|en|ett|två|tre|tolv|tjugofyra|fyrtioåtta|sjuttiotvå) ?(?:timme|timmar|tim|h|dagar|dygn|minuter) på (?:dig|er)|you have \\d+ (?:hours|days|minutes) to|(?:går ut|löper ut|upphör|stängs(?: av)?|spärras|raderas|förfaller|expires?) (?:i dag|idag|i kväll|ikväll|today|tonight)|omedelbart|omgående|snarast(?: möjligt)?|genast|med en gång|brådskande|akut|sista (?:påminnelse\\w*|varning\\w*|chans\\w*|dagen)|senast (?:idag|i dag|ikväll|i kväll|imorgon|i morgon)|innan midnatt|före midnatt|annars (?:kommer|stängs|spärras|blir|förlorar|går|tas|debiteras|skickas|raderas|returneras|överlämnas|lämnas|anmäls|polisanmäls|åtalas|förfaller)|för att undvika|kommer (?:att )?(?:spärras|stängas|avslutas|raderas|blockeras|returneras|debiteras|förfalla|skickas till inkasso|lämnas till inkasso|överlämnas|polisanmälas)|det brådskar|så fort (?:som möjligt|du kan)|så snabbt (?:som möjligt|du kan)|skynda (?:dig|på)|urgent\\w*|immediately|to avoid (?:a |an |any |further )?(?:penalty|penalties|late fee|fees?|suspension|arrest|charges|legal action|prosecution)|om (?:du|ni) inte[^.!?\\n]{0,50}(?:i dag|idag|i kväll|ikväll|omgående|genast|direkt|inom \\d+)|within \\d+ ?(?:hours|hrs|h|days)|final (?:notice|reminder|warning)|act now|last chance|expires? today')] },
    { id: 'stop_pretext', w: 1.5,
      title: 'Säger att du måste göra något för att stoppa ett köp eller lån',
      why: 'Ett påstått köp eller lån som bara du kan stoppa är ett vanligt knep. Det du godkänner då är ofta själva bedrägeriet.',
      todo: 'Gör ingenting via meddelandet eller samtalet. Logga in i bankens app själv och se om något har hänt.',
      re: [W('(?:för att|så att vi kan|så vi kan|så kan vi) (?:kunna )?(?:stoppa|avbryta|spärra|förhindra|neka|makulera|annullera|blockera|häva|återkalla) (?:köpet|köpen|lånet|lånen|ett köp|ett lån|betalningen|betalningarna|överföringen|överföringarna|transaktionen|transaktionerna|ansökan|låneansökan|uttaget|dem|det)|så (?:stoppar|makulerar|spärrar|avbryter|annullerar|blockerar|nekar) vi (?:dem|det|köpet|köpen|lånet|lånen|betalningen|betalningarna|ansökan|kortet|överföringen)|(?:to|so we can) (?:stop|cancel|block|reverse) (?:the |this |a )?(?:payment|purchase|transaction|loan|transfer)')] },
    { id: 'call_number', w: 1.5,
      title: 'Ber dig ringa ett nummer i meddelandet',
      why: 'Numret kan gå direkt till bedragaren, som sedan låtsas vara banken eller en myndighet.',
      todo: 'Ring inte numret i meddelandet. Leta upp numret själv, till exempel på avsändarens riktiga webbplats.',
      re: [W('(?:ring|ringa|ringer|ring upp|ring tillbaka|kontakta|kontakta oss|hör av dig|höra av dig|slå en signal|nås på|call|contact us)[^.!?\\n]{0,40}?(?:\\+\\d{1,3}[ -]?)?\\(?0?\\d{1,4}\\)?[\\d -]{5,}\\d')] },
    { id: 'pay_by_phone', w: 1.5,
      title: 'Vill att du betalar eller lämnar uppgifter per telefon',
      why: 'Fraktbolag, banker och myndigheter tar inte betalt eller frågar efter kortuppgifter via ett nummer i ett sms. Numret går ofta till bedragaren, även när meddelandet också har en riktig länk.',
      todo: 'Ring inte numret. Betala bara i företagets egen app eller på webbplatsen, som du öppnar själv.',
      re: [W('(?:ring|ringa|ring upp|kontakta|hör av dig)[^.!?\\n]{0,60}(?:för att|så kan du|och) (?:betala|lämna|uppge|ange|bekräfta) (?:avgift\\w*|tull\\w*|frakt\\w*|beloppet|skulden|dina|ditt|din|kort\\w*)')] },
    { id: 'press_key', hidden: true, re: [W('tryck(?: nu)?(?: på)? (?:siffran )?(?:\\d|ett|två|tre|fyra|fem|sex|sju|åtta|nio|noll|stjärna|fyrkant|en siffra|en knapp|valfri knapp)|press (?:now )?(?:\\d|one|any key|a key|a button)')] },
    { id: 'rental', w: 2,
      title: 'Bostaden kan inte visas, men du ska betala',
      why: 'Falska hyresvärdar är ofta ”utomlands”, kan inte visa bostaden och vill ha hyra och deposition innan du har sett den. Nycklarna kommer aldrig.',
      todo: 'Betala aldrig för en bostad du inte har sett. Kontrollera att hyresvärden äger bostaden.',
      re: [W('(?:skickar|skicka|postar)(?: jag| vi)? (?:nycklarna|nyckeln)|nycklarna (?:skickas|kommer|postas) (?:med|via|per)|(?:kan|går) inte (?:att )?visa (?:lägenheten|bostaden|huset|rummet)|visning (?:går inte|är inte möjlig|kan inte ordnas)|för (?:bådas|vår|vår båda|vår gemensamma) (?:säkerhet|trygghet)|for (?:both of )?our (?:safety|security)')] },
    { id: 'reply_for_link', w: 2.5,
      title: 'Vill att du svarar för att få en länk',
      why: 'Många telefoner gör inte länkar från okända avsändare klickbara. Därför ber bedragare dig svara, så att länken börjar fungera. Inget seriöst företag gör så.',
      todo: 'Svara inte. Kolla leveransen eller ärendet i företagets egen app.',
      re: [W('svara (?:med )?(?:1|ja|y|yes|ok)(?![\\p{L}\\p{N}])[^.!?\\n]{0,40}länk\\w*|(?:reply|respond) (?:with )?(?:y|yes|1)(?![\\p{L}\\p{N}])[^.!?\\n]{0,40}link\\w*|(?:aktivera|öppna) länken genom att svara')] },
    { id: 'qr', w: 1.5,
      title: 'Ber dig skanna en QR-kod',
      why: 'En QR-kod kan leda till en falsk sida eller starta en BankID-inloggning åt någon annan.',
      todo: 'Skanna bara QR-koder när du själv har startat något, till exempel en inloggning på datorn.',
      re: [W('(?:skanna|scanna|läs av|scan)[^.!?\\n]{0,30}qr[- ]?kod\\w*|qr[- ]?kod\\w*[^.!?\\n]{0,30}(?:skanna|scanna|läs av)|scan (?:the )?qr')] },
    { id: 'wrong_number', w: 2,
      title: 'En okänd person vill börja prata',
      why: 'Ett meddelande som ”råkade” gå till fel nummer är ofta början på en kärleks- eller investeringsbluff.',
      todo: 'Svara inte på meddelanden från okända som vill börja prata.',
      re: [
        W('fel nummer|är det här rätt nummer|jag hittade ditt nummer|ditt nummer i min telefon|kommer du ihåg mig|jag tror (?:att )?jag har fel nummer|wrong number|is this the right number'),
        new RegExp('(^|[^\\p{L}\\p{N}])((?:[Ää]r det (?:här )?|[Ää]r detta )\\p{Lu}\\p{Ll}+\\?)', 'gu')
      ] },
    { id: 'voicemail', w: 1.5,
      title: 'Lockar dig att öppna ett meddelande via länk',
      why: 'Falska röstmeddelanden och ”nya meddelanden” är ett vanligt sätt att få dig att klicka på en farlig länk eller installera en skadlig app.',
      todo: 'Klicka inte på länken. Lyssna på röstbrevlådan eller läs meddelandet som du brukar, i telefonen eller appen.',
      re: [W('röstmeddelande\\w*|röstbrevlåda\\w*|nytt meddelande väntar|du har ett nytt meddelande via|voicemail|voice message')] },
    { id: 'purchase_alert', w: 1,
      title: 'Varnar för ett köp du inte har gjort',
      why: 'Ett skrämmande köp ska få dig att agera snabbt. Kontrollera i bankens app i stället för att ringa eller klicka.',
      todo: 'Öppna bankens app själv och se om köpet verkligen finns där.',
      re: [W('(?:ett|nytt) (?:köp|uttag|betalning|överföring|lån) (?:på|om) \\d[\\d .,]*\\s?(?:kr|kronor|sek|:-)|var det inte du|känner du inte igen (?:köpet|betalningen|transaktionen|överföringen)|was this not you|didn\'?t make this|if you did not (?:make|authori[sz]e|place|recogni[sz]e) (?:this|the) (?:purchase|order|payment|transaction)')] },
    { id: 'chat_switch', w: 1,
      title: 'Vill flytta kontakten till WhatsApp eller Telegram',
      why: 'Bedragare flyttar gärna kontakten till appar där de är svårare att spåra.',
      todo: 'Fortsätt inte kontakten i en annan app med någon du inte känner.',
      re: [W('(?:kontakta|skriv till|lägg till|addera|hör av dig|kontakt|chatta|contact|add|message|text|reach|chat with|write to)[^.!?\\n]{0,30}(?:whatsapp|telegram|viber)|(?:whatsapp|telegram|viber)[^.!?\\n]{0,12}(?:\\+\\d|\\d{3}|@\\w)')] },
    { id: 'emergency', w: 1,
      title: 'Beskriver ett plötsligt nödläge',
      why: 'Ett nödläge gör att du vill hjälpa till snabbt, utan att kontrollera.',
      todo: 'Ring personen på ett nummer du vet stämmer innan du gör något.',
      re: [W('sjukhus\\w*|olycka|krockat|krock|fast (?:på|i) (?:flygplatsen|tullen|gränsen)|häktad|gripen|fängelse|borgen|advokat(?:en|kostnad\\w*|arvode\\w*)?|fryst mitt konto|mitt konto är fryst|i trubbel|hamnat i knipa|nödsituation|nödläge|emergency|hospital|accident|stuck at')] },
    { id: 'foreign_number', w: 1,
      title: 'Nummer från utlandet',
      why: 'Svenska banker, myndigheter och företag skickar inte sms från utländska nummer. Bedragare gör det ofta.',
      todo: null,
      re: [W('\\+(?!46)\\d{1,3}[ -]?\\(?\\d{2,}')] },
    { id: 'generic_greeting', w: 0.5,
      title: 'Opersonlig hälsning',
      why: 'Ett företag du är kund hos vet oftast vad du heter.',
      todo: null,
      re: [W('(?:bästa|kära|ärade|värderade|hej) (?:kund|kunden|användare|medlem|kontoinnehavare)|dear (?:customer|user|member|client|account holder)|valued customer')] },
    { id: 'no_voice', hidden: true, re: [W('kan inte (?:prata|ringa|svara i telefon|ta samtal)(?: just nu| nu)?|can\'?t (?:talk|call)(?: right now| now)?|cannot (?:talk|call)')] },
    // A loan or purchase you are told about, "stämmer inte detta?" and a number to call: the opening of a phone fraud.
    // "Om det inte var du, ring oss" is also how real banks write, so only the scammers' "Stämmer inte detta?" and a loan
    // you never applied for count.
    { id: 'not_you', hidden: true, re: [W('stämmer inte (?:detta|det här|det)|om du inte har (?:ansökt|sökt) (?:om )?(?:lånet|lån|krediten)')] },
    { id: 'loan_granted', hidden: true, re: [W('(?:ditt|ert) lån(?:et)?[^.!?\\n]{0,40}(?:har beviljats|är beviljat|har godkänts|är godkänt|betalas ut|har betalats ut)')] },
    { id: 'family_greet', hidden: true, re: [W('(?:hej|hejsan|hallå|tja|hi|hello|hey) (?:mamma|pappa|mor|far|morsan|farsan|mamsen|mammi|pappsen|mormor|morfar|farmor|farfar|mom|mum|mummy|dad)')] },
    { id: 'family_claim', hidden: true, re: [W('det är (?:jag|ditt barnbarn|din dotter|din son|ditt barn|din pappa|din mamma)|(?:mormor|morfar|farmor|farfar|mamma|pappa|mamsen|morsan|farsan)[,!]|(?:mum|mom|mummy|mommy|dad|daddy|grandma|granny|nana|grandpa)[,!]? it\'?s me|it\'?s me,? (?:mum|mom|dad)')] },
    { id: 'parcel', hidden: true, re: [W('paket\\w*|försändelse\\w*|leverans\\w*|levereras|leverera\\w*|utdelning\\w*|tull\\w*|frakt\\w*|kolli|package|parcel|delivery|shipment|customs')] },
    { id: 'fee_words', hidden: true, re: [W('[\\p{L}]{0,20}avgift[\\p{L}]{0,12}|tull\\w*|frakt\\w*|porto|ombokning\\w*|fee|customs|shipping|postage|handling|toll\\w*|vägtull\\w*|vägavgift\\w*|penalty|penalties')] },
    { id: 'romance', hidden: true, re: [W('älskling|min älskade|älskade du|käraste du|min kära|min käraste|mitt hjärta|min ängel|sweetheart|my love|my dear(?:est)?|darling|längtar (?:så )?(?:mycket )?efter dig|du är den enda')] },
    { id: 'market', hidden: true, re: [W('blocket|tradera|marketplace|köpa din|köper din|säljer din|din annons|annonsen|köparen|säljaren')] },
    { id: 'login_words', hidden: true, re: [W('logga in|loggar in|inloggning\\w*|lösenord\\w*|ditt konto|ditt abonnemang|din profil|log ?in|sign ?in|your account|password')] },
    { id: 'link_hint', hidden: true, re: [
        W('klicka (?:på )?(?:länken|knappen|här)|tryck (?:på )?(?:länken|knappen|här)|via länken(?: nedan)?|länken nedan|knappen nedan|click (?:here|on the link|the link|the button)|tap (?:here|the link)|link below|button below|via (?:vår|den) säkra (?:sida|betalsida|webbsida|länk\\w*)|vår säkra (?:sida|betalsida|webbsida)|säker betalsida|secure (?:payment )?(?:page|portal|link)'),
        new RegExp('(^|\\s)(\\[(?:betala|logga in|bekräfta|verifiera|uppdatera|öppna|hämta|fortsätt|signera|pay|log ?in|confirm|verify|update)[^\\]\\n]{0,30}\\])', 'giu'),
        new RegExp('(\\n)((?:betala|logga in|bekräfta|verifiera|uppdatera|fortsätt|signera|pay now|log ?in|confirm|verify)(?: \\p{L}+){0,3})(?=\\n|$)', 'giu')
      ] },
    { id: 'rebook', hidden: true, re: [W('boka (?:ny|om) (?:tid|leveranstid|leverans\\w*)|ny leveranstid|välj (?:en )?ny (?:leveranstid|tid)')] },
    { id: 'reply_ask', hidden: true, re: [W('svara (?:ja|med|på (?:detta|det här|sms\\w*|mejlet|meddelandet|frågorna|\\p{L}+ frågor))|reply (?:yes|with|to this)|registrera dig|fyll i|ring|kontakta oss|hämta (?:den|vinsten|belöningen|presentkortet)|claim')] },
    { id: 'reassure', w: 1.5,
      title: 'Försäkrar att det inte är en bluff',
      why: 'Riktiga banker, myndigheter och företag brukar inte skriva att meddelandet inte är en bluff, eller be dig kolla det på en sida som den här. Den här sidan kan aldrig intyga att ett meddelande är äkta.',
      todo: 'Lita inte på försäkran. Kontakta avsändaren själv, på ett nummer eller en adress du har letat upp.',
      re: [W('(?:detta|det här|det|this|it) (?:är|is) (?:inte|inget|ingen|not|no) (?:ett |en |a )?(?:bedrägeri\\w*|bluff\\w*|scam\\w*|fraud\\w*|fejk\\w*|fake)|(?:detta|det här) (?:sms|mejl|meddelande)\\w* är (?:äkta|på riktigt|legitimt|säkert)|(?:kolla|kontrollera|verifiera|dubbelkolla)[^.!?\\n]{0,50}(?:är det bluff|ar-?det-?bluff|bluffkoll)|100 ?% (?:säkert|lagligt|legitimt|riskfritt)|helt (?:lagligt|legitimt)')] },
    { id: 'push_req', hidden: true, re: [W('(?:skickar|skicka|skickat|kommer att skicka|får du)\\s(?:nu\\s|strax\\s|snart\\s)?(?:en\\s)?(?:förfrågan|begäran|signering\\w*|inloggning\\w*|identifiering\\w*|bekräftelse\\w*)[^.!?\\n]{0,40}(?:app\\w*|mobil\\w*|telefon\\w*)')] },
    { id: 'approve_words', hidden: true, re: [W('godkänn\\w*|signera\\w*|tryck på godkänn|bekräfta (?:den|det|förfrågan|begäran)')] },
    { id: 'pay_words', hidden: true, re: [W('betala|betalar|betalning\\w*|faktura\\w*|räkning\\w*|pay|payment|invoice')] }
  ];

  var BRANDS = [
    { name: 'PostNord', words: 'post ?nord', tok: ['postnord'], dom: ['postnord.se', 'postnord.com', 'postnord.dk', 'postnord.no', 'postnord.fi'], g: 'parcel' },
    { name: 'DHL', words: 'dhl', tok: ['dhl'], dom: ['dhl.com', 'dhl.se', 'dhl.de'], g: 'parcel' },
    { name: 'UPS', words: 'UPS', cs: true, tok: ['ups'], dom: ['ups.com'], g: 'parcel' },
    { name: 'Instabox', words: 'instabox', tok: ['instabox'], dom: ['instabox.se', 'instabox.io', 'instabox.com'], g: 'parcel' },
    { name: 'Budbee', words: 'budbee', tok: ['budbee'], dom: ['budbee.com', 'budbee.se'], g: 'parcel' },
    { name: 'Bring', words: 'Bring', cs: true, tok: ['bring'], dom: ['bring.se', 'bring.com', 'bring.no'], g: 'parcel' },
    { name: 'DB Schenker', words: 'schenker', tok: ['schenker'], dom: ['dbschenker.com'], g: 'parcel' },
    { name: 'Tullverket', words: 'tullverket', tok: ['tullverket', 'tullverk'], dom: ['tullverket.se'], g: 'gov' },
    { name: 'Skatteverket', words: 'skatteverket', tok: ['skatteverket', 'skatteverk'], dom: ['skatteverket.se'], g: 'gov' },
    { name: 'Kronofogden', words: 'kronofogden', tok: ['kronofogden', 'kronofogd'], dom: ['kronofogden.se'], g: 'gov' },
    { name: 'Försäkringskassan', words: 'försäkringskassan', tok: ['forsakringskassan', 'forsakringskassa'], dom: ['forsakringskassan.se'], g: 'gov' },
    { name: 'Polisen', words: 'polis(?:en|myndigheten)|swedish police(?: authority)?', tok: ['polisen', 'polismyndigheten'], dom: ['polisen.se'], g: 'gov' },
    { name: 'Europol', words: 'europol', tok: ['europol'], dom: ['europa.eu'], g: 'gov' },
    { name: 'Interpol', words: 'interpol', tok: ['interpol'], dom: ['interpol.int'], g: 'gov' },
    { name: 'CSN', words: 'CSN', cs: true, tok: ['csn'], dom: ['csn.se'], g: 'gov' },
    { name: 'Transportstyrelsen', words: 'transportstyrelsen', tok: ['transportstyrelsen'], dom: ['transportstyrelsen.se'], g: 'gov' },
    { name: 'Trafikverket', words: 'trafikverket', tok: ['trafikverket'], dom: ['trafikverket.se'], g: 'gov' },
    { name: 'Pensionsmyndigheten', words: 'pensionsmyndigheten', tok: ['pensionsmyndigheten'], dom: ['pensionsmyndigheten.se'], g: 'gov' },
    { name: 'Migrationsverket', words: 'migrationsverket', tok: ['migrationsverket'], dom: ['migrationsverket.se'], g: 'gov' },
    { name: 'Arbetsförmedlingen', words: 'arbetsförmedlingen', tok: ['arbetsformedlingen'], dom: ['arbetsformedlingen.se'], g: 'gov' },
    { name: '1177', words: '1177', tok: ['1177'], dom: ['1177.se'], g: 'gov' },
    { name: 'BankID', words: 'bank[- ]?[il]d', tok: ['bankid', 'bank-id'], dom: ['bankid.com'], g: 'id' },
    { name: 'Freja eID', words: 'freja ?e-?id\\+?', tok: ['frejaeid'], dom: ['frejaeid.com'], g: 'id' },
    { name: 'Swish', words: 'swish\\w*', tok: ['swish'], dom: ['swish.nu'], g: 'pay' },
    { name: 'Swedbank', words: 'swedbank', tok: ['swedbank'], dom: ['swedbank.se', 'swedbank.com'], g: 'bank' },
    { name: 'Handelsbanken', words: 'handelsbanken', tok: ['handelsbanken'], dom: ['handelsbanken.se', 'handelsbanken.com'], g: 'bank' },
    { name: 'SEB', words: 'SEB', cs: true, tok: ['seb'], dom: ['seb.se', 'seb.com'], g: 'bank' },
    { name: 'Nordea', words: 'nordea', tok: ['nordea'], dom: ['nordea.se', 'nordea.com'], g: 'bank' },
    { name: 'Danske Bank', words: 'danske ?bank', tok: ['danskebank'], dom: ['danskebank.se', 'danskebank.com'], g: 'bank' },
    { name: 'Länsförsäkringar', words: 'länsförsäkringar', tok: ['lansforsakringar'], dom: ['lansforsakringar.se', 'lf.se'], g: 'bank' },
    { name: 'ICA Banken', words: 'ica ?banken', tok: ['icabanken'], dom: ['icabanken.se', 'ica.se'], g: 'bank' },
    { name: 'ICA', words: 'ICA', cs: true, tok: ['ica'], dom: ['ica.se', 'icabanken.se'], g: 'other' },
    { name: 'SBAB', words: 'SBAB', cs: true, tok: ['sbab'], dom: ['sbab.se'], g: 'bank' },
    { name: 'Skandia', words: 'skandia', tok: ['skandia'], dom: ['skandia.se'], g: 'bank' },
    { name: 'Avanza', words: 'avanza', tok: ['avanza'], dom: ['avanza.se'], g: 'bank' },
    { name: 'Nordnet', words: 'nordnet', tok: ['nordnet'], dom: ['nordnet.se'], g: 'bank' },
    { name: 'Intrum', words: 'intrum', tok: ['intrum'], dom: ['intrum.se', 'intrum.com'], g: 'debt' },
    { name: 'Lowell', words: 'lowell', tok: ['lowell'], dom: ['lowell.se', 'lowell.com'], g: 'debt' },
    { name: 'Klarna', words: 'klarna', tok: ['klarna'], dom: ['klarna.com', 'klarna.se'], g: 'pay' },
    { name: 'PayPal', words: 'paypal', tok: ['paypal'], dom: ['paypal.com'], g: 'pay' },
    { name: 'Apple', words: 'apple|icloud', tok: ['apple', 'icloud'], dom: ['apple.com', 'icloud.com'], g: 'tech' },
    { name: 'Microsoft', words: 'microsoft|outlook|hotmail', tok: ['microsoft', 'outlook', 'hotmail'], dom: ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'microsoftonline.com', 'hotmail.com'], g: 'tech' },
    { name: 'Google', words: 'google|gmail', tok: ['google', 'gmail'], dom: ['google.com', 'google.se', 'gmail.com', 'youtube.com', 'youtu.be'], g: 'tech' },
    { name: 'Netflix', words: 'netflix', tok: ['netflix'], dom: ['netflix.com'], g: 'tech' },
    { name: 'Spotify', words: 'spotify', tok: ['spotify'], dom: ['spotify.com'], g: 'tech' },
    { name: 'Facebook', words: 'facebook', tok: ['facebook'], dom: ['facebook.com', 'fb.com', 'meta.com', 'fb.me'], g: 'tech' },
    { name: 'Instagram', words: 'instagram', tok: ['instagram'], dom: ['instagram.com'], g: 'tech' },
    { name: 'WhatsApp', words: 'whatsapp', tok: ['whatsapp'], dom: ['whatsapp.com', 'wa.me'], g: 'tech' },
    { name: 'Amazon', words: 'amazon', tok: ['amazon'], dom: ['amazon.se', 'amazon.com', 'amazon.de'], g: 'market' },
    { name: 'Blocket', words: 'blocket', tok: ['blocket'], dom: ['blocket.se'], g: 'market' },
    { name: 'Tradera', words: 'tradera', tok: ['tradera'], dom: ['tradera.com', 'tradera.se'], g: 'market' },
    { name: 'Telia', words: 'telia', tok: ['telia'], dom: ['telia.se', 'telia.com'], g: 'telco' },
    { name: 'Tele2', words: 'tele2', tok: ['tele2'], dom: ['tele2.se', 'tele2.com'], g: 'telco' },
    { name: 'Telenor', words: 'telenor', tok: ['telenor'], dom: ['telenor.se', 'telenor.com'], g: 'telco' },
    { name: 'Kivra', words: 'kivra', tok: ['kivra'], dom: ['kivra.com', 'kivra.se'], g: 'other' },
    { name: 'Vattenfall', words: 'vattenfall', tok: ['vattenfall'], dom: ['vattenfall.se', 'vattenfall.com'], g: 'other' },
    { name: 'SL', words: 'SL', cs: true, tok: ['sl'], dom: ['sl.se'], g: 'other' },
    { name: 'Västtrafik', words: 'västtrafik', tok: ['vasttrafik'], dom: ['vasttrafik.se'], g: 'other' },
    { name: 'Skånetrafiken', words: 'skånetrafiken', tok: ['skanetrafiken'], dom: ['skanetrafiken.se'], g: 'other' },
    // R3: this page. No words (a question like "är det bluff?" is not a mention), only addresses that imitate it.
    { name: 'Är det bluff?', words: null, tok: ['ardetbluff', 'aerdetbluff', 'bluffkoll', 'kollabluff', 'bluffkontroll'], dom: ['tollegoransson-maker.github.io', 'ardetbluff.se'], g: 'self' }
  ];
  // This page's own addresses, so that a shared link to the page does not warn about itself.
  var OWN = ['tollegoransson-maker.github.io', 'ardetbluff.se', 'www.ardetbluff.se'];

  var SHORT = ['bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'is.gd', 'v.gd', 'cutt.ly', 'rb.gy', 'shorturl.at', 'tiny.cc', 'ow.ly', 's.id', 't.ly', 'rebrand.ly', 'buff.ly', 'goo.gl', 'qrco.de', 'bl.ink', 'surl.li', 'u.to', 'clck.ru', 'urlz.fr', 'shorturl.com', 'x.co', 'adf.ly', 'tiny.one', 'short.gy', 'lnkd.in'];
  var ODD = ['xyz', 'top', 'icu', 'click', 'link', 'live', 'online', 'site', 'shop', 'store', 'buzz', 'cfd', 'sbs', 'rest', 'bond', 'cyou', 'vip', 'work', 'monster', 'quest', 'lol', 'fun', 'life', 'world', 'today', 'support', 'help', 'services', 'tk', 'ml', 'ga', 'cf', 'gq', 'pw', 'ws', 'cc', 'ru', 'cn', 'info', 'biz', 'mobi', 'win', 'bid', 'loan', 'men', 'date', 'review', 'stream', 'trade', 'party', 'racing', 'science', 'download', 'xin', 'ink', 'wang', 'ren', 'mom', 'beauty', 'hair', 'skin', 'makeup', 'autos', 'boats', 'homes', 'zone', 'delivery', 'express', 'lat', 'pro', 'club', 'tech', 'space', 'website', 'fit', 'cam', 'bar', 'uno', 'zip', 'mov', 'asia', 'email', 'tips', 'pics'];
  var TLD = ['se', 'nu', 'com', 'net', 'org', 'io', 'co', 'app', 'eu', 'de', 'uk', 'us', 'me', 'ly', 'gd', 'to', 'fi', 'no', 'dk', 'nl', 'fr', 'es', 'it', 'be', 'ch', 'at', 'ie', 'pt', 'pl', 'ee', 'lv', 'lt', 'cz', 'ca', 'au', 'in', 'br', 'jp', 'ai', 'is', 'li', 'tv', 'my', 'hk', 'sg', 'ph', 'vn', 'th', 'tw', 'kr', 'ua', 'tr', 'ae', 'za', 'mx', 'nz', 'ro', 'hu', 'gr', 'sk', 'si', 'hr', 'rs', 'bg', 'lu', 'ng', 'ke', 'pk', 'example'].concat(ODD).join('|');
  var LINK_RE = new RegExp('(^|[^\\p{L}\\p{N}@.\\-\\/])((?:https?:\\/\\/|www\\.)[^\\s<>"\'”»)\\]]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.){1,8}(?:' + TLD + ')(?![\\p{L}\\p{N}\\-])(?:[\\/?#][^\\s<>"\'”»)\\]]*)?)', 'giu');
  // Any lowercase ending followed by a path also reads as an address, for endings not in the list above.
  var LINK2 = /(^|[^\p{L}\p{N}@.\-\/])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){1,6}[a-z]{2,12}\/[^\s<>"'”»)\]]*)/gu;
  var EMAIL_RE = /[\p{L}\p{N}._%+\-]{1,64}@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){1,8}[a-z]{2,})/giu;
  var AMOUNT_RE = /(^|[^\d])(\d{1,3}(?:[  .]\d{3})+|\d+)(?:[,.](\d{1,2}))?\s?(?:kr|kronor|sek|:-)(?![\p{L}])|(^|[^\p{L}])(?:sek|eur|€|\$)\s?(\d+)(?:[,.](\d{1,2}))?/giu;
  var IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
  // R3: pages anyone can make on an official platform: a form, a site, a shared file, a chat with any number.
  var HOSTED = ['docs.google.com', 'forms.gle', 'sites.google.com', 'drive.google.com', 'storage.googleapis.com', 'firebasestorage.googleapis.com',
    'script.google.com', 'script.googleusercontent.com', 'forms.office.com', 'forms.microsoft.com', 'onedrive.live.com', '1drv.ms', 'sway.office.com',
    'wa.me', 'chat.whatsapp.com', 'api.whatsapp.com', 'm.me', 'l.facebook.com', 'lm.facebook.com'];
  var CHAT_HOSTS = ['wa.me', 'chat.whatsapp.com', 'api.whatsapp.com', 'm.me'];
  // R3: an address written with words or spaces instead of dots: "pn-tull punkt com", "postnord . se", "pn [dot] com".
  var OBF_RE = new RegExp('(^|[^\\p{L}\\p{N}@.\\-\\/])(([a-z0-9][a-z0-9-]{1,62})\\s*(?:\\(punkt\\)|\\[punkt\\]|\\(dot\\)|\\[dot\\]|\\{dot\\}|punkt|dot|\\s\\.)\\s*(' + ['se', 'nu', 'com', 'net', 'org', 'eu', 'info', 'online', 'top', 'xyz', 'shop', 'site', 'live', 'click', 'link', 'app', 'io', 'co', 'example'].join('|') + ')(?:\\s*\\/\\s*[a-z0-9\\-]+)?)(?![\\p{L}\\p{N}\\-])', 'giu');

  // Letters from other alphabets that look like Latin ones, as used in "BаnkID" with a Cyrillic а.
  var CONF_FROM = 'аеорсухіјѕԁһԛԝӏАВЕКМНОРСТУХІЈЅοανικρτυΑΒΕΖΗΙΚΜΝΟΡΤΥΧ';
  var CONF_TO = 'aeopcyxijsdhqwlABEKMHOPCTYXIJSoavikptuABEZHIKMNOPTYX';
  // R3: every invisible format character (zero-width, direction marks, soft hyphen, word joiner ...), not just a few.
  var ZW = /\p{Cf}/u;
  // R3: characters that look like an ordinary space (other spaces, Hangul fillers, the blank braille cell).
  var BLANK = /[\sᅟᅠㅤﾠ⠀]/u;
  var MARK = /\p{M}/u;
  var PICT = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️⃣]/u;
  var LETTER = /\p{L}/u, WORDCH = /[\p{L}\p{M}]/u, LATIN = /[A-Za-zÀ-ÖØ-öø-ÿ]/, LOWER = /\p{Ll}/u;
  var BRACKET = { '[': ']', '(': ')', '{': '}' };

  // The text as the rules read it: no invisible characters, no emoji inside words, lookalike letters replaced,
  // full-width letters made normal and "[.]" read as a dot. from/to say where each character came from,
  // so that everything found can be marked in the original text.
  function normalize(src) {
    var pts = [], p = 0, i, j, k, words = 0, cps = Array.from(src);
    // R3: a letter is read together with the combining marks after it. Compatibility forms (𝐁𝐚𝐧𝐤𝐈𝐃, full width, ﬁ)
    // become ordinary letters, a + ring typed apart becomes å, and marks left on a Latin letter (k̲o̲r̲t̲) are dropped.
    for (i = 0; i < cps.length; i = j) {
      var c0 = cps[i], s0 = p, n;
      p += c0.length;
      for (j = i + 1; j < cps.length && MARK.test(cps[j]); j++) { c0 += cps[j]; p += cps[j].length; }
      if (c0 === '\r') n = cps[j] === '\n' ? '' : '\n';
      else if (c0 === '\n' || c0 === ' ' || c0 === ' ') n = '\n';
      else if (ZW.test(c0)) n = c0;
      else if (BLANK.test(c0)) n = ' ';
      else {
        n = c0.normalize('NFKC');
        if (LATIN.test(n.charAt(0))) n = n.replace(/\p{M}/gu, '');
      }
      Array.from(n).forEach(function (c) { pts.push({ c: c, s: s0, e: p, w: -1 }); });
    }
    for (i = 0; i < pts.length; i = j) {
      j = i + 1;
      if (!WORDCH.test(pts[i].c)) continue;
      var latin = LATIN.test(pts[i].c), conf = CONF_FROM.indexOf(pts[i].c) !== -1;
      while (j < pts.length && WORDCH.test(pts[j].c)) {
        if (LATIN.test(pts[j].c)) latin = true;
        if (CONF_FROM.indexOf(pts[j].c) !== -1) conf = true;
        j++;
      }
      if (latin && conf) {
        for (k = i; k < j; k++) {
          var x = CONF_FROM.indexOf(pts[k].c);
          if (x !== -1) pts[k].c = CONF_TO.charAt(x);
          pts[k].w = words;
        }
        words++;
      }
    }
    var out = [], from = [], to = [], mixed = [], runEnd = -1;
    for (i = 0; i < pts.length; i++) {
      var c = pts[i].c, s = pts[i].s, e = pts[i].e, wid = pts[i].w;
      if (ZW.test(c)) continue;
      if (PICT.test(c)) {
        var prev = out.length ? out[out.length - 1] : '';
        // The end of a run of emoji is found once per run, not once per emoji (a long run froze the page).
        if (runEnd <= i) for (runEnd = i + 1; runEnd < pts.length && (PICT.test(pts[runEnd].c) || ZW.test(pts[runEnd].c)); runEnd++);
        j = runEnd;
        if (LETTER.test(prev) && j < pts.length && LETTER.test(pts[j].c)) continue;
        c = ' ';
      } else if (BRACKET[c] && i + 3 < pts.length && pts[i + 1].c === '.' && pts[i + 2].c === BRACKET[c] &&
        /[a-z0-9]/i.test(out.length ? out[out.length - 1] : '') && /[a-z]/i.test(pts[i + 3].c)) {
        c = '.';
        e = pts[i + 2].e;
        i += 2;
      } else if (c.length === 1 && c.charCodeAt(0) >= 0xFF01 && c.charCodeAt(0) <= 0xFF5E) {
        c = String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
      }
      // R3: one space is enough ("säkert  konto"), and a line break inside a sentence (a wrapped e-mail) is a space.
      if (c === ' ' && (!out.length || out[out.length - 1] === ' ' || out[out.length - 1] === '\n')) continue;
      if (c === '\n' && out.length && /[\p{Ll},]/u.test(out[out.length - 1]) && i + 1 < pts.length && LOWER.test(pts[i + 1].c)) c = ' ';
      var at = out.length;
      for (k = 0; k < c.length; k++) { out.push(c.charAt(k)); from.push(s); to.push(e); }
      if (wid !== -1) {
        var last = mixed[mixed.length - 1];
        if (last && last.w === wid) last.e = out.length; else mixed.push({ w: wid, s: at, e: out.length });
      }
    }
    return { t: out.join(''), from: from, to: to, mixed: mixed };
  }

  // R3: removes the characters marked in del, keeping the map back to the original text.
  function squeeze(N, del) {
    var t = [], from = [], to = [], map = [], n = 0, i;
    for (i = 0; i < N.t.length; i++) {
      map.push(n);
      if (del[i]) continue;
      t.push(N.t.charAt(i)); from.push(N.from[i]); to.push(N.to[i]); n++;
    }
    map.push(n);
    var mixed = N.mixed.map(function (m) { return { w: m.w, s: map[m.s], e: map[m.e] }; }).filter(function (m) { return m.e > m.s; });
    return { t: t.join(''), from: from, to: to, mixed: mixed };
  }
  // R3: "B a n k I D" and "B.a.n.k.I.D" (four or more single letters), compounds written apart ("kort uppgifter",
  // "person nummer") and a digit between two letters ("k0rtuppg1fter") are read as the word they imitate.
  // Addresses are left exactly as typed, so that "sk4tteverket.se" can never be read as the real address.
  var SPACED = /(^|[^\p{L}\p{N}])(\p{L}(?:[ .*_·•\-]\p{L}){3,})(?![\p{L}\p{N}])/gu;
  var SPLIT = new RegExp('(^|[^\\p{L}])(kort|kredit|bank|konto|person|clearing|engångs|verifierings|bekräftelse|säkerhets|aktiverings|inloggnings|betalnings|skatte|tull|frakt|bedrägeri|spärr|lösen|pin|sms|leverans|reserv|skydds)[ -](uppgift\\p{L}*|nummer\\p{L}*|nr|kod\\p{L}*|avdelning\\p{L}*|enhet\\p{L}*|återbäring\\p{L}*|avgift\\p{L}*|konto\\p{L}*|detaljer\\p{L}*|ord\\p{L}*|adress\\p{L}*|team\\p{L}*|tjänst\\p{L}*)(?![\\p{L}\\p{N}])', 'giu');
  var LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's' };
  function tidy(N) {
    var t = N.t, del = [], keep = [], any = false, m, i;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(t)) !== null) for (i = m.index + m[1].length; i < m.index + m[0].length; i++) keep[i] = true;
    EMAIL_RE.lastIndex = 0;
    while ((m = EMAIL_RE.exec(t)) !== null) for (i = m.index; i < m.index + m[0].length; i++) keep[i] = true;
    var chars = null;
    for (i = 1; i < t.length - 1; i++) {
      if (LEET[t[i]] && !keep[i] && LETTER.test(t[i - 1]) && LETTER.test(t[i + 1])) { if (!chars) chars = t.split(''); chars[i] = LEET[t[i]]; }
    }
    if (chars) { t = chars.join(''); N = { t: t, from: N.from, to: N.to, mixed: N.mixed }; }
    SPACED.lastIndex = 0;
    while ((m = SPACED.exec(t)) !== null) {
      var st = m.index + m[1].length;
      if (keep[st]) continue;
      for (i = st + 1; i < st + m[2].length; i += 2) { del[i] = true; any = true; }
    }
    SPLIT.lastIndex = 0;
    while ((m = SPLIT.exec(t)) !== null) {
      var sep = m.index + m[1].length + m[2].length;
      if (!keep[sep]) { del[sep] = true; any = true; }
    }
    return any ? squeeze(N, del) : N;
  }

  // R3: messages without å, ä and ö (sent through systems that drop them, typed on a foreign keyboard or read from a
  // screenshot) are read with the rules' å, ä and ö as a and o. Only used when the text has none of them.
  var FOLDING = false;
  function foldStr(s) { return s.replace(/[åä]/g, 'a').replace(/[ÅÄ]/g, 'A').replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/é/g, 'e').replace(/É/g, 'E'); }
  function F(re) {
    if (!FOLDING || !re) return re;
    if (!re._f) re._f = new RegExp(foldStr(re.source), re.flags);
    return re._f;
  }

  // The part of the clause that comes before position s.
  function clauseBefore(text, s) {
    var before = text.slice(Math.max(0, s - 40), s), cut = 0, m, cr = F(CUT);
    cr.lastIndex = 0;
    while ((m = cr.exec(before)) !== null) cut = m.index + m[0].length;
    return before.slice(cut);
  }

  // The part of the sentence that comes before position s.
  function sentenceBefore(text, s) {
    var before = text.slice(Math.max(0, s - 200), s);
    var k = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n'));
    return before.slice(k + 1);
  }

  // A negation inside the match, earlier in the same clause or right after it means the text warns rather than asks.
  function isNegated(text, s, e, t) {
    var neg = F(NEG), enc = F(ENCOURAGE);
    return neg.test(t.replace(enc, ' ')) || neg.test(clauseBefore(text, s).replace(enc, ' ')) || F(AFTER_NEG).test(text.slice(e, e + 14));
  }

  function collect(rule, re, text) {
    var out = [], m;
    re = F(re);
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      var t = m[2];
      if (!t) { re.lastIndex++; continue; }
      var s = m.index + m[1].length, e = s + t.length;
      if ((rule.neg && isNegated(text, s, e, t)) || (rule.skip && F(rule.skip).test(t)) || (rule.ctx && F(rule.ctx).test(sentenceBefore(text, s)))) {
        // Look again from the next character: a later request in the same stretch still counts.
        re.lastIndex = s + 1;
        continue;
      }
      out.push({ s: s, e: e, t: t });
    }
    return out;
  }

  // A brand's pattern is built the first time it is needed, or ahead of time by warm().
  // It also matches "Nordeas", "Polisens": the Swedish genitive.
  function brandRe(b) {
    if (!b.re) b.re = new RegExp('(^|[^\\p{L}\\p{N}])((?:' + b.words + ')s?)(?![\\p{L}\\p{N}])', b.cs ? 'gu' : 'giu');
    return b.re;
  }

  function findBrands(text) {
    var found = [];
    BRANDS.forEach(function (b) {
      if (!b.words) return;
      var re = F(brandRe(b));
      re.lastIndex = 0;
      var m = re.exec(text);
      if (m) found.push({ b: b, i: m.index + m[1].length, t: m[2] });
    });
    found.sort(function (a, c) { return a.i - c.i; });
    return found;
  }

  function hostOf(raw) {
    var s = raw.replace(/^[a-z][a-z0-9+.\-]*:\/\//i, '');
    var end = s.search(/[\/?#]/);
    var auth = end === -1 ? s : s.slice(0, end);
    var at = auth.lastIndexOf('@');
    var userinfo = at !== -1;
    if (userinfo) auth = auth.slice(at + 1);
    auth = auth.replace(/:\d+$/, '').replace(/\.$/, '').toLowerCase();
    return { host: auth, userinfo: userinfo };
  }

  function regOf(host) {
    if (IPV4.test(host)) return host;
    var p = host.split('.');
    if (p.length >= 3 && p[p.length - 1].length === 2 && /^(?:co|com|net|org|gov|ac|edu|or|ne|go)$/.test(p[p.length - 2])) return p.slice(-3).join('.');
    return p.slice(-2).join('.');
  }

  function officialFor(reg) {
    for (var i = 0; i < BRANDS.length; i++) if (BRANDS[i].dom.indexOf(reg) !== -1) return BRANDS[i];
    return null;
  }

  function brandInHost(host, reg) {
    var tld = reg.split('.').pop();
    var core = host.slice(0, host.length - tld.length - 1);
    var toks = core.split(/[.\-]/);
    for (var i = 0; i < BRANDS.length; i++) {
      var b = BRANDS[i];
      for (var j = 0; j < b.tok.length; j++) {
        var t = b.tok[j];
        if (t.length >= 6 ? core.indexOf(t) !== -1 || (t.length >= 8 && core.replace(/-/g, '').indexOf(t) !== -1) : toks.indexOf(t) !== -1) return b;
      }
    }
    return null;
  }

  function findLinks(text, mentioned, mixedRanges, obfOnly) {
    var list = [], seen = {}, taken = [];
    function add(raw, s, kind, len) {
      var clean = raw.replace(/[.,;:!?)\]}»”'"]+$/, '');
      var span = len || clean.length;
      if (!clean) return;
      var hp = hostOf(clean);
      var host = hp.host;
      if (!host || host.indexOf('.') === -1) return;
      if (kind === 'url') taken.push([s, s + span]);
      var hom = (mixedRanges || []).some(function (r) { return s < r.e && s + span > r.s; });
      var key = kind + ':' + host;
      var l = seen[key];
      if (!l) {
        var reg = regOf(host);
        l = { raw: clean, host: host, reg: reg, sub: host.slice(0, host.length - reg.length), kind: kind, ranges: [], userinfo: hp.userinfo };
        var off = officialFor(reg);
        l.tld = reg.split('.').pop();
        var path = clean.replace(/^[a-z][a-z0-9+.\-]*:\/\//i, '').replace(/^[^\/?#]*/, '');
        if (hom) { l.status = 'homograph'; l.brand = off || brandInHost(host, reg); }
        else if (OWN.indexOf(host) !== -1 || OWN.indexOf(reg) !== -1) l.status = 'self';
        else if (IPV4.test(host)) l.status = 'ip';
        else if (host.indexOf('xn--') !== -1 || /[^\x00-\x7f]/.test(host)) l.status = 'puny';
        else if (off && (HOSTED.indexOf(host) !== -1 || /(?:^|[?&])(?:q|u|url|target|redirect|dest)=(?:https?|www)/i.test(path.replace(/^[^?]*\?/, '')) || /%3A%2F%2F/i.test(path))) { l.status = 'hosted'; l.brand = off; l.chat = CHAT_HOSTS.indexOf(host) !== -1; }
        else if (SHORT.indexOf(reg) !== -1 || SHORT.indexOf(host) !== -1) l.status = 'short';
        else if (off) { l.status = 'official'; l.brand = off; }
        else {
          var hb = brandInHost(host, reg);
          if (hb) { l.status = 'lookalike'; l.brand = hb; }
          else if (mentioned.length) { l.status = 'mismatch'; l.brand = mentioned[0]; }
          else l.status = 'unknown';
        }
        l.odd = l.status !== 'official' && l.status !== 'self' && ODD.indexOf(l.tld) !== -1;
        seen[key] = l;
        list.push(l);
      }
      l.ranges.push({ s: s, e: s + span, t: text.slice(s, s + span) });
      if (len) l.obf = true;
    }
    var m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text)) !== null) {
      var st = m.index + m[1].length;
      if (!/^(?:https?:\/\/|www\.)/i.test(m[2]) && /(?:^|\s)(?:hos|at)\s$/i.test(text.slice(Math.max(0, st - 5), st))) continue;
      add(m[2], st, 'url');
    }
    LINK2.lastIndex = 0;
    while ((m = LINK2.exec(text)) !== null) {
      var s2 = m.index + m[1].length, e2 = s2 + m[2].length;
      if (!taken.some(function (r) { return s2 < r[1] && e2 > r[0]; }) && !/(?:^|\s)(?:hos|at)\s$/i.test(text.slice(Math.max(0, s2 - 5), s2))) add(m[2], s2, 'url');
    }
    OBF_RE.lastIndex = 0;
    while ((m = OBF_RE.exec(text)) !== null) {
      var label = m[3].toLowerCase(), tl = m[4].toLowerCase(), st3 = m.index + m[1].length;
      if (taken.some(function (r) { return st3 < r[1] && st3 + m[2].length > r[0]; })) continue;
      // "en viktig punkt se upp" is Swedish, not an address: a plain word before .se or .nu needs a hyphen, a digit or a brand.
      if ((tl === 'se' || tl === 'nu') && !/[-\d]/.test(label) && !BRANDS.some(function (b) { return b.tok.indexOf(label) !== -1; })) continue;
      if (m[4] !== tl) continue;
      add(label + '.' + tl, st3, 'url', m[2].length);
    }
    if (text.indexOf('@') !== -1) {
      EMAIL_RE.lastIndex = 0;
      while ((m = EMAIL_RE.exec(text)) !== null) add(m[1], m.index + m[0].length - m[1].length, 'email');
    }
    return list;
  }

  function amounts(text) {
    var out = [], m;
    AMOUNT_RE.lastIndex = 0;
    while ((m = AMOUNT_RE.exec(text)) !== null) {
      var intPart = m[2] !== undefined ? m[2] : m[5];
      var frac = m[2] !== undefined ? m[3] : m[6];
      var lead = m[2] !== undefined ? m[1] : m[4];
      if (intPart === undefined) continue;
      var v = Number(intPart.replace(/[  .]/g, '')) + (frac ? Number('0.' + frac) : 0);
      var s = m.index + (lead ? lead.length : 0);
      out.push({ v: v, s: s, e: m.index + m[0].length, t: m[0].slice(lead ? lead.length : 0) });
    }
    return out;
  }

  function merge(ranges) {
    ranges.sort(function (a, b) { return a.s - b.s || b.e - a.e; });
    var out = [];
    ranges.forEach(function (r) {
      var last = out[out.length - 1];
      if (last && r.s <= last.e) {
        if (r.e > last.e) last.e = r.e;
        last.crit = last.crit || !!r.crit;
      } else out.push({ s: r.s, e: r.e, crit: !!r.crit });
    });
    return out;
  }

  function guessType(ids, sig, groups) {
    if (ids.remote) return 'Fjärrstyrningsbluffen';
    if (ids.tech_scare) return 'Falsk teknisk support';
    if (ids.extortion) return 'Utpressningsmejlet';
    if (ids.police_pickup) return 'Falska polisen';
    if ((ids.swish_receive || ids.payment_request) && (sig.market || groups.pay || groups.market)) return 'Köp-och-sälj-bluffen';
    if (ids.new_number || ids.family_money || ids.cant_pay_self || ids.no_voice_money) return '”Hej mamma”-bluffen';
    if (ids.advance_fee) return sig.romance ? 'Kärleksbluffen' : (sig.market || groups.market) ? 'Köp-och-sälj-bluffen' : 'Förskottsbluffen';
    if (ids.rental) return 'Hyresbluffen';
    if (ids.new_account) return 'Fakturabluffen';
    if (ids.code_mistake) return 'Kontokapning';
    if (ids.safe_account || ids.security_dept || ids.bankid_claim || (groups.bank && (ids.account_problem || ids.bankid_fix || ids.bankid_use || ids.purchase_alert || ids.code || ids.code_sms || ids.call_number || ids.stop_pretext))) return 'Falska banken';
    if (ids.code_sms) return 'Kontokapning';
    if ((groups.parcel || (sig.parcel && !ids.lure)) && (ids.small_fee || ids.link || ids.link_lookalike || ids.link_mismatch || ids.cards || ids.account_problem)) return 'Paketbluffen';
    if (groups.debt && (ids.debt || ids.link || ids.link_lookalike || ids.link_mismatch || ids.call_number)) return 'Falskt inkassokrav';
    if (groups.gov && (ids.lure || ids.cards || ids.link || ids.debt || ids.link_lookalike || ids.link_mismatch || ids.call_number || ids.legal_threat)) return 'Falsk myndighet';
    if (ids.guaranteed || ids.investment) return 'Investeringsbluffen';
    if (ids.task || ids.job) return 'Jobbluffen';
    if (sig.romance && (ids.money_request || ids.emergency || ids.secrecy || ids.romance_money)) return 'Kärleksbluffen';
    if (ids.mistaken_payment) return 'Felbetalningsbluffen';
    if (ids.gift_card) return 'Presentkortsbluffen';
    if (ids.lure) return 'Vinst- och återbäringsbluffen';
    if (ids.voicemail_link) return 'Falskt röstmeddelande';
    if (ids.wrong_number) return 'Fel nummer-bluffen';
    if (ids.debt) return 'Falskt betalningskrav';
    if (ids.account_problem || ids.bankid_fix || ids.bankid_use || ids.cards || ids.link_lookalike) return 'Nätfiske (falsk inloggning)';
    return null;
  }

  function analyze(input) {
    var raw = String(input || '');
    var original = raw.slice(0, LIMIT);
    var truncated = raw.length > LIMIT;
    if (!original.trim()) return { level: 'empty', score: 0, flags: [], links: [], todos: [], marks: [], type: null, truncated: false };
    var N = tidy(normalize(original)), text = N.t;
    FOLDING = !/[åäöÅÄÖ]/.test(text);
    var rt = FOLDING ? foldStr(text) : text;
    var sig = {}, flags = [];

    RULES.forEach(function (r) {
      var ms = [];
      r.re.forEach(function (re) { ms = ms.concat(collect(r, re, rt)); });
      if (!ms.length) return;
      sig[r.id] = ms;
      if (!r.hidden) flags.push({ id: r.id, w: r.w, title: r.title, why: r.why, todo: r.todo, matches: ms });
    });
    // The specific request for a code you have received replaces the general one.
    if (sig.code_sms) flags = flags.filter(function (f) { return f.id !== 'code'; });
    // In an extortion mail bitcoin is how they want to be paid, not an investment.
    if (sig.extortion) flags = flags.filter(function (f) { return f.id !== 'investment'; });

    var small = amounts(text).filter(function (a) { return a.v > 0 && a.v < 100; });
    LINK_RE.lastIndex = 0;
    var asksPay = sig.pay_words || sig.link_hint || LINK_RE.test(text) || F(/obetal\w*|unpaid|outstanding|betalas|(?:inte|ej) (?:är |har )?betal\w*|är betald/iu).test(rt);
    if (small.length && (sig.fee_words || sig.parcel) && asksPay) {
      flags.push({ id: 'small_fee', w: 2, title: 'Ber dig betala en liten avgift',
        why: 'Bedragare ber ofta om en liten summa för frakt, tull eller ombokning för att komma åt dina kortuppgifter. Riktig tull finns, och sedan juli 2026 kostar även billiga paket från länder utanför EU tull. Den betalar du i fraktbolagets app eller på fraktbolagets webbplats.',
        todo: 'Betala inget via meddelandet. Gäller det ett paket, kolla leveransen i fraktbolagets egen app.', matches: small });
    }
    var family = sig.family_greet || sig.family_claim;
    if (family && sig.money_request) {
      flags.push({ id: 'family_money', w: 1.5, title: 'Låtsas vara en anhörig som behöver pengar',
        why: 'Bedragare skriver ”Hej mamma” eller ”Mormor, det är jag” till tusentals nummer och hoppas att någon svarar. Rösten kan också vara falsk, gjord med AI.',
        todo: 'Ring personen på det vanliga numret innan du gör något.', matches: family });
    }
    // A recorded voice that asks you to press a key; a message that tells you to call a menu is something else.
    if (sig.press_key && !sig.call_number) {
      flags.push({ id: 'press_key', w: 1.5, title: 'Ber dig trycka på en siffra i telefonen',
        why: 'Bedragare ringer ofta med en inspelad röst som ber dig trycka på en siffra för att bli kopplad. Polisen ringer aldrig så. Den du kopplas till är bedragaren.',
        todo: 'Lägg på. Vill du kontrollera, ring själv till numret på myndighetens eller bankens webbplats.', matches: sig.press_key });
    }
    if ((sig.not_you || sig.loan_granted) && sig.call_number) {
      flags.push({ id: 'call_to_stop', w: 2, title: 'Vill att du ringer för att stoppa något',
        why: 'Ett meddelande om ett lån eller köp som du inte känner igen, med ett nummer att ringa, är ett vanligt sätt att börja ett telefonbedrägeri. Den som svarar låtsas vara banken.',
        todo: 'Ring inte numret. Logga in i bankens app själv och se om något verkligen har hänt.', matches: (sig.not_you || []).concat(sig.loan_granted || []) });
    }
    if (sig.cant_pay_self && (sig.new_number || sig.no_voice)) {
      flags.push({ id: 'cant_pay_self', w: 2, title: 'Säger att hen inte kommer åt sin bank',
        why: 'Den som skriver från ett nytt nummer, eller inte kan prata, och säger att BankID eller banken inte fungerar vill oftast att du betalar åt hen. Så brukar ”Hej mamma”-bluffen gå till.',
        todo: 'Ring personen på det vanliga numret innan du betalar något.', matches: sig.cant_pay_self });
    }
    if (sig.no_voice && sig.money_request) {
      flags.push({ id: 'no_voice_money', w: 1.5, title: 'Vill ha pengar men kan inte prata',
        why: 'Den som ber om pengar men inte kan ringa eller prata vill slippa att du hör rösten. Det är typiskt för bedragare som låtsas vara någon du känner.',
        todo: 'Ring personen på ett nummer du vet stämmer innan du skickar något.', matches: sig.no_voice });
    }
    if (sig.romance && (sig.money_request || sig.emergency)) {
      flags.push({ id: 'romance_money', w: amounts(text).some(function (a) { return a.v >= 1000; }) ? 2.5 : 1.5, title: 'Kärleksord och pengar i samma meddelande',
        why: 'Bedragare bygger upp en kärleksrelation på nätet och ber sedan om pengar för en resa, en avgift eller ett nödläge.',
        todo: 'Skicka aldrig pengar till någon du bara har träffat på nätet.', matches: sig.romance });
    }
    // R3: "Jag skickar en förfrågan till din app. Godkänn den." is a BankID request even without the word BankID.
    if (sig.push_req && sig.approve_words && !sig.bankid_use) {
      flags.push({ id: 'approve_push', w: 2.5, title: 'Vill att du godkänner något i din app',
        why: 'Den som skickar en förfrågan till din app och ber dig godkänna den vill oftast att du loggar in eller skriver under åt hen, till exempel för ett lån. Det gäller även när ordet BankID inte nämns.',
        todo: 'Godkänn ingenting som någon annan har skickat till dig. Avbryt i appen och lägg på.', matches: sig.push_req });
    }
    if (sig.qr && (sig.login_words || sig.parcel || sig.pay_words || sig.account_problem || sig.bankid_use || sig.lure)) {
      flags.push({ id: 'qr_context', w: 1.5, title: 'QR-kod för att logga in, betala eller hämta något',
        why: 'En QR-kod i ett mejl eller sms döljer vart den leder. Den kan gå till en falsk inloggningssida eller en falsk betalning.',
        todo: 'Skanna inte koden. Logga in eller betala i appen eller på webbplatsen på egen hand.', matches: sig.qr });
    }
    if (N.mixed.length) {
      flags.push({ id: 'homoglyph', w: 2.5, title: 'Ord med falska bokstäver',
        why: 'Några bokstäver kommer från ett annat alfabet men ser likadana ut. Så gör bedragare för att ta sig förbi filter och få ett falskt meddelande att se äkta ut.',
        todo: null, matches: N.mixed });
    }

    var found = findBrands(rt);
    var mentioned = found.map(function (f) { return f.b; });
    var links = findLinks(text, mentioned, N.mixed);
    var groups = {};
    mentioned.forEach(function (b) { groups[b.g] = true; });

    // A bank, authority or debt collector named next to a request is how most fake contacts open.
    var strong = sig.call_number || sig.account_problem || sig.cards || sig.bankid_use || sig.bankid_fix || sig.code || sig.code_sms || sig.stop_pretext || sig.legal_threat || sig.qr;
    var asks = strong || sig.debt;
    var who = found.filter(function (f) { return f.b.g === 'gov' || f.b.g === 'bank' || f.b.g === 'debt'; })[0];
    if (who && (who.b.g === 'debt' ? strong : asks)) {
      flags.push({ id: 'impersonation', w: 1, title: 'Säger sig komma från ' + who.b.name,
        why: 'Banker, myndigheter och inkassobolag ber aldrig om koder eller kortuppgifter i sms, och avsändarnamn går att förfalska.',
        todo: 'Kontakta ' + who.b.name + ' själv, i deras egen app, på deras webbplats eller på ett nummer du har letat upp.',
        matches: [{ s: who.i, e: who.i + who.t.length, t: who.t }] });
    }

    // Every link warning gives the same advice, so it is shown once however many link signs there are.
    var TODO_LINK = 'Klicka inte på länken. Öppna appen eller skriv in den riktiga adressen själv.';
    var anyUrl = links.some(function (l) { return l.kind === 'url'; });
    var anyBadUrl = false;
    links.forEach(function (l) {
      if (l.status === 'official' || l.status === 'self') return;
      var name = l.brand ? l.brand.name : '';
      var real = l.brand ? l.brand.dom[0] : '';
      if (l.brand) groups[l.brand.g] = true;
      if (l.status === 'homograph') {
        flags.push({ id: 'link_homograph', w: 3, title: 'Falsk adress med lånade bokstäver',
          why: 'Adressen ser ut som ' + (l.brand ? 'adressen till ' + name : 'en känd adress') + ', men några bokstäver kommer från ett annat alfabet. Den går till en helt annan webbplats.' + (l.brand ? ' Den riktiga adressen till ' + name + ' är ' + real + '.' : ''),
          todo: TODO_LINK, matches: l.ranges });
      } else if (l.status === 'hosted') {
        flags.push({ id: 'link_hosted', w: 2.5, title: l.chat ? 'Länken öppnar en chatt med ett okänt nummer' : 'Sidan kan vem som helst ha gjort',
          why: l.chat ? 'Länken öppnar en chatt i ' + name + ' med den som skickade meddelandet. Bedragare flyttar gärna kontakten till chattappar.'
            : 'Adressen hör till ' + name + ', men sidan är ett formulär, en webbplats eller en vidarebefordran som vem som helst kan skapa där. Banker, myndigheter och företag ber dig inte lämna uppgifter på sådana sidor.',
          todo: TODO_LINK, matches: l.ranges });
      } else if (l.status === 'lookalike') {
        flags.push({ id: 'link_lookalike', w: 3, title: 'Falsk adress som liknar ' + name,
          why: 'Adressen ser ut att höra till ' + name + ', men den går egentligen till ' + l.reg + '. Det är slutet av adressen som avgör vart du hamnar. Den riktiga adressen till ' + name + ' är ' + real + '.',
          todo: TODO_LINK, matches: l.ranges });
      } else if (l.status === 'mismatch') {
        flags.push({ id: 'link_mismatch', w: 2.5, title: 'Länken går inte till ' + name,
          why: 'Meddelandet nämner ' + name + ', men länken går till ' + l.reg + '. Den riktiga adressen till ' + name + ' är ' + real + '.',
          todo: TODO_LINK, matches: l.ranges });
      }
      if (l.kind !== 'url') return;
      anyBadUrl = true;
      if (l.status === 'short') flags.push({ id: 'link_short', w: 2, title: 'Förkortad länk', why: 'Förkortade länkar döljer vart de egentligen leder.', todo: TODO_LINK, matches: l.ranges });
      if (l.status === 'ip') flags.push({ id: 'link_ip', w: 2.5, title: 'Länken består av siffror', why: 'Riktiga företag och myndigheter använder namn i sina adresser, inte bara siffror.', todo: TODO_LINK, matches: l.ranges });
      if (l.status === 'puny') flags.push({ id: 'link_puny', w: 2.5, title: 'Adressen innehåller dolda specialtecken', why: 'Bokstäver från andra alfabet kan få en falsk adress att se riktig ut.', todo: TODO_LINK, matches: l.ranges });
      if (l.userinfo) flags.push({ id: 'link_userinfo', w: 2.5, title: 'Adressen är byggd för att lura ögat', why: 'Allt som står före @ i en webbadress ignoreras. Länken går egentligen till ' + l.host + '.', todo: TODO_LINK, matches: l.ranges });
      if (l.obf) flags.push({ id: 'link_obf', w: 1.5, title: 'Adressen är skriven så att den inte blir en länk', why: 'Bedragare skriver ”punkt” eller sätter mellanslag i adressen för att ta sig förbi filter. Riktiga företag och myndigheter skriver sina adresser som vanligt.', todo: TODO_LINK, matches: l.ranges });
      if (l.odd) flags.push({ id: 'link_tld', w: 1.5, title: 'Ovanlig adressändelse (.' + l.tld + ')', why: 'Adresser som slutar på till exempel .xyz, .top eller .lat är billiga att registrera och vanliga hos bluffsidor.', todo: null, matches: l.ranges });
    });
    if (anyBadUrl && sig.voicemail) {
      flags.push({ id: 'voicemail_link', w: 1.5, title: 'Röstmeddelande med länk',
        why: 'Röstmeddelanden lyssnar du på i telefonen. Ett sms med en länk till ett röstmeddelande är ett vanligt knep för att få dig att installera en skadlig app.',
        todo: 'Klicka inte på länken. Lyssna på röstbrevlådan som du brukar.', matches: sig.voicemail });
    }
    // Some pasted e-mails have no address left, only "klicka på länken nedan" or a button text.
    var hint = !anyBadUrl && !links.some(function (l) { return l.kind === 'url' && l.status === 'official'; }) && sig.link_hint;
    var aboutAny = sig.parcel || sig.fee_words || small.length || sig.lure || sig.account_problem || sig.cards || sig.bankid_use || sig.bankid_fix ||
      sig.debt || sig.swish_receive || sig.money_request || sig.legal_threat || sig.payment_request || sig.code || sig.code_sms || sig.investment || sig.easy_money ||
      sig.mistaken_payment || sig.login_words || sig.pay_words || groups.bank || groups.gov || groups.parcel || groups.pay || groups.debt || groups.id;
    if (hint && aboutAny) {
      flags.push({ id: 'link_hidden', w: 2, title: 'Ber dig klicka på en länk eller knapp',
        why: 'Meddelandet vill att du klickar dig vidare för att betala, logga in eller lämna uppgifter. Det är så nästan alla bluffmejl fungerar.',
        todo: 'Klicka inte på något i meddelandet. Öppna appen eller skriv in den riktiga adressen själv.', matches: sig.link_hint });
    }
    if (sig.rebook && (anyBadUrl || hint)) {
      flags.push({ id: 'rebook_link', w: 2, title: 'Vill att du bokar om en leverans via en länk',
        why: 'Fraktbolagen låter dig boka om i sin egen app. Ett meddelande med en länk för att boka ny tid är ett vanligt sätt att lura till sig kortuppgifter.',
        todo: 'Boka om i fraktbolagets egen app, inte via länken.', matches: sig.rebook });
    }
    if (anyBadUrl) {
      var ranges = [];
      links.forEach(function (l) { if (l.kind === 'url' && l.status !== 'official' && l.status !== 'self') ranges = ranges.concat(l.ranges); });
      // A link is far more telling when the message is about money, a parcel, an account or an authority.
      var about = sig.parcel || sig.fee_words || small.length || sig.lure || sig.account_problem || sig.cards || sig.bankid_use || sig.bankid_fix ||
        sig.debt || sig.swish_receive || sig.money_request || sig.legal_threat || sig.payment_request || sig.code || sig.code_sms || sig.investment || sig.easy_money ||
        sig.mistaken_payment || sig.login_words || sig.pay_words || groups.bank || groups.gov || groups.parcel || groups.pay || groups.debt || groups.id;
      flags.push(about
        ? { id: 'link', w: 2.5, title: 'Länk i ett meddelande om pengar, paket eller konto',
          why: 'Nästan alla bluff-sms har en länk till en falsk sida där du ska betala, logga in eller lämna uppgifter. Riktiga företag och myndigheter ber dig hellre öppna appen eller webbplatsen själv.',
          todo: TODO_LINK, matches: ranges }
        : { id: 'link', w: 1, title: 'Innehåller en länk',
          why: 'Länkar i oväntade meddelanden är det vanligaste sättet att lura folk till falska sidor.',
          todo: TODO_LINK, matches: ranges });
    }

    var appOnly = /(?:^|[^\p{L}])(?:i|via|under) (?:\p{L}+[- ])?app(?:en)?(?![\p{L}])/iu.test(text);
    if (sig.bankid_fix && appOnly && !anyBadUrl && !sig.link_hint && !sig.call_number && !sig.qr && !sig.cards && !sig.code && !sig.code_sms && !sig.bankid_use && !sig.swish_receive && !sig.chat_switch) {
      flags.forEach(function (f) { if (f.id === 'bankid_fix') f.w = 1; });
      if (!(sig.account_problem || sig.stop_pretext || sig.legal_threat || sig.debt)) flags = flags.filter(function (f) { return f.id !== 'impersonation'; });
    }
    // A message that only says to fix something in the app itself, with no link, number or other request, gives the
    // same advice as this page ("Ditt kort har nekats. Uppdatera din betalningsmetod i appen.").
    if (sig.account_problem && appOnly && !anyBadUrl && !sig.link_hint && !sig.call_number && !sig.qr && !sig.cards && !sig.code && !sig.code_sms &&
      !sig.bankid_use && !sig.swish_receive && !sig.chat_switch && !sig.reply_ask && !sig.press_key && !sig.security_dept) {
      flags.forEach(function (f) { if (f.id === 'account_problem') f.w = 1; });
      if (!(sig.bankid_fix || sig.stop_pretext || sig.legal_threat || sig.debt)) flags = flags.filter(function (f) { return f.id !== 'impersonation'; });
    }
    // R3: the page's own address next to a request. The share text and the quiz result have no request, so they stay calm.
    var selfLinks = links.filter(function (l) { return l.status === 'self'; });
    if (selfLinks.length && (anyBadUrl || sig.call_number || sig.cards || sig.code || sig.code_sms || sig.bankid_use || sig.money_request || sig.swish_receive || sig.debt)) {
      flags.push({ id: 'refers_self', w: 1.5, title: 'Hänvisar till den här sidan',
        why: 'Meddelandet ber dig kolla det här, samtidigt som det vill att du ringer, betalar eller lämnar uppgifter. Banker, myndigheter och företag gör inte så. Den här sidan kan aldrig intyga att ett meddelande är äkta.',
        todo: 'Kontakta avsändaren själv, på ett nummer eller en adress du har letat upp.', matches: selfLinks[0].ranges });
    }
    if (sig.chat_switch && (sig.job || sig.easy_money || sig.investment || sig.task || sig.guaranteed)) flags.forEach(function (f) { if (f.id === 'chat_switch') f.w = 2; });
    var acts = anyBadUrl || sig.link_hint || sig.cards || sig.code || sig.code_sms || sig.bankid_use || sig.bankid_fix || sig.call_number || sig.swish_receive ||
      sig.qr || sig.chat_switch || sig.reply_ask || sig.advance_fee || sig.gift_card || flags.some(function (f) { return f.id === 'small_fee'; });
    // Only refunds: a prize you never entered is suspicious even without a link.
    var refundOnly = sig.lure && sig.lure.every(function (m) { return F(/återb|tillbaka|betalat för mycket|överskjutande|refund/iu).test(m.t); });
    if (!acts && refundOnly) flags.forEach(function (f) { if (f.id === 'lure') f.w = 1; });
    // A landlord who cannot show the home and sends the keys by post: each alone calls for care, together they are the scam.
    if (sig.rental && /nyck/iu.test(rt) && F(/(?:kan|går) inte (?:att )?visa|visning (?:går inte|är inte möjlig|kan inte ordnas)/iu).test(rt)) {
      flags.forEach(function (f) { if (f.id === 'rental') f.w = 3; });
    }

    // One flag per id (link flags can repeat for several links; keep the strongest wording once).
    var byId = {}, uniq = [];
    flags.forEach(function (f) {
      if (byId[f.id] && f.id !== 'link_lookalike' && f.id !== 'link_mismatch') { byId[f.id].matches = byId[f.id].matches.concat(f.matches); return; }
      byId[f.id] = f;
      uniq.push(f);
    });
    flags = uniq.sort(function (a, b) { return b.w - a.w; });

    var score = 0, crit = false, ids = {};
    flags.forEach(function (f) { score += f.w; if (f.w >= 3) crit = true; ids[f.id] = true; });
    var level = crit || score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';

    // Advice that opens with the same three words says the same thing in other words ("Ring personen på ..."), so it is
    // shown once. The general "take it easy" comes last, so that the specific steps are the ones shown.
    var todos = [], firsts = [];
    flags.filter(function (f) { return f.id !== 'urgency'; }).concat(flags.filter(function (f) { return f.id === 'urgency'; })).forEach(function (f) {
      if (!f.todo) return;
      var first = f.todo.toLowerCase().split(/[ ,.]+/).slice(0, 3).join(' ');
      if (firsts.indexOf(first) !== -1) return;
      firsts.push(first);
      todos.push(f.todo);
    });
    todos = todos.slice(0, 3);

    // Back from the normalized text to the original, so marks land on what the person pasted.
    function back(m) {
      var s = N.from[m.s], e = N.to[m.e - 1];
      return { s: s, e: e, t: original.slice(s, e) };
    }
    flags.forEach(function (f) { f.matches = f.matches.filter(function (m) { return m.e > m.s; }).map(back); });
    links.forEach(function (l) { l.ranges = l.ranges.map(back); });

    var marks = [];
    flags.forEach(function (f) { f.matches.forEach(function (m) { marks.push({ s: m.s, e: m.e, crit: f.w >= 3 }); }); });

    return {
      level: level,
      score: score,
      flags: flags,
      links: links,
      todos: todos,
      marks: merge(marks),
      type: level === 'low' ? null : guessType(ids, sig, groups),
      truncated: truncated
    };
  }

  // Runs every pattern on a short sample in slices of 25 ms while the page is idle, so that the browser has compiled
  // them before the first real check. Without it the first check takes over half a second on a slow phone.
  function warm() {
    var list = [], k = 0, sample = 'Hej BankID 19 kr a@b.se https://x.se/a 070-174 06 35';
    RULES.forEach(function (r) { list.push.apply(list, r.re); if (r.ctx) list.push(r.ctx); if (r.skip) list.push(r.skip); });
    BRANDS.forEach(function (b) { if (b.words) list.push(brandRe(b)); });
    list.push(NEG, ENCOURAGE, CUT, AFTER_NEG, LINK_RE, LINK2, EMAIL_RE, AMOUNT_RE, PICT, LETTER, WORDCH, ZW);
    list = list.filter(function (re) { return re instanceof RegExp; });
    var later = typeof requestIdleCallback === 'function' ? requestIdleCallback : function (f) { setTimeout(f, 1); };
    (function step() {
      try {
        var end = Date.now() + 25;
        while (k < list.length && Date.now() < end) {
          var re = list[k++];
          re.lastIndex = 0; re.test(sample); re.lastIndex = 0; re.test(sample); re.lastIndex = 0;
        }
        if (k < list.length) later(step); else analyze(sample);
      } catch (e) {}
    })();
  }

  // A phone number pasted on its own. Nobody can tell from a number who is calling, and numbers can be faked (PTS on
  // spoofing), so this only says what kind of number it is: PTS's number series (070, 072, 073, 076, 079 mobile,
  // 020 free calls, 0900, 0939, 0944 premium rate), the country code, or one of the numbers the page itself lists.
  // Nothing is looked up anywhere. The numbers below must match the page (verify.cjs checks them).
  var NUM_KNOWN = {
    '0771778899': 'ett av Handelsbankens riktiga nummer',
    '0858840011': 'ett av Länsförsäkringars riktiga nummer',
    '084025710': 'ett av Nordeas riktiga nummer',
    '0774242424': 'ett av SEB:s riktiga nummer',
    '084111011': 'ett av Swedbanks riktiga nummer',
    '0771567567': 'ett av Skatteverkets riktiga nummer',
    '020105400': 'Konsumenternas Bank- och finansbyrås nummer',
    '08270029': 'Freja eID:s nummer för att spärra',
    '11414': 'Polisens nummer',
    '116006': 'Brottsofferjourens nummer'
  };
  var CC = {
    '1': 'USA, Kanada eller ett land i Karibien', '7': 'Ryssland eller Kazakstan', '20': 'Egypten', '27': 'Sydafrika',
    '30': 'Grekland', '31': 'Nederländerna', '32': 'Belgien', '33': 'Frankrike', '34': 'Spanien', '36': 'Ungern', '39': 'Italien',
    '40': 'Rumänien', '41': 'Schweiz', '43': 'Österrike', '44': 'Storbritannien', '45': 'Danmark', '47': 'Norge', '48': 'Polen',
    '49': 'Tyskland', '51': 'Peru', '52': 'Mexiko', '53': 'Kuba', '54': 'Argentina', '55': 'Brasilien', '56': 'Chile',
    '57': 'Colombia', '58': 'Venezuela', '60': 'Malaysia', '61': 'Australien', '62': 'Indonesien', '63': 'Filippinerna',
    '64': 'Nya Zeeland', '65': 'Singapore', '66': 'Thailand', '81': 'Japan', '82': 'Sydkorea', '84': 'Vietnam', '86': 'Kina',
    '90': 'Turkiet', '91': 'Indien', '92': 'Pakistan', '93': 'Afghanistan', '94': 'Sri Lanka', '95': 'Myanmar', '98': 'Iran',
    '211': 'Sydsudan', '212': 'Marocko', '213': 'Algeriet', '216': 'Tunisien', '218': 'Libyen', '220': 'Gambia', '221': 'Senegal',
    '222': 'Mauretanien', '223': 'Mali', '224': 'Guinea', '225': 'Elfenbenskusten', '226': 'Burkina Faso', '227': 'Niger',
    '228': 'Togo', '229': 'Benin', '230': 'Mauritius', '231': 'Liberia', '232': 'Sierra Leone', '233': 'Ghana', '234': 'Nigeria',
    '235': 'Tchad', '236': 'Centralafrikanska republiken', '237': 'Kamerun', '238': 'Kap Verde', '240': 'Ekvatorialguinea',
    '241': 'Gabon', '242': 'Kongo-Brazzaville', '243': 'Kongo-Kinshasa', '244': 'Angola', '245': 'Guinea-Bissau',
    '248': 'Seychellerna', '249': 'Sudan', '250': 'Rwanda', '251': 'Etiopien', '252': 'Somalia', '253': 'Djibouti', '254': 'Kenya',
    '255': 'Tanzania', '256': 'Uganda', '257': 'Burundi', '258': 'Moçambique', '260': 'Zambia', '261': 'Madagaskar',
    '263': 'Zimbabwe', '264': 'Namibia', '265': 'Malawi', '266': 'Lesotho', '267': 'Botswana', '268': 'Eswatini',
    '269': 'Komorerna', '291': 'Eritrea', '297': 'Aruba', '298': 'Färöarna', '299': 'Grönland', '350': 'Gibraltar',
    '351': 'Portugal', '352': 'Luxemburg', '353': 'Irland', '354': 'Island', '355': 'Albanien', '356': 'Malta', '357': 'Cypern',
    '358': 'Finland', '359': 'Bulgarien', '370': 'Litauen', '371': 'Lettland', '372': 'Estland', '373': 'Moldavien',
    '374': 'Armenien', '375': 'Belarus', '376': 'Andorra', '377': 'Monaco', '378': 'San Marino', '380': 'Ukraina',
    '381': 'Serbien', '382': 'Montenegro', '383': 'Kosovo', '385': 'Kroatien', '386': 'Slovenien',
    '387': 'Bosnien och Hercegovina', '389': 'Nordmakedonien', '420': 'Tjeckien', '421': 'Slovakien', '423': 'Liechtenstein',
    '501': 'Belize', '502': 'Guatemala', '503': 'El Salvador', '504': 'Honduras', '505': 'Nicaragua', '506': 'Costa Rica',
    '507': 'Panama', '509': 'Haiti', '591': 'Bolivia', '592': 'Guyana', '593': 'Ecuador', '595': 'Paraguay', '597': 'Surinam',
    '598': 'Uruguay', '670': 'Östtimor', '673': 'Brunei', '675': 'Papua Nya Guinea', '676': 'Tonga', '677': 'Salomonöarna',
    '678': 'Vanuatu', '679': 'Fiji', '685': 'Samoa', '686': 'Kiribati', '850': 'Nordkorea', '852': 'Hongkong', '853': 'Macao',
    '855': 'Kambodja', '856': 'Laos', '880': 'Bangladesh', '886': 'Taiwan', '960': 'Maldiverna', '961': 'Libanon',
    '962': 'Jordanien', '963': 'Syrien', '964': 'Irak', '965': 'Kuwait', '966': 'Saudiarabien', '967': 'Jemen', '968': 'Oman',
    '970': 'Palestina', '971': 'Förenade Arabemiraten', '972': 'Israel', '973': 'Bahrain', '974': 'Qatar', '975': 'Bhutan',
    '976': 'Mongoliet', '977': 'Nepal', '992': 'Tadzjikistan', '993': 'Turkmenistan', '994': 'Azerbajdzjan', '995': 'Georgien',
    '996': 'Kirgizistan', '998': 'Uzbekistan'
  };
  // Returns null unless the text is one phone number with at most a few words around it (such as "Vem ringde?"),
  // no link and no other digits. A message that contains a number is still analysed as a message.
  function numberOnly(text) {
    var t = String(text || '').normalize('NFKC').trim();
    if (!t || t.length > 120) return null;
    var found = t.match(/[+(]*\d[\d  \-‐-–.()\/]*\d/g);
    if (!found || found.length !== 1) return null;
    var shown = found[0].trim(), rest = t.replace(found[0], ' ');
    if (/\d/.test(rest) || /https?:|www\.|\w\.\w{2,}\//i.test(rest)) return null;
    if ((rest.match(/\p{L}+/gu) || []).length > 5) return null;
    var d = shown.replace(/\(0\)/g, '').replace(/[^\d+]/g, ''), intl = null;
    if (d.charAt(0) === '+') intl = d.slice(1); else if (d.slice(0, 2) === '00') intl = d.slice(2);
    // +46 is Sweden: continue as a Swedish number, also when the 0 was kept after +46.
    if (intl !== null && intl.slice(0, 2) === '46') { d = ('0' + intl.slice(2)).replace(/^00/, '0'); intl = null; }
    if (intl !== null) {
      if (intl.length < 7 || intl.length > 15) return null;
      return { shown: shown, kind: 'foreign', country: CC[intl.slice(0, 3)] || CC[intl.slice(0, 2)] || CC[intl.charAt(0)] || null };
    }
    if (d.indexOf('+') !== -1) return null;
    if (NUM_KNOWN[d]) return { shown: shown, kind: 'known', known: NUM_KNOWN[d] };
    if (d.charAt(0) !== '0' || d.length < 7 || d.length > 11) return null;
    return { shown: shown, kind: /^07[02369]/.test(d) ? 'mobile' : /^020/.test(d) ? 'free' : /^09(?:00|39|44)/.test(d) ? 'premium' : 'se' };
  }

  return { analyze: analyze, warm: warm, numberOnly: numberOnly, NUM_KNOWN: NUM_KNOWN };
})();
/*ENGINE-END*/

(function () {
  'use strict';
  var SHARE_URL = location.protocol.indexOf('http') === 0 ? location.origin + location.pathname.replace(/index\.html$/, '') : 'https://tollegoransson-maker.github.io/ar-det-bluff/';
  var CAN_OCR = true;
  var CAN_SW = true;
  var WEB = true;
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
    // Från samtalsfliken: gå direkt till rutan, så att man kan skriva in numret.
    var f = a.getAttribute('data-focus') ? document.getElementById(a.getAttribute('data-focus')) : null;
    if (f) f.focus();
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
    high: { title: 'Det här är troligen en bluff', sub: 'Gör inget av det som meddelandet ber om. Klicka inte på länkar och svara inte. Vill du kontrollera, kontakta avsändaren själv på ett nummer som du redan har eller har letat upp.' },
    medium: { title: 'Var försiktig', sub: 'Meddelandet har tecken som är vanliga i bluffar. Gör inget av det som meddelandet ber om förrän du själv har kontaktat avsändaren, till exempel på ett nummer du har letat upp.' },
    low: { title: 'Inga tydliga varningstecken', sub: 'Det betyder inte att meddelandet är äkta. Sidan känner bara igen kända knep, och ett meddelande kan vara skrivet så att den inte hittar något. Väntade du dig inte meddelandet? Klicka inte på länkar och lämna inga uppgifter förrän du själv har kontaktat avsändaren, till exempel på ett nummer du har letat upp.' }
  };
  // Står i varje svar: den som redan har agerat ska inte radera bevisen, och ska hitta hjälpen direkt.
  // Ett vanligt meddelande ska inte låta som ett brott, men vägen till hjälpen finns kvar om något ändå känns fel.
  var ALREADY = '<p class="verdict-more">Har du redan klickat, betalat eller lämnat uppgifter? Radera inte meddelandet. Det kan behövas som bevis. <a href="#lurad" data-goto="lurad">Se vad du ska göra nu</a>.</p>';
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
      h += '<p class="example-note">' + (exKey === 'vanligt' ? 'Exemplet är ett påhittat vanligt sms.' : 'Exemplet är ett påhittat bluffmeddelande.') +
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
    if (r.level === 'high') todos.push('Är det ett sms? Vidarebefordra det till 7726. Dit kan du rapportera bluff-sms, oavsett vilken operatör du har.');
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
    out.innerHTML = h + helpful(text, asked);
  }
  function helpful(text, asked) {
    if (!asked || exKey || !window.goatcounter) return '';
    return helpedFor === text ? '<p class="helpful">Tack för att du svarade.</p>'
      : '<p class="helpful" id="helpful">Hjälpte svaret dig? <button class="linkbtn" type="button" data-helpful="ja">Ja</button> eller <button class="linkbtn" type="button" data-helpful="nej">Nej</button></p>';
  }

  // Ett telefonnummer på egen hand. Sidan kan inte se vem som har ett nummer, och numret som syns kan vara förfalskat
  // (PTS om spoofing). Svaret säger därför bara vilken sorts nummer det är och vad man ska göra. Inget slås upp någonstans.
  var NUM_TITLE = 'Det går inte att se på ett nummer vem som ringer';
  function renderNumber(n, text, asked) {
    var num = '<strong>' + esc(n.shown) + '</strong>';
    var what = n.kind === 'known' ? num + ' är ' + esc(n.known) + '.'
      : n.kind === 'mobile' ? num + ' är ett svenskt mobilnummer.'
      : n.kind === 'free' ? num + ' är ett svenskt 020-nummer. Det kostar inget att ringa dit.'
      : n.kind === 'premium' ? num + ' är ett betalnummer. Samtal dit kostar extra.'
      : n.kind === 'se' ? num + ' är ett svenskt telefonnummer.'
      : num + ' är ett utländskt nummer' + (n.country ? ', från ' + esc(n.country) : '') + '.';
    // PTS: ring inte tillbaka på nummer du inte känner igen. Utlandsnummer och betalnummer kan vara dyra att ringa (wangiri).
    var back = n.kind === 'known' ? ''
      : n.kind === 'foreign' || n.kind === 'premium'
        ? '<p><strong>Har du ett missat samtal från numret?</strong> Ring inte tillbaka. Det kan kosta mycket att ringa utländska nummer och betalnummer. Vill någon verkligen nå dig ringer de nog igen.</p>'
        : '<p>Känner du inte igen numret behöver du inte ringa tillbaka. Vill någon verkligen nå dig ringer de nog igen.</p>';
    out.innerHTML = '<div class="verdict numcheck ' + (n.kind === 'premium' ? 'medium' : 'low') + '" id="verdict"><h3 class="verdict-title">' + NUM_TITLE + '</h3>' +
      '<p>' + what + '</p>' +
      '<p>Numret som syns kan vara förfalskat. Bedragare kan få det att se ut som att banken, polisen eller någon du känner ringer, även med ett riktigt nummer.</p>' +
      '<p><strong>Bad någon dig använda BankID, lämna koder eller flytta pengar?</strong> Lägg på. Ring sedan upp på ett nummer du har letat upp själv.</p>' +
      back +
      '<p class="verdict-more">Har du redan gjort något som någon i telefon bad om? <a href="#lurad" data-goto="lurad">Se vad du ska göra nu</a>.</p>' +
      speakButton() + '</div>' +
      '<p class="example-note">Fick du ett sms eller mejl från numret? Klistra in hela meddelandet i rutan, så kollar sidan det.</p>' +
      helpful(text, asked);
  }

  var LEVEL_EVENT = { high: 'kollat-troligen-bluff', medium: 'kollat-var-forsiktig', low: 'kollat-inga-tecken' }, lastCounted = '';
  function run(scroll, pasted) {
    if (canSpeak && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    var r = Bluffkoll.analyze(msg.value);
    // Ett nummer på egen hand får ett eget svar. "Inga tydliga varningstecken" kunde läsas som att numret är säkert.
    var num = r.level === 'low' && !exKey ? Bluffkoll.numberOnly(msg.value) : null;
    if (num) renderNumber(num, msg.value, scroll); else render(r, msg.value, scroll);
    shownFor = r.level === 'empty' ? null : msg.value;
    announce(r.level === 'empty' ? 'Klistra in eller skriv av ett meddelande i rutan först.' : 'Svar: ' + (num ? NUM_TITLE : VERDICT[r.level].title) + '.');
    // Ett eget meddelande räknas en gång, med svaret det fick. Exempel och text under skrivning räknas inte.
    if (scroll && !exKey && r.level !== 'empty' && msg.value !== lastCounted) { lastCounted = msg.value; track(num ? 'kollat-nummer' : LEVEL_EVENT[r.level]); }
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
    transfer: 'Riktiga banker, myndigheter och företag kopplar inte samtal till varandra. Ring upp själv på ett nummer du har letat upp.',
    bankid: 'Legitimera dig inte. Den som får dig att använda BankID kan ta lån och tömma konton i ditt namn. Frågar appen om samtalet, svara som det är och tryck på Avbryt.',
    codes: 'Säg inga koder eller kortnummer, inte ens om personen redan vet ditt namn och personnummer.',
    money: 'Det finns inga säkra konton. Flytta inga pengar.',
    remote: 'Installera ingenting. Har du redan gjort det: koppla bort internet direkt och avinstallera appen.',
    pickup: 'Polisen och banken hämtar aldrig kort, kontanter eller smycken. Öppna inte dörren. Ring 112 om någon är på väg.',
    pressure: 'Bråttom är ett varningstecken. Du får alltid lägga på och fråga någon du litar på.',
    offer: 'Garanterade vinster och pengar som ”väntar på dig” är lockbeten.',
    family: 'Ring din anhöriga på det vanliga numret och fråga efter ert familjeord.'
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
      callOut.innerHTML = '<div class="verdict medium"><h3 class="verdict-title">Lägg på och ring upp själv</h3><p>Det kan vara äkta, men numret som syns i telefonen kan vara förfalskat, även om det är bankens eller polisens riktiga nummer. Ring upp på ett nummer du har letat upp själv, till exempel på bankens webbplats eller på ditt kort. En riktig bank eller myndighet förstår det.</p>' + speakButton() + '</div>';
      return;
    }
    trackOnce('samtal-lagg-pa');
    // Råden står redan under raderna man har kryssat i, så rutan upprepar dem inte.
    callOut.innerHTML = '<div class="verdict high"><h3 class="verdict-title">Lägg på nu</h3><p>Det du har kryssat i är precis så bedragare arbetar. En riktig bank, polis eller myndighet som ringer dig gör aldrig så. Vill du kontrollera, ring upp själv på ett nummer du har letat upp, till exempel på bankens webbplats eller på ditt kort.</p>' +
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
    family: { w: 3, note: 'Ring personen på det vanliga numret innan du gör något.' },
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
      why: 'Koden kom för att du själv just loggade in, och det är det som avgör. Texten i sms:et kan en bedragare också skriva. Får du en kod utan att ha loggat in: ge den aldrig till någon och byt lösenord.' },
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
      why: 'Polisen hämtar aldrig kort, kontanter eller smycken. Stäng dörren och ring 112.' }
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
      : qScore >= 7 ? 'Bra. Läs igenom ”Det här gäller alltid” längre upp på sidan, så blir det ännu lättare.'
      : 'Bra att du testade. Läs ”Det här gäller alltid” längre upp på sidan och prova igen.';
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
      share('Jag fick ' + qScore + ' av ' + QUIZ.length + ' rätt på blufftestet. Klarar du det? ' + SHARE_URL + '#testa', null, 'Resultatet är kopierat. Klistra in det där du vill dela det.', $('#quiz-status'));
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
