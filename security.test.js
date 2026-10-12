'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {readAsset,APP_FILES}=require('./local-assets'),{coverPath}=require('./covers'),{verifyScript}=require('./handoff'),scanner=require('./scanner');
test('local assets reject escaping paths, symlinks, unsupported types, and excessive sizes',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'nxe-assets-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const allowed=path.join(root,'allowed');await fs.mkdir(allowed);await fs.writeFile(path.join(allowed,'cover.jpg'),'sample');await fs.writeFile(path.join(root,'outside.jpg'),'private');
  assert.equal((await readAsset(path.join(allowed,'cover.jpg'),allowed,['.jpg'])).mime,'image/jpeg');
  await assert.rejects(readAsset(path.join(root,'outside.jpg'),allowed,['.jpg']),/escapes/);
  await assert.rejects(readAsset(path.join(allowed,'cover.jpg'),allowed,['.wav']),/Unsupported/);
  await assert.rejects(readAsset(path.join(allowed,'cover.jpg'),allowed,['.jpg'],1),/Invalid/);
  try{await fs.symlink(root,path.join(allowed,'linked'),'junction');await assert.rejects(readAsset(path.join(allowed,'linked','outside.jpg'),allowed,['.jpg']),/escapes/);}catch(error){if(!['EPERM','EACCES','ENOTSUP'].includes(error.code))throw error;}
  assert.equal(APP_FILES.has('../scanner.js'),false);assert.equal(APP_FILES.has('preload.js'),false);assert.equal(APP_FILES.has('package.json'),false);
});
test('cover filenames cannot escape cache and credentials reject malformed hashes',()=>{
  for(const id of ['../secret','C:\\secret','a/b','',null])assert.throws(()=>coverPath('cache',id),/Invalid game ID/);
  assert.equal(scanner.verifyPin('1234',{salt:'a'.repeat(100000),hash:'00'}),false);assert.equal(scanner.verifyPin('1234',null),false);
});
test('tampered native helper scripts are rejected',async t=>{
  verifyScript(path.join(__dirname,'scripts/windows-handoff.ps1'));
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'nxe-helper-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const file=path.join(root,'helper.ps1');await fs.writeFile(file,'Write-Output unexpected');assert.throws(()=>verifyScript(file),/integrity/);
});

test('existing authentication corruption fails closed instead of resetting to the default PIN',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nxe-auth-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const file=path.join(root,'library.json');
 const base={rom_directory:'',xenia_executable:'',games:[]};await fs.writeFile(file,JSON.stringify(base));await assert.rejects(scanner.loadLibrary(file),/Missing administrator credential/);
 await fs.writeFile(file,JSON.stringify({...base,admin_credential:{salt:'bad',hash:'bad'}}));await assert.rejects(scanner.loadLibrary(file),/Invalid administrator credential/);
});

test('saving uses a fresh exclusive temporary file, leaving an existing predictable temp untouched',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nxe-write-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const file=path.join(root,'library.json');await fs.writeFile(file+'.tmp','existing temp');await scanner.saveLibrary(file,{games:[]});assert.equal(await fs.readFile(file+'.tmp','utf8'),'existing temp');assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),{games:[]});
});
