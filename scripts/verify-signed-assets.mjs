// Independent verifier for prepared release artifacts. Public-key access only.
import fs from 'node:fs';import path from 'node:path';import {verifyRelease,verifyStaged,sha256} from '../server/update-core.mjs';
const [bundle,assets]=process.argv.slice(2);
if(!bundle||!assets)throw Error('Pass the sealed bundle and prepared asset directory.');
const name=`update-${process.platform}-${process.arch}.json`;
const envelope=JSON.parse(fs.readFileSync(path.join(assets,name)));
const manifest=verifyRelease(Buffer.from(envelope.manifest,'base64'),envelope.signature,fs.readFileSync(new URL('../release-public-key.pem',import.meta.url)),{channel:'beta'});
verifyStaged(bundle,manifest);
const expected=new Set([name]);
for(const item of Object.values(manifest.files)){
 const url=new URL(item.url),asset=decodeURIComponent(url.pathname.split('/').at(-1));
 if(asset!==path.basename(asset)||asset==='.'||asset==='..')throw Error('Signed asset name is invalid.');
 const file=path.join(assets,asset),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==item.size||sha256(fs.readFileSync(file))!==item.sha256)throw Error('Prepared asset does not match signed metadata.');expected.add(asset);
}
const actual=fs.readdirSync(assets);if(actual.length!==expected.size||actual.some(name=>!expected.has(name)))throw Error('Unsealed or missing release asset.');
console.log(JSON.stringify({signature_verified:true,platform:manifest.platform,arch:manifest.arch,version:manifest.version,sequence:manifest.sequence,build_id:manifest.build_id,payloads:Object.keys(manifest.files).length,assets:expected.size,published:false}));
