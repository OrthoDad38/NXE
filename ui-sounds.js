'use strict';
// Only cached local WAV URLs supplied by the main process are accepted.
window.uiSounds={
  clips:new Map(),volume:.5,muted:false,lastTime:0,
  configure(state){
    for(const audio of this.clips.values())audio.pause();this.clips.clear();
    this.volume=state.audio?.volume ?? .5;this.muted=state.audio?.muted ?? false;
    for(const [role,url] of Object.entries(state.sounds || {})){
      if(!/^kratos-art:\/\/theme\/[a-f0-9]{20}$/.test(url))continue;
      const audio=new Audio(url);audio.preload='auto';audio.volume=this.volume;this.clips.set(role,audio);
    }
  },
  play(role){
    if(this.muted||this.volume===0)return false;const clip=this.clips.get(role);if(!clip)return false;
    const now=performance.now();if(role==='focus'&&now-this.lastTime<90)return false;
    this.lastTime=now;for(const audio of this.clips.values())audio.pause();clip.currentTime=0;clip.volume=this.volume;clip.play().catch(()=>{});return true;
  }
};
