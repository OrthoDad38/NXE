'use strict';
// A single local stream, independent of the short navigation sound effects.
window.uiMusic={
  audio:null,suspended:false,volume:0,muted:false,
  configure(state){
    if(state.music!=='kratos-art://music/dashboard')return;
    if(!this.audio){this.audio=new Audio(state.music);this.audio.loop=true;this.audio.preload='auto';}
    this.volume=(state.audio?.volume ?? .5)*.4;this.muted=state.audio?.muted ?? false;
    this.audio.volume=this.volume;this.sync();
  },
  sync(){
    if(!this.audio)return;
    if(this.suspended||this.muted||this.volume===0)this.audio.pause();
    else if(this.audio.paused)this.audio.play().catch(()=>{});
  },
  stopForGame(){
    this.suspended=true;
    if(this.audio){this.audio.pause();this.audio.currentTime=0;}
  },
  resumeDashboard(){
    if(!this.suspended)return;
    this.suspended=false;
    if(this.audio)this.audio.currentTime=0;
    this.sync();
  }
};
