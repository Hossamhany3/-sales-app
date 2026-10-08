const fs = require('fs');
const path = require('path');
const root = __dirname;
const h = fs.readFileSync(path.join(root, 'app_fixed.html'), 'utf8');
const tmp = process.env.TEMP + '/script2.js';
const code = fs.readFileSync(tmp, 'utf8');

const defined = new Set();
for (const m of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
for (const m of code.matchAll(/\b(?:window\.)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g)) defined.add(m[1]);
for (const m of code.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
for (const m of code.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
for (const m of h.matchAll(/\bid=["']([^"']+)["']/g)) defined.add(m[1]);

const called = new Set();
const callSites = new Map();
function note(name, where) {
  called.add(name);
  if (!callSites.has(name)) callSites.set(name, where);
}
for (const m of h.matchAll(/\bon[a-z]+=["']([^"']+)["']/g)) {
  const line = h.slice(0, m.index).split('\n').length;
  for (const c of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) note(c[1], 'HTML line ' + line);
}
for (const m of code.matchAll(/(?<![.A-Za-z_$'"`])([A-Za-z_$][\w$]*)\s*\(/g)) {
  const line = code.slice(0, m.index).split('\n').length;
  note(m[1], 'JS line ' + line);
}
const keywords = new Set(['if','for','while','switch','catch','return','typeof','function','new','await','delete','void','in','of','do','else','try','throw','yield','case','constructor','super','get','set','async','matchAll','forEach','map','filter','reduce','find','findIndex','includes','indexOf','push','join','split','replace','replaceAll','sort','slice','splice','concat','toFixed','parseInt','parseFloat','isNaN','require','console','document','window','String','Number','Boolean','Array','Object','Math','JSON','Date','Promise','RegExp','Set','Map','Error','isNaN','alert','confirm','prompt','fetch','setTimeout','setInterval','clearTimeout','clearInterval','addEventListener','querySelector','querySelectorAll','getElementById','test','exec','replace','toString','then','catch','keys','values','entries','assign','create','from','of','fill','clamp','min','max','abs','round','floor','ceil','random','now','log','warn','error','info','stringify','parse','toLocaleString','toFixed','padStart','padEnd','startsWith','endsWith','trim','toLowerCase','toUpperCase','charAt','charCodeAt','apply','call','bind','has','get','set','delete','close','preventDefault','stopPropagation','focus','blur','click','reset','submit','sort','reverse','flat','some','every','reduceRight','copyWithin','fill','at','concat','item']);
const missing = [...called].filter(x => !defined.has(x) && !keywords.has(x)).sort();
for (const x of missing) console.log(x.padEnd(30), callSites.get(x));
console.log('TOTAL', missing.length);
