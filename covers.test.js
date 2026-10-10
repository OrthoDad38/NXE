'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createService,matches,applyCached}=require('./covers');
test('cover matching normalizes accents and punctuation, ranks exact title over sequels',()=>{
  const results=matches('Viva Pinata',[{id:'1',title:'Viva Piñata: Trouble in Paradise'},{id:'2',title:'Viva Piñata'},{id:'3',title:'Halo 3'}]);
  assert.equal(results[0].id,'2');assert.equal(results.length,2);
  assert.deepEqual(matches('',[{id:'1',title:'Halo'}]),[]);
  assert.deepEqual(matches('Viva Pinata',[{id:'1',title:'N'},{id:'2',title:'日本語'}]),[]);
});
test('provider uses fixed archive URLs, validates selections and rejects nonimages',async()=>{
  const urls=[];
  const service=createService(async url=>{urls.push(url);return new Response(url.endsWith('games.json')?JSON.stringify([{id:'4D5307E6',title:'Viva Piñata'},{id:'../../bad',title:'Bad'}]):Buffer.from([255,216,255,224]));});
  assert.equal((await service.search('Viva Pinata'))[0].id,'4D5307E6');
  assert.equal((await service.download('4D5307E6')).length,4);
  await assert.rejects(service.download('../../bad'),/Unknown/);
  assert.equal(urls[1],'https://raw.githubusercontent.com/xenia-manager/x360db/main/titles/4D5307E6/artwork/boxart.jpg');
  const bad=createService(async url=>new Response(url.endsWith('games.json')?'[{"id":"4D5307E6","title":"Viva"}]':'<html>Error</html>'));
  await bad.search('Viva');await assert.rejects(bad.download('4D5307E6'),/JPEG/);
});
test('cached covers survive rescan and local artwork takes priority',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'kratos-covers-'));
  try{
    await fs.writeFile(path.join(directory,'test.jpg'),'cover');
    const games=await applyCached([{id:'test',uses_fallback_art:true},{id:'local',uses_fallback_art:false,cover_art_path:'local.png'},{id:'missing',uses_fallback_art:true}],directory);
    assert.equal(games[0].uses_fallback_art,false);assert.equal(games[0].cover_art_path,path.join(directory,'test.jpg'));
    assert.equal(games[1].cover_art_path,'local.png');assert.equal(games[2].uses_fallback_art,true);
  }finally{await fs.unlink(path.join(directory,'test.jpg'));await fs.rmdir(directory);}
});
