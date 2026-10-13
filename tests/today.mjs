import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const start = source.indexOf('function kcalToday()');
const end = source.indexOf('/* ============================================================\n   SCREEN C',start);
const nodes = new Map();
const el = id => {if(!nodes.has(id))nodes.set(id,{innerHTML:'',hidden:false});return nodes.get(id);};
const entry = {id:'sample',date:'2026-10-12',food:'Oats <script>alert(1)</script>',kcal:312,tier:'form'};
const sandbox = vm.createContext({
  document:{getElementById:el},store:{getProfile:()=>null,getEntries:()=>[entry]},
  localDate:()=> '2026-10-12',DEMO:false,DEMO_FIXTURE:null,
  escapeHtml:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),tierBadge:t=>t
});
vm.runInContext(source.slice(start,end),sandbox);
vm.runInContext('renderToday()',sandbox);
assert.match(el('todayLog').innerHTML,/Oats &lt;script&gt;/,'locally logged foods stay visible before profile setup');
assert.match(el('todayLog').innerHTML,/312 kcal/);
assert.doesNotMatch(el('todayLog').innerHTML,/<script>/);
assert.equal(el('todayMacros').hidden,true,'target card hides when no profile exists');
assert.match(el('todayEnergy').innerHTML,/Create profile/);
assert.ok(el('todayTicker').innerHTML.length>0,'unavailable targets have an explained empty state');
console.log('PASS profile-free log visibility, escaped food names, explained target state');
