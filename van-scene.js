// Interactive 3D scene: the Shift & Settle van, back doors open, parked in a storage unit.
// Physically based materials, image-based lighting and rounded edges, all generated in code:
// there are no model or texture files to download.

const host = document.getElementById('unit3d');

if (host) {
  const start = () => build(host).catch((err) => {
    console.error('3D scene failed:', err);
    host.classList.add('is-failed');
    host.querySelector('.scene-status').textContent = 'The 3D view is not available on this device.';
  });
  // Phones, data-saver mode, slow connections and low-memory devices get a button instead of
  // an automatic download of the 3D libraries and scanned assets (about 9 MB).
  const conn = navigator.connection || {};
  const heavy = !!conn.saveData
    || /(^|-)(2g|3g)$/.test(conn.effectiveType || '')
    || (navigator.deviceMemory && navigator.deviceMemory <= 2)
    || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 700);

  if (heavy) {
    const status = host.querySelector('.scene-status');
    status.textContent = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'scene-load';
    btn.textContent = 'Load the 3D view';
    const small = document.createElement('small');
    small.textContent = 'About 9 MB. Best on Wi-Fi.';
    btn.addEventListener('click', () => {
      status.textContent = 'Loading the 3D view…';
      start();
    });
    status.append(btn, small);
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: '500px' });
    io.observe(host);
  } else {
    start();
  }
}

async function build(host) {
  const [THREE, { OrbitControls }, { RoomEnvironment }, { RoundedBoxGeometry }, { RectAreaLightUniformsLib }, { GLTFLoader }] = await Promise.all([
    import('three'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/environments/RoomEnvironment.js'),
    import('three/addons/geometries/RoundedBoxGeometry.js'),
    import('three/addons/lights/RectAreaLightUniformsLib.js'),
    import('three/addons/loaders/GLTFLoader.js')
  ]);
  RectAreaLightUniformsLib.init();
  try { await document.fonts.load('900 80px Archivo'); } catch (e) { /* the fallback font is fine */ }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowEnd = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
  const INK = 0x17181d;

  // ---------- renderer, scene, camera ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1.75 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A 3D view of the Shift and Settle van in a storage unit, back doors open, with a trolley of boxes beside it. Drag to look around.');
  host.insertBefore(canvas, host.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.Fog(INK, 18, 38);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;

  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 80);
  camera.position.set(5.2, 3.0, 7.4);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.3, 0.4);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 15;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.48;
  controls.autoRotateSpeed = 0.55;
  canvas.style.touchAction = 'pan-y';

  // ---------- photo-scanned CC0 assets (Poly Haven); each falls back to a procedural stand-in ----------
  const base = new URL('assets/', import.meta.url).href;
  const gltfLoader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();
  const attempt = async (fn) => { try { return await fn(); } catch (e) { console.warn('asset skipped:', e); return null; } };
  const loadPBR = async (id) => {
    const [map, normalMap, roughnessMap] = await Promise.all(['Diffuse', 'nor_gl', 'Rough'].map((k) => texLoader.loadAsync(`${base}textures/${id}_${k}.jpg`)));
    map.colorSpace = THREE.SRGBColorSpace;
    [map, normalMap, roughnessMap].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = lowEnd ? 4 : 8; });
    return { map, normalMap, roughnessMap };
  };
  const pbrMaterial = (t, rx, ry, extra = {}) => {
    [t.map, t.normalMap, t.roughnessMap].forEach((x) => x.repeat.set(rx, ry));
    return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, ...extra });
  };
  const [boxGltf, truckGltf, shelfGltf, floorScan, wallScan] = await Promise.all([
    attempt(() => gltfLoader.loadAsync(base + 'models/cardboard_box_01/cardboard_box_01_1k.gltf')),
    attempt(() => gltfLoader.loadAsync(base + 'models/hand_truck/hand_truck_1k.gltf')),
    attempt(() => gltfLoader.loadAsync(base + 'models/steel_frame_shelves_01/steel_frame_shelves_01_1k.gltf')),
    attempt(() => loadPBR('concrete_floor_worn_001')),
    attempt(() => loadPBR('corrugated_iron_03'))
  ]);
  const castAll = (obj) => obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // ---------- helpers ----------
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
  const cache = {};
  const M = (color, o = {}) => (cache[color + JSON.stringify(o)] ??= mat(color, o));

  const canvasTexture = (w, h, draw, rx = 1, ry = 1, repeat = true, data = false) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = lowEnd ? 4 : 8;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
    return t;
  };
  const asData = (tex, rx = tex.repeat.x, ry = tex.repeat.y) => {
    const t = tex.clone();
    t.colorSpace = THREE.NoColorSpace;
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    return t;
  };

  // A box centred on (x, y, z) with softly rounded edges. `material` can be an array of six.
  const box = (w, h, d, material, x = 0, y = 0, z = 0, parent = scene, shadows = true, radius) => {
    const min = Math.min(w, h, d);
    const r = radius ?? Math.min(0.02, min * 0.4);
    const geo = min < 0.03 || r < 0.004 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 3, Math.min(r, min / 2.1));
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = shadows;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const cyl = (rTop, rBottom, h, material, x, y, z, parent = scene, seg = 24) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // soft dark patch under things so they sit on the floor
  const blobTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.55, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, 1, 1, false);
  const contact = (x, z, w, d, o = 1, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: o }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = ry;
    m.position.set(x, 0.006, z);
    m.renderOrder = 1;
    scene.add(m);
  };

  // ---------- surface textures ----------
  const cardTex = canvasTexture(256, 256, (ctx, w, h) => {
    const r = rng(3);
    ctx.fillStyle = '#efefef'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3500; i++) {
      ctx.fillStyle = `rgba(60,40,20,${0.04 + r() * 0.08})`;
      ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1);
    }
    for (let x = 0; x < w; x += 8) { ctx.fillStyle = 'rgba(0,0,0,0.035)'; ctx.fillRect(x, 0, 3, h); }
  });
  const cardBump = asData(cardTex);
  const cardMats = {};
  const cardMat = (color) => (cardMats[color] ??= new THREE.MeshStandardMaterial({ color, map: cardTex, bumpMap: cardBump, bumpScale: 1.5, roughness: 0.93 }));
  const tapeMat = M('#d8c38a', { roughness: 0.28, metalness: 0.05 });
  const redTape = M('#b32525', { roughness: 0.3 });

  const labelWords = ['KITCHEN', 'BOOKS', 'BEDROOM', 'OFFICE', 'GLASSES', 'TOYS', 'ART', 'LOUNGE'];
  const labelCache = {};
  const labelTex = (kind) => (labelCache[kind] ??= canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    if (kind === 'FRAGILE') {
      ctx.fillStyle = '#c62c2c'; ctx.fillRect(10, 22, w - 20, h - 44);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 46px Archivo, Arial, sans-serif';
      ctx.fillText('FRAGILE', w / 2, h / 2 + 2);
    } else if (kind === 'ARROWS') {
      ctx.fillStyle = '#1b1b1f';
      [64, 192].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x + 34, 62); ctx.lineTo(x + 12, 62); ctx.lineTo(x + 12, 116); ctx.lineTo(x - 12, 116); ctx.lineTo(x - 12, 62); ctx.lineTo(x - 34, 62); ctx.closePath(); ctx.fill(); });
    } else {
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-0.05);
      ctx.fillStyle = '#16161a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'italic 900 52px Archivo, Arial, sans-serif';
      ctx.fillText(kind, 0, 0);
      ctx.restore();
    }
  }, 1, 1, false));
  const labelMat = (kind) => (cache['label' + kind] ??= new THREE.MeshStandardMaterial({ map: labelTex(kind), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));

  const lr = rng(99);
  const cardboard = ['#c4965f', '#b98b5a', '#a97c4d', '#d1a46f', '#bd9160'];
  // the scanned box is 0.387 x 0.342 x 0.516 m, base at y=0; tinted copies give some variety
  const scanTints = ['#ffffff', '#f1e3cd', '#e0c8a4', '#fff1dc', '#e8d3b2'];
  let scanMats = null;
  if (boxGltf) {
    let src;
    boxGltf.scene.traverse((o) => { if (o.isMesh) src = o.material; });
    scanMats = scanTints.map((c) => { const m = src.clone(); m.color = new THREE.Color(c); return m; });
  }
  const carton = (w, h, d, color, parent, x, y, z, ry = 0, labels = true) => {
    const g = new THREE.Group();
    if (scanMats) {
      const body = boxGltf.scene.clone(true);
      body.traverse((o) => { if (o.isMesh) { o.material = scanMats[Math.max(0, cardboard.indexOf(color)) % scanMats.length]; o.castShadow = true; o.receiveShadow = true; } });
      const sx = w / 0.387, sy = h / 0.342, sz = d / 0.516;
      body.scale.set(sx, sy, sz);
      body.position.set(0, -h / 2, -0.028 * sz);
      g.add(body);
    } else {
      box(w, h, d, cardMat(color), 0, 0, 0, g, true, 0.012);
      box(0.07, h + 0.008, d + 0.008, tapeMat, 0, 0, 0, g, false, 0.003);
    }
    if (labels) {
      const place = (kind, s, px, py, pz, rot) => {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s / 2), labelMat(kind));
        p.position.set(px, py, pz); p.rotation.y = rot; g.add(p);
      };
      const faces = [[d / 2 + 0.002, 0, w], [-d / 2 - 0.002, Math.PI, w]];
      faces.forEach(([pz, rot, span]) => {
        if (lr() < 0.75) {
          const s = Math.min(span * 0.62, 0.34);
          const word = labelWords[Math.floor(lr() * labelWords.length)];
          place(lr() < 0.2 ? 'FRAGILE' : word, s, (lr() - 0.5) * span * 0.25 + (span > 0.4 ? 0.1 : 0), (lr() - 0.5) * h * 0.3, pz, rot);
          if (h > 0.34 && lr() < 0.5) place('ARROWS', s * 0.5, -span * 0.28, -h * 0.28, pz, rot);
        }
      });
    }
    g.position.set(x, y, z);
    g.rotation.y = ry;
    parent.add(g);
    return g;
  };

  const woodTex = canvasTexture(256, 256, (ctx, w, h) => {
    const r = rng(11);
    ctx.fillStyle = '#e6d2ad'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = `rgba(90,55,20,${0.05 + r() * 0.12})`; ctx.lineWidth = 0.6 + r() * 1.6;
      const y = r() * h; ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 6, w * 0.6, y + (r() - 0.5) * 6, w, y + (r() - 0.5) * 4);
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const x = r() * w, y = r() * h;
      ctx.strokeStyle = 'rgba(80,45,15,0.3)'; ctx.lineWidth = 1.4;
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x, y, 5 * k, 2.2 * k, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
  });
  const woodBump = asData(woodTex);
  const wood = (color) => (cache['wood' + color] ??= new THREE.MeshStandardMaterial({ color, map: woodTex, bumpMap: woodBump, bumpScale: 1, roughness: 0.85 }));

  const quiltTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f1f1f1'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(40,40,50,0.55)'; ctx.lineWidth = 2.5;
    for (let i = -h; i < w + h; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + h, 0); ctx.stroke();
    }
    const r = rng(5);
    for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.06})`; ctx.fillRect(r() * w, r() * h, 2, 2); }
  }, 2, 2);
  const quiltBump = asData(quiltTex);
  const quilt = (color) => (cache['quilt' + color] ??= new THREE.MeshStandardMaterial({ color, map: quiltTex, bumpMap: quiltBump, bumpScale: 2.2, roughness: 0.96 }));

  const bubbleTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 16) for (let x = 8 + ((y / 16) % 2) * 8; x < w; x += 16) {
      const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 7);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#505050');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    }
  }, 3, 3, true, true);

  // ---------- materials ----------
  const paint = new THREE.MeshPhysicalMaterial({ color: '#f1f2f4', roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 });
  const inner = M('#c9ccd2', { roughness: 0.8 });
  const yellow = new THREE.MeshPhysicalMaterial({ color: '#ffc21a', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  const darkBand = M('#2e3036', { roughness: 0.6 });
  const trim = M('#101114', { roughness: 0.55 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0b1118', roughness: 0.04, metalness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const steel = M('#30333a', { roughness: 0.45, metalness: 0.7 });
  const chrome = M('#d8dbe0', { roughness: 0.12, metalness: 1 });
  const rubber = M('#17181b', { roughness: 0.92 });
  const alloy = M('#b9bdc4', { roughness: 0.3, metalness: 0.9 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 2.4 });
  const lamp = (c, e, i) => new THREE.MeshPhysicalMaterial({ color: c, emissive: e, emissiveIntensity: i, roughness: 0.1, clearcoat: 1 });

  // ---------- room ----------
  const floorColor = canvasTexture(2048, 2048, (ctx, w, h) => {
    const r = rng(7);
    ctx.fillStyle = '#5a5d64'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const x = r() * w, y = r() * h, rad = 40 + r() * 220;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, r() > 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 40000; i++) { ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    [w / 3, (2 * w) / 3].forEach((x) => { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 2, 0, 4, h); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 2, 0, 2, h); });
    [h / 3, (2 * h) / 3].forEach((y) => { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, y - 2, w, 4); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, y + 2, w, 2); });
    ctx.lineCap = 'round';
    [-0.95, 0.95].forEach((wx) => {
      const x = ((wx + 5.2) / 10.4) * w;
      ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 34;
      ctx.beginPath(); ctx.moveTo(x, h); ctx.bezierCurveTo(x + 40, h * 0.8, x - 30, h * 0.7, x, h * 0.55); ctx.stroke();
    });
    for (let i = 0; i < 9; i++) {
      const x = r() * w, y = h * (0.45 + r() * 0.5), rad = 20 + r() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(10,10,12,0.4)'); g.addColorStop(1, 'rgba(10,10,12,0)');
      ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
  const floorRough = canvasTexture(512, 512, (ctx, w, h) => {
    const r = rng(13);
    ctx.fillStyle = 'rgb(160,160,160)'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, r() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 6000; i++) { ctx.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0,0.05)`; ctx.fillRect(r() * w, r() * h, 1, 1); }
  }, 1, 1, false, true);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10.4, 9.4),
    new THREE.MeshStandardMaterial({ map: floorColor, roughnessMap: floorRough, roughness: 1, bumpMap: floorRough, bumpScale: 0.6, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.3);
  floor.receiveShadow = true;
  scene.add(floor);
  if (floorScan) {
    // scanned concrete in 2 m tiles, with slab joints, tyre tracks and stains laid over it
    floor.material = pbrMaterial(floorScan, 3.5, 3.1, { color: '#8e9096', normalScale: new THREE.Vector2(2.2, 2.2) });
    const wear = canvasTexture(2048, 2048, (ctx, w, h) => {
      const r = rng(17);
      ctx.clearRect(0, 0, w, h);
      [w / 3, (2 * w) / 3].forEach((x) => { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 2, 0, 4, h); });
      [h / 3, (2 * h) / 3].forEach((y) => { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, y - 2, w, 4); });
      ctx.lineCap = 'round';
      [-0.95, 0.95].forEach((wx) => {
        const x = ((wx + 5.2) / 10.4) * w;
        ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 34;
        ctx.beginPath(); ctx.moveTo(x, h); ctx.bezierCurveTo(x + 40, h * 0.8, x - 30, h * 0.7, x, h * 0.55); ctx.stroke();
      });
      for (let i = 0; i < 9; i++) {
        const x = r() * w, y = h * (0.45 + r() * 0.5), rad = 20 + r() * 50;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, 'rgba(10,10,12,0.5)'); g.addColorStop(1, 'rgba(10,10,12,0)');
        ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }, 1, 1, false);
    const wearPlane = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 9.4), new THREE.MeshStandardMaterial({ map: wear, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    wearPlane.rotation.x = -Math.PI / 2;
    wearPlane.position.set(0, 0.002, 0.3);
    wearPlane.receiveShadow = true;
    scene.add(wearPlane);
  }

  const wallColor = (seed) => canvasTexture(2048, 512, (ctx, w, h) => {
    const r = rng(seed);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#9ca2ac'); g.addColorStop(1, '#6e737c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, sw = 2 + r() * 12, sh = 120 + r() * 380;
      const gr = ctx.createLinearGradient(0, 0, 0, sh);
      gr.addColorStop(0, `rgba(20,20,24,${0.05 + r() * 0.08})`); gr.addColorStop(1, 'rgba(20,20,24,0)');
      ctx.fillStyle = gr; ctx.fillRect(x, 0, sw, sh);
    }
    const gb = ctx.createLinearGradient(0, h - 150, 0, h);
    gb.addColorStop(0, 'rgba(10,10,12,0)'); gb.addColorStop(1, 'rgba(10,10,12,0.5)');
    ctx.fillStyle = gb; ctx.fillRect(0, h - 150, w, 150);
  }, 1, 1, false);
  const ribNormal = canvasTexture(256, 4, (ctx, w, h) => {
    for (let x = 0; x < w; x++) {
      const dh = Math.cos((x / 32) * Math.PI * 2) * 0.9;
      const len = Math.hypot(dh, 1);
      ctx.fillStyle = `rgb(${Math.round((-dh / len * 0.5 + 0.5) * 255)},128,${Math.round((1 / len * 0.5 + 0.5) * 255)})`;
      ctx.fillRect(x, 0, 1, h);
    }
  }, 17, 1, true, true);
  const wallMat = (len, seed) => {
    const nm = ribNormal.clone();
    nm.repeat.set(len / 0.6, 1);
    nm.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: wallColor(seed), normalMap: nm, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.55, metalness: 0.45 });
  };
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 3.4), wallMat(10.4, 31));
  backWall.position.set(0, 1.7, -4.4);
  backWall.receiveShadow = true;
  scene.add(backWall);
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 3.4), wallMat(9.4, 47));
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-5.2, 1.7, 0.3);
  leftWall.receiveShadow = true;
  scene.add(leftWall);
  if (wallScan) {
    const scanWall = (len) => {
      const c = { map: wallScan.map.clone(), normalMap: wallScan.normalMap.clone(), roughnessMap: wallScan.roughnessMap.clone() };
      Object.values(c).forEach((t) => { t.needsUpdate = true; });
      return pbrMaterial(c, len / 2.4, 3.4 / 2.4, { metalness: 0.5, color: '#eef0f4', normalScale: new THREE.Vector2(1.8, 1.8) });
    };
    backWall.material = scanWall(10.4);
    leftWall.material = scanWall(9.4);
  }

  box(10.4, 0.18, 0.1, M('#22242a', { roughness: 0.6 }), 0, 0.09, -4.35, scene, false);
  box(0.1, 0.18, 9.4, M('#22242a', { roughness: 0.6 }), -5.15, 0.09, 0.3, scene, false);
  // conduit and a junction box along the wall
  cyl(0.025, 0.025, 10.2, steel, 0, 2.95, -4.36, scene, 10).rotation.z = Math.PI / 2;
  cyl(0.025, 0.025, 9.2, steel, -5.16, 2.95, 0.3, scene, 10).rotation.x = Math.PI / 2;
  box(0.22, 0.28, 0.1, M('#cfd2d6', { roughness: 0.5, metalness: 0.4 }), 2.6, 2.7, -4.34);
  // steel column in the corner, with hazard stripes
  box(0.32, 3.4, 0.32, M('#2a2d33', { roughness: 0.5, metalness: 0.6 }), -5.0, 1.7, -4.2);
  for (let i = 0; i < 4; i++) box(0.33, 0.12, 0.33, i % 2 ? M('#101114') : yellow, -5.0, 0.13 + i * 0.13, -4.2, scene, false, 0.004);

  // unit number sign
  const signTex = canvasTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#ffc21a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#17181d'; ctx.lineWidth = 14; ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.fillStyle = '#17181d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 104px Archivo, Arial, sans-serif';
    ctx.fillText('UNIT 14', w / 2, h / 2 + 6);
  }, 1, 1, false);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.525), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4, metalness: 0.2 }));
  sign.position.set(0, 2.85, -4.34);
  scene.add(sign);

  // floor markings round the van's bay
  const paintLine = M('#e8b410', { roughness: 0.5 });
  box(0.1, 0.006, 7.2, paintLine, -1.7, 0.004, 0.1, scene, false);
  box(0.1, 0.006, 7.2, paintLine, 1.7, 0.004, 0.1, scene, false);
  box(3.5, 0.006, 0.1, paintLine, 0, 0.004, 3.7, scene, false);

  // ceiling beams and strip lights
  [-2.4, 0.9, 4.0].forEach((z) => box(10.4, 0.22, 0.2, M('#202228', { roughness: 0.5, metalness: 0.5 }), 0, 3.45, z, scene, false));
  [-1.0, 2.2].forEach((z) => {
    box(2.0, 0.07, 0.2, glow, 0, 3.0, z, scene, false);
    box(2.06, 0.03, 0.26, steel, 0, 3.05, z, scene, false);
    [-0.8, 0.8].forEach((x) => cyl(0.008, 0.008, 0.4, steel, x, 3.25, z, scene, 6));
  });

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x3a3f4a, 0.35));
  const sun = new THREE.DirectionalLight(0xfff4e6, 1.5);
  sun.position.set(5, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 30 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  [-1.0, 2.2].forEach((z) => {
    const l = new THREE.RectAreaLight(0xfff1dc, 11, 2.0, 0.2);
    l.position.set(0, 2.95, z);
    l.lookAt(0, 0, z);
    scene.add(l);
  });

  // ---------- the van ----------
  const van = new THREE.Group();
  van.position.set(0, 0, -0.3);
  scene.add(van);

  // chassis, so nothing looks hollow between the wheels
  box(1.9, 0.22, 5.1, M('#16171a', { roughness: 0.8 }), 0, 0.4, -0.45, van, false);

  // cab and bonnet: one body with a raked windscreen
  const cab = new THREE.Shape();
  cab.moveTo(0.9, 0.5); cab.lineTo(3.0, 0.5); cab.lineTo(3.08, 0.62); cab.lineTo(3.1, 1.0);
  cab.quadraticCurveTo(3.1, 1.2, 2.9, 1.24); cab.lineTo(2.5, 1.34); cab.lineTo(1.95, 2.34);
  cab.quadraticCurveTo(1.9, 2.5, 1.7, 2.5); cab.lineTo(0.9, 2.5); cab.closePath();
  const cabGeo = new THREE.ExtrudeGeometry(cab, { depth: 1.88, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 4, curveSegments: 14 });
  cabGeo.rotateY(Math.PI / 2);
  cabGeo.translate(-0.94, 0, 0);
  const cabMesh = new THREE.Mesh(cabGeo, paint);
  cabMesh.castShadow = true; cabMesh.receiveShadow = true;
  van.add(cabMesh);

  const windscreen = box(1.74, 1.0, 0.02, glass, 0, 1.897, -2.256, van, false, 0.004);
  windscreen.rotation.x = 0.5028;
  const sideGlass = new THREE.Shape();
  sideGlass.moveTo(1.05, 1.62); sideGlass.lineTo(1.05, 2.28); sideGlass.lineTo(1.88, 2.28); sideGlass.lineTo(2.2, 1.62); sideGlass.closePath();
  const sideGeo = new THREE.ShapeGeometry(sideGlass);
  sideGeo.rotateY(Math.PI / 2);

  // cargo area: hollow, with the rear open
  const wallPanel = (side) => {
    const faces = side < 0 ? [inner, paint, paint, paint, paint, paint] : [paint, inner, paint, paint, paint, paint];
    box(0.06, 2.0, 3.0, faces, side * 0.97, 1.5, 0.6, van);
  };
  wallPanel(-1); wallPanel(1);
  box(2.0, 0.06, 3.0, [paint, paint, paint, inner, paint, paint], 0, 2.47, 0.6, van);
  box(1.94, 0.06, 3.0, [inner, inner, wood('#cfa970'), M('#2b2d33'), inner, inner], 0, 0.53, 0.6, van);
  // inside: plywood lining low down, ribs, a tie-down rail
  [-1, 1].forEach((s) => {
    box(0.02, 1.0, 2.94, wood('#c7a26b'), s * 0.925, 1.05, 0.6, van, false, 0.004);
    for (let z = -0.55; z <= 1.9; z += 0.62) box(0.03, 1.9, 0.07, M('#aeb2ba', { roughness: 0.6 }), s * 0.935, 1.5, z, van, false, 0.008);
    box(0.02, 0.035, 2.9, steel, s * 0.92, 1.45, 0.6, van, false, 0.004);
  });
  box(1.6, 0.025, 0.14, glow, 0, 2.43, 0.6, van, false, 0.004);

  // front end
  box(1.98, 0.28, 0.24, darkBand, 0, 0.43, -3.14, van);                  // bumper
  box(1.1, 0.26, 0.03, trim, 0, 1.0, -3.16, van, false);                  // grille
  [-0.2, -0.1, 0, 0.1, 0.2].forEach((dy) => box(1.06, 0.012, 0.012, steel, 0, 1.0 + dy * 0.9, -3.175, van, false, 0.003));
  cyl(0.07, 0.07, 0.018, chrome, 0, 1.0, -3.175, van, 24).rotation.x = Math.PI / 2;
  box(1.2, 0.12, 0.03, trim, 0, 0.62, -3.15, van, false);                // lower intake
  [-1, 1].forEach((s) => {
    box(0.4, 0.17, 0.06, lamp('#e9eef7', '#cfe0ff', 0.8), s * 0.7, 1.12, -3.12, van, false, 0.03);     // headlamps
    box(0.14, 0.06, 0.05, lamp('#ff9d1c', '#ff8a00', 0.7), s * 0.93, 1.12, -3.1, van, false, 0.02);     // indicators
    box(0.16, 0.12, 0.04, lamp('#e9eef7', '#ffffff', 0.5), s * 0.85, 0.66, -3.15, van, false, 0.02);     // fog lamps
    // cab side window, handle, mirror
    const sg = new THREE.Mesh(sideGeo, glass);
    sg.position.x = s * 1.004;
    van.add(sg);
    box(0.05, 0.05, 0.24, chrome, s * 1.03, 1.55, -0.98, van, false, 0.02);
    box(0.012, 1.55, 0.012, trim, s * 1.006, 1.38, -0.97, van, false);          // door shut lines
    box(0.012, 1.0, 0.012, trim, s * 1.006, 1.38, -2.1, van, false);
    box(0.012, 0.012, 1.15, trim, s * 1.006, 0.82, -1.55, van, false);
    box(0.1, 0.26, 0.2, trim, s * 1.2, 1.92, -2.0, van, true, 0.04);
    box(0.2, 0.03, 0.03, trim, s * 1.08, 1.85, -1.98, van, false);
    box(0.01, 0.2, 0.15, glass, s * 1.145, 1.92, -2.0, van, false);
    // tail lamps and reflectors
    box(0.1, 0.46, 0.05, lamp('#b01f1f', '#ff2a2a', 0.5), s * 0.93, 1.05, 2.13, van, false, 0.02);
    box(0.1, 0.1, 0.04, M('#d84a1b', { roughness: 0.2 }), s * 0.93, 0.74, 2.13, van, false, 0.015);
  });
  // wipers
  [-0.55, 0.15].forEach((x) => { const w = box(0.02, 0.62, 0.012, trim, x, 1.7, -2.27, van, false); w.rotation.x = 0.5028; w.rotation.z = -0.5; });

  box(2.0, 0.22, 0.2, darkBand, 0, 0.4, 2.2, van);                         // rear bumper / step
  box(0.5, 0.13, 0.02, M('#f6df6b', { roughness: 0.3 }), 0, 0.46, 2.31, van, false, 0.005); // number plate

  // body bands and cab-door chequered kick strip
  [-1, 1].forEach((s) => {
    box(0.02, 0.28, 4.4, yellow, s * 1.011, 1.2, -0.1, van, false, 0.004);
    box(0.02, 0.25, 4.4, darkBand, s * 1.011, 0.65, -0.1, van, false, 0.004);
  });

  // livery
  const liveryTex = canvasTexture(1680, 540, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(190, 190); ctx.rotate(-0.14);
    ctx.fillStyle = '#ffc21a';
    ctx.beginPath(); ctx.roundRect(-120, -120, 240, 240, 40); ctx.fill();
    ctx.fillStyle = '#17181d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 190px Archivo, Arial, sans-serif';
    ctx.fillText('&', 0, 14);
    ctx.restore();
    ctx.fillStyle = '#17181d'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '900 150px Archivo, Arial, sans-serif';
    ctx.fillText('Shift & Settle', 360, 210);
    ctx.font = '800 66px Archivo, Arial, sans-serif';
    ctx.fillText('We shift it. You settle in.', 364, 330);
    ctx.font = '700 52px Archivo, Arial, sans-serif';
    ctx.fillStyle = '#4a4d55';
    ctx.fillText('Houses · Offices · Shops · Art', 364, 420);
    ctx.textAlign = 'right';
    ctx.fillText('shiftandsettle.co.uk', w - 40, 500);
  }, 1, 1, false);
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(2.85, 0.916),
      new THREE.MeshPhysicalMaterial({ map: liveryTex, transparent: true, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    p.rotation.y = s * Math.PI / 2;
    p.position.set(s * 1.0125, 1.9, 0.6);
    van.add(p);
  });

  // wheels: treaded tyre, steel wheel with lug nuts
  const treadTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#4a4a4a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f0f0f0';
    for (let x = 0; x < w; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 14, h / 2); ctx.lineTo(x + 4, h / 2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 8, h / 2); ctx.lineTo(x + 18, h / 2); ctx.lineTo(x + 14, h); ctx.lineTo(x + 4, h); ctx.closePath(); ctx.fill();
    }
  }, 28, 1, true, true);
  const treadMat = new THREE.MeshStandardMaterial({ color: '#17181b', roughness: 0.95, bumpMap: treadTex, bumpScale: 3 });
  const archMat = M('#0c0d0f', { roughness: 0.9 });
  [-1.9, 1.3].forEach((z) => [-1, 1].forEach((s) => {
    const w = new THREE.Group();
    w.position.set(s * 1.0, 0.4, z);
    w.rotation.z = Math.PI / 2;
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 40), [treadMat, rubber, rubber]);
    tyre.castShadow = true; tyre.receiveShadow = true;
    w.add(tyre);
    cyl(0.27, 0.27, 0.31, alloy, 0, 0, 0, w, 32);
    cyl(0.2, 0.2, 0.32, M('#9aa0a8', { roughness: 0.4, metalness: 0.8 }), 0, 0, 0, w, 32);
    cyl(0.08, 0.08, 0.34, chrome, 0, 0, 0, w, 20);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      cyl(0.022, 0.022, 0.335, steel, Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14, w, 8);
    }
    van.add(w);
    const arch = cyl(0.47, 0.47, 0.03, archMat, s * 1.0, 0.4, z, van, 32);
    arch.rotation.z = Math.PI / 2;
    arch.castShadow = false;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.022, 8, 40), trim);
    lip.rotation.y = Math.PI / 2;
    lip.position.set(s * 1.012, 0.4, z);
    van.add(lip);
  }));

  // rear doors, swung wide open
  [-1, 1].forEach((s) => {
    const hinge = new THREE.Group();
    hinge.position.set(s * 1.0, 0, 2.1);
    hinge.rotation.y = s * 1.8;
    const door = new THREE.Group();
    door.position.x = -s * 0.485;
    hinge.add(door);
    box(0.97, 1.92, 0.06, [paint, paint, paint, paint, paint, inner], 0, 1.51, 0, door);
    box(0.97, 0.28, 0.01, yellow, 0, 1.2, 0.036, door, false, 0.002);
    box(0.5, 0.5, 0.01, glass, 0, 1.95, 0.036, door, false, 0.002);
    box(0.04, 0.22, 0.04, chrome, -s * 0.38, 1.5, 0.05, door, false, 0.012);
    [0.75, 1.5, 2.2].forEach((y) => box(0.05, 0.12, 0.08, steel, s * 0.46, y, -0.01, door, false, 0.01));
    box(0.012, 1.9, 0.012, trim, -s * 0.485, 1.51, 0.03, door, false);
    van.add(hinge);
  });

  // what's already loaded inside
  const load = new THREE.Group();
  van.add(load);
  carton(0.8, 0.6, 0.6, cardboard[0], load, -0.5, 0.86, -0.45);
  carton(0.7, 0.5, 0.55, cardboard[1], load, -0.5, 1.41, -0.45, 0.08);
  carton(0.8, 0.6, 0.6, cardboard[3], load, 0.45, 0.86, -0.45);
  carton(0.6, 0.55, 0.5, cardboard[2], load, 0.45, 1.43, -0.45, -0.1);
  carton(0.75, 0.55, 0.6, cardboard[4], load, 0.45, 0.83, 0.25);
  box(0.9, 0.45, 0.7, quilt('#4b5668'), -0.45, 0.78, 0.35, load, true, 0.07);          // blanket-wrapped piece
  box(0.92, 0.035, 0.1, M('#e0a30c', { roughness: 0.5 }), -0.45, 1.02, 0.35, load, false, 0.004);
  box(0.92, 0.035, 0.1, M('#e0a30c', { roughness: 0.5 }), -0.45, 1.02, 0.6, load, false, 0.004);
  box(0.1, 0.07, 0.06, chrome, -0.02, 1.03, 0.47, load, false, 0.01);
  const vanLight = new THREE.PointLight(0xfff0d6, 1.2, 4.5, 2);
  vanLight.position.set(0, 2.2, 0.8);
  van.add(vanLight);

  contact(0, -0.4, 2.7, 6.2, 0.9);

  // ---------- sack truck with boxes, beside the back door ----------
  const truck = new THREE.Group();
  truck.position.set(2.1, 0, 3.0);
  truck.rotation.y = 3.785;
  scene.add(truck);
  if (truckGltf) {
    // scanned hand truck: frame at the back, nose plate pointing +z; boxes sit on the plate
    const hand = truckGltf.scene.clone(true);
    castAll(hand);
    truck.add(hand);
    truck.rotation.y = 0.6435;
    carton(0.5, 0.38, 0.4, cardboard[0], truck, 0, 0.26, 0.27);
    carton(0.46, 0.36, 0.36, cardboard[3], truck, 0.01, 0.63, 0.27, 0.05);
    carton(0.4, 0.3, 0.32, cardboard[2], truck, -0.01, 0.96, 0.27, -0.06);
    box(0.04, 1.08, 0.01, M('#e0a30c', { roughness: 0.5 }), 0, 0.6, 0.475, truck, false, 0.002);
  }
  const frameMat = new THREE.MeshPhysicalMaterial({ color: '#ffc21a', roughness: 0.4, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  if (!truckGltf) {
  [-0.2, 0.2].forEach((x) => cyl(0.016, 0.016, 1.3, frameMat, x, 0.75, 0.02, truck, 12));
  [0.35, 0.8].forEach((y) => { const c = cyl(0.012, 0.012, 0.4, frameMat, 0, y, 0.02, truck, 10); c.rotation.z = Math.PI / 2; });
  const grip = cyl(0.026, 0.026, 0.46, rubber, 0, 1.42, 0.02, truck, 14);
  grip.rotation.z = Math.PI / 2;
  [-0.2, 0.2].forEach((x) => cyl(0.018, 0.018, 0.06, frameMat, x, 1.38, 0.02, truck, 10));
  box(0.44, 0.02, 0.36, steel, 0, 0.04, -0.17, truck);                                  // toe plate
  [-0.27, 0.27].forEach((x) => {
    const tyre = cyl(0.115, 0.115, 0.06, rubber, x, 0.115, 0.04, truck, 24);
    tyre.rotation.z = Math.PI / 2;
    const hub = cyl(0.05, 0.05, 0.07, alloy, x, 0.115, 0.04, truck, 16);
    hub.rotation.z = Math.PI / 2;
  });
  const axle = cyl(0.01, 0.01, 0.6, steel, 0, 0.115, 0.04, truck, 8);
  axle.rotation.z = Math.PI / 2;
  carton(0.5, 0.4, 0.4, cardboard[0], truck, 0, 0.255, -0.2);
  carton(0.46, 0.36, 0.36, cardboard[3], truck, 0.01, 0.635, -0.2, 0.05);
  carton(0.4, 0.3, 0.32, cardboard[2], truck, -0.01, 0.965, -0.2, -0.06);
  box(0.04, 1.1, 0.01, M('#e0a30c', { roughness: 0.5 }), 0, 0.62, -0.405, truck, false, 0.002);   // ratchet strap
  box(0.08, 0.06, 0.03, chrome, 0.0, 0.7, -0.42, truck, false, 0.008);
  }
  contact(2.1, 3.0, 1.0, 1.0, 0.8);

  // flat four-wheel dolly with moving blankets, on the other side
  const dolly = new THREE.Group();
  dolly.position.set(-2.5, 0, 3.2);
  dolly.rotation.y = 0.35;
  scene.add(dolly);
  box(1.0, 0.07, 0.62, wood('#8a5f3a'), 0, 0.2, 0, dolly);
  [[-0.42, -0.25], [0.42, -0.25], [-0.42, 0.25], [0.42, 0.25]].forEach(([x, z]) => {
    const c = cyl(0.065, 0.065, 0.05, rubber, x, 0.075, z, dolly, 18);
    c.rotation.z = Math.PI / 2;
    cyl(0.012, 0.012, 0.06, steel, x, 0.15, z, dolly, 8);
  });
  box(0.9, 0.12, 0.54, quilt('#4b5668'), 0, 0.29, 0, dolly, true, 0.04);
  box(0.9, 0.1, 0.54, quilt('#b86a2d'), 0.02, 0.4, 0, dolly, true, 0.04);
  box(0.9, 0.1, 0.54, quilt('#4b5668'), -0.02, 0.5, 0, dolly, true, 0.04);
  contact(-2.5, 3.2, 1.5, 1.0, 0.8, -0.35);

  // ---------- shelving along the back wall ----------
  const r = rng(21);
  const upright = M('#262a33', { roughness: 0.45, metalness: 0.65 });
  const beam = new THREE.MeshPhysicalMaterial({ color: '#f0a30a', roughness: 0.45, metalness: 0.25, clearcoat: 0.4 });
  const tub = new THREE.MeshPhysicalMaterial({ color: '#3b3e46', roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const tubLid = new THREE.MeshPhysicalMaterial({ color: '#5a5e69', roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  // fills one shelf (from sx, seg metres long) with a random mix of cartons, tubs, tins and boxes
  const fillShelf = (sx, seg, top, z, maxH, maxD, lift) => {
    let cursor = sx + 0.08;
    while (cursor < sx + seg - 0.3) {
      if (r() < 0.12) { cursor += 0.3; continue; }
      const w = 0.25 + r() * 0.3, h = Math.min(maxH, 0.2 + r() * 0.38), d = Math.min(maxD, 0.3 + r() * 0.24);
      if (cursor + w > sx + seg - 0.06) break;
      const k = r();
      const px = cursor + w / 2, py = top + lift + h / 2, pz = z + (r() - 0.5) * 0.06;
      if (k < 0.18) {
        box(w, h, d, tub, px, py, pz, scene, true, 0.03);
        box(w + 0.02, 0.04, d + 0.02, tubLid, px, py + h / 2 + 0.02, pz, scene, true, 0.015);
      } else if (k < 0.26) {
        cyl(0.09, 0.09, 0.14, M('#c9ccd2', { roughness: 0.3, metalness: 0.9 }), px, top + lift + 0.07, pz, scene, 20);
        cyl(0.075, 0.075, 0.02, M('#2c6fb3', { roughness: 0.4 }), px, top + lift + 0.15, pz, scene, 20);
        cursor += 0.14;
        continue;
      } else if (k < 0.4) {
        box(w, h, d, M('#e6e7ea', { roughness: 0.8 }), px, py, pz, scene, true, 0.012);
        box(0.06, h + 0.008, d + 0.008, tapeMat, px, py, pz, scene, false, 0.003);
      } else {
        carton(w, h, d, cardboard[Math.floor(r() * cardboard.length)], scene, px, py, pz);
      }
      cursor += w + 0.03 + r() * 0.08;
    }
  };
  const shelfBay = (x0) => {
    const seg = 1.7, z = -4.05;
    [0, 1, 2].forEach((i) => [-0.29, 0.29].forEach((dz) => box(0.07, 2.6, 0.07, upright, x0 + i * seg, 1.3, z + dz, scene, true, 0.01)));
    [0.1, 0.85, 1.6, 2.35].forEach((top) => {
      [0, 1].forEach((i) => {
        const sx = x0 + i * seg;
        box(seg - 0.07, 0.07, 0.6, beam, sx + seg / 2, top - 0.035, z, scene, true, 0.012);
        box(seg - 0.09, 0.022, 0.58, wood('#d9bd8c'), sx + seg / 2, top + 0.011, z, scene, false, 0.004);
        fillShelf(sx, seg, top, z, 0.58, 0.54, 0.022);
      });
    });
    [-0.29, 0.29].forEach((dz) => [0, 1, 2].forEach((i) => box(0.2, 0.012, 0.2, steel, x0 + i * seg, 0.006, z + dz, scene, false, 0.003)));
  };
  if (shelfGltf) {
    // scanned steel shelving, 1.1 m wide x 2.14 m tall x 0.5 m deep (the model is in decimetres)
    [2.05, 3.15, 4.25, -2.05, -3.15, -4.25].forEach((cx) => {
      const unit = shelfGltf.scene.clone(true);
      castAll(unit);
      unit.scale.setScalar(0.1);
      unit.position.set(cx, 0, -4.13);
      scene.add(unit);
      [0.15, 0.65, 1.15, 1.65].forEach((top) => fillShelf(cx - 0.5, 1.0, top, -4.13, 0.4, 0.42, 0.01));
    });
  } else {
    shelfBay(1.5);
    shelfBay(-4.9);
  }
  contact(3.2, -4.05, 3.9, 1.0, 0.7);
  contact(-3.2, -4.05, 3.9, 1.0, 0.7);

  // fire extinguisher by the sign
  const extMat = new THREE.MeshPhysicalMaterial({ color: '#c02a2a', roughness: 0.35, clearcoat: 0.8 });
  cyl(0.08, 0.08, 0.45, extMat, -1.15, 1.15, -4.28);
  cyl(0.03, 0.03, 0.1, steel, -1.15, 1.43, -4.28, scene, 10);
  box(0.2, 0.03, 0.06, steel, -1.15, 1.3, -4.34, scene, false, 0.006);
  box(0.3, 0.3, 0.01, M('#c02a2a', { roughness: 0.4 }), -1.15, 1.7, -4.36, scene, false, 0.002);

  // ---------- clutter along the left wall ----------
  const mattressWrap = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.14, roughness: 0.15, clearcoat: 1, depthWrite: false });
  const mattress = box(0.2, 1.9, 1.0, quilt('#f3efe6'), -4.9, 0.96, 1.6, scene, true, 0.06);
  mattress.rotation.z = 0.1;
  const mWrap = box(0.23, 1.93, 1.03, mattressWrap, -4.9, 0.96, 1.6, scene, false, 0.07);
  mWrap.rotation.z = 0.1;
  const carpetSide = new THREE.MeshStandardMaterial({ color: '#7a4b3a', roughness: 1, bumpMap: bubbleTex, bumpScale: 0.4 });
  const carpetCap = new THREE.MeshStandardMaterial({ color: '#6b4030', roughness: 1 });
  const carpet = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 2.0, 32), [carpetSide, carpetCap, carpetCap]);
  carpet.position.set(-4.85, 1.0, 2.55);
  carpet.rotation.z = 0.08;
  carpet.castShadow = true; carpet.receiveShadow = true;
  scene.add(carpet);
  [0.6, -0.6].forEach((dy) => { const t = cyl(0.176, 0.176, 0.04, tapeMat, -4.85 + dy * -0.08, 1.0 + dy, 2.55, scene, 28); t.rotation.z = 0.08; });
  // crate for a painting: planed timber with stencilled lettering
  const crate = new THREE.Group();
  crate.position.set(-4.93, 0, 0.35);
  crate.rotation.z = 0.12;
  crate.rotation.y = 0.04;
  scene.add(crate);
  box(0.16, 1.4, 1.1, wood('#c8a574'), 0, 0.72, 0, crate);
  [-0.5, 0, 0.5].forEach((z) => box(0.2, 1.42, 0.07, wood('#b8935f'), 0.01, 0.72, z, crate, true, 0.008));
  [0.05, 1.4].forEach((y) => box(0.2, 0.07, 1.14, wood('#b8935f'), 0.01, y, 0, crate, true, 0.008));
  const stencil = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), new THREE.MeshStandardMaterial({
    map: canvasTexture(256, 110, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#1b1b1f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 58px Archivo, Arial, sans-serif'; ctx.fillText('ART', w / 2, 36);
      ctx.font = '800 30px Archivo, Arial, sans-serif'; ctx.fillText('HANDLE WITH CARE', w / 2, 84);
    }, 1, 1, false), transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
  }));
  stencil.rotation.y = Math.PI / 2;
  stencil.position.set(0.105, 0.8, 0);
  crate.add(stencil);
  // bubble-wrapped frames
  const wrapMat = new THREE.MeshPhysicalMaterial({ color: '#eaf2f7', transparent: true, opacity: 0.55, roughness: 0.2, bumpMap: bubbleTex, bumpScale: 2, clearcoat: 1, depthWrite: false });
  [[-4.7, 0.9, 0.75, 0.095], [-4.75, 0.7, 0.55, 0.085]].forEach(([x, h, w, tilt], i) => {
    const f = box(0.04, h, w, M('#2a2018', { roughness: 0.6 }), x, h / 2, -0.95 + i * 0.4, scene);
    f.rotation.z = tilt;
    const wr = box(0.07, h + 0.04, w + 0.04, wrapMat, x, h / 2, -0.95 + i * 0.4, scene, false, 0.02);
    wr.rotation.z = tilt;
  });
  const sofa = new THREE.Group();
  sofa.position.set(-4.0, 0, 3.0);
  sofa.rotation.y = 0.06;
  scene.add(sofa);
  const blanket = quilt('#4b5668');
  box(0.95, 0.45, 1.9, blanket, 0, 0.3, 0, sofa, true, 0.1);
  box(0.26, 0.6, 1.9, blanket, -0.35, 0.75, 0, sofa, true, 0.1);
  box(0.95, 0.5, 0.22, blanket, 0, 0.55, -0.84, sofa, true, 0.1);
  box(0.95, 0.5, 0.22, blanket, 0, 0.55, 0.84, sofa, true, 0.1);
  [-0.4, 0.4].forEach((z) => box(0.99, 0.5, 0.045, M('#d99a0c', { roughness: 0.5 }), 0, 0.33, z, sofa, false, 0.01));
  contact(-4.0, 3.0, 1.6, 2.4, 0.8);
  const broomStick = cyl(0.014, 0.014, 1.55, wood('#b08a58'), -5.02, 0.78, -1.3, scene, 8);
  broomStick.rotation.z = 0.06;
  box(0.06, 0.05, 0.32, M('#2b2d33'), -4.93, 0.04, -1.3, scene, true, 0.012);

  // ---------- pallet stack and tubs on the right ----------
  const pallet = new THREE.Group();
  pallet.position.set(3.7, 0, 2.2);
  pallet.rotation.y = 0.12;
  scene.add(pallet);
  const timber = wood('#b8935f');
  [-0.4, 0, 0.4].forEach((x) => [-0.4, 0, 0.4].forEach((z) => box(0.14, 0.1, 0.14, timber, x, 0.07, z, pallet, true, 0.008)));
  [-0.45, -0.22, 0, 0.22, 0.45].forEach((z) => box(1.2, 0.025, 0.14, timber, 0, 0.14, z, pallet, true, 0.006));
  [-0.4, 0, 0.4].forEach((x) => box(0.14, 0.025, 1.2, timber, x, 0.0125, 0, pallet, true, 0.006));
  carton(0.55, 0.45, 0.5, cardboard[0], pallet, -0.3, 0.39, -0.25);
  carton(0.55, 0.45, 0.5, cardboard[1], pallet, 0.3, 0.39, -0.25, 0.04);
  carton(0.55, 0.45, 0.5, cardboard[4], pallet, -0.3, 0.39, 0.3);
  carton(0.55, 0.45, 0.5, cardboard[2], pallet, 0.3, 0.39, 0.3, -0.05);
  carton(0.5, 0.4, 0.5, cardboard[3], pallet, -0.28, 0.82, -0.25, 0.1);
  carton(0.5, 0.4, 0.5, cardboard[0], pallet, 0.3, 0.82, 0.3, -0.08);
  const wrap = box(1.22, 1.0, 1.22, new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.08, clearcoat: 1, depthWrite: false }), 0, 0.64, 0, pallet, false, 0.05);
  wrap.receiveShadow = false;
  contact(3.7, 2.2, 1.9, 1.9, 0.85, 0.12);

  [[3.1, 3.9, 0.1], [3.15, 3.9, -0.15]].forEach(([x, z, ry], i) => {
    box(0.6, 0.38, 0.4, tub, x, 0.19 + i * 0.4, z, scene, true, 0.04).rotation.y = ry;
    box(0.62, 0.04, 0.42, tubLid, x, 0.4 + i * 0.4, z, scene, true, 0.02).rotation.y = ry;
  });
  contact(3.1, 3.9, 1.0, 0.8, 0.8);

  // ---------- controls, resize, loop ----------
  const fit = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(0.364, 0.647 / camera.aspect)));
    camera.updateProjectionMatrix();
  };
  fit();
  new ResizeObserver(fit).observe(host);

  const setSpin = (on) => { controls.autoRotate = on && !reduceMotion; };
  let resume = 0;
  controls.addEventListener('start', () => { setSpin(false); clearTimeout(resume); });
  controls.addEventListener('end', () => { resume = setTimeout(() => setSpin(true), 4000); });
  setSpin(true);

  host.querySelectorAll('[data-zoom]').forEach((btn) => btn.addEventListener('click', () => {
    const offset = camera.position.clone().sub(controls.target);
    const len = THREE.MathUtils.clamp(offset.length() * (btn.dataset.zoom === 'in' ? 0.8 : 1.25), controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setLength(len));
  }));

  let ready = false;
  const frame = () => {
    controls.update();
    renderer.render(scene, camera);
    if (!ready) { ready = true; host.classList.add('is-ready'); }
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      renderer.setAnimationLoop(entries.some((e) => e.isIntersecting) ? frame : null);
    }).observe(host);
  } else {
    renderer.setAnimationLoop(frame);
  }
}
