/* ============================================================
   יומן Cal.com — טעינת ספריית ההטמעה הרשמית (embed.js) ועזרים משותפים.
   index.html: טעינה מוקדמת של היומן בזמן שהגולש עונה על השאלון.
   results.html: היומן עצמו, עם הודעת טעינה וקישור גיבוי, ודיווח ל-Gware כשנקבעת פגישה.
   thank-you.html: שליחה חוזרת של דיווח שעוד לא אושר.
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

  /* ---------- דיווח ל-Gware: הליד קבע שיחת אבחון ----------
     הליד מזוהה לפי מזהה השליחה (submission_id) שנשלח איתו מהשאלון. רק הדפדפן ששלח את הליד מכיר אותו,
     כך שהדיווח מזיז בדיוק את הליד הזה, ולא ליד אחר (גם לא ליד אחר עם אותו טלפון).
     הדיווח נשמר ב-localStorage עד ש-Gware מאשר אותו, ונשלח שוב מדף התודה אם צריך.
     אותה פגישה פעמיים — Gware מזהה (לפי booking_uid או המועד) ולא משנה דבר. */
  var BOOKING_KEY = "qf_pending_booking";
  function readJSON(store, key) { try { return JSON.parse(store.getItem(key) || "null"); } catch (e) { return null; } }
  function savePending(rec) { try { localStorage.setItem(BOOKING_KEY, JSON.stringify(rec)); } catch (e) {} }
  function dropPending() { try { localStorage.removeItem(BOOKING_KEY); } catch (e) {} }
  function isoOrEmpty(v) { var d = new Date(v || ""); return isNaN(d.getTime()) ? "" : d.toISOString(); }
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  /* תוצאה: "ok" | "not_found" (הליד עוד לא הגיע ל-Gware) | "retry" | "sent_opaque" | "rejected" | "expired" | "skip" */
  function sendBooking(rec) {
    var url = CFG.meetingWebhookUrl;
    if (!url || !rec || !rec.payload) return Promise.resolve("skip");
    if ((rec.attempts || 0) >= 6 || Date.now() - (rec.at || 0) > 3 * 864e5) { dropPending(); return Promise.resolve("expired"); }
    rec.attempts = (rec.attempts || 0) + 1;
    savePending(rec);
    var body = JSON.stringify(rec.payload);
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true })
      .then(function (res) {
        if (res.ok) { dropPending(); return "ok"; }
        if (res.status === 404) return "not_found";
        if (res.status === 429 || res.status >= 500) return "retry";
        dropPending();   /* 400/401: שגיאה קבועה, אין טעם לנסות שוב */
        return "rejected";
      })
      .catch(function () {
        /* בלי CORS או בלי רשת: שליחה כטקסט (no-cors), כמו הליד. התשובה אטומה, אז הדיווח נשאר ממתין לדף התודה */
        return fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: body, keepalive: true })
          .then(function () { return "sent_opaque"; }, function () { return "retry"; });
      });
  }

  /* ניסיון, ואם הליד עוד לא הגיע או שהשרת עמוס — עוד ניסיון אחד אחרי כמה שניות */
  function sendWithRetry(rec, delay) {
    return sendBooking(rec).then(function (r) {
      if (r !== "not_found" && r !== "retry") return r;
      return wait(delay).then(function () { return sendBooking(readJSON(localStorage, BOOKING_KEY)); });
    });
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

    /* מה שממולא מראש: שם, והטלפון לשדה המוסתר בטופס ההזמנה (כדי לשייך את הפגישה לליד).
       ובנוסף מזהה השליחה של הליד כ-metadata של ההזמנה: לא מוצג לליד, נשמר בהזמנה ב-Cal.com
       ומגיע ב-webhook של Cal.com ל-Gware (payload.metadata.submission_id) — גם בביטול ובשינוי מועד,
       כך ש-Gware מקשרת כל שינוי בדיוק לליד הזה. */
    prefill: function (data) {
      var c = {};
      if (!data) return c;
      if (data.fullName) c.name = data.fullName;
      var phone = intlPhone(data.phone);
      if (CFG.calPhoneField && phone) c[CFG.calPhoneField] = phone;
      if (data.submissionId) c["metadata[submission_id]"] = String(data.submissionId);
      return c;
    },

    /* קישור ישיר לדף ההזמנה — גיבוי אם היומן בדף לא נטען */
    directUrl: function (data) {
      var q = new URLSearchParams(this.prefill(data)).toString();
      return "https://cal.com/" + CFG.calLink + (q ? "?" + q : "");
    },

    /* נקרא מאירוע bookingSuccessfulV2 של Cal.com (booked = e.detail.data: uid, startTime, endTime, videoCallUrl) */
    reportBooking: function (booked) {
      var q = readJSON(sessionStorage, "qf_result");
      var start = isoOrEmpty(booked && booked.startTime);
      if (!CFG.meetingWebhookUrl || !q || !q.submissionId || !start) return Promise.resolve("skip");
      var payload = { form_id: CFG.leadFormId || "", secret_key: CFG.leadSecretKey || "", submission_id: q.submissionId, meeting_start: start };
      var end = isoOrEmpty(booked.endTime);
      if (end) payload.meeting_end = end;
      if (booked.uid) payload.booking_uid = String(booked.uid);
      if (booked.videoCallUrl) payload.meeting_url = String(booked.videoCallUrl);
      return sendWithRetry({ at: Date.now(), attempts: 0, payload: payload }, 3000);
    },

    /* דף התודה: דיווח שעוד לא אושר נשלח שוב */
    flushBooking: function () {
      var rec = readJSON(localStorage, BOOKING_KEY);
      return rec ? sendWithRetry(rec, 4000) : Promise.resolve("none");
    }
  };
})();
