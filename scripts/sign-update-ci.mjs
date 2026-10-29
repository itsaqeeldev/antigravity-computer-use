// Trusted maintainer release workflow only. Never persist or echo the secret.
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const [bundle,sequence,minOS,output]=process.argv.slice(2);
const key=process.env.AGCU_RELEASE_SIGNING_KEY;
if(!key)throw Error('The repository release signing secret is not configured.');
const env={...process.env};delete env.AGCU_RELEASE_SIGNING_KEY;
const result=spawnSync(process.execPath,[fileURLToPath(new URL('./sign-update.mjs',import.meta.url)),bundle,'-',sequence,minOS,output],{input:key,encoding:'utf8',env,timeout:60000,windowsHide:true});
if(result.status!==0)throw Error('Signed release preparation failed. Inspect source and public-key configuration.');
process.stdout.write(result.stdout);
