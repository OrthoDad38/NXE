'use strict';
const { app, BrowserWindow, ipcMain, globalShortcut, protocol, net } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const scanner = require('./scanner');
protocol.registerSchemesAsPrivileged([{ scheme: 'kratos-art', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let win, library, libraryFile, child, allowQuit = false, adminUntil = 0, attempts = 0, blockedUntil = 0;
let queue = Promise.resolve();
function serialized(work) { const result = queue.then(work); queue = result.catch(() => {}); return result; }
function requireAdmin() { if (Date.now() > adminUntil) throw new Error('Admin session expired. Enter PIN again.'); }
function publicGames() { return library.games.map(g => ({ id: g.id, title: g.title, uses_fallback_art: g.uses_fallback_art, cover_art_path: g.cover_art_path ? `kratos-art://cover/${g.id}` : null })); }
function shortcuts() {
  for (const key of ['Alt+F4', 'Alt+Tab', 'Super', 'CommandOrControl+W', 'CommandOrControl+Shift+I', 'F11', 'F12']) {
    try { if (!globalShortcut.register(key, () => {})) console.warn(`OS did not grant shortcut: ${key}`); } catch { console.warn(`Unsupported shortcut: ${key}`); }
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
  if (child) throw new Error('A game is already running');
  const game = library.games.find(g => g.id === id);
  if (!game) throw new Error('Unknown game');
  await fs.access(game.rom_path); await fs.access(library.xenia_executable);
  // Re-check after asynchronous validation to prevent concurrent launches.
  if (child) throw new Error('A game is already running');
  adminUntil = 0;
  const linux = process.platform === 'linux';
  const command = linux ? library.runner || 'wine' : library.xenia_executable;
  const args = linux ? [...(library.runner_args || []), library.xenia_executable, '--fullscreen', game.rom_path] : ['--fullscreen', game.rom_path];
  child = spawn(command, args, { shell: false, cwd: path.dirname(library.xenia_executable), stdio: 'ignore', windowsHide: false });
  let finished = false;
  const finish = state => { if (!finished) { finished = true; recover(state); } };
  child.once('error', error => finish({ running: false, error: `Launch failed: ${error.message}` }));
  child.once('close', code => finish({ running: false, error: code ? `Emulator exited with code ${code}` : null }));
  child.once('spawn', () => {
    globalShortcut.unregisterAll(); win.setKiosk(false); win.setFullScreen(false); win.minimize();
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
    let scanError = '';
    try { library.games = await scanner.scanDirectory(library.rom_directory); await scanner.saveLibrary(libraryFile, library); } catch (error) { scanError = `Scan failed: ${error.message}`; }
    protocol.handle('kratos-art', request => {
      const url = new URL(request.url);
      const game = library.games.find(g => g.id === url.pathname.slice(1));
      if (url.hostname !== 'cover' || !game?.cover_art_path) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(game.cover_art_path).href);
    });
    handle('library:get', () => ({ games: publicGames(), error: scanError }));
    handle('game:launch', launch);
    handle('admin:unlock', pin => {
      if (Date.now() < blockedUntil) throw new Error('Too many attempts. Wait 30 seconds.');
      if (!scanner.verifyPin(pin, library.admin_credential)) { if (++attempts >= 5) { blockedUntil = Date.now() + 30000; attempts = 0; } throw new Error('Incorrect PIN'); }
      attempts = 0; adminUntil = Date.now() + 300000; return true;
    });
    handle('admin:lock', () => { adminUntil = 0; });
    handle('admin:settings', () => { requireAdmin(); return { rom_directory: library.rom_directory, xenia_executable: library.xenia_executable, runner: library.runner || 'wine', runner_args: library.runner_args || [], platform_os: process.platform }; });
    handle('admin:save', settings => serialized(async () => {
      requireAdmin();
      for (const key of ['rom_directory', 'xenia_executable', 'runner']) if (typeof settings?.[key] !== 'string' || settings[key].length > 4096 || settings[key].includes('\0')) throw new Error('Invalid settings');
      if (!Array.isArray(settings.runner_args) || settings.runner_args.length > 32 || settings.runner_args.some(a => typeof a !== 'string' || a.includes('\0') || a.length > 4096)) throw new Error('Runner arguments must be a JSON string array');
      if (!path.isAbsolute(settings.rom_directory) || !path.isAbsolute(settings.xenia_executable)) throw new Error('ROM and emulator paths must be absolute');
      await fs.access(settings.xenia_executable);
      const games = await scanner.scanDirectory(settings.rom_directory);
      const next = { ...library, platform_os: process.platform, rom_directory: settings.rom_directory, xenia_executable: settings.xenia_executable, runner: settings.runner, runner_args: settings.runner_args, games };
      if (settings.new_pin) { if (!/^\d{4,8}$/.test(settings.new_pin)) throw new Error('PIN must be 4–8 digits'); next.admin_credential = scanner.hashPin(settings.new_pin); }
      requireAdmin(); await scanner.saveLibrary(libraryFile, next); library = next; scanError = ''; return publicGames();
    }));
    handle('admin:exit', () => { requireAdmin(); allowQuit = true; app.quit(); });
    win = new BrowserWindow({ kiosk: true, fullscreen: true, frame: false, autoHideMenuBar: true, backgroundColor: '#07090c', webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, devTools: false } });
    win.setMenu(null);
    win.on('close', event => { if (!allowQuit) event.preventDefault(); });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.on('will-attach-webview', event => event.preventDefault());
    win.webContents.on('before-input-event', (event, input) => { if (input.alt || input.meta || input.control || ['F11', 'F12', 'Escape'].includes(input.key)) event.preventDefault(); });
    win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    await win.loadFile('index.html'); shortcuts();
  }).catch(error => { console.error(error); allowQuit = true; app.quit(); });
}
app.on('before-quit', event => { if (win && !allowQuit) event.preventDefault(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
