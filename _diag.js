const fs = require('fs');
const http = require('http');

const APP = 'file:///C:/Users/TECH%20FAZ/Desktop/New%20folder%20(2)/app_fixed.html';
const PORT = 9333;

function get(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }).on('error', rej);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let targets = null;
  for (let i = 0; i < 60; i++) {
    try { targets = JSON.parse(await get(`http://127.0.0.1:${PORT}/json`)); break; } catch (e) { await sleep(500); }
  }
  if (!targets) { console.log('NO_TARGET'); process.exit(1); }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];
  const logs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push({ text: (d.exception && d.exception.description) || d.text, line: d.lineNumber, url: (d.url||'') });
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      if (m.params.type === 'error' || m.params.type === 'warning') {
        logs.push({ type: m.params.type, args: m.params.args.map(a => a.value !== undefined ? a.value : (a.description||'')).join(' ') });
      }
    }
  };
  const send = (method, params) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');

  async function ev(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { __ex: (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text };
    return r.result && r.result.result ? r.result.result.value : null;
  }

  // wait for app boot
  for (let i = 0; i < 40; i++) {
    const ok = await ev('typeof BusinessLogic === "object" && typeof accounts !== "undefined"');
    if (ok === true) break;
    await sleep(500);
  }

  const boot = await ev(`(() => { try {
      return { ready: document.readyState, accounts: (typeof accounts!=='undefined')?accounts.length:-1,
               tx: (typeof transactions!=='undefined')?transactions.length:-1,
               prods: (typeof products!=='undefined')?products.length:-1 };
  } catch(e){ return {err:e.message}; } })()`);
  console.log('BOOT', JSON.stringify(boot));

  // ---- Seed cross-module data through the app's own APIs ----
  const seed = await ev(`(async () => {
    const out = { steps: [] };
    const step = (n, f) => { try { const r = f(); out.steps.push([n, r]); } catch(e) { out.steps.push([n, 'THROW: ' + e.message + ' | ' + (e.stack||'').split('\\n')[1]]); } };
    try {
      accounts.length = 0; transactions.length = 0; products.length = 0; installments.length = 0;
      arabonSales.length = 0; merchants.length = 0; partners.length = 0; stockMovements.length = 0;
      merchantSales.length = 0; merchantPurchases.length = 0; merchantPayments.length = 0; merchantPaymentsOut.length = 0;
      employees.length = 0;

      step('addAccount-cash', () => { accounts.push({id:101,name:'خزينة',type:'cash',balance:5000,createdAt:new Date().toISOString()}); return 'ok'; });
      step('addAccount-bank', () => { accounts.push({id:102,name:'بنك مصر',type:'bank',balance:10000,accountNumber:'123',createdAt:new Date().toISOString()}); return 'ok'; });
      step('addAccount-vodafone', () => { accounts.push({id:103,name:'فودافون',type:'vodafone',balance:500,createdAt:new Date().toISOString()}); return 'ok'; });
      step('addMerchant', () => { merchants.push({id:201,name:'عميل أحمد'}); return 'ok'; });
      step('addProduct', () => { products.push({id:301,name:'موبايل',costPrice:1000,sellPrice:1500,stock:10}); stockMovements.push({id:1,productId:301,type:'in',qty:10,sourceType:'manual',sourceId:'seed',date:new Date().toISOString()}); return 'ok'; });

      step('sellCash-bank', () => JSON.stringify(BusinessLogic.sellCash({productId:301, qty:1, accountId:102})));
      step('transfer', () => JSON.stringify(BusinessLogic.transferBetweenAccounts({fromAccountId:102,toAccountId:101,amount:500,date:new Date().toISOString()})));
      step('addIncome', () => JSON.stringify(BusinessLogic.addIncome({amount:300, accountId:102, category:'ايراد', notes:'x', date:new Date().toISOString()})));
      step('addExpense', () => JSON.stringify(BusinessLogic.addExpense({amount:200, accountId:102, category:'مصاريف', notes:'x', date:new Date().toISOString()})));
      step('purchaseStock', () => JSON.stringify(BusinessLogic.purchaseStock({productId:301, qty:2, costPrice:900, accountId:101})));
      step('createInstallment', () => JSON.stringify(BusinessLogic.createInstallment({merchantId:201, productId:301, purchasePrice:3000, paidUpfront:500, interestRate:10, months:6, accountId:102})));
      step('createArabon', () => JSON.stringify(BusinessLogic.createArabon({merchantId:201, productId:301, sellPrice:2000, depositAmount:500, accountId:101, remainingPaymentMethod:'cash'})));
      step('partnerTransaction', () => JSON.stringify(BusinessLogic.partnerTransaction({partnerId:0, type:'partner_deposit', amount:0, cashAmount:0, bankAmount:0})));
      step('sellToMerchant', () => JSON.stringify(BusinessLogic.sellToMerchant ? BusinessLogic.sellToMerchant({merchantId:201, productId:301, qty:1, sellPrice:1400, accountId:102}) : 'n/a'));
    } catch(e) { out.fatal = e.message + ' | ' + e.stack; }
    return out;
  })()`);
  console.log('SEED', JSON.stringify(seed, null, 1));

  // ---- Run health checks ----
  const checks = await ev(`(() => { try { SHC.runAllChecks(); return { issues: SHC.issues.length, score: SHC.getScore(), modules: SHC.modules }; } catch(e){ return {err:e.message, stack:e.stack}; } })()`);
  console.log('CHECKS', JSON.stringify(checks, null, 1));

  const issueList = await ev(`SHC.issues.map(i => ({mod:i.module, sev:i.severity, t:i.title, d:i.description, id:i.checkId}))`);
  console.log('ISSUES', JSON.stringify(issueList, null, 1));

  // ---- Render all modules to catch render errors ----
  const renders = await ev(`(() => {
    const fns = ['renderDashboard','renderProducts','renderTransactions','renderInstallments','renderArabonSales','renderMerchantSales','renderPartners','renderAccounts','renderHealthCenter','refreshSelectors','renderGeneralStatement','renderStockMovements','renderEmployees','renderRecurring','renderExpenseCategories','renderIncomeCategories','renderAdminPage','renderCommandCenter','renderDailySummary'];
    return fns.map(f => { try { if (typeof window[f] === 'function') { window[f](); return f+': OK'; } return f+': MISSING'; } catch(e){ return f+': THROW ' + e.message; } });
  })()`);
  console.log('RENDERS', JSON.stringify(renders, null, 1));

  // ---- Click every nav page ----
  const navs = await ev(`(() => {
    const btns = [...document.querySelectorAll('.side-nav button[data-page]')];
    return btns.map(b => { try { b.click(); return b.getAttribute('data-page')+': OK'; } catch(e){ return b.getAttribute('data-page')+': THROW '+e.message; } });
  })()`);
  console.log('NAVS', JSON.stringify(navs, null, 1));

  console.log('ERRORS', JSON.stringify(errors, null, 1));
  console.log('CONSOLE', JSON.stringify(logs, null, 1));
  ws.close();
  process.exit(0);
})();
