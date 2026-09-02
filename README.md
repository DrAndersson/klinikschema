# Jourkalender

Jourkalender är en webbaserad konverterare för klinikens månadsschema. Appen läser
`.xls` och `.xlsx` direkt i webbläsaren och skapar en `.ics`-fil för vald person.

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
