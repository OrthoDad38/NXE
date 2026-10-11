'use strict';
// Ogg seeking/looping needs a known length and byte-range responses.
function musicResponse(bytes,range){
  const size=bytes.length,headers={'Content-Type':'audio/ogg','Accept-Ranges':'bytes','Content-Length':String(size)};
  if(!range)return new Response(bytes,{headers});
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  const invalid=()=>new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  if(!match||(!match[1]&&!match[2]))return invalid();
  let start,end;
  if(!match[1]){const count=Number(match[2]);if(!Number.isSafeInteger(count)||count<=0)return invalid();start=Math.max(0,size-count);end=size-1;}
  else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start>end)return invalid();
  end=Math.min(end,size-1);headers['Content-Length']=String(end-start+1);headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  return new Response(bytes.subarray(start,end+1),{status:206,headers});
}
module.exports={musicResponse};
