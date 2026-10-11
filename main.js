'use strict';
const { app, BrowserWindow, ipcMain, globalShortcut, protocol, net, dialog } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const scanner = require('./scanner');
const covers = require('./covers');
const nxe = require('./nxe');
const {selectUserData}=require('./storage');
const {musicResponse}=require('./music-stream');
const {prepareHandoff}=require('./handoff');
const {groupGames}=require('./multidisc');
app.setName('NXE');
app.setPath('userData',selectUserData(app.getPath('appData'),app.getPath('userData'),app.isPackaged));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
let importedTheme=null;
let backgroundMusic;
let coverRevision=Date.now();
const coverService = covers.createService((...args) => net.fetch(...args));
protocol.registerSchemesAsPrivileged([{ scheme: 'kratos-art', privileges: { standard: true, secure: true, supportFetchAPI: true,stream:true } }]);
let win, library, libraryFile, child,launchPending=false, allowQuit = false, adminUntil = 0, attempts = 0, blockedUntil = 0;
let queue = Promise.resolve();
let pickerOpen = false, shortcutNoticeShown = false;
function serialized(work) { const result = queue.then(work); queue = result.catch(() => {}); return result; }
function requireAdmin() { if (Date.now() > adminUntil) throw new Error('Admin session expired. Open administrator access again.'); }
function publicGames() { return groupGames(library.games).map(g=>{
  const art=g.discs?.find(d=>d.cover_art_path)||g;
  const cover=art.cover_art_path?`kratos-art://cover/${art.id}?v=${coverRevision}`:null;
  return {id:g.id,title:g.title,uses_fallback_art:!cover,can_replace_cover:covers.isCachedCover(art,path.join(app.getPath('userData'),'covers')),cover_art_path:cover,
    ...(g.discs?{discs:g.discs.map(d=>({id:d.id,number:d.disc_number,title:`Disc ${d.disc_number}`,uses_fallback_art:!cover,cover_art_path:cover}))}:{})};
}); }
function shortcuts() {
  // Close, devtools and fullscreen shortcuts are blocked locally by the window.
  // Windows reserves task switching and the Windows key; Super alone is not an accelerator.
  if (process.platform === 'linux' && !globalShortcut.isRegistered('Alt+Tab')) {
    try { globalShortcut.register('Alt+Tab', () => {}); } catch { /* Desktop may reserve it. */ }
  }
  if (!shortcutNoticeShown) {
    console.info('[NXE] Kiosk active. OS task switching requires desktop/account restrictions.');
    shortcutNoticeShown = true;
  }
}
function recover(state) {
  child = null;
  if (!win || win.isDestroyed()) return;
  win.restore(); win.show(); win.setKiosk(true); win.setFullScreen(true); win.focus(); shortcuts();
  win.webContents.send('game:state', state);
}
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== pathToFileURL(path.join(__dirname, 'index.html')).href) throw new Error('Untrusted caller');
    return fn(...args);
  });
}
async function launch(id) {
  if (child||launchPending) throw new Error('A game is already running');
  const game = library.games.find(g => g.id === id);
  if (!game) throw new Error('Unknown game');
  await fs.access(game.rom_path); await fs.access(library.xenia_executable);
  // Re-check after asynchronous validation to prevent concurrent launches.
  if (child||launchPending) throw new Error('A game is already running');
  launchPending=true;
  adminUntil = 0;
  const linux = process.platform === 'linux';
  const command = linux ? library.runner || 'wine' : library.xenia_executable;
  const args = linux ? [...(library.runner_args || []), library.xenia_executable, '--fullscreen', game.rom_path] : ['--fullscreen', game.rom_path];
  const handoff=prepareHandoff(win,{platform:process.platform});
  try{await handoff.ready;child = spawn(command, args, { shell: false, cwd: path.dirname(library.xenia_executable), stdio: 'ignore', windowsHide: false });}
  catch(error){handoff.cancel();throw error;}
  finally{launchPending=false;}
  let finished = false;
  const finish = state => { if (!finished) { finished = true;handoff.cancel(); recover(state); } };
  child.once('error', error => finish({ running: false, error: `Launch failed: ${error.message}` }));
  child.once('close', code => finish({ running: false, error: code ? `Emulator exited with code ${code}` : null }));
  child.once('spawn', () => {
    // Keep the dashboard fullscreen underneath Xenia during window creation.
    globalShortcut.unregisterAll();
    handoff.watch(child.pid);
    win.webContents.send('game:state', { running: true });
  });
  return true;
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win && !child) { win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    libraryFile = path.join(app.getPath('userData'), 'library.json');
    library = await scanner.loadLibrary(libraryFile);
    try { importedTheme=await nxe.loadTheme(library.nxe_theme,app.getPath('userData')); }
    catch(error) { console.warn(`[NXE] Theme fallback: ${error.message}`);importedTheme=await nxe.loadTheme(null,app.getPath('userData')); }
    const coverDirectory = path.join(app.getPath('userData'), 'covers');
    let scanError = '';
    try { library.games = await covers.applyCached(await scanner.scanDirectory(library.rom_directory), coverDirectory); await scanner.saveLibrary(libraryFile, library); } catch (error) { scanError = `Scan failed: ${error.message}`; }
    protocol.handle('kratos-art', request => {
      const url = new URL(request.url);
      if(url.hostname==='music' && url.pathname==='/dashboard'){
        backgroundMusic ||= fs.readFile(path.join(__dirname,'assets','dashboard-music.ogg'));
        return backgroundMusic.then(bytes=>musicResponse(bytes,request.headers.get('range')));
      }
      if(url.hostname==='theme'){
        const asset=importedTheme?.manifest.assets[url.pathname.slice(1)];
        return asset?net.fetch(pathToFileURL(path.join(importedTheme.directory,asset.file)).href):new Response('Not found',{status:404});
      }
      const game = library.games.find(g => g.id === url.pathname.slice(1));
      if (url.hostname !== 'cover' || !game?.cover_art_path) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(game.cover_art_path).href);
    });
    handle('library:get', () => ({ games: publicGames(), error: scanError }));
    handle('game:launch', launch);
    handle('theme:get',()=>nxe.publicTheme(importedTheme));
    handle('admin:access',()=>({pin_required:library.admin_pin_required!==false}));
    handle('admin:pin-protection',required=>serialized(async()=>{
      requireAdmin();if(typeof required!=='boolean')throw Error('Invalid PIN protection setting');
      const next={...library,admin_pin_required:required};await scanner.saveLibrary(libraryFile,next);library=next;
      return {pin_required:required};
    }));
    handle('admin:theme-builtin',()=>serialized(async()=>{
      requireAdmin();const theme=await nxe.loadTheme(null,app.getPath('userData'));
      theme.audio=importedTheme?.audio || theme.audio;requireAdmin();
      const next={...library,nxe_theme:nxe.themeConfig(theme)};await scanner.saveLibrary(libraryFile,next);library=next;importedTheme=theme;return nxe.publicTheme(theme);
    }));
    handle('admin:theme-import',()=>serialized(async()=>{
      requireAdmin();if(pickerOpen)throw new Error('A file picker is already open');pickerOpen=true;
      try {
        const result=await dialog.showOpenDialog(win,{title:'Choose Xbox 360 dashboard folder',properties:['openDirectory']});
        requireAdmin();if(result.canceled)return null;
        const config=await nxe.importTheme(result.filePaths[0],app.getPath('userData'),requireAdmin);
        const theme=await nxe.loadTheme(config,app.getPath('userData'));requireAdmin();
        const next={...library,nxe_theme:config};await scanner.saveLibrary(libraryFile,next);library=next;importedTheme=theme;
        return nxe.publicTheme(theme);
      } finally {pickerOpen=false;}
    }));
    handle('admin:theme-select',id=>serialized(async()=>{
      requireAdmin();
      if(id!==null && !nxe.publicTheme(importedTheme).backgrounds.some(b=>b.id===id))throw new Error('Unknown theme');
      if(!importedTheme)return nxe.publicTheme(null);
      const config={...nxe.themeConfig(importedTheme),selected:id};const next={...library,nxe_theme:config};
      await scanner.saveLibrary(libraryFile,next);library=next;importedTheme.selected=id;return nxe.publicTheme(importedTheme);
    }));
    handle('admin:theme-audio',audio=>serialized(async()=>{
      requireAdmin();if(!importedTheme)throw Error('NXE theme unavailable');
      if(typeof audio?.muted!=='boolean'||typeof audio.volume!=='number'||!Number.isFinite(audio.volume)||audio.volume<0||audio.volume>1)throw Error('Invalid sound settings');
      const config={...nxe.themeConfig(importedTheme),audio:{muted:audio.muted,volume:audio.volume}};
      const next={...library,nxe_theme:config};await scanner.saveLibrary(libraryFile,next);library=next;importedTheme.audio=config.audio;return nxe.publicTheme(importedTheme);
    }));
    handle('admin:unlock', pin => {
      if (library.admin_pin_required!==false) {
        if (Date.now() < blockedUntil) throw new Error('Too many attempts. Wait 30 seconds.');
        if (!scanner.verifyPin(pin, library.admin_credential)) { if (++attempts >= 5) { blockedUntil = Date.now() + 30000; attempts = 0; } throw new Error('Incorrect PIN'); }
      }
      attempts = 0; adminUntil = Date.now() + 300000; return true;
    });
    handle('admin:lock', () => { adminUntil = 0; });
    handle('admin:cover-search', async id => {
      requireAdmin();
      const game = library.games.find(g => g.id === id);
      if (!game) throw new Error('Unknown game');
      const results = await coverService.search(groupGames(library.games).find(g=>g.id===id)?.title || game.title);
      requireAdmin(); return results;
    });
    handle('admin:cover-download', (id, candidate) => serialized(async () => {
      requireAdmin();
      const game = library.games.find(g => g.id === id && (g.uses_fallback_art || covers.isCachedCover(g,coverDirectory)));
      if (!game || !(await coverService.search(groupGames(library.games).find(g=>g.id===id)?.title || game.title)).some(g => g.id === candidate)) throw new Error('Invalid cover match');
      const bytes = await coverService.download(candidate);
      requireAdmin();
      await fs.mkdir(coverDirectory, { recursive: true });
      const file = path.join(coverDirectory, `${game.id}.jpg`);
      const temp = `${file}.tmp`;
      await fs.writeFile(temp, bytes); await fs.rename(temp, file);
      const next = { ...library, games: library.games.map(g => g.id === id ? { ...g, cover_art_path: file, uses_fallback_art: false, cover_source: 'xenia-manager/x360db', cover_title_id: candidate } : g) };
      await scanner.saveLibrary(libraryFile, next); library = next;coverRevision++; return publicGames();
    }));
    handle('admin:cover-rescan',()=>serialized(async()=>{
      requireAdmin();const games=await covers.applyCached(await scanner.scanDirectory(library.rom_directory),coverDirectory);requireAdmin();
      const next={...library,games};await scanner.saveLibrary(libraryFile,next);library=next;coverRevision++;return publicGames();
    }));
    handle('admin:settings', () => { requireAdmin(); return { rom_directory: library.rom_directory, xenia_executable: library.xenia_executable, runner: library.runner || 'wine', runner_args: library.runner_args || [], platform_os: process.platform,admin_pin_required:library.admin_pin_required!==false }; });
    handle('admin:browse', async kind => {
      requireAdmin();
      if (!['rom_directory', 'xenia_executable'].includes(kind)) throw new Error('Invalid picker');
      if (pickerOpen) throw new Error('A file picker is already open');
      pickerOpen = true;
      try {
        const folder = kind === 'rom_directory';
        const result = await dialog.showOpenDialog(win, {
          title: folder ? 'Choose ROM directory' : 'Choose Xenia executable',
          defaultPath: library[kind] || undefined,
          properties: [folder ? 'openDirectory' : 'openFile', ...(process.platform === 'win32' ? ['dontAddToRecent'] : [])],
          ...(folder ? {} : { filters: [{ name: 'Windows executable', extensions: ['exe'] }] })
        });
        requireAdmin(); // A dialog cannot extend an expired PIN session.
        return result.canceled ? null : result.filePaths[0] || null;
      } finally { pickerOpen = false; }
    });
    handle('admin:save', settings => serialized(async () => {
      requireAdmin();
      for (const key of ['rom_directory', 'xenia_executable', 'runner']) if (typeof settings?.[key] !== 'string' || settings[key].length > 4096 || settings[key].includes('\0')) throw new Error('Invalid settings');
      if (!Array.isArray(settings.runner_args) || settings.runner_args.length > 32 || settings.runner_args.some(a => typeof a !== 'string' || a.includes('\0') || a.length > 4096)) throw new Error('Runner arguments must be a JSON string array');
      if (!path.isAbsolute(settings.rom_directory) || !path.isAbsolute(settings.xenia_executable)) throw new Error('ROM and emulator paths must be absolute');
      await fs.access(settings.xenia_executable);
      const games = await covers.applyCached(await scanner.scanDirectory(settings.rom_directory), coverDirectory);
      const next = { ...library, platform_os: process.platform, rom_directory: settings.rom_directory, xenia_executable: settings.xenia_executable, runner: settings.runner, runner_args: settings.runner_args, games };
      if (settings.new_pin) { if (!/^\d{4,8}$/.test(settings.new_pin)) throw new Error('PIN must be 4–8 digits'); next.admin_credential = scanner.hashPin(settings.new_pin); }
      requireAdmin(); await scanner.saveLibrary(libraryFile, next); library = next;coverRevision++; scanError = ''; return publicGames();
    }));
    handle('admin:exit', () => { requireAdmin(); allowQuit = true; app.quit(); });
    win = new BrowserWindow({ kiosk: true, fullscreen: true, frame: false, autoHideMenuBar: true, backgroundColor: '#07090c', webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, devTools: false } });
    win.setMenu(null);
    win.on('close', event => { if (!allowQuit) event.preventDefault(); });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.on('will-attach-webview', event => event.preventDefault());
    win.webContents.on('before-input-event', (event, input) => {
      const admin = Date.now() <= adminUntil;
      const editShortcut = admin && input.control && !input.alt && !input.meta && ['a', 'c', 'v', 'x', 'z', 'y'].includes(input.key.toLowerCase());
      if (input.alt || input.meta || (input.control && !editShortcut) || ['F11', 'F12'].includes(input.key)) event.preventDefault();
    });
    win.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
      if (isMainFrame) console.error(`[NXE] Window failed to load (${code}): ${description}`);
    });
    win.webContents.on('render-process-gone', (_event, details) => console.error(`[NXE] Renderer stopped: ${details.reason} (exit ${details.exitCode})`));
    win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    await win.loadFile(path.join(__dirname, 'index.html')); shortcuts();
    console.info('[NXE] Dashboard loaded.');
  }).catch(error => { console.error(error); allowQuit = true; app.quit(); });
}
app.on('before-quit', event => { if (win && !allowQuit) event.preventDefault(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
