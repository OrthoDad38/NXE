'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');const {musicResponse}=require('./music-stream');
test('music stream exposes length and valid seek ranges, rejecting invalid or multiple ranges',async()=>{
  const bytes=Buffer.from('0123456789'),whole=musicResponse(bytes,null);
  assert.equal(whole.headers.get('content-length'),'10');assert.equal(whole.headers.get('accept-ranges'),'bytes');assert.equal(await whole.text(),'0123456789');
  const seek=musicResponse(bytes,'bytes=2-4');assert.equal(seek.status,206);assert.equal(seek.headers.get('content-range'),'bytes 2-4/10');assert.equal(await seek.text(),'234');
  assert.equal(await musicResponse(bytes,'bytes=8-').text(),'89');assert.equal(await musicResponse(bytes,'bytes=-3').text(),'789');assert.equal(await musicResponse(bytes,'bytes=8-100').text(),'89');
  for(const range of ['bytes=10-','bytes=5-2','bytes=-0','bytes=-','bytes=0-1,3-4','bytes=99999999999999999999-'])assert.equal(musicResponse(bytes,range).status,416);
});
