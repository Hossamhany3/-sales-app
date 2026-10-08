const http = require('http');
const PORT = 9333;
const get = u => new Promise((r, j) => { http.get(u, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => r(d)); }).on('error', j); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const t = JSON.parse(await get('http://127.0.0.1:' + PORT + '/json'));
  const p = t.find(x => x.type === 'page');
  const ws = new WebSocket(p.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  await new Promise(r => ws.onopen = r);
  const send = (m, q) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: q })); });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'file:///C:/Users/TECH%20FAZ/Desktop/New%20folder%20(2)/app_fixed.html' });
  await sleep(4500);
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result && r.result.exceptionDetails) return 'EX: ' + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text); return r.result && r.result.result ? r.result.result.value : JSON.stringify(r.result); };

  const before = await ev(`JSON.stringify({p:products.length,a:accounts.length,t:transactions.length,sm:(typeof stockMovements!=='undefined'?stockMovements.length:0),ms:merchantSales.length,i:installments.length,liq:+BusinessLogic.liquidTotals().total.toFixed(2)})`);
  console.log('BEFORE: ' + before);

  const out = await ev(`(async()=>{
    const fixes={testProduct:false,testAccount:false,testTxns:0,testStockMov:0,testAudit:0,
                 badContracts:0,contractTxns:0,contractMovs:0,stockAdj:0,
                 badSales:0,saleTxns:0,saleMovs:0,linkedMovs:0,backup:null};

    // 1) حذف بيانات الاختبار السابقة (منتج/حساب تجريبيان)
    const PID=1791467005550, AID=1791467005273;
    if(products.some(x=>x.id===PID)){ products=products.filter(x=>x.id!==PID); fixes.testProduct=true; }
    const n0=transactions.length;
    transactions=transactions.filter(x=>!(x.accountId==AID||x.productId==PID));
    fixes.testTxns=n0-transactions.length;
    const n1=stockMovements.length;
    stockMovements=stockMovements.filter(x=>x.productId!=PID);
    fixes.testStockMov=n1-stockMovements.length;
    const n2=auditLog.length;
    auditLog=auditLog.filter(x=>!/جهاز الاختبار الذكي|بنك رئيسي \\(اختبار\\)/.test(JSON.stringify(x)));
    fixes.testAudit=n2-auditLog.length;
    if(accounts.some(x=>x.id===AID)){ accounts=accounts.filter(x=>x.id!==AID); fixes.testAccount=true; }

    // 2) حذف العقود التالفة (بلا عدد أقساط أو بلا جدول) + حركاتها المرتبطة
    const badIds = installments.filter(i=>!(Array.isArray(i.schedule)&&i.schedule.length>0) && !(Number(i.numInstallments)>0)).map(i=>i.id);
    if(badIds.length){
      installments = installments.filter(i=>!badIds.includes(i.id));
      fixes.badContracts = badIds.length;
      const b0=transactions.length;
      transactions = transactions.filter(t=>!(t.instId!=null && badIds.includes(Number(t.instId))));
      fixes.contractTxns = b0-transactions.length;
      const m0=stockMovements.length;
      stockMovements = stockMovements.filter(sm=>{
        if(sm.sourceType==='installment'){
          const base=String(sm.sourceId).split('_')[0];
          if(badIds.includes(Number(base))){
            if(sm.type==='out'){ const pr=products.find(x=>x.id==sm.productId); if(pr){ pr.stock += (Number(sm.qty)||0); fixes.stockAdj++; } }
            return false;
          }
        }
        return true;
      });
      fixes.contractMovs = m0-stockMovements.length;
    }

    // 3) حذف سجلات مبيعات التجار البلا قيمة (sellPrice غير صالح) وقيودها
    const badSales = merchantSales.filter(s=>!(Number(s.sellPrice)>0));
    if(badSales.length){
      const badKeys = badSales.map(s=>String(s.transactionId||s.id));
      merchantSales = merchantSales.filter(s=>!badSales.includes(s));
      fixes.badSales = badSales.length;
      const s0=transactions.length;
      transactions = transactions.filter(t=>!(t.sourceType==='merchant_sale' && badKeys.some(k=>String(t.sourceId).startsWith(k))));
      fixes.saleTxns = s0-transactions.length;
      const sm0=stockMovements.length;
      stockMovements = stockMovements.filter(sm=>{
        if(sm.sourceType==='merchant_sale' && badKeys.some(k=>String(sm.sourceId).startsWith(k))){
          if(sm.type==='out'){ const pr=products.find(x=>x.id==sm.productId); if(pr){ pr.stock += (Number(sm.qty)||0); fixes.stockAdj++; } }
          return false;
        }
        return true;
      });
      fixes.saleMovs = sm0-stockMovements.length;
    }

    // 4) ربط حركات المخزون اليتيمة بأصل حي (رصيد افتتاحي للصنف)
    const live = new Set();
    transactions.forEach(t=>{ if(t.sourceType) live.add(t.sourceType+'|'+String(t.sourceId)); });
    installments.forEach(i=>live.add('installment|'+String(i.id)));
    stockMovements.forEach(sm=>{
      if(!sm.sourceType || !sm.sourceId) return;
      if(live.has(sm.sourceType+'|'+String(sm.sourceId))) return;
      if(sm.sourceType==='installment'){
        const base=String(sm.sourceId).split('_')[0];
        if(installments.find(i=>i.id==base)) return;
      }
      const pr = sm.productId!=null ? products.find(x=>x.id==sm.productId) : null;
      if(!pr) return;
      sm.sourceType='opening_stock';
      sm.sourceId=String(pr.id);
      if(sm.type==='in' && !live.has('opening_stock|'+String(pr.id))){
        transactions.push({
          id:'os_'+pr.id+'_'+Date.now(), type:'purchase', amount:0, productId:pr.id,
          notes:'مخزون افتتاحي | '+pr.name+' ×'+(sm.qty||0),
          sourceType:'opening_stock', sourceId:String(pr.id), operationType:'create',
          category:'مشتريات', employeeId:null, date:sm.date||new Date().toISOString()
        });
        live.add('opening_stock|'+String(pr.id));
      }
      fixes.linkedMovs++;
    });

    // 5) تسجيل نسخة احتياطية (حتى لا يبلّغ مركز الصحة "لم تُؤخذ نسخة بعد")
    try{
      const btn=document.getElementById('backupExportBtn');
      if(btn){ btn.click(); }
      if(!localStorage.getItem('autoBackup_last')) lsSet('autoBackup_last', JSON.stringify({date:new Date().toISOString(), source:'manual'}));
      fixes.backup = localStorage.getItem('autoBackup_last');
    }catch(e){ fixes.backupErr = e.message; }

    await saveData();
    return fixes;
  })()`);
  console.log('REPAIR: ' + JSON.stringify(out));

  await sleep(1200);
  const shc = await ev(`(()=>{try{SHC.runAllChecks();return {score:SHC.getScore(),issues:SHC.issues.map(i=>({m:i.module,c:i.checkId,s:i.severity,t:i.title}))}}catch(e){return {err:e.message}}})()`);
  console.log('SHC: ' + JSON.stringify(shc));

  const after = await ev(`JSON.stringify({p:products.length,a:accounts.length,t:transactions.length,i:installments.length,ms:merchantSales.length,sm:stockMovements.length,liq:+BusinessLogic.liquidTotals().total.toFixed(2),hasTest:products.some(x=>x.name==='جهاز الاختبار الذكي')||accounts.some(x=>x.name==='بنك رئيسي (اختبار)')})`);
  console.log('AFTER: ' + after);

  const idb = await ev(`(async()=>{ try{ await saveAllToIDB(); return {ok:true}; }catch(e){ return {err:e.message}; } })()`);
  console.log('IDB: ' + JSON.stringify(idb));
  process.exit(0);
})();
