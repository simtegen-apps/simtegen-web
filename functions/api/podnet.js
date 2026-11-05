// POST /api/podnet {text, obor} — „Co vás trápí?“ z webu firmy, bez přihlášení.
// Zapisuje SimteGen (firemni_web.py), v repu webu se needituje.
//
// Nic se tu neukládá: podnět odejde šifrovaně firmě stejnou cestou jako
// „Nahlásit chybu“ (schranka_sifra.js — repo je veřejné) a SimteGen z něj
// teprve u sebe udělá nápad. Žádný e-mail ani jméno: formulář o ně nežádá
// a odpověď se neposílá.
//
// Brzda proti spamu bez databáze: nejvýš LIMIT podnětů za hodinu na jedno
// datové centrum (Cache API, jako nahlasit.js) — a SimteGen má vlastní denní
// strop a nejvýš pár nápadů z webu týdně.

import { jsonOdpoved, zrcadliHlaseni, MAX_DELKA } from "../../schranka_sifra.js";

const LIMIT = 10;
const MIN = 20;
const OBOR_MAX = 60;

async function vLimitu() {
  try {
    const hodina = Math.floor(Date.now() / 3600000);
    const klic = new Request(`https://limit.simtegen.invalid/podnet/${hodina}`);
    const ulozeno = await caches.default.match(klic);
    const pocet = ulozeno ? Number(await ulozeno.text()) || 0 : 0;
    if (pocet >= LIMIT) return false;
    await caches.default.put(klic, new Response(String(pocet + 1), {
      headers: { "Cache-Control": "max-age=3600" },
    }));
    return true;
  } catch {
    return true;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let telo;
  try {
    telo = await request.json();
  } catch {
    return jsonOdpoved({ chyba: "Neplatný požadavek." }, 400);
  }
  const text = String((telo && telo.text) || "").trim();
  const obor = String((telo && telo.obor) || "").replace(/\s+/g, " ").trim().slice(0, OBOR_MAX);
  if (text.length < MIN) {
    return jsonOdpoved({ chyba: "Napište nám prosím trochu víc — aspoň jednu celou větu.", pole: "text" }, 422);
  }
  if (text.length > MAX_DELKA) {
    return jsonOdpoved({ chyba: `Text je moc dlouhý (nejvýš ${MAX_DELKA} znaků).`, pole: "text" }, 422);
  }
  if (!(await vLimitu())) {
    return jsonOdpoved({ chyba: "Teď přijímáme hodně zpráv — zkuste to prosím za hodinu." }, 429);
  }
  const cislo = await zrcadliHlaseni(env, "Podnět z webu", { zdroj: "podnet", text, obor });
  return jsonOdpoved({ stav: "prijato", predano: Boolean(cislo) });
}
