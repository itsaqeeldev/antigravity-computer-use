import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function mergeConfig(file,entry){
 const current=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):{};
 if(!current||typeof current!=='object'||Array.isArray(current)||current.mcpServers&&(typeof current.mcpServers!=='object'||Array.isArray(current.mcpServers)))throw new Error('Invalid MCP configuration: '+file);
 current.mcpServers??={};current.mcpServers['antigravity-computer-use']=entry;
 return JSON.stringify(current,null,2)+'\n';
}
export function install({bundle=here,target,home=os.homedir(),workspace=null,legacyProfiles=false}={}){
 target=path.resolve(target||(fs.existsSync('D:\\')?'D:\\Tools\\AntigravityComputerUse':path.join(process.env.LOCALAPPDATA||home,'AntigravityComputerUse')));
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const release=path.join(target,'releases','0.2.0-'+stamp);
 if(!fs.existsSync(path.join(bundle,'bin','AxonHost.exe'))||!fs.existsSync(path.join(bundle,'node.exe')))throw new Error('Run the bundle build first; prebuilt native host and Node are required.');
 const base=workspace?path.join(path.resolve(workspace),'.agents'):path.join(home,'.gemini','config');
 const configs=workspace?[path.join(base,'mcp_config.json')]:[...new Set([path.join(base,'mcp_config.json'),...(legacyProfiles?['antigravity','antigravity-ide','antigravity-cli'].filter(p=>fs.existsSync(path.join(home,'.gemini',p))).map(p=>path.join(home,'.gemini',p,'mcp_config.json')):[])])];
 const entry={command:path.join(release,'node.exe'),args:[path.join(release,'server','index.mjs')],env:{AGCU_DATA_DIR:path.join(target,'data'),AGCU_PERMISSION_MODE:'host-managed',AGCU_TAKEOVER_MODE:'manual'}};
 const skillDirs=workspace?[path.join(base,'skills','computer-use')]:[path.join(base,'skills','computer-use'),...(legacyProfiles?['antigravity','antigravity-cli','antigravity-ide'].map(p=>path.join(home,'.gemini',p,'skills','computer-use')):[])];
 // Parse every config BEFORE writing anything. Keep exact backup bytes for rollback.
 const updates=configs.map(file=>({file,text:mergeConfig(file,entry)}));
 const backup=path.join(target,'backups',stamp);fs.mkdirSync(backup,{recursive:true});
 const records=[];
 for(const {file} of updates){const saved=path.join(backup,'config-'+records.length+'.json');const exists=fs.existsSync(file);if(exists)fs.copyFileSync(file,saved);records.push({file,saved,existed:exists,kind:'config'});}
 for(const file of skillDirs){const saved=path.join(backup,'skill-'+records.length);const exists=fs.existsSync(file);if(exists)fs.cpSync(file,saved,{recursive:true});records.push({file,saved,existed:exists,kind:'skill'});}
 fs.mkdirSync(path.dirname(release),{recursive:true});fs.cpSync(bundle,release,{recursive:true});
 for(const {file,text} of updates){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.agcu.tmp',text);fs.renameSync(file+'.agcu.tmp',file);}
 for(const file of skillDirs){fs.mkdirSync(file,{recursive:true});fs.copyFileSync(path.join(release,'skills','computer-use','SKILL.md'),path.join(file,'SKILL.md'));}
 const manifest={release,configs,skills:skillDirs,records};fs.writeFileSync(path.join(backup,'rollback.json'),JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(target,'installation.json'),JSON.stringify({...manifest,backup},null,2));
 return {target,release,configs,skills:skillDirs,backup};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);const take=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];};
 console.log(JSON.stringify(install({bundle:take('--bundle')||here,target:take('--target'),workspace:take('--workspace'),legacyProfiles:args.includes('--legacy-profiles')}),null,2));
}
