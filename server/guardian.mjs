import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {EventEmitter} from 'node:events';
import {ensureHost} from './build.mjs';

export class Guardian extends EventEmitter {
  constructor(env,{spawnProcess=spawn,host=ensureHost,bootTimeout=10000}={}) { super(); this.env=env; this.spawnProcess=spawnProcess;this.host=host;this.bootTimeout=bootTimeout; this.pending=new Map(); this.seq=0; this.state='idle'; }
  async start() {
    if(this.starting)return this.starting;
    if(this.proc&&this.initialized) return;
    this.starting=this.boot();
    try{await this.starting;}finally{this.starting=null;}
  }
  async boot() {
    this.expectedIdleExit=false;
    const {exe}=this.host();
    const proc=this.spawnProcess(exe,['--guardian'],{windowsHide:true,env:{...process.env,...this.env,AGCU_GUARDIAN:'1'},stdio:['pipe','pipe','pipe']});this.proc=proc;this.initialized=false;
    this.stderr='';proc.stderr.on('data',d=>{if(this.proc===proc)this.stderr=(this.stderr+d).slice(-2048);});
    proc.stdin.on('error',()=>{});
    const failure=(code,message)=>Object.assign(Error(message),{code});
    const boot=new Promise((resolve,reject)=>{
      this.ready=resolve;this.bootReject=reject;
      this.bootTimer=setTimeout(()=>{reject(failure('guardian_start_timeout','Local controls did not become ready. Use diagnostics; do not repeat startup.'));proc.kill();},this.bootTimeout);
    });
    createInterface({input:proc.stdout}).on('line',line=>{
      if(this.proc!==proc)return;
      let m;try{m=JSON.parse(line);}catch{return;}
      if(m.ev==='ready'){clearTimeout(this.bootTimer);this.initialized=true;this.pid=m.pid;this.ready();}
      if(m.ev==='error'){clearTimeout(this.bootTimer);this.bootReject(failure('guardian_start_failed',m.message));proc.kill();}
      if(m.ev==='state'){this.state=m.state;this.customCursor=m.custom_cursor;this.emit('state',m.state,m.reason);}
      if(m.ev==='human_resume'||m.ev==='host_resume')this.emit('resume',m.state,m.ev);
      if(m.ev==='settings'){this.takeoverMode=m.takeover_mode;this.emit('settings',m);}
      const p=this.pending.get(m.id);if(p){this.pending.delete(m.id);clearTimeout(p.timer);p.resolve(m);}
    });
    proc.on('close',(code,signal)=>{
      if(this.proc!==proc)return;
      clearTimeout(this.bootTimer);this.lastExit={code,signal};this.bootReject(failure('guardian_exited','Local controls exited before readiness. Run diagnostics; restarting cannot clear Stop.'));this.initialized=false;
      this.proc=null;this.state=this.expectedIdleExit?'idle':'stopped';this.emit('state',this.state,this.expectedIdleExit?'normal_shutdown':'guardian_exited');
      for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Permission UI closed'));}this.pending.clear();
    });
    proc.on('error',e=>{if(this.proc!==proc)return;clearTimeout(this.bootTimer);this.bootReject(failure('guardian_spawn_failed',e.message));});
    await boot;
  }
  send(m){if(this.proc&&!this.proc.killed&&!this.proc.stdin.destroyed)this.proc.stdin.write(JSON.stringify(m)+'\n');}
  async request(m){
    await this.start();
    const id=++this.seq;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);this.send({op:'stop'});reject(Object.assign(new Error('Local controls did not answer; inspect diagnostics.'),{code:'guardian_request_timeout'}));},m.op==='prompt'?95000:10000);
      this.pending.set(id,{resolve,reject,timer});this.send({...m,id});
    });
  }
  async prompt(m){return this.request({op:'prompt',...m});}
  async close({normal=false}={}){
    const proc=this.proc;if(!proc)return;
    this.expectedIdleExit=normal;
    this.send({op:'shutdown'});proc.stdin.end();
    await new Promise(resolve=>{const timer=setTimeout(()=>{try{proc.kill();}catch{}resolve();},3000);proc.once('close',()=>{clearTimeout(timer);resolve();});});
  }
}
