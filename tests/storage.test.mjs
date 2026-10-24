import {testDirectory} from './paths.mjs';
// Actual NTFS ACL tests on owned temporary data; no desktop/controller input.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';import {storageOperation} from '../server/storage.mjs';
const base=testDirectory('storage');
const root=path.join(base,'agcu-storage-test-'+process.pid+'-'+randomUUID());
// A checkout under a replaceable Windows ancestor cannot qualify private
// installation ACLs. Report that boundary; never fall back to a drive root or
// change the checkout's parent permissions merely to make these tests pass.
let unsafeAncestor;
try{storageOperation('verify-tree',root);}catch(error){
 if(error.code==='insecure_storage_ancestor')unsafeAncestor=error;
 else if(error.code!=='storage_missing')throw error;
}
const aclTest=(name,run)=>test(name,{skip:unsafeAncestor?`Project-local ACL qualification unavailable: ${unsafeAncestor.path}`:false},run);
test('unsafe project ancestors refuse without creating an external test folder',{skip:!unsafeAncestor},()=>{
 assert.throws(()=>storageOperation('install',root),error=>error.code==='insecure_storage_ancestor');
 assert(!fs.existsSync(root));
});
const ps=path.join(process.env.WINDIR||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
function metadata(script,file){
 const env={...process.env,AGCU_ACL_FIXTURE:file};
 for(const key of Object.keys(env))if(key.toLowerCase()==='psmodulepath')delete env[key];
 env.PSModulePath=path.join(process.env.WINDIR||'C:/Windows','System32/WindowsPowerShell/v1.0/Modules');
 const result=spawnSync(ps,['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; "+script],{windowsHide:true,encoding:'utf8',env});
 assert.equal(result.status,0,result.stdout+result.stderr);return result.stdout.trim();
}
const sddl=file=>metadata('(Get-Acl -LiteralPath $env:AGCU_ACL_FIXTURE).Sddl',file);
function broaden(file){metadata('$taskAcl=Get-Acl -LiteralPath $env:AGCU_ACL_FIXTURE; $taskSid=[System.Security.Principal.SecurityIdentifier]::new("S-1-5-11"); $taskRule=[System.Security.AccessControl.FileSystemAccessRule]::new($taskSid,[System.Security.AccessControl.FileSystemRights]::Modify,[System.Security.AccessControl.AccessControlType]::Allow); $taskAcl.AddAccessRule($taskRule); Set-Acl -LiteralPath $env:AGCU_ACL_FIXTURE -AclObject $taskAcl',file);}
aclTest('private local anchor grants only the current user, SYSTEM and administrators',()=>{
 const result=storageOperation('install',root);assert.equal(result.private_storage,true);assert.equal(result.ancestors_checked,true);
 fs.mkdirSync(path.join(root,'releases'));fs.writeFileSync(path.join(root,'releases','payload.txt'),'owned ACL probe');
 assert.equal(storageOperation('verify-tree',root).private_storage,true);
 const acl=sddl(root);assert(!acl.includes(';;;AU)'));assert(!acl.includes(';;;BU)'));assert(acl.includes(';;;SY)'));assert(acl.includes(';;;BA)'));
});
aclTest('copied/untrusted payload rights are detected and the actual tree is repaired',()=>{
 const file=path.join(root,'releases','payload.txt');broaden(file);
 assert.throws(()=>storageOperation('verify-tree',root),e=>e.code==='storage_not_private');
 storageOperation('install',root);assert.equal(storageOperation('verify-tree',root).private_storage,true);assert.equal(fs.readFileSync(file,'utf8'),'owned ACL probe');
});
aclTest('human starter staging is recognized without accepting unrelated lookalike files',()=>{
 for(const name of ['Start Computer Use.cmd','Start Computer Use-012345abcdef.cmd.agcu.tmp'])fs.writeFileSync(path.join(root,name),'inert starter fixture');
 assert.equal(storageOperation('install',root).private_storage,true);
 const unknown=path.join(root,'Start Computer Use evil.cmd');fs.writeFileSync(unknown,'unrelated');const before=sddl(root);
 try{assert.throws(()=>storageOperation('install',root),e=>e.code==='storage_not_dedicated');assert.equal(sddl(root),before);}finally{fs.unlinkSync(unknown);}
});

aclTest('unsafe ancestors and unrelated nonempty folders refuse before changing them',()=>{
 const parent=path.join(root,'releases','unsafe-parent');fs.mkdirSync(parent);broaden(parent);const before=sddl(parent);
 assert.throws(()=>storageOperation('install',path.join(parent,'new-install')),e=>e.code==='insecure_storage_ancestor');assert(!fs.existsSync(path.join(parent,'new-install')));assert.equal(sddl(parent),before);
 const unrelated=path.join(root,'releases','unrelated');fs.mkdirSync(unrelated);fs.writeFileSync(path.join(unrelated,'keep.txt'),'preserve');const original=sddl(unrelated);
 assert.throws(()=>storageOperation('install',unrelated),e=>e.code==='storage_not_dedicated');assert.equal(sddl(unrelated),original);assert.equal(fs.readFileSync(path.join(unrelated,'keep.txt'),'utf8'),'preserve');
 assert.throws(()=>storageOperation('install',path.parse(root).root),e=>e.code==='unsafe_storage_root');
 storageOperation('install',root);
});
aclTest('junctions are rejected without following or changing their destination',()=>{
 const outside=path.join(root,'releases','outside'),link=path.join(root,'releases','junction');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'keep.txt'),'outside');
 const before=sddl(outside);fs.symlinkSync(outside,link,'junction');
 try{assert.throws(()=>storageOperation('install',root),e=>e.code==='storage_link_refused');assert.equal(sddl(outside),before);assert.equal(fs.readFileSync(path.join(outside,'keep.txt'),'utf8'),'outside');}
 finally{fs.unlinkSync(link);}
 assert.equal(storageOperation('verify-tree',root).private_storage,true);
});
