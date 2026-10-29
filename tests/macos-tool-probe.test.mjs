import test from 'node:test';import assert from 'node:assert/strict';import {macToolProbe} from '../server/macos-build.mjs';
test('Mac tool lookup distinguishes a timeout from unavailable tools',()=>{
 assert.equal(macToolProbe({status:0,stdout:' /usr/bin/swiftc\n'},'compiler'),'/usr/bin/swiftc');
 assert.throws(()=>macToolProbe({status:null,error:{code:'ETIMEDOUT'}},'compiler'),e=>e.code==='macos_toolchain_probe_timeout'&&/may still be installed/.test(e.message));
 assert.throws(()=>macToolProbe({status:null,error:{code:'ENOENT'}},'SDK'),e=>e.code==='macos_toolchain_probe_failed');
 assert.throws(()=>macToolProbe({status:1,stdout:''},'compiler'),e=>e.code==='macos_toolchain_unavailable');
 assert.throws(()=>macToolProbe({status:0,stdout:' '},'SDK'),e=>e.code==='macos_toolchain_unavailable');
});
