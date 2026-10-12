'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.wav':'audio/wav','.ogg':'audio/ogg'};
async function readAsset(file,root,extensions,maxBytes=16*1024*1024){
  const ext=path.extname(file).toLowerCase();if(!extensions.includes(ext))throw Error('Unsupported local asset');
  const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>maxBytes)throw Error('Invalid local asset');
  const [realRoot,realFile]=await Promise.all([fs.realpath(root),fs.realpath(file)]);
  const relative=path.relative(realRoot,realFile);if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Asset escapes allowed directory');
  const bytes=await fs.readFile(realFile);if(bytes.length>maxBytes)throw Error('Local asset exceeds limit');
  return {bytes,mime:MIME[ext]};
}
const APP_FILES=new Set(['index.html','renderer.js','styles.css','ui-sounds.js','ui-music.js','assets/controller-buttons.jpg','assets/xbox-orb.jpg']);
module.exports={readAsset,APP_FILES};
