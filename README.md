# Kirurgschemat

En första, GitHub Pages-redo prototyp för klinikens dag- och jourplanering. Den utgår från `mall.xls` och omfattar:

- tomt grundschema, där aktivitet väljs per kirurg och dag (klinik, externt sjukhus, undervisning/forskning, kurs, administration, ledig och randning)
- markering för otillgänglig kvälls- och helgjour
- jourönskemål med grön ✓ och otillgänglighet med röd ×
- jourbemanning med primärjour, bakjour och handledd bakjour
- tydlig helgjour-markering för jourpass på fredagar

## Köra lokalt

Öppna `index.html` i en webbläsare, eller publicera filerna via GitHub Pages. Prototypens ändringar lagras lokalt i webbläsaren (LocalStorage); den har ännu ingen inloggning eller gemensam databas.

## Nästa steg före klinisk drift

Lägg till säker autentisering, rollstyrning, en delad databas med revisionslogg och en verklig regelmotor som kontrollerar vilotid, kompetenskrav och dubbelbokningar. Patientuppgifter ska inte lagras i schemat.
