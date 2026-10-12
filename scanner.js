'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const extensions = new Set(['.iso', '.xex', '.god']);
function cleanTitle(name) {
  return path.basename(name, path.extname(name)).replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled Game';
}
function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pin, salt, 32).toString('hex') };
}
function validCredential(credential){return !!credential&&typeof credential.salt==='string'&&/^[a-f0-9]{32}$/.test(credential.salt)&&typeof credential.hash==='string'&&/^[a-f0-9]{64}$/.test(credential.hash);}
function verifyPin(pin, credential) {
  if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) return false;
  if(!validCredential(credential))return false;
  const actual = hashPin(pin, credential.salt).hash;
  const expected = Buffer.from(credential.hash, 'hex');
  return expected.length === 32 && crypto.timingSafeEqual(Buffer.from(actual, 'hex'), expected);
}
async function saveLibrary(file, library) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  let created=false;
  try{
    await fs.writeFile(temp, JSON.stringify(library, null, 2), { mode: 0o600,flag:'wx' });
    created=true;
    await fs.rename(temp, file);
  }finally{if(created)await fs.unlink(temp).catch(()=>{});}
}
async function loadLibrary(file) {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!Array.isArray(data.games) || typeof data.rom_directory !== 'string' || typeof data.xenia_executable !== 'string') throw new Error('Invalid library schema');
    if (!data.admin_credential) {
      if(typeof data.admin_pin!=='string'||!/^\d{4,8}$/.test(data.admin_pin))throw Error('Missing administrator credential');
      data.admin_credential = hashPin(data.admin_pin);
      delete data.admin_pin;
      await saveLibrary(file, data);
    }
    if(!validCredential(data.admin_credential))throw Error('Invalid administrator credential');
    return data;
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Cannot read library.json: ${error.message}`);
    const data = { platform_os: process.platform, rom_directory: '', xenia_executable: '', runner: 'wine', runner_args: [], admin_credential: hashPin('1234'), games: [] };
    await saveLibrary(file, data);
    return data;
  }
}
async function scanDirectory(directory) {
  if (!directory) return [];
  const games = [];
  async function walk(folder) {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    const names = new Map(entries.filter(e => e.isFile()).map(e => [e.name.toLowerCase(), e.name]));
    for (const entry of entries) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) { await walk(full); continue; }
      if (!entry.isFile() || !extensions.has(path.extname(entry.name).toLowerCase())) continue;
      const stem = path.basename(entry.name, path.extname(entry.name));
      const cover = ['.png', '.jpg', '.jpeg'].map(ext => names.get((stem + ext).toLowerCase())).find(Boolean);
      games.push({ id: crypto.createHash('sha256').update(full).digest('hex').slice(0, 20), title: cleanTitle(entry.name), rom_path: full, cover_art_path: cover ? path.join(folder, cover) : null, uses_fallback_art: !cover });
    }
  }
  await walk(path.resolve(directory));
  return games.sort((a, b) => a.title.localeCompare(b.title) || a.rom_path.localeCompare(b.rom_path));
}
module.exports = { cleanTitle, hashPin, verifyPin, saveLibrary, loadLibrary, scanDirectory };
