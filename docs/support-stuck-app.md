# Support: app fryst på iOS

Cheatsheet för det vanligaste supportärendet — "Lotta är fryst och jag kan
inte uppdatera". Stegen är rangordnade från minst till mest ingripande.
Kopiera den eller de bitar du vill skicka till användaren rakt in i chatten.

## Varför händer det här?

iOS cachar appen via en service worker. När en ny version släpps måste den
gamla servicen avregistreras innan den nya kan ta över. Om den gamla
versionen kraschar innan uppdateringsrutan hinner laddas fastnar
användaren i den trasiga versionen — vanligtvis på iPhone-modeller med
äldre Chrome eller äldre Safari.

## Vad som händer automatiskt

iOS Safari förnyar service workern senast var 24:e timme när användaren
har internet. Om användaren bara väntar och öppnar appen igen nästa dag
brukar det lösa sig av sig självt.

**Bevarar tävlingsdata:** ✅ Ja.

## Snabbaste lösningen — skicka denna länk

```
https://lotta.bernting.se/?reset=1
```

Säg så här:

> Klicka på den här länken. Sidan laddar om sig själv och du ska få den
> senaste versionen av Lotta. Dina turneringar finns kvar.

Det här fungerar så länge användaren kan öppna *någon* sida på
lotta.bernting.se. Länken nollställer service workern och cache-lagringen
men rör inte IndexedDB.

**Bevarar tävlingsdata:** ✅ Ja.

## Säkert läge — när användaren vill se diagnostik först

```
https://lotta.bernting.se/recovery.html
```

Säkert läge är en fristående sida som inte laddar resten av Lotta. Den
fungerar även när huvudappen inte startar. Sidan visar:

- Version och commit som webbläsaren faktiskt har cachat
- Antal service workers och deras scope
- Cachelagringens innehåll och storlek
- iOS-specifik vägledning om appen körs från hemskärmen

Tre knappar för rensning, från minst till mest ingripande:

1. **Rensa cache** — tar bara bort Cache Storage. Snabbast och oftast nog.
2. **Avregistrera service workers** — tvingar en helt ny SW-installation.
3. **Återställ allt** — kombinerar de två ovan.

Ingen av knapparna startar automatiskt — användaren måste klicka. Efter
klick startar en 10-sekunders nedräkning som kan avbrytas. Knappen
**Säkerhetskopiera databas först** laddar ner råa SQLite-bytes utan att
röra något annat — be alltid användaren göra det innan rensning.
**Kopiera diagnostik** lägger en JSON-bild av tillståndet i urklipp som
användaren kan klistra in i ett supportmeddelande.

**Bevarar tävlingsdata:** ✅ Ja — alla tre rensningsåtgärderna lämnar
IndexedDB ifred.

## Om länken inte fungerar — manuell väg

Skicka instruktioner beroende på vilken webbläsare användaren har.

### Steg 1: starta om webbläsaren helt

> Stäng Chrome/Safari helt (svep upp och stäng appen i app-växlaren),
> vänta några sekunder, öppna appen igen och gå tillbaka till
> lotta.bernting.se. Vänta tio sekunder.

På Chrome iOS triggar det ofta en uppdateringskontroll direkt. På Safari
kan det ta upp till några timmar.

**Bevarar tävlingsdata:** ✅ Ja.

### Steg 2: rensa webbplatsdata

> ⚠️ Säkerhetskopiera dina turneringar först om du kan komma åt menyn:
> klicka på **Verktyg → Säkerhetskopiera databas** och spara filen
> någonstans (Filer, e-post till dig själv). Stegen nedan tar bort all
> sparad turneringsdata.

**iOS Chrome:**

> 1. Öppna lotta.bernting.se i Chrome.
> 2. Tryck på låsikonen till vänster om adressen.
> 3. Välj **Webbplatsinställningar → Töm och nollställ**.
> 4. Stäng fliken och öppna lotta.bernting.se på nytt.

**iOS Safari:**

> 1. Öppna **Inställningar → Safari → Avancerat → Webbplatsdata**.
> 2. Sök efter **lotta**.
> 3. Svep åt vänster på raden och tryck **Ta bort**.
> 4. Öppna lotta.bernting.se igen i Safari.

**Bevarar tävlingsdata:** ❌ Nej — IndexedDB rensas också. Använd
säkerhetskopian för att läsa in turneringarna igen.

### Steg 3: hemskärmsikonen

> Om du har lagt till Lotta som en app på hemskärmen:
>
> 1. Håll inne ikonen och välj **Ta bort app**.
> 2. Kör Steg 2 ovan.
> 3. Öppna lotta.bernting.se i Safari igen och välj **Lägg till på
>    hemskärmen** i delningsmenyn.

**Bevarar tävlingsdata:** Beror på Steg 2 — om du hoppade över rensningen
i Steg 2 så ja, annars nej.

## Sammanfattning för supportern

| Steg | Användarens jobb | Bevarar IndexedDB |
| ---- | ---------------- | ----------------- |
| Vänta 24h | Inget | ✅ |
| `?reset=1`-länk | Klick | ✅ |
| `/recovery.html` Säkert läge | Klick + välj åtgärd | ✅ |
| Starta om webbläsaren | Stäng appen | ✅ |
| Rensa webbplatsdata | Inställningar | ❌ |
| Hemskärm + rensa | Hemskärm + inställningar | ❌ |

Gå alltid igenom listan uppifrån. Hoppa bara längre ner när det
föregående steget bevisligen inte fungerade.

## Relaterat

- Källa: `src/recovery/` (Säkert läge), `recovery.html` (skal/styling),
  `index.html` (inline `?reset=1`-killswitch).
- Sista utvägen för utvecklaren (inte slutanvändaren) — se
  [`emergency-pwa-reset.md`](emergency-pwa-reset.md).
