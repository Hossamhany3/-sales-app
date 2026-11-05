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
  ws.onmessage=ev=>{const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
  const send=(method,params)=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
  await new Promise(r=>ws.onopen=r);
  await send('Runtime.enable'); await send('Page.enable');
  async function ev(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});if(r.result&&r.result.exceptionDetails)return {__ex:(r.result.exceptionDetails.exception&&r.result.exceptionDetails.exception.description)||r.result.exceptionDetails.text};return r.result&&r.result.result?r.result.result.value:null;}

  const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['dashboard','products','transactions','installments','arabonSales','merchantSales','partners','accounts','reports'];
  for(const p of pages){
    await ev(`switchPage('${p}')`); await sleep(500);
    const info = await ev(`(()=>{
      const root = document.querySelector('.page.active') || document.body;
      const ids = new Set();
      root.querySelectorAll('input[id],select[id],textarea[id]').forEach(e=>ids.add(e.tagName+':'+e.id+(e.type?'('+e.type+')':'')));
      const btns = Array.from(root.querySelectorAll('button')).map(b=>(b.id?'#'+b.id:'')+'|'+(b.getAttribute('onclick')||'')+'|'+b.innerText.trim().replace(/\\s+/g,' ').slice(0,40)).filter(x=>x.length>2).slice(0,40);
      const forms = Array.from(root.querySelectorAll('form')).map(f=>f.id||'(nofid)');
      return {page:'${p}', ids:Array.from(ids), forms, btns};
    })()`);
    console.log('\n===== '+p+' =====');
    if(info.__ex){console.log('EX: '+info.__ex); continue;}
    console.log('forms: '+JSON.stringify(info.forms));
    console.log('fields:\n  '+info.ids.join('\n  '));
    console.log('buttons:');
    info.btns.forEach(b=>console.log('  '+b));
  }
  process.exit(0);
})();
