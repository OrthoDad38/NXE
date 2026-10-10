'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  getLibrary: () => ipcRenderer.invoke('library:get'),
  getTheme: () => ipcRenderer.invoke('theme:get'),
  importTheme: () => ipcRenderer.invoke('admin:theme-import'),
  selectTheme: id => ipcRenderer.invoke('admin:theme-select',id),
  setThemeAudio: audio => ipcRenderer.invoke('admin:theme-audio',audio),
  launchXeniaGame: id => ipcRenderer.invoke('game:launch', id),
  unlockAdmin: pin => ipcRenderer.invoke('admin:unlock', pin),
  lockAdmin: () => ipcRenderer.invoke('admin:lock'),
  getSettings: () => ipcRenderer.invoke('admin:settings'),
  browseLocation: kind => ipcRenderer.invoke('admin:browse', kind),
  saveSettings: settings => ipcRenderer.invoke('admin:save', settings),
  searchCovers: id => ipcRenderer.invoke('admin:cover-search', id),
  downloadCover: (id, candidate) => ipcRenderer.invoke('admin:cover-download', id, candidate),
  exitToDesktop: () => ipcRenderer.invoke('admin:exit'),
  onGameState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('game:state', listener);
    return () => ipcRenderer.removeListener('game:state', listener);
  }
});
