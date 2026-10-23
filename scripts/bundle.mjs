import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {ensureHost,SOURCES} from '../server/build.mjs';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const nodeLicense=JSON.parse(fs.readFileSync(path.join(root,'licenses','Node-provenance.json'),'utf8'));
if(nodeLicense.version!==process.version)throw new Error('Packaging requires '+nodeLicense.version+' or an updated exact Node license/provenance record.');
const outputIndex=process.argv.indexOf('--output');
if(outputIndex>=0&&!process.argv[outputIndex+1])throw new Error('--output requires a new folder path.');
const out=outputIndex>=0?path.resolve(process.argv[outputIndex+1]):path.join(root,'dist','AntigravityComputerUse-windows-x64');
if(outputIndex>=0&&fs.existsSync(out)&&fs.readdirSync(out).length)throw new Error('Explicit output must be a fresh empty folder; existing files are preserved.');
// Source-addressed caching already rebuilds changed native sources. Forcing a
// rebuild here discards the qualified binary (legacy csc outputs vary by build).
const host=ensureHost();fs.mkdirSync(path.join(out,'bin'),{recursive:true});
fs.copyFileSync(host.exe,path.join(out,'bin','AxonHost.exe'));
fs.copyFileSync(process.execPath,path.join(out,'node.exe'));
const modules=['index.mjs','desktop-service.mjs','desktop-tools.mjs','receipts.mjs','mcp.mjs','runtime.mjs','guardian.mjs','driver.mjs','build.mjs','sessions.mjs','policy.mjs','render.mjs','upstream-utils.mjs','version.mjs'];
fs.mkdirSync(path.join(out,'server'),{recursive:true});for(const f of modules)fs.copyFileSync(path.join(root,'server',f),path.join(out,'server',f));
for(const folder of ['skills','scripts','licenses'])fs.cpSync(path.join(root,folder),path.join(out,folder),{recursive:true});
for(const f of ['README.md','CONTRIBUTING.md','SECURITY.md','LICENSE','LICENSE.upstream','THIRD_PARTY_NOTICES.md','UPSTREAM.json','VALIDATION.md','PROJECT-STATUS.md','IMPLEMENTATION_PROGRESS.md'])if(fs.existsSync(path.join(root,f)))fs.copyFileSync(path.join(root,f),path.join(out,f));
fs.cpSync(path.join(root,'docs'),path.join(out,'docs'),{recursive:true});
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const nativeSource=createHash('sha256');for(const file of SOURCES)nativeSource.update(path.basename(file)+'\0').update(fs.readFileSync(file));
fs.writeFileSync(path.join(out,'bundle-manifest.json'),JSON.stringify({version,platform:process.platform,arch:process.arch,node:process.version,node_sha256:sha(path.join(out,'node.exe')),host_sha256:sha(path.join(out,'bin','AxonHost.exe')),native_source_sha256:nativeSource.digest('hex'),license_node_revision:'v24.20.0',built_at:new Date().toISOString(),permission_mode:'host-managed'},null,2));
fs.writeFileSync(path.join(out,'install.cmd'),'@echo off\r\n"%~dp0node.exe" "%~dp0scripts\\install.mjs" %*\r\n');
console.log(out);
const files={};
function inventory(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())inventory(p);else if(e.name!=='bundle-manifest.json')files[path.relative(out,p).replaceAll('\\','/')]=sha(p);}}
inventory(out);
const manifestPath=path.join(out,'bundle-manifest.json');const manifest=JSON.parse(fs.readFileSync(manifestPath));
manifest.files=files;manifest.build_id=createHash('sha256').update(JSON.stringify(files)).digest('hex');
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
