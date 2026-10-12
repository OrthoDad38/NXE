'use strict';
const path=require('node:path'),{spawn}=require('node:child_process');
const fs=require('node:fs'),crypto=require('node:crypto');
const SCRIPT_HASH='d5886061fbb2dadc95a36204927eaeb2bba4f4d56cc9ac5e0611246ecef4f4ef';
function verifyScript(script){
  const stat=fs.lstatSync(script);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>64*1024)throw Error('Invalid handoff script');
  const source=fs.readFileSync(script,'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').trimEnd()+'\n';
  if(crypto.createHash('sha256').update(source).digest('hex')!==SCRIPT_HASH)throw Error('Handoff script integrity check failed');
}
function prepareHandoff(win,{platform=process.platform,spawnHelper=spawn,timeoutMs=45000,armTimeoutMs=8000}={}){
 if(platform!=='win32')return {ready:Promise.resolve(),watch(){},cancel(){}};
 win.setAlwaysOnTop(true);let helper,timer,armTimer,done=false,armed=false,resolveReady;
 const ready=new Promise(resolve=>resolveReady=resolve),handle=win.getNativeWindowHandle?.();
 const kiosk=handle?(handle.length===8?handle.readBigUInt64LE():BigInt(handle.readUInt32LE())).toString():'0';
 const release=()=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(armTimer);resolveReady();if(!win.isDestroyed())win.setAlwaysOnTop(false);};
 const start=pid=>{
  const script=path.join(__dirname.replace(/app\.asar(?=[\\/]|$)/,'app.asar.unpacked'),'scripts','windows-handoff.ps1');
  try{
   verifyScript(script);
      const windowsRoot=process.env.SystemRoot || 'C:\\Windows';
      if(!/^[A-Za-z]:[\\/]/.test(windowsRoot))throw Error('Invalid Windows system directory');
      const powershell=path.win32.join(windowsRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
      helper=spawnHelper(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-KioskWindowHandle',kiosk,'-TargetProcessId',String(pid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
   let output='',errors='';helper.stderr?.on('data',c=>errors=(errors+c.toString()).slice(-1000));
   helper.stdout.on('data',c=>{output+=c.toString();if(!armed&&/armed\r?\n/.test(output)){armed=true;clearTimeout(armTimer);resolveReady();}if(!done&&/fullscreen\r?\n/.test(output)){release();helper.stdin.end('release\n');}});
   helper.stdin.on('error',()=>{});helper.once('error',e=>{console.warn('[NXE] Launch shield:',e.message);release();});
   helper.once('close',code=>{if(!done&&code)console.warn('[NXE] Launch shield:',errors||code);release();});
  }catch(e){console.warn('[NXE] Launch shield:',e.message);release();}
 };
 if(kiosk!=='0'){start(0);if(!done){armTimer=setTimeout(()=>{console.warn('[NXE] Launch shield could not arm.');release();helper?.kill();},armTimeoutMs);armTimer.unref?.();}}else resolveReady();
 return {ready,watch(pid){if(done)return;if(!Number.isSafeInteger(pid)||pid<=0){release();helper?.kill();return;}if(!helper)start(pid);else helper.stdin.write('pid '+pid+'\n');
  if(!done){timer=setTimeout(()=>{console.warn('[NXE] Fullscreen handoff timed out.');release();helper?.kill();},timeoutMs);timer.unref?.();}
 },cancel(){release();helper?.kill();}};
}
module.exports={prepareHandoff,verifyScript};
