/**
 * 3D CHATA NA MÝTINĚ – pohled z dronu (three.js)
 *
 * • Pozemek = obdélník louky v lese, terén vyplňuje celý panel (žádný „ostrůvek“).
 * • Světlo podle skutečné polohy slunce nad chatou (datum + čas), noc = svítí okna.
 * • Roční období: barva trávy a listnáčů, zima = sníh (podle skutečného počasí, jinak podle kalendáře).
 * • Tři pohledy: Z dronu (celý pozemek) · Podkroví · Přízemí – patra se „odříznou“ jako řez ve výkresu.
 *
 * Vlastní model: vyexportuj .glb (viz README) a do config.js dej  SCENA: { MODEL_URL: 'assets/3d/chata.glb' }.
 * Bez modelu se postaví náhradní chata z půdorysu.
 *
 * Náhled jiného času:  index.html?cas=2027-01-15T21:30   (+ &snih=1 / &snih=0)
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CFG = Object.assign({
  MODEL_URL: '',            // 'assets/3d/chata.glb'
  MODEL_OTOCENI: 0,         // otočení modelu ve stupních (kolem svislé osy)
  MODEL_MERITKO: 0,         // 0 = poznat samo (m / cm / mm), jinak číslo
  VYSKA_PODKROVI: 2.95,     // výška podlahy podkroví nad terénem (m)
  REZ: 1.25,                // výška řezu nad podlahou (m) – jako ve výkresu
  POZEMEK: [34, 22],        // šířka × hloubka pozemku (m)
  SEVER: 0,                 // kam je sever (stupně, 0 = nahoru v pohledu z dronu)
  GPS: [49.876, 13.897],    // kvůli slunci a počasí
  POCASI: true,             // sníh / oblačnost podle open-meteo.com (bez klíče)
}, (window.CHATA && window.CHATA.SCENA) || {});

const box = document.getElementById('scena');
if (box) {
  try { start(); } catch (e) { console.warn('3D scéna se nespustila:', e); }
}

function start() {
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) return;   // zůstane SVG záloha

  const plynule = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [PW, PH] = CFG.POZEMEK;
  const url = new URLSearchParams(location.search);

  /* ================= renderer, scéna, kamera ================= */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.localClippingEnabled = true;
  box.appendChild(renderer.domElement);

  const scena = new THREE.Scene();
  scena.fog = new THREE.Fog(0xcfdbe6, 70, 190);
  scena.background = new THREE.Color(0xcfdbe6);
  const kamera = new THREE.PerspectiveCamera(32, 1, 0.3, 500);

  const ovl = new OrbitControls(kamera, renderer.domElement);
  ovl.enablePan = false;
  ovl.enableZoom = false;                 // kolečko myši dál posouvá stránku
  ovl.rotateSpeed = 0.55;
  ovl.minPolarAngle = 0.05;
  ovl.maxPolarAngle = 1.12;               // nikdy nad obzor – terén vždy vyplní celý panel
  ovl.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
  renderer.domElement.style.touchAction = 'pan-y';

  /* ================= pomocné ================= */
  let sem = 11;
  const rnd = () => { sem = (sem * 16807) % 2147483647; return (sem - 1) / 2147483646; };
  const sum = (x, z) => Math.sin(x * 0.21 + 1.3) * Math.cos(z * 0.17 - 0.7) * 0.55 + Math.sin(x * 0.63 + z * 0.51) * 0.3 + Math.cos(z * 1.1 - x * 0.37) * 0.15;
  const C = (h) => new THREE.Color(h);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const vPozemku = (x, z, rez = 0) => Math.abs(x) < PW / 2 + rez && Math.abs(z) < PH / 2 + rez;

  // příjezdová cesta: z lesa (jih) k brance a dál ke chatě
  const BRANKA = new THREE.Vector2(-7, PH / 2);
  const cestaBody = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; cestaBody.push(new THREE.Vector2(-7 - Math.sin(t * 2.2) * 9 * t, PH / 2 + t * 70)); }
  const naCeste = (x, z, s = 2.0) => z > PH / 2 - 0.5 && cestaBody.some((p) => Math.hypot(p.x - x, p.y - z) < s);
  const pesinka = [];
  for (let i = 0; i <= 7; i++) { const t = i / 7; pesinka.push(new THREE.Vector2(-7 + t * 5.2 + Math.sin(t * 3) * 0.8, PH / 2 - 0.8 - t * 7.0)); }
  const naPesince = (x, z) => pesinka.some((p) => Math.hypot(p.x - x, p.y - z) < 0.7);

  /* ================= světla ================= */
  const nebe = new THREE.HemisphereLight(0xdfe9ff, 0x5d6b3a, 1);
  scena.add(nebe);
  const slunce = new THREE.DirectionalLight(0xffffff, 2.5);
  slunce.castShadow = true;
  slunce.shadow.mapSize.set(2048, 2048);
  Object.assign(slunce.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 160 });
  slunce.shadow.bias = -0.0005;
  slunce.shadow.normalBias = 0.03;
  scena.add(slunce, slunce.target);
  const mesic = new THREE.DirectionalLight(0x9fb4ff, 0);
  mesic.position.set(-30, 60, -20);
  scena.add(mesic);

  /* ================= terén ================= */
  const VEL = 360, SEG = 180;
  const teren = new THREE.PlaneGeometry(VEL, VEL, SEG, SEG);
  teren.rotateX(-Math.PI / 2);
  const tp = teren.attributes.position;
  const info = [];       // [šum, zóna] na vrchol: zóna 0 = les, 1 = louka, 2 = cesta, 3 = pěšinka
  const vyska = (x, z) => {
    const okraj = smooth(0, 14, Math.max(Math.abs(x) - PW / 2, Math.abs(z) - PH / 2));
    return sum(x, z) * (0.12 + okraj * 0.9) - (vPozemku(x, z, -0.0) ? 0 : 0) + okraj * 0.6;
  };
  const vyskaChata = (x, z) => (Math.abs(x) < 7 && Math.abs(z) < 4.5 ? 0 : vyska(x, z));
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    tp.setY(i, vyskaChata(x, z));
    const zona = naPesince(x, z) ? 3 : naCeste(x, z) ? 2 : vPozemku(x, z) ? 1 : 0;
    info.push(sum(x * 1.9, z * 1.9) + (rnd() - 0.5) * 0.35, zona);
  }
  teren.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(tp.count * 3), 3));
  teren.computeVertexNormals();
  const zeme = new THREE.Mesh(teren, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  zeme.receiveShadow = true;
  scena.add(zeme);

  /* ================= tráva na louce, kytky ================= */
  const o = new THREE.Object3D(), c = new THREE.Color();
  const travaG = new THREE.ConeGeometry(0.05, 0.38, 3); travaG.translate(0, 0.19, 0);
  const TRAVA = 9000;
  const trava = new THREE.InstancedMesh(travaG, new THREE.MeshStandardMaterial({ roughness: 1 }), TRAVA);
  const travaOdstin = [];
  for (let n = 0; n < TRAVA;) {
    const x = (rnd() - 0.5) * (PW + 1), z = (rnd() - 0.5) * (PH + 1);
    if ((Math.abs(x) < 6.8 && Math.abs(z) < 4.2) || naPesince(x, z)) continue;
    o.position.set(x, vyskaChata(x, z), z);
    o.rotation.set((rnd() - 0.5) * 0.5, rnd() * Math.PI, (rnd() - 0.5) * 0.5);
    const s = 0.6 + rnd() * 0.9; o.scale.set(s, s * (0.8 + rnd() * 0.7), s);
    o.updateMatrix(); trava.setMatrixAt(n, o.matrix);
    travaOdstin.push((rnd() - 0.5) * 0.22); n++;
  }
  trava.receiveShadow = true;
  scena.add(trava);

  const KYTKY = 520;
  const kytky = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.075, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), KYTKY);
  const pal = [0xffffff, 0xffe066, 0xc9a7ff, 0xffffff, 0xff9fb2];
  for (let n = 0; n < KYTKY;) {
    const x = (rnd() - 0.5) * PW, z = (rnd() - 0.5) * PH;
    if ((Math.abs(x) < 7 && Math.abs(z) < 4.6) || naPesince(x, z)) continue;
    o.position.set(x, vyskaChata(x, z) + 0.26 + rnd() * 0.12, z); o.rotation.set(0, 0, 0); o.scale.setScalar(0.7 + rnd() * 0.7);
    o.updateMatrix(); kytky.setMatrixAt(n, o.matrix); kytky.setColorAt(n, c.set(pal[n % pal.length])); n++;
  }
  scena.add(kytky);

  // kameny pěšinky
  const kameny = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.48, 0.12, 9), new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 0.95 }), pesinka.length);
  pesinka.forEach((p, i) => {
    o.position.set(p.x, vyskaChata(p.x, p.y) + 0.03, p.y); o.rotation.set(0, rnd() * 3, 0); o.scale.set(0.8 + rnd() * 0.4, 1, 0.7 + rnd() * 0.4);
    o.updateMatrix(); kameny.setMatrixAt(i, o.matrix);
  });
  kameny.receiveShadow = true;
  scena.add(kameny);

  /* ================= plot kolem pozemku ================= */
  const drevoPlot = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.9 });
  {
    const sloupky = [];
    const obvod = [[-PW / 2, -PH / 2], [PW / 2, -PH / 2], [PW / 2, PH / 2], [-PW / 2, PH / 2], [-PW / 2, -PH / 2]];
    const plot = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = obvod[i], [x2, z2] = obvod[i + 1];
      const d = Math.hypot(x2 - x1, z2 - z1), n = Math.round(d / 2.4);
      for (let k = 0; k <= n; k++) { const t = k / n; sloupky.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]); }
      for (const h of [0.45, 0.85]) {
        // dvě latě, na jižní straně mezera pro branku
        const useky = i === 2 ? [[x1, BRANKA.x + 1.4], [BRANKA.x - 1.4, x2]] : [[0, 1]];
        useky.forEach(([a, b]) => {
          let ax, az, bx, bz;
          if (i === 2) { ax = a; bx = b; az = bz = z1; } else { ax = x1 + (x2 - x1) * a; az = z1 + (z2 - z1) * a; bx = x1 + (x2 - x1) * b; bz = z1 + (z2 - z1) * b; }
          const L = Math.hypot(bx - ax, bz - az);
          const lat = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.04), drevoPlot);
          lat.position.set((ax + bx) / 2, vyska((ax + bx) / 2, (az + bz) / 2) + h, (az + bz) / 2);
          lat.rotation.y = -Math.atan2(bz - az, bx - ax);
          lat.castShadow = true; plot.add(lat);
        });
      }
    }
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), drevoPlot, sloupky.length);
    sloupky.forEach(([x, z], i) => { o.position.set(x, vyska(x, z) + 0.5, z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix(); sl.setMatrixAt(i, o.matrix); });
    sl.castShadow = true;
    plot.add(sl);
    scena.add(plot);
  }

  /* ================= les ================= */
  const jehlici = new THREE.MeshStandardMaterial({ color: 0x2f5a37, roughness: 0.95, flatShading: true });
  const kmenM = new THREE.MeshStandardMaterial({ color: 0x5e4129, roughness: 1 });
  const listi = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const smrkG = mergeGeometries([[1.35, 2.1, 1.4], [1.05, 1.8, 2.5], [0.7, 1.5, 3.5]].map(([r, h, y]) => { const g = new THREE.ConeGeometry(r, h, 7); g.translate(0, y, 0); return g; }));
  const kmenG = new THREE.CylinderGeometry(0.12, 0.2, 1.4, 6); kmenG.translate(0, 0.7, 0);
  const korunaG = new THREE.IcosahedronGeometry(1.5, 1); korunaG.translate(0, 3.6, 0);
  const kmenL = new THREE.CylinderGeometry(0.09, 0.16, 3.2, 6); kmenL.translate(0, 1.6, 0);
  const SMRKU = 1500, LISTNACU = 160;
  const smrky = new THREE.InstancedMesh(smrkG, jehlici, SMRKU);
  const kmeny = new THREE.InstancedMesh(kmenG, kmenM, SMRKU);
  const koruny = new THREE.InstancedMesh(korunaG, listi, LISTNACU);
  const kmenyL = new THREE.InstancedMesh(kmenL, new THREE.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.9 }), LISTNACU);   // břízy
  const volno = (x, z) => !vPozemku(x, z, 2.2) && !naCeste(x, z, 3.2);
  const odPozemku = (x, z) => Math.max(Math.abs(x) - PW / 2, Math.abs(z) - PH / 2);
  for (let n = 0, pokus = 0; n < SMRKU && pokus < 60000; pokus++) {
    const x = (rnd() - 0.5) * 170, z = (rnd() - 0.5) * 140;
    if (!volno(x, z)) continue;
    if (rnd() > 0.35 + 0.65 * smooth(2, 7, odPozemku(x, z))) continue;          // hustší les kousek od okraje mýtiny
    const s = 0.8 + rnd() * 0.75;
    o.position.set(x, vyska(x, z) - 0.05, z); o.rotation.set(0, rnd() * 6, 0); o.scale.set(s, s * (0.9 + rnd() * 0.35), s);
    o.updateMatrix(); smrky.setMatrixAt(n, o.matrix); kmeny.setMatrixAt(n, o.matrix);
    smrky.setColorAt(n, c.setHSL(0.36 + rnd() * 0.04, 0.3 + rnd() * 0.15, 0.68 + rnd() * 0.32)); n++;
  }
  for (let n = 0; n < LISTNACU;) {
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * (PW / 2 + 2.5 + rnd() * 14), z = Math.sin(a) * (PH / 2 + 2.5 + rnd() * 12);
    if (!volno(x, z)) continue;
    const s = 0.75 + rnd() * 0.5;
    o.position.set(x, vyska(x, z) - 0.05, z); o.rotation.set(0, rnd() * 6, 0); o.scale.set(s, s * (0.9 + rnd() * 0.3), s);
    o.updateMatrix(); koruny.setMatrixAt(n, o.matrix); kmenyL.setMatrixAt(n, o.matrix);
    koruny.setColorAt(n, c.setScalar(0.85 + rnd() * 0.3)); n++;
  }
  [smrky, kmeny, koruny, kmenyL].forEach((m) => { m.castShadow = true; scena.add(m); });

  /* ================= ohniště ================= */
  const ohen = new THREE.Group();
  {
    const kamen = new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: 1 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const k = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), kamen);
      k.position.set(Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75); k.scale.y = 0.7; k.castShadow = true; ohen.add(k);
    }
    const uhliky = new THREE.Mesh(new THREE.CircleGeometry(0.58, 14), new THREE.MeshStandardMaterial({ color: 0x2a2420, emissive: 0xff6a1a, emissiveIntensity: 0 }));
    uhliky.rotation.x = -Math.PI / 2; uhliky.position.y = 0.04; ohen.add(uhliky);
    ohen.userData.uhliky = uhliky;
    const svetlo = new THREE.PointLight(0xff8a3c, 0, 9, 1.6); svetlo.position.y = 0.6; ohen.add(svetlo);
    ohen.userData.svetlo = svetlo;
    ohen.position.set(9.5, 0, 5.5);
    ohen.position.y = vyska(9.5, 5.5);
    scena.add(ohen);
  }

  /* ================= chata ================= */
  const rezRovina = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000);   // vše nad výškou řezu se skryje
  const okna = [], strechy = [], strechaMeshe = [], interier = [];

  /** Materiál chaty: řez rovinou + vnitřek stěn v řezu černý (jako čára půdorysu). */
  function rezovat(mat) {
    if (mat.userData.rez) return mat;
    mat.userData.rez = true;
    mat.clippingPlanes = [rezRovina];
    mat.clipShadows = true;
    mat.side = THREE.DoubleSide;
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n if (!gl_FrontFacing) { gl_FragColor = vec4(0.06, 0.06, 0.06, 1.0); return; }');
    };
    mat.customProgramCacheKey = () => 'rez';
    return mat;
  }
  function pripravModel(koren) {
    koren.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        rezovat(mat);
        const jm = (mat.name + ' ' + m.name).toLowerCase();
        if (/okn|sklo|glass|window/.test(jm)) { okna.push(mat); mat.emissive = mat.emissive || new THREE.Color(); }
        if (/strech|roof|krytina/.test(jm)) { if (!strechy.includes(mat)) strechy.push(mat); mat.userData.barva = mat.userData.barva || mat.color.clone(); if (!strechaMeshe.includes(m)) strechaMeshe.push(m); }
      });
    });
  }

  let chata = postavNahradniChatu();
  scena.add(chata);
  pripravModel(chata);

  if (CFG.MODEL_URL) {
    new GLTFLoader().load(CFG.MODEL_URL, (gltf) => {
      const m = gltf.scene;
      const b = new THREE.Box3().setFromObject(m), v = b.getSize(new THREE.Vector3());
      const nejvic = Math.max(v.x, v.z);
      const k = CFG.MODEL_MERITKO || (nejvic > 400 ? 0.001 : nejvic > 40 ? 0.01 : 1);   // mm / cm / m
      m.scale.setScalar(k);
      m.rotation.y = THREE.MathUtils.degToRad(CFG.MODEL_OTOCENI);
      const b2 = new THREE.Box3().setFromObject(m), s = b2.getCenter(new THREE.Vector3());
      m.position.set(-s.x, -b2.min.y, -s.z);                                  // na střed pozemku, spodkem na terén
      okna.length = 0; strechy.length = 0; strechaMeshe.length = 0;
      scena.remove(chata); chata = new THREE.Group(); chata.add(m); scena.add(chata);
      pripravModel(chata);
      nastavRez(rezRovina.constant); nastavCas(); prekresli();
    }, undefined, (e) => console.warn('Model chaty se nenačetl, zůstává náhradní:', e));
  }

  function postavNahradniChatu() {
    const g = new THREE.Group();
    const K = 0.02, S = { x: 257.5, y: 140 };
    const m2 = (p) => new THREE.Vector2((p[0] - S.x) * K, (p[1] - S.y) * K);
    const TL = 0.3, SOKL = 0.15, H1 = CFG.VYSKA_PODKROVI - SOKL - 0.2, P2 = CFG.VYSKA_PODKROVI;
    const stena = new THREE.MeshStandardMaterial({ name: 'stena', color: 0xd7b38b, roughness: 0.85 });
    const vnitr = new THREE.MeshStandardMaterial({ name: 'vnitrni', color: 0xe9d3b4, roughness: 0.9 });
    const strecha = new THREE.MeshStandardMaterial({ name: 'strecha', color: 0x2d4f9c, roughness: 0.7 });
    const komin = new THREE.MeshStandardMaterial({ name: 'komin', color: 0x727a8a, roughness: 0.9 });
    const okno = new THREE.MeshStandardMaterial({ name: 'okno', color: 0x2a3340, roughness: 0.25, metalness: 0.2, emissive: 0xffb45e, emissiveIntensity: 0 });
    const sokl = new THREE.MeshStandardMaterial({ name: 'sokl', color: 0x9c9890, roughness: 1 });
    const podlaha = new THREE.MeshStandardMaterial({ name: 'podlaha', map: prkna(), roughness: 0.85 });

    const krabice = (w, h, d, mat, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y + h / 2, z); g.add(b); return b; };
    const zed = (body, y0, h, mat) => {
      for (let i = 0; i < body.length - 1; i++) {
        const a = m2(body[i]), b = m2(body[i + 1]);
        const s = new THREE.Mesh(new THREE.BoxGeometry(a.distanceTo(b) + TL, h, TL), mat);
        s.position.set((a.x + b.x) / 2, y0 + h / 2, (a.y + b.y) / 2);
        s.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
        g.add(s);
      }
    };
    const hlavni = [m2([7.5, 7.5]), m2([308, 272.5])], pristavek = [m2([308, 7.5]), m2([507.5, 172])];

    // sokl + podlahy
    [hlavni, pristavek].forEach(([a, b]) => {
      krabice(b.x - a.x + TL, SOKL, b.y - a.y + TL, sokl, (a.x + b.x) / 2, 0, (a.y + b.y) / 2);
      krabice(b.x - a.x - TL, 0.02, b.y - a.y - TL, podlaha, (a.x + b.x) / 2, SOKL, (a.y + b.y) / 2);
    });
    // PŘÍZEMÍ – stěny ze spodního půdorysu
    zed([[7.5, 7.5], [308, 7.5], [308, 272.5], [7.5, 272.5], [7.5, 7.5]], SOKL, H1, stena);
    zed([[308, 7.5], [507.5, 7.5], [507.5, 172], [308, 172]], SOKL, H1, stena);
    zed([[155, 7.5], [155, 54], [308, 54]], SOKL, H1, vnitr);
    zed([[370.5, 7.5], [370.5, 172]], SOKL, H1, vnitr);
    zed([[67, 272.5], [67, 226], [209, 226], [209, 272.5]], SOKL, 0.45, vnitr);        // lavice
    // vybavení přízemí: stůl, lavice, kamna
    const nabytek = new THREE.MeshStandardMaterial({ name: 'nabytek', color: 0xa8743f, roughness: 0.8 });
    krabice(1.8, 0.06, 0.85, nabytek, -2.0, SOKL + 0.72, 0.2);
    [-0.45, 0.85].forEach((dz) => krabice(1.8, 0.05, 0.32, nabytek, -2.0, SOKL + 0.42, 0.2 + dz));
    krabice(0.55, 0.85, 0.55, new THREE.MeshStandardMaterial({ name: 'kamna', color: 0x2b2b2e, roughness: 0.6 }), 0.3, SOKL, -0.7);
    // strop přízemí = podlaha podkroví (jen hlavní část)
    krabice(hlavni[1].x - hlavni[0].x + TL, 0.2, hlavni[1].y - hlavni[0].y + TL, vnitr, (hlavni[0].x + hlavni[1].x) / 2, P2 - 0.2, (hlavni[0].y + hlavni[1].y) / 2);
    krabice(hlavni[1].x - hlavni[0].x - TL, 0.02, hlavni[1].y - hlavni[0].y - TL, podlaha, (hlavni[0].x + hlavni[1].x) / 2, P2, (hlavni[0].y + hlavni[1].y) / 2);
    // PODKROVÍ – nadezdívka po stranách, štíty, příčky z horního půdorysu, spacáky
    zed([[7.5, 7.5], [308, 7.5]], P2, 0.5, stena);
    zed([[7.5, 272.5], [308, 272.5]], P2, 0.5, stena);
    zed([[155, 7.5], [155, 53], [308, 53]], P2, 1.0, vnitr);
    const spacaky = [0xef8733, 0x254eb9, 0x5f8a2e, 0xa72720, 0x254eb9];
    spacaky.forEach((b, i) => krabice(0.7, 0.16, 1.9, new THREE.MeshStandardMaterial({ name: 'spacak', color: b, roughness: 0.7 }), -4.1 + i * 0.95, P2, 1.0));

    // střecha hlavní části: sedlová, hřeben ve směru x, štíty
    const sedlo = ([a, b], y0, zvih, pres) => {
      const sirka = b.y - a.y + TL + pres * 2, delka = b.x - a.x + TL + pres * 2;
      const tvar = new THREE.Shape(); tvar.moveTo(-sirka / 2, 0); tvar.lineTo(sirka / 2, 0); tvar.lineTo(0, zvih); tvar.closePath();
      const tl = 0.16, geo = [];
      // dvě střešní desky
      [-1, 1].forEach((st) => {
        const L = Math.hypot(sirka / 2, zvih);
        const d = new THREE.Mesh(new THREE.BoxGeometry(delka, tl, L), strecha);
        d.rotation.x = st * Math.atan2(zvih, sirka / 2);
        d.position.set((a.x + b.x) / 2, y0 + zvih / 2 + tl / 2, (a.y + b.y) / 2 + st * sirka / 4);
        g.add(d);
      });
      // štíty (vnitřní trojúhelníky pod střechou)
      const stit = new THREE.Shape(); const ws = b.y - a.y + TL;
      stit.moveTo(-ws / 2, 0); stit.lineTo(ws / 2, 0); stit.lineTo(0, zvih * (ws / sirka)); stit.closePath();
      [a.x, b.x].forEach((x) => {
        const sg = new THREE.ExtrudeGeometry(stit, { depth: TL, bevelEnabled: false }); sg.translate(0, 0, -TL / 2); sg.rotateY(Math.PI / 2);
        const s = new THREE.Mesh(sg, stena); s.position.set(x, y0 + 0.02, (a.y + b.y) / 2); g.add(s);
      });
      return geo;
    };
    sedlo(hlavni, P2 + 0.5, 2.7, 0.45);
    sedlo(pristavek, SOKL + H1, 1.35, 0.35);
    krabice(0.5, 1.8, 0.5, komin, 0.3, P2 + 1.6, -0.7);

    // okna a dveře (svítí v noci)
    const oknoNa = (x, y, z, w, h, natoc) => { const b = krabice(natoc ? TL + 0.04 : w, h, natoc ? w : TL + 0.04, okno, x, y, z); return b; };
    oknoNa(-3.6, SOKL + 0.9, hlavni[1].y, 1.0, 1.1, false);
    oknoNa(-0.9, SOKL + 0.9, hlavni[1].y, 1.0, 1.1, false);
    oknoNa(-1.7, SOKL + 0.9, hlavni[0].y, 0.9, 1.1, false);
    oknoNa(hlavni[0].x, SOKL + 0.9, 0.4, 1.1, 1.1, true);
    oknoNa(hlavni[0].x, P2 + 0.7, 0.4, 0.8, 1.0, true);                    // okno ve štítu podkroví
    oknoNa(hlavni[1].x + 0, P2 + 0.7, 0.4, 0.8, 1.0, true);
    oknoNa(pristavek[1].x, SOKL + 0.9, -1.8, 0.9, 1.0, true);
    const dvere = new THREE.MeshStandardMaterial({ name: 'dvere', color: 0x6b4426, roughness: 0.8 });
    krabice(1.0, 2.0, TL + 0.05, dvere, 2.6, SOKL, pristavek[1].y);

    // teplé světlo uvnitř (v noci)
    [[-2, SOKL + 2.0, 0.3], [-1.5, P2 + 1.4, 0.6], [3.4, SOKL + 1.9, -1.8]].forEach(([x, y, z]) => {
      const s = new THREE.PointLight(0xffb066, 0, 7, 1.5); s.position.set(x, y, z); g.add(s); interier.push(s);
    });
    return g;
  }

  function prkna() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const x = cv.getContext('2d');
    for (let i = 0; i < 8; i++) {
      x.fillStyle = `hsl(31, ${42 + (i % 3) * 6}%, ${66 + ((i * 37) % 9)}%)`; x.fillRect(0, i * 32, 256, 32);
      x.fillStyle = 'rgba(80,50,20,.35)'; x.fillRect(0, i * 32, 256, 1.5);
      x.fillStyle = 'rgba(80,50,20,.25)'; x.fillRect(((i * 97) % 200) + 20, i * 32, 1.5, 32);
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ================= čas, roční období, počasí ================= */
  const pevnyCas = url.get('cas') ? new Date(url.get('cas')) : null;
  const pevnySnih = url.has('snih') ? url.get('snih') === '1' : null;
  const pocasi = { snih: null, mraky: 0 };
  const ted = () => (pevnyCas && !isNaN(pevnyCas) ? pevnyCas : new Date());

  /** Poloha slunce (NOAA) → výška a azimut (od severu po směru hodin), radiány. */
  function polohaSlunce(d, lat, lon) {
    const r = Math.PI / 180;
    const g = (2 * Math.PI / 365) * ((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5);
    const dek = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const ha = ((d.getUTCHours() * 60 + d.getUTCMinutes() + eqt + 4 * lon) / 4 - 180) * r;
    const f = lat * r;
    const vyska = Math.asin(Math.sin(f) * Math.sin(dek) + Math.cos(f) * Math.cos(dek) * Math.cos(ha));
    const azimut = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(f) - Math.tan(dek) * Math.cos(f)) + Math.PI;
    return { vyska, azimut };
  }
  const denVRoce = (d) => (d - new Date(d.getFullYear(), 0, 0)) / 864e5;
  const KLICE = (pole, den) => {     // lineární přechod mezi barvami podle dne v roce
    for (let i = 0; i < pole.length - 1; i++) {
      const [d1, c1] = pole[i], [d2, c2] = pole[i + 1];
      if (den >= d1 && den <= d2) return C(c1).lerp(C(c2), (den - d1) / (d2 - d1));
    }
    return C(pole[0][1]);
  };
  const LOUKA = [[0, 0x8e8b5e], [70, 0x8f9457], [110, 0x82b04a], [170, 0x79a644], [225, 0x8fa14b], [285, 0xa0995a], [330, 0x8f8a5d], [367, 0x8e8b5e]];
  const LES = [[0, 0x6e6a4a], [100, 0x6f7e45], [140, 0x5f8a3b], [230, 0x6a8a3d], [275, 0x8a7a40], [320, 0x6f6448], [367, 0x6e6a4a]];
  const LISTI = [[0, 0x9a8a66], [95, 0x9a8a66], [120, 0xa6cf62], [160, 0x6f9a3a], [250, 0x7c9a3a], [280, 0xe0962e], [305, 0xc0622a], [330, 0x9a8a66], [367, 0x9a8a66]];

  const NOC = C(0x0e1526), SOUMRAK = C(0xe9a77c), DEN = C(0xcfdbe6), SNIH = C(0xeef3f8);
  const stav = document.createElement('p');
  stav.className = 'scena__stav';
  box.appendChild(stav);

  function nastavCas() {
    const d = ted();
    const { vyska: e, azimut: az0 } = polohaSlunce(d, CFG.GPS[0], CFG.GPS[1]);
    const az = az0 - THREE.MathUtils.degToRad(CFG.SEVER);
    const sinE = Math.sin(e);
    const den = smooth(-0.1, 0.12, sinE);        // 0 noc … 1 den
    const nizko = 1 - smooth(0.05, 0.4, sinE);   // zlatá hodinka
    const mrak = pocasi.mraky;
    const dvr = denVRoce(d), mesicR = d.getMonth();
    const snih = pevnySnih ?? pocasi.snih ?? ((mesicR === 11 && d.getDate() >= 15) || mesicR <= 1);
    const sn = snih ? 1 : 0;

    // slunce
    const smer = new THREE.Vector3(Math.sin(az) * Math.cos(e), Math.max(sinE, 0.02), -Math.cos(az) * Math.cos(e)).normalize();
    slunce.position.copy(smer).multiplyScalar(80);
    slunce.intensity = 3.1 * smooth(-0.02, 0.2, sinE) * (1 - 0.6 * mrak);
    slunce.color.set(0xffffff).lerp(C(0xffa25a), nizko * 0.75);
    mesic.intensity = 0.55 * (1 - den);
    nebe.color.copy(NOC).lerp(C(0xdfe9ff), den).lerp(SOUMRAK, nizko * den * 0.35);
    nebe.groundColor.copy(C(0x101820)).lerp(sn ? C(0xb8c4d0) : C(0x5d6b3a), den);
    nebe.intensity = 0.55 + 0.75 * den + 0.35 * mrak * den;
    renderer.toneMappingExposure = 0.95 + 0.25 * (1 - den);
    const obloha = NOC.clone().lerp(DEN, den).lerp(SOUMRAK, nizko * den * 0.5);
    scena.fog.color.copy(obloha); scena.background.copy(obloha);

    // terén podle ročního období + sníh
    const louka = KLICE(LOUKA, dvr), les = KLICE(LES, dvr), barvy = teren.attributes.color;
    const cesta = C(0xa08c6c), bila = SNIH;
    for (let i = 0; i < tp.count; i++) {
      const n = info[i * 2], z = info[i * 2 + 1];
      if (z === 1) c.copy(louka).multiplyScalar(1 + n * 0.1);
      else if (z === 0) c.copy(les).multiplyScalar(0.92 + n * 0.12);
      else c.copy(cesta).multiplyScalar(1 + n * 0.08);
      if (sn) c.lerp(bila, z >= 2 ? 0.7 : 0.9 + n * 0.04);
      barvy.setXYZ(i, c.r, c.g, c.b);
    }
    barvy.needsUpdate = true;
    for (let i = 0; i < TRAVA; i++) trava.setColorAt(i, c.copy(louka).multiplyScalar(0.82 + travaOdstin[i]));
    trava.instanceColor.needsUpdate = true;
    trava.visible = !sn;
    kytky.visible = !sn && dvr > 105 && dvr < 250;
    jehlici.color.set(0x2f5a37).lerp(bila, sn * 0.42);
    const listnate = KLICE(LISTI, dvr);
    const holo = sn || dvr < 100 || dvr > 325;
    koruny.visible = !holo;
    listi.color.copy(listnate);
    strechy.forEach((m) => m.color.copy(m.userData.barva).lerp(bila, sn * 0.85));

    // noc: okna, světla uvnitř, ohniště (jen v létě)
    const tma = 1 - den;
    okna.forEach((m) => { m.emissive.set(0xffb45e); m.emissiveIntensity = tma * 2.2; });
    interier.forEach((s) => (s.intensity = tma * 6));
    const ohniste = !sn && dvr > 120 && dvr < 270 ? tma : 0;
    ohen.userData.uhliky.material.emissiveIntensity = ohniste * 2.5;
    ohen.userData.svetlo.intensity = ohniste * 9;

    // popisek
    const hod = d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: pevnyCas ? undefined : 'Europe/Prague' });
    const obdobi = sn ? 'sníh' : dvr < 80 || dvr > 355 ? 'zima' : dvr < 172 ? 'jaro' : dvr < 266 ? 'léto' : 'podzim';
    const doba = den < 0.15 ? 'noc' : nizko > 0.6 ? (d.getHours() < 12 ? 'svítání' : 'soumrak') : 'den';
    stav.textContent = `U chaty ${hod} · ${doba} · ${obdobi}`;
    prekresli();
  }

  if (CFG.POCASI && !pevnyCas) {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${CFG.GPS[0]}&longitude=${CFG.GPS[1]}&current=snow_depth,cloud_cover&timezone=Europe%2FPrague`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        pocasi.snih = (j.current?.snow_depth ?? 0) > 0.02;
        pocasi.mraky = Math.min(1, (j.current?.cloud_cover ?? 0) / 100);
        nastavCas();
      })
      .catch(() => {});   // bez počasí: sníh podle kalendáře
  }

  /* ================= pohledy ================= */
  const POHLEDY = {
    dron:     { cil: [0, 0, 0.5], phi: 0.5, theta: 0.18, sirka: PW * 1.08 },
    podkrovi: { cil: [-1.0, CFG.VYSKA_PODKROVI, 0.3], phi: 0.58, theta: 0.45, sirka: 13, rez: CFG.VYSKA_PODKROVI + CFG.REZ },
    prizemi:  { cil: [0.2, 0.3, -0.1], phi: 0.6, theta: 0.5, sirka: 13, rez: CFG.REZ + 0.15 },
  };
  let pohled = 'dron';
  const sfera = new THREE.Spherical();

  // vzdálenost tak, aby se „sirka“ vešla na šířku i výšku panelu
  function vzdalenost(p) {
    const vfov = THREE.MathUtils.degToRad(kamera.fov) / 2;
    const h = p.sirka / Math.tan(vfov) / 2 / Math.max(kamera.aspect, 0.01);
    const v = (p.sirka * 0.62) / Math.tan(vfov) / 2;
    return Math.max(h, v);
  }
  function stavKamery(p) { return { cil: new THREE.Vector3(...p.cil), r: vzdalenost(p), phi: p.phi, theta: p.theta }; }
  function pouzij(s) {
    ovl.target.copy(s.cil);
    sfera.set(s.r, s.phi, s.theta);
    kamera.position.setFromSpherical(sfera).add(s.cil);
    kamera.lookAt(s.cil);
  }

  /** Řez: vše nad výškou zmizí; střecha, kterou řez protíná, se schová celá (jinak by zakrývala patro). */
  function nastavRez(h) {
    rezRovina.constant = h;
    const b = new THREE.Box3();
    strechaMeshe.forEach((m) => { b.setFromObject(m); m.visible = !(b.max.y > h && b.min.y > h - 1.0); });   // přístavek s nižší střechou zůstane zakrytý
  }

  let let_ = null;   // probíhající přelet
  function prepni(nazev) {
    const p = POHLEDY[nazev]; if (!p) return;
    pohled = nazev;
    const odkud = { cil: ovl.target.clone(), ...(() => { const s = new THREE.Spherical().setFromVector3(kamera.position.clone().sub(ovl.target)); return { r: s.radius, phi: s.phi, theta: s.theta }; })() };
    const kam = stavKamery(p);
    // nejkratší cesta kolem dokola
    while (kam.theta - odkud.theta > Math.PI) kam.theta -= Math.PI * 2;
    while (kam.theta - odkud.theta < -Math.PI) kam.theta += Math.PI * 2;
    nastavRez(p.rez ?? 1000);
    if (!plynule) { pouzij(kam); prekresli(); return; }
    let_ = { odkud, kam, t0: performance.now(), T: 1100 };
    prekresli();
  }

  const tlacitka = box.querySelectorAll('[data-pohled]');
  tlacitka.forEach((b) => b.addEventListener('click', () => {
    tlacitka.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    box.querySelector('.prepinac').dataset.stav = b.dataset.pohled;
    prepni(b.dataset.pohled);
  }));

  /* ================= vykreslování na požádání ================= */
  const napoveda = document.getElementById('scenaNapoveda');
  let videt = false, bezi = false, tahani = false;
  ovl.addEventListener('start', () => { tahani = true; let_ = null; napoveda && napoveda.classList.add('scena__napoveda--pryc'); });
  ovl.addEventListener('end', () => { tahani = false; });
  ovl.addEventListener('change', prekresli);
  new IntersectionObserver(([z]) => { videt = z.isIntersecting; prekresli(); }, { threshold: 0.05 }).observe(box);
  document.addEventListener('visibilitychange', prekresli);

  function prekresli() { if (!bezi && videt && !document.hidden) { bezi = true; requestAnimationFrame(snimek); } }
  const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function snimek(t) {
    if (!videt || document.hidden) { bezi = false; return; }
    if (let_) {
      const k = eio(Math.min(1, (t - let_.t0) / let_.T)), a = let_.odkud, b = let_.kam;
      const zvedni = Math.sin(k * Math.PI) * 0.35 * (a.r + b.r) / 2;     // dron se při přeletu lehce zvedne
      pouzij({ cil: a.cil.clone().lerp(b.cil, k), r: a.r + (b.r - a.r) * k + zvedni, phi: a.phi + (b.phi - a.phi) * k, theta: a.theta + (b.theta - a.theta) * k });
      if (k >= 1) let_ = null;
    }
    ovl.update();
    renderer.render(scena, kamera);
    if (let_ || tahani) requestAnimationFrame(snimek); else bezi = false;
  }

  function velikost() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
    if (!let_) pouzij(stavKamery(POHLEDY[pohled]));
    prekresli();
  }
  new ResizeObserver(velikost).observe(box);
  velikost();
  nastavCas();
  setInterval(() => { if (!pevnyCas) nastavCas(); }, 60_000);   // světlo se posouvá se skutečným časem

  box.classList.add('scena--3d');
  window.CHATA_3D = { prepni, nastavCas };   // pro ladění v konzoli
}
