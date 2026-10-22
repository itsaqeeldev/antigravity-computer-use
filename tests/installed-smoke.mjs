// Read-only smoke test of the exact Agent Manager stdio entry. No desktop grant.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';
const file=process.argv[2]||path.join(os.homedir(),'.gemini','config','mcp_config.json');
const entry=JSON.parse(fs.readFileSync(file,'utf8')).mcpServers['antigravity-computer-use'];assert(entry);
const p=spawn(entry.command,entry.args,{windowsHide:true,env:{...process.env,...entry.env},stdio:['pipe','pipe','pipe']});
const pending=new Map();let seq=0;const errors=[];p.stderr.on('data',d=>errors.push(String(d)));
createInterface({input:p.stdout}).on('line',line=>{let m;try{m=JSON.parse(line);}catch{return;}const resolve=pending.get(m.id);if(resolve){pending.delete(m.id);resolve(m);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const t=setTimeout(()=>reject(new Error('Installed MCP timed out: '+errors.join(''))),8000);pending.set(id,m=>{clearTimeout(t);resolve(m.result);});p.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
try {
 const init=await call('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'installed-smoke',version:'1'}});assert.equal(init.serverInfo.name,'antigravity-computer-use');
 const tools=await call('tools/list');assert.equal(tools.tools.length,21);assert(tools.tools.some(t=>t.name==='computer_move'));
 const status=await call('tools/call',{name:'computer_status',arguments:{}});assert(!status.isError);const value=JSON.parse(status.content[0].text);assert.equal(value.permission_mode,'host-managed');assert.equal(value.state,'idle');assert.equal(value.approved_apps.length,0);
 console.log(JSON.stringify({passed:true,installed_stdio:true,tools:tools.tools.length,permission_mode:value.permission_mode,no_desktop_access:true},null,2));
}finally {p.stdin.end();setTimeout(()=>{if(p.exitCode===null)p.kill();},1000).unref();}
