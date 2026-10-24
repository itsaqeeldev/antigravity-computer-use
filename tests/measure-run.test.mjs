import test from 'node:test';import assert from 'node:assert/strict';
import {measureRun} from '../scripts/measure-run.mjs';
const since='2026-10-24T07:00:00.000Z';
const record=(id,seconds,elapsed_ms=100)=>({id,at:`2026-10-24T07:00:${String(seconds).padStart(2,'0')}.000Z`,elapsed_ms,command:'computer_snapshot',ok:true,gap_ms:999999});
test('explicit task boundary excludes later diagnostic polling and other processes',()=>{
 const rows=[record('10.1',1),record('11.1',2),{...record('10.2',3),verification_error:'window_not_found'},record('10.3',55)];
 const result=measureRun(rows,{pid:10,since,through:'10.2'});
 assert.equal(result.calls,2);assert.equal(result.wall_ms,3100);assert.equal(result.service_ms,200);
 assert.equal(result.max_gap_ms,1900);assert.equal(result.verification_failures,1);assert.equal(result.tool_failures,0);
});
test('missing boundary and invalid durations refuse rather than emit misleading statistics',()=>{
 assert.throws(()=>measureRun([record('10.1',1)],{pid:10,since,through:'10.2'}),/missing/);
 assert.throws(()=>measureRun([record('10.1',1,-1)],{pid:10,since,through:'10.1'}),/duration/);
 assert.throws(()=>measureRun([],{pid:10,since:'invalid',through:'10.1'}));
});
