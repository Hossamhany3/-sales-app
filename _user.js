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
  const consoleErrs=[], pageExcs=[];
  ws.onmessage=ev=>{const m=JSON.parse(ev.data);
    if(m.method==='Runtime.exceptionThrown'){const d=m.params&&m.params.exceptionDetails;pageExcs.push(((d&&d.exception&&d.exception.description)||(d&&d.text)||'').split('\n')[0]);}
    if(m.method==='Runtime.consoleAPICalled'){const t=m.params.type; if(t==='error'||t==='warning'){consoleErrs.push(t+': '+m.params.args.map(a=>a.value!==undefined?String(a.value):(a.description||'')).join(' ').slice(0,300));}}
    if(m.method==='Log.entryAdded'){const e=m.params.entry; if(e.level==='error'||e.level==='warning'){consoleErrs.push(e.level+': '+String(e.text).slice(0,300)+' @'+(e.url||''));}}
    if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
  const send=(method,params)=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
  await new Promise(r=>ws.onopen=r);
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  async function ev(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});if(r.result&&r.result.exceptionDetails)return {__ex:(r.result.exceptionDetails.exception&&r.result.exceptionDetails.exception.description)||r.result.exceptionDetails.text};return r.result&&r.result.result?r.result.result.value:null;}
  async function reload(){await send('Page.navigate',{url:'file:///C:/Users/TECH%20FAZ/Desktop/New%20folder%20(2)/app_fixed.html'});await sleep(4500);}

  const findings=[];
  const note=(sev,where,msg,info)=>findings.push({sev,where,msg,info});
  const steps=[];
  async function step(name,fn){
    const beforeC=consoleErrs.length, beforeE=pageExcs.length;
    let out;
    try{ out=await fn(); }catch(e){ out={__stepErr:String(e&&e.message||e)}; }
    await sleep(250);
    const newC=consoleErrs.slice(beforeC), newE=pageExcs.slice(beforeE);
    steps.push({name, out, errs:newE, warn:newC});
    if(newE.length) note('high',name,'أثناء الخطوة ظهرت استثناءات',newE);
    const badC=newC.filter(x=>x.startsWith('error:')||x.startsWith('warning: TypeError')||x.startsWith('error: Uncaught'));
    if(badC.length) note('med',name,'أخطاء console',badC);
    console.log('\n── '+name+' ──'+(newE.length?' [EXCEPTIONS: '+newE.length+']':'')+(badC.length?' [CONSOLE: '+badC.length+']':''));
    console.log('   '+JSON.stringify(out));
    if(newE.length) newE.forEach(e=>console.log('   EX: '+e));
    if(badC.length) badC.forEach(e=>console.log('   CE: '+e));
    return out;
  }

  await reload();

  // ── instrumentation ──
  await ev(`(()=>{
    if(window.__instr) return {re:true};
    window.__toasts=[]; const o=showToast; window.showToast=function(m,t){window.__toasts.push({m:String(m),t:t||''}); return o(m,t);};
    const e=document.getElementById('errToast')||null;
    window.__clearToasts=()=>{window.__toasts=[]};
    window.__toastErrors=()=>window.__toasts.filter(t=>t.t==='error').map(t=>t.m);
    window.__instr=true;
    return {ok:true};
  })()`);

  // ── snapshot for restore ──
  const snap = await ev(`(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k);}window.__lsSnap=o;return {keys:Object.keys(o), size:JSON.stringify(o).length, counts:{p:products.length,t:transactions.length,i:installments.length,a:accounts.length,m:merchants.length}};})()`);
  console.log('SNAPSHOT: '+JSON.stringify(snap));

  // ══════ 1. dashboard ══════
  await step('S1 فتح لوحة التحكم', async()=>{
    await ev(`switchPage('dashboard')`); await sleep(700);
    const lockVisible = await ev(`(()=>{const el=document.getElementById('lockInput');return !!(el && el.offsetParent!==null);})()`);
    if(lockVisible) await ev(`try{window.unlockApp&&unlockApp()}catch(e){}`);
    return {lockVisible};
  });

  // ══════ 2. new bank account ══════
  const acc = await step('S2 إنشاء حساب بنكي جديد', async()=>{
    return await ev(`(()=>{
      const nm='بنك رئيسي (اختبار)';
      document.getElementById('accountName').value=nm;
      document.getElementById('accountType').value='bank';
      document.getElementById('accountNumber').value='ACC-001';
      document.getElementById('accountBalance').value='5000';
      document.getElementById('accountNotes').value='حساب اختبار';
      document.getElementById('accountForm').requestSubmit();
      const a=accounts.find(x=>x.name===nm);
      return {created:!!a, id:a?a.id:null, balance:a?a.balance:null, count:accounts.length};
    })()`);
  });
  const accId = acc && acc.created ? acc.id : null;

  // ══════ 3. new product ══════
  const prod = await step('S3 إضافة صنف بالمخزون', async()=>{
    return await ev(`(()=>{
      const nm='جهاز الاختبار الذكي';
      const old=products.find(x=>x.name===nm); if(old) return {existed:true,id:old.id,stock:old.stock};
      document.getElementById('prodName').value=nm;
      document.getElementById('costPrice').value='1000';
      document.getElementById('prodExpenses').value='50';
      document.getElementById('sellPrice').value='1800';
      document.getElementById('stockQty').value='10';
      document.getElementById('minStock').value='2';
      document.getElementById('prodImei').value='IMEI-TEST-1';
      document.getElementById('productId').value='';
      ${accId?`document.getElementById('prodAccountId').value='${accId}';`:''}
      document.getElementById('productForm').requestSubmit();
      const p=products.find(x=>x.name===nm);
      const t=transactions.filter(x=>x.sourceType==='opening_stock'&&x.sourceId==String(p?p.id:''));
      return {created:!!p,id:p&&p.id,stock:p&&p.stock,openingTxnAmounts:t.map(x=>x.amount)};
    })()`);
  });
  const pid = prod && prod.id;

  // ══════ 4. cash sale through the real modal ══════
  await step('S4 بيع نقدي عبر المودال', async()=>{
    if(!pid) return {skipped:'no product'};
    const before = await ev(`(()=>{const p=products.find(x=>x.id==${pid});return {stock:p.stock, tx:transactions.length};})()`);
    await ev(`sellProduct(${pid})`); await sleep(300);
    const modalUp = await ev(`document.getElementById('modalOverlay').classList.contains('show')`);
    await ev(`(()=>{const q=document.getElementById('sellQty'); if(q){q.value='2';q.dispatchEvent(new Event('input'));} const a=document.getElementById('sellAccount'); if(a&&${accId}) a.value='${accId}'; return true;})()`);
    await ev(`document.getElementById('modalConfirmBtn').click()`); await sleep(600);
    const after = await ev(`(()=>{const p=products.find(x=>x.id==${pid});const t=transactions.filter(x=>x.productId==${pid}&&x.type==='sell_cash');return {stock:p.stock, tx:transactions.length, sells:t.map(x=>({amount:x.amount,date:String(x.date).slice(0,10),acc:x.accountId}))};})()`);
    return {modalUp, before, after, stockDrop:before.stock-after.stock};
  });

  // ══════ 5. expense ══════
  await step('S5 تسجيل مصروف', async()=>{
    if(!accId) return {skipped:'no account'};
    return await ev(`(()=>{
      document.getElementById('expenseName').value='إيجار المكتب';
      document.getElementById('expenseAmount').value='250';
      document.getElementById('expenseAccountId').value='${accId}';
      const cat=document.getElementById('expenseCategory');
      if(cat.options.length>1) cat.value=cat.options[1].value;
      document.getElementById('expenseNotes').value='اختبار مصروف';
      const n0=transactions.length;
      document.getElementById('expenseForm').requestSubmit();
      const t=transactions.slice(n0).find(x=>x.type==='expense');
      return {added:!!t, amount:t&&t.amount, acc:t&&t.accountId, total:transactions.length};
    })()`);
  });

  // ══════ 6. income ══════
  await step('S6 تسجيل إيراد', async()=>{
    if(!accId) return {skipped:'no account'};
    return await ev(`(()=>{
      document.getElementById('incomeName').value='خدمة صيانة';
      document.getElementById('incomeAmount').value='750';
      document.getElementById('incomeAccountId').value='${accId}';
      const cat=document.getElementById('incomeCategory');
      if(cat.options.length>1) cat.value=cat.options[1].value;
      document.getElementById('incomeNotes').value='اختبار إيراد';
      const n0=transactions.length;
      document.getElementById('incomeForm').requestSubmit();
      const t=transactions.slice(n0).find(x=>x.type==='income');
      return {added:!!t, amount:t&&t.amount, acc:t&&t.accountId};
    })()`);
  });

  // ══════ 7. installment contract ══════
  const inst = await step('S7 إنشاء عقد تقسيط', async()=>{
    if(!pid) return {skipped:'no product'};
    const n0 = await ev(`installments.length`);
    return await ev(`(()=>{
      document.getElementById('instName').value='عميل الاختبار';
      document.getElementById('instPhone').value='01000000000';
      document.getElementById('instProductId').value='${pid}';
      document.getElementById('purchasePrice').value='3000';
      document.getElementById('paidUpfront').value='500';
      document.getElementById('interestRate').value='5';
      document.getElementById('numInstallments').value='6';
      document.getElementById('firstDueDate').value='2026-11-01';
      ${accId?`document.getElementById('instAccountId').value='${accId}';`:''}
      document.getElementById('installmentForm').requestSubmit();
      const list=installments.slice(${n0});
      const i=list[list.length-1];
      const p=products.find(x=>x.id==${pid});
      return {created:!!i, id:i&&i.id, total:i&&i.totalAfterInterest, monthly:i&&i.monthlyAmount,
              remaining:i&&i.remainingBalance, sched:i&&i.schedule&&i.schedule.length,
              firstDue:i&&i.schedule&&i.schedule[0]&&i.schedule[0].dueDate,
              stock:p&&p.stock, upfrontTxn: i? transactions.filter(t=>t.instId==i.id&&t.operationType==='upfront').map(t=>({a:t.amount,d:String(t.date).slice(0,10)})) : []};
    })()`);
  });
  const instId = inst && inst.id;

  // ══════ 8. pay installment (back-dated 3 days) ══════
  await step('S8 سداد قسط بتاريخ سابق', async()=>{
    if(!instId) return {skipped:'no contract'};
    await ev(`openSlotPay(${instId},0)`); await sleep(300);
    const payDate = new Date(Date.now()-3*86400000).toISOString().slice(0,10);
    return await ev(`(()=>{
      const id=${instId};
      const amt=document.getElementById('payAmount-'+id);
      const dt=document.getElementById('payDate-'+id);
      const ac=document.getElementById('payAccount-'+id);
      if(!amt) return {err:'no amount field'};
      dt.value='${payDate}'; if(${accId}) ac.value='${accId}';
      const before = installments.find(i=>i.id==id).remainingBalance;
      const n0=transactions.length;
      confirmSlotPay(id,0);
      const after = installments.find(i=>i.id==id);
      const nt=transactions.slice(n0);
      return {payDate:'${payDate}', before, after:after.remainingBalance,
              slot: after.schedule && {paidDate:after.schedule[0].paidDate, isPaid:after.schedule[0].isPaid},
              newTxns: nt.map(t=>({type:t.type,amount:t.amount,date:String(t.date).slice(0,10)}))};
    })()`);
  });

  // ══════ 9. arabon sale ══════
  await step('S9 عقد عربون', async()=>{
    if(!pid) return {skipped:'no product'};
    const stockBefore = await ev(`products.find(x=>x.id==${pid}).stock`);
    const n0 = await ev(`arabonSales.length`);
    return await ev(`(()=>{
      document.getElementById('arabonName').value='عميل عربون';
      document.getElementById('arabonPhone').value='01111111111';
      document.getElementById('arabonProductId').value='${pid}';
      document.getElementById('arabonSellPrice').value='2000';
      document.getElementById('arabonDeposit').value='800';
      document.getElementById('arabonDueDate').value='2026-12-01';
      ${accId?`document.getElementById('arabonAccountId').value='${accId}';`:''}
      const t0=transactions.length;
      document.getElementById('arabonForm').requestSubmit();
      const a=arabonSales.slice(${n0})[0];
      const nt=transactions.slice(t0);
      return {created:!!a, remaining:a&&a.remainingAmount, stock:products.find(x=>x.id==${pid}).stock,
              txns:nt.map(t=>({type:t.type,amount:t.amount,op:t.operationType}))};
    })()`);
  });

  // ══════ 10. report tabs ══════
  const tabs=['tabPnl','tabBalance','tabDebt','tabChart','tabDaily','tabProdProfit','tabCompare','tabStockMov','tabStatement','tabCommissions','tabAuditLog'];
  await step('S10 تبويبات التقارير', async()=>{
    await ev(`switchPage('reports')`); await sleep(400);
    const res={};
    for(const t of tabs){
      const r=await ev(`(()=>{try{switchReportTab('${t}');return {ok:true}}catch(e){return {err:e.message}}})()`);
      await sleep(220);
      res[t]=r;
      if(r && r.err) note('high','reports/'+t,'التبويب فشل في العرض',{err:r.err});
    }
    return res;
  });

  await step('S10b فحص نص التقارير', async()=>{
    const scan = await ev(`(()=>{
      const bad=[];
      const re=/(NaN|undefined|Infinity|Invalid Date|\\[object Object\\])/;
      document.querySelectorAll('#reportsContent, #dashboardContent, #transactionsContent, #installmentsList, #accountsContent, #productsContent').forEach(root=>{
        if(!root) return;
        const txt=(root.innerText||'');
        if(re.test(txt)){
          const lines=txt.split('\\n').filter(l=>re.test(l)).slice(0,6);
          bad.push({root:root.id, lines});
        }
      });
      return bad;
    })()`);
    if(scan && scan.length) note('high','تقارير/واجهات','نص يحتوي NaN أو undefined',scan);
    return scan;
  });

  // ══════ 11. general statement ══════
  const s11 = await step('S11 كشف الحساب العام', async()=>{
    await ev(`switchReportTab('tabStatement'); renderGeneralStatement();`); await sleep(500);
    return await ev(`(()=>{
      const rows=buildGeneralStatementRows();
      const badDates=rows.filter(r=>!r.date||/Invalid|NaN/.test(String(r.date))).length;
      const d=rows.reduce((s,r)=>s+(r.debit||0),0), c=rows.reduce((s,r)=>s+(r.credit||0),0);
      const liq=getCashLiquidity();
      const net=c-d;
      const recv=installments.reduce((s,i)=>s+(i.remainingBalance||0),0)+arabonSales.reduce((s,a)=>s+(a.remainingAmount||0),0)
        +(merchantSales.reduce((s,x)=>s+(x.sellPrice||0)*(x.quantity||1),0)+merchantPaymentsOut.reduce((s,x)=>s+(x.amount||0),0)
          -merchantPayments.reduce((s,x)=>s+(x.amount||0),0)-merchantPurchases.reduce((s,x)=>s+(x.costPrice||0)*(x.quantity||1),0));
      const bridge=(()=>{const txt=document.getElementById('statementContent').innerText;const m=txt.match(/الرصيد الصافي \\(([\\d.,-]+) ج\\) \\+ المبالغ المعلقة \\(([\\d.,-]+) ج\\) = السيولة النقدية \\(([\\d.,-]+) ج\\)/);return m?{b:+m[1].replace(/,/g,''),p:+m[2].replace(/,/g,''),l:+m[3].replace(/,/g,'')}:null;})();
      return {rows:rows.length, badDates, debit:+d.toFixed(2), credit:+c.toFixed(2), liq:+liq.toFixed(2), net:+net.toFixed(2),
              diff:+(net-liq).toFixed(2), bridge, recv:+recv.toFixed(2), green:document.getElementById('statementContent').innerText.includes('✅')};
    })()`);
  });
  if(s11 && s11.bridge){
    const shown=s11.bridge.p, actual=s11.recv;
    if(Math.abs(shown-actual)>0.01)
      note('high','كشف الحساب العام','«المبالغ المعلقة» في الجسر لا تساوي ديون العملاء الفعلية',{shown, actual, diff:+(shown-actual).toFixed(2), bridge:s11.bridge});
    if(Math.abs((s11.bridge.b+s11.bridge.p)-s11.bridge.l)>0.01)
      note('high','كشف الحساب العام','الجسر لا يتحقق: الرصيد الصافي + المبالغ المعلقة ≠ السيولة النقدية',s11.bridge);
  }

  // ══════ 12. account statement dates ══════
  await step('S12 كشف حساب الحساب البنكي', async()=>{
    if(!accId) return {skipped:'no account'};
    await ev(`document.getElementById('accountStatementOverlay')?.remove(); showAccountStatement('${accId}');`); await sleep(400);
    const r = await ev(`(()=>{
      const o=document.getElementById('accountStatementOverlay');
      if(!o) return {missing:true};
      const cells=Array.from(o.querySelectorAll('tbody tr')).map(tr=>tr.cells[0]?tr.cells[0].innerText.trim():'');
      const real=BusinessLogic.accountTransactions('${accId}').map(t=>new Date(t.date).toLocaleDateString('ar-EG'));
      const unknown=cells.filter(c=>c&&!real.includes(c));
      const txt=o.innerText;
      return {cells, real, unknown, nan:/(NaN|undefined)/.test(txt), hasBalance:txt.includes('الرصيد الحالي')};
    })()`);
    await ev(`document.getElementById('accountStatementOverlay')?.remove();`);
    if(r && r.unknown && r.unknown.length) note('high','كشف حساب','تواريخ غير موجودة في قيود الحساب',r.unknown);
    if(r && r.nan) note('high','كشف حساب','NaN/undefined في النص');
    return r;
  });

  // ══════ 13. exports ══════
  await step('S13 تصدير CSV', async()=>{
    const out={};
    for(const f of ['exportPnlCSV','exportTransactionsCSV','exportInstallmentsCSV','exportProductsCSV','exportAccountStatementCSV','exportDailySummaryCSV','exportStockMovementsCSV','exportCommissionsCSV','exportAuditLogCSV','exportArabonCSV']){
      const r=await ev(`(()=>{try{ window['${f}'](${accId?`'${accId}'`:'null'}); return {ok:true}; }catch(e){ return {err:e.message+' | '+(e.stack||'').split('\\n')[1]}; }})()`);
      out[f]=r;
      if(r&&r.err) note('high','تصدير',f,{err:r.err});
      await sleep(120);
    }
    return out;
  });

  // ══════ 14. print windows ══════
  await step('S14 فتح النوافذ (طباعة/PDF)', async()=>{
    const out={};
    const merchants_ = await ev(`merchants[0]&&merchants[0].id`);
    for(const f of ['printAccountStatement','printInstallmentMergedPDF']){
      const arg = f==='printAccountStatement' ? `'${accId}'` : (instId?`'${instId}'`:'null');
      const r=await ev(`(()=>{try{ window['${f}'](${arg}); return {ok:true}; }catch(e){ return {err:e.message}; }})()`);
      out[f]=r; await sleep(400);
      if(r&&r.err) note('high','طباعة',f,{err:r.err});
    }
    const comp = await ev(`(()=>{try{ printComprehensiveStatement(${merchants_||'null'}); return {ok:true}; }catch(e){ return {err:e.message}; }})()`);
    out.printComprehensiveStatement=comp;
    if(comp&&comp.err) note('high','طباعة','printComprehensiveStatement',{err:comp.err});
    await sleep(400);
    return out;
  });

  // ══════ 15. consistency after all ops ══════
  await step('S15 تطابق الأرقام بعد العمليات', async()=>{
    return await ev(`(()=>{
      const L=BusinessLogic.liquidTotals();
      const f=getFinancials();
      const sumAcc=accounts.reduce((s,a)=>s+BusinessLogic.accountBalance(a.id),0);
      const rows=buildGeneralStatementRows();
      const net=rows.reduce((s,r)=>s+(r.credit||0)-(r.debit||0),0);
      const stmt=getCashLiquidity();
      const f2=(a,b)=>Math.abs(a-b);
      return {liquid:+L.total.toFixed(2), finLiquid:+f.liquid.toFixed(2), sumAcc:+(sumAcc+(parseFloat(openingCapital)||0)).toFixed(2),
              stmtNet:+net.toFixed(2), stmtLiq:+stmt.toFixed(2),
              ties:{L_fin:f2(L.total,f.liquid)<0.01, L_stmt:f2(L.total,stmt)<0.01},
              shc:(()=>{try{SHC.runAllChecks();return {score:SHC.getScore(),issues:SHC.issues.map(i=>i.checkId)}}catch(e){return {err:e.message}}})()};
    })()`);
  });

  // ══════ 16. health center ══════
  await step('S16 مركز الصحة', async()=>{
    return await ev(`(()=>{try{switchPage('healthCenter');SHC.runAllChecks();return {score:SHC.getScore(),issues:SHC.issues.map(i=>({m:i.module,c:i.checkId,s:i.severity}))}}catch(e){return {err:e.message}}})()`);
  });

  // ══════ 17. anomaly scan across app ══════
  await step('S17 فحص شامل للنصوص', async()=>{
    const pages=['dashboard','products','transactions','installments','arabonSales','merchantSales','partners','accounts','reports','settings'];
    const bad=[];
    for(const p of pages){
      await ev(`switchPage('${p}')`); await sleep(320);
      const r=await ev(`(()=>{
        const re=/(NaN|undefined|Infinity|Invalid Date|\\[object Object\\]|null\\.toFixed)/;
        const txt=document.body.innerText||'';
        if(!re.test(txt)) return null;
        return txt.split('\\n').filter(l=>re.test(l)).slice(0,8);
      })()`);
      if(r) { bad.push({page:p,lines:r}); note('high','واجهة '+p,'نص مشبوه (NaN/undefined/...)',r); }
    }
    return bad.length?bad:'clean';
  });

  // ══════ 18. employee-login modal hijacks _confirmModal ══════
  await step('S18 اختبار زر تأكيد المودال بعد فتح دخول موظف', async()=>{
    const empCount = await ev(`employees.length`);
    const created = await ev(`(()=>{ if(employees.length) return employees.length;
      employees.push({id:9999001,name:'موظف اختبار',phone:'',role:'employee',pinHash:'x'}); return employees.length; })()`);
    const before = await ev(`String(window._confirmModal).slice(0,80)`);
    await ev(`(()=>{try{window.openEmployeeLogin&&openEmployeeLogin();return true}catch(e){return String(e.message)}})()`); await sleep(300);
    await ev(`(()=>{try{window._closeModal(null)}catch(e){}})()`); await sleep(150);
    const after = await ev(`String(window._confirmModal).slice(0,80)`);
    const hijacked = before!==after;
    // now try a real cash sale confirm
    let saleRes=null;
    if(pid){
      await ev(`sellProduct(${pid})`); await sleep(250);
      await ev(`(()=>{const q=document.getElementById('sellQty'); if(q){q.value='1';q.dispatchEvent(new Event('input'));} const a=document.getElementById('sellAccount'); if(a&&${accId}) a.value='${accId}'; return true;})()`);
      const st0 = await ev(`products.find(x=>x.id==${pid}).stock`);
      await ev(`document.getElementById('modalConfirmBtn').click()`); await sleep(500);
      const st1 = await ev(`products.find(x=>x.id==${pid}).stock`);
      const overlayStill = await ev(`document.getElementById('modalOverlay').classList.contains('show')`);
      const empErr = await ev(`window.__toasts.filter(t=>t.t==='error').map(t=>t.m).slice(-3)`);
      await ev(`(()=>{try{window._closeModal(null)}catch(e){}})()`);
      saleRes={st0,st1,sold:st0-st1,overlayStill,empErr};
      if(st0===st1) note('high','مودال البيع','زر تأكيد المودال لم ينفذ البيع بعد فتح دخول الموظف',saleRes);
    }
    if(hijacked) note('high','المودال','openEmployeeLogin يستبدل window._confirmModal نهائياً ولا يستعيده',{before,after});
    await ev(`employees=employees.filter(e=>e.id!=9999001); saveData&&saveData();`);
    return {empCount, created, hijacked, saleRes};
  });

  // ══════ toasts ══════
  const toasts = await ev(`({errs:window.__toastErrors(), all:window.__toasts.length})`);
  console.log('\nTOAST ERRORS: '+JSON.stringify(toasts));

  // ══════ cleanup: restore localStorage, block beforeunload save, reload, re-sync IDB ══════
  const cleanup = await ev(`(()=>{
    const snap=window.__lsSnap;
    if(!snap) return {err:'no snapshot'};
    const keep=new Set(Object.keys(snap));
    const removed=[];
    for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i); if(!keep.has(k)){removed.push(k); localStorage.removeItem(k);} }
    for(const k in snap) localStorage.setItem(k, snap[k]);
    window.saveData=async()=>{}; window.__saveDataNoop=true;
    return {restored:Object.keys(snap).length, removed, counts:{p:products.length,t:transactions.length,i:installments.length}};
  })()`);
  console.log('CLEANUP: '+JSON.stringify(cleanup));
  await reload();
  const idbSync = await ev(`(async()=>{ try{ await saveAllToIDB(); return {ok:true}; }catch(e){ return {err:e.message}; } })()`);
  console.log('IDB RE-SYNC: '+JSON.stringify(idbSync));
  const afterRestore = await ev(`(()=>({p:products.length,t:transactions.length,i:installments.length,a:accounts.length,m:merchants.length,accTest:accounts.some(x=>x.name==='بنك رئيسي (اختبار)'),prodTest:products.some(x=>x.name==='جهاز الاختبار الذكي'),txnTest:transactions.filter(x=>/اختبار/.test((x.notes||'')+' '+(x.desc||''))).length}))()`);
  console.log('AFTER RESTORE: '+JSON.stringify(afterRestore));
  if(afterRestore.accTest||afterRestore.prodTest) note('high','تنظيف','بيانات اختبار باقية بعد الاستعادة',afterRestore);

  console.log('\n════════════ FINDINGS ('+findings.length+') ════════════');
  findings.forEach((f,i)=>console.log(`[${f.sev}] ${i+1}. ${f.msg} @ ${f.where}\n      ${JSON.stringify(f.info)}`));

  console.log('\n════════════ STEPS SUMMARY ════════════');
  steps.forEach(s=>{
    const hasErr=(s.errs||[]).length>0;
    console.log(`${hasErr?'❌':'✅'} ${s.name}${hasErr?' ('+s.errs.length+' exceptions)':''}`);
  });

  process.exit(0);
})();
