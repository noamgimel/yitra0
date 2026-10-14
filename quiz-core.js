/* ============================================================
   ליבת השאלון — משותפת לדף הנחיתה ולדף התוצאות
   השאלות, החישוב (בטווח), התוכנית (plan) וקוד התשובות לקישור results.html?c=...
   דף התוצאות מחשב הכול מחדש מהתשובות, באותן פונקציות — כך שהמספרים והתוכנית זהים בכל מקום
   (בדף, בליד שנשלח ל-Gware, ובעתיד בוואטסאפ ובשיחה).

   ⚠️ קוד התשובות מקודד את מספרי התשובות. שינוי בסדר השאלות או התשובות, בערכים או בכיול (MODEL)
   משנה את המשמעות של קודים שכבר יצאו: מעלים CODE_VERSION ומעדכנים את סשן Gware.
   ============================================================ */
(function () {
  "use strict";

  /* hint = שורת ההסבר מתחת לשאלה: דוגמאות מוחשיות, כדי שיהיה ברור בדיוק על מה מדובר.
     התשובה הראשונה בשאלות 2–5 היא "אין בעיה": היא מוציאה את הפתרון מהחישוב ומהתוכנית. */
  var QUESTIONS = [
    {
      id: "clients",
      title: "כמה לקוחות פעילים יש למשרד?",
      hint: "עסקים ושכירים שאתה מגיש עבורם דיווחים או דוחות באופן שוטף.",
      options: [
        { main: "עד 30 לקוחות", sub: "משרד קטן, הכול עובר דרכי", value: 25 },
        { main: "30 עד 80 לקוחות", sub: "כבר אי אפשר לזכור הכול בראש", value: 55 },
        { main: "80 עד 200 לקוחות", sub: "יש צוות, ועדיין הכול מתנקז אליי", value: 140 },
        { main: "מעל 200 לקוחות", sub: "משרד גדול עם הרבה ידיים ועוד יותר מועדים", value: 250 }
      ]
    },
    {
      id: "tracking",
      title: "תחילת חודש. איך אתה יודע מה כל לקוח צריך לדווח החודש, ומה כבר הגיע?",
      hint: "מע״מ חודשי או דו-חודשי, 102, מקדמות, וכל לקוח בתדירות אחרת.",
      options: [
        { main: "יש לי מערכת שמתמלאת לבד", sub: "הכול מול העיניים, בלי להכין כלום" },
        { main: "אקסל שאני מעדכן ידנית", sub: "שעה-שעתיים של הצלבות בכל חודש" },
        { main: "בראש ובוואטסאפים", sub: "זה עובד. עד שזה לא עובד" },
        { main: "אני מגלה כשהלקוח מתקשר", sub: "או כשמגיע מכתב מרשות המסים" }
      ]
    },
    {
      id: "materials",
      title: "מתקרב מועד דיווח. איך נראה איסוף החומרים מהלקוחות?",
      hint: "חשבוניות, קבלות, דפי בנק ותלושים, לפני כל מע״מ, 102 ומקדמות.",
      options: [
        { main: "הלקוחות מעלים הכול בזמן", sub: "התיקים מוכנים לטיפול תמיד" },
        { main: "צריך להזכיר לחלק מהלקוחות", sub: "כמה שעות של הודעות ומיילים לפני כל מועד" },
        { main: "סיוט", sub: "קבלות מטושטשות בוואטסאפ, \"שלחתי לך כבר\", ומיילים שאף אחד לא עונה עליהם" },
        { main: "עונת דוחות = לילות לבנים", sub: "אני עובד עד 2 בלילה, הלקוחות מתעלמים מהוואטסאפים שלי, והדוחות נדחים" }
      ]
    },
    {
      id: "switching",
      title: "בשבוע רגיל, כמה זמן הולך על קפיצה בין וואטסאפ, אקסל, מייל ותוכנות, רק כדי להבין מה קורה עם לקוח?",
      hint: "לחפש הודעה ישנה, קובץ שהלקוח שלח, או מה סיכמתם בשיחה האחרונה.",
      options: [
        { main: "כמעט כלום", sub: "הכול אצלי במקום אחד" },
        { main: "שעה-שעתיים", sub: "פה ושם, וזה מצטבר" },
        { main: "3 עד 5 שעות", sub: "כל שאלה של לקוח מתחילה בחיפוש" },
        { main: "יותר מ-5 שעות", sub: "כל מידע נמצא במקום אחר" }
      ]
    },
    {
      id: "slips",
      title: "כמה פעמים בחודש משהו נופל לך בין הכיסאות?",
      hint: "דיווח שנשכח, תשלום שהתפספס, מסמך ששכחת לבקש, לקוח שחיכה לתשובה.",
      options: [
        { main: "כמעט אף פעם", sub: "שום דבר לא נופל אצלי" },
        { main: "פעם-פעמיים", sub: "קורה, ואז מתנצלים ומתקנים" },
        { main: "3 עד 5 פעמים", sub: "ואני יודע רק על אלה שגילו" },
        { main: "הפסקתי לספור", sub: "כל יום משהו מתפספס, וזה יושב לי על הראש" }
      ]
    },
    {
      id: "outstanding",
      title: "וכמה שכר טרחה יושב כרגע \"בחוץ\", אצל לקוחות שעברו את מועד התשלום?",
      hint: "הערכה גסה מספיקה. הסכום מוצג בנפרד, ולא נכנס לחישוב השעות.",
      options: [
        { main: "פחות מ-10,000 ₪", sub: "זה סביר, אבל עדיין דורש התעסקות", value: 5000 },
        { main: "בין 10,000 ₪ ל-30,000 ₪", sub: "אני עובד חודשים בלי לקבל על זה כסף", value: 20000 },
        { main: "בין 30,000 ₪ ל-80,000 ₪", sub: "זה כבר מורגש בתזרים", value: 55000 },
        { main: "מעל 80,000 ₪", sub: "יותר ממה שנוח לי להודות", value: 100000 }
      ]
    }
  ];

  /* ============================================================
     החישוב — שמרני, בטווח (נמוך–גבוה). הנחות (הערכות; לכייל מול רואי חשבון אמיתיים):
     מעקב דיווחים     = לקוחות × 4–8 / 6–10 / 10–15 דקות ללקוח בחודש (ש׳2)      — המערכת חוסכת 80%
     איסוף חומרים     = לקוחות × 8–15 / 15–25 / 25–40 דקות ללקוח בחודש (ש׳3)    — 60% (חלק נשאר אנושי)
     קפיצה בין תוכנות = 1.5 / 4 / 6 שעות בשבוע (ש׳4) × 4.3 שבועות, ±25%          — 70%
     דברים שנופלים    = 1.5 / 4 / 7 פעמים בחודש (ש׳5) × 30–60 דקות תיקון         — 80%
     תשובה של "אין בעיה" = 0, והפתרון שלה לא נכנס לתוכנית.
     שעות שחוזרות = סכום הקצוות: הנמוך מעוגל למטה, הגבוה למעלה.
     שווי בשנה    = הקצה הנמוך × hourValue (₪150, config.js) × 12 — מוצג כ"לפחות".
     שכר הטרחה בחוץ (ש׳6) מוצג בנפרד ולא נכנס לסכום, כדי לא לספור פעמיים.
     ============================================================ */
  var MODEL = {
    tracking: { minutes: [null, [4, 8], [6, 10], [10, 15]], save: 0.8 },
    materials: { minutes: [null, [8, 15], [15, 25], [25, 40]], save: 0.6 },
    switching: { weekly: [0, 1.5, 4, 6], weeks: 4.3, spread: 0.25, save: 0.7 },
    slips: { perMonth: [0, 1.5, 4, 7], fixMinutes: [30, 60], save: 0.8 }
  };

  /* כל כאב ← הפתרון שלו בקטלוג (מפתחות הקטלוג הם חוזה עם Gware ו-G — לא לשנות את השמות) */
  var SOLUTION_OF = { tracking: "tracking", materials: "materials", switching: "base", slips: "slips" };
  var TIME_KEYS = ["tracking", "materials", "switching", "slips"];

  function q(id) { return QUESTIONS.filter(function (x) { return x.id === id; })[0]; }
  function opt(id, i) { var o = q(id).options[i]; return o || null; }
  function r1(n) { return Math.round(n * 10) / 10; }

  /* answers = { clients: 0–3, tracking: 0–3, ... } (מספר התשובה). מחזיר null אם חסרה תשובה */
  function valid(a) {
    return !!a && QUESTIONS.every(function (x) { var v = a[x.id]; return v === 0 || v === 1 || v === 2 || v === 3; });
  }

  function compute(a, CFG) {
    if (!valid(a)) return null;
    CFG = CFG || {};
    var hourValue = CFG.hourValue || 150;
    var perClient = CFG.hoursPerClient || 5;
    var clients = opt("clients", a.clients).value;

    function perClientMinutes(key) {
      var m = MODEL[key].minutes[a[key]];
      return m ? [clients * m[0] / 60, clients * m[1] / 60] : [0, 0];
    }
    var spent = {
      tracking: perClientMinutes("tracking"),
      materials: perClientMinutes("materials"),
      switching: (function () {
        var s = MODEL.switching, w = s.weekly[a.switching] * s.weeks;
        return [w * (1 - s.spread), w * (1 + s.spread)];
      })(),
      slips: (function () {
        var s = MODEL.slips, n = s.perMonth[a.slips];
        return [n * s.fixMinutes[0] / 60, n * s.fixMinutes[1] / 60];
      })()
    };

    var parts = {}, lo = 0, hi = 0, spentLo = 0, spentHi = 0;
    TIME_KEYS.forEach(function (k) {
      var f = MODEL[k].save;
      parts[k] = { lo: spent[k][0] * f, hi: spent[k][1] * f, spentLo: r1(spent[k][0]), spentHi: r1(spent[k][1]) };
      lo += parts[k].lo; hi += parts[k].hi;
      spentLo += spent[k][0]; spentHi += spent[k][1];
    });
    TIME_KEYS.forEach(function (k) { parts[k].lo = r1(parts[k].lo); parts[k].hi = r1(parts[k].hi); });

    var savedHi = Math.ceil(hi);
    var savedLo = savedHi > 0 ? Math.max(1, Math.floor(lo)) : 0;
    var outstanding = opt("outstanding", a.outstanding).value;

    return {
      clients: clients,
      clientsLabel: opt("clients", a.clients).main,
      parts: parts,                                   /* השעות שכל כאב מחזיר (אחרי החיסכון), בטווח */
      spentLo: Math.round(spentLo), spentHi: Math.round(spentHi),
      savedLo: savedLo, savedHi: savedHi,
      hourValue: hourValue,
      yearly: savedLo * hourValue * 12,               /* "לפחות" */
      monthlyValue: savedLo * hourValue,
      days: (lo + hi) / 2 / 8,                        /* ימי עבודה של 8 שעות, באמצע הטווח */
      perClient: perClient,
      extraClients: Math.floor(savedLo / perClient),
      deadlines: Math.round(clients * (CFG.deadlinesPerClient || 1.5)),
      outstanding: outstanding,
      outstandingIdx: a.outstanding,
      taxRisk: a.tracking === 3 || a.materials === 3
    };
  }

  /* ============================================================
     התוכנית — מפתחות הקטלוג לפי הסדר (חוזה עם Gware ו-G):
     tracking ← ש׳2 · materials ← ש׳3 · base ← ש׳4 (תיק לקוחות + מזכיר אישי) · slips ← ש׳5 · cashflow ← ש׳6
     1. גבייה ראשונה כשבחוץ 30,000 ₪ ומעלה.
     2. אחריה פתרונות הזמן, לפי השעות שכל אחד מחזיר במשרד הזה (אמצע הטווח), מהגבוה לנמוך.
     3. גבייה של 10,000–30,000 ₪ אחרי פתרונות הזמן. מתחת ל-10,000 ₪ היא לא בתוכנית.
     4. תשובה של "אין בעיה" מוציאה את הפתרון. אם לא נשאר כלום — רק הבסיס.
     הבסיס (תיק לקוחות) מופיע בדף בכל מקרה, ככרטיס אם הוא בין השניים הראשונים, אחרת כשורה.
     ============================================================ */
  function plan(a, r) {
    if (!r) return [];
    var time = TIME_KEYS.filter(function (k) { return a[k] > 0; })
      .map(function (k, i) { return { key: SOLUTION_OF[k], mid: (r.parts[k].lo + r.parts[k].hi) / 2, i: i }; })
      .sort(function (x, y) { return (y.mid - x.mid) || (x.i - y.i); })
      .map(function (p) { return p.key; });
    var out = [];
    if (a.outstanding >= 2) out.push("cashflow");
    out = out.concat(time);
    if (a.outstanding === 1) out.push("cashflow");
    return out.length ? out : ["base"];
  }

  /* השעות שפתרון מחזיר (לכרטיס). לגבייה — אין שעות, יש סכום */
  function solutionHours(key, r) {
    var k = key === "base" ? "switching" : key;
    return r && r.parts[k] ? r.parts[k] : null;
  }

  /* ============================================================
     קוד התשובות: גרסה + 6 מספרי התשובות (0–3, בסדר השאלות), ואופציונלית "-" + submission_id.
     חייב להתאים ל-^[A-Za-z0-9_-]{1,64}$ (משתנה בכפתור של תבנית וואטסאפ).
     גרסה 3 = השאלון הזה (לקוחות, מעקב דיווחים, חומרים, קפיצה בין תוכנות, נפילות, שכר טרחה בחוץ).
     גרסה 2 (של אדר) לא עלתה לאוויר, ולכן לא הונפקו קודים כאלה.
     ============================================================ */
  var CODE_VERSION = "3";
  var CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;
  var IDS = QUESTIONS.map(function (x) { return x.id; });

  function encode(a, submissionId) {
    if (!valid(a)) return "";
    var code = CODE_VERSION + IDS.map(function (id) { return String(a[id]); }).join("");
    var sid = String(submissionId || "").replace(/[^A-Za-z0-9_-]/g, "");
    return sid && CODE_RE.test(code + "-" + sid) ? code + "-" + sid : code;
  }

  /* מחזיר { answers, submissionId } או null אם הקוד לא תקין */
  function decode(code) {
    if (!code || !CODE_RE.test(code)) return null;
    var m = /^3([0-3]{6})(?:-([A-Za-z0-9_-]+))?$/.exec(code);
    if (!m) return null;
    var answers = {};
    IDS.forEach(function (id, i) { answers[id] = +m[1].charAt(i); });
    return { answers: answers, submissionId: m[2] || "" };
  }

  /* טקסט התשובה המלא, לליד (כותרת + שורת ההסבר שלה) */
  function answerText(id, i) {
    var o = opt(id, i);
    return o ? o.main + (o.sub ? " (" + o.sub + ")" : "") : "";
  }

  window.qfCore = {
    QUESTIONS: QUESTIONS, IDS: IDS, MODEL: MODEL, CODE_VERSION: CODE_VERSION,
    valid: valid, compute: compute, plan: plan, solutionHours: solutionHours,
    encode: encode, decode: decode, option: opt, answerText: answerText
  };
})();
