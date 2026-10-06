import { chromium } from '@playwright/test';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const EMPLOYEE_ID = process.env.GHL_EMPLOYEE_ID;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const CRM_WEBHOOK = process.env.CRM_WEBHOOK_URL;

function getModoByHora() {
  const hora = new Date().toLocaleString('en-US', { timeZone: 'America/Santiago', hour: 'numeric', hour12: false });
  const h = parseInt(hora);
  console.log('[Ada] Hora Santiago:', h);
  return (h >= 20 || h < 10) ? 'Suggestive' : 'Off';
}

async function notificar(msg) {
  if (!CRM_WEBHOOK) return;
  try { await fetch(CRM_WEBHOOK, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ message: msg }) }); } catch(e) {}
}

async function getCookies() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ada_ghl_session?id=eq.default&select=cookies`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const data = await res.json();
    return data[0]?.cookies || [];
  } catch(e) { return []; }
}

async function saveCookies(cookies) {
  await fetch(`${SUPABASE_URL}/rest/v1/ada_ghl_session?id=eq.default`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookies, updated_at: new Date().toISOString() })
  });
}

async function main() {
  const MODE = process.env.ADA_MODE || getModoByHora();
  console.log('[Ada] Modo objetivo:', MODE);

  const savedCookies = await getCookies();
  if (!savedCookies.length) {
    await notificar('Ada Toggle: cookies de sesion vencidas. Corre ada-login.mjs en el PC local.');
    console.error('[Ada] Cookies vencidas — notificacion enviada.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(savedCookies);
  const page = await context.newPage();

  await page.goto(`https://app.gohighlevel.com/v2/location/${LOCATION_ID}/ai-agents/conversation-ai?activeTab=employees`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const triggerSelector = `#agents-table-actions-${EMPLOYEE_ID}-trigger button`;
  console.log('[Ada] Esperando tabla...');
  await page.waitForSelector(triggerSelector, { timeout: 30000 });

  const modoActual = await page.evaluate(() => {
    const cells = document.querySelector('.agents-table__name')?.closest('tr')?.querySelectorAll('td');
    return cells ? cells[2]?.textContent.trim() : '';
  });
  console.log('[Ada] Modo actual en tabla:', modoActual);

  const modoMap = { 'Suggestive': ['Sugerente','Suggestive'], 'Off': ['Apagado','Off'] };
  if (modoMap[MODE]?.some(v => modoActual.includes(v))) {
    console.log('[Ada] Ya esta en el modo correcto. Sin cambios.');
    const cookies = await context.cookies();
    await saveCookies(cookies);
    await browser.close();
    return;
  }

  await page.evaluate((sel) => { document.querySelector(sel).click(); }, triggerSelector);
  await page.waitForTimeout(1500);
  await page.waitForSelector('.hr-dropdown-option-title', { timeout: 5000 });
  await page.evaluate(() => { document.querySelectorAll('.hr-dropdown-option-title').forEach(el => { if (el.textContent.trim() === 'Editar') el.click(); }); });
  await page.waitForTimeout(3000);
  await page.waitForSelector('.hr-base-selection-input__content', { timeout: 10000 });
  await page.evaluate(() => { document.querySelectorAll('.hr-base-selection-input__content').forEach(el => { if (['Off','Suggestive','Auto-Pilot'].includes(el.textContent.trim())) el.parentElement.click(); }); });
  await page.waitForTimeout(1500);
  await page.waitForSelector('.hr-select-option-label', { timeout: 5000 });
  await page.evaluate((MODE) => { document.querySelectorAll('.hr-select-option-label').forEach(el => { if (el.textContent.trim() === MODE) { el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); el.click(); } }); }, MODE);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { document.querySelectorAll('button').forEach(el => { if (el.textContent.trim() === 'Guardar') el.click(); }); });
  await page.waitForTimeout(3000);

  const cookies = await context.cookies();
  await saveCookies(cookies);
  await browser.close();

  console.log(`[Ada] Modo cambiado a: ${MODE}`);
}

main().catch(async e => { await notificar('Ada Toggle error: ' + e.message); console.error(e); process.exit(1); });