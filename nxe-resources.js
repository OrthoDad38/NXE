'use strict';
const crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const {execFile}=require('node:child_process');const {promisify}=require('node:util');const run=promisify(execFile);
function header(buffer){
  if(buffer.length<24 || buffer.toString('ascii',0,4)!=='XEX2')throw Error('Not an XEX2 module');
  const security=buffer.readUInt32BE(16),count=buffer.readUInt32BE(20),headers={};
  if(count>1024 || 24+count*8>buffer.length || security+0x180>buffer.length)throw Error('Invalid XEX header');
  for(let i=0;i<count;i++)headers[buffer.readUInt32BE(24+i*8)]=buffer.readUInt32BE(28+i*8);
  const execution=headers[0x40006];let version=null;
  if(execution && execution+24<=buffer.length){const v=buffer.readUInt32BE(execution+4);version=`${v>>>28}.${(v>>>24)&15}.${(v>>>8)&65535}.${v&255}`;}
  return {headers,security,version,size:buffer.readUInt32BE(security+4),offset:buffer.readUInt32BE(8)};
}
function decrypt(key,bytes){const d=crypto.createDecipheriv('aes-128-cbc',key,Buffer.alloc(16));d.setAutoPadding(false);return Buffer.concat([d.update(bytes),d.final()]);}
function cabinet(buffer){
  const info=header(buffer),p=info.headers[0x3ff];
  if(!p || p+36>buffer.length || buffer.readUInt16BE(p+6)!==2 || info.size>64*1024*1024 || info.offset>=buffer.length)throw Error('Unsupported XEX compression');
  const encryption=buffer.readUInt16BE(p+4),blockSize=buffer.readUInt32BE(p+12),expected=buffer.subarray(p+16,p+36);
  let raw=buffer.subarray(info.offset);
  if(encryption===1){
    let valid=null;
    for(const master of [Buffer.alloc(16),Buffer.from('20b185a59d28fdc340583fbb0896bf91','hex')]){
      const candidate=decrypt(decrypt(master,buffer.subarray(info.security+0x150,info.security+0x160)),raw);
      if(crypto.createHash('sha1').update(candidate.subarray(0,blockSize)).digest().equals(expected)){valid=candidate;break;}
    }
    if(!valid)throw Error('XEX block authentication failed');raw=valid;
  }else if(encryption!==0)throw Error('Unsupported XEX encryption');
  let position=0,size=blockSize,digest=expected;const chunks=[];
  while(size){
    if(size<26 || position+size>raw.length || chunks.length>2048)throw Error('Invalid XEX block bounds');
    const block=raw.subarray(position,position+size);
    if(!crypto.createHash('sha1').update(block).digest().equals(digest))throw Error('XEX block authentication failed');
    let cursor=24;
    while(cursor+2<=block.length){const length=block.readUInt16BE(cursor);cursor+=2;if(!length)break;if(cursor+length>block.length)throw Error('Invalid LZX frame');chunks.push(block.subarray(cursor,cursor+length));cursor+=length;}
    position+=size;size=block.readUInt32BE(0);digest=block.subarray(4,24);
  }
  if(chunks.length!==Math.ceil(info.size/32768))throw Error('Unexpected LZX frame count');
  const window=buffer.readUInt32BE(p+8),bits=Math.log2(window);if(!Number.isInteger(bits)||bits<15||bits>21)throw Error('Invalid LZX window');
  const name=Buffer.from('image.bin\0'),file=Buffer.alloc(16+name.length);file.writeUInt32LE(info.size);name.copy(file,16);
  const cab=Buffer.alloc(36);cab.write('MSCF');cab.writeUInt32LE(44,16);cab[24]=3;cab[25]=1;cab.writeUInt16LE(1,26);cab.writeUInt16LE(1,28);
  const folder=Buffer.alloc(8);folder.writeUInt32LE(44+file.length);folder.writeUInt16LE(chunks.length,4);folder.writeUInt16LE((bits<<8)|3,6);
  let remaining=info.size;const data=chunks.map(chunk=>{const h=Buffer.alloc(8);h.writeUInt16LE(chunk.length,4);const length=Math.min(remaining,32768);h.writeUInt16LE(length,6);remaining-=length;return Buffer.concat([h,chunk]);});
  const result=Buffer.concat([cab,folder,file,...data]);result.writeUInt32LE(result.length,8);return result;
}
async function unpackModule(buffer,directory){
  const info=header(buffer),p=info.headers[0x3ff];if(!p || p+8>buffer.length)throw Error('Missing compression header');
  if(buffer.readUInt16BE(p+4)===0 && buffer.readUInt16BE(p+6)<=1)return {bytes:buffer,version:info.version};
  const temporary=await fs.mkdtemp(path.join(directory,'decode-')),cabFile=path.join(temporary,'resources.cab'),output=path.join(temporary,'image.bin');
  try{
    await fs.writeFile(cabFile,cabinet(buffer));
    if(process.platform==='win32')await run(path.join(process.env.SystemRoot || 'C:\\Windows','System32','expand.exe'),[cabFile,output],{windowsHide:true,timeout:20000,maxBuffer:1024*1024});
    else await run('cabextract',['-q','-d',temporary,cabFile],{timeout:20000,maxBuffer:1024*1024});
    const bytes=await fs.readFile(output);if(bytes.length!==info.size)throw Error('Decoded XEX size mismatch');return {bytes,version:info.version};
  }finally{
    for(const file of [cabFile,output])await fs.unlink(file).catch(()=>{});await fs.rmdir(temporary).catch(()=>{});
  }
}
function embeddedArchives(buffer,parse){
  const archives=[];let offset=-1;
  while((offset=buffer.indexOf('XUIZ',offset+1))>=0){
    if(offset+22>buffer.length)continue;const size=buffer.readUInt32BE(offset+8);if(size<22||offset+size>buffer.length)continue;
    try{archives.push({offset,entries:parse(buffer.subarray(offset,offset+size))});}catch{/* A magic-like byte sequence is not necessarily an archive. */}
  }
  return archives;
}
function parseXur(buffer){
  if(buffer.length<20||buffer.toString('ascii',0,4)!=='XUIB'||buffer.readUInt32BE(14)!==buffer.length)throw Error('Invalid XUR');
  const count=buffer.readUInt16BE(18);if(count>16||20+12*count>buffer.length)throw Error('Invalid XUR sections');
  const result={version:buffer.readUInt32BE(4),strings:[],vectors:[],sections:[]};
  for(let i=0;i<count;i++){
    const at=20+i*12,name=buffer.toString('ascii',at,at+4),offset=buffer.readUInt32BE(at+4),length=buffer.readUInt32BE(at+8);
    if(offset<20+12*count||offset+length>buffer.length)throw Error('XUR section out of bounds');result.sections.push({name,length});
    if(name==='STRN'){let cursor=offset;while(cursor<offset+length){if(cursor+2>offset+length)throw Error('Truncated XUR string');const chars=buffer.readUInt16BE(cursor);cursor+=2;if(cursor+chars*2>offset+length)throw Error('Truncated XUR string');let text='';for(let j=0;j<chars;j++)text+=String.fromCharCode(buffer.readUInt16BE(cursor+j*2));cursor+=chars*2;result.strings.push(text);}}
    if(name==='VECT'){if(length%12)throw Error('Invalid XUR vectors');for(let j=0;j<length;j+=12){const vector=[0,4,8].map(n=>buffer.readFloatBE(offset+j+n));if(vector.some(n=>!Number.isFinite(n)))throw Error('Invalid XUR vector');result.vectors.push(vector);}}
  }
  return result;
}
async function convertSound(bytes,directory,id){
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE'||bytes.length>1024*1024)throw Error('Unsupported sound container');
  const input=path.join(directory,`${id}.xma`),output=path.join(directory,`${id}.wav`);
  await fs.writeFile(input,bytes);
  try{const ffmpeg=require('ffmpeg-static').replace('app.asar'+path.sep,'app.asar.unpacked'+path.sep);
    await run(ffmpeg,['-nostdin','-v','error','-y','-i',input,'-t','5','-acodec','pcm_s16le','-ar','48000',output],{windowsHide:true,timeout:15000,maxBuffer:1024*1024});
    const wav=await fs.readFile(output);if(wav.length<44||wav.length>2*1024*1024)throw Error('Invalid converted sound');return {file:`${id}.wav`,bytes:wav.length};
  }finally{await fs.unlink(input).catch(()=>{});}
}
module.exports={header,cabinet,unpackModule,embeddedArchives,parseXur,convertSound};
