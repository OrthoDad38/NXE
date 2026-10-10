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
  const card = node('div','fallback-card');
  card.append(node('div','tile-rings'),node('div','disc-icon'),node('div','fallback-title',title)); return card;
}
function renderCarousel() {
  track.replaceChildren();
  gamesList.forEach(game => {
    const card = node('div','game-card');
    function setArt(art) {
      const face=node('div','tile-face');face.append(art);
      if(art.tagName==='IMG')face.append(node('div','cover-title',game.title));
      card.replaceChildren(face);const reflection=face.cloneNode(true);reflection.classList.add('reflection');reflection.setAttribute('aria-hidden','true');card.append(reflection);
    }
    if (game.cover_art_path && !game.uses_fallback_art) {
      const img = node('img'); img.src = game.cover_art_path; img.alt = game.title; img.addEventListener('error', () => setArt(fallback(game.title)), { once:true }); setArt(img);
    } else setArt(fallback(game.title));
    track.append(card);
  });
  currentIndex = Math.max(0, Math.min(currentIndex, gamesList.length - 1)); updateCarouselPositions();
  if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) track.animate?.([{opacity:0,transform:'translateX(35px) scale(.97)'},{opacity:1,transform:'translateX(0) scale(1)'}],{duration:420,easing:'cubic-bezier(.2,.75,.25,1)'});
}
function updateCarouselPositions() {
  titleDisplay.textContent = gamesList[currentIndex]?.title || 'No Games Found';
  document.getElementById('subtitle').textContent = gamesList.length ? 'Press A to Launch' : 'Admin: hold LB + RB + D-Pad Up, then press A';
  document.getElementById('counter').textContent = gamesList.length ? `${currentIndex + 1} of ${gamesList.length}` : '0 games';
  document.body.classList.toggle('empty-library', !gamesList.length);
  [...track.children].forEach((card,index) => {
    const offset = index-currentIndex, absOffset = Math.abs(offset);
    card.classList.toggle('active',offset === 0);
    card.style.zIndex=String(20-absOffset);
    if(offset<0 || offset>5){card.style.opacity='0';card.style.visibility='visible';card.style.transform=`translateX(${offset<0?-38:110}vw) scale(${offset<0?1.06:.35})`;return;}
    card.style.visibility='visible';card.style.opacity='1';
    const positions=[0,32.8,57,72.2,82.5,90];
    const scales=[1,.75,.59,.49,.41,.35];
    card.style.transform=`translateX(${positions[offset]}vw) scale(${scales[offset]})`;
  });
}
function selectNext(delta) { const next=Math.max(0,Math.min(gamesList.length-1,currentIndex+delta)); if(next!==currentIndex){currentIndex=next;updateCarouselPositions();} }
function status(message) { document.getElementById('status').textContent=message || ''; }
function launchScreen(visible, title = '') {
  document.getElementById('launch-overlay').classList.toggle('hidden', !visible);
  document.getElementById('launch-title').textContent = title;
}
async function launchCurrentGame() {
  if(busy || !gamesList[currentIndex]) return;
  busy=true; status('Launching game…');launchScreen(true, gamesList[currentIndex].title);
  try { await api.launchXeniaGame(gamesList[currentIndex].id); } catch(error) { busy=false;launchScreen(false);status(error.message); }
}
function modal(title,help) {
  document.body.classList.add('modal-open');
  const panel=document.querySelector('.panel');
  if(panel.dataset.mode!==mode && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) panel.animate?.([{opacity:0,transform:'translateX(50px)'},{opacity:1,transform:'translateX(0)'}],{duration:260,easing:'cubic-bezier(.2,.75,.25,1)'});
  panel.dataset.mode=mode;
  document.getElementById('overlay').classList.remove('hidden');document.getElementById('modal-title').textContent=title;
  const hints=document.getElementById('modal-help');hints.replaceChildren();
  for(const part of help.split(/\b([ABXY])\b/)) {
    if(/^[ABXY]$/.test(part)) {
      const glyph=node('span',`controller-button button-${part.toLowerCase()}`);glyph.setAttribute('role','img');glyph.setAttribute('aria-label',part);
      const img=node('img');img.src='assets/controller-buttons.jpg';img.alt='';glyph.append(img);hints.append(glyph);
    } else hints.append(document.createTextNode(part));
  }
  errorDisplay.textContent='';
}
function buttons(labels,className,action) {
  const grid=node('div',className);
  labels.forEach((label,index)=>{ const button=node('button',index===selected?'selected':'',label);button.addEventListener('focus',()=>{selected=index;highlight();});button.addEventListener('click',()=>{selected=index;action();});grid.append(button); });content.append(grid);
}
function selectableButtons() { return [...content.querySelectorAll(mode==='keyboard'?'.key-grid button':'button')]; }
function highlight() { selectableButtons().forEach((button,index)=>button.classList.toggle('selected',index===selected));if(mode==='settings')updateSettingsDetails(); }
function openPin() { if(busy) return; mode='pin';pin='';selected=0;modal('Administrator PIN','Type PIN + Enter, or use the keypad. D-pad: choose · A: enter · X: erase · Y: submit · Esc/B: cancel');renderPin(); }
function renderPin() { content.replaceChildren(node('div','entry','●'.repeat(pin.length) || 'Enter PIN'));buttons(pinKeys,'pin-grid',activate); }
function closeModal() { mode='library';pin='';editText='';settings={};document.body.classList.remove('modal-open');document.getElementById('overlay').classList.add('hidden');api.lockAdmin().catch(()=>{}); }
function renderSettings() {
  content.replaceChildren();buttons([...fields.map(([,label])=>label),'Browse ROM folder…','Browse Xenia executable…','Save and rescan','Exit to desktop','Return to games'],'settings',activate);
  const list=content.firstElementChild;list.prepend(node('div','settings-highlight'));
  const shell=node('div','settings-shell'),details=node('div','settings-details');
  details.append(node('div','detail-label','Current setting'),node('div','setting-value'),node('p','setting-description'));
  shell.append(list,details);content.append(shell);updateSettingsDetails();
}
function updateSettingsDetails() {
  const description=['Choose the folder containing your Xbox 360 games.','Choose the Xenia Canary executable.','Linux: choose the Wine or Proton runner. Windows launches Xenia directly.','Linux runner arguments, as a JSON array.','Set a new administrator PIN using 4–8 digits.','Open the native folder picker. The chosen path is saved when you select Save and rescan.','Open the native executable picker. The chosen path is saved when you select Save and rescan.','Save these settings and refresh your game collection.','Close Project Kratos and return to the desktop.','Return to Game Library without saving pending changes.'];
  const field=fields[selected]?.[0];
  const value=content.querySelector('.setting-value');
  if(!value)return;
  value.textContent=field?(field==='new_pin'?'●'.repeat(settings[field]?.length || 0):settings[field] || '(not set)'):'Project Kratos';
  content.querySelector('.setting-description').textContent=description[selected] || '';
  const button=selectableButtons()[selected],bar=content.querySelector('.settings-highlight');
  if(button && bar){bar.style.height=`${button.offsetHeight}px`;bar.style.transform=`translateY(${button.offsetTop}px)`;}
}
function keyboardKeys() { const letters = 'abcdefghijklmnopqrstuvwxyz';return [...'1234567890',...(caps?letters.toUpperCase():letters),' ',':','/','\\','.','_','-','[',']','"',',','(',')','+','=','@','!','Back','Case','Done']; }
function renderKeyboard(focusInput = false) {
  const entry = node('input', 'entry entry-input');
  entry.type = editKey === 'new_pin' ? 'password' : 'text';
  entry.value = editText; entry.maxLength = 4096;
  entry.setAttribute('aria-label', fields.find(f => f[0] === editKey)[1]);
  entry.autocomplete = 'off'; entry.spellcheck = false;
  entry.addEventListener('input', () => { editText = entry.value; });
  content.replaceChildren(entry);
  const actions = node('div', 'edit-actions');
  const done = node('button', '', 'Done'); done.addEventListener('click', finishEdit);
  const cancel = node('button', '', 'Cancel'); cancel.addEventListener('click', cancelEdit);
  actions.append(done, cancel); content.append(actions);
  buttons(keyboardKeys(),'key-grid',activate);
  if (focusInput) entry.focus();
}
function cancelEdit() { editText='';mode='settings';selected=fields.findIndex(f=>f[0]===editKey);modal('Administrator settings','Mouse/Tab: choose · Enter/A: edit/select · Esc/B: lock and return');renderSettings(); }
async function browseLocation(kind) {
  busy=true;
  try { const chosen=await api.browseLocation(kind);if(chosen){settings[kind]=chosen;renderSettings();} }
  catch(error){errorDisplay.textContent=error.message;}
  finally{busy=false;}
}
async function activate() {
  if(busy) return;
  if(mode==='pin') {
    const key=pinKeys[selected];if(key==='Back')pin=pin.slice(0,-1);else if(key==='Enter')return submitPin();else if(pin.length<8)pin+=key;renderPin();
  } else if(mode==='settings') {
    if(selected<fields.length){editKey=fields[selected][0];editText=settings[editKey] || '';mode='keyboard';selected=0;modal(`Edit ${fields.find(f=>f[0]===editKey)[1]}`,'Type or paste, then Enter. D-pad: move · A: type · X: erase · Y: done · Esc/B: discard');renderKeyboard(true);}
    else if(selected===fields.length) return browseLocation('rom_directory');
    else if(selected===fields.length+1) return browseLocation('xenia_executable');
    else if(selected===fields.length+2) {
      busy=true;
      try { const args=JSON.parse(settings.runner_args || '[]');gamesList=await api.saveSettings({...settings,runner_args:args});renderCarousel();status('Settings saved. Library refreshed.');closeModal(); } catch(error){errorDisplay.textContent=error.message;}finally{busy=false;}
    } else if(selected===fields.length+3){try{await api.exitToDesktop();}catch(error){errorDisplay.textContent=error.message;}}
    else closeModal();
  } else if(mode==='keyboard') {
    const key=keyboardKeys()[selected];if(key==='Done')return finishEdit();if(key==='Back')editText=editText.slice(0,-1);else if(key==='Case')caps=!caps;else if(editText.length<4096)editText+=key;renderKeyboard();
  }
}
async function submitPin() {
  if(busy)return;busy=true;
  try { await api.unlockAdmin(pin);settings=await api.getSettings();settings.runner_args=JSON.stringify(settings.runner_args);settings.new_pin='';pin='';mode='settings';selected=0;modal('Administrator settings','Mouse/Tab: choose · Enter/A: edit/select · Esc/B: lock and return. Session expires in five minutes.');renderSettings(); }
  catch(error){pin='';renderPin();errorDisplay.textContent=error.message;}finally{busy=false;}
}
function finishEdit() { settings[editKey]=editText;editText='';mode='settings';selected=fields.findIndex(f=>f[0]===editKey);modal('Administrator settings','D-pad: choose · A: edit/select · B: lock and return');renderSettings(); }
function input(action) {
  if(busy)return;
  if(mode==='library'){if(action==='left')selectNext(-1);else if(action==='right')selectNext(1);else if(action==='lb')selectNext(-5);else if(action==='rb')selectNext(5);else if(action==='a')launchCurrentGame();return;}
  if(action==='b'){if(mode==='keyboard')cancelEdit();else closeModal();return;}
  if(action==='a')return activate();
  if(action==='x'){if(mode==='pin'){pin=pin.slice(0,-1);renderPin();}else if(mode==='keyboard'){editText=editText.slice(0,-1);renderKeyboard();}return;}
  if(action==='y'){if(mode==='pin')submitPin();else if(mode==='keyboard')finishEdit();return;}
  const count=selectableButtons().length, columns=mode==='pin'?3:mode==='keyboard'?10:1;
  const delta={left:-1,right:1,up:-columns,down:columns}[action];if(delta!==undefined){selected=Math.max(0,Math.min(count-1,selected+delta));highlight();selectableButtons()[selected]?.scrollIntoView({block:'nearest'});}
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
  if(busy)return;
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  if(mode==='keyboard' && event.target?.tagName==='INPUT'){
    if(event.key==='Enter'){event.preventDefault();finishEdit();}
    else if(event.key==='Escape'){event.preventDefault();cancelEdit();}
    return; // Keep native selection, cursor movement, paste and Tab behavior.
  }
  if(mode==='pin'&&event.key==='Enter'){event.preventDefault();submitPin();return;}
  if(event.key==='Tab')return;
  if(event.key==='Enter' && event.target?.tagName==='BUTTON')return; // Native button activation.
  if(mode==='pin'&&/^\d$/.test(event.key)){if(pin.length<8)pin+=event.key;renderPin();return;}
  if(mode==='keyboard'&&event.key.length===1){if(editText.length<4096)editText+=event.key;renderKeyboard();return;}
  const action={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',Enter:'a',Backspace:'x',Escape:'b'}[event.key];if(action){event.preventDefault();input(action);}
});
window.addEventListener('DOMContentLoaded',async()=>{
  document.getElementById('admin-button').addEventListener('click',openPin);
  document.getElementById('close-admin').addEventListener('click',()=>{if(!busy)closeModal();});
  if(!api){status('Start with npm run start to enable the native launcher.');renderCarousel();return;}
  api.onGameState(state=>{busy=state.running;if(!state.running)launchScreen(false);status(state.error || (state.running?'Game running…':''));});
  try{const library=await api.getLibrary();gamesList=library.games;status(library.error);renderCarousel();}catch(error){status(error.message);renderCarousel();}
  new GamepadWheelController();
});
