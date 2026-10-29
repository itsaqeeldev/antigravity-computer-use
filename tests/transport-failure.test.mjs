import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {request,failureReply} from '../scripts/desktop.mjs';

// Real client transport, inert loopback peer. No application, native host,
// desktop input, permissions, screenshots or production installation is used.
async function withPeer(accept,check){
 const sockets=new Set();let accepted=0;
 const server=net.createServer(socket=>{
  sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));
  socket.setEncoding('utf8');let text='';
  socket.on('data',part=>{
   text+=part;if(!text.includes('\n'))return;
   accepted++;assert.equal(JSON.parse(text.split('\n')[0]).command,'click');
   socket.removeAllListeners('data');accept(socket);
  });
 });
 await new Promise(resolve=>server.listen({host:'127.0.0.1',port:0},resolve));
 try{await check({pipe:{host:'127.0.0.1',port:server.address().port},secret:'inert-peer'},()=>accepted);}
 finally{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
}

for(const scenario of [
 {name:'lost acknowledgement',code:'session_disconnected',accept:socket=>socket.end()},
 {name:'malformed reply',code:'invalid_service_response',accept:socket=>socket.end('PRIVATE_SYNTHETIC_RESPONSE\n')},
 {name:'non-object reply',code:'invalid_service_response',accept:socket=>socket.end('null\n')},
 {name:'reply without status',code:'invalid_service_response',accept:socket=>socket.end('{"message":"PRIVATE_SYNTHETIC_RESPONSE"}\n')},
 {name:'oversized reply',code:'service_response_too_large',accept:socket=>socket.end(Buffer.alloc(4*1024*1024+1,120))},
 {name:'timed out acknowledgement',code:'request_timeout',timeout:250,accept:()=>{}},
 {name:'never-completing partial reply',code:'request_timeout',timeout:250,accept:socket=>{
  const interval=setInterval(()=>socket.write(' '),15),limit=setTimeout(()=>socket.end(),1500);
  socket.once('close',()=>{clearInterval(interval);clearTimeout(limit);});
 }}
])test(`an accepted action with ${scenario.name} reports unknown delivery without replay`,async()=>{
 await withPeer(scenario.accept,async(session,count)=>{
  // Keep the size guard independent of the deadline under slower CI runners.
  // Deadline-specific cases retain their short limit and slow-byte peer.
  const error=await request(session,'click',{hwnd:1,index:1},scenario.timeout??5000).then(()=>assert.fail('the peer did not acknowledge completion'),error=>error);
  const result=failureReply(error,{record:false});
  assert.equal(count(),1,'the transport never retries a dispatched action');
  assert.equal(result.error.code,scenario.code);
  assert.equal(result.delivery_unknown,true);assert.equal(result.observe_before_continuing,true);
  assert.equal(result.cancellation_requested,true);assert.equal(result.next_action,'inspect_effect_without_replay');
  assert.equal(result.replay_allowed,false);assert(!result.error.message.includes('PRIVATE_SYNTHETIC_RESPONSE'));
  assert(!result.error.message.includes('was cancelled'),'disconnect requests cancellation; it does not confirm native cleanup');
 });
});
