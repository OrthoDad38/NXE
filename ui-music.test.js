'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('dashboard music loops, survives theme changes, stops for games, and restarts once on return',()=>{
  const clips=[];
  class Audio{constructor(url){this.url=url;this.paused=true;this.currentTime=0;this.plays=0;clips.push(this);}pause(){this.paused=true;}play(){this.paused=false;this.plays++;return Promise.resolve();}}
  const context=vm.createContext({window:{},Audio});vm.runInContext(fs.readFileSync(path.join(__dirname,'ui-music.js'),'utf8'),context);
  const music=context.window.uiMusic,state={music:'kratos-art://music/dashboard',audio:{volume:.5,muted:false}};
  music.configure({...state,music:'https://remote/audio.ogg'});assert.equal(clips.length,0);
  music.configure(state);const clip=clips[0];assert.equal(clip.loop,true);assert.equal(clip.volume,.2);assert.equal(clip.plays,1);
  clip.currentTime=30;music.configure({...state,audio:{volume:.75,muted:false}});assert.equal(clips.length,1);assert.equal(clip.currentTime,30);assert.equal(clip.plays,1);
  music.stopForGame();assert.equal(clip.paused,true);assert.equal(clip.currentTime,0);
  music.configure(state);assert.equal(clip.paused,true);assert.equal(clip.plays,1);
  music.resumeDashboard();assert.equal(clip.currentTime,0);assert.equal(clip.plays,2);music.resumeDashboard();assert.equal(clip.plays,2);
  music.configure({...state,audio:{volume:.5,muted:true}});assert.equal(clip.paused,true);
  music.stopForGame();music.resumeDashboard();assert.equal(clip.paused,true);assert.equal(clip.plays,2);
  music.configure(state);assert.equal(clip.paused,false);assert.equal(clip.plays,3);
  music.configure({...state,audio:{volume:0,muted:false}});assert.equal(clip.paused,true);
});
