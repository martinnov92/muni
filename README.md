# Evidence školení

Webová aplikace pro přehled povinných školení zaměstnanců a doporučení termínů
podle naléhavosti a volné kapacity. Pracuje se čtyřmi dodanými syntetickými
CSV exporty. Stav vyhodnocuje k datu exportu **1. 10. 2026**.

## Spuštění

Požadavky: npm a Node.js **20.19+ v řadě 20, 22.13+ v řadě 22 nebo 24 a novější**.

```bash
npm ci
npm run dev
```

Aplikace běží na [http://localhost:3000](http://localhost:3000).
Jiný port lze zvolit příkazem `npm run dev -- --port 3100`.

## Kontroly a produkční sestavení

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

Testy se přeloží do `.test-dist/` a spustí vestavěným Node.js runnerem.
Automatické opravy stylu kódu spouští `npm run lint:fix`.

## Data a zpracování

Soubory jsou ve složce `data/`:

- `zamestnanci.csv` — zaměstnanci a pracovní poměry,
- `katalog_skoleni.csv` — druhy školení, povinnosti a platnost,
- `absolvovana_skoleni.csv` — doklady o absolvování,
- `terminy_skoleni.csv` — vypsané termíny a jejich kapacita.

CSV se načítají na serveru. Papa Parse zpracuje oddělovač a strukturu,
chardet odhadne jiné kódování než UTF-8 a TextDecoder převede bajty na text.
Normalizace sjednotí známé varianty údajů a zaznamená problémy.
Prohlížeč dostává pouze potřebný model bez rodných čísel, e-mailů a volných poznámek.
Zdrojové soubory se nemění a nejsou ve složce `public/`.

Každý zaměstnanec má jeden rozbalovací řádek se souhrnem upozornění a detailem
všech školení, včetně chybějících dokladů. Přehled je stránkovaný po 50 zaměstnancích.
Tabulky mají omezenou výšku a posouvání; problémy v datech mají vlastní stránkování.
Doporučení nejprve řeší propadlá, potom chybějící a nakonec brzy končící školení.
Za brzy končící se považuje platnost do následujících 30 dnů včetně.

Produkční stránka se připraví při sestavení. Po změně CSV je potřeba znovu
spustit build a restartovat aplikaci.

## Technologie a omezení

Next.js, React, TypeScript a Tailwind CSS. Pro práci se snapshotem není potřeba
databáze, přihlašování ani API klíče.
