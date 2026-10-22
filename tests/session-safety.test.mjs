import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {Sessions} from '../server/sessions.mjs';
test('unavailable input lease fails closed without executing action',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agcu-lease-'));const s=new Sessions({dir});s.lease=path.join(dir,'missing','input.lease');let executed=false;
 await assert.rejects(s.withInput('click',{},async()=>{executed=true;}),e=>e.code==='input_lease_unavailable');assert.equal(executed,false);
 fs.rmSync(dir,{recursive:true,force:true});
});
