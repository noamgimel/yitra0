/**
 * משפך שאלון "מחשבון המשרד" לרואי חשבון: קליטת לידים אל Google Sheets
 * =====================================================================
 *
 * התקנה (5 דקות, פעם אחת)
 *  1. לפתוח גיליון Google Sheets חדש ← Extensions ← Apps Script
 *  2. למחוק את הקוד שבעורך ולהדביק במקומו את הקובץ הזה
 *  3. Deploy ← New deployment ← גלגל השיניים ← Web app
 *         Execute as:      Me
 *         Who has access:  Anyone        <-- חובה! בלי זה הטופס לא יעבוד
 *  4. Deploy ← לאשר הרשאות
 *     (במסך "Google hasn't verified this app": Advanced ← Go to ... ← Allow)
 *  5. להעתיק את ה-Web app URL (https://script.google.com/macros/s/.../exec)
 *     ולהדביק אותו ב-config.js בשדה leadWebhookUrl
 *
 *  בדיקה: לפתוח את ה-URL בדפדפן. אמור להופיע {"result":"ok",...}
 *  אחרי כל שינוי בקוד: Deploy ← Manage deployments ← עיפרון ← New version ← Deploy
 */

/** שם הלשונית. אם אינה קיימת, היא תיווצר אוטומטית עם כותרות */
var SHEET_NAME = 'לידים שאלון';

/** מייל להתראה על כל ליד חדש. '' = ללא התראה */
var NOTIFY_EMAIL = '';

var HEADERS = [
  'תאריך', 'שם', 'טלפון', 'אימייל', 'מקור (UTM)', 'סטטוס',
  'שעות בחודש', 'שעות שאפשר להחזיר', 'שווי בשנה ₪', 'מועדי דיווח בחודש', 'הדליפה הגדולה',
  'ש1: לקוחות פעילים', 'ש2: מעקב דיווחים', 'ש3: איסוף חומרים לדיווח',
  'ש4: דברים שנפלו בין הכיסאות', 'ש5: שכר טרחה חודשי ממוצע', 'ש6: שכר טרחה פתוח'
];

var LEAK_NAMES = {
  tracking: 'מעקב דיווחים מהראש',
  materials: 'איסוף חומרים לדיווח',
  slips: 'פולואפים שנופלים בין הכיסאות',
  cashflow: 'שכר טרחה תקוע אצל לקוחות'
};

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var d = parseBody_(e);
    var sheet = getSheet_();

    sheet.appendRow([
      formatNow_(),
      d.name || '',
      normalizePhone_(d.phone),
      d.email || '',
      d.utm_source || 'direct',
      'חדש',
      d.hours_per_month || '',
      d.hours_saved_per_month || '',
      d.yearly_value || '',
      d.deadlines_per_month || '',
      d.biggest_leak_label || LEAK_NAMES[d.biggest_leak] || '',
      d.q1_answer || '',
      d.q2_answer || '',
      d.q3_answer || '',
      d.q4_answer || '',
      d.q5_answer || '',
      d.q6_answer || ''
    ]);

    if (NOTIFY_EMAIL) notify_(d);
    return json_({ result: 'ok' });
  } catch (err) {
    console.error('שגיאה בקליטת ליד: ' + err);
    return json_({ result: 'error', message: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/** הדף שולח JSON; אם הדפדפן חסם (CORS) הוא שולח שוב כ-form-urlencoded */
function parseBody_(e) {
  var t = (e.postData && e.postData.type) || '';
  if (t.indexOf('json') > -1 || t.indexOf('text/plain') > -1) return JSON.parse(e.postData.contents);
  return e.parameter || {};
}

function doGet() {
  var sheet = getSheet_();
  return json_({ result: 'ok', sheet: SHEET_NAME, rows: Math.max(0, sheet.getLastRow() - 1) });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.setRightToLeft(true);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#0B2E24').setFontColor('#F4B740');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** גרש מוביל שומר על ה-0 בתחילת מספר הטלפון */
function normalizePhone_(phone) {
  var p = String(phone || '').trim();
  if (!p) return '';
  return p.charAt(0) === "'" ? p : "'" + p;
}

function formatNow_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}

function notify_(d) {
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'ליד חדש מהשאלון: ' + (d.name || '') + ' (₪' + (d.yearly_value || '?') + ' בשנה)',
    htmlBody:
      '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px">' +
      '<h3 style="color:#0B2E24">ליד חדש ממחשבון המשרד</h3>' +
      '<p><b>שם:</b> ' + (d.name || '') + '</p>' +
      '<p><b>טלפון:</b> ' + (d.phone || '') + '</p>' +
      '<p><b>אימייל:</b> ' + (d.email || '') + '</p>' +
      '<p><b>שעות בחודש:</b> ' + (d.hours_per_month || '') + ' · <b>אפשר להחזיר:</b> ' + (d.hours_saved_per_month || '') + ' · <b>שווי בשנה:</b> ₪' + (d.yearly_value || '') + '</p>' +
      '<p><b>הדליפה הגדולה:</b> ' + (LEAK_NAMES[d.biggest_leak] || '') + '</p>' +
      '<p><b>לקוחות:</b> ' + (d.q1_answer || '') + ' · <b>שכר טרחה פתוח:</b> ' + (d.q6_answer || '') + '</p>' +
      '<p><b>מקור:</b> ' + (d.utm_source || 'direct') + '</p>' +
      '</div>'
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** בדיקה ידנית מתוך העורך. מוסיפה שורת בדיקה (למחוק אחר כך) */
function testLead() {
  var res = doPost({ postData: { type: 'application/json', contents: JSON.stringify({
    name: 'בדיקה — למחוק', phone: '050-0000000', email: 'test@example.com', utm_source: 'בדיקה ידנית',
    hours_per_month: 17, hours_saved_per_month: 12, yearly_value: 36000, deadlines_per_month: 38, biggest_leak: 'materials',
    q1_answer: 'עד 30 לקוחות', q2_answer: 'בראש ובוואטסאפים', q3_answer: 'סיוט',
    q4_answer: '3 עד 5 פעמים', q5_answer: '500 עד 1,000 ₪', q6_answer: 'בין 10,000 ₪ ל-30,000 ₪'
  }) } });
  console.log(res.getContent());
}
