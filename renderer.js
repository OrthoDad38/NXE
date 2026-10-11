'use strict';
let gamesList = [], currentIndex = 0, mode = 'library', busy = false, selected = 0, pin = '', settings = {}, editKey = '', editText = '', caps = false;
const api = window.electronAPI;
const track = document.getElementById('carousel-track');
const titleDisplay = document.getElementById('active-title');
const content = document.getElementById('modal-content');
const errorDisplay = document.getElementById('modal-error');
const pinKeys = ['1','2','3','4','5','6','7','8','9','Back','0','Enter'];
const fields = [['rom_directory','ROM directory'],['xenia_executable','Xenia executable'],['runner','Linux runner'],['runner_args','Runner arguments (JSON array)'],['new_pin','New PIN (4–8 digits)']];
const settingsRows=[
  {field:'rom_directory',label:'ROM directory'}, {field:'xenia_executable',label:'Xenia executable'},
  {action:'browse-rom',label:'Browse ROM'}, {action:'browse-xenia',label:'Browse Xenia'},
  {field:'runner',label:'Linux runner'}, {field:'runner_args',label:'Runner arguments'},
  {action:'covers',label:'Download missing covers'}, {action:'save',label:'Save and rescan'},
  {action:'themes',label:'NXE Themes'}, {field:'new_pin',label:'New PIN'},
  {action:'pin',label:'PIN protection'}, {action:'return',label:'Return to games'}, {action:'exit',label:'Exit to Desktop'}
];
const settingsIndex=key=>settingsRows.findIndex(row=>row.field===key||row.action===key);
let coverQueue = [], coverMatches = [], coverPosition = 0;
let themeState={backgrounds:[],selected:null};
let discView=null;
function displayedGames(){return discView?discView.game.discs:gamesList;}
function returnToLibrary(){if(!discView)return;currentIndex=discView.returnIndex;discView=null;renderCarousel();}
function applyTheme(state){
  window.uiSounds?.configure(state);
  window.uiMusic?.configure(state);
  document.body.classList.toggle('nxe-menu',!!state.menu);
  themeState=state;const image=document.getElementById('theme-wallpaper'),background=state.backgrounds.find(b=>b.id===state.selected);
  const scene=state.scene || {},horizon=document.getElementById('nxe-horizon');
  horizon.classList.toggle('hidden',!background || !scene.horizon);if(background&&scene.horizon){horizon.src=scene.horizon;horizon.onerror=()=>horizon.classList.add('hidden');}else horizon.removeAttribute('src');
  document.body.classList.toggle('native-tray',!!scene.tray);
  document.body.classList.toggle('native-marker',!!scene.marker);
  if(scene.marker)document.documentElement.style.setProperty('--nxe-marker',`url("${scene.marker}")`);else document.documentElement.style.removeProperty('--nxe-marker');
  if(scene.tray)document.documentElement.style.setProperty('--nxe-tray',`url("${scene.tray}")`);else document.documentElement.style.removeProperty('--nxe-tray');
  const orb=document.querySelector('.dashboard-orb');orb.classList.toggle('native-orb',!!scene.orb);orb.querySelector('img').src=scene.orb || 'assets/xbox-orb.jpg';
  orb.querySelector('img').onerror=()=>{orb.classList.remove('native-orb');orb.querySelector('img').src='assets/xbox-orb.jpg';orb.querySelector('img').onerror=null;};
  const launchLogo=document.querySelector('#launch-overlay .brand-logo');launchLogo.classList.toggle('native-launch-orb',!!scene.orb);launchLogo.replaceChildren();
  if(scene.orb){const logo=node('img');logo.alt='';logo.src=scene.orb;logo.onerror=()=>{launchLogo.classList.remove('native-launch-orb');launchLogo.textContent='X';};launchLogo.append(logo);}else launchLogo.textContent='X';
  const adminButton=document.getElementById('admin-button');adminButton.replaceChildren();if(state.icons?.settings){const icon=node('img','admin-icon');icon.src=state.icons.settings;icon.alt='';icon.onerror=()=>icon.remove();adminButton.append(icon);}adminButton.append(document.createTextNode('Admin'));
  document.querySelectorAll('.controller-button').forEach(glyph=>{const key=glyph.getAttribute('aria-label'),url=state.buttons?.[key];glyph.classList.toggle('native-glyph',!!url);glyph.querySelector('img').src=url || 'assets/controller-buttons.jpg';});
  image.classList.toggle('hidden',!background);document.body.classList.toggle('nxe-theme',!!background);
  if(background){image.onerror=()=>{image.classList.add('hidden');document.body.classList.remove('nxe-theme');status('Imported background unavailable. Using the fallback background.');};image.src=background.url;}
  else image.removeAttribute('src');
  if(gamesList.length)renderCarousel();
}
function renderThemes(){
  mode='themes';selected=0;modal('NXE themes','D-pad: choose · A: apply · B: return to settings');
  content.replaceChildren(node('p','cover-summary',themeState.assetCount?`${Object.keys(themeState.sounds || {}).length} sounds · ${themeState.menu?'NXE '+themeState.menu.version+' menus':'reimport to recover menu resources'}`:'Import your local NXE dashboard assets.'));
  buttons([...themeState.backgrounds.map(b=>`${b.id===themeState.selected?'✓ ':''}${b.label}`),`Sound volume: ${Math.round((themeState.audio?.volume ?? .5)*100)}%`,`Sound: ${themeState.audio?.muted?'muted':'on'}`,'Test sound','Return to settings'],'cover-options',activate);
}
async function activateTheme(){
  const choice=selected,audioIndex=themeState.backgrounds.length;if(choice===audioIndex+3)return returnSettings();
  if(choice===audioIndex+2){window.uiSounds?.play('select');return;}busy=true;
  try {const state=choice>=audioIndex?await api.setThemeAudio({volume:choice===audioIndex?((Math.round((themeState.audio?.volume ?? .5)*4)+1)%5)/4:themeState.audio?.volume ?? .5,muted:choice===audioIndex+1?!themeState.audio?.muted:themeState.audio?.muted ?? false}):await api.selectTheme(themeState.backgrounds[choice].id);if(state)applyTheme(state);renderThemes();selected=Math.min(choice,selectableButtons().length-1);highlight();}
  catch(error){errorDisplay.textContent=error.message;}finally{busy=false;}
}
function returnSettings() { mode='settings';selected=settingsIndex('covers');modal('Administrator settings','D-pad: choose · A: select · B: lock and return');renderSettings(); }
function renderCoverTools(){mode='cover-tools';selected=0;modal('Game cover artwork','D-pad: choose · A: select · B: return');content.replaceChildren();buttons(['Download missing covers','Replace a downloaded cover','Rescan local cover images','Return to settings'],'cover-options',activate);}
function renderCoverGames(){mode='cover-games';selected=0;modal('Replace a downloaded cover','D-pad: choose game · A: search · B: return');coverQueue=gamesList.filter(game=>game.can_replace_cover);content.replaceChildren(node('p','cover-summary',coverQueue.length?'Choose the game with the wrong cover. Its current image stays until you confirm a replacement.':'No downloaded covers to replace. Local sidecar images can be refreshed with Rescan local cover images.'));buttons([...coverQueue.map(game=>game.title),'Return to cover options'],'cover-options',activate);}
async function showCoverMatch() {
  mode='covers';selected=0;busy=true;
  const game=coverQueue[coverPosition];
  modal(game && !game.uses_fallback_art?'Replace game cover':'Download missing covers','D-pad: choose matching game · A: download · B: return to settings');
  content.replaceChildren(node('p','cover-summary',game ? `Searching for ${game.title}…` : 'All missing covers reviewed.'));
  try {
    coverMatches=game ? await api.searchCovers(game.id) : [];
    content.replaceChildren(node('p','cover-summary',game ? `${coverPosition+1} of ${coverQueue.length}: ${game.title}` : 'All missing covers reviewed.'));
    if(game) content.append(node('p','',coverMatches.length ? 'Confirm the matching title to download its box art.' : 'No matching cover found. Skip this game and add a local cover manually.'));
    buttons(game ? [...coverMatches.map(g=>`${g.title} (${g.id})`),'Skip this game','Return to settings'] : ['Return to settings'],'cover-options',activate);
  } catch(error) { content.replaceChildren();buttons(['Retry','Skip this game','Return to settings'],'cover-options',activate);coverMatches=null;errorDisplay.textContent=error.message; }
  finally { busy=false; }
}
async function startCoverDownloads() { coverQueue=gamesList.filter(g=>g.uses_fallback_art);coverPosition=0;await showCoverMatch(); }
async function activateCover() {
  if(!coverQueue[coverPosition])return returnSettings();
  if(coverMatches===null){if(selected===0)return showCoverMatch();if(selected===2)return returnSettings();}
  else {
    if(selected===coverMatches.length+1)return returnSettings();
    if(selected<coverMatches.length){
      busy=true;errorDisplay.textContent='Downloading cover…';
      try { gamesList=await api.downloadCover(coverQueue[coverPosition].id,coverMatches[selected].id);renderCarousel(); }
      catch(error){errorDisplay.textContent=error.message;return;}
      finally { busy=false; }
    }
  }
  coverPosition++;await showCoverMatch();
}
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
function fallback(title) {
  const card = node('div','fallback-card');
  if(!themeState.scene?.tray)card.append(node('div','tile-rings'));
  if(themeState.scene?.disc){const image=node('img','original-disc');image.src=themeState.scene.disc;image.alt='';image.onerror=()=>image.replaceWith(node('div','disc-icon'));card.append(image);}else card.append(node('div','disc-icon'));
  card.append(node('div','fallback-title',title)); return card;
}
function renderCarousel() {
  track.replaceChildren();
  displayedGames().forEach(game => {
    const card = node('div','game-card');
    function setArt(art) {
      card.classList.toggle('has-cover',art.tagName==='IMG');
      card.style.removeProperty('--cover-ratio');
      const face=node('div','tile-face');face.append(art);
      card.replaceChildren(face);const reflection=face.cloneNode(true);reflection.classList.add('reflection');reflection.setAttribute('aria-hidden','true');card.append(reflection);
      if(discView||game.discs)card.append(node('div','disc-badge',discView?game.title:`${game.discs.length} discs`));
      // The recovered shadow bitmaps include square corner borders. Use the
      // card's rounded CSS shadow so they cannot show behind rounded artwork.
    }
    if (game.cover_art_path && !game.uses_fallback_art) {
      const img = node('img'); img.alt = game.title;
      img.addEventListener('load',()=>{card.style.setProperty('--cover-ratio',String(img.naturalWidth/img.naturalHeight));updateCarouselPositions();},{once:true});
      img.addEventListener('error', () => {setArt(fallback(game.title));updateCarouselPositions();}, { once:true });
      img.src = game.cover_art_path;setArt(img);
    } else setArt(fallback(game.title));
    track.append(card);
  });
  currentIndex = Math.max(0, Math.min(currentIndex, displayedGames().length - 1)); updateCarouselPositions();
  if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) track.animate?.([{opacity:0,transform:'translateX(35px) scale(.97)'},{opacity:1,transform:'translateX(0) scale(1)'}],{duration:420,easing:'cubic-bezier(.2,.75,.25,1)'});
}
function updateCarouselPositions() {
  const list=displayedGames();
  titleDisplay.textContent = list[currentIndex]?.title || 'No Games Found';
  const heading=document.querySelector?.('.brand-title');if(heading)heading.textContent=discView?`${discView.game.title} · Choose disc`:'Game Library';
  document.getElementById('subtitle').textContent = discView?'A: Launch selected disc · B: Return to Game Library':list[currentIndex]?.discs?'Press A to Choose Disc':gamesList.length?'Press A to Launch':'Admin: press Start';
  document.getElementById('counter').textContent = list.length ? `${currentIndex + 1} of ${list.length}${discView?' discs':''}` : '0 games';
  document.body.classList.toggle('empty-library', !gamesList.length);
  [...track.children].forEach((card,index) => {
    const offset = index-currentIndex, absOffset = Math.abs(offset);
    card.classList.toggle('active',offset === 0);
    card.style.zIndex=String(20-absOffset);
    if(offset<0 || offset>5){card.style.opacity='0';card.style.visibility='visible';card.style.transform=`translateX(${offset<0?-38:110}vw) scale(${offset<0?1.06:.35})`;return;}
    card.style.visibility='visible';card.style.opacity='1';
    const scales=[1,.75,.59,.49,.41,.35];
    const overlaps=[.994,.978,.78,.637,.554];
    let distance=0;
    for(let step=0;step<offset;step++)distance+=track.children[currentIndex+step].offsetWidth*scales[step]*overlaps[step];
    card.style.transform=`translateX(${distance}px) scale(${scales[offset]})`;
  });
}
function selectNext(delta) { const next=Math.max(0,Math.min(displayedGames().length-1,currentIndex+delta)); if(next!==currentIndex){currentIndex=next;updateCarouselPositions();window.uiSounds?.play(delta<0?'left':'right');} }
function status(message) { document.getElementById('status').textContent=message || ''; }
function launchScreen(visible, title = '') {
  document.getElementById('launch-overlay').classList.toggle('hidden', !visible);
  document.getElementById('launch-title').textContent = title;
}
async function launchCurrentGame() {
  const game=displayedGames()[currentIndex];if(busy || !game) return;
  window.uiSounds?.play('select');
  if(!discView && game.discs){discView={game,returnIndex:currentIndex};currentIndex=0;renderCarousel();return;}
  window.uiMusic?.stopForGame();
  busy=true; status('Launching game…');launchScreen(true,discView?`${discView.game.title} · ${game.title}`:game.title);
  try { await api.launchXeniaGame(game.id); } catch(error) { busy=false;launchScreen(false);window.uiMusic?.resumeDashboard();status(error.message); }
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
      const img=node('img');img.src=themeState.buttons?.[part] || 'assets/controller-buttons.jpg';if(themeState.buttons?.[part])glyph.classList.add('native-glyph');img.alt='';glyph.append(img);hints.append(glyph);
    } else hints.append(document.createTextNode(part));
  }
  errorDisplay.textContent='';
}
function buttons(labels,className,action) {
  const grid=node('div',className);
  labels.forEach((label,index)=>{ const button=node('button',index===selected?'selected':'',label);button.addEventListener('focus',()=>{const previous=selected;selected=index;highlight(previous!==index,index<previous?'left':'right');});button.addEventListener('click',()=>{selected=index;action();});grid.append(button); });content.append(grid);
}
function selectableButtons() { return [...content.querySelectorAll(mode==='keyboard'?'.key-grid button':'button')]; }
function highlight(withSound=false,sound='right') { if(withSound)window.uiSounds?.play(mode==='pin'?sound:'focus');selectableButtons().forEach((button,index)=>button.classList.toggle('selected',index===selected));if(mode==='settings')updateSettingsDetails(); }
async function openPin() {
  if(busy || mode!=='library')return;returnToLibrary();busy=true;
  try {
    const access=await api.getAdminAccess();window.uiSounds?.play('open');mode='pin';pin='';selected=0;
    modal('Administrator PIN','Type PIN + Enter, or use the keypad. D-pad: choose · A: enter · X: erase · Y: submit · Esc/B: cancel');renderPin();
    if(!access.pin_required){busy=false;return await submitPin();}
  }catch(error){status(error.message);}finally{busy=false;}
}
function renderPin() { content.replaceChildren(node('div','entry','●'.repeat(pin.length) || 'Enter PIN'));buttons(pinKeys,'pin-grid',activate); }
function closeModal() { window.uiSounds?.play('close');mode='library';pin='';editText='';settings={};document.body.classList.remove('modal-open');document.getElementById('overlay').classList.add('hidden');api.lockAdmin().catch(()=>{}); }
function renderSettings() {
  content.replaceChildren();buttons(settingsRows.map(row=>row.action==='pin'?`PIN protection: ${settings.admin_pin_required===false?'off':'on'}`:row.label),'settings',activate);
  const list=content.firstElementChild;list.prepend(node('div','settings-highlight'));
  const shell=node('div','settings-shell'),details=node('div','settings-details');
  details.append(node('div','detail-label',themeState.menu?.detailLabel || 'Current setting'),node('div','setting-value'),node('p','setting-description'));
  shell.append(list,details);content.append(shell);updateSettingsDetails();
}
function updateSettingsDetails() {
  const description=['Choose the folder containing your Xbox 360 games.','Choose the Xenia Canary executable.','Linux: choose the Wine or Proton runner. Windows launches Xenia directly.','Linux runner arguments, as a JSON array.','Set a new administrator PIN using 4–8 digits.','Open the native folder picker. The chosen path is saved when you select Save and rescan.','Open the native executable picker. The chosen path is saved when you select Save and rescan.','Save these settings and refresh your game collection.','Close NXE and return to the desktop.','Return to Game Library without saving pending changes.'];
  const field=settingsRows[selected]?.field;
  const value=content.querySelector('.setting-value');
  if(!value)return;
  value.textContent=field?(field==='new_pin'?'●'.repeat(settings[field]?.length || 0):settings[field] || '(not set)'):'NXE';
  const descriptionIndex=field?fields.findIndex(([key])=>key===field):({'browse-rom':5,'browse-xenia':6,save:7,exit:8,return:9}[settingsRows[selected]?.action]);
  const action=settingsRows[selected]?.action;
  content.querySelector('.setting-description').textContent=action==='pin'?'Toggle PIN protection immediately. When off, Start or Admin opens settings directly, including Exit to desktop. Turning protection back on uses the saved PIN.':action==='themes'?'Choose the original green NXE dashboard or Wallpaper 1–9, and adjust sound volume or mute.':action==='covers'?'Download missing covers, replace a wrong downloaded image, or rescan local cover images. These actions use your saved ROM directory.':description[descriptionIndex] || '';
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
function cancelEdit() { editText='';mode='settings';selected=settingsIndex(editKey);modal('Administrator settings','Mouse/Tab: choose · Enter/A: edit/select · Esc/B: lock and return');renderSettings(); }
async function browseLocation(kind) {
  busy=true;
  try { const chosen=await api.browseLocation(kind);if(chosen){settings[kind]=chosen;renderSettings();} }
  catch(error){errorDisplay.textContent=error.message;}
  finally{busy=false;}
}
async function activate() {
  if(busy) return;
  window.uiSounds?.play(mode==='pin'?(pinKeys[selected]==='Back'?'left':'right'):'select');
  if(mode==='cover-tools'){
    if(selected===0)return startCoverDownloads();if(selected===1)return renderCoverGames();if(selected===3)return returnSettings();
    busy=true;try{gamesList=await api.rescanCovers();renderCarousel();renderCoverTools();status('Local cover images rescanned.');}catch(error){errorDisplay.textContent=error.message;}finally{busy=false;}return;
  }
  if(mode==='cover-games'){if(selected>=coverQueue.length)return renderCoverTools();coverQueue=[coverQueue[selected]];coverPosition=0;return showCoverMatch();}
  if(mode==='themes')return activateTheme();
  if(mode==='covers') return activateCover();
  if(mode==='pin') {
    const key=pinKeys[selected];if(key==='Back')pin=pin.slice(0,-1);else if(key==='Enter')return submitPin(false);else if(pin.length<8)pin+=key;renderPin();
  } else if(mode==='settings') {
    const row=settingsRows[selected];
    if(row.field){editKey=row.field;editText=settings[editKey] || '';mode='keyboard';selected=0;modal(`Edit ${fields.find(f=>f[0]===editKey)[1]}`,'Type or paste, then Enter. D-pad: move · A: type · X: erase · Y: done · Esc/B: discard');renderKeyboard(true);}
    else if(row.action==='browse-rom') return browseLocation('rom_directory');
    else if(row.action==='browse-xenia') return browseLocation('xenia_executable');
    else if(row.action==='save') {
      busy=true;
      try { const args=JSON.parse(settings.runner_args || '[]');gamesList=await api.saveSettings({...settings,runner_args:args});renderCarousel();status('Settings saved. Library refreshed.');closeModal(); } catch(error){errorDisplay.textContent=error.message;}finally{busy=false;}
    } else if(row.action==='exit'){try{await api.exitToDesktop();}catch(error){errorDisplay.textContent=error.message;}}
    else if(row.action==='pin'){busy=true;try{const access=await api.setPinProtection(settings.admin_pin_required===false);settings.admin_pin_required=access.pin_required;renderSettings();}catch(error){errorDisplay.textContent=error.message;}finally{busy=false;}}
    else if(row.action==='themes')return renderThemes();
    else if(row.action==='covers')return renderCoverTools();
    else closeModal();
  } else if(mode==='keyboard') {
    const key=keyboardKeys()[selected];if(key==='Done')return finishEdit();if(key==='Back')editText=editText.slice(0,-1);else if(key==='Case')caps=!caps;else if(editText.length<4096)editText+=key;renderKeyboard();
  }
}
async function submitPin(withSound=true) {
  if(busy)return;if(withSound)window.uiSounds?.play('right');busy=true;
  try { await api.unlockAdmin(pin);settings=await api.getSettings();settings.runner_args=JSON.stringify(settings.runner_args);settings.new_pin='';pin='';mode='settings';selected=0;modal('Administrator settings','Mouse/Tab: choose · Enter/A: edit/select · Esc/B: lock and return. Session expires in five minutes.');renderSettings(); }
  catch(error){pin='';renderPin();errorDisplay.textContent=error.message;}finally{busy=false;}
}
function finishEdit() { settings[editKey]=editText;editText='';mode='settings';selected=settingsIndex(editKey);modal('Administrator settings','D-pad: choose · A: edit/select · B: lock and return');renderSettings(); }
function input(action) {
  if(busy)return;
  if(mode==='library'){if(action==='b'&&discView){window.uiSounds?.play('back');returnToLibrary();}else if(action==='left')selectNext(-1);else if(action==='right')selectNext(1);else if(action==='lb')selectNext(-5);else if(action==='rb')selectNext(5);else if(action==='a')launchCurrentGame();return;}
  if(action==='b'){window.uiSounds?.play('back');if(mode==='keyboard')cancelEdit();else if(mode==='cover-games')renderCoverTools();else if(['covers','themes','cover-tools'].includes(mode))returnSettings();else closeModal();return;}
  if(action==='a')return activate();
  if(action==='x'){if(mode==='pin'){window.uiSounds?.play('left');pin=pin.slice(0,-1);renderPin();}else if(mode==='keyboard'){editText=editText.slice(0,-1);renderKeyboard();}return;}
  if(action==='y'){if(mode==='pin')submitPin();else if(mode==='keyboard')finishEdit();return;}
  const count=selectableButtons().length, columns=mode==='pin'?3:mode==='keyboard'?10:1;
  const delta={left:-1,right:1,up:-columns,down:columns}[action];if(delta!==undefined){const previous=selected;selected=Math.max(0,Math.min(count-1,selected+delta));highlight(selected!==previous,delta<0?'left':'right');selectableButtons()[selected]?.scrollIntoView({block:'nearest'});}
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
    if(edge(9)&&mode==='library'){openPin();}
    else if(chord){if(edge(0)&&mode==='library')openPin();}
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
  if(mode==='pin'&&/^\d$/.test(event.key)){if(pin.length<8){window.uiSounds?.play('right');pin+=event.key;}renderPin();return;}
  if(mode==='keyboard'&&event.key.length===1){if(editText.length<4096)editText+=event.key;renderKeyboard();return;}
  const action={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',Enter:'a',Backspace:'x',Escape:'b'}[event.key];if(action){event.preventDefault();input(action);}
});
window.addEventListener('resize',updateCarouselPositions);
window.addEventListener('DOMContentLoaded',async()=>{
  document.getElementById('admin-button').addEventListener('click',openPin);
  document.getElementById('close-admin').addEventListener('click',()=>{if(!busy)closeModal();});
  if(!api){status('Start with npm run start to enable the native launcher.');renderCarousel();return;}
  api.onGameState(state=>{busy=state.running;if(state.running)window.uiMusic?.stopForGame();else{launchScreen(false);window.uiMusic?.resumeDashboard();}status(state.error || (state.running?'Game running…':''));});
  try{applyTheme(await api.getTheme());}catch(error){status(`Theme unavailable: ${error.message}`);}
  try{const library=await api.getLibrary();gamesList=library.games;status(library.error);renderCarousel();}catch(error){status(error.message);renderCarousel();}
  new GamepadWheelController();
});
