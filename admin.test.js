'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const scanner = require('./scanner');

async function mainHarness() {
  const handlers = new Map(), calls = [], events = new Map();
  let now = 1000000, window;
  let dialogResult = { canceled: false, filePaths: ['C:\\Games\\Xbox360'] };
  const electron = {
    app: { requestSingleInstanceLock: () => true, on() {}, whenReady: () => Promise.resolve(), getPath: () => __dirname, quit() {} },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    globalShortcut: { isRegistered: () => false, register: () => { throw new Error('Unexpected registration on Windows'); }, unregisterAll() {} },
    protocol: { registerSchemesAsPrivileged() {}, handle() {} }, net: {},
    dialog: { showOpenDialog: async (_window, options) => { calls.push(options); return typeof dialogResult === 'function' ? dialogResult() : dialogResult; } },
    BrowserWindow: class {
      constructor() { window = this; this.webContents = { mainFrame: { url: pathToFileURL(path.join(__dirname, 'index.html')).href }, setWindowOpenHandler() {}, on: (name, fn) => events.set(name, fn), session: { setPermissionRequestHandler() {} } }; }
      setMenu() {} on() {} async loadFile() {}
    }
  };
  const context = vm.createContext({
    require: name => name === 'electron' ? electron : name === './scanner' ? { ...scanner, loadLibrary: async () => ({ rom_directory: '', xenia_executable: '', games: [], admin_credential: scanner.hashPin('1234') }), scanDirectory: async () => [], saveLibrary: async () => {} } : require(name),
    __dirname, console: { info() {}, warn() {}, error() {} }, process: { platform: 'win32' }, Date: { now: () => now }, URL, Response
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  const caller = () => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
  return { calls, events, invoke: (name, ...args) => handlers.get(name)(caller(), ...args), untrusted: (name, ...args) => handlers.get(name)({ sender: {}, senderFrame: {} }, ...args), setTime: value => { now = value; }, setResult: value => { dialogResult = value; } };
}
test('native pickers require PIN and trusted IPC, constrain picker type and preserve cancel', async () => {
  const h = await mainHarness();
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
