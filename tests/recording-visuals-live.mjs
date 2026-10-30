// Native qualification: recording is opt-in; agent captures still hide chrome.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {Guardian} from '../server/guardian.mjs';
import {testDirectory} from './paths.mjs';

const root=fs.mkdtempSync(path.join(testDirectory('recording-visuals'),'run-'));
for(const enabled of [false,true]) {
  const dir=path.join(root,String(enabled));fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'guard.state');fs.writeFileSync(file,'idle||0|');fs.writeFileSync(file+'.inputs','');
  fs.writeFileSync(path.join(dir,'control-preferences.json'),JSON.stringify({takeover_mode:'manual',record_visuals:enabled}));
  const g=new Guardian({AGCU_GUARD_FILE:file,AGCU_PARENT_PID:String(process.pid),AGCU_REAL_CURSOR:'1'});
  try {
    await g.start();
    let status=await g.request({op:'visual_status'});
    assert.equal(status.state,'idle');assert.equal(status.controls_visible,false);assert.equal(status.record_visuals,enabled);
    const active=await g.request({op:'activate',token:'recording-test-no-apps',deadline:(BigInt(Date.now()+30000)*10000n+621355968000000000n).toString()});
    assert.equal(active.allowed,true);
    status=await g.request({op:'visual_status'});assert.equal(status.controls_visible,true);
    await g.request({op:'capture'});
    status=await g.request({op:'visual_status'});
    // Excluded chrome need not hide physically, but opted-in recording chrome must.
    if(enabled)assert.equal(status.controls_visible,false);
    g.send({op:'capture_end'});
    status=await g.request({op:'visual_status'});assert.equal(status.controls_visible,true);
    await g.request({op:'end'});
    status=await g.request({op:'visual_status'});assert.equal(status.controls_visible,false);assert.equal(status.cursor,false);
    console.log(JSON.stringify({record_visuals:enabled,passed:true,agent_capture_hides_recordable_chrome:enabled,cleanup_verified:true}));
  } finally {await g.close({normal:true});}
}
