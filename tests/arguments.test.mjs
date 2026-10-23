import test from 'node:test';import assert from 'node:assert/strict';
import {parseArguments} from '../scripts/arguments.mjs';import {TOOLS,validate} from '../server/desktop-tools.mjs';
const parse=(command,words,options)=>{const name='computer_'+command;const args=parseArguments(TOOLS.find(t=>t.name===name).inputSchema,words,options);validate(name,args);return args;};
test('named native action flags need no request file and preserve explicit frame/permission boundaries',()=>{
 const args=parse('click',['--hwnd','123','--observation-id','fresh','--index','7','--risk','routine','--reason','Open settings']);
 assert.deepEqual(args,{hwnd:123,observation_id:'fresh',index:7,risk:'routine',reason:'Open settings',observe:{with_image:false}});
 for(const extra of ['--confirmed','--preapprove','--mode','--takeover-mode'])assert.throws(()=>parse('click',['--hwnd','123',extra,'true']));
 assert.throws(()=>parse('click',['--hwnd','123','--index','7','--reason','Missing frame']));
});
test('named observation flags preserve actual image opt-in and bounded native ranges',()=>{
 assert.deepEqual(parse('snapshot',['--hwnd','123','--no-image','--query','JPEG','--settle-ms','600']),{hwnd:123,with_image:false,query:'JPEG',settle_ms:600});
 const args=parse('scroll',['--hwnd','123','--observation-id','f','--index','2','--amount','-3','--reason','Scroll','--image','--query','Output']);
 assert.deepEqual(args.observe,{with_image:true,query:'Output'});assert.equal(args.amount,-3);
 assert.deepEqual(parse('click',['--hwnd','123','--observation-id','f','--index','2','--reason','test','--observe','{"settle_ms":600}']).observe,{with_image:false,settle_ms:600});
 assert.throws(()=>parse('snapshot',['--hwnd','123','--settle-ms','2001']));
 assert.throws(()=>parse('snapshot',['--hwnd','true']));
});
test('UTF-8 text files and batch files do not require shell-embedded private content',()=>{
 const text='اردو — می\u200cخواهم 😀';let reads=0;
 const args=parse('paste',['--hwnd','123','--observation-id','f','--index','2','--text-file','D:/generated.txt','--reason','Paste owned sample'],{read:file=>{reads++;assert.equal(file,'D:/generated.txt');return text;}});
 assert.equal(args.text,text);assert.equal(reads,1);
 const run=parse('run',['--hwnd','123','--observation-id','f','--steps-file','D:/steps.json','--reason','Predictable steps'],{read:()=>JSON.stringify([{kind:'key',keys:'tab'}])});assert.equal(run.steps.length,1);
 assert.throws(()=>parse('type',['--hwnd','123','--observation-id','f','--text-file','x','--reason','Too long'],{read:()=>'a'.repeat(401)}));
});
test('legacy JSON requests remain unchanged; duplicate/unknown/ambiguous flags refuse before dispatch',()=>{
 const original={hwnd:123,observation_id:'f',index:7,reason:'Click'};
 assert.deepEqual(parse('click',[JSON.stringify(original)]),original);
 assert.deepEqual(parse('click',['--request','file'],{read:()=>JSON.stringify(original)}),original);
 for(const words of [['--hwnd'],['--hwnd','123','--hwnd','456'],['--request','file','--index','7'],['--unknown','x']])assert.throws(()=>parse('click',words));
 assert.throws(()=>parse('paste',['--hwnd','123','--observation-id','f','--text','x','--text-file','file','--reason','Ambiguous'],{read:()=>''}));
 for(const flags of [['--observe','{}','--query','x'],['--query','x','--observe','{}']])assert.throws(()=>parse('click',['--hwnd','123','--observation-id','f','--reason','test',...flags]),/not both/);
 assert.throws(()=>parse('drag',['--hwnd','123','--observation-id','f','--reason','test','--from','1,','--to','2,3']),/empty array/);
});
