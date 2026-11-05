/* „Co vás trápí?“ na webu firmy. Zapisuje SimteGen (firemni_web.py).
 *
 * Kontrolu polí dělá SimteGen.formular (data-formular, simtegen.js): chyba
 * u pole, odeslání s chybou nic nepošle. Tady jen odeslání a odpověď —
 * chyba ze serveru se ukáže u pole, kterého se týká, nic z napsaného
 * nezmizí. Nic se neukládá v prohlížeči. */
(function () {
  "use strict";
  var form = document.querySelector("form[data-podnet]");
  if (!form) return;
  var zprava = form.querySelector("[data-podnet-zprava]");
  var tlacitko = form.querySelector("button[type=submit]");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = window.SimteGen && window.SimteGen.formular ? window.SimteGen.formular(form) : null;
    tlacitko.disabled = true;
    zprava.textContent = "Odesílám…";
    fetch("/api/podnet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: form.elements.text.value, obor: form.elements.obor.value }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          if (f && data.pole) f.chyba(data.pole, data.chyba || "Zkontrolujte prosím text.");
          throw new Error(data.chyba || "Odeslání se nepovedlo.");
        }
        form.reset();
        zprava.textContent = "Děkujeme, podnět jsme dostali. Když z něj bude aplikace, najdete ji tady.";
      });
    }).catch(function (chyba) {
      zprava.textContent = (chyba && chyba.message) || "Odeslání se nepovedlo. Zkuste to prosím znovu.";
    }).then(function () {
      tlacitko.disabled = false;
    });
  });
})();
