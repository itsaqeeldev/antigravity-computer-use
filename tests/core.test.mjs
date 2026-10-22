import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,TOOLS,content,call} from '../server/mcp.mjs';
import {appKey,imagePoint,requireObservation} from '../server/runtime.mjs';
import {targetImageSize} from '../server/upstream-utils.mjs';
test('MCP contains discovery, native actions, lifecycle and clip tools',()=>{
 for(const name of ['apps','snapshot','move','click','type','key','drag','scroll','grant','end','pause','stop','clipboard','launch'])assert(TOOLS.some(t=>t.name==='computer_'+name));
});
for(const extra of ['confirmed','preapprove','__permit','__session','mode','takeover_mode'])test('model cannot provide '+extra,()=>assert.throws(()=>validate('computer_click',{hwnd:1,observation_id:'x',reason:'test',[extra]:true})));
test('booleans/fractions cannot act as handles',()=>{for(const hwnd of [true,1.5])assert.throws(()=>validate('computer_snapshot',{hwnd}));});
test('unbounded clicks, wheel deltas and drag interpolation are rejected',()=>{
 const common={hwnd:1,observation_id:'x',reason:'fixture'};
 for(const clicks of [0,4,1000000])assert.throws(()=>validate('computer_click',{...common,clicks}));
 assert.throws(()=>validate('computer_scroll',{...common,amount:1000000}));
 assert.throws(()=>validate('computer_drag',{...common,from:[0,0],to:[1,1],steps:121}));
 validate('computer_click',{...common,clicks:2});
});
test('MCP returns native image block',()=>{const c=content({metadata:{hwnd:1},image:{data:'xyz',mime:'image/jpeg',width:1}});assert.equal(c[1].type,'image');assert(!c[0].text.includes('xyz'));});
test('process restart and same-name apps have different identity',()=>{
 assert.notEqual(appKey({pid:1,started:'10',path:'x.exe'}),appKey({pid:1,started:'11',path:'x.exe'}));
 assert.notEqual(appKey({pid:1,started:'10',path:'x.exe'}),appKey({pid:2,started:'10',path:'x.exe'}));
});
test('observation is consumed exactly once',()=>{
 const map=new Map([['x',{at:100,hwnd:2}]]);assert(requireObservation(map,'x',2,200));assert.throws(()=>requireObservation(map,'x',2,201));
});
test('stale and wrong-window observations refuse and consume',()=>{
 for(const [hwnd,now] of [[3,100],[2,90200]]){const m=new Map([['x',{at:100,hwnd:2}]]);assert.throws(()=>requireObservation(m,'x',hwnd,now));assert(!m.size);}
});
test('image coordinate mapping includes negative monitor origin',()=>{
 const image={width:1000,height:500,source:[-2000,-100,2000,1000]};assert.deepEqual(imagePoint(image,500,250),[-1000,400]);
 for(const xy of [[-1,0],[1000,0],[0,500],[1.2,3]])assert.throws(()=>imagePoint(image,...xy));
});
for(const [w,h] of [[3840,2160],[2160,3840],[800,600],[100,4000]])test('image sizing '+w+'x'+h,()=>{
 const [x,y]=targetImageSize(w,h);assert(x<=1400&&y<=1400&&x<=w&&y<=h);assert(Math.abs(x/y-w/h)<.02);
});
test('batch stops on failure and never runs later actions',async()=>{
 let n=0;const r={action:async()=>{if(++n===2)throw new Error('denied');return {metadata:{observation_id:'next'}};}};
 const result=await call(r,'computer_run',{hwnd:1,observation_id:'start',reason:'test',steps:[{kind:'type',text:'one'},{kind:'key',keys:'enter'},{kind:'type',text:'must not run'}]});
 assert.equal(n,2);assert.equal(result.completed.length,1);assert.equal(result.skipped,1);
});
