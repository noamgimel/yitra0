/* ============================================================
   מדידה: פיקסל מטא ו-GA4 — נטענים רק אם הוגדר מזהה ב-config.js
   כל האירועים במשפך עוברים דרך qfTrack. רשימת האירועים ב-README.
   ============================================================ */
(function () {
  "use strict";
  var CFG = window.FUNNEL_CONFIG || {};
  var pixelId = String(CFG.metaPixelId || "").replace(/\D/g, "");
  var gaId = String(CFG.gaMeasurementId || "").trim();

  /* קוד הבסיס הרשמי של פיקסל מטא */
  if (pixelId && !window.fbq) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* בלי "אירועים אוטומטיים" של מטא (SubscribedButtonClick וכו'): נשלחים רק האירועים שמוגדרים כאן */
    fbq("set", "autoConfig", false, pixelId);
    fbq("init", pixelId);
    fbq("track", "PageView");
  }

  /* קוד הבסיס הרשמי של GA4 */
  if (gaId && !window.gtag) {
    var g = document.createElement("script");
    g.async = true;
    g.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaId);
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("config", gaId);
  }

  /* standard = אירוע סטנדרטי של מטא (Lead, Schedule); אחרת אירוע מותאם.
     לא שולחים אף פעם שם, טלפון או מידע מזהה — רק שם האירוע ופרמטרים כלליים. */
  window.qfTrack = function (name, params, standard) {
    try { if (window.fbq) fbq(standard ? "track" : "trackCustom", name, params || {}); } catch (e) {}
    try { if (window.gtag) gtag("event", name, params || {}); } catch (e) {}
  };

  /* פעם אחת לכל טעינת דף — חזרה לשאלה ושינוי תשובה לא סופרים את השלב פעמיים */
  var sent = {};
  window.qfTrackOnce = function (name, params, standard) {
    if (sent[name]) return;
    sent[name] = true;
    window.qfTrack(name, params, standard);
  };
})();
