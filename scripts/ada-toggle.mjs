async function getCookies() {
  console.log('[Ada] SUPABASE_URL:', SUPABASE_URL ? SUPABASE_URL.substring(0,30) : 'UNDEFINED');
  console.log('[Ada] KEY:', SUPABASE_SERVICE_KEY ? 'OK' : 'UNDEFINED');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ada_ghl_session?id=eq.default&select=cookies`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const text = await res.text();
    console.log('[Ada] Supabase status:', res.status, 'body:', text.substring(0, 200));
    const data = JSON.parse(text);
    return data[0]?.cookies || [];
  } catch(e) {
    console.error('[Ada] fetch error:', e.message);
    return [];
  }
}
Ctrl+S → cierra → en CMD:

cd C:\ada-login && git add scripts\ada-toggle.mjs && git commit -m "fix: debug supabase fetch" && git push
el remplazo es al texto completo ! integra eso

import { chromium } from '@playwright/test';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const EMPLOYEE_ID = process.env.GHL_EMPLOYEE_ID;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const MODE = process.env.ADA_MODE;

async function getCookies() {
  console.log('[Ada] SUPABASE_URL:', SUPABASE_URL ? SUPABASE_URL.substring(0,30) : 'UNDEFINED');
  console.log('[Ada] KEY:', SUPABASE_SERVICE_KEY ? 'OK' : 'UNDEFINED');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ada_ghl_session?id=eq.default&select=cookies`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const text = await res.text();
    console.log('[Ada] Supabase status:', res.status, 'body:', text.substring(0, 200));
    const data = JSON.parse(text);
    return data[0]?.cookies || [];
  } catch(e) {
    console.error('[Ada] fetch error:', e.message);
    return [];
  }
}

async function saveCookies(cookies) {
  await fetch(`${SUPABASE_URL}/rest/v1/ada_ghl_session?id=eq.default`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookies, updated_at: new Date().toISOString() })
  });
}

async function main() {
  const savedCookies = await getCookies();
  if (!savedCookies.length) { console.error('[Ada] No hay cookies.'); process.exit(1); }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(savedCookies);
  const page = await context.newPage();

  await page.goto(`https://app.gohighlevel.com/v2/location/${LOCATION_ID}/ai-agents/conversation-ai?activeTab=employees`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const triggerSelector = `#agents-table-actions-${EMPLOYEE_ID}-trigger button`;
  console.log('[Ada] Esperando tabla de agentes...');
  await page.waitForSelector(triggerSelector, { timeout: 30000 });
  console.log('[Ada] Ada encontrada. Iniciando toggle...');

  await page.evaluate((sel) => { document.querySelector(sel).click(); }, triggerSelector);
  await page.waitForTimeout(1500);

  await page.waitForSelector('.hr-dropdown-option-title', { timeout: 5000 });
  await page.evaluate(() => {
    document.querySelectorAll('.hr-dropdown-option-title').forEach(el => { if (el.textContent.trim() === 'Editar') el.click(); });
  });
  await page.waitForTimeout(3000);

  await page.waitForSelector('.hr-base-selection-input__content', { timeout: 10000 });
  await page.evaluate(() => {
    document.querySelectorAll('.hr-base-selection-input__content').forEach(el => { if (['Off','Suggestive','Auto-Pilot'].includes(el.textContent.trim())) el.parentElement.click(); });
  });
  await page.waitForTimeout(1500);

  await page.waitForSelector('.hr-select-option-label', { timeout: 5000 });
  await page.evaluate((MODE) => {
    document.querySelectorAll('.hr-select-option-label').forEach(el => { if (el.textContent.trim() === MODE) { el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); el.click(); } });
  }, MODE);
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(el => { if (el.textContent.trim() === 'Guardar') el.click(); });
  });
  await page.waitForTimeout(3000);

  const cookies = await context.cookies();
  await saveCookies(cookies);
  await browser.close();

  console.log(`[Ada] ✅ Modo cambiado a: ${MODE}`);
}

main().catch(e => { console.error(e); process.exit(1); });