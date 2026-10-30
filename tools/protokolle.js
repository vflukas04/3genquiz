// Spielprotokolle auslesen: node tools/protokolle.js         → Spiele, Auswertung je Feld/Stufe, schwerste/leichteste Fragen
//                           node tools/protokolle.js <gid>   → ein Spiel mit allen Antworten
// Quelle: Firestore games/3genquiz/archiv (Projekt burbenoginspired), nur lesen. Rohdaten → tools/protokolle-daten/ (nicht im Repo).
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const BASE = 'https://firestore.googleapis.com/v1/projects/burbenoginspired/databases/(default)/documents/games/3genquiz/archiv';
const get = url => JSON.parse(execFileSync('curl', ['-s', '-m', '20', url], { encoding:'utf8', maxBuffer:64 << 20 }));
const val = v => v.mapValue ? obj(v.mapValue.fields || {}) : v.arrayValue ? (v.arrayValue.values || []).map(val)
  : 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue
  : 'nullValue' in v ? null : 'stringValue' in v ? v.stringValue : v.timestampValue || null;
const obj = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, val(v)]));
const docs = []; let tok = '';
do { const r = get(BASE + '?pageSize=300' + (tok ? '&pageToken=' + tok : '')); (r.documents || []).forEach(d => docs.push(obj(d.fields || {}))); tok = r.nextPageToken; } while (tok);
const games = docs.filter(d => d.gid).sort((a, b) => a.start < b.start ? -1 : 1);
const dir = path.join(__dirname, 'protokolle-daten'); fs.mkdirSync(dir, { recursive:true });
fs.writeFileSync(path.join(dir, 'alle.json'), JSON.stringify(games, null, 1));
const one = process.argv[2];
if (one) { const g = games.find(x => x.gid === one); if (!g) return console.log('nicht gefunden');
  console.log(JSON.stringify({...g, antworten: undefined}, null, 1));
  g.antworten.forEach(a => console.log(`${a.ok ? '✓' : '✗'} ${a.s.padEnd(13)} ${a.z.padEnd(28)} ${String(a.sek).padStart(4)}/${a.lim}s  ${a.f}  → ${a.a}${a.ok ? '' : '  (gewählt: ' + a.g + ')'}`)); return; }
console.log(`${games.length} Spiele`);
games.forEach(g => console.log(`${g.gid}  ${g.phase.padEnd(8)} ${g.schnell ? 'schnell ' : ''}${g.spieler.map(s => s.stufe + ' ' + s.punkte).join(' | ')}  Fehler: ${g.fehler.length}`));
const A = games.flatMap(g => g.antworten.filter(a => a.z !== 'Finale'));
const agg = (key) => { const m = {}; A.forEach(a => { const k = key(a); (m[k] = m[k] || {n:0, r:0, t:0}); m[k].n++; m[k].r += a.ok; m[k].t += a.sek / a.lim; }); return m; };
console.log('\nJe Feld und Stufe (richtig/gestellt, Ø Zeitanteil):');
Object.entries(agg(a => a.z + ' | ' + a.s)).sort().forEach(([k, e]) => console.log(`  ${k.padEnd(45)} ${e.r}/${e.n}  ${Math.round(100 * e.t / e.n)}%`));
const q = agg(a => a.s + ' | ' + a.f + ' → ' + a.a);
const rated = Object.entries(q).filter(([, e]) => e.n >= 2);
console.log('\nSchwerste Fragen (≥2×):'); rated.sort((a, b) => a[1].r / a[1].n - b[1].r / b[1].n).slice(0, 15).forEach(([k, e]) => console.log(`  ${e.r}/${e.n}  ${k}`));
