/* „Co vás trápí?“ na webu firmy. Zapisuje SimteGen (firemni_web.py).
 *
 * Kontrolu polí dělá SimteGen.formular (data-formular, simtegen.js): chyba
 * u pole, odeslání s chybou nic nepošle. Tady jen odeslání a odpověď —
 * chyba ze serveru se ukáže u pole, kterého se týká, nic z napsaného
 * nezmizí. Nic se neukládá v prohlížeči.
 *
 * Skript sdílí i anglická stránka (en.html, <html lang="en">): endpoint
 * odpovídá česky, takže tam chyba pole dostane naši anglickou větu. Výpadek
 * sítě ukáže vždy naši větu, ne technickou hlášku prohlížeče
 * („Failed to fetch“). */
(function () {
  "use strict";
  var form = document.querySelector("form[data-podnet]");
  if (!form) return;
  var zprava = form.querySelector("[data-podnet-zprava]");
  var tlacitko = form.querySelector("button[type=submit]");
  var en = document.documentElement.lang === "en";
  var T = en ? {
    posilam: "Sending…",
    diky: "Thank you, we have your note. If it becomes an app, you will find it here.",
    pole: "Please check the text: at least one full sentence, at most 2,000 characters.",
    chyba: "Sending did not work. Please try again."
  } : {
    posilam: "Odesílám…",
    diky: "Děkujeme, podnět jsme dostali. Když z něj bude aplikace, najdete ji tady.",
    pole: "Zkontrolujte prosím text.",
    chyba: "Odeslání se nepovedlo. Zkuste to prosím znovu."
  };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = window.SimteGen && window.SimteGen.formular ? window.SimteGen.formular(form) : null;
    tlacitko.disabled = true;
    zprava.textContent = T.posilam;
    var nase = null;  // our own sentence for a refused note; anything else is the network
    fetch("/api/podnet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: form.elements.text.value, obor: form.elements.obor.value }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          nase = en ? (data.pole ? T.pole : T.chyba) : (data.chyba || T.chyba);
          if (f && data.pole) f.chyba(data.pole, en ? T.pole : (data.chyba || T.pole));
          throw new Error(nase);
        }
        form.reset();
        zprava.textContent = T.diky;
      });
    }).catch(function () {
      zprava.textContent = nase || T.chyba;
    }).then(function () {
      tlacitko.disabled = false;
    });
  });
})();
