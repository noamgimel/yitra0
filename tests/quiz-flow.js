// בדיקת המסלול החדש בנייד (Chromium, מגע): דף נחיתה ← שאלון ← דף התוצאות (מספרים בטווח, תוכנית נעולה)
// ← טופס (בתוכנית או במקום היומן) ← תוכנית פתוחה + יומן עם המילוי המוקדם. וגם: קישור עם קוד תשובות, עם ובלי מזהה ליד,
// וכניסה ישירה בלי שאלון. לא שולחת כלום לפיקסל או ל-Gware (הבקשות נחסמות או מדומות).
// הרצה: מתוך התיקייה, אחרי python3 -m http.server 8531:
//   PLAYWRIGHT=/נתיב/ל/node_modules/playwright node tests/quiz-flow.js      (BASE= לכתובת אחרת)
const { chromium, devices } = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8531';
const OUT = process.env.OUT || require('os').tmpdir() + '/yitra0-flow';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ANSWERS = { clients: 1, tracking: 1, materials: 2, switching: 2, slips: 1, outstanding: 1 };   // 30–80 · אקסל · סיוט · 3–5 ש׳ · 1–2 · 10–30K

async function newCtx(b, device = 'Pixel 7', seed = null) {
  const ctx = await b.newContext({ ...devices[device], locale: 'he-IL' });
  await ctx.route(/facebook\.(com|net)|googletagmanager|google-analytics/, r => r.abort());
  const leads = [];
  await ctx.route(/receiveWebsiteLead|receiveMeetingBooked/, r => {
    if (/receiveWebsiteLead/.test(r.request().url())) { try { leads.push(JSON.parse(r.request().postData() || '{}')); } catch (e) {} }
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"success":true,"duplicate":false}' });
  });
  await ctx.addInitScript((seed) => {
    window.__ev = [];
    const t = setInterval(() => { if (window.qfTrack && !window.qfTrack.__s) { const o = window.qfTrack; window.qfTrack = function (n, p, s) { window.__ev.push(n + JSON.stringify(p || {})); return o(n, p, s); }; window.qfTrack.__s = 1; clearInterval(t); } }, 10);
    if (seed && location.pathname.endsWith('results.html') && !sessionStorage.getItem('qf_result')) sessionStorage.setItem('qf_result', JSON.stringify(seed));
  }, seed);
  return { ctx, leads };
}
function watch(page, errors) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/facebook|googletagmanager|google-analytics/.test((m.location() || {}).url || '')) errors.push(m.text()); });
}
const ev = (p) => p.evaluate(() => window.__ev || []);
const calMounted = (p) => p.evaluate(() => { const f = document.querySelector('#calBox iframe'); return f ? f.src : ''; });
async function waitCalDone(p, ms = 30000) {
  return p.waitForFunction(() => { const e = document.querySelector('cal-inline'); return e && e.getAttribute('loading') === 'done'; }, null, { timeout: ms }).then(() => true, () => false);
}

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();

  // ---------- 1. דף הנחיתה: הכפתור במסך הראשון, גם באייפון קטן (375×667) ----------
  //    (ב-iPhone SE הראשון, 320×568 מ-2016, הכפתור מתחת למסך הראשון גם בגרסה שהייתה באוויר עד 14/10 — לא נבדק)
  for (const dev of ['iPhone 8', 'Pixel 7']) {
    const { ctx } = await newCtx(b, dev);
    const p = await ctx.newPage();
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => { const btn = document.querySelector('#heroCta .btn').getBoundingClientRect(); return { bottom: Math.round(btn.bottom), vh: innerHeight, h1: document.querySelector('.hero h1').textContent }; });
    ok(r.bottom <= r.vh, `${dev}: the start button is on the first screen (bottom ${r.bottom} of ${r.vh})`);
    ok(/כמה שעות בחודש אפשר להוריד ממך במשרד\?/.test(r.h1) && /לרואי חשבון · בדיקה של דקה/.test(r.h1), `${dev}: new headline and top line`);
    await p.screenshot({ path: `${OUT}/1-landing-${dev.replace(' ', '')}.png` });
    await ctx.close();
  }

  // ---------- 2. השאלון ← דף התוצאות ← הטופס בתוכנית ----------
  {
    const { ctx, leads } = await newCtx(b);
    const p = await ctx.newPage(); const errors = []; watch(p, errors);
    await p.goto(BASE + '/?utm_source=test&utm_campaign=flow', { waitUntil: 'domcontentloaded' });
    await p.tap('#heroCta .btn');
    await p.waitForSelector('#quiz.open');
    const hint = await p.textContent('.screen.active .q-hint');
    ok(/עסקים ושכירים/.test(hint || ''), 'each question has a hint line under it');
    const order = ['clients', 'tracking', 'materials', 'switching', 'slips', 'outstanding'];
    for (let i = 0; i < 6; i++) {
      await p.waitForSelector(`.screen.active .opt[data-q="${i}"]`);
      if (i === 4) ok(/כמה פעמים בחודש משהו נופל לך בין הכיסאות\?/.test(await p.textContent('.screen.active .q-title')) && /דיווח שנשכח, תשלום שהתפספס/.test(await p.textContent('.screen.active .q-hint')), 'question 5 wording and hint');
      await p.tap(`.screen.active .opt[data-o="${ANSWERS[order[i]]}"]`);
      await p.waitForTimeout(450);
    }
    await p.waitForURL(/results\.html/, { timeout: 10000 });
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${OUT}/2-results-top.png` });
    const top = await p.evaluate(() => ({
      h1: document.getElementById('resH1').textContent, gut: document.getElementById('gutPunch').textContent,
      stats: [...document.querySelectorAll('.stat-val')].map(e => e.textContent.replace(/[⁦⁩]/g, '')),
      days: document.getElementById('daysNote').textContent, extra: document.getElementById('extraNote').textContent,
      locked: document.getElementById('plan').classList.contains('locked'),
      cards: [...document.querySelectorAll('.plan-card')].map(c => c.dataset.solution),
      more: [...document.querySelectorAll('#planMoreList li b')].map(e => e.textContent),
      baseHidden: document.getElementById('planBase').hidden,
      blur: getComputedStyle(document.querySelector('.pc-body')).filter,
      gated: document.getElementById('calendar').classList.contains('gated'), gate: !document.getElementById('calGate').hidden,
      cal: !!document.querySelector('cal-inline'),
    }));
    ok(/20–36/.test(top.h1.replace(/[⁦⁩]/g, '')) && /36,000/.test(top.h1), `headline shows the range and "at least" value (${top.h1.replace(/[⁦⁩]/g, '')})`);
    ok(top.stats[0] === '20–36' && /לפחות\s*₪36,000/.test(top.stats[1]) && top.stats[2] === '83' && /כ-₪20,000/.test(top.stats[3]), `stats: ${JSON.stringify(top.stats)}`);
    ok(/3\.5 ימי עבודה/.test(top.days) && /4 לקוחות/.test(top.extra), `notes under the numbers ("${top.days}" / "${top.extra}")`);
    ok(top.locked && /blur/.test(top.blur), 'plan is locked and blurred before the form');
    ok(JSON.stringify(top.cards) === '["base","materials"]', `two full cards by hours: ${JSON.stringify(top.cards)}`);
    ok(JSON.stringify(top.more) === '["לוח דיווחים שמתמלא לבד.","שום פולואפ לא נופל.","שכר טרחה שנגבה בזמן."]', `the rest in one line each: ${JSON.stringify(top.more)}`);
    ok(top.baseHidden, 'base line hidden when the base is a full card');
    ok(top.gated && top.gate && !top.cal, 'calendar is behind the form (no Cal.com embed yet)');
    await p.click('#howCalc summary');
    const hc = await p.textContent('#howCalcBody');
    ok(/55 לקוחות/.test(hc) && /150/.test(hc) && /לפחות/.test(hc), '"how we calculated" opens with the assumptions');

    // "בחר שעה" כשנעול ← גלילה לטופס שבמקום היומן
    await p.tap('[data-book="hero"]');
    await p.waitForTimeout(1500);
    const g = await p.evaluate(() => ({ top: Math.round(document.getElementById('calendar').getBoundingClientRect().top) }));
    ok(g.top > 40 && g.top < 160, `"choose a time" scrolls to the form in the calendar spot (top ${g.top})`);
    await p.screenshot({ path: `${OUT}/3-calendar-gate.png` });

    // הטופס בתוכנית
    await p.evaluate(() => document.getElementById('planUnlock').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/4-plan-locked.png` });
    await p.tap('#pName'); await p.fill('#pName', 'דנה בדיקה'); await p.fill('#pPhone', '050-1234567');
    await p.tap('#planUnlock button[type="submit"]');
    await p.waitForTimeout(1800);
    const after = await p.evaluate(() => ({
      locked: document.getElementById('plan').classList.contains('locked'), blur: getComputedStyle(document.querySelector('.pc-body')).filter,
      firstTop: Math.round(document.querySelector('.plan-card').getBoundingClientRect().top), sub: document.getElementById('planSub').textContent,
      gut: document.getElementById('gutPunch').textContent, gate: !document.getElementById('calGate').hidden,
      saved: JSON.parse(sessionStorage.getItem('qf_result') || '{}'),
    }));
    ok(!after.locked && after.blur === 'none', 'the form unlocks the full plan on the page');
    ok(after.firstTop > 40 && after.firstTop < 200, `after unlocking, the page scrolls to the first card (top ${after.firstTop})`);
    ok(/^דנה, /.test(after.sub) && /^דנה, /.test(after.gut), 'first name appears after unlocking');
    ok(!after.gate, 'the calendar form is gone too');
    const lead = leads[0] || {};
    ok(leads.length === 1, `one lead sent to Gware (${leads.length})`);
    ok(lead.lead_form === 'plan' && lead.quiz_completed === true && lead.utm_source === 'test' && lead.utm_campaign === 'flow', `lead source fields (${lead.lead_form}, ${lead.utm_source}/${lead.utm_campaign})`);
    ok(lead.hours_saved_range === '20–36' && lead.hours_saved_per_month === 20 && lead.yearly_value === 36000 && lead.hour_value === 150, 'lead numbers (range, at least, hour value)');
    ok(JSON.stringify(lead.plan) === '["base","materials","tracking","slips","cashflow"]' && lead.plan_labels && lead.plan_labels[0] === 'תיק לקוחות אחד במקום אקסל', `lead plan ${JSON.stringify(lead.plan)}`);
    ok(lead.plan_code === '3112211-' + after.saved.submissionId && lead.submission_id === after.saved.submissionId, `plan code carries the answers and the lead id (${lead.plan_code})`);
    ok(/3 עד 5 שעות/.test(lead.q4_answer || '') && /פעם-פעמיים/.test(lead.q5_answer || '') && /10,000/.test(lead.q6_answer || ''), 'question answers in the lead');
    ok(lead.phone_intl === '972501234567' && lead.form_id && lead.secret_key && /התוכנית: 1\. תיק לקוחות/.test(lead.notes || ''), 'phone, auth and readable notes');
    ok(/\/$/.test(lead.page_url || ''), `page_url is the landing page (${lead.page_url})`);
    const e1 = await ev(p);
    for (const n of ['PlanView', 'LeadFormStart', 'Lead', 'CalendarOpen', 'HowCalculated']) ok(e1.some(x => x.startsWith(n)), `event ${n}`);
    const src = await p.waitForFunction(() => { const f = document.querySelector('#calBox iframe'); return f && f.src; }, null, { timeout: 15000 }).then(h => h.jsonValue(), () => '');
    ok(/name=%D7%93%D7%A0%D7%94/.test(src) && /phone=%2B972501234567/.test(src) && new RegExp('metadata%5Bsubmission_id%5D=' + after.saved.submissionId).test(src), 'calendar mounted with name, phone and lead id');
    const y0 = await p.evaluate(() => scrollY);
    const done = await waitCalDone(p);
    await p.waitForTimeout(1500);
    const y1 = await p.evaluate(() => scrollY);
    ok(done, 'calendar loaded');
    ok(Math.abs(y1 - y0) < 50, `loading the calendar below does not move the page (${Math.round(y0)} -> ${Math.round(y1)})`);
    await p.screenshot({ path: `${OUT}/5-plan-open.png` });
    await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => !document.getElementById('plan').classList.contains('locked') && !!document.querySelector('cal-inline')), 'after a refresh the plan and calendar stay open');
    ok(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
    await ctx.close();
  }

  // ---------- 3. הטופס במקום היומן ----------
  {
    const { ctx, leads } = await newCtx(b, 'Pixel 7', { answers: ANSWERS, utm: { utm_source: 'test' }, pageUrl: BASE + '/', at: Date.now() });
    const p = await ctx.newPage(); const errors = []; watch(p, errors);
    await p.goto(BASE + '/results.html', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    await p.tap('[data-book="hero"]'); await p.waitForTimeout(1500);
    await p.tap('#cName'); await p.fill('#cName', 'יוסי'); await p.fill('#cPhone', '0521234567');
    const before = await p.evaluate(() => Math.round(document.getElementById('calendar').getBoundingClientRect().top));
    await p.tap('#calGate button[type="submit"]');
    await p.waitForTimeout(600);
    const st = await p.evaluate(() => ({ top: Math.round(document.getElementById('calendar').getBoundingClientRect().top), locked: document.getElementById('plan').classList.contains('locked'), cal: !!document.querySelector('cal-inline') }));
    ok(!st.locked && st.cal, 'the calendar form unlocks the plan and mounts the calendar');
    ok(Math.abs(st.top - before) < 30, `the calendar stays in place although the plan above opened (${before} -> ${st.top})`);
    ok(leads.length === 1 && leads[0].lead_form === 'calendar' && /0521234567/.test(leads[0].phone), 'lead sent with lead_form=calendar');
    ok(await waitCalDone(p), 'calendar loaded after the form');
    await p.screenshot({ path: `${OUT}/6-calendar-open.png` });
    ok(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
    await ctx.close();
  }

  // ---------- 4. קישור עם קוד ומזהה ליד (כמו מהוואטסאפ) ----------
  {
    const { ctx, leads } = await newCtx(b);
    const p = await ctx.newPage(); const errors = []; watch(p, errors);
    await p.goto(BASE + '/results.html?c=3222222-link_test-123', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    const st = await p.evaluate(() => ({ url: location.search, sid: sessionStorage.getItem('qf_link_sid'), locked: document.getElementById('plan').classList.contains('locked'), first: (document.querySelector('.plan-card') || {}).dataset.solution }));
    ok(st.url === '?c=3222222' && st.sid === 'link_test-123', `the lead id is removed from the address before the pixel (${st.url})`);
    ok(!st.locked && st.first === 'cashflow', `a link with a lead id opens the plan (first: ${st.first})`);
    const src = await p.waitForFunction(() => { const f = document.querySelector('#calBox iframe'); return f && f.src; }, null, { timeout: 15000 }).then(h => h.jsonValue(), () => '');
    ok(/metadata%5Bsubmission_id%5D=link_test-123/.test(src), 'calendar from the link carries the lead id');
    ok(leads.length === 0, 'opening a link sends no lead');
    ok(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
    await ctx.close();
  }

  // ---------- 5. קישור בלי מזהה, תוכנית של פתרון אחד ----------
  {
    const { ctx } = await newCtx(b);
    const p = await ctx.newPage(); const errors = []; watch(p, errors);
    await p.goto(BASE + '/results.html?c=3000010', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    const st = await p.evaluate(() => ({ locked: document.getElementById('plan').classList.contains('locked'), cards: document.querySelectorAll('.plan-card').length, title: document.getElementById('planTitle').textContent, base: !document.getElementById('planBase').hidden, h1: document.getElementById('resH1').textContent.replace(/[⁦⁩]/g, '') }));
    ok(st.locked && st.cards === 1 && /הצעד/.test(st.title) && st.base, `one-solution plan: locked, one card, base line (${st.h1})`);
    ok(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
    await ctx.close();
  }

  // ---------- 6. כניסה ישירה, בלי שאלון ----------
  {
    const { ctx, leads } = await newCtx(b);
    const p = await ctx.newPage(); const errors = []; watch(p, errors);
    await p.goto(BASE + '/results.html', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    const st = await p.evaluate(() => ({ noData: getComputedStyle(document.getElementById('noData')).display !== 'none', quiz: !!document.querySelector('.plan-quiz'), unlockHidden: document.getElementById('planUnlock').hidden, gate: !document.getElementById('calGate').hidden }));
    ok(st.noData && st.quiz && st.unlockHidden && st.gate, 'no answers: sample numbers, an invitation to the quiz, and the form before the calendar');
    await p.fill('#cName', 'ללא שאלון'); await p.fill('#cPhone', '0541112233');
    await p.click('#calGate button[type="submit"]'); await p.waitForTimeout(800);
    ok(leads.length === 1 && leads[0].quiz_completed === false && !leads[0].plan, 'lead without a quiz is marked quiz_completed=false');
    ok(await p.evaluate(() => !!document.querySelector('cal-inline')), 'and the calendar opens');
    ok(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
    await ctx.close();
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message.split('\n')[0]); process.exit(2); });
