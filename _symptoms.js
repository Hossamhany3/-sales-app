const http = require('http');
const PORT = 9333;
function get(url){return new Promise((res,rej)=>{http.get(url,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);});}
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  let targets=null;
  for(let i=0;i<40;i++){try{targets=JSON.parse(await get(`http://127.0.0.1:${PORT}/json`));break;}catch(e){await sleep(500);}}
  const page=targets.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0;const pending=new Map();
  const excs=[];
  ws.onmessage=ev=>{const m=JSON.parse(ev.data);
    if(m.method==='Runtime.exceptionThrown'){const d=m.params&&m.params.exceptionDetails;excs.push(((d&&d.exception&&d.exception.description)||(d&&d.text)||'').split('\n')[0]);}
    if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
  const send=(method,params)=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
  await new Promise(r=>ws.onopen=r);
  await send('Runtime.enable'); await send('Page.enable');
  async function ev(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});if(r.result&&r.result.exceptionDetails)return {__ex:(r.result.exceptionDetails.exception&&r.result.exceptionDetails.exception.description)||r.result.exceptionDetails.text};return r.result&&r.result.result?r.result.result.value:null;}
  async function reload(){await send('Page.navigate',{url:'file:///C:/Users/TECH%20FAZ/Desktop/New%20folder%20(2)/app_fixed.html'});await sleep(4000);}

  const pass=[], fail=[];
  const chk=(name,ok,info)=>{(ok?pass:fail).push(name+(info?' :: '+JSON.stringify(info):''));};

  await reload();

  // ═══ S1: numbers match across accounts & reports ═══
  const s1 = await ev(`(()=>{const L=BusinessLogic.liquidTotals();const by={cash:0,bank:0,vodafone:0};
    accounts.forEach(a=>{const k=a.type==='bank'?'bank':a.type==='vodafone'?'vodafone':'cash';by[k]+=BusinessLogic.accountBalance(a.id);});
    by.cash+=parseFloat(openingCapital)||0;
    const sumAccounts=accounts.reduce((s,a)=>s+BusinessLogic.accountBalance(a.id),0);
    const f=getFinancials();
    const stmt=(()=>{const r=buildGeneralStatementRows();const o=getDateRange().from?r.filter(x=>new Date(x.date)<getDateRange().from).reduce((s,x)=>s+(x.credit||0)-(x.debit||0),0):0;const d=r.reduce((s,x)=>s+(x.debit||0),0),c=r.reduce((s,x)=>s+(x.credit||0),0);return o+c-d;})();
    return {L,by,sumAccounts,openingCapital,fin:{cash:f.cash,bank:f.bank,vodafone:f.vodafone,liquid:f.liquid},summary:BusinessLogic.getBusinessSummary(),stmtLiquidity:getCashLiquidity(),stmtFinal:stmt,transTotal:BusinessLogic.openingLiquid()+transactions.reduce((s,t)=>s+(INCOME_TRANS_TYPES.includes(t.type)?t.amount:(EXPENSE_TRANS_TYPES.includes(t.type)?-t.amount:0)),0)};})()`);
  chk('S1.1 liquid == sum(accountBalance) + openingCapital', Math.abs(s1.L.total - (s1.sumAccounts + (s1.openingCapital||0))) < 0.01, {liquid:s1.L.total, sumAccounts:s1.sumAccounts, openingCapital:s1.openingCapital});
  chk('S1.2 per-type reports == accounts', Math.abs(s1.L.cash-s1.by.cash)<0.01 && Math.abs(s1.L.bank-s1.by.bank)<0.01 && Math.abs(s1.L.vodafone-s1.by.vodafone)<0.01, {L:s1.L, by:s1.by});
  chk('S1.3 getFinancials matches liquidTotals', s1.fin.cash===s1.L.cash && s1.fin.bank===s1.L.bank && s1.fin.vodafone===s1.L.vodafone && s1.fin.liquid===s1.L.total, {fin:s1.fin, L:s1.L});
  chk('S1.4 getBusinessSummary matches', s1.summary.totalCash===s1.L.cash && s1.summary.totalBank===s1.L.bank && s1.summary.totalVodafone===s1.L.vodafone, s1.summary);
  await ev(`switchPage('reports');`); await sleep(300);
  await ev(`switchReportTab('tabStatement'); renderGeneralStatement();`); await sleep(300);
  const LIQ = s1.L.total;
  const gen = await ev(`(()=>{const c=document.getElementById('statementContent');if(!c)return {missing:true};const txt=c.innerText;const m=txt.match(/الرصيد الصافي \\(([\\d.,-]+) ج\\) \\+ المبالغ المعلقة \\(([\\d.,-]+) ج\\) = السيولة النقدية \\(([\\d.,-]+) ج\\)/);const nums=m?[+m[1].replace(/,/g,''),+m[2].replace(/,/g,''),+m[3].replace(/,/g,'')]:null;return {hasBridge:!!m,ok:!!m&&Math.abs(nums[0]+nums[1]-nums[2])<0.01,green:txt.includes('✅'),nums,liquidityShown:txt.includes((${LIQ}).toFixed(2))}})()`);
  chk('S1.5 general statement reconciles to liquidity (bridge + green)', gen.ok===true && gen.green===true, gen);
  chk('S1.6 transactions page total == liquid', Math.abs(s1.transTotal - s1.L.total) < 0.01, {transTotal:s1.transTotal, liquid:s1.L.total});

  await ev(`switchPage('dashboard');`); await sleep(900);
  await ev(`renderDashboard();`);
  const dash = await ev(`({balLiquid:document.getElementById('balLiquid')?.innerText,balCash:document.getElementById('balCash')?.innerText,balBank:document.getElementById('balBank')?.innerText,balVodafone:document.getElementById('balVodafone')?.innerText,ccCash:document.getElementById('ccCash')?.innerText})`);
  chk('S1.7 dashboard balance rows filled', dash.balLiquid && parseFloat(dash.balLiquid)>=0 && parseFloat(dash.ccCash||'0')>0, dash);

  await ev(`switchPage('transactions');`); await sleep(600);
  const trans = await ev(`({cap:document.getElementById('transCapital')?.innerText,tot:document.getElementById('transTotal')?.innerText})`);
  chk('S1.8 transactions totals filled', trans.tot && parseFloat(String(trans.tot).replace(/[^\d.-]/g,''))>0, trans);

  // ═══ S2/S3: health center ═══
  const shc = await ev(`(()=>{try{SHC.runAllChecks();return {score:SHC.getScore(),issues:SHC.issues.map(i=>({m:i.module,c:i.checkId,s:i.severity}))}}catch(e){return {err:e.message}}})()`);
  const accIssues = (shc.issues||[]).filter(i=>i.c && i.c.startsWith('ACC_'));
  const arbIssues = (shc.issues||[]).filter(i=>i.c && i.c.startsWith('ARB_'));
  chk('S2 health-center has no ACC_* issues', accIssues.length===0, accIssues);
  chk('S3 health-center has no ARB_* issues', arbIssues.length===0, arbIssues);
  chk('S2b health-center score >= 90', (shc.score||0) >= 90, {score:shc.score, issues:shc.issues});

  // ═══ S4: account statement & balance update live ═══
  const before = await ev(`BusinessLogic.accountBalance(102)`);
  const posted = await ev(`(()=>{const t=BusinessLogic.postTransaction({type:'income',amount:123.45,accountId:102,notes:'اختبار التحديث المباشر',category:'ايراد',sourceType:'test',sourceId:'t1',operationType:'create',date:new Date().toISOString()});saveData();renderAccounts();renderDashboard();return !!t})()`);
  const after = await ev(`BusinessLogic.accountBalance(102)`);
  await ev(`document.getElementById('accountStatementOverlay')?.remove(); showAccountStatement(102);`);
  const stmtHas = await ev(`(()=>{const o=document.getElementById('accountStatementOverlay');const txt=o?o.innerText:'';return {has:txt.includes('123.45'),bal:(txt.match(/الرصيد الحالي\\s*([\\d,.-]+)/)||[])[1]||null}})()`);
  await ev(`document.getElementById('accountStatementOverlay')?.remove();`);
  chk('S4.1 posting updates account balance', posted && Math.abs(after-before-123.45)<0.01, {before,after,posted});
  chk('S4.2 statement reflects new transaction', stmtHas.has===true, stmtHas);
  const afterLiquid = await ev(`BusinessLogic.liquidTotals().total`);
  chk('S4.3 reports liquid follows new txn', Math.abs(afterLiquid - (s1.L.total+123.45))<0.01, {afterLiquid, expected:s1.L.total+123.45});
  // undo
  await ev(`(()=>{transactions=transactions.filter(t=>!(t.sourceType==='test'&&t.sourceId==='t1'));saveData();renderAccounts();renderDashboard();return BusinessLogic.accountBalance(102)})()`);
  const restored = await ev(`BusinessLogic.accountBalance(102)`);
  chk('S4.4 cleanup restored balance', Math.abs(restored-before)<0.01, {restored,before});

  // ═══ S5: dropdowns persist / link ═══
  const sel1 = await ev(`(()=>{const el=document.getElementById('prodCashAccSelect');el.value=String(accounts[0].id);const b=el.value;refreshSelectors();return {before:b,after:el.value,preserved:b===el.value}})()`);
  chk('S5.1 refreshSelectors keeps selection', sel1.preserved===true, sel1);
  const linked = await ev(`(()=>{const ids=['prodAccountId','prodCashAccSelect','prodBankAccSelect','incomeAccountId','expenseAccountId','instAccountId','arabonAccountId','partnerAccountId','recAccount'];
    return ids.map(i=>{const e=document.getElementById(i);return i+':'+(e?(e.options.length-1):'MISSING')});})()`);
  chk('S5.2 all account dropdowns populated', linked.every(x=>!x.includes('MISSING')&&parseInt(x.split(':')[1])>0), linked);
  // product with accountId survives reload
  const ptest = await ev(`(()=>{const pid=Date.now();products.push({id:pid,name:'اختبار ربط حساب',costPrice:10,expenses:0,sellPrice:20,stock:0,minStock:0,imei:'',accountId:accounts[2].id,discount:0,archived:false});saveData();return pid})()`);
  await reload();
  const prest = await ev(`(()=>{const p=products.find(x=>x.id==${ptest});if(!p)return 'NOT_FOUND';editProduct(p.id);const v=document.getElementById('prodAccountId').value;return {saved:String(p.accountId),shown:v,ok:String(p.accountId)===v}})()`);
  chk('S5.3 product account link survives reload + edit form', prest && prest.ok===true, prest);
  await ev(`(()=>{products=products.filter(x=>x.id!=${ptest});saveData();renderProducts();refreshSelectors();return true})()`);
  // new account appears in every dropdown
  const newAcc = await ev(`(()=>{const id=Date.now();accounts.push({id:id,name:'حساب اختبار ربط',type:'bank',balance:0,createdAt:new Date().toISOString()});saveData();renderAccounts();refreshSelectors();
    const ids=['prodAccountId','prodCashAccSelect','prodBankAccSelect','incomeAccountId','expenseAccountId','instAccountId','arabonAccountId','partnerAccountId','recAccount'];
    const missing=ids.filter(i=>{const e=document.getElementById(i);return !e||![...e.options].some(o=>o.value==String(id))});
    return {missing};})()`);
  chk('S5.4 new account shows in all dropdowns', newAcc && newAcc.missing.length===0, newAcc);
  await ev(`(()=>{accounts=accounts.filter(a=>a.name!=='حساب اختبار ربط');saveData();renderAccounts();refreshSelectors();renderDashboard();return true})()`);

  // ═══ S7: openingCapital scenario still ties ═══
  await ev(`(function(){openingCapital=5000;localStorage.setItem('openingCapital','5000');saveData();renderAccounts();renderDashboard();return 1})()`);
  const oc = await ev(`(()=>{const L=BusinessLogic.liquidTotals();const sumAccounts=accounts.reduce((s,a)=>s+BusinessLogic.accountBalance(a.id),0);const f=getFinancials();
    const cards=[...document.querySelectorAll('#accountsList .stat-card-modern')].map(e=>e.innerText.replace(/\\s+/g,' '));
    const totalCard=(cards.find(c=>c.includes('إجمالي السيولة'))||'').replace(/[^\\d.]/g,'');
    return {liquid:L.total,rcash:L.cash,fcash:f.cash,sumAccounts,openingCapital,finLiquid:f.liquid,ties:Math.abs(L.total-(sumAccounts+openingCapital))<0.01&&Math.abs(f.liquid-L.total)<0.01&&Math.abs(f.cash-L.cash)<0.01&&Math.abs(parseFloat(totalCard||0)-L.total)<0.01,cards};})()`);
  chk('S7 openingCapital keeps reports==accounts (+card shown)', oc.ties===true && oc.cards.some(c=>c.includes('رأس المال')), oc);
  await ev(`(function(){openingCapital=0;localStorage.setItem('openingCapital','0');saveData();renderAccounts();renderDashboard();return 1})()`);
  const ocBack = await ev(`BusinessLogic.liquidTotals().total`);
  chk('S7b openingCapital restored', Math.abs(ocBack - s1.L.total) < 0.01, {ocBack, expected:s1.L.total});

  // ═══ runtime errors ═══
  const errs = await ev(`(()=>{try{renderDashboard();renderAccounts();renderProducts();renderInstallments();renderArabonSales();renderMerchantSales();renderPartners();renderCommandCenter();renderDailySummary();refreshSelectors();switchPage('reports');renderGeneralStatement();drawCashTimeline&&drawCashTimeline();return 'OK'}catch(e){return 'THROW '+e.message}})()`);
  chk('S6 all renderers run without exception', errs==='OK', errs);
  chk('S8 no uncaught runtime exceptions', excs.length===0, excs);

  console.log('\n════ PASS ('+pass.length+') ════');
  pass.forEach(p=>console.log('  ✅', p));
  console.log('\n════ FAIL ('+fail.length+') ════');
  fail.forEach(f=>console.log('  ❌', f));
  console.log('\nSHC score:', shc.score, 'issues:', JSON.stringify(shc.issues));
  ws.close();process.exit(fail.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
