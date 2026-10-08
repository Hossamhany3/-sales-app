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
  ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
  const send=(method,params)=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
  await new Promise(r=>ws.onopen=r);
  await send('Runtime.enable');
  async function ev(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});if(r.result&&r.result.exceptionDetails)return {__ex:(r.result.exceptionDetails.exception&&r.result.exceptionDetails.exception.description)||r.result.exceptionDetails.text};return r.result&&r.result.result?r.result.result.value:null;}

  console.log('TX', JSON.stringify(await ev(`transactions.map(t=>({id:t.id,type:t.type,amount:t.amount,acc:t.accountId,op:t.operationType,src:t.sourceType+'/'+t.sourceId,notes:(t.notes||'').slice(0,40)}))`),null,1));
  console.log('ACC', JSON.stringify(await ev(`accounts.map(a=>({id:a.id,name:a.name,type:a.type,stored:a.balance,calc:BusinessLogic.accountBalance(a.id)}))`),null,1));
  console.log('SUMMARY', JSON.stringify(await ev(`BusinessLogic.getBusinessSummary()`),null,1));
  console.log('REPORT_BAL', JSON.stringify(await ev(`(()=>{try{renderDashboard();return {balCash:document.getElementById('balCash')?.textContent, balStock:document.getElementById('balStock')?.textContent};}catch(e){return e.message}})()`)));
  console.log('INST', JSON.stringify(await ev(`installments.map(i=>({id:i.id,contractNo:i.contractNo,rem:i.remainingBalance,total:i.totalAfterInterest,sched:(i.schedule||[]).length,acct:i.accountId}))`)));
  console.log('ARABON', JSON.stringify(await ev(`arabonSales.map(a=>({id:a.id,price:a.sellPrice,dep:a.depositAmount,rem:a.remainingAmount,remBal:a.remainingBalance,isPaid:a.isPaid,method:a.remainingPaymentMethod}))`)));
  console.log('MS', JSON.stringify(await ev(`merchantSales.map(s=>({id:s.id,tid:s.transactionId,price:s.sellPrice,qty:s.quantity,acct:s.accountId}))`)));
  console.log('STOCK', JSON.stringify(await ev(`stockMovements.map(s=>({id:s.id,p:s.productId,type:s.type,qty:s.qty,src:s.sourceType+'/'+s.sourceId}))`)));
  console.log('PAYOUTS', JSON.stringify(await ev(`typeof commissionPayouts!=='undefined'? commissionPayouts.length : 'n/a'`)));
  console.log('HEALTH_HTML', JSON.stringify(await ev(`(()=>{try{renderHealthCenter();return document.getElementById('healthCenter')? document.getElementById('healthCenter').innerText.slice(0,1500):Object.keys(document.querySelectorAll('.page')).length}catch(e){return e.message}})()`)));
  ws.close();process.exit(0);
})();
