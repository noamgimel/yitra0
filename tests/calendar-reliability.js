// בדיקת אמינות ליומן Cal.com בדף התוצאות (Chromium, נייד):
// 1. N טעינות "נקיות" (כמו גולש חדש) — בכולן היומן חייב להיות גלוי עם ימים, גם אם נבנה מחדש בדרך.
// 2. הטעינה הראשונה נכשלת בכוונה — היומן נבנה מחדש, שומר את המילוי המוקדם, וקביעה ממנו מדווחת ל-Gware ועוברת לדף התודה.
// לא שולחת כלום לפיקסל או ל-Gware (הבקשות נחסמות או מדומות). הרצה: מתוך התיקייה, אחרי python3 -m http.server 8531:
//   PLAYWRIGHT=/נתיב/ל/node_modules/playwright node tests/calendar-reliability.js      (N=10 כברירת מחדל; BASE= לכתובת אחרת)
const { chromium, devices } = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8531';
const N = +(process.env.N || 10);
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const SEED = { name: 'בדיקה', fullName: 'בדיקה מקומית', phone: '0500000003', submissionId: 'reliability-0000', result: { clients: 55, fee: 750, saved: 22, yearly: 66000, deadlines: 83, outstanding: 20000, biggest: 'materials', trackingHours: 9, materialsHours: 20, slipsHours: 1, slips: 1, hours: 31, savedYear: 264, extraClients: 7, perClient: 3, hourValue: 250, monthlyValue: 5500 } };

async function newCtx(b) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'he-IL' });
  await ctx.route(/facebook\.(com|net)|googletagmanager|google-analytics/, r => r.abort());
  await ctx.route(/receiveWebsiteLead|receiveMeetingBooked/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"success":true,"duplicate":false}' }));
  await ctx.addInitScript((seed) => {
    window.__ev = [];
    const t = setInterval(() => { if (window.qfTrack && !window.qfTrack.__s) { const o = window.qfTrack; window.qfTrack = function (n, p, s) { window.__ev.push(n + JSON.stringify(p || {})); return o(n, p, s); }; window.qfTrack.__s = 1; clearInterval(t); } }, 10);
    if (location.pathname.endsWith('results.html')) sessionStorage.setItem('qf_result', JSON.stringify(Object.assign({ at: Date.now() }, seed)));
  }, SEED);
  return ctx;
}
async function waitVisible(p, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const ready = await p.evaluate(() => { const e = document.querySelector('cal-inline'); return !!(e && e.getAttribute('loading') === 'done' && !document.getElementById('calLoading')); });
    if (ready) { const fr = p.frames().find(f => /embedType=inline/.test(f.url())); if (fr && await fr.locator('button[data-testid="day"]').count().catch(() => 0) > 0) return (Date.now() - t0) / 1000; }
    await p.waitForTimeout(500);
  }
  return null;
}

(async () => {
  const b = await chromium.launch();
  // 1. טעינות נקיות
  let visible = 0, rebuilds = 0; const times = [];
  for (let i = 0; i < N; i++) {
    const ctx = await newCtx(b); const p = await ctx.newPage();
    await p.goto(BASE + '/results.html?r=' + Date.now(), { waitUntil: 'domcontentloaded' });
    const t = await waitVisible(p, 30000);
    const ev = await p.evaluate(() => window.__ev.filter(e => /^CalendarRetry/.test(e)).length);
    rebuilds += ev; if (t != null) visible++;
    times.push(t != null ? t.toFixed(1) + 's' + (ev ? `(R${ev})` : '') : 'BLANK');
    await ctx.close();
  }
  console.log('  ' + times.join('  '));
  ok(visible === N, `calendar visible in ${visible}/${N} fresh loads (${rebuilds} automatic rebuilds)`);

  // 2. טעינה ראשונה נכשלת בכוונה
  const ctx = await newCtx(b);
  let calls = 0;
  await ctx.route(/app\.cal\.com\/[^/]+\/[^/]+\/embed/, r => (calls++ === 0 ? r.abort('connectionreset') : r.continue()));
  const reports = [];
  ctx.on('request', r => { if (/receiveMeetingBooked/.test(r.url())) reports.push(r.postData() || ''); });
  const p = await ctx.newPage();
  await p.goto(BASE + '/results.html?r=' + Date.now(), { waitUntil: 'domcontentloaded' });
  const t = await waitVisible(p, 50000);
  ok(calls >= 2 && t != null, `after a failed first load the calendar was rebuilt and is visible (${t != null ? t.toFixed(1) + 's' : 'never'})`);
  const src = await p.evaluate(() => (document.querySelector('#calBox iframe') || {}).src || '');
  ok(/metadata%5Bsubmission_id%5D=reliability-0000/.test(src) && /phone=%2B972500000003/.test(src), 'the rebuilt calendar keeps the prefill (phone, submission id)');
  ok(await p.evaluate(() => document.querySelectorAll('#calBox cal-inline').length) === 1, 'exactly one calendar on the page');
  const ns = await p.evaluate(() => Object.keys(window.Cal.ns).pop());
  await p.evaluate((ns) => window.dispatchEvent(new CustomEvent('CAL:' + ns + ':bookingSuccessfulV2', { detail: { type: 'bookingSuccessfulV2', namespace: ns, data: { uid: 'reliability-uid', startTime: '2026-10-20T08:00:00.000Z', endTime: '2026-10-20T08:30:00.000Z' } } })), ns);
  await p.waitForURL(/thank-you\.html/, { timeout: 8000 }).catch(() => {});
  ok(/thank-you\.html/.test(p.url()), `a booking from the rebuilt calendar ("${ns}") goes to the thank-you page`);
  ok(reports.some(r => /reliability-0000/.test(r) && /reliability-uid/.test(r)), 'the booking is reported to Gware with the lead submission id');
  const when = await p.evaluate(() => { const el = document.getElementById('tyWhen'); return el && !el.hidden ? el.textContent.trim() : null; });
  const expected = new Date('2026-10-20T08:00:00.000Z').toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
  ok(!!when && when.includes(expected) && /30 דקות/.test(when), `the thank-you page shows the booked day and time ("${when}")`);

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message.split('\n')[0]); process.exit(2); });
