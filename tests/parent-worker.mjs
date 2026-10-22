import {Driver} from '../server/driver.mjs';
const driver=new Driver({env:{AGCU_PARENT_PID:String(process.pid),CU_OVERLAY:'off',CU_PRESENCE:'off'}});
await driver.start();console.log(JSON.stringify({host:driver.info.pid}));
setInterval(()=>{},1000);
