// Antigravity adapter over the MIT ridelink native host and input-lease implementation.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Driver,HostError} from './driver.mjs';
import {Guardian} from './guardian.mjs';
import {Sessions} from './sessions.mjs';
import {dataDir} from './build.mjs';
import {classify,TIER} from './policy.mjs';
import {renderSnapshot,subtreeNodes} from './render.mjs';
import {targetImageSize} from './upstream-utils.mjs';
import {VERSION,BUILD_ID} from './version.mjs';
import {storageOperation} from './storage.mjs';
import {contract,nativePlatform,launchTarget,executableKey} from './platform.mjs';
import {Incidents} from './incidents.mjs';
import {updateNotice} from './update-notice.mjs';
import {recoveryAdvice} from './recovery.mjs';

const input=new Set(['move','click','type','set_value','key','scroll','drag','focus','fit_window','close_window','paste','paste_files','clipboard','open','file_dialog']);
const fail=(code,message)=>{throw new HostError(code,message,null);};
const persistenceFailure=reason=>['stop_persistence_failed','guard_persistence_failed'].includes(reason);
export function savedTakeoverMode(file,fallback){
  try {const mode=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')).takeover_mode;if(['manual','smart'].includes(mode))return mode;}catch{}
  return fallback;
}
export function appKey(w,platform=process.platform){return `${w.pid}:${w.started}:${executableKey(w.path,platform)}`;}
export function requireObservation(map,id,hwnd,now=Date.now()){
  const frame=map.get(id);map.delete(id);
  if(!frame||frame.hwnd!==Number(hwnd)||now-frame.at>contract.frame_ms)fail('stale_observation','Observe again: missing, consumed or stale observation.');
  return frame;
}
export function imagePoint(image,x,y){
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=image.width||y>=image.height)fail('bad_point','Point is outside the screenshot.');
  const r=image.source;
  return [r[0]+Math.floor(x*r[2]/image.width),r[1]+Math.floor(y*r[3]/image.height)];
}

// Snapshot IDs and row indexes are observation-scoped transport handles, not
// visible content. Mac can renumber unchanged controls on the next capture.
export function comparableView(tree){
 const space=typeof tree==='string'?tree.indexOf(' '):-1;
 if(space<0)fail('invalid_observation','The observed tree cannot be compared. Take a fresh snapshot.');
 return tree.slice(space+1).replace(/^(\[)\d+(\])/gm,'$1#$2').replace(/(\| focus \[)\d+(\])/,'$1#$2');
}

// Keep the controls belonging to a matching named section. Returning only its
// label made "Export format" hide PNG/JPEG and forced another full-tree read.
// Reuse the foundation's bounded, depth-first subtree traversal; all indexes
// still come from this same observation and retain their offscreen state.
export function queryNodes(nodes,query){
 const needle=String(query||'').trim().toLowerCase();if(!needle)return nodes;
 const selected=new Set();
 for(const node of nodes){
  if(![node.name,node.text,node.value,node.role].some(v=>String(v??'').toLowerCase().includes(needle)))continue;
  const context=Number.isInteger(node.depth)&&node.depth>=0?subtreeNodes(nodes,node.i):null;
  for(const entry of context||[node])selected.add(entry.i);
 }
 return nodes.filter(node=>selected.has(node.i));
}

export function observedIndex(elements,selector){
 const fields=['name','role','automation_id'].filter(k=>Object.hasOwn(selector,k));
 if(!fields.length||fields.some(k=>typeof selector[k]!=='string'||!selector[k].trim()||selector[k].length>1000))fail('bad_selector','Supply a nonempty exact observed name, role or automation_id.');
 const matches=(elements||[]).filter(node=>fields.every(key=>String(key==='automation_id'?(node.aid??node.automation_id??''):(node[key]??''))===selector[key]));
 if(matches.length!==1)fail(matches.length?'ambiguous_observed_target':'target_not_observed',matches.length?'Several controls match that exact name/role/id. Inspect and select an index.':'No control in this observation matches that exact name/role/id. Observe the relevant section; no input was sent.');
 if(!Number.isSafeInteger(matches[0].i)||matches[0].i<0)fail('bad_observed_target','The observed control has no valid native index. Observe again; no input was sent.');
 return matches[0].i;
}

export class Runtime {
  constructor({driver=null,guardian=null,sessions=null,latchFile=undefined,permissionMode=process.env.AGCU_PERMISSION_MODE||'standalone',takeoverMode=process.env.AGCU_TAKEOVER_MODE||'manual'}={}){
    if(!['standalone','host-managed'].includes(permissionMode))throw new Error('Invalid startup permission mode');
    this.permissionMode=permissionMode;
    if(!['manual','smart'].includes(takeoverMode))throw new Error('Invalid startup takeover mode');this.takeoverMode=takeoverMode;
    this.privateDataStorage=null;
    if(!driver&&!guardian)this.privateDataStorage=storageOperation('data',dataDir()).private_storage===true;
    else fs.mkdirSync(dataDir(),{recursive:true}); // inert unit-test dependencies
    this.latchFile=latchFile===undefined?(!driver&&!guardian?path.join(dataDir(),'emergency.stop'):null):latchFile;
    this.guardFile=path.join(dataDir(),`guard-${process.pid}-${randomUUID()}.state`);
    fs.writeFileSync(this.guardFile,'idle||0|',{mode:0o600});
    const env={AGCU_GUARD_FILE:this.guardFile,AGCU_CONTRACT_FILE:fileURLToPath(new URL('./control-contract.json',import.meta.url)),AGCU_STOP_LATCH:this.latchFile||'',AGCU_PARENT_PID:String(process.pid),AGCU_PERMISSION_MODE:permissionMode,AGCU_TAKEOVER_MODE:takeoverMode,AGCU_REAL_CURSOR:'1',CU_OVERLAY:'off',CU_PRESENCE:'off',CU_MODE:'take'};
    this.driver=driver||new Driver({env,onEvent:event=>{if(event.event==='input_cleanup_failed')this.stop().catch(()=>{});}});this.guardian=guardian||new Guardian(env);
    this.sessions=sessions||new Sessions({sessionId:randomUUID()});this.sessions.register();
    this.grants=new Map();this.frames=new Map();this.generation=0;this.state='idle';this.token='';this.remaining=contract.action_budget;
    this.lastControlReason='';
    if(this.latchFile&&fs.existsSync(this.latchFile)){this.state='stopped';this.lastControlReason='persisted_emergency_stop';}
    this.guardian.on('state',(s,reason)=>{
      const previousState=this.state;
      if(reason||s!==this.state)this.lastControlReason=reason||s;
      this.state=s;
      if(reason==='guardian_exited'&&previousState!=='idle'&&this.latchFile)try{fs.writeFileSync(this.latchFile,'stopped');}catch{}
      if(s==='stopped'&&this.latchFile){try{if(fs.readFileSync(this.latchFile,'utf8')!=='stopped')throw Error('invalid latch');}catch{this.lastControlReason='stop_persistence_failed';this.diagnosticError='stop_persistence_failed';}}
      if(reason==='guardian_exited'&&this.privateDataStorage===true)new Incidents(dataDir()).recordSerialized('computer_guardian',{state:s,error:{code:'guardian_exited'},guardian_exit:this.guardian.lastExit}).catch(()=>{this.diagnosticError='private_diagnostic_storage_unavailable';});
      if(s!=='active'){
        this.generation++;this.frames.clear();
        if(s==='stopped'||s==='idle'){this.grants.clear();this.token='';}
        if(s==='stopped'||s==='paused')this.driver.abort?.().catch(()=>{});
      }
    });
    this.guardian.on('resume',(_state,source)=>{this.frames.clear();this.lastControlReason=source==='host_resume'?'host_authorized_resume':'human_resume';if(this.state==='active')this.deadline=Date.now()+contract.session_ms;});
  }
  stamp(){return {__session:this.token};}
  // A passive App sidecar must not open a HUD, install input hooks or acquire
  // cursor ownership just because a previous task left an emergency latch.
  async prepare(){}
  async showControls(){const result=await this.guardian.request({op:'show_controls'});if(result.controls_visible===true)this.recoveryFailure=null;return result;}
  async ready(){
    if(this.state==='stopped'&&persistenceFailure(this.lastControlReason))return {...this.status(),ready:false,controls_visible:null,next_action:'inspect_stop_persistence_without_restart',replay_allowed:false,error:{code:this.lastControlReason,message:'Control is stopped because native control storage failed. Inspect private storage; do not restart or send input.'}};
    const unavailable=()=>({...this.status(),ready:false,controls_visible:this.recoveryVisibility??null,guardian_running:!!this.guardian.proc&&!this.guardian.proc.killed,guardian_exit:this.guardian.lastExit??null,...recoveryAdvice({error:this.recoveryFailure}),error:this.recoveryFailure});
    if(this.recoveryFailure)return unavailable();
    let controls;
    try{
      controls=await this.showControls();
      if(controls.error)throw Object.assign(Error(controls.error.message),{code:controls.error.code});
      if(['idle','active','paused','stopped'].includes(controls.state))this.state=controls.state;
      const visible=controls.controls_visible===true;
      if(!visible)throw Object.assign(Error('Local controls did not report a visible bar.'),{code:'guardian_controls_not_visible'});
      return {...this.status(),update_notice:updateNotice(dataDir()),ready:visible&&this.state!=='stopped'&&this.state!=='paused',controls_visible:visible,desktop_context:controls.desktop_context,guardian_running:!!this.guardian.proc,guardian_exit:this.guardian.lastExit??null,
        next_action:this.state==='stopped'?'awaiting_human_rearm':this.state==='paused'?'awaiting_human_resume':'discover_or_launch'};
    }catch(error){this.recoveryVisibility=controls?.controls_visible===false?false:null;this.recoveryFailure={code:error.code||'guardian_unavailable',message:error.code==='desktop_context_unavailable'?'Start the installed local launcher on the visible desktop. No desktop was switched and Stop remains latched.':'Local controls failed to start. Run diagnostics; do not repeat launch commands.'};return unavailable();}
  }
  check(){if(this.state!=='active')fail('control_inactive',`Control is ${this.state}. Use the local Resume/Re-arm control or request a new grant.`);}
  async identity(hwnd){
    if(!Number.isSafeInteger(Number(hwnd))||Number(hwnd)<=0)fail('no_target','Select an HWND from computer_apps.');
    return (await this.driver.call('identity',{hwnd:Number(hwnd)})).result;
  }
  async app(hwnd){
    const identity=await this.identity(hwnd);
    const wins=(await this.driver.call('list_apps',{include_hidden:true})).result.windows;
    const listed=wins.find(w=>Number(w.hwnd)===Number(hwnd));
    if(!listed)fail('window_not_found','Refresh computer_apps; target closed.');
    const w={...listed,...identity};
    this.guardian.send({op:'attach',pid:this.driver.info?.pid});
    if([process.pid,process.ppid,this.driver.info?.pid,this.guardian.pid].includes(w.pid)||classify(w).tier===TIER.BLOCKED)
      fail('protected_app','This is a protected app or the control/host UI.');
    return w;
  }
  async grant(hwnd,purpose='Operate this app for the requested desktop task'){
    if(this.state==='stopped'&&persistenceFailure(this.lastControlReason))fail(this.lastControlReason,'Control storage failed. Inspect private storage; do not restart or send input.');
    if(this.state==='stopped'){await this.showControls();this.check();}
    if(this.state==='paused')this.check();
    const w=await this.app(hwnd);const key=appKey(w);
    if(this.grants.has(key)&&this.state==='active')return w;
    const answer=await this.guardian.prompt({kind:'app',hwnd:Number(hwnd),app_pid:w.pid,host_pid:this.driver.info?.pid,
      message:`Allow this application for this session?\r\n\r\n${w.title}\r\n${w.path}\r\nPID ${w.pid}\r\n\r\nTask: ${purpose}\r\n\r\nIts screenshots and accessibility text go to Antigravity's configured model. Ordinary actions run autonomously. Consequential effects need a separate confirmation. Your real mouse/keyboard will be used. Esc or Ctrl+Alt+F12 stops. Use a disposable account/VM for important data.`});
    if(!answer.allowed)fail(answer.decision==='timeout'?'approval_timeout':'permission_denied',answer.decision==='timeout'?'Local application approval timed out.':'The human denied this application.');
    this.guardian.send({op:'attach',pid:this.driver.info?.pid});
    const current=await this.app(hwnd);if(appKey(current)!==key)fail('identity_changed','Application restarted during approval.');
    if(!this.token){this.token=randomUUID();this.deadline=Date.now()+contract.session_ms;this.remaining=contract.action_budget;}
    const active=await this.guardian.request({op:'activate',token:this.token,deadline:(BigInt(this.deadline)*10000n+621355968000000000n).toString()});
    if(!active.allowed)fail('control_inactive','Use the local controls to re-arm.');
    this.state='active';this.grants.set(key,{...current,purpose});return current;
  }
  async observe(args){
    const w=await this.grant(Number(args.hwnd),args.reason);this.check();
    const generation=this.generation;
    const workerEpoch=this.driver.epoch;
    if(args.settle_ms){
      await new Promise(resolve=>setTimeout(resolve,Math.min(2000,Math.max(0,args.settle_ms))));
      this.check();if(generation!==this.generation)fail('control_changed','Control changed while waiting for the UI. Observe again after authorized Resume.');
    }
    if(w.other_desktop)fail('other_desktop','Target is still running on another virtual desktop. Bring that app to the current desktop before requesting pixels; do not relaunch or click the visible desktop.');
    if(w.minimized)fail('window_minimized','Target is minimized. Focus it, then take a fresh observation.');
    this.guardian.send({op:'activity',action:'observe'});
    const metadata={...this.stamp(),hwnd:Number(args.hwnd),__pid:w.pid,__started:w.started};
    const query=String(args.query||'').trim().toLowerCase();
    // Query the larger bounded tree before filtering; a compact reply must not
    // prevent discovery of controls late in a real application's hierarchy.
    const tree=(await this.driver.call('snapshot',{...metadata,max_nodes:Math.min(args.max_nodes||(query?500:160),500)})).result;
    const nodes=queryNodes(tree.nodes,query);
    const rendered=renderSnapshot(tree,{maxRows:Math.min(args.max_nodes||80,500),textLimit:160,nodes})
      .replaceAll('raise max_nodes or use interactive_only','use query or raise max_nodes up to 500')
      .replace(/\[~\d+ tokens\. Re-read[^\]]+\]/g,'[Use query to return matching controls, or max_nodes up to 500 for more rows.]');
    const response={observation_id:randomUUID(),hwnd:Number(args.hwnd),app:w.path,at:Date.now(),tree:rendered,elements:nodes};
    let image;
    if(args.with_image!==false){
      await this.guardian.request({op:'capture'});
      try { image=(await this.driver.call('screenshot',{...metadata,max_width:Math.min(args.max_width||1400,targetImageSize(w.rect[2],w.rect[3])[0]),quality:80})).result; }
      finally { this.guardian.send({op:'capture_end'}); }
      if(image.capture==='screen_occluded')fail('window_capture_unavailable','The native helper returned covering-window pixels. Discarded; bring the approved app to the front and observe again.');
      response.image={...image};delete response.image.data;
    }
    this.check();
    if(generation!==this.generation||workerEpoch!==this.driver.epoch)fail('control_changed','Control or native worker changed during observation. Discard this frame and observe again.');
    for(const [id,frame] of this.frames)if(Date.now()-frame.at>contract.frame_ms||frame.workerEpoch!==workerEpoch)this.frames.delete(id);
    while(this.frames.size>=16)this.frames.delete(this.frames.keys().next().value);
    this.frames.set(response.observation_id,{at:response.at,hwnd:response.hwnd,key:appKey(w),snapshot:tree.snapshot_id,image,workerEpoch,elements:tree.nodes,viewTree:comparableView(rendered),viewQuery:args.query,viewMaxNodes:args.max_nodes});
    return {metadata:response,image};
  }
  async action(op,args){
    if(!input.has(op))fail('unsupported_action','Unknown input operation.');
    if('confirmed' in args||'preapprove' in args)fail('model_approval_forbidden','Model-supplied approval flags are not accepted.');
    const w=args.hwnd!=null?await this.grant(Number(args.hwnd),args.reason):null;
    this.check();if(Date.now()>=this.deadline||this.remaining<=0)fail('session_limit','Session expired or action budget exhausted. End and obtain a new human grant.');
    if(op==='fit_window'){if(w?.other_desktop)fail('other_desktop','Bring the approved window to the current virtual desktop before fitting it. No desktop switch was performed.');this.frames.clear();}
    const generation=this.generation;
    const payload={...args,...this.stamp(),mode:'take',__risk:args.risk==='routine'?'routine':'sensitive'};
    delete payload.risk;delete payload.reason;delete payload.observation_id;delete payload.observe;
    if(w){
      payload.hwnd=Number(w.hwnd);payload.__pid=w.pid;payload.__started=w.started;
      if(!['focus','fit_window','close_window'].includes(op)){
        const f=requireObservation(this.frames,args.observation_id,w.hwnd);
        if(f.workerEpoch!==this.driver.epoch)fail('stale_observation','The native worker restarted. Observe again; old element indexes cannot be reused.');
        payload.__worker_epoch=f.workerEpoch;
        if(f.key!==appKey(w))fail('identity_changed','App identity changed since observation.');
        if(f.image&&JSON.stringify(f.image.source)!==JSON.stringify(w.rect))fail('window_moved','Window moved or resized. Observe again.');
        if(['name','role','automation_id'].some(k=>Object.hasOwn(args,k))){payload.index=observedIndex(f.elements,args);delete payload.name;delete payload.role;delete payload.automation_id;}
        if(payload.index!=null){payload.snapshot_id=f.snapshot;}
        if(args.x!=null||args.y!=null){if(!f.image)fail('no_image','Observe with_image first.');payload.point=imagePoint(f.image,args.x,args.y);delete payload.x;delete payload.y;}
        if(op==='drag'){
          if(!f.image)fail('no_image','Observe with_image first.');
          payload.from=imagePoint(f.image,...args.from);payload.to=imagePoint(f.image,...args.to);
        }
      }
    }
    // Visible real-pointer clicks are the default for both semantic selectors
    // and pixels. An explicit semantic-only click remains available for controls
    // that cannot be physically reached; pixels always require physical input.
    if(op==='click'&&(payload.point||payload.physical==null))payload.physical=true;
    if(typeof payload.text==='string'&&payload.text.length>20000)fail('text_limit','Text limit is 20,000 characters per action.');
    if(op==='type'&&payload.text?.length>400)fail('text_limit','Native typing is limited to 400 UTF-16 units. Use explicit clipboard access and a verified paste for larger text.');
    await this.driver.start?.();
    if(Number.isSafeInteger(this.driver.info?.pid))this.guardian.send({op:'attach',pid:this.driver.info.pid});
    // Window-free clipboard work and first-launch/restarted workers also need
    // independent guardian registration. Never replace a frame's older epoch.
    if(payload.__worker_epoch==null)payload.__worker_epoch=this.driver.epoch;
    const preview=(await this.driver.call('authorize',{action_op:op,action_args:payload})).result;
    if(preview.sensitive){
      const filenameClipboard=op==='file_dialog'&&args.entry_method==='clipboard'?'\r\nFilename entry explicitly uses the local clipboard temporarily and restores preservable formats.\r\n':'';
      const answer=await this.guardian.prompt({kind:'action',hwnd:w?.hwnd,host_pid:this.driver.info?.pid,action_op:op,args:payload,label:preview.label||'',
        message:`Approve ONE sensitive operation?\r\n\r\n${args.reason||'No effect explanation supplied — deny if unclear.'}\r\n${filenameClipboard}\r\nApplication: ${w?.path||'Clipboard / desktop'}\r\nControl: ${preview.label||'(pixel/keyboard operation)'}\r\n\r\n${JSON.stringify({operation:op,args},null,2)}\r\n\r\nCheck the actual target. Never let an agent approve this dialog. Deny if the result is unclear.`});
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
    try {
      this.check();
      if(generation!==this.generation)fail('control_changed','Control changed during execution. Inspect the result; do not replay this action.');
      if(op==='close_window')return {result,input_completed:true,verification_required:true,refresh_apps:true};
      return {result,input_completed:true,verification_required:true,...(w?await this.observe({hwnd:w.hwnd,settle_ms:op==='move'?0:180,...args.observe}):{})};
    }
    catch(error){return {result,input_completed:true,verification_required:true,observe_before_continuing:true,verification_error:{code:error.code||'observation_failed',message:error.message,...(error.hint?{hint:error.hint}:{})}};}
  }
  async wait(args){
    const until=Date.now()+Math.min(Math.max(args.timeout_ms||15000,100),30000);let latest;
    do {
      this.check();latest=await this.observe({hwnd:args.hwnd,with_image:false,query:args.query});
      const tree=latest.metadata.tree.toLowerCase();
      const failure=(args.abort_on||[]).find(text=>tree.includes(text.toLowerCase()));
      if(failure){this.frames.delete(latest.metadata.observation_id);return {matched:false,aborted:true,abort_match:failure,...await this.observe({hwnd:args.hwnd,query:args.query})};}
      if(tree.includes(args.until.toLowerCase())){
        // Do not authorize the next batch step based on a transient match in
        // an older frame. Confirm both success and failure on the returned view.
        this.frames.delete(latest.metadata.observation_id);
        const verified=await this.observe({hwnd:args.hwnd,query:args.query});
        const verifiedTree=verified.metadata.tree.toLowerCase();
        const verifiedFailure=(args.abort_on||[]).find(text=>verifiedTree.includes(text.toLowerCase()));
        if(verifiedFailure)return {matched:false,aborted:true,abort_match:verifiedFailure,...verified};
        if(verifiedTree.includes(args.until.toLowerCase()))return {matched:true,...verified};
        this.frames.delete(verified.metadata.observation_id);
        if(Date.now()>=until)break;
      } else {
        this.frames.delete(latest.metadata.observation_id);
        if(Date.now()>=until)break;
      }
      await new Promise(resolve=>setTimeout(resolve,Math.min(500,Math.max(0,until-Date.now()))));
    }while(true);
    const final=await this.observe({hwnd:args.hwnd,query:args.query});
    const finalTree=final.metadata.tree.toLowerCase();
    const finalFailure=(args.abort_on||[]).find(text=>finalTree.includes(text.toLowerCase()));
    if(finalFailure)return {matched:false,aborted:true,abort_match:finalFailure,...final};
    return {matched:false,timed_out:true,...final};
  }
  async waitChange(args){
    this.check();
    const baseline=requireObservation(this.frames,args.observation_id,args.hwnd);
    if(typeof baseline.viewTree!=='string')fail('stale_observation','The observation cannot be compared. Take a fresh snapshot.');
    if(baseline.workerEpoch!==this.driver.epoch)fail('stale_observation','The native worker restarted. Take a fresh snapshot.');
    const generation=this.generation,w=await this.grant(Number(args.hwnd),args.reason);this.check();
    if(generation!==this.generation)fail('control_changed','Control changed. Take a fresh snapshot.');
    if(baseline.key!==appKey(w))fail('identity_changed','Application identity changed since observation.');
    const until=Date.now()+Math.min(Math.max(args.timeout_ms||15000,100),30000);
    do {
      this.check();
      const latest=await this.observe({hwnd:args.hwnd,with_image:false,query:baseline.viewQuery,max_nodes:baseline.viewMaxNodes,reason:args.reason});
      this.check();if(generation!==this.generation)fail('control_changed','Control changed while waiting. Observe again.');
      const current=this.frames.get(latest.metadata.observation_id);
      if(!current||current.key!==baseline.key||current.workerEpoch!==baseline.workerEpoch){this.frames.delete(latest.metadata.observation_id);fail('identity_changed','Application identity or native worker changed while waiting. Take a fresh snapshot.');}
      if(comparableView(latest.metadata.tree)!==baseline.viewTree)return {changed:true,...latest};
      if(Date.now()>=until)return {changed:false,timed_out:true,...latest};
      this.frames.delete(latest.metadata.observation_id);
      await new Promise(resolve=>setTimeout(resolve,Math.min(500,Math.max(0,until-Date.now()))));
    }while(true);
  }
  async finish(){this.generation++;this.frames.clear();this.grants.clear();this.guardian.send({op:'end'});if(!['stopped','paused'].includes(this.state)){this.state='idle';this.lastControlReason='completed';}this.token='';await this.driver.abort?.();return {ended:true,state:this.state,restart_required:false};}
  async feedback(args){
    // Revalidate at the persistence boundary too; never store model text,
    // application content, screenshots, paths or arbitrary error messages.
    if(!['cursor_visual','focus','observation','workflow','performance','missing_capability','unexpected_pause','other'].includes(args.category)||
       !['observe','click','type','scroll','drag','keyboard','launch','wait','update','other'].includes(args.operation)||
       !['suspected','observed','reproduced'].includes(args.evidence))fail('invalid_feedback','Choose only the listed feedback categories.');
    const code=`agent_${args.category}_${args.operation}_${args.evidence}`;
    const incident_id=await new Incidents(dataDir()).recordSerialized('computer_feedback',{state:this.state,error:{code}});
    return {recorded:true,incident_id,classification:'agent_report_unverified',next_action:'pending_reporting_preferences'};
  }
  async launch(args){
    if(this.state==='stopped'&&persistenceFailure(this.lastControlReason))fail(this.lastControlReason,'Control storage failed. Inspect private storage; do not restart or send input.');
    if(this.state==='stopped'){await this.showControls();this.check();}
    if(this.state==='paused')this.check();
    const {app,executable}=launchTarget(args.app);
    if(/^(?:AxonHost|StorageGuard)(?:-[0-9a-f]+)?(?:\.exe|\.app)?$/i.test(path.basename(app)))fail('protected_app','Cannot launch internal runtime helpers as target applications.');
    if(classify({process:path.basename(app),path:app}).tier===TIER.BLOCKED)fail('protected_app','Cannot launch a protected application.');
    // Validate the execution desktop before showing controls or launching apps.
    await this.driver.start();
    await this.guardian.start();
    if(this.state==='stopped'||this.state==='paused')this.check();
    if(!this.token){this.token=randomUUID();this.deadline=Date.now()+contract.session_ms;this.remaining=contract.action_budget;}
    const active=await this.guardian.request({op:'activate',token:this.token,deadline:(BigInt(this.deadline)*10000n+621355968000000000n).toString()});
    if(!active.allowed)fail('control_inactive','Use the local controls.');this.state='active';
    const payload={app,args:args.args||[],...this.stamp(),__risk:'sensitive'};
    await this.driver.start();
    this.guardian.send({op:'attach',pid:this.driver.info.pid});
    payload.__worker_epoch=this.driver.epoch;
    const a=await this.guardian.prompt({kind:'action',host_pid:this.driver.info.pid,action_op:'launch',args:payload,label:'',message:`Launch this application?\r\n\r\n${args.reason}\r\n\r\n${JSON.stringify({app,args:payload.args},null,2)}\r\n\r\nThis starts software with your account's privileges. No shell is used. Approve only if intended.`});
    if(!a.allowed)fail('permission_denied','Human denied application launch.');
    this.check();const result=(await this.driver.call('launch',{...payload,__permit:a.permit})).result;
    if(!args.observe)return result;
    // Launch already happened. An unavailable/ambiguous window is never an
    // invitation to launch a duplicate. Observe still performs its normal app
    // identity grant and native capture checks; this is only discovery sugar.
    const generation=this.generation;
    try {
      if(!Number.isSafeInteger(result.pid)||result.pid<=0)throw Object.assign(Error('Launcher returned no PID. Discover apps without relaunching.'),{code:'launch_pid_unavailable'});
      const until=Date.now()+8000;
      do {
        this.check();if(generation!==this.generation)fail('control_changed','Control changed after launch.');
        const windows=(await this.driver.call('list_apps',{})).result.windows;
        const matches=windows.filter(w=>w.pid===result.pid&&executableKey(path.resolve(w.path||''))===executableKey(executable)&&!w.minimized&&!w.other_desktop&&w.rect?.[2]>0&&w.rect?.[3]>0);
        if(matches.length>1)return {...result,input_completed:true,observe_pending:true,observation_hint:'Several matching windows opened. Discover apps and select the intended window; do not relaunch.'};
        if(matches.length===1){
          const observed=await this.observe({hwnd:Number(matches[0].hwnd),reason:args.reason});
          return {...observed,result,input_completed:true};
        }
        // Packaged Windows launchers often exit after handing off. Waiting the
        // entire discovery budget cannot produce a window of an exited PID.
        let alive=true;try{process.kill(result.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;}
        if(!alive)return {...result,input_completed:true,observe_pending:true,launcher_exited:true,observation_hint:'The starter process exited, possibly after handing off. Discover apps and observe the intended window; do not relaunch.'};
        await new Promise(resolve=>setTimeout(resolve,200));
      }while(Date.now()<until);
      this.check();
      return {...result,input_completed:true,observe_pending:true,observation_hint:'No unambiguous visible window matched the launched PID and executable within8seconds. Discover apps; do not relaunch.'};
    }catch(error){return {...result,input_completed:true,observe_before_continuing:true,verification_error:{code:error.code||'observation_failed',message:error.message}};}
  }
  async pause(){this.generation++;this.frames.clear();this.state='paused';this.lastControlReason='requested_pause';this.guardian.send({op:'pause'});await this.driver.abort?.();return {paused:true,human_resume_required:true};}
  async resume(){
    if(this.state!=='paused'||this.permissionMode!=='host-managed')fail('human_resume_required','Only host-authorized soft pauses can resume in chat. Emergency Stop requires the local human re-arm control.');
    this.generation++;this.frames.clear();const generation=this.generation;
    await this.driver.abort?.();
    if(this.state!=='paused'||generation!==this.generation)fail('control_changed','Control changed before Resume completed. Inspect status.');
    const result=await this.guardian.request({op:'resume'});
    if(!result.allowed||result.state!=='active'||generation!==this.generation||this.state==='stopped')fail('human_resume_required','Native runtime refused Resume or emergency Stop won the race. Use the local controls.');
    this.state='active';this.lastControlReason='host_authorized_resume';this.deadline=Date.now()+contract.session_ms;
    return {resumed:true,fresh_observation_required:true,replayed_actions:0};
  }
  async stop(){this.generation++;this.frames.clear();this.grants.clear();this.state='stopped';this.lastControlReason='requested_stop';this.guardian.send({op:'stop'});let persistenceFailed=false;try{if(this.latchFile)fs.writeFileSync(this.latchFile,'stopped');}catch{persistenceFailed=true;this.lastControlReason='stop_persistence_failed';}await this.driver.abort?.();if(persistenceFailed)throw Object.assign(Error('Control is stopped, but the emergency Stop latch could not be saved. Do not restart the controller; inspect its private storage.'),{code:'stop_persistence_failed'});return {stopped:true,human_rearm_required:true};}
  status(){return {state:this.state,remaining_actions:this.remaining,approved_apps:[...this.grants.values()].map(w=>({pid:w.pid,path:w.path})),runtime:nativePlatform().runtime,build_version:VERSION,build_id:BUILD_ID,private_data_storage:this.privateDataStorage,real_cursor:true,custom_cursor:this.guardian.customCursor??null,permission_mode:this.permissionMode,takeover_mode:this.guardian.takeoverMode||savedTakeoverMode(path.join(dataDir(),'control-preferences.json'),this.takeoverMode),control_reason:this.lastControlReason};}
  async close(){const normal=this.state==='idle';if(!normal)await this.stop();else await this.driver.abort?.();await this.guardian.close({normal});this.sessions.close();}
}
