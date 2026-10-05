import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';

const SUPABASE_URL = 'https://ztgluytncqnxlonwtbvq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Z2x1eXRuY3FueGxvbnd0YnZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE1NTM5NSwiZXhwIjoyMTAwNzMxMzk1fQ.6XQJWSzYv3B_m9tVV-BKILs3F1k8M_IVMFgp3o78qcY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('https://app.gohighlevel.com');
console.log('Inicia sesión manualmente en el navegador que se abrió...');
console.log('Cuando estés dentro del CRM, vuelve aquí y presiona Enter.');

process.stdin.resume();
process.stdin.once('data', async () => {
  const cookies = await context.cookies();
  await supabase.from('ada_ghl_session').upsert({
    id: 'default',
    cookies,
    updated_at: new Date().toISOString()
  });
  console.log('Cookies guardadas en Supabase. Login completado.');
  await browser.close();
  process.exit(0);
});