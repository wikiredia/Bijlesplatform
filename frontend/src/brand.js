// ───────── Huisstijl: pas hier logo, kleuren en lettertype aan ─────────
// Alles wat je hier verandert, werkt meteen door op de hele site (logo, favicon, kleuren).

export const BRAND = {
  name: 'bijles',        // tekst naast het logo
  suffix: '.',           // gekleurd tekentje achter de naam ('' = geen)
  mark: 'b',             // letter(s) in het blokje
  // Eigen logo-afbeelding? Zet het bestand in frontend/public/img/ en vul hier het pad in,
  // bv. '/img/logo.svg'. Dan vervangt die afbeelding het blokje met de letter.
  image: '',

  colors: {
    primary: '#2346d8',  // hoofdkleur: knoppen, links, logo-blokje
    primaryDeep: '#1a33a8',
    accent: '#ffe94d',   // markeerstift-geel (streepje in logo, koppen)
    suffix: '#ff6b4a',   // kleur van het puntje achter de naam
  },
};

// Zet de kleuren als CSS-variabelen en maak het favicon uit dezelfde instellingen.
export function applyBrand() {
  const root = document.documentElement.style;
  const c = BRAND.colors;
  root.setProperty('--pen', c.primary);
  root.setProperty('--pen-deep', c.primaryDeep);
  root.setProperty('--c-math', c.primary);
  root.setProperty('--marker', c.accent);
  root.setProperty('--logo-suffix', c.suffix);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.primary);

  const icon = BRAND.image || 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${c.primary}"/>` +
    `<rect x="12" y="40" width="40" height="7" rx="3" fill="${c.accent}"/>` +
    `<text x="32" y="44" font-family="Georgia, serif" font-weight="700" font-size="36" text-anchor="middle" fill="#fff">${BRAND.mark}</text></svg>`,
  );
  const link = document.querySelector('link[rel="icon"]');
  if (link) { link.href = icon; link.type = BRAND.image ? '' : 'image/svg+xml'; }
}
