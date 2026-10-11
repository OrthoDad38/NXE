'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');const {prepareHandoff}=require('./handoff');
function fixture(){const calls=[],helper=new EventEmitter();helper.stdout=new EventEmitter();helper.stdin=new EventEmitter();helper.stdin.end=value=>calls.push(['release',value]);helper.kill=()=>calls.push(['kill']);const win={isDestroyed:()=>false,setAlwaysOnTop:value=>calls.push(['topmost',value])};return {calls,helper,win};}
test('Windows handoff shields startup and releases only after fullscreen, handles CRLF chunks and cancellation',()=>{
  const f=fixture(),handoff=prepareHandoff(f.win,{platform:'win32',spawnHelper:(_command,args,options)=>{assert.equal(args.at(-1),'123');assert.equal(options.windowsHide,true);return f.helper;}});
  assert.deepEqual(f.calls,[['topmost',true]]);handoff.watch(123);f.helper.stdout.emit('data','full');assert.equal(f.calls.length,1);
  f.helper.stdout.emit('data','screen\r\n');assert.deepEqual(f.calls.slice(1),[['topmost',false],['release','release\n']]);
  f.helper.stdout.emit('data','extra');assert.equal(f.calls.length,3);handoff.cancel();assert.equal(f.calls.at(-1)[0],'kill');
  const aborted=fixture(),cancel=prepareHandoff(aborted.win,{platform:'win32',spawnHelper:()=>aborted.helper});cancel.watch(123);cancel.cancel();aborted.helper.stdout.emit('data','fullscreen\n');assert.equal(aborted.calls.some(c=>c[0]==='release'),false);
});
test('handoff releases on helper errors or timeout, and Linux stays unchanged',async()=>{
  const f=fixture(),handoff=prepareHandoff(f.win,{platform:'win32',spawnHelper:()=>f.helper});handoff.watch(123);f.helper.emit('error',Error('Unavailable'));assert.equal(f.calls.at(-1)[1],false);
  const timed=fixture(),timeout=prepareHandoff(timed.win,{platform:'win32',timeoutMs:5,spawnHelper:()=>timed.helper});timeout.watch(123);await new Promise(r=>setTimeout(r,15));assert.deepEqual(timed.calls.slice(1),[['topmost',false],['kill']]);
  const linux=fixture();prepareHandoff(linux.win,{platform:'linux',spawnHelper:()=>{throw Error('Must not spawn');}}).watch(123);assert.equal(linux.calls.length,0);
});

test('native shield arms before the emulator PID is sent, and failed arming cannot hang launch',async()=>{
 const f=fixture(),native=Buffer.alloc(8);native.writeBigUInt64LE(500n);f.win.getNativeWindowHandle=()=>native;f.helper.stdin.write=value=>f.calls.push(['pid',value]);
 const handoff=prepareHandoff(f.win,{platform:'win32',spawnHelper:()=>f.helper});let armed=false;handoff.ready.then(()=>armed=true);
 await Promise.resolve();assert.equal(armed,false);f.helper.stdout.emit('data','armed\r\n');await handoff.ready;assert.equal(armed,true);
 handoff.watch(123);assert.deepEqual(f.calls.at(-1),['pid','pid 123\n']);f.helper.stdout.emit('data','fullscreen\n');assert.equal(f.calls.at(-1)[0],'release');handoff.cancel();
 const failed=fixture();failed.win.getNativeWindowHandle=()=>native;const fallback=prepareHandoff(failed.win,{platform:'win32',armTimeoutMs:5,spawnHelper:()=>failed.helper});await new Promise(r=>setTimeout(r,15));await fallback.ready;assert.equal(failed.calls.at(-1)[0],'kill');
});
