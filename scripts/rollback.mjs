import fs from 'node:fs';import path from 'node:path';
const file=process.argv[2];if(!file)throw new Error('Pass the exact backups/<timestamp>/rollback.json to restore.');
const data=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
for(const r of data.records){
 if(r.kind==='config'){
  const c=fs.existsSync(r.file)?JSON.parse(fs.readFileSync(r.file)):{};
  const previous=r.existed?JSON.parse(fs.readFileSync(r.saved)):{};
  c.mcpServers??={};const old=previous.mcpServers?.['antigravity-computer-use'];
  if(old)c.mcpServers['antigravity-computer-use']=old;else delete c.mcpServers['antigravity-computer-use'];
  fs.mkdirSync(path.dirname(r.file),{recursive:true});fs.writeFileSync(r.file,JSON.stringify(c,null,2)+'\n');
 }
 else if(r.existed)fs.cpSync(r.saved,r.file,{recursive:true});
 else if(['installation','launcher','deployment','deployment-registry'].includes(r.kind)&&fs.existsSync(r.file))fs.unlinkSync(r.file);
 else if(r.kind==='skill'&&fs.existsSync(path.join(r.file,'SKILL.md')))fs.unlinkSync(path.join(r.file,'SKILL.md'));
}
console.log('Prior configuration and skill files restored. Installed release folders were preserved.');
