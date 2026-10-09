'use strict';
let gamesList = [], currentIndex = 0, mode = 'library', busy = false, selected = 0, pin = '', settings = {}, editKey = '', editText = '', caps = false;
const api = window.electronAPI;
const track = document.getElementById('carousel-track');
const titleDisplay = document.getElementById('active-title');
const content = document.getElementById('modal-content');
const errorDisplay = document.getElementById('modal-error');
const pinKeys = ['1','2','3','4','5','6','7','8','9','Back','0','Enter'];
const fields = [['rom_directory','ROM directory'],['xenia_executable','Xenia executable'],['runner','Linux runner'],['runner_args','Runner arguments (JSON array)'],['new_pin','New PIN (4–8 digits)']];
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
function fallback(title) {
  const card = node('div','fallback-card'); card.append(node('div','xbox-banner','Xbox 360'));
  const body = node('div','fallback-body'); body.append(node('div','brand-logo','X'),node('div','fallback-title',title)); card.append(body); return card;
}
function renderCarousel() {
  track.replaceChildren();
  gamesList.forEach(game => {
    const card = node('div','game-card');
    function setArt(art) { card.replaceChildren(art); const reflection = art.cloneNode(true); reflection.classList.add('reflection'); reflection.setAttribute('aria-hidden','true'); card.append(reflection); }
    if (game.cover_art_path && !game.uses_fallback_art) {
      const img = node('img'); img.src = game.cover_art_path; img.alt = game.title; img.addEventListener('error', () => setArt(fallback(game.title)), { once:true }); setArt(img);
    } else setArt(fallback(game.title));
    track.append(card);
  });
  currentIndex = Math.max(0, Math.min(currentIndex, gamesList.length - 1)); updateCarouselPositions();
}
function updateCarouselPositions() {
  titleDisplay.textContent = gamesList[currentIndex]?.title || 'No Games Found';
  document.getElementById('subtitle').textContent = gamesList.length ? 'Press A to Launch' : 'Admin: hold LB + RB + D-Pad Up, then press A';
  document.getElementById('counter').textContent = gamesList.length ? `${currentIndex + 1} / ${gamesList.length}` : '';
  [...track.children].forEach((card,index) => {
    const offset = index-currentIndex, absOffset = Math.abs(offset);
    card.classList.toggle('active',offset === 0);
    if (absOffset > 4) { card.style.opacity='0'; card.style.transform=`translateX(${offset*260}px) translateZ(-500px)`; return; }
    if (!offset) { card.style.opacity='1'; card.style.transform='translateX(0px) translateZ(180px) rotateY(0deg) scale(1.15)'; }
    else { const direction = offset>0?1:-1; card.style.opacity=String(1-absOffset*.22); card.style.transform=`translateX(${offset*210+direction*40}px) translateZ(${-absOffset*120}px) rotateY(${-direction*35}deg)`; }
  });
}
function selectNext(delta) { const next=Math.max(0,Math.min(gamesList.length-1,currentIndex+delta)); if(next!==currentIndex){currentIndex=next;updateCarouselPositions();} }
function status(message) { document.getElementById('status').textContent=message || ''; }
async function launchCurrentGame() {
  if(busy || !gamesList[currentIndex]) return;
  busy=true; status('Launching game…');
  try { await api.launchXeniaGame(gamesList[currentIndex].id); } catch(error) { busy=false; status(error.message); }
}
function modal(title,help) { document.getElementById('overlay').classList.remove('hidden'); document.getElementById('modal-title').textContent=title;document.getElementById('modal-help').textContent=help;errorDisplay.textContent=''; }
function buttons(labels,className,action) {
  const grid=node('div',className);
  labels.forEach((label,index)=>{ const button=node('button',index===selected?'selected':'',label);button.addEventListener('click',()=>{selected=index;action();});grid.append(button); });content.append(grid);
}
function highlight() { [...content.querySelectorAll('button')].forEach((button,index)=>button.classList.toggle('selected',index===selected)); }
function openPin() { if(busy) return; mode='pin';pin='';selected=0;modal('Administrator PIN','D-pad: choose digit · A: enter · X: erase · Y: submit · B: cancel');renderPin(); }
function renderPin() { content.replaceChildren(node('div','entry','●'.repeat(pin.length) || 'Enter PIN'));buttons(pinKeys,'pin-grid',activate); }
function closeModal() { mode='library';pin='';editText='';settings={};document.getElementById('overlay').classList.add('hidden');api.lockAdmin().catch(()=>{}); }
function renderSettings() {
  content.replaceChildren();buttons([...fields.map(([key,label])=>`${label}: ${key==='new_pin'?'●'.repeat(settings[key]?.length || 0):settings[key] || '(unset)'}`),'Save and rescan','Exit to desktop','Return to games'],'settings',activate);
}
function keyboardKeys() { const letters = 'abcdefghijklmnopqrstuvwxyz';return [...'1234567890',...(caps?letters.toUpperCase():letters),' ',':','/','\\','.','_','-','[',']','"',',','(',')','+','=','@','!','Back','Case','Done']; }
function renderKeyboard() { content.replaceChildren(node('div','entry',editKey==='new_pin'?'●'.repeat(editText.length):editText || ' '));buttons(keyboardKeys(),'key-grid',activate); }
async function activate() {
  if(busy) return;
  if(mode==='pin') {
    const key=pinKeys[selected];if(key==='Back')pin=pin.slice(0,-1);else if(key==='Enter')return submitPin();else if(pin.length<8)pin+=key;renderPin();
  } else if(mode==='settings') {
    if(selected<fields.length){editKey=fields[selected][0];editText=settings[editKey] || '';mode='keyboard';selected=0;modal(`Edit ${fields.find(f=>f[0]===editKey)[1]}`,'D-pad: move · A: type · X: erase · Y: done · B: discard');renderKeyboard();}
    else if(selected===fields.length) {
      busy=true;
      try { const args=JSON.parse(settings.runner_args || '[]');gamesList=await api.saveSettings({...settings,runner_args:args});renderCarousel();status('Settings saved. Library refreshed.');closeModal(); } catch(error){errorDisplay.textContent=error.message;}finally{busy=false;}
    } else if(selected===fields.length+1){try{await api.exitToDesktop();}catch(error){errorDisplay.textContent=error.message;}}
    else closeModal();
  } else if(mode==='keyboard') {
    const key=keyboardKeys()[selected];if(key==='Done')return finishEdit();if(key==='Back')editText=editText.slice(0,-1);else if(key==='Case')caps=!caps;else if(editText.length<4096)editText+=key;renderKeyboard();
  }
}
async function submitPin() {
  if(busy)return;busy=true;
  try { await api.unlockAdmin(pin);settings=await api.getSettings();settings.runner_args=JSON.stringify(settings.runner_args);settings.new_pin='';pin='';mode='settings';selected=0;modal('Administrator settings','D-pad: choose · A: edit/select · B: lock and return. Session expires in five minutes.');renderSettings(); }
  catch(error){pin='';renderPin();errorDisplay.textContent=error.message;}finally{busy=false;}
}
function finishEdit() { settings[editKey]=editText;editText='';mode='settings';selected=fields.findIndex(f=>f[0]===editKey);modal('Administrator settings','D-pad: choose · A: edit/select · B: lock and return');renderSettings(); }
function input(action) {
  if(busy)return;
  if(mode==='library'){if(action==='left')selectNext(-1);else if(action==='right')selectNext(1);else if(action==='lb')selectNext(-5);else if(action==='rb')selectNext(5);else if(action==='a')launchCurrentGame();return;}
  if(action==='b'){if(mode==='keyboard'){mode='settings';selected=fields.findIndex(f=>f[0]===editKey);modal('Administrator settings','D-pad: choose · A: edit/select · B: lock and return');renderSettings();}else closeModal();return;}
  if(action==='a')return activate();
  if(action==='x'){if(mode==='pin'){pin=pin.slice(0,-1);renderPin();}else if(mode==='keyboard'){editText=editText.slice(0,-1);renderKeyboard();}return;}
  if(action==='y'){if(mode==='pin')submitPin();else if(mode==='keyboard')finishEdit();return;}
  const count=content.querySelectorAll('button').length, columns=mode==='pin'?3:mode==='keyboard'?10:1;
  const delta={left:-1,right:1,up:-columns,down:columns}[action];if(delta!==undefined){selected=Math.max(0,Math.min(count-1,selected+delta));highlight();content.querySelectorAll('button')[selected]?.scrollIntoView({block:'nearest'});}
}
class GamepadWheelController {
  constructor(){this.deadzone=.35;this.repeatDelay=220;this.lastInputTime=0;this.buttonStates={};this.controller=null;this.direction='';this.poll=this.poll.bind(this);requestAnimationFrame(this.poll);}
  poll(timestamp){
    const gp=[...(navigator.getGamepads?.() || [])].find(g=>g?.connected && g.mapping==='standard');
    document.getElementById('controller-status').textContent=gp?'Xbox controller connected':'Connect a standard Xbox controller and press a button';
    if(gp){if(this.controller!==gp.index){this.controller=gp.index;this.buttonStates={};gp.buttons.forEach((b,i)=>this.buttonStates[i]=b.pressed);this.direction='';}this.handleInput(gp,timestamp);}
    else{this.controller=null;this.buttonStates={};this.direction='';}requestAnimationFrame(this.poll);
  }
  handleInput(gp,timestamp){
    const pressed=i=>!!gp.buttons[i]?.pressed, edge=i=>pressed(i)&&!this.buttonStates[i];
    const chord=pressed(4)&&pressed(5)&&pressed(12);
    if(chord){if(edge(0)&&mode==='library')openPin();}
    else{
      const axisX=gp.axes[0] || 0,axisY=gp.axes[1] || 0;
      const direction=pressed(14)||axisX < -this.deadzone?'left':pressed(15)||axisX>this.deadzone?'right':pressed(12)||axisY < -this.deadzone?'up':pressed(13)||axisY>this.deadzone?'down':mode==='library'&&pressed(4)?'lb':mode==='library'&&pressed(5)?'rb':'';
      if(direction && (direction!==this.direction || timestamp-this.lastInputTime>this.repeatDelay)){input(direction);this.lastInputTime=timestamp;}this.direction=direction;
      for(const [i,action] of [[0,'a'],[1,'b'],[2,'x'],[3,'y']])if(edge(i))input(action);
    }
    gp.buttons.forEach((b,i)=>this.buttonStates[i]=b.pressed);
  }
}
// Keyboard access is useful to administrators and provides an accessibility fallback.
window.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  if(mode==='pin'&&/^\d$/.test(event.key)){if(pin.length<8)pin+=event.key;renderPin();return;}
  if(mode==='keyboard'&&event.key.length===1){if(editText.length<4096)editText+=event.key;renderKeyboard();return;}
  const action={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',Enter:'a',Backspace:'x',Escape:'b'}[event.key];if(action){event.preventDefault();input(action);}
});
window.addEventListener('DOMContentLoaded',async()=>{
  if(!api){status('Start with npm run start to enable the native launcher.');renderCarousel();return;}
  api.onGameState(state=>{busy=state.running;status(state.error || (state.running?'Game running…':''));});
  try{const library=await api.getLibrary();gamesList=library.games;status(library.error);renderCarousel();}catch(error){status(error.message);renderCarousel();}
  new GamepadWheelController();
});
