'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const BASE = 'https://raw.githubusercontent.com/xenia-manager/x360db/main/';
function normalize(title) { return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function matches(title, catalog) {
  const query = normalize(title);
  if (!query) return [];
  return catalog.map(g => {
    const name = normalize(g.title);
    const words = title.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const score = name === query ? 100 : name.length >= 4 && (name.includes(query) || query.includes(name)) ? 80 : words.filter(w => g.title.toLowerCase().includes(w)).length / Math.max(1, words.length) * 60;
    return { id: g.id, title: g.title.trim(), score };
  }).filter(g => g.score >= 30).sort((a,b) => b.score-a.score || a.title.localeCompare(b.title)).slice(0,8);
}
async function request(url, fetcher, limit) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(20000), redirect: 'error' });
  if (!response.ok) throw new Error(`Artwork service returned ${response.status}. Try again later.`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error('Artwork response is too large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
function createService(fetcher) {
  let catalog;
  return {
    async search(title) {
      if (!catalog) {
        const data = JSON.parse((await request(`${BASE}games.json`, fetcher, 16*1024*1024)).toString('utf8'));
        if (!Array.isArray(data)) throw new Error('Invalid artwork catalog');
        catalog = data.filter(g => typeof g.title === 'string' && /^[A-Fa-f0-9]{8}$/.test(g.id));
      }
      return matches(title, catalog);
    },
    async download(id) {
      if (!catalog?.some(g => g.id === id)) throw new Error('Unknown cover selection');
      const bytes = await request(`${BASE}titles/${id}/artwork/boxart.jpg`, fetcher, 8*1024*1024);
      if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error('Artwork service did not return a JPEG cover');
      return bytes;
    }
  };
}
async function applyCached(games, directory) {
  for (const game of games) {
    if (!game.uses_fallback_art) continue;
    const file = path.join(directory, `${game.id}.jpg`);
    try { await fs.access(file); game.cover_art_path = file; game.uses_fallback_art = false; } catch(error) { if(error.code !== 'ENOENT') throw error; }
  }
  return games;
}
module.exports = { createService, matches, applyCached };
