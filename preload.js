'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  getLibrary: () => ipcRenderer.invoke('library:get'),
  launchXeniaGame: id => ipcRenderer.invoke('game:launch', id),
  unlockAdmin: pin => ipcRenderer.invoke('admin:unlock', pin),
  lockAdmin: () => ipcRenderer.invoke('admin:lock'),
  getSettings: () => ipcRenderer.invoke('admin:settings'),
  saveSettings: settings => ipcRenderer.invoke('admin:save', settings),
  exitToDesktop: () => ipcRenderer.invoke('admin:exit'),
  onGameState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('game:state', listener);
    return () => ipcRenderer.removeListener('game:state', listener);
  }
});
