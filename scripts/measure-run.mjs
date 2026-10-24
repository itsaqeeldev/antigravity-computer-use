// Measure an explicit receipt interval, excluding later diagnostic status calls.
// Controller timings alone do not prove application success or total AI latency.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function measureRun(records,{pid,since,through}){
 const started=Date.parse(since),prefix=String(pid)+'.';
 if(!Number.isFinite(started)||!/^\d+$/.test(String(pid))||!String(through).startsWith(prefix))throw Error('Pass PID, valid task start time and final task receipt ID.');
 const last=Number(String(through).slice(prefix.length));
 if(!Number.isSafeInteger(last)||last<1)throw Error('Invalid final task receipt ID.');
 const rows=records.filter(row=>{
  if(!String(row.id).startsWith(prefix))return false;
  const sequence=Number(String(row.id).slice(prefix.length));
  return Number.isSafeInteger(sequence)&&sequence>0&&sequence<=last&&Date.parse(row.at)>=started;
 }).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 if(!rows.length||!rows.some(row=>row.id===through))throw Error('Final task receipt is missing from this interval.');
 if(rows.some(row=>!Number.isFinite(row.elapsed_ms)||row.elapsed_ms<0))throw Error('Invalid controller duration in receipt.');
 const groups={},gaps=[];let end=started,overlapping=false;
 for(let i=0;i<rows.length;i++){
  const row=rows[i],at=Date.parse(row.at);
  if(i){const previous=rows[i-1],gap=at-Date.parse(previous.at)-previous.elapsed_ms;gaps.push(Math.max(0,gap));overlapping ||= gap<0;}
  end=Math.max(end,at+row.elapsed_ms);
  const group=groups[row.command]??={count:0,service_ms:0,tool_failures:0,verification_failures:0};
  group.count++;group.service_ms+=row.elapsed_ms;group.tool_failures+=row.ok===false?1:0;group.verification_failures+=row.verification_error?1:0;
 }
 const median=values=>values.length?values.toSorted((a,b)=>a-b)[Math.floor(values.length/2)]:null;
 return {pid:String(pid),from:since,through,to:new Date(end).toISOString(),calls:rows.length,wall_ms:end-started,
  service_ms:rows.reduce((sum,row)=>sum+row.elapsed_ms,0),median_service_ms:median(rows.map(row=>row.elapsed_ms)),
  median_gap_ms:median(gaps),max_gap_ms:gaps.length?Math.max(...gaps):null,overlapping_calls:overlapping,
  tool_failures:rows.filter(row=>row.ok===false).length,verification_failures:rows.filter(row=>row.verification_error).length,groups,
  note:'Explicit task interval only. Wall time includes host/model/file/image tools. Verify the application and output independently; controller success is not application success.'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [file,pid,since,through,output]=process.argv.slice(2);
 if(!file)throw Error('Usage: node scripts/measure-run.mjs RECEIPTS PID TASK_START FINAL_RECEIPT [OUTPUT]');
 const records=fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
 const report=measureRun(records,{pid,since,through});
 if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
