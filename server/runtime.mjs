// Antigravity adapter over the MIT ridelink native host and input-lease implementation.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {Driver,HostError} from './driver.mjs';
import {Guardian} from './guardian.mjs';
import {Sessions} from './sessions.mjs';
import {dataDir} from './build.mjs';
import {classify,TIER} from './policy.mjs';
import {renderSnapshot} from './render.mjs';
import {targetImageSize} from './upstream-utils.mjs';

const input=new Set(['move','click','type','set_value','key','scroll','drag','focus','close_window','paste','paste_files','clipboard','open','file_dialog']);
const fail=(code,message)=>{throw new HostError(code,message,null);};
export function appKey(w){return `${w.pid}:${w.started}:${String(w.path).toLowerCase()}`;}
export function requireObservation(map,id,hwnd,now=Date.now()){
  const frame=map.get(id);map.delete(id);
  if(!frame||frame.hwnd!==Number(hwnd)||now-frame.at>90000)fail('stale_observation','Observe again: missing, consumed or stale observation.');
  return frame;
}
export function imagePoint(image,x,y){
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=image.width||y>=image.height)fail('bad_point','Point is outside the screenshot.');
  const r=image.source;
  return [r[0]+Math.floor(x*r[2]/image.width),r[1]+Math.floor(y*r[3]/image.height)];
}

export class Runtime {
  constructor({driver=null,guardian=null,sessions=null,permissionMode=process.env.AGCU_PERMISSION_MODE||'standalone',takeoverMode=process.env.AGCU_TAKEOVER_MODE||'manual'}={}){
    if(!['standalone','host-managed'].includes(permissionMode))throw new Error('Invalid startup permission mode');
    this.permissionMode=permissionMode;
    if(!['manual','smart'].includes(takeoverMode))throw new Error('Invalid startup takeover mode');this.takeoverMode=takeoverMode;
    fs.mkdirSync(dataDir(),{recursive:true});
    this.guardFile=path.join(dataDir(),`guard-${process.pid}-${randomUUID()}.state`);
    fs.writeFileSync(this.guardFile,'idle||0|');
    const env={AGCU_GUARD_FILE:this.guardFile,AGCU_PARENT_PID:String(process.pid),AGCU_PERMISSION_MODE:permissionMode,AGCU_TAKEOVER_MODE:takeoverMode,AGCU_REAL_CURSOR:'1',CU_OVERLAY:'off',CU_PRESENCE:'off',CU_MODE:'take'};
    this.driver=driver||new Driver({env});this.guardian=guardian||new Guardian(env);
    this.sessions=sessions||new Sessions({sessionId:randomUUID()});this.sessions.register();
    this.grants=new Map();this.frames=new Map();this.generation=0;this.state='idle';this.token='';this.remaining=200;
    this.guardian.on('state',s=>{
      this.state=s;
      if(s!=='active'){
        this.generation++;this.frames.clear();
        if(s==='stopped'||s==='idle'){this.grants.clear();this.token='';}
        if(s==='stopped'||s==='paused')this.driver.abort?.().catch(()=>{});
      }
    });
    this.guardian.on('resume',()=>this.frames.clear());
  }
  stamp(){return {__session:this.token};}
  check(){if(this.state!=='active')fail('control_inactive',`Control is ${this.state}. Use the local Resume/Re-arm control or request a new grant.`);}
  async identity(hwnd){
    if(!Number.isSafeInteger(Number(hwnd))||Number(hwnd)<=0)fail('no_target','Select an HWND from computer_apps.');
    return (await this.driver.call('identity',{hwnd:Number(hwnd)})).result;
  }
  async app(hwnd){
    const identity=await this.identity(hwnd);
    const wins=(await this.driver.call('list_apps',{})).result.windows;
    const listed=wins.find(w=>Number(w.hwnd)===Number(hwnd));
    if(!listed)fail('window_not_found','Refresh computer_apps; target closed.');
    const w={...listed,...identity};
    this.guardian.send({op:'attach',pid:this.driver.info?.pid});
    if([process.pid,process.ppid,this.driver.info?.pid,this.guardian.pid].includes(w.pid)||classify(w).tier===TIER.BLOCKED)
      fail('protected_app','This is a protected app or the control/host UI.');
    return w;
  }
  async grant(hwnd,purpose='Operate this app for the requested desktop task'){
    if(this.state==='stopped'||this.state==='paused')this.check();
    const w=await this.app(hwnd);const key=appKey(w);
    if(this.grants.has(key)&&this.state==='active')return w;
    const answer=await this.guardian.prompt({kind:'app',hwnd:Number(hwnd),host_pid:this.driver.info?.pid,
      message:`Allow this application for this session?\r\n\r\n${w.title}\r\n${w.path}\r\nPID ${w.pid}\r\n\r\nTask: ${purpose}\r\n\r\nIts screenshots and accessibility text go to Antigravity's configured model. Ordinary actions run autonomously. Consequential effects need a separate confirmation. Your real mouse/keyboard will be used. Esc or Ctrl+Alt+F12 stops. Use a disposable account/VM for important data.`});
    if(!answer.allowed)fail(answer.decision==='timeout'?'approval_timeout':'permission_denied',answer.decision==='timeout'?'Local application approval timed out.':'The human denied this application.');
    this.guardian.send({op:'attach',pid:this.driver.info?.pid});
    const current=await this.app(hwnd);if(appKey(current)!==key)fail('identity_changed','Application restarted during approval.');
    if(!this.token){this.token=randomUUID();this.deadline=Date.now()+10*60000;this.remaining=200;}
    const active=await this.guardian.request({op:'activate',token:this.token,deadline:(BigInt(this.deadline)*10000n+621355968000000000n).toString()});
    if(!active.allowed)fail('control_inactive','Use the local controls to re-arm.');
    this.state='active';this.grants.set(key,{...current,purpose});return current;
  }
  async observe(args){
    const w=await this.grant(Number(args.hwnd),args.reason);this.check();
    this.guardian.send({op:'activity',action:'observe'});
    const metadata={...this.stamp(),hwnd:Number(args.hwnd),__pid:w.pid,__started:w.started};
    const tree=(await this.driver.call('snapshot',{...metadata,max_nodes:Math.min(args.max_nodes||160,500)})).result;
    const response={observation_id:randomUUID(),hwnd:Number(args.hwnd),app:w.path,at:Date.now(),tree:renderSnapshot(tree,{withRects:true,maxRows:160}),elements:tree.nodes};
    let image;
    if(args.with_image!==false){
      await this.guardian.request({op:'capture'});
      try { image=(await this.driver.call('screenshot',{...metadata,max_width:Math.min(args.max_width||1400,targetImageSize(w.rect[2],w.rect[3])[0]),quality:80})).result; }
      finally { this.guardian.send({op:'capture_end'}); }
      response.image={...image};delete response.image.data;
    }
    this.frames.set(response.observation_id,{at:response.at,hwnd:response.hwnd,key:appKey(w),snapshot:tree.snapshot_id,image});
    return {metadata:response,image};
  }
  async action(op,args){
    if(!input.has(op))fail('unsupported_action','Unknown input operation.');
    if('confirmed' in args||'preapprove' in args)fail('model_approval_forbidden','Model-supplied approval flags are not accepted.');
    const w=args.hwnd!=null?await this.grant(Number(args.hwnd),args.reason):null;
    this.check();if(Date.now()>=this.deadline||this.remaining<=0)fail('session_limit','Session expired or action budget exhausted. End and obtain a new human grant.');
    const generation=this.generation;
    const payload={...args,...this.stamp(),mode:'take',__risk:args.risk==='routine'?'routine':'sensitive'};
    delete payload.risk;delete payload.reason;delete payload.observation_id;
    if(w){
      payload.hwnd=Number(w.hwnd);payload.__pid=w.pid;payload.__started=w.started;
      if(op!=='focus'&&op!=='close_window'){
        const f=requireObservation(this.frames,args.observation_id,w.hwnd);
        if(f.key!==appKey(w))fail('identity_changed','App identity changed since observation.');
        if(f.image&&JSON.stringify(f.image.source)!==JSON.stringify(w.rect))fail('window_moved','Window moved or resized. Observe again.');
        if(args.index!=null){payload.snapshot_id=f.snapshot;}
        if(args.x!=null||args.y!=null){if(!f.image)fail('no_image','Observe with_image first.');payload.point=imagePoint(f.image,args.x,args.y);delete payload.x;delete payload.y;}
        if(op==='drag'){
          if(!f.image)fail('no_image','Observe with_image first.');
          payload.from=imagePoint(f.image,...args.from);payload.to=imagePoint(f.image,...args.to);
        }
      }
    }
    if(op==='click'&&payload.point)payload.physical=true;
    if(typeof payload.text==='string'&&payload.text.length>20000)fail('text_limit','Text limit is 20,000 characters per action.');
    const preview=(await this.driver.call('authorize',{action_op:op,action_args:payload})).result;
    if(preview.sensitive){
      const answer=await this.guardian.prompt({kind:'action',hwnd:w?.hwnd,host_pid:this.driver.info?.pid,action_op:op,args:payload,label:preview.label||'',
        message:`Approve ONE sensitive operation?\r\n\r\n${args.reason||'No effect explanation supplied — deny if unclear.'}\r\n\r\nApplication: ${w?.path||'Clipboard / desktop'}\r\nControl: ${preview.label||'(pixel/keyboard operation)'}\r\n\r\n${JSON.stringify({operation:op,args},null,2)}\r\n\r\nCheck the actual target. Never let an agent approve this dialog. Deny if the result is unclear.`});
      if(!answer.allowed)fail('permission_denied','Human denied the sensitive operation.');payload.__permit=answer.permit;
    }
    this.check();if(generation!==this.generation)fail('control_changed','Control state changed; observe again.');
    if(w&&appKey(await this.app(w.hwnd))!==appKey(w))fail('identity_changed','Approved process identity changed.');
    this.remaining--;
    const result=await this.sessions.withInput(op,{hwnd:w?.hwnd,title:w?.title},async()=>{
      this.check();if(generation!==this.generation)fail('control_changed','Cancelled before execution.');
      this.guardian.send({op:'activity',action:op});
      const result=(await this.driver.call(op,payload)).result;
      if(op==='click'&&payload.physical)this.guardian.send({op:'activity',action:op,click_feedback:true});
      return result;
    });
    this.check();
    if(op==='close_window')return {result,verification_required:true,refresh_apps:true};
    return {result,verification_required:true,...(w?await this.observe({hwnd:w.hwnd}):{})};
  }
  async finish(){this.generation++;this.frames.clear();this.grants.clear();this.guardian.send({op:'end'});if(!['stopped','paused'].includes(this.state))this.state='idle';this.token='';await this.driver.abort?.();return {ended:true,state:this.state,restart_required:false};}
  async launch(args){
    if(this.state==='stopped'||this.state==='paused')this.check();
    const app=path.resolve(args.app);
    if(!fs.existsSync(app)||path.extname(app).toLowerCase()!=='.exe')fail('invalid_application','Supply an existing .exe path.');
    if(/^AxonHost(?:-[0-9a-f]+)?\.exe$/i.test(path.basename(app)))fail('protected_app','Cannot launch the native control helper as a target application.');
    if(classify({process:path.basename(app),path:app}).tier===TIER.BLOCKED)fail('protected_app','Cannot launch a protected application.');
    await this.guardian.start();
    if(this.state==='stopped'||this.state==='paused')this.check();
    if(!this.token){this.token=randomUUID();this.deadline=Date.now()+10*60000;this.remaining=200;}
    const active=await this.guardian.request({op:'activate',token:this.token,deadline:(BigInt(this.deadline)*10000n+621355968000000000n).toString()});
    if(!active.allowed)fail('control_inactive','Use the local controls.');this.state='active';
    const payload={app,args:args.args||[],...this.stamp(),__risk:'sensitive'};
    await this.driver.start();
    const a=await this.guardian.prompt({kind:'action',host_pid:this.driver.info.pid,action_op:'launch',args:payload,label:'',message:`Launch this application?\r\n\r\n${args.reason}\r\n\r\n${JSON.stringify({app,args:payload.args},null,2)}\r\n\r\nThis starts software with your account's privileges. No shell is used. Approve only if intended.`});
    if(!a.allowed)fail('permission_denied','Human denied application launch.');
    this.check();return (await this.driver.call('launch',{...payload,__permit:a.permit})).result;
  }
  async pause(){this.generation++;this.frames.clear();this.state='paused';this.guardian.send({op:'pause'});await this.driver.abort?.();return {paused:true,human_resume_required:true};}
  async stop(){this.generation++;this.frames.clear();this.grants.clear();this.state='stopped';this.guardian.send({op:'stop'});await this.driver.abort?.();return {stopped:true,human_rearm_required:true};}
  status(){return {state:this.state,remaining_actions:this.remaining,approved_apps:[...this.grants.values()].map(w=>({pid:w.pid,path:w.path})),runtime:'native-windows',real_cursor:true,permission_mode:this.permissionMode,takeover_mode:this.guardian.takeoverMode||this.takeoverMode};}
  async close(){await this.stop();this.guardian.close();this.sessions.close();}
}
