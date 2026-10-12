'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const scanner = require('./scanner');
const { EventEmitter } = require('node:events');

async function mainHarness(withTheme=false,coverMode='none') {
  const handlers = new Map(), calls = [], events = new Map(), windowCalls = [];
  const emulator = new EventEmitter();
  const game = { id: 'test-game', title: 'Test Game', rom_path: 'C:\\Games\\Test.iso' };
  if(coverMode!=='none'){game.uses_fallback_art=false;game.cover_art_path=coverMode==='cached'?path.join(__dirname,'covers','test-game.jpg'):path.join(__dirname,'sidecar.jpg');}
  let now = 1000000, window;
  let dialogResult = { canceled: false, filePaths: ['C:\\Games\\Xbox360'] };
  const electron = {
    app: { setName(){},setPath(){},commandLine:{appendSwitch(){}},requestSingleInstanceLock: () => true, on() {}, whenReady: () => Promise.resolve(), getPath: () => __dirname, quit() {} },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    globalShortcut: { isRegistered: () => false, register: () => { throw new Error('Unexpected registration on Windows'); }, unregisterAll() {} },
    protocol: { registerSchemesAsPrivileged() {}, handle() {} }, net: {fetch:async url=>new Response(url.endsWith('games.json')?JSON.stringify([{id:'12345678',title:'Test Game'}]):Buffer.from([255,216,255,224]))},
    dialog: { showOpenDialog: async (_window, options) => { calls.push(options); return typeof dialogResult === 'function' ? dialogResult() : dialogResult; } },
    BrowserWindow: class {
      constructor() { window = this; this.webContents = { mainFrame: { url: 'nxe-app://dashboard/index.html' }, setWindowOpenHandler() {}, on: (name, fn) => events.set(name, fn), send: (_channel, state) => windowCalls.push(['state', state.running]), session: { setPermissionRequestHandler() {},setPermissionCheckHandler() {} } }; }
      setMenu() {} on() {} async loadFile() {} async loadURL() {}
      isDestroyed() { return false; }
      restore() { windowCalls.push(['restore']); } show() { windowCalls.push(['show']); } focus() { windowCalls.push(['focus']); }
      setKiosk(value) { windowCalls.push(['kiosk', value]); } setFullScreen(value) { windowCalls.push(['fullscreen', value]); }
      minimize() { windowCalls.push(['minimize']); }
      setAlwaysOnTop(value){windowCalls.push(['topmost',value]);}
    }
  };
  const context = vm.createContext({
    require: name => name === 'electron' ? electron : name === 'node:child_process' ? { spawn: () => emulator } : name === 'node:fs/promises' ? { access: async () => {},mkdir:async()=>{},writeFile:async()=>{},rename:async()=>{},unlink:async()=>{} } : name==='./nxe'?{...require('./nxe'),loadTheme:async()=>({directory:__dirname,manifest:{version:1,assets:{},backgrounds:[{id:'theme-test',label:'Test'}],inventory:[],sounds:{},notes:[]},selected:'theme-test',audio:{volume:.5,muted:false}})}:name === './scanner' ? { ...scanner, loadLibrary: async () => ({ rom_directory: '', xenia_executable: 'C:\\Xenia\\xenia.exe', games: [game], admin_credential: scanner.hashPin('1234') }), scanDirectory: async () => [game], saveLibrary: async () => {} } : require(name),
    __dirname, console: { info() {}, warn() {}, error() {} }, process: { platform: 'win32' }, Date: { now: () => now }, URL, Response
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  const caller = () => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
  return { calls, events, emulator, windowCalls,hasHandler:name=>handlers.has(name), invoke: (name, ...args) => handlers.get(name)(caller(), ...args), untrusted: (name, ...args) => handlers.get(name)({ sender: {}, senderFrame: {} }, ...args), setTime: value => { now = value; }, setResult: value => { dialogResult = value; } };
}
test('PIN protection defaults on, can be disabled in-session and reenabled with the saved PIN',async()=>{
  const h=await mainHarness();
  assert.equal((await h.invoke('admin:access')).pin_required,true);
  await assert.rejects(h.invoke('admin:pin-protection',false),/session expired/);
  await assert.rejects(h.untrusted('admin:pin-protection',false),/Untrusted/);
  await h.invoke('admin:unlock','1234');
  await assert.rejects(h.invoke('admin:pin-protection','off'),/Invalid/);
  await h.invoke('admin:pin-protection',false);await h.invoke('admin:lock');
  await h.invoke('admin:unlock','');assert.equal((await h.invoke('admin:settings')).admin_pin_required,false);
  await h.invoke('admin:pin-protection',true);await h.invoke('admin:lock');
  await assert.rejects(h.invoke('admin:unlock',''),/Incorrect PIN/);
  await h.invoke('admin:unlock','1234');assert.equal((await h.invoke('admin:settings')).admin_pin_required,true);
});
test('native pickers require PIN and trusted IPC, constrain picker type and preserve cancel', async () => {
  const h = await mainHarness();
  await assert.rejects(h.invoke('admin:cover-search', 'test-game'), /session expired/);
  assert.equal(h.hasHandler('admin:theme-import'),false);
  await assert.rejects(h.invoke('admin:theme-select',null), /session expired/);
  await assert.rejects(h.invoke('admin:theme-audio',{volume:1,muted:false}), /session expired/);
  await assert.rejects(h.invoke('admin:cover-download', 'test-game', '4D5307E6'), /session expired/);
  await assert.rejects(h.untrusted('admin:cover-search', 'test-game'), /Untrusted/);
  await assert.rejects(h.invoke('admin:browse', 'rom_directory'), /session expired/);
  await assert.rejects(h.untrusted('admin:browse', 'rom_directory'), /Untrusted/);
  assert.equal(h.calls.length, 0);
  await h.invoke('admin:unlock', '1234');
  await assert.rejects(h.invoke('admin:browse', 'arbitrary'), /Invalid picker/);
  assert.equal(await h.invoke('admin:browse', 'rom_directory'), 'C:\\Games\\Xbox360');
  assert.deepEqual(Array.from(h.calls[0].properties), ['openDirectory', 'dontAddToRecent']);
  h.setResult({ canceled: true, filePaths: [] });
  assert.equal(await h.invoke('admin:browse', 'xenia_executable'), null);
  assert.deepEqual(Array.from(h.calls[1].filters[0].extensions), ['exe']);
  await h.invoke('admin:lock');
  await assert.rejects(h.invoke('admin:browse', 'rom_directory'), /session expired/);
});
test('theme sound settings validate inputs and survive wallpaper selection',async()=>{
  const h=await mainHarness(true);await h.invoke('admin:unlock','1234');
  await assert.rejects(h.invoke('admin:theme-audio',{volume:NaN,muted:false}),/Invalid/);
  await assert.rejects(h.invoke('admin:theme-audio',{volume:2,muted:false}),/Invalid/);
  const changed=await h.invoke('admin:theme-audio',{volume:.25,muted:true});assert.equal(changed.audio.volume,.25);assert.equal(changed.audio.muted,true);
  const selected=await h.invoke('admin:theme-select',null);assert.equal(selected.audio.volume,.25);assert.equal(selected.audio.muted,true);
  await h.invoke('admin:lock');await assert.rejects(h.invoke('admin:theme-audio',{volume:1,muted:false}),/expired/);
});
test('picker cannot return a path after PIN session expires while it is open', async () => {
  const h = await mainHarness();
  await h.invoke('admin:unlock', '1234');
  h.setResult(() => { h.setTime(1300001); return { canceled: false, filePaths: ['C:\\private'] }; });
  await assert.rejects(h.invoke('admin:browse', 'rom_directory'), /session expired/);
});
test('admin editing allows clipboard shortcuts; kiosk still blocks devtools and modifiers', async () => {
  const h = await mainHarness();
  const blocked = input => { let prevented = false; h.events.get('before-input-event')({ preventDefault: () => { prevented = true; } }, { key: 'v', control: true, ...input }); return prevented; };
  assert.equal(blocked({}), true);
  await h.invoke('admin:unlock', '1234');
  assert.equal(blocked({}), false);
  assert.equal(blocked({ key: 'i', shift: true }), true);
  assert.equal(blocked({ key: 'F12', control: false }), true);
  assert.equal(blocked({ key: 'Escape', control: false }), false);
  await h.invoke('admin:lock');
  assert.equal(blocked({}), true);
});
test('game startup keeps the kiosk fullscreen underneath Xenia; exit restores focus once', async () => {
  const h = await mainHarness();
  await h.invoke('game:launch', 'test-game');
  h.emulator.emit('spawn');
  assert.deepEqual(h.windowCalls, [['topmost',true],['topmost',false],['state', true]]);
  await assert.rejects(h.invoke('game:launch', 'test-game'), /already running/);
  h.emulator.emit('close', 0);
  assert.deepEqual(h.windowCalls, [['topmost',true],['topmost',false],['state', true], ['restore'], ['show'], ['kiosk', true], ['fullscreen', true], ['focus'], ['state', false]]);
  h.emulator.emit('error', new Error('late error'));
  assert.equal(h.windowCalls.filter(call => call[0] === 'restore').length, 1);
});

test('admin can replace a cached cover and refresh its URL; local images remain protected',async()=>{
  const h=await mainHarness(false,'cached');
  await assert.rejects(h.invoke('admin:cover-rescan'),/session expired/);
  await assert.rejects(h.untrusted('admin:cover-rescan'),/Untrusted/);
  await h.invoke('admin:unlock','1234');
  const before=(await h.invoke('library:get')).games[0];assert.equal(before.can_replace_cover,true);
  assert.equal((await h.invoke('admin:cover-search','test-game'))[0].id,'12345678');
  await assert.rejects(h.invoke('admin:cover-download','test-game','invalid'),/Invalid/);
  const replaced=(await h.invoke('admin:cover-download','test-game','12345678'))[0];assert.notEqual(replaced.cover_art_path,before.cover_art_path);assert.equal(replaced.uses_fallback_art,false);
  assert.equal((await h.invoke('admin:cover-rescan')).length,1);
  const local=await mainHarness(false,'local');await local.invoke('admin:unlock','1234');assert.equal((await local.invoke('library:get')).games[0].can_replace_cover,false);
  await assert.rejects(local.invoke('admin:cover-download','test-game','12345678'),/Invalid/);
});

test('PIN attempts are throttled and changing PIN protection remains admin-only',async()=>{
 const h=await mainHarness();for(let i=0;i<5;i++)await assert.rejects(h.invoke('admin:unlock','9999'),/Incorrect/);
 await assert.rejects(h.invoke('admin:unlock','1234'),/Too many/);h.setTime(1030001);await h.invoke('admin:unlock','1234');await h.invoke('admin:lock');await assert.rejects(h.invoke('admin:pin-protection',false),/session expired/);
 assert.equal(h.hasHandler('admin:theme-builtin'),false);
});
