'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {selectUserData}=require('./storage');
test('NXE uses existing Kratos settings and caches, prefers NXE settings, and respects explicit overrides',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'nxe-storage-'));
  try{
    const fresh=path.join(root,'NXE'),legacy=path.join(root,'project-kratos');
    assert.equal(selectUserData(root,path.join(root,'nxe-launcher')),fresh);
    await fs.mkdir(legacy);await fs.writeFile(path.join(legacy,'library.json'),'existing credentials and preferences');
    assert.equal(selectUserData(root,fresh),legacy);
    assert.equal(await fs.readFile(path.join(legacy,'library.json'),'utf8'),'existing credentials and preferences');
    const installed=path.join(root,'Project Kratos');await fs.mkdir(installed);await fs.writeFile(path.join(installed,'library.json'),'installed profile');
    assert.equal(selectUserData(root,fresh,true),installed);
    assert.equal(selectUserData(root,fresh,false),legacy);
    await fs.mkdir(fresh);await fs.writeFile(path.join(fresh,'library.json'),'new profile');
    assert.equal(selectUserData(root,fresh),fresh);
    assert.equal(selectUserData(root,path.join(root,'custom')),path.join(root,'custom'));
  }finally{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(root,{recursive:true});}
});
