// בדיקת מצב בדיקה ומקור התנועה (Chromium, נייד):
// 1. כמו באתר החי (config.js מוחלף כך ש-localhost נחשב לאתר החי): בכניסה רגילה הפיקסל נטען והליד יוצא עם is_test=false;
//    אחרי ?test=1 הפיקסל לא נטען בשום דף, לא יוצאת אף בקשה למטא, מופיעה התווית, והליד מסומן כבדיקה; ?test=0 מחזיר למצב רגיל.
// 2. בכל כתובת שאינה האתר החי (כאן localhost) — מצב בדיקה אוטומטי.
// 3. סיווג מקור התנועה לפי תגיות, fbclid והפניה.
// לא שולחת כלום למטא או ל-Gware (הבקשות נחסמות או מדומות). הרצה: מתוך התיקייה, אחרי python3 -m http.server 8531:
//   PLAYWRIGHT=/נתיב/ל/node_modules/playwright node tests/test-mode.js
const { chromium, devices } = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8531';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ANSWERS = { clients: 1, tracking: 1, materials: 2, switching: 2, slips: 1, outstanding: 1 };

async function newCtx(b, { asLive = false } = {}) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'he-IL' });
  const fb = [], leads = [];
  await ctx.route(/facebook\.(com|net)|googletagmanager|google-analytics/, r => { fb.push(r.request().url()); r.abort(); });
  await ctx.route(/receiveWebsiteLead|receiveMeetingBooked/, r => {
    if (/receiveWebsiteLead/.test(r.request().url())) { try { leads.push(JSON.parse(r.request().postData() || '{}')); } catch (e) {} }
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"success":true}' });
  });
  await ctx.route(/cal\.com/, r => r.abort());   /* היומן לא נחוץ כאן */
  if (asLive) {
    /* localhost מתנהג כמו האתר החי */
    await ctx.route(/\/config\.js/, async r => {
      const res = await r.fetch(); const body = (await res.text()).replace(/liveHost: "[^"]*"/, 'liveHost: "localhost"');
      r.fulfill({ response: res, body });
    });
  }
  return { ctx, fb, leads };
}
const state = (p) => p.evaluate(() => ({
  test: window.qfIsTest, fbq: typeof window.fbq, queue: window.fbq && window.fbq.queue ? window.fbq.queue.map(a => Array.from(a).slice(0, 2).join(':')) : [],
  badge: !!document.getElementById('qfTestBadge'),
}));
async function submitPlanForm(p) {
  await p.evaluate((a) => { if (!JSON.parse(sessionStorage.getItem('qf_result') || 'null')) sessionStorage.setItem('qf_result', JSON.stringify({ answers: a, at: Date.now() })); }, ANSWERS);
  await p.goto(BASE + '/results.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
  await p.fill('#pName', 'בדיקה מצב'); await p.fill('#pPhone', '0500000009');
  await p.click('#planUnlock button[type="submit"]');
  await p.waitForTimeout(900);
}

(async () => {
  const b = await chromium.launch();

  // ---------- 1. כמו באתר החי ----------
  {
    const { ctx, fb, leads } = await newCtx(b, { asLive: true });
    const p = await ctx.newPage();
    await p.goto(BASE + '/?utm_source=facebook&utm_campaign=c1&utm_content=ad7', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(800);
    let s = await state(p);
    ok(s.test === false && s.fbq === 'function' && s.queue.includes('track:PageView') && !s.badge, `live, normal visit: pixel loads with PageView, no badge (${JSON.stringify(s.queue)})`);
    await p.evaluate(() => sessionStorage.setItem('qf_result', JSON.stringify({ answers: { clients: 1, tracking: 1, materials: 2, switching: 2, slips: 1, outstanding: 1 }, utm: window.qfAttribution(), pageUrl: location.origin + '/', at: Date.now() })));
    await submitPlanForm(p);
    s = await state(p);
    ok(s.queue.includes('track:Lead'), 'live, normal visit: the Lead event goes to the pixel');
    const l = leads[0] || {};
    ok(leads.length === 1 && l.is_test === false && l.traffic_source === 'meta_ad' && l.traffic_source_label === 'קמפיין מטא' && l.utm_content === 'ad7', `lead: not a test, source meta_ad (${l.traffic_source})`);
    ok(/מקור: קמפיין מטא \/ c1 \/ ad7/.test(l.notes || '') && !/ליד בדיקה/.test(l.notes || ''), 'lead notes show the real source');

    // מצב בדיקה באותו מכשיר
    const before = fb.length;
    await p.evaluate(() => sessionStorage.clear());
    await p.goto(BASE + '/?test=1', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
    s = await state(p);
    ok(s.test === true && s.fbq === 'undefined' && s.badge, 'live + ?test=1: no pixel, badge shown');
    await p.goto(BASE + '/thank-you.html', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(500);
    s = await state(p);
    ok(s.test === true && s.fbq === 'undefined', 'test mode stays on in other pages without the parameter');
    await submitPlanForm(p);
    s = await state(p);
    const t = leads[1] || {};
    ok(s.test === true && s.fbq === 'undefined', 'results page in test mode: no pixel');
    ok(fb.length === before, `no request to Meta at all in test mode (${fb.length - before})`);
    ok(leads.length === 2 && t.is_test === true && t.traffic_source === 'test' && t.traffic_source_label === 'בדיקה' && /^ליד בדיקה/.test(t.notes || ''), 'test lead still goes to Gware, marked as a test');
    const badgeBox = await p.evaluate(() => { const r = document.getElementById('qfTestBadge').getBoundingClientRect(); return { w: r.width, h: r.height, pe: getComputedStyle(document.getElementById('qfTestBadge')).pointerEvents }; });
    ok(badgeBox.w < 260 && badgeBox.h < 40 && badgeBox.pe === 'none', `the badge is small and does not catch taps (${Math.round(badgeBox.w)}×${Math.round(badgeBox.h)})`);

    await p.goto(BASE + '/?test=0', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(600);
    s = await state(p);
    ok(s.test === false && s.fbq === 'function' && !s.badge, '?test=0 turns test mode off');
    await ctx.close();
  }

  // ---------- 2. כתובת שאינה האתר החי ----------
  {
    const { ctx, fb } = await newCtx(b);
    const p = await ctx.newPage();
    await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(600);
    const s = await state(p);
    ok(s.test === true && s.fbq === 'undefined' && s.badge && fb.length === 0, 'not the live host (localhost / Vercel preview): test mode automatically');
    await ctx.close();
  }

  // ---------- 3. סיווג מקור התנועה ----------
  {
    const { ctx } = await newCtx(b, { asLive: true });
    const p = await ctx.newPage();
    const cases = [
      ['/?utm_source=facebook&utm_medium=paid', null, 'meta_ad'],
      ['/?utm_source=ig', null, 'meta_ad'],
      ['/?fbclid=IwAR123', null, 'meta'],
      ['/', 'https://l.facebook.com/', 'meta'],
      ['/', 'https://l.instagram.com/', 'meta'],
      ['/', 'https://www.google.com/', 'referral'],
      ['/?utm_source=newsletter', null, 'utm'],
      ['/', null, 'direct'],
    ];
    for (const [path, referer, want] of cases) {
      await p.goto(BASE + path, { waitUntil: 'domcontentloaded', referer: referer || undefined });
      const a = await p.evaluate(() => window.qfAttribution());
      ok(a.traffic_source === want, `${path}${referer ? ' from ' + referer : ''} → ${a.traffic_source} (${a.traffic_source_label})`);
    }
    await ctx.close();
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message.split('\n')[0]); process.exit(2); });
