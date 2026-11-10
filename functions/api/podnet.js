// POST /api/podnet {text, obor} — „Co vás trápí?“ z webu firmy, bez přihlášení.
// Zapisuje SimteGen (firemni_web.py), v repu webu se needituje.
//
// Nic se tu neukládá: podnět odejde šifrovaně firmě stejnou cestou jako
// „Nahlásit chybu“ (schranka_sifra.js — repo je veřejné) a SimteGen z něj
// teprve u sebe udělá nápad. Žádný e-mail ani jméno: formulář o ně nežádá
// a odpověď se neposílá.
//
// Brzda proti spamu bez databáze (Cache API, jako nahlasit.js): nejvýš LIMIT
// podnětů za hodinu na datové centrum a LIMIT_IP z jedné adresy — a SimteGen
// má vlastní denní strop a nejvýš pár nápadů z webu týdně.
//
// Why the per-address key is a hash of IP + hour: the counter must tell one
// sender from another, but a raw address in a cache key would be a stored
// personal datum the form promises not to keep. Why a thrown error refuses:
// a broken counter that lets everything through is exactly the moment a
// flood would get in. An empty cache (match returns nothing, as on a
// *.pages.dev host) is not an error and lets the message through.

import { jsonOdpoved, zrcadliHlaseni, MAX_DELKA } from "../../schranka_sifra.js";

const LIMIT = 10;
const LIMIT_IP = 3;
const MIN = 20;
const OBOR_MAX = 60;

async function otiskAdresy(ip, hodina) {
  const data = new TextEncoder().encode(`podnet:${hodina}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function zapocti(cesta, strop) {
  const klic = new Request(`https://limit.simtegen.invalid/${cesta}`);
  const ulozeno = await caches.default.match(klic);
  const pocet = ulozeno ? Number(await ulozeno.text()) || 0 : 0;
  if (pocet >= strop) return false;
  await caches.default.put(klic, new Response(String(pocet + 1), {
    headers: { "Cache-Control": "max-age=3600" },
  }));
  return true;
}

// "ok" | "moc" (over a limit) | "chyba" (the counter itself failed).
async function vLimitu(request) {
  try {
    const hodina = Math.floor(Date.now() / 3600000);
    const ip = request.headers.get("CF-Connecting-IP");
    // Local runs carry no client address: only the global cap counts there.
    if (ip && !(await zapocti(`podnet-ip/${await otiskAdresy(ip, hodina)}`, LIMIT_IP))) return "moc";
    return (await zapocti(`podnet/${hodina}`, LIMIT)) ? "ok" : "moc";
  } catch {
    return "chyba";
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
  const limit = await vLimitu(request);
  if (limit === "chyba") {
    return jsonOdpoved({ chyba: "Zprávu teď nejde přijmout. Zkuste to prosím za chvíli." }, 503);
  }
  if (limit === "moc") {
    return jsonOdpoved({ chyba: "Teď přijímáme hodně zpráv — zkuste to prosím za hodinu." }, 429);
  }
  const cislo = await zrcadliHlaseni(env, "Podnět z webu", { zdroj: "podnet", text, obor });
  return jsonOdpoved({ stav: "prijato", predano: Boolean(cislo) });
}
