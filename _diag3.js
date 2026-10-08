const http = require('http');
const PORT = 9333;
function get(url){return new Promise((res,rej)=>{http.get(url,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);});}
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  let targets=null;
  for(let i=0;i<40;i++){try{targets=JSON.parse(await get(`http://127.0.0.1:${PORT}/json`));break;}catch(e){await sleep(500);}}
  const page=targets.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0;const pending=new Map();const errs=[];
  ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);return;}
    if(m.method==='Runtime.exceptionThrown'){const d=m.params.exceptionDetails;errs.push((d.exception&&d.exception.description)||d.text);}};
  const send=(method,params)=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
  await new Promise(r=>ws.onopen=r);
  await send('Runtime.enable');
  async function ev(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});if(r.result&&r.result.exceptionDetails)return {__ex:(r.result.exceptionDetails.exception&&r.result.exceptionDetails.exception.description)||r.result.exceptionDetails.text};return r.result&&r.result.result?r.result.result.value:null;}

  // refresh selectors first
  await ev('refreshSelectors()');

  const selects = await ev(`[...document.querySelectorAll('select')].map(s=>({id:s.id, opts:s.options.length, txt:[...s.options].slice(0,3).map(o=>o.text).join('|').slice(0,80)}))`);
  const accSelects = selects.filter(s => s.id && /acc|bank|cash|wallet/i.test(s.id));
  console.log('ACC_SELECTS', JSON.stringify(accSelects,null,1));
  console.log('ALL_SELECTS_COUNT', selects.length);
  const empty = selects.filter(s=>s.opts<=1);
  console.log('EMPTY_SELECTS', JSON.stringify(empty,null,1));

  // statement before/after a new sale
  const before = await ev(`(()=>{try{showAccountStatement(102);return document.getElementById('modalMessage').innerText.slice(0,900)}catch(e){return 'ERR '+e.message}})()`);
  console.log('STMT_BEFORE', JSON.stringify(before));

  const sale = await ev(`JSON.stringify(BusinessLogic.sellCash({productId:301, qty:1, accountId:102}))`);
  console.log('SALE', sale);

  await ev('renderAccounts(); renderTransactions(); renderDashboard(); refreshSelectors()');
  const after = await ev(`(()=>{try{showAccountStatement(102);return document.getElementById('modalMessage').innerText.slice(0,900)}catch(e){return 'ERR '+e.message}})()`);
  console.log('STMT_AFTER', JSON.stringify(after));
  console.log('BAL_AFTER', JSON.stringify(await ev('accounts.map(a=>({n:a.name,stored:a.balance,calc:BusinessLogic.accountBalance(a.id)}))')));

  // check the account page card balance text
  console.log('ACCOUNTS_PAGE', JSON.stringify(await ev(`(()=>{renderAccounts();return document.getElementById('accountsList').innerText.slice(0,600)})()`)));
  console.log('ERRS', JSON.stringify(errs));
  ws.close();process.exit(0);
})();
