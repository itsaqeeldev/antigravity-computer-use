import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function mergeConfig(file,entry){
 const current=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):{};
 if(!current||typeof current!=='object'||Array.isArray(current)||current.mcpServers&&(typeof current.mcpServers!=='object'||Array.isArray(current.mcpServers)))throw new Error('Invalid MCP configuration: '+file);
 current.mcpServers??={};if(entry)current.mcpServers['antigravity-computer-use']=entry;else delete current.mcpServers['antigravity-computer-use'];
 return JSON.stringify(current,null,2)+'\n';
}
export function install({bundle=here,target,home=os.homedir(),workspace=null,legacyProfiles=false,integration='direct',permissionMode}={}){
 permissionMode??=integration==='mcp'?'host-managed':'standalone';
 if(!['direct','mcp'].includes(integration)||!['standalone','host-managed'].includes(permissionMode))throw new Error('Invalid integration/permission mode');
 target=path.resolve(target||(fs.existsSync('D:\\')?'D:\\Tools\\AntigravityComputerUse':path.join(process.env.LOCALAPPDATA||home,'AntigravityComputerUse')));
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
 for(const required of ['node.exe','bin/AxonHost.exe','skills/computer-use/SKILL.md'])if(!Object.hasOwn(metadata.files,required))throw new Error('Bundle manifest omits '+required);
 const liveFile=path.join(target,'data','desktop-session.json');
 if(fs.existsSync(liveFile)){
  const live=JSON.parse(fs.readFileSync(liveFile,'utf8'));
  if(!Number.isSafeInteger(live.pid)||live.pid<=0)throw new Error('Existing session metadata is invalid. Inspect it before installing.');
  let alive=true;try{process.kill(live.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;}
  if(alive)throw new Error('A desktop service is still running. End its task and shutdown that service before installing; no installation files were changed.');
 }
 const release=path.join(target,'releases',version+'-'+stamp);
 const resolvedWorkspace=workspace?path.resolve(workspace):null;
 const scope=resolvedWorkspace?createHash('sha256').update(process.platform==='win32'?resolvedWorkspace.toLowerCase():resolvedWorkspace).digest('hex').slice(0,12):null;
 // A project-local update must not repoint an already installed global skill.
 const launcher=path.join(target,scope?`cu-${scope}.mjs`:'cu.mjs');
 const launcherNode=path.join(target,scope?`cu-${scope}-node.exe`:'cu-node.exe');
 if(!fs.existsSync(path.join(bundle,'bin','AxonHost.exe'))||!fs.existsSync(path.join(bundle,'node.exe')))throw new Error('Run the bundle build first; prebuilt native host and Node are required.');
 const base=workspace?path.join(path.resolve(workspace),'.agents'):path.join(home,'.gemini','config');
 const configs=workspace?[path.join(base,'mcp_config.json')]:[...new Set([path.join(base,'mcp_config.json'),...(legacyProfiles?['antigravity','antigravity-ide','antigravity-cli'].filter(p=>fs.existsSync(path.join(home,'.gemini',p))).map(p=>path.join(home,'.gemini',p,'mcp_config.json')):[])])];
 const entry={command:path.join(release,'node.exe'),args:[path.join(release,'server','index.mjs')],env:{AGCU_DATA_DIR:path.join(target,'data'),AGCU_PERMISSION_MODE:permissionMode,AGCU_TAKEOVER_MODE:'manual'}};
 const skillDirs=workspace?[path.join(base,'skills','computer-use')]:[path.join(base,'skills','computer-use'),...(legacyProfiles?['antigravity','antigravity-cli','antigravity-ide'].map(p=>path.join(home,'.gemini',p,'skills','computer-use')):[])];
 // Parse every config BEFORE writing anything. Keep exact backup bytes for rollback.
 const updates=configs.map(file=>({file,text:mergeConfig(file,integration==='mcp'?entry:null)}));
 const backup=path.join(target,'backups',stamp);fs.mkdirSync(backup,{recursive:true});
 const records=[];
 for(const {file} of updates){const saved=path.join(backup,'config-'+records.length+'.json');const exists=fs.existsSync(file);if(exists)fs.copyFileSync(file,saved);records.push({file,saved,existed:exists,kind:'config'});}
 for(const file of skillDirs){const saved=path.join(backup,'skill-'+records.length);const exists=fs.existsSync(file);if(exists)fs.cpSync(file,saved,{recursive:true});records.push({file,saved,existed:exists,kind:'skill'});}
 const installationFile=path.join(target,'installation.json'),savedInstallation=path.join(backup,'prior-installation.json');
 const installedBefore=fs.existsSync(installationFile);if(installedBefore)fs.copyFileSync(installationFile,savedInstallation);
 records.push({file:installationFile,saved:savedInstallation,existed:installedBefore,kind:'installation'});
 for(const [file,label] of [[launcher,'prior-cu.mjs'],[launcherNode,'prior-cu-node.exe']]){
  const saved=path.join(backup,label),existed=fs.existsSync(file);if(existed)fs.copyFileSync(file,saved);
  records.push({file,saved,existed,kind:'launcher'});
 }
 fs.mkdirSync(path.dirname(release),{recursive:true});fs.cpSync(bundle,release,{recursive:true});
 for(const {file,text} of updates){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.agcu.tmp',text);fs.renameSync(file+'.agcu.tmp',file);}
 fs.writeFileSync(path.join(release,'desktop-policy.json'),JSON.stringify({permission_mode:permissionMode,data_dir:path.join(target,'data')},null,2));
 // No batch wrapper: CMD would reparse percent signs and shell metacharacters
 // in model-supplied text. A Node entrypoint preserves the actual argv.
 fs.writeFileSync(launcher+'.agcu.tmp',launcherSource(release));
 try{fs.linkSync(path.join(release,'node.exe'),launcherNode+'.agcu.tmp');}catch{fs.copyFileSync(path.join(release,'node.exe'),launcherNode+'.agcu.tmp');}
 fs.renameSync(launcherNode+'.agcu.tmp',launcherNode);
 fs.renameSync(launcher+'.agcu.tmp',launcher);
 for(const file of skillDirs){
  fs.mkdirSync(file,{recursive:true});fs.cpSync(path.join(release,'skills','computer-use'),file,{recursive:true});
  const instructions=path.join(file,'SKILL.md');
  const command=`& '${launcherNode.replaceAll("'","''")}' '${launcher.replaceAll("'","''")}'`;
  fs.writeFileSync(instructions,fs.readFileSync(instructions,'utf8').replaceAll('{{DESKTOP_COMMAND}}',command));
 }
 const manifest={release,launcher,launcher_node:launcherNode,workspace:resolvedWorkspace,integration,permission_mode:permissionMode,configs,skills:skillDirs,records};fs.writeFileSync(path.join(backup,'rollback.json'),JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(target,'installation.json'),JSON.stringify({...manifest,backup},null,2));
 return {target,release,launcher,launcher_node:launcherNode,configs,skills:skillDirs,backup};
}
export function launcherSource(release){return `import {main,encodeReply} from ${JSON.stringify(pathToFileURL(path.join(release,'scripts','desktop.mjs')).href)};\nawait main().catch(error=>{console.log(encodeReply({ok:false,error:{code:error.code||'refused',message:error.message}}));process.exitCode=1;});\n`;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);const take=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];};
 console.log(JSON.stringify(install({bundle:take('--bundle')||here,target:take('--target'),workspace:take('--workspace'),legacyProfiles:args.includes('--legacy-profiles'),integration:take('--integration')||'direct',permissionMode:take('--permission-mode')}),null,2));
}
