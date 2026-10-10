'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const resources=require('./nxe-resources');
// XUIZ directory: big-endian header, length/offset/name-length records, UTF-16BE names.
function parseXzp(buffer) {
  if(buffer.length<22 || buffer.toString('ascii',0,4)!=='XUIZ' || buffer.readUInt32BE(8)!==buffer.length)throw new Error('Invalid XUIZ archive');
  const tableEnd=22+buffer.readUInt32BE(16),count=buffer.readUInt16BE(20);
  if(tableEnd>buffer.length || count>10000)throw new Error('Invalid XUIZ directory');
  let cursor=22;const entries=[];
  for(let i=0;i<count;i++){
    if(cursor+9>tableEnd)throw new Error('Truncated XUIZ entry');
    const length=buffer.readUInt32BE(cursor),offset=buffer.readUInt32BE(cursor+4),chars=buffer[cursor+8];cursor+=9;
    if(cursor+chars*2>tableEnd)throw new Error('Truncated XUIZ name');
    let name='';for(let j=0;j<chars;j++)name+=String.fromCharCode(buffer.readUInt16BE(cursor+j*2));cursor+=chars*2;
    name=name.replace(/\0/g,'').replace(/\\/g,'/');
    if(!name || name.startsWith('/') || name.split('/').some(p=>p==='..') || /[:]/.test(name))throw new Error('Unsafe XUIZ name');
    if(tableEnd+offset+length>buffer.length)throw new Error('Invalid XUIZ data bounds');
    entries.push({name,length,bytes:buffer.subarray(tableEnd+offset,tableEnd+offset+length)});
  }
  return entries;
}
function isImage(bytes) {return bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) || (bytes[0]===255 && bytes[1]===216 && bytes[2]===255);}
async function resolveRoot(folder){
  for(const candidate of [folder,path.join(folder,'NXE'),path.join(folder,'Dashboards','NXE')]){
    try {await fs.access(path.join(candidate,'Theme1','Wallpaper1.jpg'));return await fs.realpath(candidate);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  throw new Error('Choose the dashboard folder containing NXE/Theme1/Wallpaper1.jpg');
}
async function importTheme(folder,userData,authorize=()=>{}){
  const root=await resolveRoot(folder);authorize();
  const themesRoot=path.join(userData,'nxe-themes');await fs.mkdir(themesRoot,{recursive:true});
  const destination=await fs.mkdtemp(path.join(themesRoot,'import-'));
  const manifest={version:1,source:root,imported_at:new Date().toISOString(),assets:{},backgrounds:[],inventory:[],notes:[],sounds:{},menus:{},modules:[]};
  let total=0;
  async function save(name,bytes){
    if(!isImage(bytes) || bytes.length>16*1024*1024)return null;
    total+=bytes.length;if(total>128*1024*1024)throw new Error('Theme assets exceed import limit');
    const id=crypto.createHash('sha256').update(name).digest('hex').slice(0,20);
    const file=`${id}.${bytes[0]===255?'jpg':'png'}`;await fs.writeFile(path.join(destination,file),bytes);
    manifest.assets[id]={file,source:name};return id;
  }
  for(const theme of ['Theme0','Theme1','Theme2']){
    let files;try{files=await fs.readdir(path.join(root,theme),{withFileTypes:true});}catch(error){if(error.code==='ENOENT')continue;throw error;}
    for(const entry of files){
      if(!entry.isFile() || !/\.(png|jpg)$/i.test(entry.name))continue;
      const source=await fs.realpath(path.join(root,theme,entry.name));
      if(!source.startsWith(root+path.sep))throw new Error('Theme file escapes source folder');
      const stat=await fs.stat(source);if(stat.size>16*1024*1024)throw new Error('Theme image too large');
      const id=await save(`${theme}/${entry.name}`,await fs.readFile(source));
      if(id && /^Wallpaper\d+\.jpg$/i.test(entry.name))manifest.backgrounds.push({id,label:`${theme} · ${entry.name.replace('.jpg','')}`});
    }
  }
  try{
    const archivePath=path.join(root,'mediasite.xzp');const stat=await fs.stat(archivePath);if(stat.size>64*1024*1024)throw new Error('Resource archive too large');
    for(const entry of parseXzp(await fs.readFile(archivePath))){
      manifest.inventory.push({name:entry.name,length:entry.length});
      if(entry.length && /\.(png|jpg)$/i.test(entry.name))await save(`mediasite/${entry.name}`,entry.bytes);
    }
  }catch(error){manifest.notes.push(`mediasite.xzp: ${error.message}`);}
  const soundNames={right:'snd_panelright.xma',left:'snd_panelleft.xma',select:'snd_buttonselect.xma',back:'snd_buttonback.xma',open:'snd_panelunfold.xma',close:'snd_panelfold.xma',focus:'btn_Focus.xma'};
  for(const moduleName of ['$flash_dash.xex','$flash_huduiskin.xex','xam.xex']){
    try{
      const source=await fs.realpath(path.join(root,moduleName));if(!source.startsWith(root+path.sep))throw Error('Module escapes source folder');
      const stat=await fs.stat(source);if(stat.size>64*1024*1024)throw Error('Module exceeds size limit');
      authorize();const decoded=await resources.unpackModule(await fs.readFile(source),destination);
      const archives=resources.embeddedArchives(decoded.bytes,parseXzp);manifest.modules.push({name:moduleName,version:decoded.version,archives:archives.length});
      for(const archive of archives)for(const entry of archive.entries){
        manifest.inventory.push({name:`${moduleName}/${archive.offset}/${entry.name}`,length:entry.length});
        if(!entry.length)continue;
        const name=`${moduleName}/${archive.offset}/${entry.name}`;
        if(/\.(jpg|png)$/i.test(entry.name))await save(name,entry.bytes);
        if(['SystemScene.xur','dashSysCslSet.xur','MobyChannelScene.xur'].includes(entry.name) && moduleName==='$flash_dash.xex'){
          try{manifest.menus[entry.name]={...resources.parseXur(entry.bytes),source:name,version:decoded.version};}catch(error){manifest.notes.push(`${name}: ${error.message}`);}
        }
        const role=Object.keys(soundNames).find(key=>soundNames[key]===entry.name);
        if(role && !manifest.sounds[role]){
          const id=crypto.createHash('sha256').update(name).digest('hex').slice(0,20);
          try{authorize();const converted=await resources.convertSound(entry.bytes,destination,id);total+=converted.bytes;manifest.assets[id]={file:converted.file,source:name};manifest.sounds[role]=id;}catch(error){manifest.notes.push(`${entry.name}: ${error.message}`);}
        }
      }
    }catch(error){manifest.notes.push(`${moduleName}: ${error.message}`);}
  }
  if(!manifest.backgrounds.length)throw new Error('No supported NXE wallpapers found');
  manifest.notes.push('Dashboard code is never executed. XUR strings/vectors are decoded; DATA timelines and runtime property binding are not fully translated.');
  authorize();await fs.writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2));
  const original=Object.entries(manifest.assets).find(([,a])=>a.source.startsWith('$flash_dash.xex/')&&a.source.endsWith('/defaultbackground.jpg'));
  return {directory:destination,selected:original?.[0] || manifest.backgrounds.find(b=>b.label.startsWith('Theme1'))?.id || manifest.backgrounds[0].id};
}
async function loadTheme(config,userData){
  if(!config)return null;
  const root=await fs.realpath(path.join(userData,'nxe-themes')),directory=await fs.realpath(config.directory);
  if(!directory.startsWith(root+path.sep))throw new Error('Invalid imported theme location');
  const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
  if(manifest.version!==1 || !Array.isArray(manifest.backgrounds))throw new Error('Invalid theme manifest');
  for(const [id,asset] of Object.entries(manifest.assets))if(!/^[a-f0-9]{20}$/.test(id) || !/^[a-f0-9]{20}\.(jpg|png|wav)$/.test(asset.file))throw new Error('Invalid theme asset');
  const audio=typeof config.audio?.muted==='boolean' && Number.isFinite(config.audio.volume) && config.audio.volume>=0 && config.audio.volume<=1?config.audio:{volume:.5,muted:false};
  return {directory,manifest,selected:config.selected,audio};
}
function publicTheme(theme){
  if(!theme)return {backgrounds:[],selected:null,sounds:{},audio:{volume:.5,muted:false}};
  const url=id=>`kratos-art://theme/${id}`;
  const panel=Object.entries(theme.manifest.assets).find(([,a])=>a.source.startsWith('$flash_dash.xex/') && a.source.endsWith('/BackgroundPanel.png'));
  const icons={};for(const [role,name] of Object.entries({settings:'ico_32x_console.png',games:'ico_32x_myGames.png'})){const entry=Object.entries(theme.manifest.assets).find(([,a])=>a.source.endsWith('/'+name));if(entry)icons[role]=url(entry[0]);}
  const buttons={};for(const key of ['A','B','X','Y']){const entry=Object.entries(theme.manifest.assets).find(([,a])=>a.source.startsWith('$flash_dash.xex/') && a.source.endsWith(`/Legend_${key}.png`));if(entry)buttons[key]=url(entry[0]);}
  const scene={};for(const [role,name] of Object.entries({background:'defaultbackground.jpg',horizon:'Aura_Horizon.png',tray:'TrayBackground.JPG',disc:'icon_disc.png',orb:'xboxLogo.png',marker:'MobyChannelZero.png'})){
    const entry=Object.entries(theme.manifest.assets).find(([,a])=>a.source.startsWith('$flash_dash.xex/')&&a.source.endsWith('/'+name));if(entry)scene[role]=url(entry[0]);
  }
  const shadowNames=['TopLeft','Top','TopRight','Left','Right','BottomLeft','Bottom','BottomRight'];scene.coverShadows=shadowNames.map(name=>{const entry=Object.entries(theme.manifest.assets).find(([,a])=>a.source.endsWith(`/GameDetails_BoxArtDropShadow${name}.png`));return entry?url(entry[0]):null;});
  const backgrounds=theme.manifest.backgrounds.map(b=>({...b,url:url(b.id)}));
  if(scene.background&&!backgrounds.some(b=>b.url===scene.background))backgrounds.unshift({id:scene.background.split('/').at(-1),label:'Original NXE · Green dashboard',url:scene.background});
  return {backgrounds,selected:theme.selected,assetCount:Object.keys(theme.manifest.assets).length,resourceCount:theme.manifest.inventory.length,notes:theme.manifest.notes,sounds:Object.fromEntries(Object.entries(theme.manifest.sounds || {}).map(([role,id])=>[role,url(id)])),audio:theme.audio,menu:theme.manifest.menus?.['dashSysCslSet.xur']?{panel:panel?url(panel[0]):null,detailLabel:theme.manifest.menus['dashSysCslSet.xur'].strings.find(s=>s==='Current Setting') || 'Current Setting',source:theme.manifest.menus['dashSysCslSet.xur'].source,version:theme.manifest.menus['dashSysCslSet.xur'].version}:null,icons,buttons,scene};
}
module.exports={parseXzp,importTheme,loadTheme,publicTheme};
