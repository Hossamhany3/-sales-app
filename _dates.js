const http = require('http');
const PORT = 9333;
function get(url){return new Promise((res,rej)=>{http.get(url,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);});}
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  let targets=null;
  for(let i=0;i<40;i++){try{targets=JSON.parse(await get(`http://127.0.0.1:${PORT}/json`));break;}catch(e){await sleep(500);}}
  const page=targets.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0;const pending=new Map();const excs=[];
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

  // ═══ seed: contract whose entry date (2026-01-15) differs from due dates (2027-06/07) ═══
  const seeded = await ev(`(()=>{
    if (typeof window.__seedDates !== 'undefined') return {already:true};
    const mid = (merchants[0]&&merchants[0].id) || 999009;
    if(!merchants.find(m=>m.id==mid)) merchants.push({id:mid,name:'عميل اختبار التواريخ',phone:'',address:''});
    const inst = {
      id:999001, contractNo:'DT-TEST', merchantId:mid, productId:null, deviceName:'جهاز اختبار التاريخ',
      purchasePrice:5000, paidUpfront:0, interestRate:0, totalAfterInterest:5000, remainingBalance:3000,
      numInstallments:5, monthlyAmount:1000, firstDueDate:'2027-06-01', date:'2026-01-15T09:00:00.000Z',
      isPaid:false, discount:0,
      schedule:[
        {index:1,dueDate:'2027-06-01',paidAmount:1000,isPaid:true},
        {index:2,dueDate:'2027-07-01',paidAmount:1000,isPaid:true},
        {index:3,dueDate:'2027-08-01',paidAmount:1000,isPaid:true},
        {index:4,dueDate:'2027-09-01',paidAmount:0,isPaid:false},
        {index:5,dueDate:'2027-10-01',paidAmount:0,isPaid:false}
      ]
    };
    installments.push(inst);
    transactions.push({id:'seedDt1',type:'payment_in',amount:1000,instId:999001,sourceType:'installment_payment',notes:'قسط تجريبي 1',date:'2026-01-20T10:00:00.000Z'});
    transactions.push({id:'seedDt2',type:'payment_in',amount:1000,instId:999001,sourceType:'installment_payment',notes:'قسط تجريبي 2',date:'2026-02-05T11:00:00.000Z'});
    transactions.push({id:'seedDt3',type:'payment_in',amount:1000,instId:999001,sourceType:'installment_payment',notes:'قسط تجريبي 3',date:'2026-03-11T12:00:00.000Z'});
    window.__seedDates = true;
    return {ok:true, mid};
  })()`);
  chk('D0 seed created', seeded.ok===true || seeded.already===true, seeded);

  // ═══ D1: slotPaidDate returns the actual entry date, not the due date ═══
  const d1 = await ev(`(()=>{
    const inst = installments.find(i=>i.id==999001);
    if(!inst) return {missing:true};
    const s = inst.schedule;
    return {
      s1: slotPaidDate(inst, s[0]),
      s2: slotPaidDate(inst, s[1]),
      s3: slotPaidDate(inst, s[2]),
      due1: s[0].dueDate, due2: s[1].dueDate
    };
  })()`);
  chk('D1.1 slot 1 date = entry date (not due date)', d1.s1==='2026-01-20' && d1.s1!==d1.due1, d1);
  chk('D1.2 slot 2 date = entry date (not due date)', d1.s2==='2026-02-05' && d1.s2!==d1.due2, d1);
  chk('D1.3 slot 3 date = entry date', d1.s3==='2026-03-11', d1);

  // ═══ D2: general statement (كشف الحساب العام) rows use entry dates ═══
  const d2 = await ev(`(()=>{
    const rows = buildGeneralStatementRows();
    const mine = rows.filter(r=>String(r.desc||'').startsWith('قسط رقم') && String(r.desc).includes('جهاز اختبار التاريخ'));
    const dues = installments.find(i=>i.id==999001).schedule.map(s=>s.dueDate);
    return {
      count: mine.length,
      dates: mine.map(r=>String(r.date).slice(0,10)),
      dueLeak: mine.filter(r=>dues.includes(String(r.date).slice(0,10))).map(r=>r.date)
    };
  })()`);
  chk('D2.1 general statement has 3 installment rows', d2.count===3, d2);
  chk('D2.2 general statement rows carry entry dates (no due-date leak)', d2.dates.join()==='2026-01-20,2026-02-05,2026-03-11' && (d2.dueLeak||[]).length===0, d2);

  // ═══ D2b: contract row dated by entry date, not by first payment/due date ═══
  const d2b = await ev(`(()=>{
    const rows = buildGeneralStatementRows();
    const row = rows.find(r=>String(r.desc||'').startsWith('عقد تقسيط') && String(r.desc).includes('جهاز اختبار التاريخ'));
    const m = buildComprehensiveRows(installments.find(i=>i.id==999001).merchantId)
                .find(r=>String(r.desc||'').includes('جهاز اختبار التاريخ') && (r.debit||0) > 0);
    return {gen: row?String(row.date).slice(0,10):null, comp: m?String(m.date).slice(0,10):null};
  })()`);
  chk('D2b contract rows dated by entry date', d2b.gen==='2026-01-15' && d2b.comp==='2026-01-15', d2b);

  // ═══ D3: customer/merchant statement rows use entry dates ═══
  const d3 = await ev(`(()=>{
    const inst = installments.find(i=>i.id==999001);
    const rows = buildComprehensiveRows(inst.merchantId);
    const mine = rows.filter(r=>String(r.desc||'').startsWith('قسط رقم') && String(r.desc).includes('جهاز اختبار التاريخ'));
    const dues = inst.schedule.map(s=>s.dueDate);
    return {count:mine.length, dates:mine.map(r=>String(r.date).slice(0,10)), dueLeak:mine.filter(r=>dues.includes(String(r.date).slice(0,10))).map(r=>r.date)};
  })()`);
  chk('D3.1 merchant statement has 3 installment rows', d3.count===3, d3);
  chk('D3.2 merchant statement rows carry entry dates', d3.dates.join()==='2026-01-20,2026-02-05,2026-03-11' && (d3.dueLeak||[]).length===0, d3);

  // ═══ D4: report period filters contracts by entry date, not first due date ═══
  const d4 = await ev(`(()=>{
    document.getElementById('reportDateFrom').value='2026-01-01';
    document.getElementById('reportDateTo').value='2026-01-31';
    const withIt = getFinancials().revenue;
    const idx = installments.findIndex(i=>i.id==999001);
    const removed = installments.splice(idx,1)[0];
    const without = getFinancials().revenue;
    installments.splice(idx,0,removed);
    return {withIt, without, delta:+(withIt-without).toFixed(2)};
  })()`);
  chk('D4.1 contract counted in report period by entry date', d4.delta===5000, d4);

  // ═══ D5: no due-date fallbacks left in the report/statement source ═══
  const d5 = await ev(`(()=>{
    const src = Array.from(document.scripts).map(s=>s.textContent).join('\\n');
    return {
      oldFilter: (src.match(/firstDueDate \\|\\| i\\.date/g)||[]).length,
      oldPaid: (src.match(/s\\.paidDate \\|\\| s\\.dueDate/g)||[]).length,
      hasNew: src.includes('slotPaidDate(inst, s)')
    };
  })()`);
  chk('D5.1 no firstDueDate-first filters remain', d5.oldFilter===0, d5);
  chk('D5.2 no paidDate||dueDate fallbacks remain', d5.oldPaid===0, d5);
  chk('D5.3 helper wired into statements', d5.hasNew===true, d5);

  // ═══ D6: seed contract removed by report rendering on both pages, no crash ═══
  await ev(`switchPage('reports');`);
  await sleep(300);
  const r1 = await ev(`(()=>{try{switchReportTab('tabStatement');renderGeneralStatement();return {ok:true}}catch(e){return {err:e.message}}})()`);
  chk('D6.1 general statement renders', r1.ok===true, r1);
  await ev(`switchPage('installments');`); await sleep(400);
  const r2 = await ev(`(()=>{try{renderInstallments();return {ok:true}}catch(e){return {err:e.message}}})()`);
  chk('D6.2 installments list renders', r2.ok===true, r2);

  // ═══ cleanup ═══
  await ev(`(()=>{
    installments = installments.filter(i=>i.id!=999001);
    transactions = transactions.filter(t=>!String(t.id).startsWith('seedDt'));
    document.getElementById('reportDateFrom').value=''; document.getElementById('reportDateTo').value='';
    delete window.__seedDates;
    saveData();
    return true;
  })()`);

  console.log('═══ PASS ('+pass.length+') ═══');
  pass.forEach(p=>console.log('  ✅ '+p));
  if(fail.length){console.log('═══ FAIL ('+fail.length+') ═══'); fail.forEach(f=>console.log('  ❌ '+f));}
  if(excs.length){console.log('runtime exceptions: '+JSON.stringify(excs.slice(0,10)));}
  process.exit(fail.length?1:0);
})();
