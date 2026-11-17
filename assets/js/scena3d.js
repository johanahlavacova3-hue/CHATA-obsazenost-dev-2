/**
 * 3D CHATA – architektonická maketa (three.js)
 *
 * Terén jako vrstvy kartonu podle vrstevnic, chata v čistých světlých hmotách, stromy jako pěnové koruny,
 * tmavé pozadí. Slunce podle skutečného času (stíny se otáčejí), v noci svítí okna a ohniště,
 * v zimě (podle skutečného počasí) jsou vrstvy bílé.
 * Pohledy Z dronu · Podkroví · Přízemí – patra se odříznou vodorovným řezem (řez černý).
 *
 * Data připraví nastroje/priprav-model.mjs: assets/3d/chata.glb + assets/3d/pozemek.json
 * Náhled jiného času:  index.html?cas=2027-01-15T21:30   (+ &snih=1 / &snih=0)
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const CFG = Object.assign({
  SLOZKA: 'assets/3d/',
  MODEL: 'chata.glb',
  PODKROVI_NAD_PODLAHOU: 2.45,   // výška podlahy podkroví nad podlahou přízemí (m)
  REZ: 1.25,                     // výška řezu nad podlahou (m)
  VRSTVA: 1.0,                   // tloušťka vrstvy terénu = rozestup vrstevnic (m)
  SEVER: 0,
  GPS: [49.876, 13.897],
  POCASI: true,
}, (window.CHATA && window.CHATA.SCENA) || {});

/* paleta makety */
const BARVY = {
  pozadi: 0x1c1b19,
  karton: 0xcdb48e,      // vrchy vrstev
  hrana: 0x2b241d,       // tenká tmavá hrana vrstvy
  bok: 0xa88e6a,         // bok vrstvy (lepenka)
  sokl: 0x3a3129,        // boky celé makety
  drevo: 0xd6b083,       // stěny chaty (balza)
  bila: 0xeeeae3,        // střecha, komín, základ
  osb: 0x4a3122,         // interiér – OSB natřená tmavě hnědou
  linka: 0x2a2826,       // okapy, rámy
  koruna: 0xd9cbb1,      // pěnové koruny stromů
  kmen: 0x8c7a62,
  voda: 0x5b7383,
  snih: 0xf6f5f2,
};

const box = document.getElementById('scena');
if (box) start().catch((e) => console.warn('3D scéna se nespustila:', e));

async function start() {
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) return;   // zůstane SVG záloha

  const plynule = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const url = new URLSearchParams(location.search);
  const slabe = (navigator.hardwareConcurrency || 4) <= 4 || matchMedia('(max-width: 700px)').matches;

  const stav = document.createElement('p');
  stav.className = 'scena__stav';
  stav.textContent = 'Načítám chatu…';
  box.appendChild(stav);

  /* ================= data ================= */
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  async function nactiModel() {
    if (CFG.MODEL.endsWith('.js')) {   // model zabalený do JS (hostingy, které .glb neservírují)
      const { default: b64 } = await import(new URL(CFG.SLOZKA + CFG.MODEL, location.href).href);
      const bin = atob(b64), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return loader.parseAsync(buf.buffer, '');
    }
    return loader.loadAsync(CFG.SLOZKA + CFG.MODEL, (e) => {
      if (e.total) stav.textContent = `Načítám chatu… ${Math.round((e.loaded / e.total) * 100)} %`;
    });
  }
  const [data, gltf] = await Promise.all([fetch(CFG.SLOZKA + 'pozemek.json').then((r) => r.json()), nactiModel()]);

  /* ================= renderer, scéna, kamera ================= */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, slabe ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.localClippingEnabled = true;
  box.appendChild(renderer.domElement);

  const scena = new THREE.Scene();
  scena.background = new THREE.Color(BARVY.pozadi);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // měkké „ateliérové“ světlo
  const kamera = new THREE.PerspectiveCamera(28, 1, 0.5, 2000);

  const ovl = new OrbitControls(kamera, renderer.domElement);
  ovl.enablePan = false;
  ovl.enableZoom = false;                 // kolečko myši dál posouvá stránku
  ovl.rotateSpeed = 0.5;
  ovl.minPolarAngle = 0.05;
  ovl.maxPolarAngle = 1.25;
  ovl.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
  renderer.domElement.style.touchAction = 'pan-y';

  /* ================= pomocné ================= */
  let sem = 11;
  const rnd = () => { sem = (sem * 16807) % 2147483647; return (sem - 1) / 2147483646; };
  const C = (h) => new THREE.Color(h);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mat = (barva, o = {}) => new THREE.MeshStandardMaterial({ color: barva, roughness: 0.9, metalness: 0, ...o });

  /* ================= terén: vrstvy podle vrstevnic ================= */
  const T = data.teren, CH = data.chata, S = CFG.VRSTVA;
  let H = Float32Array.from(T.vysky);
  for (let p = 0; p < 3; p++) {          // vyhlazení → plynulé vrstevnice
    const N = new Float32Array(H.length);
    for (let iz = 0; iz < T.nz; iz++) for (let ix = 0; ix < T.nx; ix++) {
      let s = 0, n = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x = ix + dx, z = iz + dz;
        if (x >= 0 && z >= 0 && x < T.nx && z < T.nz) { s += H[z * T.nx + x]; n++; }
      }
      N[iz * T.nx + ix] = s / n;
    }
    H = N;
  }
  const mapa = (x, z) => {
    const fx = Math.min(T.nx - 1.001, Math.max(0, (x - T.x0) / T.krok)), fz = Math.min(T.nz - 1.001, Math.max(0, (z - T.z0) / T.krok));
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, i = iz * T.nx + ix;
    return (H[i] * (1 - tx) + H[i + 1] * tx) * (1 - tz) + (H[i + T.nx] * (1 - tx) + H[i + T.nx + 1] * tx) * tz;
  };
  // vrstvy zarovnané tak, aby plošina pod chatou byla přesně jedna vrstva
  const stredChaty = new THREE.Vector3((CH.min[0] + CH.max[0]) / 2, CH.podlaha, (CH.min[2] + CH.max[2]) / 2);
  const O = Math.min(CH.min[1], mapa(stredChaty.x, stredChaty.z)) - 0.02;
  const vrstva = (h) => O + Math.floor((h - O) / S + 1e-6) * S;
  const vyskaQ = (x, z) => vrstva(mapa(x, z));

  const vrchy = [], boky = [], hrany = [];
  {
    const X = (i) => T.x0 + i * T.krok, Z = (i) => T.z0 + i * T.krok, h = (ix, iz) => H[iz * T.nx + ix];
    const hmin = Math.min(...H), DNO = vrstva(hmin) - 3;
    const pridejVrch = (body, y) => { for (let k = 1; k < body.length - 1; k++) vrchy.push(body[0][0], y, body[0][1], body[k + 1][0], y, body[k + 1][1], body[k][0], y, body[k][1]); };
    const quad = (pole, a, b, y0, y1) => pole.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
    const HRANA = Math.min(0.14, S * 0.18);
    const pridejBok = (a, b, y0, y1) => { quad(boky, a, b, y0, y1 - HRANA); quad(hrany, a, b, y1 - HRANA, y1); };
    for (let iz = 0; iz < T.nz - 1; iz++) for (let ix = 0; ix < T.nx - 1; ix++) {
      const r = [[X(ix), Z(iz), h(ix, iz)], [X(ix + 1), Z(iz), h(ix + 1, iz)], [X(ix + 1), Z(iz + 1), h(ix + 1, iz + 1)], [X(ix), Z(iz + 1), h(ix, iz + 1)]];
      const mn = Math.min(r[0][2], r[1][2], r[2][2], r[3][2]), mx = Math.max(r[0][2], r[1][2], r[2][2], r[3][2]);
      const L0 = vrstva(mn);
      pridejVrch(r.map((p) => [p[0], p[1]]), L0);                       // celá buňka na spodní vrstvě
      for (let L = L0 + S; L <= mx + 1e-6; L += S) {                     // části nad každou další vrstevnicí
        const poly = [], krizeni = [];
        for (let k = 0; k < 4; k++) {
          const a = r[k], b = r[(k + 1) % 4], ia = a[2] >= L, ib = b[2] >= L;
          if (ia) poly.push([a[0], a[1]]);
          if (ia !== ib) {
            const t = (L - a[2]) / (b[2] - a[2]), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
            poly.push(p); krizeni.push(p);
          }
        }
        if (poly.length >= 3) pridejVrch(poly, L);
        for (let k = 0; k + 1 < krizeni.length; k += 2) pridejBok(krizeni[k], krizeni[k + 1], L - S, L);
      }
    }
    // boky celé makety (sokl)
    const okraj = [];
    for (let i = 0; i < T.nx - 1; i++) okraj.push([[X(i), Z(0)], [X(i + 1), Z(0)], h(i, 0), h(i + 1, 0)], [[X(i), Z(T.nz - 1)], [X(i + 1), Z(T.nz - 1)], h(i, T.nz - 1), h(i + 1, T.nz - 1)]);
    for (let i = 0; i < T.nz - 1; i++) okraj.push([[X(0), Z(i)], [X(0), Z(i + 1)], h(0, i), h(0, i + 1)], [[X(T.nx - 1), Z(i)], [X(T.nx - 1), Z(i + 1)], h(T.nx - 1, i), h(T.nx - 1, i + 1)]);
    const sokl = [];
    okraj.forEach(([a, b, ha, hb]) => { const y = vrstva(Math.min(ha, hb)); sokl.push(a[0], DNO, a[1], b[0], DNO, b[1], b[0], y, b[1], a[0], DNO, a[1], b[0], y, b[1], a[0], y, a[1]); });
    var soklGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sokl, 3));
    soklGeo.computeVertexNormals();
  }
  const vrchGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vrchy, 3));
  vrchGeo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(vrchy.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const bokGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(boky, 3));
  bokGeo.computeVertexNormals();
  const hranaGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(hrany, 3));
  hranaGeo.computeVertexNormals();
  const kartonMat = mat(BARVY.karton, { roughness: 0.95 });
  const hranaMat = mat(BARVY.hrana, { side: THREE.DoubleSide, roughness: 1 });
  const bokMat = mat(BARVY.bok, { side: THREE.DoubleSide, roughness: 1 });
  const vrchMesh = new THREE.Mesh(vrchGeo, kartonMat);
  const bokMesh = new THREE.Mesh(bokGeo, bokMat);
  const hranaMesh = new THREE.Mesh(hranaGeo, hranaMat);
  scena.add(hranaMesh);
  const soklMesh = new THREE.Mesh(soklGeo, mat(BARVY.sokl, { side: THREE.DoubleSide }));
  vrchMesh.receiveShadow = bokMesh.receiveShadow = true;
  bokMesh.castShadow = true;
  scena.add(vrchMesh, bokMesh, soklMesh);

  /* ================= model ================= */
  const model = gltf.scene;
  scena.add(model);
  model.updateMatrixWorld(true);
  const rezRovina = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);
  const okna = [], strechaMeshe = [], snehoveMat = [];
  const chataBox = new THREE.Box3(new THREE.Vector3(...CH.min).addScalar(-0.6), new THREE.Vector3(...CH.max).addScalar(0.6));
  const kameny = new THREE.Box3(), vodniBox = new THREE.Box3(), pomocny = new THREE.Box3();

  // interiér: OSB tmavě hnědá na podlahách, vnitřních stěnách a stropech (podle polohy a normály)
  const OSB = {
    osbBarva: { value: C(BARVY.osb) },
    osbStred: { value: new THREE.Vector3(stredChaty.x, 0, stredChaty.z) },
    osbPul: { value: new THREE.Vector2((CH.max[0] - CH.min[0]) / 2, (CH.max[2] - CH.min[2]) / 2) },
    osbPodlahy: { value: new THREE.Vector2(CH.podlaha, CH.podlaha + CFG.PODKROVI_NAD_PODLAHOU) },
  };
  function rezovat(m, cerne, osb) {
    m.clippingPlanes = [rezRovina];
    m.clipShadows = true;
    m.side = THREE.DoubleSide;
    if (!cerne) return m;
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n if (!gl_FrontFacing) { gl_FragColor = vec4(0.04, 0.04, 0.04, 1.0); return; }');
      if (!osb) return;
      Object.assign(sh.uniforms, OSB);
      sh.vertexShader = 'varying vec3 vSvP;\nvarying vec3 vSvN;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n vSvP = (modelMatrix * vec4(transformed, 1.0)).xyz; vSvN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = 'uniform vec3 osbBarva;\nuniform vec3 osbStred;\nuniform vec2 osbPul;\nuniform vec2 osbPodlahy;\nvarying vec3 vSvP;\nvarying vec3 vSvN;\n' +
        sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          {
            vec3 n = normalize(vSvN);
            vec2 d = osbStred.xz - vSvP.xz;
            bool uvnitr = all(lessThan(abs(d), osbPul));
            bool podlaha = n.y > 0.7 && (abs(vSvP.y - osbPodlahy.x) < 0.35 || abs(vSvP.y - osbPodlahy.y) < 0.35);
            bool strop = n.y < -0.7 && vSvP.y > osbPodlahy.x + 1.2;
            bool stena = abs(n.y) < 0.3 && (dot(n.xz, d) > 0.0 || all(lessThan(abs(d), osbPul - 1.4)));
            if (uvnitr && (podlaha || strop || stena)) diffuseColor.rgb = osbBarva;
          }`);
    };
    m.customProgramCacheKey = () => (osb ? 'rez-osb' : 'rez');
    return m;
  }

  // materiály makety: jen čisté barvy, žádné fotografické textury
  const M = {
    drevo: rezovat(mat(BARVY.drevo, { roughness: 0.75 }), true, true),
    bila: rezovat(mat(BARVY.bila, { roughness: 0.8 }), false, false),
    strecha: rezovat(mat(BARVY.bila, { roughness: 0.85 }), false, false),
    linka: rezovat(mat(BARVY.linka, { roughness: 0.5 }), false, false),
    sklo: rezovat(mat(0xffe2b0, { emissive: 0xffb45e, emissiveIntensity: 0.5, roughness: 0.3 }), false, false),
    kamen: mat(BARVY.bila),
    lavice: mat(BARVY.drevo, { roughness: 0.75 }),
  };
  okna.push(M.sklo);
  snehoveMat.push(M.strecha);
  model.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    const jm = m.material.name.toLowerCase();
    pomocny.setFromObject(m);
    const vChate = chataBox.intersectsBox(pomocny);
    if (jm === 'voda') { m.visible = false; vodniBox.union(pomocny); return; }
    if (jm === 'kamen') { kameny.union(pomocny); m.material = M.kamen; }
    else if (/sklo/.test(jm)) { m.material = M.sklo; m.castShadow = false; }
    else if (/strecha/.test(jm)) { m.material = M.strecha; strechaMeshe.push(m); }
    else if (/okap/.test(jm)) m.material = M.linka;
    else if (/beton|komin/.test(jm)) m.material = M.bila;
    else if (/drevo/.test(jm)) m.material = vChate ? M.drevo : M.lavice;
    if (!vChate) {   // věci mimo chatu (ohniště, lavice) posadit na vrstvu terénu
      const c = pomocny.getCenter(new THREE.Vector3());
      m.position.y += (vyskaQ(c.x, c.z) - mapa(c.x, c.z)) / (m.parent ? m.parent.getWorldScale(new THREE.Vector3()).y : 1);
    }
  });

  /* ================= potok: hladina z plexiskla ================= */
  if (!vodniBox.isEmpty()) {
    const v = vodniBox.getSize(new THREE.Vector3()), s0 = vodniBox.getCenter(new THREE.Vector3());
    const x0 = Math.max(vodniBox.min.x, T.x0), x1 = Math.min(vodniBox.max.x, T.x0 + (T.nx - 1) * T.krok);
    const hl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, v.z), mat(BARVY.voda, { roughness: 0.55, transparent: true, opacity: 0.85 }));
    hl.rotation.x = -Math.PI / 2;
    hl.position.set((x0 + x1) / 2, vrstva(vodniBox.max.y - 0.35) + 0.25, s0.z);
    hl.receiveShadow = true;
    scena.add(hl);
  }

  /* ================= ohniště ================= */
  let ohniste = null;
  if (!kameny.isEmpty()) {
    const s = kameny.getCenter(new THREE.Vector3());
    const uhliky = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), mat(0x2a221c, { emissive: 0xff5a14, emissiveIntensity: 0 }));
    uhliky.rotation.x = -Math.PI / 2;
    const svetlo = new THREE.PointLight(0xff8a3c, 0, 16, 1.8);
    svetlo.position.y = 1;
    ohniste = new THREE.Group();
    ohniste.add(uhliky, svetlo);
    ohniste.position.set(s.x, vyskaQ(s.x, s.z) + 0.03, s.z);
    ohniste.userData = { uhliky, svetlo };
    scena.add(ohniste);
  }
  const interier = [[0, 1.9], [CFG.PODKROVI_NAD_PODLAHOU, 1.3]].map(([dy, hh]) => {
    const s = new THREE.PointLight(0xffb066, 0, 4.5, 2);
    s.position.set(stredChaty.x, CH.podlaha + dy + hh, stredChaty.z);
    scena.add(s);
    return s;
  });

  /* ================= stromy: pěnové koruny ================= */
  const korunaMat = mat(BARVY.koruna, { roughness: 1 });
  const kmenMat = mat(BARVY.kmen, { roughness: 1 });
  snehoveMat.push(korunaMat);
  {
    const koruny = [], kmeny = [];
    data.stromy.forEach(([x, z, r, y0, y1]) => {
      const zem = vyskaQ(x, z), ry = (y1 - y0) / 2, cy = y0 + ry;
      const k = new THREE.CylinderGeometry(r * 0.045, r * 0.07, cy - zem, 6);
      k.translate(x, zem + (cy - zem) / 2, z);
      kmeny.push(k);
      const shluk = 4 + Math.round(r * 0.8);              // koruna = shluk několika „pěnových“ koulí
      for (let i = 0; i < shluk; i++) {
        const g = mergeVertices(new THREE.IcosahedronGeometry(1, slabe ? 2 : 3).deleteAttribute('normal').deleteAttribute('uv')), p = g.attributes.position;
        const f1 = 2 + rnd() * 3, f2 = rnd() * 6;
        for (let j = 0; j < p.count; j++) {   // hrbolatá „pěna“
          const x = p.getX(j), y = p.getY(j), z = p.getZ(j);
          const s = 1 + 0.07 * Math.sin(x * 9 + f2) * Math.sin(y * 8 + f1) * Math.sin(z * 10) + 0.05 * Math.sin((x + y + z) * f1 * 3);
          p.setXYZ(j, x * s, y * s, z * s);
        }
        g.computeVertexNormals();
        const a = rnd() * Math.PI * 2, d = i === 0 ? 0 : r * (0.35 + rnd() * 0.3);
        const rr = r * (i === 0 ? 0.72 : 0.45 + rnd() * 0.2);
        g.scale(rr, rr * (ry / r) * 0.95, rr);
        g.translate(x + Math.cos(a) * d, cy + (rnd() - 0.4) * ry * 0.5, z + Math.sin(a) * d);
        koruny.push(g);
      }
    });
    const km = new THREE.Mesh(mergeGeometries(kmeny), kmenMat), ko = new THREE.Mesh(mergeGeometries(koruny), korunaMat);
    km.castShadow = ko.castShadow = ko.receiveShadow = true;
    scena.add(km, ko);
    var korunyMesh = ko;
  }

  /* ================= světla ================= */
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6b5b48, 0.35);
  const slunce = new THREE.DirectionalLight(0xffffff, 2.4);
  slunce.castShadow = true;
  slunce.shadow.mapSize.set(slabe ? 2048 : 4096, slabe ? 2048 : 4096);
  const SR = 70;
  Object.assign(slunce.shadow.camera, { left: -SR, right: SR, top: SR, bottom: -SR, near: 1, far: 500 });
  slunce.shadow.bias = -0.0004;
  slunce.shadow.normalBias = 0.05;
  scena.add(hemi, slunce, slunce.target);
  const vsechnyMat = new Set();
  scena.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach((m) => vsechnyMat.add(m)); });

  /* ================= čas, počasí ================= */
  const pevnyCas = url.get('cas') ? new Date(url.get('cas')) : null;
  const pevnySnih = url.has('snih') ? url.get('snih') === '1' : null;
  const pocasi = { snih: null };
  const ted = () => (pevnyCas && !isNaN(pevnyCas) ? pevnyCas : new Date());
  function polohaSlunce(d, lat, lon) {   // NOAA → výška a azimut (od severu po směru hodin), radiány
    const r = Math.PI / 180;
    const g = (2 * Math.PI / 365) * ((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5);
    const dek = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const ha = ((d.getUTCHours() * 60 + d.getUTCMinutes() + eqt + 4 * lon) / 4 - 180) * r;
    const f = lat * r;
    const vy = Math.asin(Math.sin(f) * Math.sin(dek) + Math.cos(f) * Math.cos(dek) * Math.cos(ha));
    const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(f) - Math.tan(dek) * Math.cos(f)) + Math.PI;
    return { vy, az };
  }

  function nastavCas() {
    const d = ted();
    const { vy: e, az: az0 } = polohaSlunce(d, CFG.GPS[0], CFG.GPS[1]);
    const az = az0 - THREE.MathUtils.degToRad(CFG.SEVER), sinE = Math.sin(e);
    const den = smooth(-0.1, 0.08, sinE), nizko = 1 - smooth(0.05, 0.35, sinE);
    const mes = d.getMonth();
    const sn = (pevnySnih ?? pocasi.snih ?? ((mes === 11 && d.getDate() >= 15) || mes <= 1)) ? 1 : 0;

    // slunce: ve dne skutečný směr, v noci „měsíc“ z druhé strany, slabě a do modra
    const vyska = den > 0.02 ? Math.max(sinE, 0.12) : 0.6;
    const az2 = den > 0.02 ? az : az + Math.PI;
    const smer = new THREE.Vector3(Math.sin(az2) * Math.cos(Math.asin(vyska)), vyska, -Math.cos(az2) * Math.cos(Math.asin(vyska)));
    slunce.position.copy(stredChaty).addScaledVector(smer, 250);
    slunce.target.position.copy(stredChaty);
    slunce.intensity = 0.35 + 2.3 * den;
    slunce.color.set(0x9fb2e0).lerp(C(0xfff3e4), den).lerp(C(0xffb070), nizko * den * 0.6);
    hemi.intensity = 0.12 + 0.3 * den;
    vsechnyMat.forEach((m) => (m.envMapIntensity = 0.12 + 0.88 * den));
    renderer.toneMappingExposure = 0.85 + 0.25 * (1 - den);

    kartonMat.color.set(sn ? BARVY.snih : BARVY.karton);
    snehoveMat.forEach((m) => m.color.set(sn ? BARVY.snih : m === korunaMat ? BARVY.koruna : BARVY.bila));
    korunyMesh.visible = true;

    const tma = 1 - den;
    M.sklo.emissiveIntensity = 0.5 + tma * 3;
    interier.forEach((s) => (s.intensity = tma * 8));
    if (ohniste) {
      const ohen = !sn ? tma : 0;
      ohniste.userData.uhliky.material.emissiveIntensity = ohen * 3;
      ohniste.userData.svetlo.intensity = ohen * 50;
    }

    const hod = d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: pevnyCas ? undefined : 'Europe/Prague' });
    const doba = den < 0.15 ? 'noc' : nizko > 0.6 ? (d.getHours() < 12 ? 'svítání' : 'soumrak') : 'den';
    stav.textContent = `U chaty ${hod} · ${doba}${sn ? ' · sníh' : ''}`;
    prekresli();
  }
  if (CFG.POCASI && !pevnyCas) {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${CFG.GPS[0]}&longitude=${CFG.GPS[1]}&current=snow_depth&timezone=Europe%2FPrague`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { pocasi.snih = (j.current?.snow_depth ?? 0) > 0.02; nastavCas(); })
      .catch(() => {});
  }

  /* ================= pohledy ================= */
  const P2 = CH.podlaha + CFG.PODKROVI_NAD_PODLAHOU;
  const sx = CH.max[0] - CH.min[0], sz = CH.max[2] - CH.min[2];
  const oh = ohniste ? ohniste.position : stredChaty;
  const POHLEDY = {
    dron:     { cil: [stredChaty.x * 0.62 + oh.x * 0.38, CH.podlaha - 1, stredChaty.z * 0.62 + oh.z * 0.38 + 6], phi: 0.82, theta: 0.62, sirka: 70 },
    podkrovi: { cil: [stredChaty.x, P2, stredChaty.z], phi: 0.72, theta: 0.62, sirka: Math.max(sx, sz) * 1.5, rez: P2 + CFG.REZ },
    prizemi:  { cil: [stredChaty.x, CH.podlaha, stredChaty.z], phi: 0.72, theta: 0.62, sirka: Math.max(sx, sz) * 1.5, rez: CH.podlaha + CFG.REZ },
  };
  let pohled = 'dron';
  const sfera = new THREE.Spherical();
  function vzdalenost(p) {
    const vfov = THREE.MathUtils.degToRad(kamera.fov) / 2;
    return Math.max(p.sirka / Math.tan(vfov) / 2 / Math.max(kamera.aspect, 0.01), (p.sirka * 0.6) / Math.tan(vfov) / 2);
  }
  const stavKamery = (p) => ({ cil: new THREE.Vector3(...p.cil), r: vzdalenost(p), phi: p.phi, theta: p.theta });
  function pouzij(s) {
    ovl.target.copy(s.cil);
    sfera.set(s.r, s.phi, s.theta);
    kamera.position.setFromSpherical(sfera).add(s.cil);
    kamera.lookAt(s.cil);
  }
  function nastavRez(h) {
    rezRovina.constant = h;
    const b = new THREE.Box3();
    strechaMeshe.forEach((m) => { b.setFromObject(m); m.visible = !(b.max.y > h && b.min.y > h - 1.0); });
  }
  let let_ = null;
  function prepni(nazev) {
    const p = POHLEDY[nazev]; if (!p) return;
    pohled = nazev;
    const s0 = new THREE.Spherical().setFromVector3(kamera.position.clone().sub(ovl.target));
    const odkud = { cil: ovl.target.clone(), r: s0.radius, phi: s0.phi, theta: s0.theta }, kam = stavKamery(p);
    while (kam.theta - odkud.theta > Math.PI) kam.theta -= Math.PI * 2;
    while (kam.theta - odkud.theta < -Math.PI) kam.theta += Math.PI * 2;
    nastavRez(p.rez ?? 1e5);
    if (!plynule) { pouzij(kam); prekresli(); return; }
    let_ = { odkud, kam, t0: performance.now(), T: 1200 };
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
  new IntersectionObserver(([z]) => { videt = z.isIntersecting; prekresli(); }, { threshold: 0.02 }).observe(box);
  document.addEventListener('visibilitychange', prekresli);
  function prekresli() { if (!bezi && videt && !document.hidden) { bezi = true; requestAnimationFrame(snimek); } }
  const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function snimek(t) {
    if (!videt || document.hidden) { bezi = false; return; }
    if (let_) {
      const k = eio(Math.min(1, (t - let_.t0) / let_.T)), a = let_.odkud, b = let_.kam;
      const zvedni = Math.sin(k * Math.PI) * 0.25 * (a.r + b.r) / 2;
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
  setInterval(() => { if (!pevnyCas) nastavCas(); }, 60_000);

  box.classList.add('scena--3d');
  window.CHATA_3D = { prepni, nastavCas, scena, kamera };
}
