/*ENGINE-START*/
var Bluffkoll = (function () {
  'use strict';
  var BID = 'bank[- ]?id';
  var EID = '(?:bank[- ]?id|freja ?e-?id\\+?)';
  var LIMIT = 20000;
  function W(src, flags) {
    return new RegExp('(^|[^\\p{L}\\p{N}])(' + src + ')(?![\\p{L}\\p{N}])', flags || 'giu');
  }
  var NEG = /(^|[^\p{L}])(aldrig|inte|ej|icke|never|not|don'?t|do not|utan att)(?![\p{L}])/iu;
  // "Glöm inte" and "tveka inte" push you to act, so they do not turn a request into a warning.
  var ENCOURAGE = /(?:glöm|tveka|missa|dröj|vänta)\s+(?:inte|ej|aldrig)|(?:don'?t|do not|never)\s+(?:forget|hesitate|miss|wait|delay)/giu;
  // A new clause starts after punctuation and after "men", "but" or "utan" (but not "utan att").
  var CUT = /[,.;:!?\n]|\s(?:men|but|utan(?!\s+att))\s/giu;
  var AFTER_NEG = /^\s+(?:inte|aldrig|ej)(?![\p{L}])/iu;

  var RULES = [
    { id: 'safe_account', w: 3,
      title: 'Vill att du flyttar pengar för att ”skydda” dem',
      why: 'Det finns inga säkra konton. Ingen bank, polis eller myndighet ber dig någonsin flytta pengar för att skydda dem.',
      todo: 'Flytta inga pengar. Kontakta din bank själv om du är orolig.',
      re: [
        W('säkert konto|säkra konton|säkra kontot|skyddat konto|skyddade kontot|tryggt konto|säkerhetskonto\\w*|reservkonto\\w*|safe account|secure account'),
        W('(?:flytta|flyttar|för över|föra över|överför|överföra|sätt in|sätta in)[^.!?\\n]{0,25}(?:pengar\\w*|sparpengar\\w*|besparingar\\w*|kapital\\w*|saldo\\w*)[^.!?\\n]{0,40}(?:säker\\w*|skydd\\w*|trygg\\w*)'),
        W('move your (?:money|savings|funds)|transfer your (?:money|savings|funds)')
      ] },
    { id: 'remote', w: 3,
      title: 'Vill att du installerar en app för fjärrstyrning',
      why: 'Med en sådan app kan någon annan se och styra din telefon eller dator, och kommer då också åt din bank.',
      todo: 'Installera ingenting som någon annan ber dig om. Har du redan gjort det: koppla bort internet direkt.',
      re: [W('anydesk|any desk|teamviewer|team viewer|quicksupport|quick support|rustdesk|supremo|ultraviewer|zoho assist|splashtop|logmein|fjärrstyr\\w*|fjärråtkomst|fjärrhjälp|fjärrsupport|dela (?:din |er )?skärm(?:en)?|skärmdelning|remote access|remote support|share your screen')] },
    { id: 'tech_scare', w: 2,
      title: 'Påstår att din dator eller telefon har virus',
      why: 'Falska virusvarningar ska få dig att ringa en ”support” eller installera en app. Microsoft, Apple och andra företag ringer eller skickar aldrig sms om virus.',
      todo: 'Ring inte numret och installera ingenting. Är du orolig, fråga någon du känner som kan datorer.',
      re: [W('(?:din|er|datorn|telefonen|mobilen|enheten)(?: (?:dator|telefon|mobil|enhet))?[^.!?\\n]{0,30}(?:har blockerats|är blockerad|har låsts|är infekterad|är smittad|har infekterats|har hackats|är hackad|har virus)|virus\\w* (?:har )?(?:upptäckts|hittats|upptäckt|hittat)|(?:upptäckt|hittat) (?:ett |flera )?virus|teknisk support|(?:microsoft|apple|windows)[- ]?(?:support|säkerhet)|your (?:computer|device|phone) (?:is|has been) (?:infected|locked|hacked)|virus detected')] },
    { id: 'secrecy', w: 3,
      title: 'Ber dig hålla det hemligt',
      why: 'Bedragare vill hindra dig från att prata med någon som kan avslöja bluffen. Riktiga banker och myndigheter säger aldrig så.',
      todo: 'Prata med någon du litar på innan du gör något.',
      re: [W('berätta inte (?:det |detta |något |nåt |om det |om detta )?(?:för|till) (?:någon|nån|banken|polisen|din familj|dina barn|personalen|kassan|mamma|pappa|mormor|morfar|farmor|farfar)|säg (?:inte|inget|ingenting) (?:om det |om detta )?(?:till|för) (?:någon|nån|banken|polisen|personalen|kassan|din familj|dina barn|mamma|pappa)|prata inte med (?:någon|nån|banken|polisen|din familj|dina barn|personalen)|ring inte (?:till )?(?:mamma|pappa|mormor|morfar|farmor|farfar|morsan|farsan|någon|nån|banken|polisen|dina föräldrar)|håll (?:det här|detta|det) (?:hemligt|för dig själv)|(?:det här|detta) (?:måste )?stanna(?:r)? mellan oss|lägg inte på|inte berätta (?:det )?(?:för|om)|ingen (?:annan )?får veta|don\'?t tell|do not tell|keep (?:this|it) (?:secret|confidential|between us)')] },
    { id: 'code_mistake', w: 3,
      title: 'Påstår att en kod har skickats till dig av misstag',
      why: 'Det här är ett vanligt sätt att kapa WhatsApp- och e-postkonton. Koden är nyckeln till ditt konto.',
      todo: 'Skicka aldrig vidare en kod du har fått, oavsett vem som frågar.',
      re: [W('(?:skicka|skickade|skickat|fått|fick|kom)[^.!?\\n]{0,40}(?:kod|koden|koder)[^.!?\\n]{0,40}(?:av misstag|till fel nummer|felaktigt|av en slump)|råkade (?:ange|skriva in|skriva|använda|uppge|lägga in) ditt (?:nummer|telefonnummer|mobilnummer)|(?:sent|send)[^.!?\\n]{0,40}code[^.!?\\n]{0,30}(?:by mistake|wrong number)')] },
    { id: 'code_sms', w: 3, neg: true,
      title: 'Ber dig lämna en kod som du har fått',
      why: 'Koden i ett sms från banken, BankID eller en app är nyckeln till ditt konto. Den som får den kan logga in som du, till exempel i WhatsApp eller banken.',
      todo: 'Ge aldrig bort en kod du har fått, oavsett vem som frågar.',
      re: [
        W('(?:skicka|skickar|svara med|lämna|uppge|berätta|läs upp|läsa upp|ge mig|ge oss|vidarebefordra|dela|säg|säga)[^.!?\\n]{0,45}(?:engångskod\\w*|sms-?kod\\w*|verifieringskod\\w*|bekräftelsekod\\w*|säkerhetskod\\w*|aktiveringskod\\w*|inloggningskod\\w*|bank-?id-?kod\\w*|koden (?:du (?:har )?fått|som (?:du )?(?:har )?fått|i sms\\w*|från (?:banken|sms\\w*)|vi (?:har )?skickat|vi skickade|som kom))'),
        W('(?:engångskod\\w*|sms-?kod\\w*|verifieringskod\\w*|bekräftelsekod\\w*|säkerhetskod\\w*|aktiveringskod\\w*|inloggningskod\\w*|en kod|koden)[\\s\\S]{0,90}?(?:läsa upp|läs upp|läser upp|skicka|skickar|vidarebefordra|berätta|säga|säg|ge mig|ge oss)\\s+(?:den|dem|koden|siffrorna)'),
        W('(?:sex|fyra|fem|åtta|6|4|5|8)[- ]?siffr\\w*[\\s\\S]{0,60}?(?:läsa upp|läs upp|skicka|skickar|vidarebefordra|berätta|säga|säg|ge mig)\\s+(?:dem|den|siffrorna|koden)'),
        W('(?:send|tell|share|forward|give|read)[^.!?\\n]{0,30}(?:verification code|one-time code|otp|6-digit code|six-digit code|code (?:you|we) (?:got|received|sent))')
      ] },
    { id: 'swish_receive', w: 3, neg: true,
      title: 'Säger att du måste göra något för att ta emot pengar',
      why: 'För att ta emot pengar behöver du aldrig använda BankID, godkänna något eller lämna kortuppgifter. Det du godkänner är i själva verket en betalning från dig.',
      todo: 'Godkänn ingenting. Pengar som skickas till dig kommer in utan att du gör något.',
      re: [
        W('(?:ta emot|tar emot|få|motta)[^.!?\\n]{0,40}(?:swish\\w*|betalning\\w*|pengar\\w*|beloppet|ersättning\\w*|återbetalning\\w*|utbetalning\\w*)[^.!?\\n]{0,60}(?:bank[- ]?id|godkänn\\w*|signera\\w*|legitimera\\w*|kortuppgifter\\w*|kortnummer|fyll i|logga in)'),
        W('(?:bank[- ]?id|godkänn\\w*|signera\\w*|legitimera\\w*|bekräfta\\w*|verifiera\\w*|klicka|kortuppgifter\\w*|kortnummer|fyll i|logga in)[^.!?\\n]{0,60}(?:så får du|så kan du (?:få|ta emot)|och få|och ta emot|för att (?:kunna )?(?:få|ta emot|motta|få ut|ta ut)|så att du (?:kan|får)(?: få| ta emot)?|och sen (?:får|kan) du(?: få| ta emot)?)[^.!?\\n]{0,30}(?:pengar\\w*|betalt|betalning\\w*|beloppet|swish\\w*|ersättning\\w*|återbetalning\\w*|utbetalning\\w*)'),
        W('(?:receive|get|claim)[^.!?\\n]{0,40}(?:payment|money|funds|refund)[^.!?\\n]{0,40}(?:card|bank ?id|log ?in|verify|confirm)')
      ] },
    { id: 'cards', w: 3, neg: true,
      title: 'Ber om kortuppgifter, lösenord eller personnummer',
      why: 'Banker, myndigheter och seriösa företag ber aldrig om sådant i sms, mejl eller chatt.',
      todo: 'Lämna inga kortuppgifter, lösenord eller personnummer.',
      re: [
        W('(?:ange|anger|uppge|uppger|lämna|lämnar|skicka|skickar|svara med|fyll i|fylla i|fyller i|skriv in|skriva in|bekräfta|bekräftar|verifiera|verifierar|uppdatera|uppdaterar|registrera|registrerar|lägg till|lägga till|dela|delar|knappa in|mata in)[^.!?\\n]{0,45}(?:kortuppgifter\\w*|kortnummer\\w*|kortinformation\\w*|kortdetaljer\\w*|betalkort\\w*|kreditkort\\w*|cvc|cvv|cvv2|bankuppgifter\\w*|kontouppgifter\\w*|kontonummer\\w*|clearingnummer\\w*|betalningsuppgifter\\w*|betaluppgifter\\w*|betalningsinformation\\w*|inloggningsuppgifter\\w*|lösenord\\w*|personnummer\\w*)'),
        W('(?:enter|provide|confirm|update|send|share|verify|submit)[^.!?\\n]{0,45}(?:card (?:details|number|info\\w*)|cvv|cvc|password|bank (?:details|account)|payment (?:details|info\\w*)|login details)')
      ] },
    { id: 'police_pickup', w: 3, skip: /(?:hennes|hans|deras|sina|sitt|sin)\s+(?:smycken|värdesaker|kontanter|pengar|guld|bankkort|kort)/iu,
      title: 'Säger att någon ska hämta pengar, kort eller smycken',
      why: 'Polisen och banken hämtar aldrig kort, kontanter eller smycken hemma hos dig.',
      todo: 'Öppna inte dörren och lämna inte ifrån dig något. Ring 112 om någon är på väg.',
      re: [
        W('(?:polis\\w*|bank\\w*|kollega\\w*|bud\\w*|väktare\\w*|vakt\\w*)[^.!?\\n]{0,80}(?:hämta|hämtar|komma och hämta|förvara|förvarar|ta hand om|samla in)[^.!?\\n]{0,40}(?:smycken|värdesaker|kontanter|pengar\\w*|guld\\w*|bankkort\\w*|kortet|korten|kort)'),
        W('(?:vill|ska|kommer att|kommer och|måste|behöver)[^.!?\\n]{0,20}(?:ta med sig|ta med|hämta|förvara|ta hand om|samla in|lämna över|överlämna)[^.!?\\n]{0,40}(?:smycken|värdesaker|kontanter|guld\\w*|bankkort\\w*|kortet|korten|kort)')
      ] },
    { id: 'guaranteed', w: 3,
      title: 'Lovar garanterad eller orimligt hög vinst',
      why: 'Garanterad avkastning finns inte, och ingen seriös placering ger flera procent i månaden. Den som lovar det försöker lura dig.',
      todo: 'Skicka inga pengar och lämna inga uppgifter.',
      re: [W('garanterad (?:avkastning|vinst|inkomst|ränta)|garanterat (?:avkastning|vinst|resultat)|riskfri\\w* (?:investering\\w*|avkastning|vinst)|helt utan risk|(?:avkastning|vinst|tjäna|tjänar|ger|gav|ökar|ökade|växer|växte)[^.!?\\n]{0,40}\\d+(?:[,.]\\d+)? ?(?:%|procent) (?:i|per|varje|om) (?:månaden|månad|veckan|vecka|dagen|dag|dygnet)|guaranteed (?:returns?|profits?|income)|risk[- ]free')] },
    { id: 'bankid_fix', w: 2.5,
      title: 'Påstår att ditt BankID måste åtgärdas',
      why: 'Bedragare skickar ofta meddelanden om att BankID har spärrats eller måste förnyas. Förnya bara BankID i din banks egen app, aldrig via en länk eller på uppmaning i telefon.',
      todo: 'Förnya eller lås upp BankID bara i din banks egen app, som du öppnar själv.',
      re: [
        W('(?:förnya|förnyar|aktivera|aktiverar|återaktivera|reaktivera|uppdatera|uppdaterar|lås upp|låsa upp)[^.!?\\n]{0,45}' + EID),
        W(EID + '[^.!?\\n]{0,45}(?:spärrat|spärrats|spärras|blockerat|blockerats|blockeras|upphör|går ut|har gått ut|löper ut|har löpt ut|ogiltigt|ogiltig|inaktiverat|inaktiveras|måste förnyas|behöver förnyas|stängs av|har stängts av|avslutas)')
      ] },
    { id: 'bankid_use', w: 2.5, neg: true,
      title: 'Ber dig använda BankID',
      why: 'BankID är din digitala namnteckning. Den som får dig att legitimera dig eller skriva under kan logga in som du, ta lån och tömma konton.',
      todo: 'Använd aldrig BankID när någon annan har bett dig. Bara när du själv har startat något.',
      re: [
        W('(?:legitimera|legitimerar|identifiera|identifierar|signera|signerar|godkänn|godkänna|godkänner|logga in|loggar in|skriv under|skriva under|bekräfta|bekräftar|verifiera|verifierar|skanna|scanna|läs av)[^.!?\\n]{0,45}' + EID),
        W(EID + '[^.!?\\n]{0,50}(?:skanna|scanna|legitimera|identifiera|signera|godkänn\\w*|logga in|skriv under|bekräfta|verifiera)'),
        W('(?:legitimera|identifiera|signera|verifiera|bekräfta) dig (?:i|med|via|genom) (?:appen|bank-?appen|mobilen|telefonen|' + BID + ')'),
        W('(?:verify|confirm|sign|log ?in|identify|approve|scan)[^.!?\\n]{0,45}bank ?id')
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
      todo: 'Kolla i din bank om pengarna verkligen har kommit in. Skicka inget tillbaka själv, kontakta banken.',
      re: [W('(?:swishade|swishat|skickade|skickat|betalade|betalat|överförde|fört över|förde över|satte in|satt in)[^.!?\\n]{0,40}(?:av misstag|till fel (?:nummer|person|konto)|felaktigt|av en slump)|(?:sent|paid|transferred)[^.!?\\n]{0,30}(?:by mistake|by accident|to the wrong)')] },
    { id: 'new_number', w: 2.5,
      title: 'Påstår sig ha ett nytt nummer',
      why: 'Så börjar ”Hej mamma”-bluffen. Någon låtsas vara en anhörig med ny telefon och ber snart om pengar.',
      todo: 'Ring personen på det gamla, vanliga numret, eller ställ en fråga som bara hen kan svara på.',
      re: [W('nytt nummer|nya nummer|nytt mobilnummer|nytt telefonnummer|ny telefon|ny mobil|tappat (?:min (?:telefon|mobil)|mobilen|telefonen)|tappade (?:min (?:telefon|mobil)|mobilen|telefonen)|(?:telefonen|mobilen|min telefon|min mobil) (?:gick|är|har gått) sönder|(?:telefonen|mobilen|min telefon|min mobil|min) är på (?:lagning|reparation|service)|skriver från (?:min |en |mitt )?(?:jobbtelefon\\w*|jobbmobil\\w*|kompis\\w* (?:telefon|mobil)|väns (?:telefon|mobil)|lånad\\w* (?:telefon|mobil)|annan (?:telefon|mobil))|spara (?:detta|det här|mitt|det nya) (?:nummer|numret|nya nummer)|spara numret|lånad telefon|lånar (?:en )?kompis(?:ens)? (?:telefon|mobil)|bytt nummer|new number|lost my phone|broke my phone|save (?:this|my) (?:new )?number')] },
    { id: 'security_dept', w: 2, ctx: /bedragare|bluffare|utger sig|påstår sig|låtsas|scammers?|pretend/iu,
      title: 'Hänvisar till en ”säkerhetsavdelning”',
      why: 'Falska säkerhetsavdelningar är ett av de vanligaste knepen. När du ringer upp svarar bedragaren och ber dig använda BankID.',
      todo: 'Ring din bank på numret som står på bankens webbplats eller på ditt kort.',
      re: [W('säkerhetsavdelning\\w*|bedrägeriavdelning\\w*|bedrägerienhet\\w*|säkerhetsenhet\\w*|säkerhetsteam\\w*|spärravdelning\\w*|fraud (?:department|team|unit)|security (?:department|team)')] },
    { id: 'account_problem', w: 2,
      title: 'Påstår att något är fel som du måste rätta',
      why: 'Ett påstått problem med kontot, kortet eller adressen är ett vanligt sätt att få dig att logga in på en falsk sida eller ringa ett falskt nummer.',
      todo: 'Logga in själv i appen eller på webbplatsen, inte via länken, och se om något verkligen är fel.',
      re: [
        W('(?:misstänkt|misstänkta|ovanlig|ovanliga|obehörig|obehöriga|okänd|okända|avvikande) (?:aktivitet\\w*|inloggning\\w*|transaktion\\w*|köp|användning|betalning\\w*|enhet)'),
        W('(?:ditt|ert|din|er) (?:konto|kort|bankkort|abonnemang|e-postkonto|mejlkonto|profil|medlemskap)[^.!?\\n]{0,30}(?:spärrat|spärrats|spärras|låst|låsts|låses|stängt|stängts|stängs|blockerat|blockerats|blockeras|inaktiverat|inaktiveras|avstängt|avstängd|fryst|frysts|begränsat|begränsats|pausat|pausats|hackat|hackats|kapat|kapats)'),
        W('säkerhetsproblem|säkerhetsåtgärd\\w*|(?:uppdatera|bekräfta|verifiera|kontrollera|validera|säkra) (?:dina|era|ditt|ert|din|er) (?:uppgifter|konto|identitet|information|betalningsuppgifter|kontouppgifter|profil|adress|leveransadress|adressuppgifter)'),
        W('(?:ditt|ert) (?:kort|bankkort|konto|kreditkort) har (?:använts|missbrukats|kapats|hackats|spärrats|låsts)'),
        W('ofullständig (?:adress|leveransadress|adressinformation|adressuppgift\\w*)|felaktig (?:adress|leveransadress|adressuppgift\\w*)|(?:din|er) (?:adress|leveransadress)[^.!?\\n]{0,20}(?:är ofullständig|är felaktig|saknas)|boka (?:ny|om) (?:leveranstid|leverans\\w*)|ny leveranstid|ny enhet har (?:lagts till|registrerats|kopplats|anslutits)'),
        W('unusual activity|suspicious (?:activity|login|sign-in)|account (?:has been |is |was )?(?:locked|suspended|limited|disabled|compromised)|verify your (?:account|identity|information)|update your (?:payment|billing|account)')
      ] },
    { id: 'debt', w: 2,
      title: 'Hotar med skuld, böter eller Kronofogden',
      why: 'Hot om skulder och böter ska skrämma dig att betala snabbt. Kontrollera alltid själv, till exempel på kronofogden.se eller hos företaget.',
      todo: 'Betala inget via meddelandet. Kontrollera skulden själv, på ett sätt du väljer.',
      re: [W('obetald\\w* (?:skuld\\w*|faktura\\w*|räkning\\w*|avgift\\w*|böter|parkeringsavgift\\w*|skatt|vägtull\\w*|trängselskatt|trafikbot\\w*|parkeringsbot\\w*)|skuld (?:hos|till)|betalningskrav\\w*|betalningspåminnelse\\w*|kravbrev\\w*|restskatt\\w*|tilläggsavgift\\w*|inkasso\\w*|utmätning\\w*|betalningsanmärkning\\w*|betalningsföreläggande\\w*|trafikbot\\w*|parkeringsbot\\w*|fortkörningsbot\\w*|ordningsbot\\w*|böter|bötesbelopp\\w*|kontrollavgift\\w*|rättsliga åtgärder|stämning|kronofogden|debt collect\\w*|legal action|unpaid (?:invoice|bill|fee|toll|fine)')] },
    { id: 'legal_threat', w: 2,
      title: 'Hotar med polis, åtal eller domstol',
      why: 'Falska kallelser från ”polisen”, ”Europol” eller en domstol ska skrämma dig att svara, betala eller lämna uppgifter. Riktiga kallelser kommer inte som sms eller mejl med krav på snabbt svar.',
      todo: 'Svara inte. Vill du kontrollera, ring polisen på 114 14.',
      re: [W('kallats till förhör|kallelse till förhör|kallad till förhör|förhör (?:hos|på|med) polisen|åklagar\\w*|åtal\\w*|rättegång\\w*|arresteringsorder|häktningsorder|anhållningsorder|brottsmisstänkt|misstänkt för (?:brott|bedrägeri|penningtvätt)|penningtvätt|europol|interpol|polisanmäl\\w* (?:dig|er)|arrest warrant|court summons|legal proceedings')] },
    { id: 'lure', w: 2,
      title: 'Lockar med pengar, vinst eller gåva',
      why: 'Löften om pengar tillbaka, vinster eller gåvor är ett vanligt lockbete för att komma åt dina kortuppgifter.',
      todo: 'Kontrollera själv hos avsändaren. Pengar du har rätt till får du utan att lämna kortuppgifter.',
      re: [W('skatteåterbäring\\w*|återbäring\\w*|återbetalning\\w*|pengar tillbaka|pengar att få tillbaka|(?:få|får) tillbaka \\d[\\d  ]* ?(?:kr|kronor)|betalat för mycket|överskjutande skatt|du har vunnit|du har valts ut|du är utvald|vinnare|belöning\\w*|lojalitetsbonus|gratis (?:iphone|ipad|presentkort|produkt\\w*|gåva)|ett presentkort|presentkort (?:på|värt)|kundundersökning\\w*|refund\\w*|you (?:have )?won|winner|congratulations|reward|free gift|claim your')] },
    { id: 'investment', w: 2,
      title: 'Handlar om investering eller snabba pengar',
      why: 'Investeringsbedrägerier lockar med hög avkastning, ofta via falska kändisannonser eller en ”mentor”. Pengarna försvinner och sedan kommer krav på mer.',
      todo: 'Investera aldrig via någon som har kontaktat dig. Kontrollera företaget på fi.se.',
      re: [W('passiv inkomst|tjäna (?:pengar|stora pengar|massor|extra) (?:snabbt|hemifrån|enkelt|på nätet)|dubbla (?:dina|era) pengar|investera\\w*|investering\\w*|krypto\\w*|bitcoin|ethereum|digitala tillgångar|tradingrobot\\w*|börsrobot\\w*|ai-?robot\\w*|ai[- ]trading|ai-?handel\\w*|ai-?plattform\\w*|tradingplattform\\w*|handelsplattform\\w*|(?:mentor|coach)[^.!?\\n]{0,40}(?:tjäna|pengar|investera|trading|avkastning)|aktietips|forex|passive income|double your money|crypto\\w*|investment\\w*')] },
    { id: 'easy_money', w: 2,
      title: 'Lovar mycket pengar på kort tid',
      why: 'Löften om att tjäna tusentals kronor om dagen eller i veckan, utan att det framgår hur, är typiska för investerings- och jobbluffar.',
      todo: 'Svara inte. Ingen seriös arbetsgivare eller investering lovar sådana summor i ett oväntat meddelande.',
      re: [W('tjäna \\d[\\d  .,–-]* ?(?:kr|kronor|sek|:-|\\$|€)? ?(?:per|om|i|varje|på en) (?:dag|dagen|timme|timmen|vecka|veckan|månad|månaden)|earn \\$?\\d[\\d,.]* (?:per|a|every) (?:day|hour|week|month)')] },
    { id: 'task', w: 3,
      title: 'Erbjuder betalt för att gilla eller titta på klipp',
      why: 'Det här är ett känt bedrägeri. Först får du små summor, sedan måste du sätta in egna pengar för att få ut din ”lön”, och de pengarna försvinner.',
      todo: 'Svara inte. Riktiga arbetsgivare betalar inte för att du gillar klipp och kräver aldrig att du sätter in pengar.',
      re: [W('(?:betalt|ersättning|provision|\\d+ ?kr|\\$\\d+)[^.!?\\n]{0,30}(?:per|för varje) (?:gillad\\w*|gilla-?markering\\w*|like|klipp|video\\w*|uppgift|recension\\w*)|(?:ge (?:dem|det|klippen|videorna|inläggen) tummen upp|gilla (?:videor|videos|klipp)|titta på (?:korta )?(?:klipp|videor|videos))[\\s\\S]{0,80}?(?:betalt|ersättning|provision|\\d+ ?kr|tjäna)|(?:betalt|tjäna pengar|ersättning|lön) för att (?:gilla|titta|recensera|betygsätta|skriva recensioner|följa)|gilla (?:videor|videos|klipp)|like videos|paid (?:to|for) (?:like|watch|review)\\w*|per like')] },
    { id: 'job', w: 2,
      title: 'Jobberbjudande som låter för bra',
      why: 'Falska jobb lockar med lätta pengar för enkla uppgifter. Snart måste du ”sätta in pengar” för att få ut din lön.',
      todo: 'Svara inte. Riktiga arbetsgivare kräver aldrig att du betalar något.',
      re: [W('extrajobb|deltidsjobb|jobba hemifrån|jobb hemifrån|arbeta hemifrån|flexibelt (?:jobb|arbete|extrajobb)|work from home|part[- ]time job')] },
    { id: 'payment_request', w: 1.5,
      title: 'Nämner en betalningsförfrågan',
      why: 'En betalningsförfrågan i Swish betyder att du ska betala, inte att du får pengar. Bedragare påstår ofta motsatsen.',
      todo: 'Läs noga i Swish vem som betalar till vem innan du godkänner något.',
      re: [W('betalningsförfrågan|betalförfrågan|swish-?förfrågan|förfrågan i swish')] },
    { id: 'money_request', w: 1.5,
      title: 'Ber dig skicka pengar',
      why: 'En oväntad begäran om pengar, särskilt via Swish, är ett av de vanligaste tecknen på bedrägeri. En Swish-betalning går inte att ångra.',
      todo: 'Skicka inga pengar förrän du har pratat med personen på ett sätt du vet fungerar.',
      re: [
        W('(?:kan du|skulle du kunna|kan ni|snälla|jag behöver|behöver|måste du)[^.!?\\n]{0,45}(?:swisha|låna mig|låna ut|betala|föra över|överföra|skicka pengar|lägga ut|sätta in pengar)'),
        W('swisha (?:mig |hit |till mig |till det här numret )?\\d[\\d  ]*(?:kr|kronor|:-|sek)?|swisha (?:mig|hit|till mig|till det här numret)'),
        W('(?:jag behöver|behöver|måste få|behöver låna)[^.!?\\n]{0,30}\\d[\\d  ]* ?(?:kr|kronor|:-|sek|euro|dollar|pund)'),
        W('hjälp med pengar|låna pengar|behöver pengar|skicka pengar|hjälpa mig med (?:en |lite )?(?:betalning|räkning|pengar|faktura)|skicka tillbaka (?:dem|pengarna|beloppet|summan)'),
        W('(?:can you|could you|please|i need)[^.!?\\n]{0,45}(?:send|transfer|lend|pay)[^.!?\\n]{0,30}(?:money|\\$|€|£|\\d)')
      ] },
    { id: 'urgency', w: 1.5,
      title: 'Försöker stressa dig',
      why: 'Tidspress är bedragarens viktigaste verktyg. Den som är stressad hinner inte tänka efter.',
      todo: 'Ta det lugnt. Riktiga banker och myndigheter ger dig tid att tänka.',
      re: [W('inom (?:\\d+|en|ett|två|tre|fyra|fem|sex|tolv|tjugofyra|fyrtioåtta) ?(?:timme|timmar|tim|h|dagar|dygn|minuter|min)|omedelbart|omgående|snarast(?: möjligt)?|genast|med en gång|brådskande|akut|sista (?:påminnelse\\w*|varning\\w*|chans\\w*|dagen)|senast (?:idag|i dag|ikväll|i kväll|imorgon|i morgon)|innan midnatt|före midnatt|annars (?:kommer|stängs|spärras|blir|förlorar|går|tas|debiteras|skickas|raderas|returneras|överlämnas|lämnas|anmäls|polisanmäls|åtalas|förfaller)|för att undvika|kommer (?:att )?(?:spärras|stängas|avslutas|raderas|blockeras|returneras|debiteras|förfalla|skickas till inkasso|lämnas till inkasso|överlämnas|polisanmälas)|urgent\\w*|immediately|within \\d+ ?(?:hours|hrs|h|days)|final (?:notice|reminder|warning)|act now|last chance|expires? today')] },
    { id: 'stop_pretext', w: 1.5,
      title: 'Säger att du måste göra något för att stoppa ett köp eller lån',
      why: 'Ett påstått köp eller lån som bara du kan stoppa är ett vanligt knep. Det du godkänner då är ofta själva bedrägeriet.',
      todo: 'Gör ingenting via meddelandet eller samtalet. Logga in i bankens app själv och se om något har hänt.',
      re: [W('(?:för att|så att vi kan|så vi kan|så kan vi) (?:kunna )?(?:stoppa|avbryta|spärra|förhindra|neka|makulera|annullera|blockera|häva|återkalla) (?:köpet|köpen|lånet|lånen|ett köp|ett lån|betalningen|betalningarna|överföringen|överföringarna|transaktionen|transaktionerna|ansökan|låneansökan|uttaget|dem|det)|så stoppar vi (?:dem|det|köpet|köpen|lånet|betalningen)|(?:to|so we can) (?:stop|cancel|block|reverse) (?:the |this |a )?(?:payment|purchase|transaction|loan|transfer)')] },
    { id: 'call_number', w: 1.5,
      title: 'Ber dig ringa ett nummer i meddelandet',
      why: 'Numret kan gå direkt till bedragaren, som sedan låtsas vara banken eller en myndighet.',
      todo: 'Ring inte numret i meddelandet. Leta upp numret själv, till exempel på den riktiga webbplatsen eller på ditt kort.',
      re: [W('(?:ring|ringa|ringer|ring upp|kontakta|kontakta oss|slå en signal|nås på|call|contact us)[^.!?\\n]{0,40}?(?:\\+\\d{1,3}[ -]?)?\\(?0?\\d{1,4}\\)?[\\d -]{5,}\\d')] },
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
      todo: 'Öppna inte länken. Lyssna på röstbrevlådan eller läs meddelandet som du brukar, i telefonen eller appen.',
      re: [W('röstmeddelande\\w*|röstbrevlåda\\w*|nytt meddelande väntar|du har ett nytt meddelande via|voicemail|voice message')] },
    { id: 'purchase_alert', w: 1,
      title: 'Varnar för ett köp du inte har gjort',
      why: 'Ett skrämmande köp ska få dig att agera snabbt. Kontrollera i bankens app i stället för att ringa eller klicka.',
      todo: 'Öppna bankens app själv och se om köpet verkligen finns där.',
      re: [W('(?:ett|nytt) (?:köp|uttag|betalning|överföring|lån) (?:på|om) \\d[\\d .,]*\\s?(?:kr|kronor|sek|:-)|var det inte du|känner du inte igen (?:köpet|betalningen|transaktionen|överföringen)|was this not you|didn\'?t make this')] },
    { id: 'chat_switch', w: 1,
      title: 'Vill flytta kontakten till WhatsApp eller Telegram',
      why: 'Bedragare flyttar gärna kontakten till appar där de är svårare att spåra.',
      todo: 'Fortsätt inte kontakten i en annan app med någon du inte känner.',
      re: [W('(?:kontakta|skriv till|lägg till|addera|hör av dig|kontakt|chatta)[^.!?\\n]{0,30}(?:whatsapp|telegram|viber)|(?:whatsapp|telegram|viber)[^.!?\\n]{0,12}(?:\\+\\d|\\d{3})')] },
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
    { id: 'family_greet', hidden: true, re: [W('(?:hej|hejsan|hallå|tja|hi|hello|hey) (?:mamma|pappa|mor|far|morsan|farsan|mamsen|mammi|pappsen|mormor|morfar|farmor|farfar|mom|mum|mummy|dad)')] },
    { id: 'family_claim', hidden: true, re: [W('det är (?:jag|ditt barnbarn|din dotter|din son|ditt barn|din pappa|din mamma)|(?:mormor|morfar|farmor|farfar|mamma|pappa|mamsen|morsan|farsan)[,!]')] },
    { id: 'parcel', hidden: true, re: [W('paket\\w*|försändelse\\w*|leverans\\w*|levereras|leverera\\w*|utdelning\\w*|tull\\w*|frakt\\w*|kolli|package|parcel|delivery|shipment|customs')] },
    { id: 'fee_words', hidden: true, re: [W('[\\p{L}]{0,20}avgift[\\p{L}]{0,12}|tull\\w*|frakt\\w*|porto|ombokning\\w*|fee|customs|shipping|postage|handling')] },
    { id: 'romance', hidden: true, re: [W('älskling|min älskade|min kära|mitt hjärta|min ängel|sweetheart|my love|darling|längtar (?:så )?(?:mycket )?efter dig|du är den enda')] },
    { id: 'market', hidden: true, re: [W('blocket|tradera|marketplace|köpa din|köper din|säljer din|din annons|annonsen|köparen|säljaren')] },
    { id: 'login_words', hidden: true, re: [W('logga in|loggar in|inloggning\\w*|lösenord\\w*|ditt konto|ditt abonnemang|din profil|log ?in|sign ?in|your account|password')] },
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
    { name: 'Polisen', words: 'polis(?:en|myndigheten)', tok: ['polisen', 'polismyndigheten'], dom: ['polisen.se'], g: 'gov' },
    { name: 'CSN', words: 'CSN', cs: true, tok: ['csn'], dom: ['csn.se'], g: 'gov' },
    { name: 'Transportstyrelsen', words: 'transportstyrelsen', tok: ['transportstyrelsen'], dom: ['transportstyrelsen.se'], g: 'gov' },
    { name: 'Trafikverket', words: 'trafikverket', tok: ['trafikverket'], dom: ['trafikverket.se'], g: 'gov' },
    { name: 'Pensionsmyndigheten', words: 'pensionsmyndigheten', tok: ['pensionsmyndigheten'], dom: ['pensionsmyndigheten.se'], g: 'gov' },
    { name: 'Migrationsverket', words: 'migrationsverket', tok: ['migrationsverket'], dom: ['migrationsverket.se'], g: 'gov' },
    { name: 'Arbetsförmedlingen', words: 'arbetsförmedlingen', tok: ['arbetsformedlingen'], dom: ['arbetsformedlingen.se'], g: 'gov' },
    { name: '1177', words: '1177', tok: ['1177'], dom: ['1177.se'], g: 'gov' },
    { name: 'BankID', words: 'bank[- ]?id', tok: ['bankid', 'bank-id'], dom: ['bankid.com'], g: 'id' },
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
    { name: 'Vattenfall', words: 'vattenfall', tok: ['vattenfall'], dom: ['vattenfall.se', 'vattenfall.com'], g: 'other' }
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

  // Letters from other alphabets that look like Latin ones, as used in "BаnkID" with a Cyrillic а.
  var CONF_FROM = 'аеорсухіјѕԁһԛԝӏАВЕКМНОРСТУХІЈЅοανικρτυΑΒΕΖΗΙΚΜΝΟΡΤΥΧ';
  var CONF_TO = 'aeopcyxijsdhqwlABEKMHOPCTYXIJSoavikptuABEZHIKMNOPTYX';
  var ZW = /[​-‍⁠﻿­]/;
  var PICT = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️⃣]/u;
  var LETTER = /\p{L}/u, WORDCH = /[\p{L}\p{M}]/u, LATIN = /[A-Za-zÀ-ÖØ-öø-ÿ]/;
  var BRACKET = { '[': ']', '(': ')', '{': '}' };

  // The text as the rules read it: no invisible characters, no emoji inside words, lookalike letters replaced,
  // full-width letters made normal and "[.]" read as a dot. from/to say where each character came from,
  // so that everything found can be marked in the original text.
  function normalize(src) {
    var pts = [], p = 0, i, j, k, words = 0;
    Array.from(src).forEach(function (c) { pts.push({ c: c, s: p, e: p + c.length, w: -1 }); p += c.length; });
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
    var out = [], from = [], to = [], mixed = [];
    for (i = 0; i < pts.length; i++) {
      var c = pts[i].c, s = pts[i].s, e = pts[i].e, wid = pts[i].w;
      if (ZW.test(c)) continue;
      if (PICT.test(c)) {
        var prev = out.length ? out[out.length - 1] : '';
        for (j = i + 1; j < pts.length && (PICT.test(pts[j].c) || ZW.test(pts[j].c)); j++);
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
      var at = out.length;
      for (k = 0; k < c.length; k++) { out.push(c.charAt(k)); from.push(s); to.push(e); }
      if (wid !== -1) {
        var last = mixed[mixed.length - 1];
        if (last && last.w === wid) last.e = out.length; else mixed.push({ w: wid, s: at, e: out.length });
      }
    }
    return { t: out.join(''), from: from, to: to, mixed: mixed };
  }

  // The part of the clause that comes before position s.
  function clauseBefore(text, s) {
    var before = text.slice(Math.max(0, s - 40), s), cut = 0, m;
    CUT.lastIndex = 0;
    while ((m = CUT.exec(before)) !== null) cut = m.index + m[0].length;
    return before.slice(cut);
  }

  // A negation inside the match, earlier in the same clause or right after it means the text warns rather than asks.
  function isNegated(text, s, e, t) {
    return NEG.test(t.replace(ENCOURAGE, ' ')) || NEG.test(clauseBefore(text, s).replace(ENCOURAGE, ' ')) || AFTER_NEG.test(text.slice(e, e + 14));
  }

  function collect(rule, re, text) {
    var out = [], m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      var t = m[2];
      if (!t) { re.lastIndex++; continue; }
      var s = m.index + m[1].length, e = s + t.length;
      if ((rule.neg && isNegated(text, s, e, t)) || (rule.skip && rule.skip.test(t)) || (rule.ctx && rule.ctx.test(clauseBefore(text, s)))) {
        // Look again from the next character: a later request in the same stretch still counts.
        re.lastIndex = s + 1;
        continue;
      }
      out.push({ s: s, e: e, t: t });
    }
    return out;
  }

  function findBrands(text) {
    var found = [];
    BRANDS.forEach(function (b) {
      if (!b.words) return;
      // Also "Nordeas", "Polisens": the Swedish genitive.
      if (!b.re) b.re = new RegExp('(^|[^\\p{L}\\p{N}])((?:' + b.words + ')s?)(?![\\p{L}\\p{N}])', b.cs ? 'gu' : 'giu');
      b.re.lastIndex = 0;
      var m = b.re.exec(text);
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
        if (t.length >= 6 ? core.indexOf(t) !== -1 : toks.indexOf(t) !== -1) return b;
      }
    }
    return null;
  }

  function findLinks(text, mentioned) {
    var list = [], seen = {}, taken = [];
    function add(raw, s, kind) {
      var clean = raw.replace(/[.,;:!?)\]}»”'"]+$/, '');
      if (!clean) return;
      var hp = hostOf(clean);
      var host = hp.host;
      if (!host || host.indexOf('.') === -1) return;
      if (kind === 'url') taken.push([s, s + clean.length]);
      var key = kind + ':' + host;
      var l = seen[key];
      if (!l) {
        var reg = regOf(host);
        l = { raw: clean, host: host, reg: reg, sub: host.slice(0, host.length - reg.length), kind: kind, ranges: [], userinfo: hp.userinfo };
        var off = officialFor(reg);
        l.tld = reg.split('.').pop();
        if (OWN.indexOf(host) !== -1 || OWN.indexOf(reg) !== -1) l.status = 'self';
        else if (IPV4.test(host)) l.status = 'ip';
        else if (host.indexOf('xn--') !== -1) l.status = 'puny';
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
      l.ranges.push({ s: s, e: s + clean.length, t: clean });
    }
    var m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text)) !== null) add(m[2], m.index + m[1].length, 'url');
    LINK2.lastIndex = 0;
    while ((m = LINK2.exec(text)) !== null) {
      var s2 = m.index + m[1].length, e2 = s2 + m[2].length;
      if (!taken.some(function (r) { return s2 < r[1] && e2 > r[0]; })) add(m[2], s2, 'url');
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
    if (ids.police_pickup) return 'Falska polisen';
    if ((ids.swish_receive || ids.payment_request) && (sig.market || groups.pay || groups.market)) return 'Köp-och-sälj-bluffen';
    if (ids.new_number || ids.family_money) return '”Hej mamma”-bluffen';
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
    var N = normalize(original), text = N.t;
    var sig = {}, flags = [];

    RULES.forEach(function (r) {
      var ms = [];
      r.re.forEach(function (re) { ms = ms.concat(collect(r, re, text)); });
      if (!ms.length) return;
      sig[r.id] = ms;
      if (!r.hidden) flags.push({ id: r.id, w: r.w, title: r.title, why: r.why, todo: r.todo, matches: ms });
    });
    // The specific request for a code you have received replaces the general one.
    if (sig.code_sms) flags = flags.filter(function (f) { return f.id !== 'code'; });

    var small = amounts(text).filter(function (a) { return a.v > 0 && a.v < 100; });
    if (small.length && (sig.fee_words || sig.parcel)) {
      flags.push({ id: 'small_fee', w: 2, title: 'Ber dig betala en liten avgift',
        why: 'En liten summa för frakt, tull eller ombokning är ett lockbete. Det bedragarna egentligen vill åt är dina kortuppgifter.',
        todo: 'Betala aldrig via en länk i ett meddelande. Kolla leveransen i fraktbolagets egen app.', matches: small });
    }
    var family = sig.family_greet || sig.family_claim;
    if (family && sig.money_request) {
      flags.push({ id: 'family_money', w: 1.5, title: 'Låtsas vara en anhörig som behöver pengar',
        why: 'Bedragare skriver ”Hej mamma” eller ”Mormor, det är jag” till tusentals nummer och hoppas att någon svarar. Rösten kan också vara falsk, gjord med AI.',
        todo: 'Ring ditt barn eller din anhörige på det vanliga numret innan du gör något.', matches: family });
    }
    if (sig.romance && (sig.money_request || sig.emergency)) {
      flags.push({ id: 'romance_money', w: 1.5, title: 'Kärleksord och pengar i samma meddelande',
        why: 'Bedragare bygger upp en kärleksrelation på nätet och ber sedan om pengar för en resa, en avgift eller ett nödläge.',
        todo: 'Skicka aldrig pengar till någon du bara har träffat på nätet.', matches: sig.romance });
    }
    if (N.mixed.length) {
      flags.push({ id: 'homoglyph', w: 2.5, title: 'Ord med falska bokstäver',
        why: 'Några bokstäver kommer från ett annat alfabet men ser likadana ut. Så gör bedragare för att ta sig förbi filter och få ett falskt meddelande att se äkta ut.',
        todo: null, matches: N.mixed });
    }

    var found = findBrands(text);
    var mentioned = found.map(function (f) { return f.b; });
    var links = findLinks(text, mentioned);
    var groups = {};
    mentioned.forEach(function (b) { groups[b.g] = true; });

    // A bank, authority or debt collector named next to a request is how most fake contacts open.
    var asks = sig.call_number || sig.account_problem || sig.cards || sig.bankid_use || sig.bankid_fix || sig.code || sig.code_sms || sig.stop_pretext || sig.legal_threat || sig.debt || sig.qr;
    var who = found.filter(function (f) { return f.b.g === 'gov' || f.b.g === 'bank' || f.b.g === 'debt'; })[0];
    if (who && asks) {
      flags.push({ id: 'impersonation', w: 1, title: 'Säger sig komma från ' + who.b.name,
        why: 'Banker, myndigheter och inkassobolag ber aldrig om koder, kortuppgifter eller BankID i sms, och avsändarnamn går att förfalska.',
        todo: 'Kontakta ' + who.b.name + ' själv, via deras egen app, webbplats eller ett nummer du letar upp.',
        matches: [{ s: who.i, e: who.i + who.t.length, t: who.t }] });
    }

    var anyBadUrl = false;
    links.forEach(function (l) {
      if (l.status === 'official' || l.status === 'self') return;
      var name = l.brand ? l.brand.name : '';
      var real = l.brand ? l.brand.dom[0] : '';
      if (l.brand) groups[l.brand.g] = true;
      if (l.status === 'lookalike') {
        flags.push({ id: 'link_lookalike', w: 3, title: 'Falsk adress som liknar ' + name,
          why: 'Adressen ser ut att höra till ' + name + ', men den går egentligen till ' + l.reg + '. Det är slutet av adressen som avgör vart du hamnar. Den riktiga adressen till ' + name + ' är ' + real + '.',
          todo: 'Klicka inte på länken. Öppna appen eller skriv in den riktiga adressen själv.', matches: l.ranges });
      } else if (l.status === 'mismatch') {
        flags.push({ id: 'link_mismatch', w: 2.5, title: 'Länken går inte till ' + name,
          why: 'Meddelandet nämner ' + name + ', men länken går till ' + l.reg + '. Den riktiga adressen till ' + name + ' är ' + real + '.',
          todo: 'Klicka inte på länken. Öppna appen eller skriv in den riktiga adressen själv.', matches: l.ranges });
      }
      if (l.kind !== 'url') return;
      anyBadUrl = true;
      if (l.status === 'short') flags.push({ id: 'link_short', w: 2, title: 'Förkortad länk', why: 'Förkortade länkar döljer vart de egentligen leder.', todo: 'Klicka inte på förkortade länkar från okända avsändare.', matches: l.ranges });
      if (l.status === 'ip') flags.push({ id: 'link_ip', w: 2.5, title: 'Länken består av siffror', why: 'Riktiga företag och myndigheter använder namn i sina adresser, inte bara siffror.', todo: 'Klicka inte på länken.', matches: l.ranges });
      if (l.status === 'puny') flags.push({ id: 'link_puny', w: 2.5, title: 'Adressen innehåller dolda specialtecken', why: 'Bokstäver från andra alfabet kan få en falsk adress att se riktig ut.', todo: 'Klicka inte på länken.', matches: l.ranges });
      if (l.userinfo) flags.push({ id: 'link_userinfo', w: 2.5, title: 'Adressen är byggd för att lura ögat', why: 'Allt som står före @ i en webbadress ignoreras. Länken går egentligen till ' + l.host + '.', todo: 'Klicka inte på länken.', matches: l.ranges });
      if (l.odd) flags.push({ id: 'link_tld', w: 1.5, title: 'Ovanlig adressändelse (.' + l.tld + ')', why: 'Adresser som slutar på till exempel .xyz, .top eller .lat är billiga att registrera och vanliga hos bluffsidor.', todo: null, matches: l.ranges });
    });
    if (anyBadUrl && sig.voicemail) {
      flags.push({ id: 'voicemail_link', w: 1.5, title: 'Röstmeddelande med länk',
        why: 'Röstmeddelanden lyssnar du på i telefonen. Ett sms med en länk till ett röstmeddelande är ett vanligt knep för att få dig att installera en skadlig app.',
        todo: 'Öppna inte länken. Lyssna på röstbrevlådan som du brukar.', matches: sig.voicemail });
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
          todo: 'Klicka inte på länken. Gå till webbplatsen eller appen på egen hand.', matches: ranges }
        : { id: 'link', w: 1, title: 'Innehåller en länk',
          why: 'Länkar i oväntade meddelanden är det vanligaste sättet att lura folk till falska sidor.',
          todo: 'Klicka inte på länken. Gå till webbplatsen eller appen på egen hand.', matches: ranges });
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

    var todos = [];
    flags.forEach(function (f) { if (f.todo && todos.indexOf(f.todo) === -1) todos.push(f.todo); });
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

  return { analyze: analyze };
})();
/*ENGINE-END*/

(function () {
  'use strict';
  var SHARE_URL = location.protocol.indexOf('http') === 0 ? location.origin + location.pathname.replace(/index\.html$/, '') : 'https://tollegoransson-maker.github.io/ar-det-bluff/';
  var CAN_OCR = true;
  var TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

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
    var box = b.closest('.result, .callresult');
    var verdict = box ? box.querySelector('.verdict') : null;
    if (!verdict) return;
    var parts = [];
    Array.prototype.forEach.call(verdict.children, function (el) { if (!el.querySelector('[data-speak]')) parts.push(el.innerText); });
    var todo = box.querySelector('.list');
    if (todo) parts.push('Gör så här. ' + todo.innerText);
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
    vanligt: 'Hej! Påminnelse om din tid hos tandläkaren tisdag 12 november kl. 14.30. Välkommen! Behöver du avboka, hör av dig senast dagen innan.'
  };
  var VERDICT = {
    high: { title: 'Det här är troligen en bluff', sub: 'Klicka inte på länkar, svara inte och ring inte upp.' },
    medium: { title: 'Var försiktig', sub: 'Meddelandet har tecken som är vanliga i bluffar. Kontrollera med avsändaren på ett sätt du själv väljer innan du gör något.' },
    low: { title: 'Inga kända varningstecken', sub: 'Det betyder inte att meddelandet är säkert, bara att vi inte känner igen knepet. Väntade du dig inte meddelandet? Klicka inte på länkar och lämna inga uppgifter förrän du har kontrollerat avsändaren på ett sätt du själv väljer.' }
  };
  // Står i varje svar: den som redan har agerat ska inte radera bevisen, och ska hitta hjälpen direkt.
  var ALREADY = '<p class="verdict-more">Har du redan klickat, betalat eller lämnat uppgifter? Radera inte meddelandet, det kan behövas som bevis. <a href="#lurad" data-goto="lurad">Se vad du ska göra nu</a>.</p>';

  var msg = $('#msg'), out = $('#result'), exKey = null, helpedFor = null;

  // Varningstecknen numreras i den ordning de står i meddelandet, så att markering och förklaring hör ihop.
  function numbered(flags) {
    var hasLinkFlag = flags.some(function (f) { return f.id === 'link_lookalike' || f.id === 'link_mismatch'; });
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
      (r.type ? '<p class="verdict-kind">Upplägget liknar: <strong>' + esc(r.type) + '</strong></p>' : '') + ALREADY + speakButton() + '</div>';
    var official = r.links.filter(function (l) { return l.status === 'official' && l.kind === 'url'; });
    if (official.length && r.level !== 'high') {
      h += '<p class="official">Länken går till <strong>' + esc(official[0].reg) + '</strong>, som är den riktiga adressen till ' + esc(official[0].brand.name) +
        '. Öppna ändå hellre appen eller webbplatsen själv.</p>';
    }
    var todos = r.todos.slice(0, 2);
    if (todos.length && r.level !== 'low') {
      h += '<h4>Gör så här</h4><ul class="list">' + todos.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    }
    var flags = numbered(r.flags);
    if (flags.length) {
      h += '<h4>' + (r.level === 'low' ? 'Det här reagerade vi på' : 'Varningstecknen i meddelandet') + '</h4>' +
        '<div class="marked" id="hl">' + highlight(text, flags) + '</div>' +
        '<ol class="key">' + flags.map(function (f) { return '<li><strong>' + esc(f.title) + '.</strong> ' + esc(f.why) + '</li>'; }).join('') + '</ol>';
    } else {
      h += '<p class="none">Vi hittade inga av de vanligaste varningstecknen.</p>';
    }
    if (asked && !exKey && window.goatcounter) {
      h += helpedFor === text ? '<p class="helpful">Tack för att du svarade.</p>'
        : '<p class="helpful" id="helpful">Hjälpte svaret dig? <button class="linkbtn" type="button" data-helpful="ja">Ja</button> eller <button class="linkbtn" type="button" data-helpful="nej">Nej</button></p>';
    }
    out.innerHTML = h;
  }

  var LEVEL_EVENT = { high: 'kollat-troligen-bluff', medium: 'kollat-var-forsiktig', low: 'kollat-inga-tecken' }, lastCounted = '';
  function run(scroll) {
    if (canSpeak && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    var r = Bluffkoll.analyze(msg.value);
    render(r, msg.value, scroll);
    // Ett eget meddelande räknas en gång, med svaret det fick. Exempel och text under skrivning räknas inte.
    if (scroll && !exKey && r.level !== 'empty' && msg.value !== lastCounted) { lastCounted = msg.value; track(LEVEL_EVENT[r.level]); }
    if (scroll) {
      var v = $('#verdict');
      if (v && v.scrollIntoView) v.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
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
    if (out.innerHTML) out.innerHTML = msg.value.trim() ? '<p class="empty">Tryck på Kolla meddelandet när du har skrivit klart.</p>' : '';
  });
  // Ett inklistrat meddelande ersätter exemplet i stället för att hamna mitt i det.
  msg.addEventListener('focus', function () { if (exKey) msg.select(); });
  msg.addEventListener('paste', function (e) {
    var pasted = e.clipboardData ? e.clipboardData.getData('text') : '';
    if (exKey && pasted) { e.preventDefault(); msg.value = pasted; }
    setTimeout(function () { exKey = null; markExamples(); ocrStatus.textContent = ''; run(true); }, 0);
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
    msg.value = ''; exKey = null; markExamples(); out.innerHTML = ''; ocrStatus.textContent = ''; msg.focus();
  });

  /* Skärmbild: texten läses av i webbläsaren, bilden skickas ingenstans */
  var ocrFile = $('#ocr-file'), ocrStatus = $('#ocr-status');
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
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
  function readImage(file) {
    // Var det gick fel avgör vad vi säger: bilden, hämtningen av textläsaren eller själva läsningen.
    var canvas, stage = 'bild';
    ocrStatus.textContent = 'Läser in bilden …';
    toImage(file).then(function (img) {
      canvas = prepare(img);
      URL.revokeObjectURL(img.src);
      stage = 'hamta';
      if (window.Tesseract) return null;
      ocrStatus.textContent = 'Hämtar textläsaren. Första gången kan det ta en stund …';
      return loadScript(TESSERACT);
    }).then(function () {
      return window.Tesseract.createWorker('swe', 1, {
        logger: function (m) { if (m.status === 'recognizing text') ocrStatus.textContent = 'Läser texten … ' + Math.round(m.progress * 100) + ' %'; }
      });
    }).then(function (worker) {
      stage = 'las';
      return worker.recognize(canvas).then(function (res) { worker.terminate(); return res.data.text; },
        function (e) { worker.terminate(); throw e; });
    }).then(function (text) {
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
      ocrStatus.textContent = stage === 'bild' ? 'Bilden gick inte att öppna. Ta en vanlig skärmbild och försök igen, eller skriv av meddelandet.'
        : stage === 'hamta' ? 'Det gick inte att hämta textläsaren. Kontrollera internetanslutningen, eller skriv av meddelandet.'
        : 'Det gick inte att läsa texten i bilden. Prova en tydligare skärmbild, eller skriv av meddelandet.';
      track('skarmbild-fel');
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
    bankid:'Legitimera dig inte. Den som får dig att använda BankID kan ta lån och tömma konton i ditt namn.',
    codes: 'Säg inga koder eller kortnummer, inte ens om personen redan vet ditt namn och personnummer.',
    money: 'Det finns inga säkra konton. Flytta inga pengar.',
    remote: 'Installera ingenting. Har du redan gjort det: koppla bort internet och stäng av enheten.',
    pickup: 'Polisen och banken hämtar aldrig kort, pengar eller smycken. Öppna inte dörren. Ring 112 om någon är på väg.',
    pressure: 'Brådska är bedragarens viktigaste verktyg. Du har alltid tid att lägga på.',
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
    callOut.innerHTML = '<div class="verdict high"><h3 class="verdict-title">Lägg på nu</h3><p>Det här är precis så bedragare arbetar. En riktig bank, polis eller myndighet ber dig aldrig om det här.</p><ul>' +
      stop.map(function (k) { return '<li>' + esc(TIPS[k]) + '</li>'; }).join('') +
      '</ul><p class="verdict-more">Har du redan gjort något av det? <a href="#lurad" data-goto="lurad">Se vad du ska göra nu</a>.</p>' + speakButton() + '</div>';
  }
  // Rådet visas också direkt under varje ikryssad rad, så att det syns där man är.
  $$('#panel-samtal input').forEach(function (i) {
    var span = i.nextElementSibling;
    if (span && TIPS[i.value]) span.insertAdjacentHTML('beforeend', '<span class="check-note' + (i.value === 'caller' ? ' calm' : '') + '">' + esc(TIPS[i.value]) + '</span>');
    i.addEventListener('change', updateCall);
  });
  callReset.addEventListener('click', function () {
    $$('#panel-samtal input').forEach(function (i) { i.checked = false; });
    updateCall();
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
      why: 'Liten avgift, bråttom och en okänd adress. Myndigheter tar inte betalt via länkar i sms.' },
    { from: 'Sms', text: 'Påminnelse: Din tid hos tandläkaren är tisdag 14 maj kl. 09.30. Välkommen! Behöver du avboka, ring kliniken.', answer: 'akta',
      why: 'En vanlig påminnelse. Ingen länk, inga koder och inget krav på pengar.' },
    { from: 'Sms från ett okänt nummer', text: 'Hej pappa, det är jag. Mobilen gick sönder så jag lånar en kompis telefon. Kan du swisha 3 000 kr? Förklarar sen ❤️', answer: 'bluff',
      why: 'Så låter ”Hej mamma”-bluffen: ny telefon och pengar på en gång. Ring ditt barn på det vanliga numret.' },
    { from: 'Sms, strax efter att du själv loggade in', text: 'Din kod för inloggning är 482917. Ange den bara på sidan du själv öppnade. Dela aldrig koden med någon.', answer: 'akta',
      why: 'Koden kom för att du själv just loggade in, och sms:et säger åt dig att inte dela den. Får du en sådan kod utan att ha loggat in: ge den aldrig till någon och byt lösenord.' },
    { from: 'Sms', text: 'Skatteverket: Du har en återbetalning på 1 846 kr. Ange dina kortuppgifter för utbetalning: skatteverket-se.example', answer: 'bluff',
      why: 'Skatteverket frågar aldrig efter kortuppgifter i sms, och adressen är inte skatteverket.se.' },
    { from: 'Telefonsamtal', text: '”Hej, det här är bankens säkerhetsavdelning. Vi ser misstänkta köp på ditt kort. Logga in med BankID så stoppar vi dem.”', answer: 'bluff',
      why: 'Banken ber dig aldrig använda BankID i telefon. Lägg på och ring bankens nummer själv.' },
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
    '\n\nKom ihåg: ingen bank eller polis ber dig någonsin använda BankID i telefon. Lägg på och ring upp själv.';
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
})();
