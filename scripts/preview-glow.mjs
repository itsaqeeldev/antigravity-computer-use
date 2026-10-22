// A visual-only preview: no applications granted and no app input injected.
import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {Guardian} from '../server/guardian.mjs';import {dataDir} from '../server/build.mjs';
fs.mkdirSync(dataDir(),{recursive:true});
// Isolate presentation preferences from the user's normal takeover selection.
const liveDir=path.join(dataDir(),`live-controls-${process.pid}`);fs.mkdirSync(liveDir,{recursive:true});
const file=path.join(liveDir,'control.state');fs.writeFileSync(file,'idle||0|');
const guardian=new Guardian({AGCU_GUARD_FILE:file,AGCU_PARENT_PID:String(process.pid),AGCU_TAKEOVER_MODE:'manual'});
const close=()=>guardian.close();process.once('SIGINT',close);process.once('SIGTERM',close);
try {
 await guardian.start();
 const stopped=new Promise(resolve=>guardian.on('state',state=>{if(state==='stopped')resolve();}));
 await guardian.request({op:'activate',token:randomUUID(),deadline:'3155378975999999999'});
 const status=await guardian.request({op:'visual_status'});
 console.log(JSON.stringify({live_native_controls:true,...status}));
 console.log('Actual native controls active in Manual pause mode. No apps granted. Esc or Stop closes them.');
 await stopped;
}finally {guardian.close();}
