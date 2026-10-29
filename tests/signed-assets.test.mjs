import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {generateKeyPairSync,sign} from 'node:crypto';
import {testDirectory} from './paths.mjs';import {sha256} from '../server/update-core.mjs';
test('prepared-asset CLI verifies signatures and rejects tampering or unsealed private evidence',()=>{
 const root=fs.mkdtempSync(path.join(testDirectory('tmp'),'signed-asset-cli-'));
 try{
  for(const folder of ['scripts','server','bundle','assets'])fs.mkdirSync(path.join(root,folder));
  fs.copyFileSync(new URL('../scripts/verify-signed-assets.mjs',import.meta.url),path.join(root,'scripts/verify-signed-assets.mjs'));
  fs.copyFileSync(new URL('../server/update-core.mjs',import.meta.url),path.join(root,'server/update-core.mjs'));
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');fs.writeFileSync(path.join(root,'release-public-key.pem'),publicKey.export({type:'spki',format:'pem'}));
  const bytes=Buffer.from('inert signed payload'),hash=sha256(bytes),asset=hash+'-payload';fs.writeFileSync(path.join(root,'bundle/payload'),bytes);fs.writeFileSync(path.join(root,'assets',asset),bytes);
  const metadata=Buffer.from(JSON.stringify({schema:1,version:'1.0.0',build_id:'a'.repeat(64),sequence:1,platform:process.platform,arch:process.arch,min_os:'0.0.0',expires:'2099-01-01',files:{payload:{sha256:hash,size:bytes.length,url:'https://github.com/shayann07/antigravity-computer-use/releases/download/v1/'+asset}}}));
  const file=path.join(root,'assets',`update-${process.platform}-${process.arch}.json`),envelope={manifest:metadata.toString('base64'),signature:sign(null,metadata,privateKey).toString('base64')};fs.writeFileSync(file,JSON.stringify(envelope));
  const run=()=>spawnSync(process.execPath,[path.join(root,'scripts/verify-signed-assets.mjs'),path.join(root,'bundle'),path.join(root,'assets')],{encoding:'utf8',windowsHide:true,timeout:10000});
  const success=run();assert.equal(success.status,0,success.stderr);assert.equal(JSON.parse(success.stdout).signature_verified,true);
  fs.writeFileSync(path.join(root,'assets',asset),'tampered');assert.notEqual(run().status,0);fs.writeFileSync(path.join(root,'assets',asset),bytes);
  fs.writeFileSync(path.join(root,'assets/private-evidence.txt'),'must not upload');assert.notEqual(run().status,0);fs.unlinkSync(path.join(root,'assets/private-evidence.txt'));
  fs.writeFileSync(file,JSON.stringify({...envelope,signature:Buffer.alloc(64).toString('base64')}));assert.notEqual(run().status,0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
