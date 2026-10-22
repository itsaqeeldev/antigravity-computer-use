import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {EventEmitter} from 'node:events';
import {ensureHost} from './build.mjs';

export class Guardian extends EventEmitter {
  constructor(env) { super(); this.env=env; this.pending=new Map(); this.seq=0; this.state='idle'; }
  async start() {
    if(this.proc) return;
    const {exe}=ensureHost();
    this.proc=spawn(exe,['--guardian'],{windowsHide:true,env:{...process.env,...this.env,AGCU_GUARDIAN:'1'},stdio:['pipe','pipe','pipe']});
    this.proc.stderr.on('data',d=>process.stderr.write(d));
    const boot=new Promise((resolve,reject)=>{
      this.ready=resolve;this.bootReject=reject;
      this.bootTimer=setTimeout(()=>reject(new Error('Permission UI did not start')),10000);
    });
    createInterface({input:this.proc.stdout}).on('line',line=>{
      let m;try{m=JSON.parse(line);}catch{return;}
      if(m.ev==='ready'){clearTimeout(this.bootTimer);this.pid=m.pid;this.ready();}
      if(m.ev==='error'){clearTimeout(this.bootTimer);this.bootReject(new Error(m.message));}
      if(m.ev==='state'){this.state=m.state;this.emit('state',m.state,m.reason);}
      if(m.ev==='human_resume')this.emit('resume',m.state);
      if(m.ev==='settings'){this.takeoverMode=m.takeover_mode;this.emit('settings',m);}
      const p=this.pending.get(m.id);if(p){this.pending.delete(m.id);clearTimeout(p.timer);p.resolve(m);}
    });
    this.proc.on('exit',()=>{
      this.proc=null;this.state='stopped';this.emit('state','stopped');
      for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Permission UI closed'));}this.pending.clear();
    });
    this.proc.on('error',e=>this.bootReject(e));
    await boot;
  }
  send(m){if(this.proc&&!this.proc.killed)this.proc.stdin.write(JSON.stringify(m)+'\n');}
  async request(m){
    await this.start();
    const id=++this.seq;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);this.send({op:'stop'});reject(new Error('Local approval timed out'));},95000);
      this.pending.set(id,{resolve,reject,timer});this.send({...m,id});
    });
  }
  async prompt(m){return this.request({op:'prompt',...m});}
  close(){if(this.proc){this.send({op:'stop'});this.proc.stdin.end();}}
}
