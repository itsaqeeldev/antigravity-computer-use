// Adapted stdio dispatch and tool vocabulary from ridelink0/claude-computer-use (MIT).
const str={type:'string'},num={type:'integer'},bool={type:'boolean'};
const nodeCount={...num,minimum:1,maximum:500};
const settle={...num,minimum:0,maximum:2000};
const target={hwnd:num,observation_id:str,index:num,x:num,y:num,risk:{type:'string',enum:['routine','sensitive'],default:'sensitive'},reason:str,observe:{type:'object',properties:{with_image:bool,query:str,max_nodes:nodeCount,settle_ms:settle},additionalProperties:false}};
const tool=(name,description,properties={},required=[])=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false}});
export const TOOLS=[
 tool('computer_apps','List Windows apps and handles. Set include_hidden to discover minimized windows and apps on other virtual desktops; do not confuse them with closed apps.',{include_hidden:bool}),
 tool('computer_grant','Select application instance for this task under the host permission policy. Native identity checks apply; model approval flags are rejected.',{hwnd:num,reason:str},['hwnd','reason']),
 tool('computer_snapshot','Observe accessibility controls and screenshot. Returns one-use observation_id. Optional settle_ms waits up to2seconds before reading an animating UI; never repeats input.',{hwnd:num,with_image:bool,max_width:{...num,minimum:100,maximum:1400},max_nodes:nodeCount,query:str,settle_ms:settle,reason:str},['hwnd']),
 tool('computer_move','Move the real pointer to screenshot pixels without clicking; use to hover and inspect.',{...target},['hwnd','observation_id','x','y','reason']),
 tool('computer_click','Click accessibility index or screenshot pixel x,y. Pixel clicks move the REAL cursor.',{...target,button:{type:'string',enum:['left','right','middle']},clicks:{...num,minimum:1,maximum:3},physical:bool},['hwnd','observation_id','reason']),
 tool('computer_type','Type up to 400 UTF-16 units into the observed focus/element. For larger text use explicit clipboard access and verified Ctrl+V.',{...target,text:{...str,maxLength:400}},['hwnd','observation_id','text','reason']),
 tool('computer_paste','Explicit clipboard operation: paste text into the observed editor, then restore saved clipboard formats unless another app changed it. Verify actual contents afterward.',{...target,text:{...str,maxLength:20000}},['hwnd','observation_id','text','reason']),
 tool('computer_set_value','Set an indexed accessible field. Supply exactly one of text (editable text) or value (numeric slider/range). Inspect the returned value.',{...target,text:str,value:{type:'number'}},['hwnd','observation_id','index','reason']),
 tool('computer_key','Press a chord: ctrl+a, enter, tab, etc. Optional index focuses and verifies that control first; otherwise uses current focus. Native sensitive checks apply.',{...target,keys:str},['hwnd','observation_id','keys','reason']),
 tool('computer_scroll','Scroll element or screenshot point. Negative amount scrolls down.',{...target,amount:{...num,minimum:-20,maximum:20},horizontal:bool,into_view:bool},['hwnd','observation_id','reason']),
 tool('computer_drag','Drag real cursor; from/to are screenshot pixels.',{...target,from:{type:'array',items:num,minItems:2,maxItems:2},to:{type:'array',items:num,minItems:2,maxItems:2},steps:{...num,minimum:2,maximum:120},button:str},['hwnd','observation_id','from','to','reason']),
 tool('computer_focus','Activate an approved app.',{hwnd:num,reason:str,risk:{type:'string',enum:['routine','sensitive']}},['hwnd','reason']),
 tool('computer_close_window','Ask window to close under the host permission policy. Can discard unsaved work.',{hwnd:num,reason:str},['hwnd','reason']),
 tool('computer_clipboard','Explicit clipboard read/write. Explain the data and effect under the host permission policy.',{text:str,reason:str},['reason']),
 tool('computer_launch','Launch an existing GUI executable with exact path/arguments under the host permission policy.',{app:str,args:{type:'array',items:str},reason:str},['app','reason']),
 tool('computer_open','Open document/folder with its handler; separate confirmation.',{...target,path:str},['hwnd','observation_id','path','reason']),
 tool('computer_file_dialog','Fill and confirm an ALREADY OPEN native file picker. First click Choose files/Browse in the app. Use the owner app hwnd and the post-click observation_id, exact path, action open/save. Does not open a picker.',{...target,path:str,action:{type:'string',enum:['open','save']}},['hwnd','observation_id','path','reason']),
 tool('computer_run','Run 1-8 predictable steps sequentially. Stop on first failure; do not replay completed steps.',{hwnd:num,observation_id:str,steps:{type:'array',minItems:1,maxItems:8,items:{type:'object'}},reason:str},['hwnd','observation_id','steps','reason']),
 tool('computer_wait','Wait for expected UI text without repeating input, then return a fresh observation.',{hwnd:num,until:str,timeout_ms:{...num,minimum:100,maximum:30000},query:str,reason:str},['hwnd','until','reason']),
 tool('computer_end','Finish normally; no Antigravity restart needed.'),
 tool('computer_pause','Pause for human takeover. Do not replay interrupted input.'),
 tool('computer_resume','Resume a soft pause ONLY after the user explicitly says to continue under the host permission policy. Clears observations; never clears emergency Stop.'),
 tool('computer_stop','Emergency stop, release inputs; HUMAN re-arm required.'),
 tool('computer_status','Read status without permission prompts or screenshots.')
];
const OPS={computer_move:'move',computer_click:'click',computer_type:'type',computer_paste:'paste',computer_key:'key',computer_scroll:'scroll',computer_drag:'drag',computer_focus:'focus',computer_close_window:'close_window',computer_set_value:'set_value',computer_clipboard:'clipboard',computer_open:'open',computer_file_dialog:'file_dialog'};
export function validate(name,args){
 const s=TOOLS.find(t=>t.name===name)?.inputSchema;if(!s)throw new Error('Unknown tool');
 const visit=(t,v,k)=>{
  if(t.type==='integer'&&!Number.isSafeInteger(v))throw new Error(k+' must be integer');
  if((t.type==='integer'||t.type==='number')&&(!Number.isFinite(v)||(t.minimum!=null&&v<t.minimum)||(t.maximum!=null&&v>t.maximum)))throw new Error(k+' is outside the allowed range');
  if(t.type==='string'&&typeof v!=='string')throw new Error(k+' must be text');
  if(t.type==='string'&&t.maxLength!=null&&v.length>t.maxLength)throw new Error(k+' exceeds the allowed length');
  if(t.type==='boolean'&&typeof v!=='boolean')throw new Error(k+' must be boolean');
  if(t.type==='array'&&(!Array.isArray(v)||(t.maxItems&&v.length>t.maxItems)||(t.minItems&&v.length<t.minItems)))throw new Error('Invalid '+k);
  if(t.enum&&!t.enum.includes(v))throw new Error('Invalid '+k);
  if(t.type==='array'&&t.items)v.forEach((item,i)=>visit(t.items,item,`${k}[${i}]`));
  if(t.type==='object'){
   if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(k+' must be an object');
   for(const key of t.required||[])if(!Object.hasOwn(v,key))throw new Error('Required field: '+k+'.'+key);
   for(const [key,value] of Object.entries(v)){
    if(t.additionalProperties===false&&!Object.hasOwn(t.properties||{},key))throw new Error('Unsupported field: '+k+'.'+key);
    if(t.properties?.[key])visit(t.properties[key],value,k+'.'+key);
   }
  }
 };
 visit(s,args,'arguments');
 if(name==='computer_set_value'&&(Object.hasOwn(args,'text')===Object.hasOwn(args,'value')))throw new Error('Supply exactly one of text or value');
}
export async function call(r,name,a){
 validate(name,a);
 if(name==='computer_status')return r.status();
 if(name==='computer_apps')return {windows:(await r.driver.call('list_apps',{include_hidden:a.include_hidden===true})).result.windows.filter(w=>![r.guardian.pid,r.driver.info?.pid,process.pid,process.ppid].includes(w.pid))};
 if(name==='computer_grant')return {approved:await r.grant(a.hwnd,a.reason)};
 if(name==='computer_snapshot')return r.observe(a);
 if(name==='computer_wait')return r.wait(a);
 if(name==='computer_end')return r.finish();
 if(name==='computer_stop')return r.stop();
 if(name==='computer_pause')return r.pause();
 if(name==='computer_resume')return r.resume();
 if(name==='computer_launch')return r.launch(a);
 if(name==='computer_run'){
  const completed=[];let last=null;let observation=a.observation_id;
  for(let i=0;i<a.steps.length;i++){
   const {kind,...rest}=a.steps[i];const n='computer_'+kind;
   if(!OPS[n])throw new Error('Unsupported batch step '+kind);
   try{last=await call(r,n,{hwnd:a.hwnd,observation_id:observation,reason:a.reason,...rest});completed.push({index:i,kind,ok:true});if(last.verification_error)return {...last,batch:{completed,failed_index:i,skipped:a.steps.length-i-1,phase:'verification'}};observation=last.metadata?.observation_id;}
   catch(e){return {completed,failed_index:i,skipped:a.steps.length-i-1,error:e.message,observe_before_continuing:true};}
  }
  return {...last,batch:{completed,skipped:0}};
 }
 return r.action(OPS[name],a);
}
export function content(v){
 const image=v?.image;const clean={...v};
 if(v?.metadata){
  clean.metadata={...v.metadata};
  // The rendered tree already contains the observation-scoped control indexes.
  // Avoid sending the same accessibility hierarchy twice on every action.
  if(clean.metadata.tree)delete clean.metadata.elements;
  delete clean.metadata.image;
 }
 if(image)clean.image={width:image.width,height:image.height,source:image.source};
 return [{type:'text',text:JSON.stringify(clean)},...(image?.data?[{type:'image',data:image.data,mimeType:image.mime||'image/jpeg'}]:[])];
}
