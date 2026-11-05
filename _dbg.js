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
  ws.onmessage=ev=>{const m=JSON.parse(ev.data);
    if(m.method==='Runtime.exceptionThrown'){const d=m.params&&m.params.exceptionDetails;console.log('EXC:',((d&&d.exception&&d.exception.description)||(d&&d.text)||'').split('\n')[0]);}
    if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
  const send=(method,params)=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
  await new Promise(r=>ws.onopen=r);
  await send('Runtime.enable'); await send('Page.enable');
  async function ev(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});if(r.result&&r.result.exceptionDetails)return {__ex:(r.result.exceptionDetails.exception&&r.result.exceptionDetails.exception.description)||r.result.exceptionDetails.text};return r.result&&r.result.result?r.result.result.value:null;}

  await send('Page.navigate',{url:'file:///C:/Users/TECH%20FAZ/Desktop/New%20folder%20(2)/app_fixed.html'}); await sleep(4500);

  // snapshot localStorage to restore afterwards
  await ev(`window.__snap={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); window.__snap[k]=localStorage.getItem(k);}`);

  const made = await ev(`(()=>{
    try{
      const accId = accounts[0].id;
      const nm='جهاز الاختبار الذكي';
      document.getElementById('prodName').value=nm;
      document.getElementById('costPrice').value='1000';
      document.getElementById('prodExpenses').value='50';
      document.getElementById('sellPrice').value='1800';
      document.getElementById('stockQty').value='10';
      document.getElementById('minStock').value='2';
      document.getElementById('prodImei').value='IMEI-TEST-1';
      document.getElementById('productId').value='';
      document.getElementById('prodAccountId').value=String(accId);
      document.getElementById('productForm').requestSubmit();
      const p=products.find(x=>x.name===nm);
      if(!p) return {err:'no product'};
      window.__pid=p.id;
      sellProduct(p.id);
      const q=document.getElementById('sellQty'); if(q){q.value='2';q.dispatchEvent(new Event('input'));}
      const a=document.getElementById('sellAccount'); if(a) a.value=String(accId);
      document.getElementById('modalConfirmBtn').click();
      return {pid:p.id, stock:p.stock};
    }catch(e){return {err:e.message+' | '+(e.stack||'').split('\\n')[1]}}
  })()`);
  await sleep(700);
  console.log('made:', JSON.stringify(made));

  console.log('txn srcs:', JSON.stringify(await ev(`transactions.filter(t=>t.productId==window.__pid||t.sourceType).map(t=>({id:t.id,type:t.type,sourceType:t.sourceType,sourceId:t.sourceId,amount:t.amount}))`)));
  console.log('mov srcs:', JSON.stringify(await ev(`stockMovements.map(sm=>({id:sm.id,sourceType:sm.sourceType,sourceId:sm.sourceId,productId:sm.productId,type:sm.type,qty:sm.quantity}))`)));

  const shc = await ev(`(()=>{try{SHC.runAllChecks();return SHC.issues.map(i=>({c:i.checkId,sev:i.severity,msg:i.msg,details:i.details}))}catch(e){return {err:e.message}}})()`);
  console.log('SHC:', JSON.stringify(shc));

  // restore
  await ev(`(()=>{window.saveData=async()=>{}; window.__saveDataNoop=true; for(let i=localStorage.length-1;i>=0;i--){localStorage.removeItem(localStorage.key(i));} for(const k in window.__snap){localStorage.setItem(k,window.__snap[k]);} return true;})()`);
  await send('Page.navigate',{url:'file:///C:/Users/TECH%20FAZ/Desktop/New%20folder%20(2)/app_fixed.html'}); await sleep(4500);
  const st = await ev(`(async()=>{ try{ if(window.saveAllToIDB) await saveAllToIDB(); }catch(e){ return {err:e.message}; } return {p:products.length,t:transactions.length,i:installments.length,a:accounts.length,liq:+BusinessLogic.liquidTotals().total.toFixed(2)}; })()`);
  console.log('RESTORED:', JSON.stringify(st));
  process.exit(0);
})();
