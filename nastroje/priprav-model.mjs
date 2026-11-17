/**
 * Připraví model z Blenderu pro web:  node priprav-model.mjs <vstup.glb> [výstupní složka]
 *
 * 1. Terén (materiál „Material“) převede na výškovou mapu  → pozemek.json (+ textura trávy zvlášť)
 * 2. Stromy-koule (materiál „Material.002“) převede na seznam stromů → pozemek.json (web je vykreslí sám)
 * 3. Opraví materiály: normálové mapy DirectX → OpenGL, síla normál 1, sklo, střecha, kameny, lavice, voda
 * 4. Textury zmenší (1024 / 512 px) a převede na WebP, geometrii zkomprimuje (meshopt)
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, textureCompress, meshopt, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const VSTUP = process.argv[2];
const VYSTUP = process.argv[3] || '../assets/3d';
if (!VSTUP) { console.error('Použití: node priprav-model.mjs model.glb [složka]'); process.exit(1); }
fs.mkdirSync(VYSTUP, { recursive: true });

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(VSTUP);
const root = doc.getRoot();
const jm = (m) => (m ? m.getName() : '');

/* ---------- pomocné: světové pozice vrcholů uzlu ---------- */
function mul(m, v) {   // matice 4×4 sloupcově (glTF) × bod
  return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
}
function trojuhelniky(node) {
  const M = node.getWorldMatrix(), tri = [];
  for (const p of node.getMesh().listPrimitives()) {
    const pos = p.getAttribute('POSITION'), idx = p.getIndices();
    const v = (i) => mul(M, pos.getElement(i, []));
    const n = idx ? idx.getCount() : pos.getCount();
    for (let i = 0; i < n; i += 3) tri.push([v(idx ? idx.getScalar(i) : i), v(idx ? idx.getScalar(i + 1) : i + 1), v(idx ? idx.getScalar(i + 2) : i + 2)]);
  }
  return tri;
}
function obalka(node) {
  const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const t of trojuhelniky(node)) for (const v of t) for (let k = 0; k < 3; k++) { b.min[k] = Math.min(b.min[k], v[k]); b.max[k] = Math.max(b.max[k], v[k]); }
  return b;
}
const matUzlu = (n) => n.getMesh()?.listPrimitives().map((p) => jm(p.getMaterial())) || [];
const uzly = root.listNodes().filter((n) => n.getMesh());
const r2 = (x) => Math.round(x * 100) / 100;

/* ---------- 1. terén → výšková mapa ---------- */
const teren = uzly.filter((n) => matUzlu(n).includes('Material'));
const tri = teren.flatMap(trojuhelniky);
let b = { min: [Infinity, 0, Infinity], max: [-Infinity, 0, -Infinity] };
tri.forEach((t) => t.forEach((v) => { b.min[0] = Math.min(b.min[0], v[0]); b.max[0] = Math.max(b.max[0], v[0]); b.min[2] = Math.min(b.min[2], v[2]); b.max[2] = Math.max(b.max[2], v[2]); }));
const KROK = 1;
const nx = Math.floor((b.max[0] - b.min[0]) / KROK) + 1, nz = Math.floor((b.max[2] - b.min[2]) / KROK) + 1;
const vysky = new Array(nx * nz).fill(null);
for (const [a, c, d] of tri) {   // rasterizace trojúhelníků do mřížky (barycentricky)
  const x0 = Math.max(0, Math.floor((Math.min(a[0], c[0], d[0]) - b.min[0]) / KROK)), x1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], c[0], d[0]) - b.min[0]) / KROK));
  const z0 = Math.max(0, Math.floor((Math.min(a[2], c[2], d[2]) - b.min[2]) / KROK)), z1 = Math.min(nz - 1, Math.ceil((Math.max(a[2], c[2], d[2]) - b.min[2]) / KROK));
  const det = (c[2] - d[2]) * (a[0] - d[0]) + (d[0] - c[0]) * (a[2] - d[2]);
  if (Math.abs(det) < 1e-9) continue;
  for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
    const x = b.min[0] + ix * KROK, z = b.min[2] + iz * KROK;
    const l1 = ((c[2] - d[2]) * (x - d[0]) + (d[0] - c[0]) * (z - d[2])) / det;
    const l2 = ((d[2] - a[2]) * (x - d[0]) + (a[0] - d[0]) * (z - d[2])) / det;
    const l3 = 1 - l1 - l2;
    if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) {
      const y = l1 * a[1] + l2 * c[1] + l3 * d[1];
      const i = iz * nx + ix;
      vysky[i] = vysky[i] === null ? y : Math.max(vysky[i], y);
    }
  }
}
// díry (mimo trojúhelníky) doplnit od sousedů
for (let pruchod = 0; pruchod < 20 && vysky.includes(null); pruchod++) {
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const i = iz * nx + ix; if (vysky[i] !== null) continue;
    const s = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => vysky[(iz + dz) * nx + ix + dx]).filter((v, k) => v != null);
    if (s.length) vysky[i] = s.reduce((p, q) => p + q, 0) / s.length;
  }
}

/* ---------- 2. stromy ---------- */
const stromy = uzly.filter((n) => matUzlu(n).includes('Material.002')).map((n) => {
  const o = obalka(n);
  return [r2((o.min[0] + o.max[0]) / 2), r2((o.min[2] + o.max[2]) / 2), r2((o.max[0] - o.min[0] + o.max[2] - o.min[2]) / 4), r2(o.min[1]), r2(o.max[1])];
});

/* ---------- textura trávy terénu zvlášť ---------- */
const travaTex = teren.flatMap((n) => n.getMesh().listPrimitives()).map((p) => p.getMaterial()?.getBaseColorTexture()).find(Boolean);
if (travaTex) await sharp(Buffer.from(travaTex.getImage())).resize(1024, 1024).webp({ quality: 82 }).toFile(path.join(VYSTUP, 'trava.webp'));

// pryč: terén, koule stromů, drobná tráva z knihovny
for (const n of uzly) {
  const m = matUzlu(n);
  if (m.includes('Material') || m.includes('Material.002') || m.includes('grass_medium_01')) n.dispose();
}

/* ---------- 2b. dvojitá chata: nechat jen tu, která stojí na terénu ---------- */
const vyskaTerenu = (x, z) => {
  const ix = Math.min(nx - 1, Math.max(0, Math.round((x - b.min[0]) / KROK))), iz = Math.min(nz - 1, Math.max(0, Math.round((z - b.min[2]) / KROK)));
  return vysky[iz * nx + ix] ?? 0;
};
{
  // každá kopie = kolekce (prázdný uzel s dětmi) nebo volně ležící objekty; rozhoduje, čí střecha to je
  const nahoru = (n) => { let p = n; while (p.getParentNode && p.getParentNode()) p = p.getParentNode(); return p; };
  const potomci = (n) => { const o = []; n.traverse((x) => o.push(x)); return o; };
  const volne = root.listScenes()[0].listChildren();
  const strechy = root.listNodes().filter((n) => n.getMesh() && matUzlu(n).includes('strecha 1'));
  const kopie = [];
  for (const s of strechy) {
    const anc = nahoru(s);
    if (kopie.some((k) => k.anc === anc)) continue;
    kopie.push({ anc, kolekce: anc !== s && !anc.getMesh() });
  }
  if (kopie.length > 1) {
    const vKolekci = new Set(kopie.filter((k) => k.kolekce).flatMap((k) => potomci(k.anc)));
    for (const k of kopie) {
      k.u = k.kolekce ? potomci(k.anc).filter((n) => n.getMesh())
        : volne.filter((n) => !vKolekci.has(n)).flatMap(potomci).filter((n) => n.getMesh() && matUzlu(n).some((m) => /magahon|strecha|beton|komin|okap|SKLO/.test(m)) && obalka(n).max[0] - obalka(n).min[0] < 30);
      const o = k.u.map(obalka);
      k.spodek = Math.min(...o.map((x) => x.min[1]));
      const cx = (Math.min(...o.map((x) => x.min[0])) + Math.max(...o.map((x) => x.max[0]))) / 2, cz = (Math.min(...o.map((x) => x.min[2])) + Math.max(...o.map((x) => x.max[2]))) / 2;
      k.chyba = Math.abs(k.spodek - vyskaTerenu(cx, cz));
      if (process.env.LADIT) console.log(' kopie', k.anc.getName(), 'objektů', k.u.length, 'spodek', r2(k.spodek), 'terén', r2(vyskaTerenu(cx, cz)));
    }
    kopie.sort((x, y) => x.chyba - y.chyba);
    kopie.slice(1).forEach((k) => k.u.forEach((n) => n.dispose()));
    console.log(`chata je v souboru ${kopie.length}×, nechávám „${kopie[0].anc.getName()}“ (stojí na terénu, odchylka ${kopie[0].chyba.toFixed(2)} m)`);
  }
}

/* ---------- 3. materiály ---------- */
const mat = Object.fromEntries(root.listMaterials().map((m) => [jm(m), m]));
// normálové mapy DirectX → OpenGL (otočit zelený kanál)
for (const t of root.listTextures()) {
  if (!/NormalDX/i.test(t.getName())) continue;
  const { data, info } = await sharp(Buffer.from(t.getImage())).raw().toBuffer({ resolveWithObject: true });
  for (let i = 1; i < data.length; i += info.channels) data[i] = 255 - data[i];
  t.setImage(await sharp(data, { raw: info }).png().toBuffer()).setMimeType('image/png').setName(t.getName().replace(/NormalDX/i, 'NormalGL'));
}
// barvy podle fotek skutečné chaty: smrková prkna v medové lazuře, antracitový plech
async function prebarvi(tex, cil, mix = 0.75) {
  const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0; const n = data.length / 3;
  for (let i = 0; i < data.length; i += 3) sum += 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
  const L = sum / n, prumer = [0, 1, 2].map((k) => { let s = 0; for (let i = k; i < data.length; i += 3) s += data[i]; return s / n; });
  for (let i = 0; i < data.length; i += 3) {
    const l = (0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]) / L;
    for (let k = 0; k < 3; k++) data[i + k] = Math.min(255, mix * l * cil[k] + (1 - mix) * data[i + k] * (cil[k] / prumer[k]));
  }
  tex.setImage(await sharp(data, { raw: info }).jpeg({ quality: 92 }).toBuffer()).setMimeType('image/jpeg');
}
const DREVO = { 'magahon - 1': [150, 100, 60], 'magahon - 2': [126, 82, 48], 'magahon - 3': [142, 94, 56] };
const hotove = new Set();
for (const [jmeno, cil] of Object.entries(DREVO)) {
  const t = mat[jmeno]?.getBaseColorTexture();
  if (t && !hotove.has(t)) { await prebarvi(t, cil); hotove.add(t); }
}
if (mat['strecha 1']) {   // plechová krytina: jednolitá antracitová, profil zůstává v normálové mapě
  mat['strecha 1'].setBaseColorTexture(null).setMetallicRoughnessTexture(null).setBaseColorFactor([0.052, 0.058, 0.066, 1]);
}
if (mat['komin 1']) mat['komin 1'].setBaseColorTexture(null).setBaseColorFactor([0.1, 0.105, 0.11, 1]);

for (const m of root.listMaterials()) {
  if (m.getNormalTexture()) m.setNormalScale(1);
  m.setDoubleSided(true);   // tenké plochy (střecha, sklo) musí být vidět z obou stran
}
if (mat['strecha 1']) {
  const s = mat['strecha 1'];
  ['KHR_materials_specular', 'KHR_materials_anisotropy', 'KHR_materials_ior'].forEach((e) => s.setExtension(e, null));
  s.setMetallicFactor(0.55).setRoughnessFactor(0.42).setNormalScale(0.7).setName('strecha');
}
if (mat['SKLO']) mat['SKLO'].setBaseColorFactor([0.1, 0.13, 0.15, 0.4]).setAlphaMode('BLEND').setMetallicFactor(0).setRoughnessFactor(0.04).setDoubleSided(true).setName('sklo');
if (mat['okap 1']) mat['okap 1'].setBaseColorFactor([0.2, 0.2, 0.21, 1]).setMetallicFactor(0.9).setRoughnessFactor(0.4).setName('okap');
if (mat['Material.001']) mat['Material.001'].setName('voda').setDoubleSided(true);
// kameny ohniště: beton + šedý odstín; lavice: dřevo
const beton = mat['beton 1'];
if (mat['Material.003'] && beton) {
  const k = beton.clone().setName('kamen').setBaseColorFactor([0.62, 0.6, 0.57, 1]);
  for (const p of root.listMeshes().flatMap((x) => x.listPrimitives())) if (p.getMaterial() === mat['Material.003']) p.setMaterial(k);
}
if (mat['Material.005'] && mat['magahon - 1']) {
  for (const p of root.listMeshes().flatMap((x) => x.listPrimitives())) if (p.getMaterial() === mat['Material.005']) p.setMaterial(mat['magahon - 1']);
}
for (const [a, bb] of [['magahon - 1', 'drevo-1'], ['magahon - 2', 'drevo-2'], ['magahon - 3', 'drevo-3'], ['beton 1', 'beton'], ['komin 1', 'komin']]) if (mat[a]) mat[a].setName(bb);

// krytina o kousek výš, aby krokve nevyčuhovaly nad plech
for (const n of root.listNodes().filter((n) => n.getMesh() && matUzlu(n).includes('strecha'))) {
  const W = n.getParentNode()?.getWorldMatrix() || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  const sy = Math.hypot(W[4], W[5], W[6]) || 1;
  const t = n.getTranslation();
  n.setTranslation([t[0], t[1] + 0.12 / sy, t[2]]);
}

await doc.transform(prune(), dedup());

/* ---------- údaje o chatě (pro kameru a řez) ---------- */
const chataUzly = root.listNodes().filter((n) => n.getMesh() && matUzlu(n).some((x) => /drevo|strecha|beton|komin|okap|sklo/.test(x)));
// půdorys chaty = obrys střechy (+1 m); co leží mimo, k chatě nepatří (ohniště, lavice)
const st = { min: [Infinity, 0, Infinity], max: [-Infinity, 0, -Infinity] };
for (const n of chataUzly.filter((n) => matUzlu(n).includes('strecha'))) { const o = obalka(n); st.min[0] = Math.min(st.min[0], o.min[0]); st.min[2] = Math.min(st.min[2], o.min[2]); st.max[0] = Math.max(st.max[0], o.max[0]); st.max[2] = Math.max(st.max[2], o.max[2]); }
const ch = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
let podlaha = -Infinity;
for (const n of chataUzly) {
  const o = obalka(n);
  if (o.min[0] > st.max[0] + 1 || o.max[0] < st.min[0] - 1 || o.min[2] > st.max[2] + 1 || o.max[2] < st.min[2] - 1) continue;
  for (let k = 0; k < 3; k++) { ch.min[k] = Math.min(ch.min[k], o.min[k]); ch.max[k] = Math.max(ch.max[k], o.max[k]); }
  if (matUzlu(n).includes('beton')) podlaha = Math.max(podlaha, o.max[1]);
}

/* ---------- 4. textury + komprese ---------- */
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], slots: /metallicRoughness/, quality: 80 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], slots: /normal/, quality: 90 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
  weld(), resample(), prune(), dedup(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(path.join(VYSTUP, 'chata.glb'), doc);

const info = {
  teren: { x0: r2(b.min[0]), z0: r2(b.min[2]), krok: KROK, nx, nz, vysky: vysky.map((v) => r2(v ?? 0)) },
  stromy,
  chata: { min: ch.min.map(r2), max: ch.max.map(r2), podlaha: r2(podlaha) },
};
fs.writeFileSync(path.join(VYSTUP, 'pozemek.json'), JSON.stringify(info));
const kb = (f) => Math.round(fs.statSync(path.join(VYSTUP, f)).size / 1024) + ' kB';
console.log('chata.glb', kb('chata.glb'), '| pozemek.json', kb('pozemek.json'), '| trava.webp', fs.existsSync(path.join(VYSTUP, 'trava.webp')) ? kb('trava.webp') : '-');
console.log('terén', nx, '×', nz, 'stromů', stromy.length, 'chata', JSON.stringify(info.chata));
