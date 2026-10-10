'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
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
  const manifest={version:1,source:root,imported_at:new Date().toISOString(),assets:{},backgrounds:[],inventory:[],notes:[]};
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
  if(!manifest.backgrounds.length)throw new Error('No supported NXE wallpapers found');
  manifest.notes.push('Executable resources, compiled XUR layouts, console fonts and audio are not executed or converted.');
  authorize();await fs.writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2));
  return {directory:destination,selected:manifest.backgrounds.find(b=>b.label.startsWith('Theme1'))?.id || manifest.backgrounds[0].id};
}
async function loadTheme(config,userData){
  if(!config)return null;
  const root=await fs.realpath(path.join(userData,'nxe-themes')),directory=await fs.realpath(config.directory);
  if(!directory.startsWith(root+path.sep))throw new Error('Invalid imported theme location');
  const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
  if(manifest.version!==1 || !Array.isArray(manifest.backgrounds))throw new Error('Invalid theme manifest');
  for(const [id,asset] of Object.entries(manifest.assets))if(!/^[a-f0-9]{20}$/.test(id) || !/^[a-f0-9]{20}\.(jpg|png)$/.test(asset.file))throw new Error('Invalid theme asset');
  return {directory,manifest,selected:config.selected};
}
function publicTheme(theme){return theme?{backgrounds:theme.manifest.backgrounds.map(b=>({...b,url:`kratos-art://theme/${b.id}`})),selected:theme.selected,assetCount:Object.keys(theme.manifest.assets).length,resourceCount:theme.manifest.inventory.length,notes:theme.manifest.notes}: {backgrounds:[],selected:null};}
module.exports={parseXzp,importTheme,loadTheme,publicTheme};
