/* ============================================================
   מדידה: פיקסל מטא ו-GA4 — נטענים רק אם הוגדר מזהה ב-config.js
   כל האירועים במשפך עוברים דרך qfTrack. רשימת האירועים ב-README.
   כאן גם מצב בדיקה (qfIsTest) ומקור התנועה (qfAttribution), המשותפים לשלושת הדפים.
   ============================================================ */
(function () {
  "use strict";
  var CFG = window.FUNNEL_CONFIG || {};

  /* ---------- מצב בדיקה (16/10/2026) ----------
     במכשיר שבודק את המשפך הפיקסל לא נטען בכלל, כדי שלידים ופגישות של בדיקה לא ייספרו בקמפיין.
     לא מספיק לזהות מאיזה קישור נכנסו: מטא מזהה את האדם, ולא את הקישור. מי שמחובר לפייסבוק באותו טלפון
     וראה או לחץ על המודעה בימים האחרונים, נזקף לקמפיין גם כשנכנס ידנית.
     הליד עצמו ממשיך ל-Gware כרגיל, מסומן is_test (ו-G שולח לו הודעות כרגיל, כדי שאפשר לבדוק גם אותן).
     הפעלה: ?test=1 (נשמר במכשיר, בכל הדפים) · כיבוי: ?test=0.
     ברירת מחדל: בדיקה בכל כתובת שאינה האתר החי (liveHost ב-config.js), כמו גרסאות הבדיקה של ורסל ו-localhost.
     שם ?test=0 מפעיל את הפיקסל בכוונה, כדי לבדוק אותו. */
  var TEST_KEY = "qf_test";
  var isTest = (function () {
    var q = null, stored = null;
    try { q = new URLSearchParams(location.search).get("test"); } catch (e) {}
    try {
      if (q === "1" || q === "0") localStorage.setItem(TEST_KEY, q);
      stored = localStorage.getItem(TEST_KEY);
    } catch (e) { stored = q; }   /* בלי localStorage: רק לפי הכתובת הנוכחית */
    if (stored === "1") return true;
    if (stored === "0") return false;
    return !!CFG.liveHost && location.hostname !== CFG.liveHost;
  })();
  window.qfIsTest = isTest;

  if (isTest) {
    /* תווית קטנה בפינה, כדי שלא ישכחו שהמכשיר במצב בדיקה. לא לוכדת לחיצות ולא מכסה כלום */
    var showBadge = function () {
      var b = document.createElement("div");
      b.id = "qfTestBadge";
      b.setAttribute("aria-hidden", "true");
      b.textContent = "מצב בדיקה · הפיקסל כבוי";
      b.style.cssText = "position:fixed;z-index:130;bottom:calc(96px + env(safe-area-inset-bottom));inset-inline-start:12px;" +
        "padding:5px 12px;border-radius:999px;background:#E0583F;color:#fff;font:700 12.5px/1.4 Heebo,system-ui,sans-serif;" +
        "box-shadow:0 8px 20px -8px rgba(0,0,0,.6);pointer-events:none;opacity:.94";
      document.body.appendChild(b);
    };
    if (document.body) showBadge(); else document.addEventListener("DOMContentLoaded", showBadge);
  }

  var pixelId = isTest ? "" : String(CFG.metaPixelId || "").replace(/\D/g, "");
  var gaId = isTest ? "" : String(CFG.gaMeasurementId || "").trim();

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
     לא שולחים אף פעם שם, טלפון או מידע מזהה — רק שם האירוע ופרמטרים כלליים.
     במצב בדיקה הפיקסל לא קיים, ולכן שום דבר לא יוצא. */
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

  /* ---------- מקור התנועה (16/10/2026) ----------
     נקבע בדף שבו התחיל הביקור (דף הנחיתה) ונשלח עם הליד ל-Gware: traffic_source ותווית בעברית.
       meta_ad  = תגיות UTM של מטא מהמודעה (utm_source כמו facebook / instagram / meta)
       meta     = לחיצה מפייסבוק או מאינסטגרם בלי תגיות (fbclid, או הפניה מהם). היום זה כמעט תמיד הקמפיין,
                  אבל fbclid מתווסף גם לקישורים בפוסטים רגילים — לכן זה נפרד מ-meta_ad
       utm      = תגיות של מקור אחר · referral = הפניה מאתר אחר · direct = ישיר
     בדיקה (test) ו"קישור התוכנית" (plan_link) נקבעים בדף התוצאות, ברגע שליחת הליד. */
  window.qfAttribution = function () {
    var p = new URLSearchParams(location.search), out = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) { out[k] = p.get(k) || ""; });
    var fbclid = p.get("fbclid") || "", ref = "";
    try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; } catch (e) {}
    if (ref === location.hostname) ref = "";
    if (out.utm_source && /^(fb|ig|meta)$|facebook|instagram/i.test(out.utm_source)) { out.traffic_source = "meta_ad"; out.traffic_source_label = "קמפיין מטא"; }
    else if (out.utm_source) { out.traffic_source = "utm"; out.traffic_source_label = "קמפיין: " + out.utm_source; }
    else if (fbclid || /(^|\.)(facebook\.com|instagram\.com|fb\.com|fb\.me)$/i.test(ref)) { out.traffic_source = "meta"; out.traffic_source_label = "פייסבוק / אינסטגרם"; }
    else if (ref) { out.traffic_source = "referral"; out.traffic_source_label = "הפניה: " + ref; }
    else { out.traffic_source = "direct"; out.traffic_source_label = "ישיר"; }
    out.fbclid = fbclid;
    out.referrer_host = ref;
    if (!out.utm_source) out.utm_source = "direct";   /* כמו עד היום: בלי תגיות = direct */
    return out;
  };
})();
