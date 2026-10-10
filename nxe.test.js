'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const nxe=require('./nxe');
function archive(name='icon.png'){
  const text=Buffer.from(name,'utf16le');text.swap16();const offset=22+9+text.length,buffer=Buffer.alloc(offset+8);
  buffer.write('XUIZ');buffer.writeUInt32BE(buffer.length,8);buffer.writeUInt32BE(offset-22,16);buffer.writeUInt16BE(1,20);
  buffer.writeUInt32BE(8,22);buffer[30]=name.length;text.copy(buffer,31);Buffer.from('89504e470d0a1a0a','hex').copy(buffer,offset);return buffer;
}
test('XUIZ extraction checks names, archive length and payload bounds',()=>{
  const good=archive();assert.equal(nxe.parseXzp(good)[0].name,'icon.png');assert.equal(nxe.parseXzp(good)[0].bytes.length,8);
  assert.throws(()=>nxe.parseXzp(archive('../escape.png')),/Unsafe/);
  good.writeUInt32BE(99999,22);assert.throws(()=>nxe.parseXzp(good),/bounds/);
  assert.throws(()=>nxe.parseXzp(Buffer.from('XUIZ')),/Invalid/);
});
test('theme import caches original images, persists selection, and checks authorization before publishing',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'kratos-nxe-'));
  try{
    const source=path.join(directory,'source'),data=path.join(directory,'data');await fs.mkdir(path.join(source,'Theme1'),{recursive:true});
    await fs.writeFile(path.join(source,'Theme1','Wallpaper1.jpg'),Buffer.from([255,216,255,224]));await fs.writeFile(path.join(source,'mediasite.xzp'),archive());
    let checks=0;const config=await nxe.importTheme(source,data,()=>checks++);assert.equal(checks,2);
    await fs.unlink(path.join(source,'Theme1','Wallpaper1.jpg'));
    const theme=await nxe.loadTheme(config,data),publicData=nxe.publicTheme(theme);
    assert.equal(publicData.backgrounds.length,1);assert.equal(publicData.assetCount,2);assert.equal(publicData.resourceCount,1);
    assert.equal((await nxe.loadTheme({...config,selected:null},data)).selected,null);
    await assert.rejects(nxe.loadTheme({directory:source},data),/Invalid imported/);
    await fs.writeFile(path.join(source,'Theme1','Wallpaper1.jpg'),Buffer.from([255,216,255,224]));
    await assert.rejects(nxe.importTheme(source,data,()=>{throw Error('Expired');}),/Expired/);
  }finally{assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(directory,{recursive:true});}
});
