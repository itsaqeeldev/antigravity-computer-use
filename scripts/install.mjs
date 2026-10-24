import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {storageOperation,defaultInstallationRoot} from '../server/storage.mjs';
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function mergeConfig(file,entry){
 const current=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):{};
 if(!current||typeof current!=='object'||Array.isArray(current)||current.mcpServers&&(typeof current.mcpServers!=='object'||Array.isArray(current.mcpServers)))throw new Error('Invalid MCP configuration: '+file);
 current.mcpServers??={};if(entry)current.mcpServers['antigravity-computer-use']=entry;else delete current.mcpServers['antigravity-computer-use'];
 return JSON.stringify(current,null,2)+'\n';
}
// Inert installer unit fixtures inject this filesystem boundary, like the
// runtime's mock driver. No CLI/environment/model argument can disable it.
export function install({bundle=here,target,home=os.homedir(),workspace=null,legacyProfiles=false,integration='direct',permissionMode,prepareStorage=(folder,helper,purpose='install')=>storageOperation(purpose,folder,{helper})}={}){
 if(!['direct','mcp'].includes(integration)||permissionMode!=null&&!['standalone','host-managed'].includes(permissionMode))throw new Error('Invalid integration/permission mode');
 bundle=path.resolve(bundle);
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const metadataFile=path.join(bundle,'bundle-manifest.json');
 const metadata=JSON.parse(fs.readFileSync(metadataFile,'utf8'));
 const version=metadata.version;
 if(!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version))throw new Error('Invalid bundle version');
 if(!metadata.files||typeof metadata.files!=='object'||Array.isArray(metadata.files)||!Object.keys(metadata.files).length)throw new Error('A complete bundle file manifest is required.');
 const inventory=[];
 function enumerate(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const file=path.join(dir,entry.name),name=path.relative(bundle,file).replaceAll('\\','/');
   if(entry.isSymbolicLink())throw new Error('Bundle links are not supported: '+name);
   if(entry.isDirectory())enumerate(file);
   else if(entry.isFile()){if(name!=='bundle-manifest.json')inventory.push(name);}
   else throw new Error('Unsupported bundle entry: '+name);
  }
 }
 enumerate(bundle);
 if(inventory.length!==Object.keys(metadata.files).length||inventory.some(name=>!Object.hasOwn(metadata.files,name)))throw new Error('Bundle inventory differs from the manifest; every payload file must be sealed.');
 // Validate before making backups, writing config or installing executable bytes.
 for(const [name,expected] of Object.entries(metadata.files)){
  if(!name||name.includes('\\')||name.split('/').some(p=>!p||p==='.'||p==='..')||path.isAbsolute(name)||!/^[a-f0-9]{64}$/.test(expected))throw new Error('Invalid bundle manifest entry: '+name);
  const actual=createHash('sha256').update(fs.readFileSync(path.join(bundle,name))).digest('hex');
  if(actual!==expected)throw new Error('Bundle integrity check failed: '+name);
 }
 for(const required of ['node.exe','bin/AxonHost.exe','bin/StorageGuard.exe','skills/computer-use/SKILL.md'])if(!Object.hasOwn(metadata.files,required))throw new Error('Bundle manifest omits '+required);
 const storageHelper=path.join(bundle,'bin/StorageGuard.exe');
 const profiles=[path.join(home,'.gemini/config/skills/computer-use'),...(workspace?[path.join(path.resolve(workspace),'.agents/skills/computer-use')]:[])];
 const previousRoots=new Set();
 for(const dir of profiles){
  const pointer=path.join(dir,'deployment.json');
  if(fs.existsSync(pointer)){const value=JSON.parse(fs.readFileSync(pointer,'utf8'));if(typeof value.target!=='string'||!path.isAbsolute(value.target))throw new Error('Invalid prior deployment pointer.');previousRoots.add(path.resolve(value.target));}
  else if(fs.existsSync(path.join(dir,'SKILL.md'))){
   const text=fs.readFileSync(path.join(dir,'SKILL.md'),'utf8').toLowerCase();
   for(const candidate of ['D:\\Tools\\AntigravityComputerUse',path.join(process.env.LOCALAPPDATA||home,'AntigravityComputerUse')])if(text.includes(candidate.toLowerCase())&&fs.existsSync(path.join(candidate,'installation.json')))previousRoots.add(path.resolve(candidate));
  }
 }
 if(!target){
  const pointer=path.join(home,'.gemini/config/skills/computer-use/deployment.json');
  if(fs.existsSync(pointer))target=JSON.parse(fs.readFileSync(pointer,'utf8')).target;
 }
 target=path.resolve(target||defaultInstallationRoot({helper:storageHelper,home,localAppData:process.env.LOCALAPPDATA}));
 const within=(parent,child)=>{const rel=path.relative(parent,child);return !rel||!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
 if(within(bundle,target)||within(target,bundle))throw new Error('Bundle and installation folders must not overlap.');
 const priorFile=path.join(target,'installation.json');
 const prior=fs.existsSync(priorFile)?JSON.parse(fs.readFileSync(priorFile,'utf8')):null;
 const resolvedWorkspace=workspace?path.resolve(workspace):null;
 const scope=resolvedWorkspace?createHash('sha256').update(process.platform==='win32'?resolvedWorkspace.toLowerCase():resolvedWorkspace).digest('hex').slice(0,12):null;
 const registryFile=path.join(target,'deployments.json'),registry=fs.existsSync(registryFile)?JSON.parse(fs.readFileSync(registryFile,'utf8')):{};
 if(!registry||typeof registry!=='object'||Array.isArray(registry))throw new Error('Invalid private deployment registry.');
 const previous=registry[scope||'global']||(prior?.workspace===resolvedWorkspace?prior:null);
 permissionMode??=previous?.integration===integration&&['standalone','host-managed'].includes(previous.permission_mode)?previous.permission_mode:integration==='mcp'?'host-managed':'standalone';
 const liveFile=path.join(target,'data','desktop-session.json');
 for(const root of new Set([target,...previousRoots])){const sessionFile=path.join(root,'data','desktop-session.json');if(fs.existsSync(sessionFile)){
  const live=JSON.parse(fs.readFileSync(sessionFile,'utf8'));
  if(!Number.isSafeInteger(live.pid)||live.pid<=0)throw new Error('Existing session metadata is invalid. Inspect it before installing.');
  let alive=true;try{process.kill(live.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;}
  if(alive)throw new Error('A desktop service is still running. End its task and shutdown that service before installing; no installation files were changed.');
 }}
 const release=path.join(target,'releases',version+'-'+stamp);
 // A project-local update must not repoint an already installed global skill.
 const launcher=path.join(target,scope?`cu-${scope}.mjs`:'cu.mjs');
 const launcherNode=path.join(target,scope?`cu-${scope}-node.exe`:'cu-node.exe');
 const controllerStart=path.join(target,scope?`Start Computer Use-${scope}.cmd`:'Start Computer Use.cmd');
 if(!fs.existsSync(path.join(bundle,'bin','AxonHost.exe'))||!fs.existsSync(path.join(bundle,'node.exe')))throw new Error('Run the bundle build first; prebuilt native host and Node are required.');
 const base=workspace?path.join(path.resolve(workspace),'.agents'):path.join(home,'.gemini','config');
 const configs=workspace?[path.join(base,'mcp_config.json')]:[...new Set([path.join(base,'mcp_config.json'),...(legacyProfiles?['antigravity','antigravity-ide','antigravity-cli'].filter(p=>fs.existsSync(path.join(home,'.gemini',p))).map(p=>path.join(home,'.gemini',p,'mcp_config.json')):[])])];
 const entry={command:path.join(release,'node.exe'),args:[path.join(release,'server','index.mjs')],env:{AGCU_DATA_DIR:path.join(target,'data'),AGCU_PERMISSION_MODE:permissionMode,AGCU_TAKEOVER_MODE:'manual'}};
 const skillDirs=workspace?[path.join(base,'skills','computer-use')]:[path.join(base,'skills','computer-use'),...(legacyProfiles?['antigravity','antigravity-cli','antigravity-ide'].map(p=>path.join(home,'.gemini',p,'skills','computer-use')):[])];
 // Parse every config BEFORE writing anything. Keep exact backup bytes for rollback.
 const updates=configs.map(file=>({file,text:mergeConfig(file,integration==='mcp'?entry:null)}));
 // Before secrets/backups or executable bytes are written, establish a private
 // anchor and refuse writable/reparse ancestors. Never change those parents.
 prepareStorage(target,storageHelper);
 for(const root of previousRoots)if(root!==target)prepareStorage(root,storageHelper,'legacy');
 const preserveControl=()=>{
  for(const root of previousRoots)if(root!==target){
   const previousData=path.join(root,'data'),data=path.join(target,'data');
   if(fs.existsSync(path.join(previousData,'emergency.stop'))){fs.mkdirSync(data,{recursive:true});fs.writeFileSync(path.join(data,'emergency.stop'),'stopped');}
   const preferences=path.join(previousData,'control-preferences.json'),destination=path.join(data,'control-preferences.json');
   if(!fs.existsSync(destination)&&fs.existsSync(preferences)){const saved=JSON.parse(fs.readFileSync(preferences,'utf8'));if(['manual','smart'].includes(saved.takeover_mode)){fs.mkdirSync(data,{recursive:true});fs.writeFileSync(destination,JSON.stringify({takeover_mode:saved.takeover_mode},null,2));}}
  }
 };
 preserveControl();
 const backup=path.join(target,'backups',stamp);fs.mkdirSync(backup,{recursive:true});
 const records=[];
 for(const {file} of updates){const saved=path.join(backup,'config-'+records.length+'.json');const exists=fs.existsSync(file);if(exists)fs.copyFileSync(file,saved);records.push({file,saved,existed:exists,kind:'config'});}
 for(const file of skillDirs){const saved=path.join(backup,'skill-'+records.length);const exists=fs.existsSync(file);if(exists)fs.cpSync(file,saved,{recursive:true});records.push({file,saved,existed:exists,kind:'skill'});}
 for(const dir of skillDirs){const file=path.join(dir,'deployment.json'),saved=path.join(backup,'deployment-'+records.length+'.json'),exists=fs.existsSync(file);if(exists)fs.copyFileSync(file,saved);records.push({file,saved,existed:exists,kind:'deployment'});}
 const installationFile=path.join(target,'installation.json'),savedInstallation=path.join(backup,'prior-installation.json');
 const installedBefore=fs.existsSync(installationFile);if(installedBefore)fs.copyFileSync(installationFile,savedInstallation);
 records.push({file:installationFile,saved:savedInstallation,existed:installedBefore,kind:'installation'});
 const savedRegistry=path.join(backup,'prior-deployments.json'),registryExisted=fs.existsSync(registryFile);if(registryExisted)fs.copyFileSync(registryFile,savedRegistry);
 records.push({file:registryFile,saved:savedRegistry,existed:registryExisted,kind:'deployment-registry'});
 for(const [file,label] of [[launcher,'prior-cu.mjs'],[launcherNode,'prior-cu-node.exe'],[controllerStart,'prior-controller-start.cmd']]){
  const saved=path.join(backup,label),existed=fs.existsSync(file);if(existed)fs.copyFileSync(file,saved);
  records.push({file,saved,existed,kind:'launcher'});
 }
 fs.mkdirSync(path.dirname(release),{recursive:true});fs.cpSync(bundle,release,{recursive:true});
 fs.writeFileSync(path.join(release,'desktop-policy.json'),JSON.stringify({permission_mode:permissionMode,data_dir:path.join(target,'data')},null,2));
 // No batch wrapper: CMD would reparse percent signs and shell metacharacters
 // in model-supplied text. A Node entrypoint preserves the actual argv.
 fs.writeFileSync(launcher+'.agcu.tmp',launcherSource(release));
 fs.writeFileSync(controllerStart+'.agcu.tmp',controllerStartSource(scope));
 try{fs.linkSync(path.join(release,'node.exe'),launcherNode+'.agcu.tmp');}catch{fs.copyFileSync(path.join(release,'node.exe'),launcherNode+'.agcu.tmp');}
 // File copying can carry security attributes. Seal the actual copied tree,
 // not merely the top directory, before changing the host's configuration.
 prepareStorage(target,storageHelper);
 preserveControl(); // Never lose a Stop that appeared while the update was staged.
 if(fs.existsSync(liveFile)){
  const live=JSON.parse(fs.readFileSync(liveFile,'utf8'));let alive=true;
  try{process.kill(live.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;}
  if(alive)throw new Error('A desktop task began during staging. Its installed launcher/configuration were not replaced. Finish and shutdown before updating.');
 }
 fs.renameSync(launcherNode+'.agcu.tmp',launcherNode);
 fs.renameSync(launcher+'.agcu.tmp',launcher);
 fs.renameSync(controllerStart+'.agcu.tmp',controllerStart);
 for(const {file,text} of updates){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.agcu.tmp',text);fs.renameSync(file+'.agcu.tmp',file);}
 for(const file of skillDirs){
  fs.mkdirSync(file,{recursive:true});fs.cpSync(path.join(release,'skills','computer-use'),file,{recursive:true});
  const instructions=path.join(file,'SKILL.md');
  const command=`& '${launcherNode.replaceAll("'","''")}' '${launcher.replaceAll("'","''")}'`;
  fs.writeFileSync(instructions,fs.readFileSync(instructions,'utf8').replaceAll('{{DESKTOP_COMMAND}}',command).replaceAll('{{CONTROLLER_START}}',controllerStart));
  fs.writeFileSync(path.join(file,'deployment.json'),JSON.stringify({target,release,workspace:resolvedWorkspace,permission_mode:permissionMode},null,2));
 }
 registry[scope||'global']={release,integration,permission_mode:permissionMode,workspace:resolvedWorkspace};
 fs.writeFileSync(registryFile+'.agcu.tmp',JSON.stringify(registry,null,2));fs.renameSync(registryFile+'.agcu.tmp',registryFile);
 const manifest={release,launcher,launcher_node:launcherNode,controller_start:controllerStart,workspace:resolvedWorkspace,integration,permission_mode:permissionMode,configs,skills:skillDirs,records};fs.writeFileSync(path.join(backup,'rollback.json'),JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(target,'installation.json'),JSON.stringify({...manifest,backup},null,2));
 return {target,release,launcher,launcher_node:launcherNode,controller_start:controllerStart,configs,skills:skillDirs,backup};
}
// Fixed, argument-free human entrypoint; no model text or command forwarding.
export function controllerStartSource(scope){const stem=scope?`cu-${scope}`:'cu';return `@echo off\r\n"%~dp0${stem}-node.exe" "%~dp0${stem}.mjs" start\r\nif errorlevel 1 pause\r\n`;}
export function launcherSource(release){return `import {main,encodeReply} from ${JSON.stringify(pathToFileURL(path.join(release,'scripts','desktop.mjs')).href)};\nawait main().catch(error=>{console.log(encodeReply({ok:false,error:{code:error.code||'refused',message:error.message}}));process.exitCode=1;});\n`;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);const take=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];};
 console.log(JSON.stringify(install({bundle:take('--bundle')||here,target:take('--target'),workspace:take('--workspace'),legacyProfiles:args.includes('--legacy-profiles'),integration:take('--integration')||'direct',permissionMode:take('--permission-mode')}),null,2));
}
