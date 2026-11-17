/**
 * 3D CHATA – skutečný pozemek z modelu (three.js)
 *
 * Data (připraví nastroje/priprav-model.mjs z exportu z Blenderu):
 *   assets/3d/chata.glb      chata, ohniště, lavice, potok (materiály opravené, textury WebP, meshopt)
 *   assets/3d/pozemek.json   výšková mapa terénu + polohy stromů + rozměry chaty
 *   assets/3d/louka-*.webp   textury louky z fotek (nastroje/textura-louky.py)
 *
 * • Pohled z dronu, terén vyplňuje celý panel (kolem pozemku se dopočítá les).
 * • Fyzikální obloha a slunce podle skutečného času nad chatou, odrazy oblohy na plechu, skle a vodě.
 * • Roční období (tráva, listí, sníh – podle skutečného počasí), v noci svítí okna a ohniště.
 * • Pohledy Z dronu · Podkroví · Přízemí – patra se odříznou vodorovným řezem (stěny v řezu černé).
 *
 * Náhled jiného času:  index.html?cas=2027-01-15T21:30   (+ &snih=1 / &snih=0)
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CFG = Object.assign({
  SLOZKA: 'assets/3d/',
  MODEL: 'chata.glb',
  PODKROVI_NAD_PODLAHOU: 2.45,   // výška podlahy podkroví nad podlahou přízemí (m)
  REZ: 1.25,                     // výška řezu nad podlahou (m)
  SEVER: 0,                      // otočení světových stran vůči modelu (stupně)
  GPS: [49.876, 13.897],
  POCASI: true,
}, (window.CHATA && window.CHATA.SCENA) || {});

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
  const [data, gltf, travaTex, jaroTex, vodaTex] = await Promise.all([
    fetch(CFG.SLOZKA + 'pozemek.json').then((r) => r.json()),
    nactiModel(),
    new THREE.TextureLoader().loadAsync(CFG.SLOZKA + 'louka-leto.webp'),    // z fotek louky v létě (suchá)
    new THREE.TextureLoader().loadAsync(CFG.SLOZKA + 'louka-jaro.webp'),    // z fotek louky na jaře (zelená)
    new THREE.TextureLoader().loadAsync(CFG.SLOZKA + 'voda-normal.webp'),
  ]);

  /* ================= renderer, scéna, kamera ================= */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, slabe ? 1.25 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.localClippingEnabled = true;
  box.appendChild(renderer.domElement);

  const scena = new THREE.Scene();
  scena.fog = new THREE.Fog(0xcfdbe6, 160, 420);
  const kamera = new THREE.PerspectiveCamera(30, 1, 0.5, 3000);

  const ovl = new OrbitControls(kamera, renderer.domElement);
  ovl.enablePan = false;
  ovl.enableZoom = false;                 // kolečko myši dál posouvá stránku
  ovl.rotateSpeed = 0.5;
  ovl.minPolarAngle = 0.05;
  ovl.maxPolarAngle = 1.15;
  ovl.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
  renderer.domElement.style.touchAction = 'pan-y';

  /* ================= pomocné ================= */
  let sem = 11;
  const rnd = () => { sem = (sem * 16807) % 2147483647; return (sem - 1) / 2147483646; };
  const sum = (x, z) => Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 - 0.7) * 0.55 + Math.sin(x * 0.37 + z * 0.29) * 0.3 + Math.cos(z * 0.83 - x * 0.31) * 0.15;
  const C = (h) => new THREE.Color(h);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const o = new THREE.Object3D(), c = new THREE.Color();

  /* ================= terén z výškové mapy ================= */
  const T = data.teren;
  const X1 = T.x0 + (T.nx - 1) * T.krok, Z1 = T.z0 + (T.nz - 1) * T.krok;
  // lehké vyhlazení hrubého modelu (2× průměr 3×3)
  let H = Float32Array.from(T.vysky);
  for (let p = 0; p < 2; p++) {
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
  const venku = (x, z) => Math.max(T.x0 - x, x - X1, T.z0 - z, z - Z1, 0);    // vzdálenost za hranou pozemku
  const vyska = (x, z) => { const v = venku(x, z); return mapa(x, z) + smooth(0, 60, v) * 9 + sum(x, z) * (0.25 + smooth(0, 20, v) * 2.2); };

  const OKRAJ = 150, KROK = slabe ? 2.5 : 1.6;
  const tw = X1 - T.x0 + OKRAJ * 2, td = Z1 - T.z0 + OKRAJ * 2;
  const tg = new THREE.PlaneGeometry(tw, td, Math.round(tw / KROK), Math.round(td / KROK));
  tg.rotateX(-Math.PI / 2);
  tg.translate((T.x0 + X1) / 2, 0, (T.z0 + Z1) / 2);
  const tp = tg.attributes.position, uv = tg.attributes.uv, sumy = new Float32Array(tp.count), zony = new Float32Array(tp.count);
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    tp.setY(i, vyska(x, z));
    uv.setXY(i, x / 2.6, z / 2.6);                         // dlaždice trávy 2,6 m
    sumy[i] = sum(x * 2.3, z * 2.3) * 0.45 + sum(x * 0.5 + 9, z * 0.5) * 0.35 + sum(x * 6.1, z * 5.3) * 0.2;
    zony[i] = smooth(0, 8, venku(x, z));                    // 0 = louka, 1 = les
  }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(tp.count * 3), 3));
  tg.computeVertexNormals();
  travaTex.wrapS = travaTex.wrapT = THREE.RepeatWrapping;
  travaTex.colorSpace = THREE.SRGBColorSpace;
  travaTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  jaroTex.wrapS = jaroTex.wrapT = THREE.RepeatWrapping;
  jaroTex.colorSpace = THREE.SRGBColorSpace;
  jaroTex.anisotropy = travaTex.anisotropy;
  const terenMat = new THREE.MeshStandardMaterial({ map: travaTex, vertexColors: true, roughness: 1 });
  const zelen = { value: 0.5 };   // 0 = suchá letní louka, 1 = zelená jarní
  // dvě skutečné textury (suchá / zelená) míchané ve skvrnách + druhé čtení ve velkém měřítku proti opakování
  terenMat.onBeforeCompile = (sh) => {
    sh.uniforms.jaro = { value: jaroTex };
    sh.uniforms.zelen = zelen;
    sh.fragmentShader = 'uniform sampler2D jaro;\nuniform float zelen;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec2 uvB = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.37 + 0.31;
        vec4 suche = mix(texture2D( map, vMapUv ), texture2D( map, uvB ), 0.4);
        vec4 zelene = mix(texture2D( jaro, vMapUv * 0.93 + 0.5 ), texture2D( jaro, uvB * 1.1 ), 0.4);
        vec2 uvC = mat2(0.6, 0.8, -0.8, 0.6) * vMapUv * 0.028;
        float skvrny = texture2D( jaro, uvC ).g / max(0.15, dot(texture2D( jaro, uvC ).rgb, vec3(0.333)));
        float sk2 = texture2D( map, vMapUv * 0.061 + 0.2 ).r;
        float m = smoothstep(0.15, 0.85, zelen + (skvrny - 1.1) * 1.4 + (sk2 - 0.55) * 0.8);
        diffuseColor *= mix(suche, zelene, m) * (0.85 + 0.3 * sk2);
      #endif`);
  };
  const teren = new THREE.Mesh(tg, terenMat);
  teren.receiveShadow = true;
  scena.add(teren);

  /* ================= model: chata, ohniště, potok ================= */
  const model = gltf.scene;
  scena.add(model);
  const CH = data.chata;
  const stred = new THREE.Vector3((CH.min[0] + CH.max[0]) / 2, CH.podlaha, (CH.min[2] + CH.max[2]) / 2);
  const rezRovina = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);
  const okna = [], strechy = [], strechaMeshe = [], chataBox = new THREE.Box3(new THREE.Vector3(...CH.min).addScalar(-0.6), new THREE.Vector3(...CH.max).addScalar(0.6));
  let ohniste = null;
  const vodniBox = new THREE.Box3();
  const kameny = new THREE.Box3();

  /* OSB deska natřená tmavě hnědou – podlahy, stěny a stropy uvnitř chaty */
  const osbTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const g = cv.getContext('2d');
    g.fillStyle = '#4a3020'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {      // třísky
      const x = rnd() * 512, y = rnd() * 512, w = 4 + rnd() * 9, h = 18 + rnd() * 46, l = 17 + rnd() * 11;
      g.save(); g.translate(x, y); g.rotate((rnd() - 0.5) * 1.2 + (i % 2 ? 0 : 1.57));
      g.fillStyle = `hsl(${22 + rnd() * 8}, ${38 + rnd() * 12}%, ${l}%)`;
      g.fillRect(-w / 2, -h / 2, w, h);
      for (const dx of [-512, 512]) { g.translate(dx, 0); g.fillRect(-w / 2, -h / 2, w, h); g.translate(-dx, 0); }
      g.restore();
    }
    g.fillStyle = 'rgba(58,36,22,0.45)'; g.fillRect(0, 0, 512, 512);   // nátěr sjednotí odstín
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  })();
  const OSB = {
    osb: { value: osbTex },
    osbStred: { value: new THREE.Vector3((CH.min[0] + CH.max[0]) / 2, 0, (CH.min[2] + CH.max[2]) / 2) },
    osbPul: { value: new THREE.Vector2((CH.max[0] - CH.min[0]) / 2, (CH.max[2] - CH.min[2]) / 2) },
    osbPodlahy: { value: new THREE.Vector2(CH.podlaha, CH.podlaha + CFG.PODKROVI_NAD_PODLAHOU) },
  };

  function rezovat(mat, cerne = true) {   // řez rovinou; vnitřek stěn v řezu černý jako čára v půdorysu
    if (mat.userData.rez) return;
    mat.userData.rez = true;
    mat.clippingPlanes = [rezRovina];
    mat.clipShadows = true;
    mat.side = THREE.DoubleSide;
    if (!cerne) return;                   // tenké plochy (plech, sklo, okapy) – rub normálně
    const osb = /drevo/.test(mat.name);
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n if (!gl_FrontFacing) { gl_FragColor = vec4(0.05, 0.05, 0.05, 1.0); return; }');
      if (!osb) return;
      Object.assign(sh.uniforms, OSB);
      sh.vertexShader = 'varying vec3 vSvP;\nvarying vec3 vSvN;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n vSvP = (modelMatrix * vec4(transformed, 1.0)).xyz; vSvN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = 'uniform sampler2D osb;\nuniform vec3 osbStred;\nuniform vec2 osbPul;\nuniform vec2 osbPodlahy;\nvarying vec3 vSvP;\nvarying vec3 vSvN;\n' +
        sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          {
            vec3 n = normalize(vSvN);
            vec2 d = osbStred.xz - vSvP.xz;
            bool uvnitr = all(lessThan(abs(d), osbPul));
            bool podlaha = n.y > 0.7 && (abs(vSvP.y - osbPodlahy.x) < 0.35 || abs(vSvP.y - osbPodlahy.y) < 0.35);
            bool strop = n.y < -0.7 && vSvP.y > osbPodlahy.x + 1.2;
            bool stena = abs(n.y) < 0.3 && (dot(n.xz, d) > 0.0 || all(lessThan(abs(d), osbPul - 1.4)));
            if (uvnitr && (podlaha || strop || stena)) {
              vec2 u = abs(n.y) > 0.5 ? vSvP.xz : (abs(n.x) > abs(n.z) ? vSvP.zy : vSvP.xy);
              diffuseColor.rgb = texture2D(osb, u / 1.22).rgb;
            }
          }`);
    };
    mat.customProgramCacheKey = () => (osb ? 'rez-osb' : 'rez');
  }
  const pomocny = new THREE.Box3();
  model.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    const mat = m.material, jm = mat.name.toLowerCase();
    pomocny.setFromObject(m);
    if (jm === 'voda') {      // v modelu je jen koryto bez hladiny → hladina se doplní nahoře
      m.visible = false;
      vodniBox.union(pomocny);
      return;
    }
    if (jm === 'kamen') kameny.union(pomocny);
    if (/sklo/.test(jm)) { mat.emissive = new THREE.Color(0xffb45e); mat.emissiveIntensity = 0; okna.push(mat); m.castShadow = false; }
    if (/strecha/.test(jm)) { strechy.push(mat); mat.userData.barva = mat.color.clone(); strechaMeshe.push(m); }
    if (chataBox.intersectsBox(pomocny)) rezovat(mat, !/strecha|sklo|okap/.test(jm));
    if (mat.normalMap) mat.normalScale.multiplyScalar(1);
  });

  /* ================= potok: hladina ================= */
  const vodaMat = new THREE.MeshPhysicalMaterial({ color: 0x24403f, roughness: 0.05, metalness: 0, normalMap: vodaTex, normalScale: new THREE.Vector2(0.4, 0.4), transparent: true, opacity: 0.9, clearcoat: 1, clearcoatRoughness: 0.04 });
  if (!vodniBox.isEmpty()) {
    vodaTex.wrapS = vodaTex.wrapT = THREE.RepeatWrapping;
    const v = vodniBox.getSize(new THREE.Vector3()), s0 = vodniBox.getCenter(new THREE.Vector3());
    vodaTex.repeat.set(v.x / 9, v.z / 9);
    const hladina = new THREE.Mesh(new THREE.PlaneGeometry(v.x + OKRAJ * 2, v.z), vodaMat);
    hladina.rotation.x = -Math.PI / 2;
    hladina.position.set(s0.x, vodniBox.max.y - 0.35, s0.z);
    hladina.receiveShadow = true;
    scena.add(hladina);
  }

  /* ================= ohniště (světlo v noci) ================= */
  if (!kameny.isEmpty()) {
    const s = kameny.getCenter(new THREE.Vector3());
    ohniste = new THREE.Group();
    const uhliky = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), new THREE.MeshStandardMaterial({ color: 0x1d1814, emissive: 0xff5a14, emissiveIntensity: 0, roughness: 1 }));
    uhliky.rotation.x = -Math.PI / 2;
    const svetlo = new THREE.PointLight(0xff8a3c, 0, 18, 1.8);
    svetlo.position.y = 1;
    ohniste.add(uhliky, svetlo);
    ohniste.position.set(s.x, kameny.min.y + 0.12, s.z);
    ohniste.userData = { uhliky, svetlo };
    scena.add(ohniste);
  }

  /* ================= světla v chatě (noc) ================= */
  const interier = [[0, 1.9], [CFG.PODKROVI_NAD_PODLAHOU, 1.3]].map(([dy, h]) => {
    const s = new THREE.PointLight(0xffb066, 0, 4.5, 2);
    s.position.set(stred.x, CH.podlaha + dy + h, stred.z);
    scena.add(s);
    return s;
  });

  /* ================= stromy z listových karet ================= */
  const listiTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    for (let i = 0; i < 260; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 112;
      const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r, l = 55 + rnd() * 45;
      g.save(); g.translate(x, y); g.rotate(rnd() * Math.PI * 2);
      g.fillStyle = `hsl(0,0%,${l}%)`;
      g.beginPath(); g.ellipse(0, 0, 4 + rnd() * 4, 9 + rnd() * 6, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const listiMat = new THREE.MeshStandardMaterial({ map: listiTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, vertexColors: true });
  const kuraMat = new THREE.MeshStandardMaterial({ color: 0x6f6557, roughness: 1 });
  const jadroMat = new THREE.MeshStandardMaterial({ roughness: 1, vertexColors: true });
  const stromy = new THREE.Group();
  scena.add(stromy);
  {
    const karty = [], jadra = [], kmeny = [], q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), n = new THREE.Vector3();
    const karta = (cx, cy, cz, rx, ry, vel, odstin) => {
      v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
      const r = 0.55 + 0.45 * Math.pow(rnd(), 0.5);
      const p = new THREE.Vector3(cx + v.x * rx * r, cy + v.y * ry * r, cz + v.z * rx * r);
      const g = new THREE.PlaneGeometry(vel, vel);
      q.setFromEuler(e.set(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3));
      g.applyQuaternion(q).translate(p.x, p.y, p.z);
      n.set(p.x - cx, (p.y - cy) * 1.4 + ry * 0.4, p.z - cz).normalize();     // normály ven z koruny = měkké světlo
      const nn = [], cc = [];
      for (let k = 0; k < 4; k++) { nn.push(n.x, n.y, n.z); cc.push(odstin, odstin, odstin); }
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
      karty.push(g);
    };
    const strom = (x, z, r, y0, y1) => {
      const zem = vyska(x, z), ry = (y1 - y0) / 2, cy = y0 + ry;
      const kmen = new THREE.CylinderGeometry(r * 0.05, r * 0.09, cy - zem, 7);
      kmen.translate(x, zem + (cy - zem) / 2, z);
      kmeny.push(kmen);
      for (let k = 0; k < 5; k++) {   // větve (v zimě vidět)
        const a = (k / 5) * Math.PI * 2 + rnd(), d = r * (0.6 + rnd() * 0.3), h = cy - ry * 0.3 + rnd() * ry * 0.6;
        const vg = new THREE.CylinderGeometry(r * 0.015, r * 0.035, d, 5);
        vg.translate(0, d / 2, 0); vg.rotateZ(-1.0 - rnd() * 0.4); vg.rotateY(a); vg.translate(x, h - ry * 0.3, z);
        kmeny.push(vg);
      }
      const odstin = 0.75 + rnd() * 0.25;
      const pocet = Math.round(Math.min(110, Math.max(26, r * r * (slabe ? 2.2 : 3.6))));
      for (let k = 0; k < pocet; k++) karta(x, cy, z, r * 0.92, ry * 0.92, r * (0.55 + rnd() * 0.3), odstin * (0.8 + rnd() * 0.35));
      const jg = new THREE.IcosahedronGeometry(1, 2);
      const jp = jg.attributes.position;
      for (let k = 0; k < jp.count; k++) { const s = 0.85 + rnd() * 0.25; jp.setXYZ(k, jp.getX(k) * r * 0.78 * s, jp.getY(k) * ry * 0.78 * s, jp.getZ(k) * r * 0.78 * s); }
      jg.translate(x, cy, z);
      jg.setAttribute('color', new THREE.Float32BufferAttribute(new Array(jp.count * 3).fill(odstin * 0.55), 3));
      jg.deleteAttribute('uv'); jg.computeVertexNormals();
      jadra.push(jg);
    };
    data.stromy.forEach(([x, z, r, y0, y1]) => strom(x, z, r, y0, y1));
    const km = new THREE.Mesh(mergeGeometries(kmeny.map((g) => g.toNonIndexed())), kuraMat);
    const li = new THREE.Mesh(mergeGeometries(karty), listiMat);
    const ja = new THREE.Mesh(mergeGeometries(jadra), jadroMat);
    li.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: listiTex, alphaTest: 0.5 });
    [km, li, ja].forEach((m) => { m.castShadow = true; m.receiveShadow = true; stromy.add(m); });
    stromy.userData = { listi: li, jadro: ja };
  }

  /* ================= les kolem pozemku (smrky) ================= */
  const jehliciMat = new THREE.MeshStandardMaterial({ color: 0x2c4a2e, roughness: 0.95 });
  {
    const tiers = [];
    for (let k = 0; k < 6; k++) { const g = new THREE.ConeGeometry(1.7 - k * 0.24, 2.4, 9); g.translate(0, 1.6 + k * 1.25, 0); tiers.push(g); }
    const smrkG = mergeGeometries(tiers);
    const kmenG = new THREE.CylinderGeometry(0.14, 0.22, 2, 6); kmenG.translate(0, 1, 0);
    const POCET = slabe ? 1600 : 3000;
    const smrky = new THREE.InstancedMesh(smrkG, jehliciMat, POCET), km = new THREE.InstancedMesh(kmenG, kuraMat, POCET);
    let n = 0;
    for (let p = 0; p < POCET * 30 && n < POCET; p++) {
      const x = T.x0 - OKRAJ + rnd() * tw, z = T.z0 - OKRAJ + rnd() * td, d = venku(x, z);
      if (d < 3 || rnd() > 0.25 + smooth(3, 14, d)) continue;
      const s = 1.3 + rnd() * 1.1;
      o.position.set(x, vyska(x, z) - 0.2, z); o.rotation.set((rnd() - 0.5) * 0.06, rnd() * 6, 0); o.scale.set(s, s * (0.9 + rnd() * 0.4), s);
      o.updateMatrix(); smrky.setMatrixAt(n, o.matrix); km.setMatrixAt(n, o.matrix);
      smrky.setColorAt(n, c.setScalar(0.75 + rnd() * 0.45)); n++;
    }
    smrky.count = km.count = n;
    smrky.castShadow = true;
    scena.add(smrky, km);
  }

  /* ================= tráva kolem chaty ================= */
  const TRAVA = slabe ? 9000 : 22000;
  const travaMat = new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide });
  const trava = new THREE.InstancedMesh((() => { const g = new THREE.ConeGeometry(0.035, 0.32, 3); g.translate(0, 0.16, 0); return g; })(), travaMat, TRAVA);
  const travaOdstin = new Float32Array(TRAVA);
  for (let n = 0; n < TRAVA;) {
    const a = rnd() * Math.PI * 2, d = 4 + Math.pow(rnd(), 0.7) * 34;
    const x = stred.x + Math.cos(a) * d * 1.3, z = stred.z + Math.sin(a) * d;
    if (chataBox.containsPoint(new THREE.Vector3(x, CH.podlaha, z)) || venku(x, z) > 0) continue;
    o.position.set(x, vyska(x, z) - 0.03, z); o.rotation.set((rnd() - 0.5) * 0.5, rnd() * Math.PI, (rnd() - 0.5) * 0.5);
    const s = 0.7 + rnd() * 0.9; o.scale.set(s, s * (0.7 + rnd() * 0.8), s);
    o.updateMatrix(); trava.setMatrixAt(n, o.matrix); travaOdstin[n] = (rnd() - 0.5) * 0.3; n++;
  }
  trava.receiveShadow = true;
  scena.add(trava);

  /* ================= obloha a světla ================= */
  const nebe = new Sky();
  nebe.scale.setScalar(5000);
  scena.add(nebe);
  const nu = nebe.material.uniforms;
  nu.turbidity.value = 4; nu.rayleigh.value = 1.2; nu.mieCoefficient.value = 0.004; nu.mieDirectionalG.value = 0.82;
  const nebeScena = new THREE.Scene(), nebeEnv = new Sky();
  nebeEnv.scale.setScalar(5000); nebeEnv.material = nebe.material; nebeScena.add(nebeEnv);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

  const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x4d5a33, 0.3);
  const slunce = new THREE.DirectionalLight(0xffffff, 3);
  slunce.castShadow = true;
  slunce.shadow.mapSize.set(slabe ? 2048 : 4096, slabe ? 2048 : 4096);
  const SR = 55;
  Object.assign(slunce.shadow.camera, { left: -SR, right: SR, top: SR, bottom: -SR, near: 1, far: 400 });
  slunce.shadow.bias = -0.0003;
  slunce.shadow.normalBias = 0.04;
  const mesic = new THREE.DirectionalLight(0x9fb4ff, 0);
  scena.add(hemi, slunce, slunce.target, mesic);

  /* ================= čas, roční období, počasí ================= */
  const pevnyCas = url.get('cas') ? new Date(url.get('cas')) : null;
  const pevnySnih = url.has('snih') ? url.get('snih') === '1' : null;
  const pocasi = { snih: null, mraky: 0 };
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
  const denVRoce = (d) => (d - new Date(d.getFullYear(), 0, 0)) / 864e5;
  const KLICE = (pole, den) => {
    for (let i = 0; i < pole.length - 1; i++) {
      const [d1, c1] = pole[i], [d2, c2] = pole[i + 1];
      if (den >= d1 && den <= d2) return C(c1).lerp(C(c2), (den - d1) / (d2 - d1));
    }
    return C(pole[0][1]);
  };
  // násobiče barvy textury trávy během roku
  const LOUKA = [[0, 0xc9bca6], [70, 0xd6cdb4], [110, 0xffffff], [225, 0xffffff], [285, 0xf0e6d0], [330, 0xd2c6ae], [367, 0xc9bca6]];
  const ZELEN = [[0, 0.12], [75, 0.3], [105, 0.85], [140, 1], [175, 0.8], [200, 0.45], [230, 0.25], [260, 0.4], [290, 0.55], [320, 0.35], [367, 0.12]];
  const klic = (pole, den) => { for (let i = 0; i < pole.length - 1; i++) { const [d1, v1] = pole[i], [d2, v2] = pole[i + 1]; if (den >= d1 && den <= d2) return v1 + (v2 - v1) * (den - d1) / (d2 - d1); } return pole[0][1]; };
  const LES = [[0, 0x6f6553], [110, 0x6f7a4f], [180, 0x66734a], [290, 0x7a6a48], [367, 0x6f6553]];
  const LISTI = [[0, 0x9a8a66], [95, 0x9a8a66], [120, 0xa7d064], [160, 0x6e9a3b], [250, 0x7a9638], [280, 0xe0962e], [305, 0xc0622a], [330, 0x9a8a66], [367, 0x9a8a66]];
  const NOC = C(0x0b1222), SOUMRAK = C(0xe7a57a), DEN = C(0xc9d8e6), SNIH = C(0xf2f5f9);

  function nastavCas() {
    const d = ted();
    const { vy: e, az: az0 } = polohaSlunce(d, CFG.GPS[0], CFG.GPS[1]);
    const az = az0 - THREE.MathUtils.degToRad(CFG.SEVER);
    const sinE = Math.sin(e);
    const den = smooth(-0.1, 0.1, sinE), nizko = 1 - smooth(0.05, 0.4, sinE);
    const mrak = pocasi.mraky, dvr = denVRoce(d), mes = d.getMonth();
    const sn = (pevnySnih ?? pocasi.snih ?? ((mes === 11 && d.getDate() >= 15) || mes <= 1)) ? 1 : 0;

    // slunce + obloha + odrazy
    const smer = new THREE.Vector3(Math.sin(az) * Math.cos(e), sinE, -Math.cos(az) * Math.cos(e));
    nu.sunPosition.value.copy(smer);
    nu.turbidity.value = 3 + mrak * 8; nu.rayleigh.value = 1.1 + mrak * 1.5;
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(nebeScena, 0, 1, 6000);
    scena.environment = envRT.texture;
    slunce.position.copy(stred).addScaledVector(smer.clone().setY(Math.max(sinE, 0.03)).normalize(), 200);
    slunce.target.position.copy(stred);
    slunce.intensity = 3.4 * smooth(-0.02, 0.15, sinE) * (1 - 0.65 * mrak);
    slunce.color.set(0xfff4e6).lerp(C(0xff9a50), nizko * 0.7);
    mesic.position.copy(stred).add(new THREE.Vector3(-60, 120, -40));
    mesic.intensity = 0.35 * (1 - den);
    hemi.color.copy(C(0x5a6fa8)).lerp(C(0xdfe9ff), den).lerp(C(0xffc9a0), nizko * den * 0.4);
    hemi.groundColor.copy(C(0x0c1218)).lerp(sn ? C(0xb8c4d0) : C(0x4d5a33), den);
    hemi.intensity = 0.22 + 0.18 * (1 - den) + 0.6 * nizko * den + 0.25 * mrak;
    renderer.toneMappingExposure = 0.55 + 0.5 * (1 - den) + 0.25 * nizko * den;
    const mlha = NOC.clone().lerp(DEN, den).lerp(SOUMRAK, nizko * den * 0.55);
    scena.fog.color.copy(mlha);

    // terén: textura × barva období × šum, les tmavší, sníh
    const louka = KLICE(LOUKA, dvr), les = KLICE(LES, dvr), bar = tg.attributes.color;
    zelen.value = klic(ZELEN, dvr);
    for (let i = 0; i < tp.count; i++) {
      const s = sumy[i], z = zony[i];
      c.copy(louka).multiplyScalar(0.92 + s * 0.14).lerp(les, z);
      if (sn) c.lerp(SNIH, (0.93 + s * 0.05) * (1 - z * 0.15));
      bar.setXYZ(i, c.r, c.g, c.b);
    }
    bar.needsUpdate = true;
    terenMat.map = sn ? null : travaTex; terenMat.needsUpdate = true;

    const stebla = C(0xa59a6a).lerp(C(0x6f9a3a), zelen.value);
    for (let i = 0; i < TRAVA; i++) trava.setColorAt(i, c.copy(stebla).multiply(louka).multiplyScalar(0.85 + travaOdstin[i]));
    trava.instanceColor.needsUpdate = true;
    trava.visible = !sn;
    jehliciMat.color.set(0x2c4a2e).lerp(SNIH, sn * 0.35);
    const listi = KLICE(LISTI, dvr), holo = sn || dvr < 100 || dvr > 325;
    listiMat.color.copy(listi);
    jadroMat.color.copy(listi);
    stromy.userData.listi.visible = stromy.userData.jadro.visible = !holo;
    strechy.forEach((m) => m.color.copy(m.userData.barva).lerp(SNIH, sn * 0.9));
    strechy.forEach((m) => { m.roughness = sn ? 0.9 : 0.5; m.metalness = sn ? 0 : 0.35; });

    // noc
    const tma = 1 - den;
    okna.forEach((m) => (m.emissiveIntensity = tma * 3));
    interier.forEach((s) => (s.intensity = tma * 8));
    if (ohniste) {
      const ohen = !sn && dvr > 110 && dvr < 280 ? tma : 0;
      ohniste.userData.uhliky.material.emissiveIntensity = ohen * 3;
      ohniste.userData.svetlo.intensity = ohen * 60;
    }

    const hod = d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: pevnyCas ? undefined : 'Europe/Prague' });
    const obdobi = sn ? 'sníh' : dvr < 80 || dvr > 355 ? 'zima' : dvr < 172 ? 'jaro' : dvr < 266 ? 'léto' : 'podzim';
    const doba = den < 0.15 ? 'noc' : nizko > 0.6 ? (d.getHours() < 12 ? 'svítání' : 'soumrak') : 'den';
    stav.textContent = `U chaty ${hod} · ${doba} · ${obdobi}`;
    prekresli();
  }

  if (CFG.POCASI && !pevnyCas) {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${CFG.GPS[0]}&longitude=${CFG.GPS[1]}&current=snow_depth,cloud_cover&timezone=Europe%2FPrague`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { pocasi.snih = (j.current?.snow_depth ?? 0) > 0.02; pocasi.mraky = Math.min(1, (j.current?.cloud_cover ?? 0) / 100); nastavCas(); })
      .catch(() => {});
  }

  /* ================= pohledy ================= */
  const P2 = CH.podlaha + CFG.PODKROVI_NAD_PODLAHOU;
  const sx = (CH.max[0] - CH.min[0]), sz = (CH.max[2] - CH.min[2]);
  const ohenStred = ohniste ? ohniste.position : stred;
  const POHLEDY = {
    dron:     { cil: [(stred.x + ohenStred.x) / 2, CH.podlaha - 2, (stred.z + ohenStred.z) / 2 + 12], phi: 0.6, theta: 0.2, sirka: 92 },   // chata, ohniště i potok
    podkrovi: { cil: [stred.x, P2, stred.z], phi: 0.6, theta: 0.55, sirka: Math.max(sx, sz) * 1.45, rez: P2 + CFG.REZ },
    prizemi:  { cil: [stred.x, CH.podlaha, stred.z], phi: 0.6, theta: 0.55, sirka: Math.max(sx, sz) * 1.45, rez: CH.podlaha + CFG.REZ },
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
    let_ = { odkud, kam, t0: performance.now(), T: 1300 };
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
      const zvedni = Math.sin(k * Math.PI) * 0.3 * (a.r + b.r) / 2;      // dron se při přeletu zvedne
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
