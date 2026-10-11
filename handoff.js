'use strict';
const path=require('node:path');
const {spawn}=require('node:child_process');
function prepareHandoff(win,{platform=process.platform,spawnHelper=spawn,timeoutMs=35000}={}){
  if(platform!=='win32')return {watch(){},cancel(){}};
  win.setAlwaysOnTop(true);
  let helper,timer,done=false;
  const release=()=>{if(done)return;done=true;clearTimeout(timer);if(!win.isDestroyed())win.setAlwaysOnTop(false);};
  return {
    watch(processId){
      if(done)return;if(!Number.isSafeInteger(processId)||processId<=0){release();return;}
      const script=path.join(__dirname.replace(/app\.asar(?=[\\/]|$)/,'app.asar.unpacked'),'scripts','windows-handoff.ps1');
      try{
        helper=spawnHelper('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-TargetProcessId',String(processId)],{windowsHide:true,stdio:['pipe','pipe','ignore']});
        let output='';helper.stdout.on('data',chunk=>{output+=chunk.toString();if(!done && /fullscreen\r?\n/.test(output)){release();helper.stdin.end('release\n');}});
        helper.stdin.on('error',()=>{});helper.once('error',release);helper.once('close',release);
        timer=setTimeout(()=>{release();helper.kill();},timeoutMs);timer.unref?.();
      }catch{release();}
    },
    cancel(){release();helper?.kill();}
  };
}
module.exports={prepareHandoff};
