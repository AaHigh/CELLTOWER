// ═══════════════════════════════════════════════════════════════════════════
// CT-CORE.JS — CELLTOWER shared protocol core (v3.0)
// Extracted VERBATIM from index.html (game v0.6122026). Canonical shared
// copy: B92 codec, xoshiro128** seeded PRNG, 256-slot timing table,
// spacetime fields, rules/scoring enums + canonical aux, v3.0 piece
// derivation, structural reject, replay parser, and the full PORTABLE
// VERIFICATION CORE (physics replay + hash chain + HPS + NPF).
//
// SYNC DOCTRINE: index.html keeps its own inlined copy (air-gapped single-
// file game doctrine). Any change to either copy MUST be mirrored to the
// other — the protocol lives in this code, not in any server.
// Consumers: SWITCHBOARD operator console; future standalone validator.
// ═══════════════════════════════════════════════════════════════════════════

const _B92_ALPHABET = (()=>{
  let s = '';
  for(let i=33;i<=126;i++) if(i!==44&&i!==59) s+=String.fromCharCode(i);
  return s;
})();  // exactly 92 characters

function _toB92(value, width) {
  let v = value, s = '';
  for(let i = 0; i < width; i++) { s = _B92_ALPHABET[v % 92] + s; v = Math.floor(v / 92); }
  return s;
}

function _fromB92(str) {
  let n = 0;
  for(let i = 0; i < str.length; i++) n = n * 92 + _B92_ALPHABET.indexOf(str[i]);
  return n;
}

// Encode arbitrary bytes (Uint8Array) as a fixed-width B92 string via BigInt.
function _bytesToB92(bytes, width) {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  let s = '';
  for (let i = 0; i < width; i++) { s = _B92_ALPHABET[Number(v % 92n)] + s; v /= 92n; }
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// v3.0 DETERMINISTIC CORE — xoshiro128** PRNG + 256-slot timing table
// Spec authority: stream.md Part II. Game and verifier MUST share this code
// byte-for-byte. The PRNG call sequence is part of the protocol — see
// stream.md "v3.0 Piece Sequence" for the exact call order, including the
// two conditional fallback calls (Towres-impossible, Towres-blocked swap).
// ═══════════════════════════════════════════════════════════════════════════

// Seed derivation: splitmix32 over the five B92 alphabet indices of seed5
// expands into the four 32-bit words of xoshiro128** state. All-zero state
// is impossible because splitmix32 output of a nonzero stream never yields
// four zero words for any seed5 (guarded anyway).
let _x128s = new Uint32Array(4);
function _splitmix32(a){
  return function(){
    a |= 0; a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);     t = Math.imul(t, 0x735a2d97);
    return ((t = t ^ (t >>> 15)) >>> 0);
  };
}
function _ctkRngSeed(seed5){
  let acc = 0;
  for(let i = 0; i < seed5.length; i++)
    acc = (Math.imul(acc, 92) + _B92_ALPHABET.indexOf(seed5[i])) | 0;
  const sm = _splitmix32(acc);
  for(let i = 0; i < 4; i++) _x128s[i] = sm();
  if(!(_x128s[0]|_x128s[1]|_x128s[2]|_x128s[3])) _x128s[0] = 1; // never all-zero
}
function _rotl32(x, k){ return ((x << k) | (x >>> (32 - k))) >>> 0; }
// xoshiro128** 1.0 — returns float in [0,1), 32 bits of state output
function _ctkRand(){
  const s = _x128s;
  const result = _rotl32(Math.imul(s[1], 5) >>> 0, 7);
  const r = (Math.imul(result, 9) >>> 0);
  const t = (s[1] << 9) >>> 0;
  s[2] = (s[2] ^ s[0]) >>> 0;
  s[3] = (s[3] ^ s[1]) >>> 0;
  s[1] = (s[1] ^ s[2]) >>> 0;
  s[0] = (s[0] ^ s[3]) >>> 0;
  s[2] = (s[2] ^ t) >>> 0;
  s[3] = _rotl32(s[3], 11);
  return r / 4294967296;
}
// Canonical non-I draw (protocol order O,T,S,Z,J,L) — consumes ONE call.
const _CTK_NON_I = ['O','T','S','Z','J','L'];
function _ctkNonI(){ return _CTK_NON_I[_ctkRand() * 6 | 0]; }

// ── 256-slot timing table (stream.md zones A–D) ─────────────────────────────
// Zone A slots   0- 59:    0- 150ms @ 2.5ms   — bot fingerprint resolution
// Zone B slots  60-179:  150- 800ms @ ~5.4ms  — human performance range
// Zone C slots 180-219:  800-3000ms @ 55ms    — thinking pause
// Zone D slots 220-255: 3000-8000ms @ ~139ms  — long pause, coarse
// Quantization contract: hash record stores TIMING_TABLE[slot], never raw ms.
const TIMING_TABLE = (() => {
  const t = new Uint16Array(256);
  for(let i =   0; i <  60; i++) t[i] = Math.round(i * 2.5);
  for(let i =  60; i < 180; i++) t[i] = Math.round(150 + (i - 60) * 650 / 120);
  for(let i = 180; i < 220; i++) t[i] = 800 + (i - 180) * 55;
  for(let i = 220; i < 256; i++) t[i] = Math.round(3000 + (i - 220) * 5000 / 36);
  return t;
})();
// Nearest-slot quantizer — binary search over the monotonic table.
function _msToSlot(ms){
  if(ms <= 0) return 0;
  if(ms >= TIMING_TABLE[255]) return 255;
  let lo = 0, hi = 255;
  while(lo < hi){
    const mid = (lo + hi) >> 1;
    if(TIMING_TABLE[mid] < ms) lo = mid + 1; else hi = mid;
  }
  // lo = first slot >= ms; check if the slot below is closer
  return (lo > 0 && ms - TIMING_TABLE[lo-1] <= TIMING_TABLE[lo] - ms) ? lo - 1 : lo;
}
const _MODE_CHAR = '!'; // B92 value 0 — Mode 0 seeded deterministic

// ── v3.0 spacetime fields (formerly the v4.20 spec — folded into v3.0) ─────
// Green Minute: minutes since the CELLTOWER epoch, 2026-04-20T04:20:00Z.
const _GM_EPOCH_MS = 1776658800000;
function _greenMinute(){ return Math.max(0, Math.floor((Date.now() - _GM_EPOCH_MS) / 60000)); }
// Geolocation step encodings (~30.5m resolution). Sentinels = physically
// impossible coordinates: AI game, permission absent, or location unavailable.
const _LAT_SENTINEL = 656972, _LON_SENTINEL = 1313942;
function _latSteps(deg){ return Math.round((deg + 90.0)  * (656971.0  / 180.0)); }
function _lonSteps(deg){ return Math.round((deg + 180.0) * (1313941.0 / 360.0)); }
let _gameGM = 0;                    // Green Minute at game start — bound into H_0
let _gameLatSteps = _LAT_SENTINEL;  // header-attested only (async permission)
let _gameLonSteps = _LON_SENTINEL;
// Capture location ONLY if the player already granted it to this page —
// never prompt mid-game. The value lives solely in the stream string the
// player controls; nothing is transmitted anywhere.
function _captureGeo(){
  _gameLatSteps = _LAT_SENTINEL; _gameLonSteps = _LON_SENTINEL;
  try{
    if(!navigator.geolocation || !navigator.permissions) return;
    navigator.permissions.query({name:'geolocation'}).then(p=>{
      if(p.state!=='granted') return;
      navigator.geolocation.getCurrentPosition(pos=>{
        _gameLatSteps = _latSteps(pos.coords.latitude);
        _gameLonSteps = _lonSteps(pos.coords.longitude);
      }, ()=>{}, {timeout:5000, maximumAge:600000});
    }).catch(()=>{});
  }catch(e){}
}
// Terminal hash: first 9 bytes (72 bits) of H_N as 12 B92 chars.
// 72-bit second-preimage cost ≈ 2^72 chain recomputations — unreachable.
// 12 chars ≈ 78-bit capacity, so 9 bytes encode with no modular bias.
const _TERM_HASH_BYTES = 9, _TERM_HASH_CHARS = 12;

// ── v3.0 rules/scoring enumerations + auxiliary section ────────────────────
// One B92 char each. 0 = current default. 1-90 reserved for future versions.
// 91 ('~', the last alphabet symbol) = ESCAPE: the value lives in the aux
// section as a named variable. (One B92 char maxes at 91 — the 0-255-with-
// escape-at-255 framing needs 2 chars; 0-90 keeps it to one.)
const _ENUM_ESCAPE = 91;
let _gameRules   = 0;   // rules enumeration   (key 'R' when escaped)
let _gameScoring = 0;   // scoring enumeration (key 'S' when escaped)
let _gameAuxVars = {};  // named vars: short keys, e.g. {T:'FRESNO26'} for tournament ID
// Canonical aux serialization — EXACTLY ONE legal encoding per variable set:
// keys sorted, k=v pairs comma-joined, no whitespace. Keys and values must be
// B92 chars; '=' additionally forbidden in both. The string is hash-bound
// verbatim, so any deviation in ordering or spacing is a different game.
function _canonAux(vars){
  const ks = Object.keys(vars).sort();
  const bad = /[,;=\s]/;
  const parts = [];
  for(const k of ks){
    const v = String(vars[k]);
    if(bad.test(k) || bad.test(v)) continue; // structurally invalid — drop
    parts.push(k + '=' + v);
  }
  return parts.join(',');
}
// The two-char rules+scoring field as it appears in the header.
function _rsChars(){
  const r = (_gameRules   >= 0 && _gameRules   <= 91) ? _gameRules   : _ENUM_ESCAPE;
  const c = (_gameScoring >= 0 && _gameScoring <= 91) ? _gameScoring : _ENUM_ESCAPE;
  return _B92_ALPHABET[r] + _B92_ALPHABET[c];
}

// Quick structural check — does this look like a CELLTOWER stream?
// Quick structural check — does this look like a CELLTOWER stream?
function _streamReject(t){
  if(!t||typeof t!=='string') return 'empty input';
  const raw=t.trim();
  if(raw.length<80) return 'too short ('+raw.length+' chars)';
  const p=raw.split(';');
  if(p.length<3) return 'missing sections (got '+p.length+')';
  const hdr=p[0].split(',');
  if(hdr.length<2) return 'bad header';
  const seed=hdr[0];
  if(seed.length!==5&&seed.length!==6) return 'bad seed length ('+seed.length+')';
  const B92s=(()=>{const s=new Set();for(let i=33;i<=126;i++)if(i!==44&&i!==59)s.add(String.fromCharCode(i));return s;})();
  const b92ok=s=>{for(const c of s)if(!B92s.has(c))return false;return true;};
  if(!b92ok(seed)) return 'seed has invalid chars';
  const stats=hdr[1];
  if(stats.length!==10) return 'stats wrong length ('+stats.length+')';
  if(!b92ok(stats)) return 'stats has invalid chars';
  const B92a=[...B92s];
  const fromB92=s=>{let n=0;for(const c of s)n=n*92+B92a.indexOf(c);return n;};
  const nPieces=fromB92(stats.slice(8,10));
  if(nPieces<=0) return 'piece count is zero';
  if(nPieces>10000) return 'piece count too large';
  // v3.0 may carry an aux section: header;aux;placements;hash (4 sections).
  const hasAux = seed.length===6 && p.length>=4;
  if(seed.length===6){
    if(hdr.length<7) return 'v3 header missing rules/scoring field (got '+hdr.length+')';
    if((hdr[6]||'').length!==2) return 'rules/scoring field wrong length';
    if(hasAux && !/^[!-~]*$/.test(p[1])) return 'aux has invalid chars';
  }
  const block=(hasAux?p[2]:p[1])||'';
  const cpp=seed.length===6?3:4;
  if(block.length<nPieces*cpp) return 'placements short: need '+(nPieces*cpp)+' got '+block.length;
  if(!b92ok(block)) return 'placements has invalid chars';
  const termHash=p[p.length-1];
  // v2.0 (5-char seed): 40-char terminal hash. v3.0 (6-char seed): 12 chars.
  const expectHash = seed.length===6 ? 12 : 40;
  if(termHash.length!==expectHash) return 'hash wrong length ('+termHash.length+', expected '+expectHash+')';
  if(seed.length===6 && hdr.length<6) return 'v3 header missing spacetime fields (got '+hdr.length+')';
  return null;
}

// ── Puzzle grids + type maps (protocol constants — 13 grids) ──
const PUZZLE_GRIDS = [
  ['ABCCCDDDD','ABBCEEEFF','AGBHHEIIF','AGGGHHIIF'],
  ['ABCCDDDEE','ABBCCDFFE','AGBHHHFFE','AGGGHIIII'],
  ['ABBCCCDDD','AEBBCFFGD','AEHHHFFGG','AEEHIIIIG'],
  ['ABCDDDEEE','ABCCDFFFE','ABBCGGFHH','AIIIIGGHH'],
  ['AABCCCDDD','AABBCEEED','FFFBGGEHH','FIIIIGGHH'],
  ['AAABBBCCC','DAEEBFFGC','DHHEEFFGG','DDHHIIIIG'],
  ['ABBBCCCCD','AABEEEFFD','GAHHEIIFD','GGGHHIIFD'],
  ['ABBBCCCDD','AABEECFFD','GAHHEEFFD','GGGHHIIII'],
  ['ABBCCCDDE','AABBCFFDE','GAHHHFFDE','GGGHIIIIE'],
  ['AABBBCCCD','EAABFFGCD','EHHHFFGGD','EEHIIIIGD'],
  ['ABCCCDDDD','ABBCEEEFF','AABGGEHFF','IIIIGGHHH'],
  ['ABCCCDDDE','ABBCFFFDE','AABGGFHHE','IIIIGGHHE'],
  ['ABCCDDDEE','ABBCCDFEE','AABGGGFFF','HHHHGIIII'],
];
const PUZZLE_PIECE_TYPES = [
  {A:'I',B:'S',C:'T',D:'I',E:'T',F:'L',G:'J',H:'Z',I:'O'},
  {A:'I',B:'S',C:'Z',D:'T',E:'L',F:'O',G:'J',H:'T',I:'I'},
  {A:'I',B:'Z',C:'T',D:'J',E:'L',F:'O',G:'S',H:'T',I:'I'},
  {A:'I',B:'L',C:'S',D:'T',E:'J',F:'T',G:'Z',H:'O',I:'I'},
  {A:'O',B:'S',C:'T',D:'J',E:'T',F:'L',G:'Z',H:'O',I:'I'},
  {A:'T',B:'T',C:'J',D:'L',E:'Z',F:'O',G:'S',H:'Z',I:'I'},
  {A:'S',B:'T',C:'I',D:'I',E:'T',F:'L',G:'J',H:'Z',I:'O'},
  {A:'S',B:'T',C:'T',D:'L',E:'Z',F:'O',G:'J',H:'Z',I:'I'},
  {A:'S',B:'Z',C:'T',D:'L',E:'I',F:'O',G:'J',H:'T',I:'I'},
  {A:'Z',B:'T',C:'J',D:'I',E:'L',F:'O',G:'S',H:'T',I:'I'},
  {A:'L',B:'S',C:'T',D:'I',E:'T',F:'O',G:'Z',H:'J',I:'I'},
  {A:'L',B:'S',C:'T',D:'J',E:'I',F:'T',G:'Z',H:'O',I:'I'},
  {A:'L',B:'S',C:'Z',D:'T',E:'O',F:'J',G:'T',H:'I',I:'I'},
];

function _v3DerivePieces(seed5, nPieces){
  _ctkRngSeed(seed5);
  const out = [];
  const si = _ctkRand()*PUZZLE_GRIDS.length|0;      // call #1
  const mirror = _ctkRand()<0.5;                    // call #2
  const mirrorType = {I:'I',O:'O',T:'T',S:'Z',Z:'S',J:'L',L:'J'};
  const baseTypeMap = PUZZLE_PIECE_TYPES[si];
  const typeMap = mirror
    ? Object.fromEntries(Object.entries(baseTypeMap).map(([k,v])=>[k,mirrorType[v]]))
    : baseTypeMap;
  const grid = PUZZLE_GRIDS[si].map(row => mirror ? row.split('').reverse().join('') : row);
  const g = grid.map(row=>row.split(''));
  const R=4, C=9;
  const cellsOf = lbl => { const a=[]; for(let r=0;r<R;r++) for(let c=0;c<C;c++) if(g[r][c]===lbl) a.push([r,c]); return a; };
  const pullable = () => {
    const lbls=[...new Set(g.flat().filter(ch=>ch!=='.'))];
    return lbls.filter(lbl=>cellsOf(lbl).every(([r,c])=>r===R-1||g[r+1][c]==='.'||g[r+1][c]===lbl));
  };
  while(out.length<9){
    const avail=pullable();
    if(!avail.length) break;
    const chosen=avail[_ctkRand()*avail.length|0];  // calls #3-#11
    out.push(typeMap[chosen]);
    for(let r=0;r<R;r++) for(let c=0;c<C;c++) if(g[r][c]===chosen) g[r][c]='.';
  }
  out.push('I');                                    // 10th piece: free, no call
  const PO=['I','O','T','S','Z','J','L'];
  while(out.length<nPieces) out.push(PO[_ctkRand()*7|0]);
  return out.slice(0,nPieces);
}

// Parse stream into placements array + header meta for visual replay.
// Branches on seed length: 5 chars = v2.0 (4 chars/piece, type in stream),
// 6 chars = v3.0 (3 chars/piece, type derived from seeded PRNG).
function _parseStreamForReplay(streamText){
  try{
    const sections=streamText.trim().split(';');
    const hdrParts=sections[0].split(',');
    const seedField=hdrParts[0]||'';
    const isV3=seedField.length===6;
    const stats=hdrParts[1]||'';
    const replayScore=stats.length>=4?_fromB92(stats.slice(0,4)):0;
    const replayLevel=stats.length>=6?_fromB92(stats.slice(4,6)):1;
    const replayLines=stats.length>=8?_fromB92(stats.slice(6,8)):0;
    const nPieces=stats.length>=10?_fromB92(stats.slice(8,10)):0;
    const hasAux=isV3&&sections.length>=4;
    const block=(hasAux?sections[2]:sections[1])||'';
    const PO=['I','O','T','S','Z','J','L'];
    const pieces=[];
    if(isV3){
      const seed5=seedField.slice(0,5);
      const types=_v3DerivePieces(seed5,nPieces);
      for(let n=0;n<nPieces;n++){
        const chunk=block.slice(n*3,n*3+3);
        if(chunk.length<3)break;
        const triple=_fromB92(chunk);
        const posIdx=Math.floor(triple/256);
        const tSlot=triple%256;
        const rot=Math.floor(posIdx/290);
        const x=Math.floor((posIdx%290)/29);
        const drop_y=(posIdx%29)-4;
        const ms=TIMING_TABLE[Math.min(255,tSlot)];
        pieces.push({k:types[n]||'I',rot,x,drop_y,ms});
      }
    } else {
      for(let n=0;n<nPieces;n++){
        const chunk=block.slice(n*4,n*4+4);
        if(chunk.length<4)break;
        const posIdx=_fromB92(chunk.slice(0,2));
        const rot=Math.floor((posIdx%1160)/290);
        const x=Math.floor((posIdx%290)/29);
        const drop_y=(posIdx%29)-4;
        const k=PO[Math.floor(posIdx/1160)]||'I';
        const ms=_fromB92(chunk.slice(2,4));
        pieces.push({k,rot,x,drop_y,ms});
      }
    }
    const playerName=(hdrParts[2]||'').slice(0,3);
    return{pieces,score:replayScore,level:replayLevel,lines:replayLines,playerName};
  }catch(e){return null;}
}


// Piece shapes — independently defined (same data as NRS, separate object)
const _V_SHAPES = {
  I: [[[1,1,1,1]],         [[1],[1],[1],[1]],     [[1,1,1,1]],         [[1],[1],[1],[1]]],
  O: [[[1,1],[1,1]],       [[1,1],[1,1]],         [[1,1],[1,1]],       [[1,1],[1,1]]],
  T: [[[0,1,0],[1,1,1]],   [[1,0],[1,1],[1,0]],   [[1,1,1],[0,1,0]],   [[0,1],[1,1],[0,1]]],
  S: [[[0,1,1],[1,1,0]],   [[1,0],[1,1],[0,1]],   [[0,1,1],[1,1,0]],   [[1,0],[1,1],[0,1]]],
  Z: [[[1,1,0],[0,1,1]],   [[0,1],[1,1],[1,0]],   [[1,1,0],[0,1,1]],   [[0,1],[1,1],[1,0]]],
  J: [[[1,0,0],[1,1,1]],   [[1,1],[1,0],[1,0]],   [[1,1,1],[0,0,1]],   [[0,1],[0,1],[1,1]]],
  L: [[[0,0,1],[1,1,1]],   [[1,0],[1,0],[1,1]],   [[1,1,1],[1,0,0]],   [[1,1],[0,1],[0,1]]]
};
const _V_PIECE_ORDER = ['I','O','T','S','Z','J','L'];

// Base-92 decoder — independently defined (same alphabet as _fromB92)
const _V_B92 = (() => {
  const a = [];
  for (let i = 33; i <= 126; i++) { const c = String.fromCharCode(i); if (c !== ',' && c !== ';') a.push(c); }
  return a;
})();
function _vFromB92(s) { let n = 0; for (const c of s) n = n * 92 + _V_B92.indexOf(c); return n; }
function _vB92Idx(c) { return _V_B92.indexOf(c); }

// Board complexity score [0,1] from flat 25×10 board (Uint8Array, index=row*10+col).
// Higher = harder: tall stacks, many holes, uneven columns.
function _vBoardComplexity(board) {
  const colH = new Array(10).fill(0);
  for (let c = 0; c < 10; c++)
    for (let r = 0; r < 25; r++)
      if (board[r*10+c]) { colH[c] = 25 - r; break; }
  const maxH = Math.max(...colH) / 25;
  const meanH = colH.reduce((a,b)=>a+b,0) / 10;
  const stdH = Math.sqrt(colH.reduce((s,h)=>s+(h-meanH)**2,0)/10) / 25;
  let holes = 0;
  for (let c = 0; c < 10; c++) {
    let blocked = false;
    for (let r = 0; r < 25; r++) {
      if (board[r*10+c]) blocked = true;
      else if (blocked) holes++;
    }
  }
  return maxH*0.5 + stdH*0.3 + Math.min(holes/50,1)*0.2;
}

// Humanity Probability Score [0,1] from parallel timing and pre-placement complexity arrays.
// Signal: human players slow down on complex boards (positive correlation + natural variability).
// Bot-Jitter: uniform timing (low CV) or variance uncorrelated with complexity (r ≈ 0).
function _vComputeHPS(timings, complexities, minSamples = 20) {
  const n = timings.length;
  if (n < minSamples) return null; // insufficient sample for meaningful result
  const meanT = timings.reduce((a,b)=>a+b,0)/n;
  const meanC = complexities.reduce((a,b)=>a+b,0)/n;
  let num=0, ssT=0, ssC=0;
  for (let i=0; i<n; i++) {
    const dt=timings[i]-meanT, dc=complexities[i]-meanC;
    num+=dt*dc; ssT+=dt*dt; ssC+=dc*dc;
  }
  const r    = (ssT===0||ssC===0) ? 0 : num/Math.sqrt(ssT*ssC); // Pearson correlation
  const cv   = meanT>0 ? Math.sqrt(ssT/n)/meanT : 0;             // coefficient of variation
  const rNorm  = (r+1)/2;                 // -1..1 → 0..1
  const cvNorm = Math.min(1, cv/0.4);     // CV ≥ 0.4 = full variability score
  return Math.round((rNorm*0.7 + cvNorm*0.3)*100)/100;
}
function _vBytesToB92(bytes, width) {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  let s = '';
  for (let i = 0; i < width; i++) { s = _V_B92[Number(v % 92n)] + s; v /= 92n; }
  return s;
}

// Port of game's scoreBoard() for flat 25×10 Uint8Array. No game globals used.
function _vScoreBoard(b) {
  let totalH=0, bump=0;
  const colH=new Array(10).fill(0);
  for (let c=0; c<10; c++) {
    for (let r=0; r<25; r++) if (b[r*10+c]) { colH[c]=25-r; break; }
    totalH+=colH[c];
  }
  for (let c=0; c<9; c++) bump+=Math.abs(colH[c]-colH[c+1]);
  const maxH=Math.max(...colH), minH=Math.min(...colH);
  const danger=Math.max(0,Math.min(1,(maxH-12)/10)), dSq=danger*danger;
  const hPen=totalH*80*(1+dSq*8);
  const mhB=Math.max(0,maxH-8); const mhPen=mhB*mhB*120*(1+dSq*4);
  let cPen=0;
  for (let c=1; c<9; c++) {
    const ld=colH[c-1]-colH[c], rd=colH[c+1]-colH[c];
    if(ld>0&&rd>0){const d=Math.min(ld,rd);if(d>=2)cPen+=d*d*400*(1+dSq*2);}
  }
  const sp=maxH-minH;
  const sPen=sp>4?(sp-4)*(sp-4)*200*(1+dSq*3):0;
  let spkPen=0;
  for (let c=0; c<10; c++) {
    const lh=c>0?colH[c-1]:null, rh=c<9?colH[c+1]:null;
    const avg=(lh!==null&&rh!==null)?(lh+rh)/2:(lh!==null?lh:rh);
    const spk=colH[c]-avg;
    if(spk>=2) spkPen+=spk*spk*300*(1+dSq*4);
  }
  return -(hPen+bump*150*(1+dSq*2)+mhPen+cPen+sPen+spkPen);
}

// Decision-Path Conflict [0,1]: 0 = obvious best move, 1.0 = perfect toss-up.
// Evaluates all straight-drop placements for the piece type using base score
// (lines×800 + scoreBoard) — no next-piece lookahead (nxt not in stream).
function _vDPC(board, typeIdx) {
  const shapes = _V_SHAPES[_V_PIECE_ORDER[typeIdx]];
  const fitsAt = (cells, x, gy) => {
    for (let r=0; r<cells.length; r++)
      for (let c=0; c<cells[r].length; c++) {
        if (!cells[r][c]) continue;
        const br=gy+r, bc=x+c;
        if (br<0) continue;
        if (br>=25 || bc<0 || bc>=10 || board[br*10+bc]) return false;
      }
    return true;
  };
  const scores=[];
  for (let rot=0; rot<shapes.length; rot++) {
    const cells=shapes[rot], cw=cells[0].length;
    for (let x=0; x<=10-cw; x++) {
      if (!fitsAt(cells,x,0)) continue;
      let gy=0; while(fitsAt(cells,x,gy+1)) gy++;
      const tb=new Uint8Array(board);
      for (let r=0; r<cells.length; r++)
        for (let c=0; c<cw; c++)
          if (cells[r][c]&&gy+r>=0&&gy+r<25) tb[(gy+r)*10+x+c]=1;
      const nb=new Uint8Array(250);
      let dr=24, cl=0;
      for (let r=24; r>=0; r--) {
        let full=true;
        for (let c=0; c<10; c++) if(!tb[r*10+c]){full=false;break;}
        if(!full){nb.set(tb.subarray(r*10,r*10+10),dr*10);dr--;}else cl++;
      }
      scores.push(cl*800+_vScoreBoard(nb));
    }
  }
  if (scores.length<2) return 0;
  scores.sort((a,b)=>b-a);
  const range=Math.max(1,scores[0]-scores[scores.length-1]);
  return Math.max(0,Math.min(1,1.0-(scores[0]-scores[1])/range));
}

// Convert flat 25×10 board (Uint8Array, index=row*10+col) to 50-byte word array
function _vBoardToWords(b) {
  const out = new Uint8Array(50);
  for (let r = 0; r < 25; r++) {
    let w = 0;
    for (let c = 0; c < 10; c++) if (b[r*10+c]) w |= (1 << (9-c));
    out[r*2] = (w >> 8) & 0xFF; out[r*2+1] = w & 0xFF;
  }
  return out;
}

// Apply one placement to the board, clear complete rows, return lines cleared.
// Mirrors game's placeOn bounds check — cells above row 0 (drop_y+r < 0) are skipped.
function _vApply(board, typeIdx, rot, x, drop_y) {
  const cells = _V_SHAPES[_V_PIECE_ORDER[typeIdx]][rot];
  for (let r = 0; r < cells.length; r++)
    for (let c = 0; c < cells[r].length; c++) {
      const br = drop_y + r, bc = x + c;
      if (cells[r][c] && br >= 0 && br < 25 && bc >= 0 && bc < 10) board[br * 10 + bc] = 1;
    }
  let cleared = 0;
  for (let r = 24; r >= 0; r--) {
    let full = true;
    for (let c = 0; c < 10; c++) if (!board[r*10+c]) { full = false; break; }
    if (full) {
      for (let rr = r; rr > 0; rr--) for (let c = 0; c < 10; c++) board[rr*10+c] = board[(rr-1)*10+c];
      for (let c = 0; c < 10; c++) board[c] = 0;
      r++; cleared++;
    }
  }
  return cleared;
}

// Build the 56-byte hash record for one placement (same layout as _advanceHashChain)
function _vRecord(typeIdx, rot, x, drop_y, ms, boardWords) {
  const rec = new Uint8Array(56);
  rec[0]=typeIdx&0xFF; rec[1]=rot&0xFF; rec[2]=x&0xFF; rec[3]=drop_y&0xFF;
  rec[4]=(ms>>8)&0xFF; rec[5]=ms&0xFF;
  rec.set(boardWords, 6);
  return rec;
}

// Verify a stream text. Returns {valid, piecesReplayed, error}.
// No game globals referenced — pass the raw stream string returned by _buildStream().
async function _verifyStream(streamText) {
  try {
    const sections = streamText.split(';');
    if (sections.length < 3) return { valid: false, error: 'bad section count: ' + sections.length };

    const headerParts = sections[0].split(',');
    if (headerParts.length < 2) return { valid: false, error: 'bad header fields' };

    const seedField       = headerParts[0];             // 5 chars = v2.0, 6 = v3.0
    const isV3            = seedField.length === 6;
    const seed5           = seedField.slice(0, 5);
    const stats           = headerParts[1];             // 10 B92 chars
    const nPieces         = _vFromB92(stats.slice(8,10));
    // v3.0 with aux: header;aux;placements;hash. Without: header;placements;hash.
    const hasAux          = isV3 && sections.length >= 4;
    const auxStr          = hasAux ? sections[1] : '';
    const placementsBlock = hasAux ? sections[2] : sections[1];
    const termHashB92     = sections[sections.length - 1];
    const cpp             = isV3 ? 3 : 4;                // chars per placement
    const rsStr           = isV3 ? (headerParts[6]||'') : '';
    // Surface decoded regime for the caller / receipt display
    const rulesEnum   = isV3 && rsStr.length===2 ? _vB92Idx(rsStr[0]) : 0;
    const scoringEnum = isV3 && rsStr.length===2 ? _vB92Idx(rsStr[1]) : 0;
    const auxVars = {};
    if(auxStr) for(const pair of auxStr.split(',')){
      const eq = pair.indexOf('='); if(eq>0) auxVars[pair.slice(0,eq)] = pair.slice(eq+1);
    }

    // v3.0: piece types are not in the stream — derive from the seeded PRNG.
    // (Common path; the rare Towres fallback draws need full physics replay
    // and will surface as a hash mismatch here — flagged, not silently passed.)
    const v3Types = isV3 ? _v3DerivePieces(seed5, nPieces) : null;

    // H_0 binds identity (+ time-of-play in v3.0):
    //   v2.0: SHA-256(UTF-8(seed5 + playerName))
    //   v3.0: SHA-256(UTF-8(seed5 + playerName + gm4))
    const _seedStr = isV3
      ? seed5 + (headerParts[2]||'') + (headerParts[3]||'') + rsStr + auxStr
      : seed5 + (headerParts[2]||'');
    let H = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(_seedStr));

    // Fresh board — no game state
    const board = new Uint8Array(250);  // 25 rows × 10 cols
    const _hpTimings = [], _hpDPC = [];

    // Decade Merkle-Root state
    let prevDecadeHash = new Uint8Array(H);  // seeded from H_0
    let decadeRecs = [], decadeTms = [], decadeComplx = [];
    const blockLedger = [];

    // Neural Processing Floor — neurologically impossible: high-conflict choice resolved <150ms
    let npfHits = 0;

    for (let n = 0; n < nPieces; n++) {
      const chunk = placementsBlock.slice(n*cpp, n*cpp+cpp);
      if (chunk.length < cpp) return { valid: false, error: 'short placement block at piece ' + n };

      let typeIdx, rot, x, drop_y, ms;
      if (isV3) {
        // v3.0: 3 chars = posIdx*256 + tSlot. No type; no raw ms.
        const triple = _vFromB92(chunk);
        const posIdx = Math.floor(triple / 256);
        const tSlot  = triple % 256;
        typeIdx = _V_PIECE_ORDER.indexOf(v3Types[n] || 'I');
        rot     = Math.floor(posIdx / 290);
        x       = Math.floor((posIdx % 290) / 29);
        drop_y  = (posIdx % 29) - 4;
        ms      = TIMING_TABLE[tSlot];
      } else {
        const posIdx = _vFromB92(chunk.slice(0,2));
        typeIdx = Math.floor(posIdx / 1160);
        rot     = Math.floor((posIdx % 1160) / 290);
        x       = Math.floor((posIdx % 290) / 29);
        drop_y  = (posIdx % 29) - 4;  // 29-slot field, offset 4 → range -4..24
        ms      = _vFromB92(chunk.slice(2,4));
      }

      // DPC: how much conflict did this placement pose? Computed pre-placement.
      const dpc = _vDPC(board, typeIdx);
      _hpTimings.push(ms);
      _hpDPC.push(dpc);

      // Neural Processing Floor: high-conflict decision resolved in neurologically impossible time
      if (ms < 150 && dpc >= 0.7) npfHits++;

      // Decade accumulators use DPC (same signal as full-game HPS)
      decadeTms.push(ms);
      decadeComplx.push(dpc);

      _vApply(board, typeIdx, rot, x, drop_y);
      const boardWords = _vBoardToWords(board);

      // H_n = SHA-256(H_{n-1} || record)
      const rec56 = _vRecord(typeIdx, rot, x, drop_y, ms, boardWords);
      const prev  = new Uint8Array(H);
      const msg   = new Uint8Array(88);  // 32 + 56
      msg.set(prev, 0); msg.set(rec56, 32);
      H = await crypto.subtle.digest('SHA-256', msg);

      // Decade boundary: emit a Merkle-Root every 10 pieces
      decadeRecs.push(rec56);
      if (decadeRecs.length === 10) {
        const iHPS   = _vComputeHPS(decadeTms, decadeComplx, 5);
        const hpsU16 = iHPS === null ? 0 : Math.round(iHPS * 65535);
        const din    = new Uint8Array(32 + 560 + 2);
        din.set(prevDecadeHash, 0);
        let off = 32;
        for (const r of decadeRecs) { din.set(r, off); off += 56; }
        din[594] = (hpsU16 >> 8) & 0xFF; din[595] = hpsU16 & 0xFF;
        const dhBuf  = await crypto.subtle.digest('SHA-256', din);
        const dhBytes = new Uint8Array(dhBuf);
        prevDecadeHash = dhBytes;
        blockLedger.push({
          decade: blockLedger.length,
          startPiece: n - 9,
          endPiece:   n,
          hps:  iHPS,
          hash: Array.from(dhBytes).map(b=>b.toString(16).padStart(2,'0')).join('')
        });
        decadeRecs = []; decadeTms = []; decadeComplx = [];
      }
    }

    // Terminal compare: v3.0 = first 9 bytes as 12 chars; v2.0 = full 40.
    const computedB92 = isV3
      ? _vBytesToB92(new Uint8Array(H).slice(0, 9), 12)
      : _vBytesToB92(new Uint8Array(H), 40);
    const valid = computedB92 === termHashB92;
    const hps = _vComputeHPS(_hpTimings, _hpDPC);
    const hpsLabel = hps === null ? 'N/A' : hps >= 0.72 ? 'PASS' : hps >= 0.50 ? 'REVIEW' : 'FAIL';
    const npfRatio = nPieces > 0 ? Math.round(npfHits / nPieces * 100) / 100 : 0;
    const npfFlag  = npfRatio >= 0.05 ? 'NPF_SUSPECT' : null;
    return {
      valid,
      rulesEnum, scoringEnum, auxVars,
      piecesReplayed: nPieces,
      hps, hpsLabel,
      blockLedger,
      npfFlag, npfRatio, npfHits,
      error: valid ? null : `hash mismatch\n  computed: ${computedB92}\n  stream:   ${termHashB92}`
    };
  } catch(e) {
    return { valid: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
