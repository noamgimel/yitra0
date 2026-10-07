/* ============================================================
   יומן Cal.com — טעינת ספריית ההטמעה הרשמית (embed.js) ועזרים משותפים.
   index.html: טעינה מוקדמת של היומן בזמן שהגולש עונה על השאלון.
   results.html: היומן עצמו, עם הודעת טעינה וקישור גיבוי.
   ============================================================ */
(function () {
  "use strict";
  var CFG = window.FUNNEL_CONFIG || {};
  var ORIGIN = "https://app.cal.com";

  /* קוד הטעינה הרשמי של Cal.com: יוצר את window.Cal ותור פקודות עד שהספרייה נטענת */
  function loadSnippet() {
    (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, ORIGIN + "/embed/embed.js", "init");
  }

  /* טלפון ישראלי בפורמט בינלאומי: 050-1234567 ← +972501234567 */
  function intlPhone(raw) {
    var d = String(raw || "").replace(/\D/g, "");
    if (!d) return "";
    return "+" + (d.charAt(0) === "0" ? "972" + d.slice(1) : d);
  }

  window.qfCal = {
    origin: ORIGIN,
    enabled: !!CFG.calLink,

    /* טוען את ספריית ההטמעה (פעם אחת) */
    load: function () {
      if (!CFG.calLink) return false;
      loadSnippet();
      return true;
    },

    /* טעינה מוקדמת: Cal.com טוען את קבצי דף ההזמנה בחלון מוסתר, כדי שבדף התוצאות היומן יופיע מיד */
    warm: function () {
      if (this._warm || !this.load()) return;
      this._warm = true;
      try {
        Cal("init", { origin: ORIGIN });
        Cal("preload", { calLink: CFG.calLink });
      } catch (e) {}
    },

    /* מה שממולא מראש: שם, והטלפון לשדה המוסתר בטופס ההזמנה (כדי לשייך את הפגישה לליד) */
    prefill: function (data) {
      var c = {};
      if (!data) return c;
      if (data.fullName) c.name = data.fullName;
      var phone = intlPhone(data.phone);
      if (CFG.calPhoneField && phone) c[CFG.calPhoneField] = phone;
      return c;
    },

    /* קישור ישיר לדף ההזמנה — גיבוי אם היומן בדף לא נטען */
    directUrl: function (data) {
      var q = new URLSearchParams(this.prefill(data)).toString();
      return "https://cal.com/" + CFG.calLink + (q ? "?" + q : "");
    }
  };
})();
