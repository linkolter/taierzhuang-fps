const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:4173');await page.locator('#start').waitFor();await page.locator('#start').click();await page.waitForTimeout(1000);
const result=await page.evaluate(()=>({locked:!!document.pointerLockElement,debugAbsent:!('__game' in window),health:document.querySelector('#health')?.textContent,menuHidden:document.querySelector('#menu')?.hidden}));
console.log(JSON.stringify({result,errors}));await browser.close();if(!result.locked||!result.debugAbsent||!result.menuHidden||errors.length)process.exit(1);
