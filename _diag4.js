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

  await ev('refreshSelectors()');
  const all = await ev(`[...document.querySelectorAll('select')].map(s=>({id:s.id, opts:s.options.length, first:[...s.options].slice(0,2).map(o=>o.text).join('|')}))`);
  console.log('ALL_SELECTS'); all.forEach(s=>console.log('  ', String(s.id).padEnd(26), String(s.opts).padStart(3), s.first.slice(0,60)));

  // statement overlay test
  await ev('document.getElementById("accountStatementOverlay")?.remove()');
  const r1 = await ev(`(()=>{try{showAccountStatement(102); const o=document.getElementById('accountStatementOverlay'); return o? o.innerText.slice(0,700):'NO_OVERLAY';}catch(e){return 'THROW '+e.message}})()`);
  console.log('STMT102', JSON.stringify(r1));
  await ev('document.getElementById("accountStatementOverlay")?.remove()');
  const r2 = await ev(`(()=>{try{showAccountStatement(101); const o=document.getElementById('accountStatementOverlay'); return o? o.innerText.slice(0,700):'NO_OVERLAY';}catch(e){return 'THROW '+e.message}})()`);
  console.log('STMT101', JSON.stringify(r2));
  await ev('document.getElementById("accountStatementOverlay")?.remove()');

  // does adding a new account refresh selectors?
  const t0 = await ev('document.getElementById("prodBankAccSelect").options.length');
  await ev(`accounts.push({id:999,name:'بنك تجريبي',type:'bank',balance:0,createdAt:new Date().toISOString()}); saveData(); renderAccounts(); refreshSelectors();`);
  const t1 = await ev('document.getElementById("prodBankAccSelect").options.length');
  console.log('SELECTOR_REFRESH', t0, '->', t1);

  // where do transactions lack accountId?
  console.log('NO_ACC_TX', JSON.stringify(await ev(`transactions.filter(t=>!t.accountId && t.type!=='transfer_in' && t.type!=='transfer_out').map(t=>({type:t.type,amount:t.amount,notes:(t.notes||'').slice(0,30)}))`)));
  console.log('ORPHAN_ACC_TX', JSON.stringify(await ev(`transactions.filter(t=>t.accountId && !accounts.find(a=>a.id==t.accountId)).map(t=>({type:t.type,acc:t.accountId,amount:t.amount}))`)));
  console.log('NO_DATE_TX', JSON.stringify(await ev(`transactions.filter(t=>!t.date).length`)));

  // liquid comparison
  console.log('LIQ', JSON.stringify(await ev(`({fin_cash:(()=>{const f=getFinancials();return f.cash})(), summary:BusinessLogic.getBusinessSummary(), acctSum:accounts.reduce((s,a)=>s+BusinessLogic.accountBalance(a.id),0), openingCapital})`)));
  ws.close();process.exit(0);
})();
