// בדיקת עשן לנייד (מגע אמיתי, Chromium): "בחר שעה" גולל ליומן, הדף לא ננעל, אין שכבה צפה על כל המסך, לחיצה בתוך היומן עובדת.
// לא מחליפה בדיקה באייפון אמיתי (WebKit) — ראו README. הרצה: מתוך התיקייה, אחרי python3 -m http.server 8531:
//   PLAYWRIGHT=/נתיב/ל/node_modules/playwright node tests/mobile-smoke.js
const { chromium, devices } = require(process.env.PLAYWRIGHT || 'playwright');
const OUT = process.env.OUT || require('os').tmpdir() + '/yitra0-smoke';
const BASE = process.env.BASE || 'http://localhost:8531';
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'he-IL' });
  await ctx.addInitScript(() => {
    window.__ev = [];
    const t = setInterval(() => { if (window.qfTrack && !window.qfTrack.__spy) { const o = window.qfTrack; window.qfTrack = function (n, p, s) { window.__ev.push(n + ':' + JSON.stringify(p || {})); return o(n, p, s); }; window.qfTrack.__spy = 1; clearInterval(t); } }, 20);
    if (location.pathname.endsWith('results.html')) {
      sessionStorage.setItem('qf_result', JSON.stringify({ name: 'בדיקה', fullName: 'בדיקה מקומית', phone: '0500000003', submissionId: 'smoke-0000-0000',
        result: { clients: 55, fee: 750, trackingHours: 9.2, materialsHours: 20.2, slipsHours: 1.5, slips: 1.5, hours: 31, saved: 22, savedYear: 264, extraClients: 7, perClient: 3, hourValue: 250, yearly: 66000, monthlyValue: 5500, deadlines: 83, outstanding: 20000, biggest: 'materials', taxRisk: false }, at: Date.now() }));
    }
  });
  /* בדיקה לא שולחת אירועים לפיקסל או ל-GA (גם כשבודקים את האתר החי) */
  await ctx.route(/facebook\.(com|net)|googletagmanager|google-analytics/, r => r.abort());
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  /* שגיאות של בקשות פיקסל/GA שהבדיקה עצמה חוסמת — לא נספרות */
  page.on('console', m => { if (m.type() === 'error' && !/facebook|googletagmanager|google-analytics/.test((m.location() || {}).url || '')) errors.push(m.text()); });
  const swipe = (dy, y = 600) => cdp.send('Input.synthesizeScrollGesture', { x: 200, y, yDistance: dy, gestureSourceType: 'touch', speed: 900 });

  await page.goto(BASE + '/results.html?smoke=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const e = document.querySelector('cal-inline'); return e && e.getAttribute('loading') === 'done'; }, null, { timeout: 30000 });
  await page.waitForTimeout(1000);

  // 1. כפתור "השלב הבא" — גלילה ליומן
  await page.tap('[data-book="hero"]');
  await page.waitForTimeout(1500);
  let st = await page.evaluate(() => ({ y: scrollY, calTop: Math.round(document.getElementById('calendar').getBoundingClientRect().top), htmlOverflow: getComputedStyle(document.documentElement).overflow, ev: window.__ev, fixed: [...document.querySelectorAll('*')].filter(e => getComputedStyle(e).position === 'fixed' && e.offsetWidth > innerWidth * .9 && e.offsetHeight > innerHeight * .9).map(e => e.id || e.className) }));
  await page.screenshot({ path: OUT + '/smoke-1-after-tap.png' });
  ok(st.y > 300 && st.calTop > 40 && st.calTop < 140, `hero tap scrolls to the calendar (scrollY ${Math.round(st.y)}, calendar top ${st.calTop}px)`);
  ok(st.htmlOverflow !== 'hidden', 'page is not scroll-locked');
  ok(st.fixed.length === 0, `no full-screen fixed layer (${JSON.stringify(st.fixed)})`);
  ok(st.ev.some(e => e.startsWith('CalendarOpen:{"source":"hero"}')), 'CalendarOpen tracked with source=hero');

  // 2. לחיצה על יום בתוך היומן (iframe) — מציג שעות
  const frame = page.frameLocator('#calBox iframe');
  const day = frame.locator('button[data-testid="day"]:not([disabled])').first();
  await day.scrollIntoViewIfNeeded();
  await day.tap();
  await page.waitForTimeout(2500);
  const slots = await frame.locator('[data-testid="time"]').count();
  ok(slots > 0, `tapping a day inside the calendar shows time slots (${slots})`);
  // אחרי בחירת יום Cal.com גולל לשעות ואחר כך לראש היומן — השעה הראשונה חייבת להישאר על המסך
  await page.waitForTimeout(6000);
  const slotBox = await frame.locator('[data-testid="time"]').first().boundingBox().catch(() => null);
  const vh = await page.evaluate(() => innerHeight);
  ok(!!slotBox && slotBox.y >= 0 && slotBox.y + slotBox.height <= vh, `after picking a day the first time slot stays on screen (y=${slotBox ? Math.round(slotBox.y) : 'none'} of ${vh})`);
  await page.screenshot({ path: OUT + '/smoke-2-after-day.png' });

  // 3. גלילה באצבע מעל היומן ומחוצה לו
  // אחרי בחירת יום Cal.com גולל את הדף בעצמו אל השעות — מחכים שהדף יתייצב, כדי לא לערבב את הגלילה שלו עם המחווה
  let prevY = -1;
  for (let k = 0; k < 20; k++) { const yy = await page.evaluate(() => scrollY); if (yy === prevY) break; prevY = yy; await page.waitForTimeout(500); }
  const y0 = await page.evaluate(() => scrollY);
  await swipe(-500, 500); await page.waitForTimeout(700);
  const y1 = await page.evaluate(() => scrollY);
  ok(y1 > y0 + 100, `finger swipe over the calendar scrolls the page (${Math.round(y0)} -> ${Math.round(y1)})`);
  await swipe(2500, 300); await page.waitForTimeout(900);
  const y2 = await page.evaluate(() => scrollY);
  ok(y2 < y1, `swipe back up works (${Math.round(y1)} -> ${Math.round(y2)})`);

  // 4. הסרגל הדביק (מופיע כשהכותרת והיומן מחוץ למסך) — גם הוא גולל ליומן
  await page.evaluate(() => window.scrollTo(0, document.getElementById('offer').getBoundingClientRect().top + scrollY));
  await page.waitForTimeout(900);
  const stickyShown = await page.evaluate(() => document.getElementById('sticky').classList.contains('show'));
  if (stickyShown) {
    await page.tap('#sticky [data-book="sticky"]');
    await page.waitForTimeout(1500);
    const top = await page.evaluate(() => Math.round(document.getElementById('calendar').getBoundingClientRect().top));
    ok(top > 40 && top < 140, `sticky button scrolls back to the calendar (top ${top}px)`);
  } else ok(false, 'sticky bar did not show on the offer section');

  // 5. שלב הטופס: יום אחרון + שעה אחרונה (רחוקים — Cal.com "מחזיק" שעה שנבחרה כמה דקות, לא לגעת בשעות קרובות)
  //    הטופס צריך להופיע מתחת לכותרת הקבועה, בלי שטח ריק סביבו (בעבר: הטופס ריחף בתוך תיבה של 720px)
  await page.evaluate(() => { const c = document.getElementById('calendar'); window.scrollTo(0, c.getBoundingClientRect().top + scrollY - 84); });
  await page.waitForTimeout(800);
  const lastDay = frame.locator('button[data-testid="day"]:not([disabled])').last();
  await lastDay.scrollIntoViewIfNeeded(); await lastDay.tap(); await page.waitForTimeout(4000);
  const lastSlot = frame.locator('[data-testid="time"]:not([disabled])').last();
  await lastSlot.scrollIntoViewIfNeeded(); await lastSlot.tap(); await page.waitForTimeout(4000);
  const lay = await page.evaluate(() => { const box = document.getElementById('calBox').getBoundingClientRect(), f = document.querySelector('#calBox iframe').getBoundingClientRect(); return { boxH: Math.round(box.height), frameTop: Math.round(f.top), frameH: Math.round(f.height), header: Math.round(document.getElementById('siteHeader').getBoundingClientRect().bottom) }; });
  const formCount = await frame.locator('form input[name="email"], form [name="email"]').count().catch(() => 0);
  ok(formCount > 0, 'picking a time opens the booking form');
  ok(lay.boxH - lay.frameH < 40, `no empty space around the form (box ${lay.boxH}px, form frame ${lay.frameH}px)`);
  ok(lay.frameTop >= lay.header - 2 && lay.frameTop < 200, `the form starts below the fixed header (frame top ${lay.frameTop}px, header bottom ${lay.header}px)`);
  await page.screenshot({ path: OUT + '/smoke-3-form.png' });

  ok(errors.length === 0, `no page/console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message.split('\n')[0]); process.exit(2); });
