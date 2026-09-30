# Jourkalender

Jourkalender är en webbaserad konverterare för klinikens månadsschema. Användaren
kan välja ett färdigt månadsschema eller läsa en egen `.xls`/`.xlsx` direkt i
webbläsaren och skapa en `.ics`-fil för vald person.

## Tolkning av schemat

- kolumn E: handkirurgins kvälls- och helgjour
- kolumn F: plastikkirurgins kvälls- och helgjour
- första initialerna före `/`: primärjour
- andra initialerna efter `/`: bakjour
- ett ensamt namnpar, till exempel `GA`: primärjour utan angiven bakjour
- kolumn C och D (dagjour) hoppas över

Kalenderposterna skapas som heldagsaktiviteter med titeln `Primärjour` eller
`Bakjour`. När en motpart finns läggs den i beskrivningen.

## Lokal utveckling

```bash
pnpm install
pnpm run dev
```

Kvalitetskontroller:

```bash
pnpm test
pnpm run build
```

Excel-filen skickas inte till någon server. All tolkning sker lokalt på användarens
enhet.

## Uppdatera de färdiga månadsschemana

```bash
pnpm generate:schedules -- "/sökväg/till/Scheman"
```

Kommandot skapar `data/bundled-schedules.json`. Den publika filen innehåller bara
månad, jourdatum, hand/plast, initialer och namn för personer med jour. De kompletta
Excel-filerna, telefonnummer och övrig bemanning läggs inte i GitHub-repot.

## Publicering

Varje push till `main` bygger och publicerar automatiskt den statiska appen på
<https://drandersson.github.io/klinikschema/> via GitHub Pages.
