/**
 * 3D LOUKA S CHATOU – půdorys v řezu (three.js).
 *
 * Statická scéna (bez animací) – jde jen otáčet tažením.
 * Režim „Půdorys“: stěny v řezu ~1 m, horní hrana černá jako čára ve výkresu.
 * Režim „Chata“: stěny v plné výšce + sedlová střecha.
 *
 * Tvar chaty = spodní půdorys z návrhu (stejné souřadnice jako SVG v index.html).
 * Změna půdorysu: uprav pole STENY a VYBAVENI níže (jednotky = px z návrhu).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const box = document.getElementById('scena');
if (box) {
  try { start(); } catch (e) { console.warn('3D scéna se nespustila:', e); }
}

function start() {
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) return;   // zůstane SVG záloha

  const reduce = true;   // bez animací: žádné samovolné otáčení, „stavba“ ani náklon při scrollu

  /* ---------------- půdorys (px z návrhu → metry) ---------------- */
  const K = 0.02;                       // 1 px návrhu = 2 cm → hlavní místnost 6 m
  const STRED = { x: 257.5, y: 140 };
  const TL = 15;                        // tloušťka čáry = stěny (px)
  const STENY = [
    [[7.5, 7.5], [308, 7.5], [308, 272.5], [7.5, 272.5], [7.5, 7.5]],
    [[308, 7.5], [507.5, 7.5], [507.5, 172], [308, 172]],
    [[155, 7.5], [155, 54], [308, 54]],
    [[370.5, 7.5], [370.5, 172]],
  ];
  const VYBAVENI = [                    // nízké prvky (lavice)
    [[67, 272.5], [67, 226], [209, 226], [209, 272.5]],
  ];
  const PODLAHY = [[7.5, 7.5, 308, 272.5], [308, 7.5, 507.5, 172]];
  const m = (p) => new THREE.Vector2((p[0] - STRED.x) * K, (p[1] - STRED.y) * K);

  const R = 15;                         // poloměr louky (m)
  const V_PUDORYS = 1.0, V_CHATA = 2.6; // výška stěn

  /* ---------------- renderer, scéna, kamera ---------------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  box.appendChild(renderer.domElement);

  const scena = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);

  const ovl = new OrbitControls(kamera, renderer.domElement);
  ovl.enableDamping = false;
  ovl.dampingFactor = 0.08;
  ovl.enablePan = false;
  ovl.enableZoom = false;                // kolečko myši posouvá stránku, ne scénu
  ovl.minPolarAngle = 0;
  ovl.maxPolarAngle = 1.2;
  ovl.rotateSpeed = 0.6;
  ovl.autoRotate = !reduce;
  ovl.autoRotateSpeed = 0.45;
  ovl.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
  renderer.domElement.style.touchAction = 'pan-y';   // svislý swipe dál scrolluje stránku

  /* ---------------- světla ---------------- */
  scena.add(new THREE.HemisphereLight(0xffffff, 0x6f8f4a, 1.15));
  const slunce = new THREE.DirectionalLight(0xfff1dc, 2.1);
  slunce.position.set(12, 22, 8);
  slunce.castShadow = true;
  slunce.shadow.mapSize.set(2048, 2048);
  Object.assign(slunce.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
  slunce.shadow.bias = -0.0004;
  slunce.shadow.normalBias = 0.02;
  scena.add(slunce);

  /* ---------------- pomocné ---------------- */
  let sem = 7;
  const rnd = () => { sem = (sem * 16807) % 2147483647; return (sem - 1) / 2147483646; };   // stejné náhody při každém načtení
  const sum = (x, z) => Math.sin(x * 0.35 + 1.3) * Math.cos(z * 0.29 - 0.7) * 0.6 + Math.sin(x * 0.9 + z * 0.7) * 0.25 + Math.cos(z * 1.3 - x * 0.4) * 0.15;
  const ma = (r, g, b) => new THREE.Color(r, g, b);

  // obdélník chaty (+ rezerva) – tam neroste tráva
  const pudorysBox = new THREE.Box2(m([7.5, 7.5]), m([507.5, 272.5]));
  const vChate = (x, z, rez = 0.6) => x > pudorysBox.min.x - rez && x < pudorysBox.max.x + rez && z > pudorysBox.min.y - rez && z < pudorysBox.max.y + rez;

  // cestička z kamenů od lavice k okraji louky
  const cesta = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    cesta.push(new THREE.Vector2(-1.2 + Math.sin(t * 2.4) * 2.2 + t * 2.5, 3.4 + t * 10.2));
  }
  const naCeste = (x, z) => cesta.some((p) => Math.hypot(p.x - x, p.y - z) < 0.75);

  /* prvky, které se při prvním zobrazení „postaví“ */
  const stavba = { steny: [], stromy: [], podlahy: [], trava: null, kytky: null };

  /* ---------------- louka (ostrůvek) ---------------- */
  const louka = new THREE.Group();
  scena.add(louka);
  {
    const g = new THREE.PlaneGeometry(R * 2, R * 2, 110, 110);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const barvy = [];
    const c1 = ma(0.55, 0.74, 0.33), c2 = ma(0.67, 0.81, 0.42), c3 = ma(0.45, 0.63, 0.27), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), z = pos.getZ(i);
      const d = Math.hypot(x, z);
      if (d > R) { x *= R / d; z *= R / d; }
      const okraj = Math.max(0, (Math.hypot(x, z) - (R - 2.2)) / 2.2);   // okraj se mírně svažuje
      const y = vChate(x, z, 1.2) ? 0 : sum(x, z) * 0.18 - okraj * okraj * 0.45;
      pos.setXYZ(i, x, y, z);
      const n = sum(x * 1.7, z * 1.7);
      c.copy(c1).lerp(n > 0 ? c2 : c3, Math.min(1, Math.abs(n) * 1.3));
      if (naCeste(x, z)) c.lerp(ma(0.62, 0.66, 0.4), 0.35);
      barvy.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(barvy, 3));
    g.computeVertexNormals();
    const trava = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    trava.receiveShadow = true;
    louka.add(trava);

    // hlína po obvodu – „diorama“
    const hlina = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R * 0.92, 2.2, 128, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x8a6646, roughness: 1, side: THREE.DoubleSide })
    );
    hlina.position.y = -1.55;
    louka.add(hlina);
    const dno = new THREE.Mesh(new THREE.CircleGeometry(R * 0.92, 96), new THREE.MeshStandardMaterial({ color: 0x5e4630 }));
    dno.rotation.x = Math.PI / 2;
    dno.position.y = -2.65;
    louka.add(dno);
  }
  const vyskaLouky = (x, z) => {
    const d = Math.hypot(x, z);
    const okraj = Math.max(0, (d - (R - 2.2)) / 2.2);
    return vChate(x, z, 1.2) ? 0 : sum(x, z) * 0.18 - okraj * okraj * 0.45;
  };

  /* ---------------- tráva, kytky, kameny ---------------- */
  {
    const POCET = 3200;
    const g = new THREE.ConeGeometry(0.045, 0.34, 3);
    g.translate(0, 0.17, 0);
    const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 1 }), POCET);
    const o = new THREE.Object3D(), c = new THREE.Color();
    let n = 0;
    while (n < POCET) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (R - 0.6);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (vChate(x, z) || naCeste(x, z)) continue;
      o.position.set(x, vyskaLouky(x, z), z);
      o.rotation.set((rnd() - 0.5) * 0.5, rnd() * Math.PI, (rnd() - 0.5) * 0.5);
      const s = 0.6 + rnd() * 0.9;
      o.scale.set(s, s * (0.8 + rnd() * 0.7), s);
      o.updateMatrix();
      mesh.setMatrixAt(n, o.matrix);
      c.setHSL(0.24 + rnd() * 0.06, 0.45 + rnd() * 0.2, 0.32 + rnd() * 0.16);
      mesh.setColorAt(n, c);
      n++;
    }
    louka.add(mesh);
    stavba.trava = mesh;

    const KYTKY = 380;
    const kg = new THREE.IcosahedronGeometry(0.07, 0);
    const kytky = new THREE.InstancedMesh(kg, new THREE.MeshStandardMaterial({ roughness: 0.7 }), KYTKY);
    const pal = [0xffffff, 0xffe066, 0xc9a7ff, 0xffffff, 0xff9fb2];
    n = 0;
    while (n < KYTKY) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (R - 0.8);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (vChate(x, z, 1) || naCeste(x, z)) continue;
      o.position.set(x, vyskaLouky(x, z) + 0.22 + rnd() * 0.12, z);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(0.7 + rnd() * 0.7);
      o.updateMatrix();
      kytky.setMatrixAt(n, o.matrix);
      kytky.setColorAt(n, c.set(pal[Math.floor(rnd() * pal.length)]));
      n++;
    }
    louka.add(kytky);
    stavba.kytky = kytky;

    const kg2 = new THREE.CylinderGeometry(0.42, 0.48, 0.12, 9);
    const kameny = new THREE.InstancedMesh(kg2, new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 0.95 }), cesta.length);
    cesta.forEach((p, i) => {
      o.position.set(p.x, vyskaLouky(p.x, p.y) + 0.03, p.y);
      o.rotation.set(0, rnd() * 3, 0);
      o.scale.set(0.8 + rnd() * 0.4, 1, 0.7 + rnd() * 0.4);
      o.updateMatrix();
      kameny.setMatrixAt(i, o.matrix);
    });
    kameny.receiveShadow = true;
    louka.add(kameny);
  }

  /* ---------------- smrky a pařez ---------------- */
  {
    const jehl = new THREE.MeshStandardMaterial({ color: 0x2f5a37, roughness: 0.95, flatShading: true });
    const jehl2 = new THREE.MeshStandardMaterial({ color: 0x3a6b40, roughness: 0.95, flatShading: true });
    const kmen = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
    const smrk = (x, z, s) => {
      const t = new THREE.Group();
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6), kmen);
      k.position.y = 0.6; k.castShadow = true; t.add(k);
      [[1.35, 2.1, 1.4], [1.05, 1.8, 2.5], [0.7, 1.5, 3.5]].forEach(([r, h, y], i) => {
        const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), i % 2 ? jehl2 : jehl);
        c.position.y = y; c.rotation.y = rnd() * 3; c.castShadow = true; t.add(c);
      });
      t.position.set(x, vyskaLouky(x, z) - 0.05, z);
      t.scale.setScalar(s);
      t.userData.s = s;
      louka.add(t);
      stavba.stromy.push(t);
    };
    // les za chatou (jako na fotkách) + pár stromů okolo
    for (let i = 0; i < 17; i++) {
      const a = -Math.PI * 0.92 + (i / 16) * Math.PI * 0.84 + (rnd() - 0.5) * 0.12;
      const d = 10.2 + rnd() * 3.6;
      smrk(Math.cos(a) * d, Math.sin(a) * d, 0.85 + rnd() * 0.65);
    }
    [[11.5, 4.2], [-12, 5.5], [-10.8, 8.6]].forEach(([x, z]) => smrk(x, z, 0.8 + rnd() * 0.4));

    // velký pařez (jako za oknem na fotce)
    const parez = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.8, 0.75, 10), kmen);
    p1.position.y = 0.37; p1.castShadow = true; parez.add(p1);
    const vrch = new THREE.Mesh(new THREE.CircleGeometry(0.6, 10), new THREE.MeshStandardMaterial({ color: 0xc9a77c }));
    vrch.rotation.x = -Math.PI / 2; vrch.position.y = 0.751; parez.add(vrch);
    parez.position.set(5.6, 0, -4.4);
    louka.add(parez);
  }

  stavba.stromy.sort((a, b) => Math.atan2(a.position.z, a.position.x) - Math.atan2(b.position.z, b.position.x));

  /* ---------------- chata ---------------- */
  const chata = new THREE.Group();
  scena.add(chata);

  // textura prken na podlahu
  const prkna = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#d9b58a'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = `hsl(31, ${42 + (i % 3) * 6}%, ${68 + ((i * 37) % 9)}%)`;
      x.fillRect(0, i * 32 + 1, 256, 30);
      x.fillStyle = 'rgba(80,50,20,.35)'; x.fillRect(0, i * 32, 256, 1.5);
      x.fillStyle = 'rgba(80,50,20,.25)'; x.fillRect(((i * 97) % 200) + 20, i * 32, 1.5, 32);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  })();

  PODLAHY.forEach(([x1, y1, x2, y2]) => {
    const a = m([x1, y1]), b = m([x2, y2]);
    const w = b.x - a.x, h = b.y - a.y;
    const tx = prkna.clone(); tx.needsUpdate = true; tx.repeat.set(w / 1.6, h / 1.6);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.85 }));
    p.rotation.x = -Math.PI / 2;
    p.position.set((a.x + b.x) / 2, 0.06, (a.y + b.y) / 2);
    p.receiveShadow = true;
    chata.add(p);
    stavba.podlahy.push(p);
  });

  // základ (podezdívka) pod oběma částmi
  PODLAHY.forEach(([x1, y1, x2, y2]) => {
    const a = m([x1 - 7.5, y1 - 7.5]), b = m([x2 + 7.5, y2 + 7.5]);
    const z = new THREE.Mesh(new THREE.BoxGeometry(b.x - a.x + 0.1, 0.12, b.y - a.y + 0.1), new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: 1 }));
    z.position.set((a.x + b.x) / 2, 0, (a.y + b.y) / 2);
    z.receiveShadow = true;
    chata.add(z);
    stavba.podlahy.push(z);
  });

  // stěny: boční strany dřevo, horní hrana černá = čára půdorysu
  const drevo = new THREE.MeshStandardMaterial({ color: 0xa86a38, roughness: 0.8 });
  const cara = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 });
  const matStena = [drevo, drevo, cara, drevo, drevo, drevo];
  const tl = TL * K;
  const steny = new THREE.Group();
  chata.add(steny);

  function segmenty(pole, skupina, vyska, mat) {
    pole.forEach((cesta2) => {
      for (let i = 0; i < cesta2.length - 1; i++) {
        const a = m(cesta2[i]), b = m(cesta2[i + 1]);
        const delka = a.distanceTo(b) + tl;
        const g = new THREE.BoxGeometry(delka, vyska, tl);
        g.translate(0, vyska / 2, 0);
        const s = new THREE.Mesh(g, mat);
        s.position.set((a.x + b.x) / 2, 0.06, (a.y + b.y) / 2);
        s.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
        s.castShadow = true; s.receiveShadow = true;
        skupina.add(s);
        stavba.steny.push(s);
      }
    });
  }
  segmenty(STENY, steny, 1, matStena);                         // výška 1 → škáluje se
  segmenty(VYBAVENI, chata, 0.45, [drevo, drevo, cara, drevo, drevo, drevo]);
  steny.scale.y = V_PUDORYS;

  // střecha (jen v režimu „Chata“)
  const strecha = new THREE.Group();
  chata.add(strecha);
  const matStrecha = new THREE.MeshStandardMaterial({ color: 0x3b3e44, roughness: 0.55, metalness: 0.25, transparent: true, opacity: 0 });
  const matStit = new THREE.MeshStandardMaterial({ color: 0x9a6233, roughness: 0.85, transparent: true, opacity: 0 });
  function sedlo(x1, y1, x2, y2, vyska) {
    const a = m([x1, y1]), b = m([x2, y2]);
    const sirka = (b.y - a.y) + 0.7, delka = (b.x - a.x) + 0.6;
    const tvar = new THREE.Shape();
    tvar.moveTo(-sirka / 2, 0); tvar.lineTo(sirka / 2, 0); tvar.lineTo(0, vyska); tvar.closePath();
    const g = new THREE.ExtrudeGeometry(tvar, { depth: delka, bevelEnabled: false });
    g.translate(0, 0, -delka / 2);
    g.rotateY(Math.PI / 2);
    const s = new THREE.Mesh(g, [matStit, matStrecha]);
    s.position.set((a.x + b.x) / 2, 0, (a.y + b.y) / 2);
    s.castShadow = true;
    strecha.add(s);
  }
  sedlo(7.5, 7.5, 308, 272.5, 2.1);
  sedlo(308, 7.5, 507.5, 172, 1.4);
  strecha.visible = false;

  /* ---------------- kamera: zarámování a pohledy ---------------- */
  let videt = false, bezi = false, stavbaStart = reduce ? -1e9 : null;
  let rezim = 'pudorys';
  // Půdorys: náklon kamery řídí scroll (nahoře = čistý pohled shora). Chata: pevný šikmý pohled.
  const NAKLON = { shora: 0.06, dole: 0.8, chata: 1.0 };
  const sfera = new THREE.Spherical(40, reduce ? 0.62 : NAKLON.shora, Math.PI + 0.55);
  let cilPolar = sfera.phi;
  let uzivatelTahal = false;

  function vzdalenost(polar) {
    const vfov = THREE.MathUtils.degToRad(kamera.fov) / 2;
    const vert = (R * (Math.cos(polar) * 0.82 + 0.3) + 1.0) / Math.tan(vfov);
    const horiz = (R + 0.6) / (Math.tan(vfov) * kamera.aspect);
    return Math.max(vert, horiz);
  }
  function nastavKameru() {
    sfera.radius = vzdalenost(sfera.phi);
    kamera.position.setFromSpherical(sfera);
    kamera.lookAt(0, 0.4, 0);
    ovl.target.set(0, 0.4, 0);
  }

  let prvni = true;
  function velikost() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
    if (!prvni) sfera.setFromVector3(kamera.position.clone().sub(ovl.target));
    prvni = false;
    nastavKameru();
    if (!bezi) renderer.render(scena, kamera);
  }
  new ResizeObserver(velikost).observe(box);
  velikost();

  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function naklonZeScrollu() {
    if (rezim !== 'pudorys' || uzivatelTahal) return;
    const hl = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vyska-hlavicky')) || 64;
    const nahore = box.getBoundingClientRect().top + window.scrollY - hl;
    const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, nahore + box.clientHeight * 0.35)));
    cilPolar = reduce ? 0.62 : NAKLON.shora + (NAKLON.dole - NAKLON.shora) * easeIO(p);
  }
  window.addEventListener('scroll', () => { uzivatelTahal = false; naklonZeScrollu(); budik(); }, { passive: true });
  naklonZeScrollu();

  /* ---------------- přepínání režimů ---------------- */
  let vyskaCil = V_PUDORYS, strechaCil = 0, strechaHodnota = 0;
  const tlacitka = box.querySelectorAll('[data-pohled]');
  tlacitka.forEach((b) => b.addEventListener('click', () => {
    rezim = b.dataset.pohled;
    tlacitka.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    box.querySelector('.prepinac').dataset.stav = rezim;
    vyskaCil = rezim === 'chata' ? V_CHATA : V_PUDORYS;
    strechaCil = rezim === 'chata' ? 1 : 0;
    uzivatelTahal = false;
    if (rezim === 'chata') cilPolar = NAKLON.chata; else naklonZeScrollu();
    budik();
  }));

  /* ---------------- interakce: pauza autorotace, nápověda ---------------- */
  const napoveda = document.getElementById('scenaNapoveda');
  let pauza = null;
  let tahani = false;
  ovl.addEventListener('change', budik);
  ovl.addEventListener('start', () => {
    tahani = true;
    uzivatelTahal = true;
    ovl.autoRotate = false;
    clearTimeout(pauza);
    if (napoveda) napoveda.classList.add('scena__napoveda--pryc');
  });
  ovl.addEventListener('end', () => {
    tahani = false;
    clearTimeout(pauza);
    if (!reduce) pauza = setTimeout(() => { ovl.autoRotate = true; budik(); }, 6000);
  });

  /* ---------------- smyčka – běží jen když je scéna vidět ---------------- */
  const io = new IntersectionObserver(([z]) => {
    videt = z.isIntersecting;
    if (videt && stavbaStart === null) stavbaStart = performance.now();
    budik();
  }, { threshold: 0.15 });
  io.observe(box);
  document.addEventListener('visibilitychange', budik);

  function budik() {
    if (!bezi && videt && !document.hidden) { bezi = true; requestAnimationFrame(snimek); }
  }

  /* ---------------- „stavba“ při prvním zobrazení ---------------- */
  const cas = (t, od, trvani) => Math.min(1, Math.max(0, (t - od) / trvani));
  const outCubic = (x) => 1 - Math.pow(1 - x, 3);
  const outBack = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  let postaveno = false;
  function postav(t) {
    if (postaveno) return;
    louka.position.y = -2.6 * (1 - outCubic(cas(t, 0, 1000)));
    stavba.podlahy.forEach((p) => p.scale.setScalar(Math.max(0.001, outCubic(cas(t, 500, 700)))));
    stavba.steny.forEach((w, i) => { w.scale.y = Math.max(0.001, outBack(cas(t, 900 + i * 85, 650))); });
    if (stavba.trava) stavba.trava.scale.y = Math.max(0.001, outCubic(cas(t, 700, 1400)));
    if (stavba.kytky) stavba.kytky.scale.setScalar(Math.max(0.001, outBack(cas(t, 1900, 900))));
    stavba.stromy.forEach((st, i) => st.scale.setScalar(Math.max(0.001, st.userData.s * outBack(cas(t, 1100 + i * 55, 750)))));
    if (t > 3600) postaveno = true;
  }
  if (!reduce) postav(0);

  function snimek(t) {
    if (!videt || document.hidden) { bezi = false; return; }

    if (!uzivatelTahal) {
      sfera.setFromVector3(kamera.position.clone().sub(ovl.target));
      const d = cilPolar - sfera.phi;
      if (Math.abs(d) > 0.0005) { sfera.phi += d * (reduce ? 1 : 0.075); nastavKameru(); }
    }
    if (stavbaStart !== null) postav(t - stavbaStart);

    // stěny a střecha – plynulý přechod
    const v = steny.scale.y + (vyskaCil - steny.scale.y) * (reduce ? 1 : 0.08);
    steny.scale.y = Math.abs(v - vyskaCil) < 0.002 ? vyskaCil : v;
    strechaHodnota += (strechaCil - strechaHodnota) * (reduce ? 1 : 0.07);
    if (Math.abs(strechaHodnota - strechaCil) < 0.003) strechaHodnota = strechaCil;
    strecha.visible = strechaHodnota > 0.01;
    strecha.position.y = steny.scale.y + (1 - strechaHodnota) * 2.2;
    matStrecha.opacity = matStit.opacity = strechaHodnota;
    matStrecha.depthWrite = matStit.depthWrite = strechaHodnota > 0.98;

    const zmena = ovl.update();
    renderer.render(scena, kamera);
    // vykresluje se jen při tažení nebo přechodu – jinak scéna stojí a nežere výkon
    if (zmena || tahani || ovl.autoRotate || Math.abs(steny.scale.y - vyskaCil) > 0.002) requestAnimationFrame(snimek);
    else bezi = false;
  }

  box.classList.add('scena--3d');
  budik();
}
