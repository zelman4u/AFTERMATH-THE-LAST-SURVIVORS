import * as THREE from 'three';

export interface WorldTextures {
  groundMap: THREE.CanvasTexture;
  groundBump: THREE.CanvasTexture;
  asphaltMap: THREE.CanvasTexture;
  concreteMap: THREE.CanvasTexture;
  corrugatedMap: THREE.CanvasTexture;
  woodMap: THREE.CanvasTexture;
  barkMap: THREE.CanvasTexture;
  pineFoliageMap: THREE.CanvasTexture;
  grassBladeMap: THREE.CanvasTexture;
  windowFacadeMap: THREE.CanvasTexture;
  fabricMap: THREE.CanvasTexture;
  faceSkinMap: THREE.CanvasTexture;
  shadowDiscMap: THREE.CanvasTexture;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function createWorldTextures(maxAnisotropy: number): WorldTextures {
  // 1. Overgrown earth / grass / mud / gravel wasteland terrain (512px)
  const [gc, gctx] = makeCanvas(512);
  gctx.fillStyle = '#333b28';
  gctx.fillRect(0, 0, 512, 512);
  // Soil mottling patches
  for (let i = 0; i < 160; i++) {
    const x = hash01(i * 4 + 1) * 512;
    const y = hash01(i * 4 + 2) * 512;
    const r = 14 + hash01(i * 4 + 3) * 34;
    const g = gctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, i % 2 === 0 ? 'rgba(54,46,32,0.34)' : 'rgba(72,82,48,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    gctx.fillStyle = g;
    gctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fine blades, moss & pebbles
  for (let i = 0; i < 6500; i++) {
    const x = Math.floor(hash01(i * 2 + 1) * 512);
    const y = Math.floor(hash01(i * 2 + 2) * 512);
    const w = 1 + Math.floor(hash01(i * 2 + 3) * 3);
    const h = 2 + Math.floor(hash01(i * 2 + 4) * 5);
    gctx.fillStyle =
      i % 5 === 0
        ? 'rgba(88,96,58,0.36)'
        : i % 3 === 0
          ? 'rgba(42,36,26,0.42)'
          : 'rgba(64,76,46,0.32)';
    gctx.fillRect(x, y, w, h);
  }
  const groundMap = new THREE.CanvasTexture(gc);
  groundMap.colorSpace = THREE.SRGBColorSpace;
  groundMap.wrapS = groundMap.wrapT = THREE.RepeatWrapping;
  groundMap.repeat.set(38, 38);
  groundMap.anisotropy = maxAnisotropy;

  // Ground bump map (linear)
  const [gbc, gbctx] = makeCanvas(256);
  gbctx.fillStyle = '#808080';
  gbctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2800; i++) {
    const x = Math.floor(hash01(i * 3 + 11) * 256);
    const y = Math.floor(hash01(i * 3 + 12) * 256);
    gbctx.fillStyle = i % 2 === 0 ? '#a8a8a8' : '#585858';
    gbctx.fillRect(x, y, 2, 3);
  }
  const groundBump = new THREE.CanvasTexture(gbc);
  groundBump.wrapS = groundBump.wrapT = THREE.RepeatWrapping;
  groundBump.repeat.set(38, 38);

  // 2. Cracked weathered highway asphalt with gravel aggregate & tire tracks
  const [ac, actx] = makeCanvas(512);
  actx.fillStyle = '#25282c';
  actx.fillRect(0, 0, 512, 512);
  // Subtle dark tire wear lanes
  actx.fillStyle = 'rgba(15,17,20,0.22)';
  actx.fillRect(92, 0, 68, 512);
  actx.fillRect(352, 0, 68, 512);
  for (let i = 0; i < 5500; i++) {
    const x = Math.floor(hash01(i * 5 + 21) * 512);
    const y = Math.floor(hash01(i * 5 + 22) * 512);
    actx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.18)';
    actx.fillRect(x, y, 2, 2);
  }
  // Branching cracks
  actx.strokeStyle = 'rgba(10,12,14,0.62)';
  actx.lineWidth = 2;
  for (let c = 0; c < 14; c++) {
    let cx = 36 + hash01(c * 13 + 3) * 440;
    let cy = hash01(c * 13 + 4) * 512;
    actx.beginPath();
    actx.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) {
      cx += (hash01(c * 29 + s * 7) - 0.5) * 42;
      cy += 18 + hash01(c * 31 + s * 11) * 26;
      actx.lineTo(cx, cy);
    }
    actx.stroke();
  }
  // Faded shoulder & dashed yellow lane markings
  actx.fillStyle = 'rgba(215, 220, 224, 0.28)';
  actx.fillRect(18, 0, 8, 512);
  actx.fillRect(486, 0, 8, 512);
  actx.fillStyle = 'rgba(205, 152, 34, 0.55)';
  actx.fillRect(250, 28, 12, 165);
  actx.fillRect(250, 284, 12, 165);
  const asphaltMap = new THREE.CanvasTexture(ac);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.repeat.set(1, 14);
  asphaltMap.anisotropy = maxAnisotropy;

  // 3. Weathered concrete facade with expansion joints & damp grime
  const [cc, cctx] = makeCanvas(256);
  cctx.fillStyle = '#535860';
  cctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    cctx.fillStyle = 'rgba(18,20,24,0.34)';
    cctx.fillRect(0, y, 256, 3);
    cctx.fillStyle = 'rgba(22,26,28,0.16)';
    for (let x = 16; x < 256; x += 64) {
      cctx.fillRect(x, y + 3, 3, 28);
    }
  }
  for (let i = 0; i < 1600; i++) {
    const x = Math.floor(hash01(i * 7 + 31) * 256);
    const y = Math.floor(hash01(i * 7 + 32) * 256);
    cctx.fillStyle = i % 2 === 0 ? 'rgba(24,26,30,0.22)' : 'rgba(145,152,160,0.12)';
    cctx.fillRect(x, y, 2, 4);
  }
  const concreteMap = new THREE.CanvasTexture(cc);
  concreteMap.colorSpace = THREE.SRGBColorSpace;
  concreteMap.wrapS = concreteMap.wrapT = THREE.RepeatWrapping;
  concreteMap.anisotropy = maxAnisotropy;

  // 4. Rusted corrugated steel siding
  const [mc, mctx] = makeCanvas(256);
  mctx.fillStyle = '#484b4f';
  mctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 10) {
    mctx.fillStyle = 'rgba(255,255,255,0.08)';
    mctx.fillRect(x, 0, 4, 256);
    mctx.fillStyle = 'rgba(0,0,0,0.28)';
    mctx.fillRect(x + 5, 0, 4, 256);
  }
  for (let i = 0; i < 420; i++) {
    const rx = Math.floor(hash01(i * 9 + 1) * 256);
    const ry = Math.floor(hash01(i * 9 + 2) * 256);
    mctx.fillStyle = 'rgba(124, 56, 22, 0.28)';
    mctx.fillRect(rx, ry, 6, 8);
  }
  const corrugatedMap = new THREE.CanvasTexture(mc);
  corrugatedMap.colorSpace = THREE.SRGBColorSpace;
  corrugatedMap.wrapS = corrugatedMap.wrapT = THREE.RepeatWrapping;
  corrugatedMap.repeat.set(2, 2);
  corrugatedMap.anisotropy = maxAnisotropy;

  // 5. Timber logs & planks with wood grain
  const [wc, wctx] = makeCanvas(256);
  wctx.fillStyle = '#5c402a';
  wctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 24) {
    wctx.fillStyle = y % 48 === 0 ? 'rgba(0,0,0,0.16)' : 'rgba(255,215,175,0.08)';
    wctx.fillRect(0, y, 256, 21);
    wctx.fillStyle = 'rgba(16,10,5,0.6)';
    wctx.fillRect(0, y + 21, 256, 3);
  }
  for (let i = 0; i < 650; i++) {
    const x = Math.floor(hash01(i * 11 + 1) * 256);
    const y = Math.floor(hash01(i * 11 + 2) * 256);
    wctx.fillStyle = 'rgba(28,16,8,0.2)';
    wctx.fillRect(x, y, 18, 2);
  }
  const woodMap = new THREE.CanvasTexture(wc);
  woodMap.colorSpace = THREE.SRGBColorSpace;
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  woodMap.anisotropy = maxAnisotropy;

  // 6. Deep vertical pine bark
  const [bc, bctx] = makeCanvas(128);
  bctx.fillStyle = '#38271b';
  bctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 420; i++) {
    const x = Math.floor(hash01(i * 17 + 1) * 128);
    const y = Math.floor(hash01(i * 17 + 2) * 128);
    bctx.fillStyle = i % 3 === 0 ? '#24170f' : '#4a3525';
    bctx.fillRect(x, y, 3, 18);
  }
  const barkMap = new THREE.CanvasTexture(bc);
  barkMap.colorSpace = THREE.SRGBColorSpace;
  barkMap.wrapS = barkMap.wrapT = THREE.RepeatWrapping;
  barkMap.anisotropy = maxAnisotropy;

  // 7. Alpha-cutout conifer pine bough clusters (eliminates smooth plastic cones!)
  const [pc, pctx] = makeCanvas(256);
  pctx.clearRect(0, 0, 256, 256);
  // Central woody branch stems
  pctx.strokeStyle = '#362618';
  pctx.lineWidth = 6;
  pctx.beginPath();
  pctx.moveTo(128, 245);
  pctx.lineTo(128, 24);
  pctx.stroke();
  for (let b = 0; b < 14; b++) {
    const y = 40 + b * 14;
    const dir = b % 2 === 0 ? -1 : 1;
    const len = 35 + (b / 14) * 78;
    pctx.strokeStyle = '#362618';
    pctx.lineWidth = 3;
    pctx.beginPath();
    pctx.moveTo(128, y);
    pctx.lineTo(128 + dir * len, y + 18);
    pctx.stroke();

    // Hundreds of organic evergreen pine needles along each branchlet
    for (let n = 0; n < 36; n++) {
      const t = n / 36;
      const bx = 128 + dir * len * t;
      const by = y + 18 * t;
      const ang = (hash01(b * 40 + n) - 0.5) * 1.9 + (dir > 0 ? 0.2 : Math.PI - 0.2);
      const nLen = 10 + hash01(b * 40 + n + 99) * 12;
      pctx.strokeStyle =
        n % 3 === 0 ? '#1b311c' : n % 2 === 0 ? '#274226' : '#33522e';
      pctx.lineWidth = 2.2;
      pctx.beginPath();
      pctx.moveTo(bx, by);
      pctx.lineTo(bx + Math.cos(ang) * nLen, by + Math.sin(ang) * nLen);
      pctx.stroke();
    }
  }
  const pineFoliageMap = new THREE.CanvasTexture(pc);
  pineFoliageMap.colorSpace = THREE.SRGBColorSpace;
  pineFoliageMap.anisotropy = maxAnisotropy;

  // 8. Alpha-cutout wild grass tuft blades
  const [grc, grctx] = makeCanvas(128);
  grctx.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 24; i++) {
    const bx = 22 + hash01(i * 3 + 1) * 84;
    const topX = bx + (hash01(i * 3 + 2) - 0.5) * 34;
    const topY = 18 + hash01(i * 3 + 3) * 44;
    grctx.strokeStyle = i % 3 === 0 ? '#4e5d33' : i % 2 === 0 ? '#3e4d29' : '#65703c';
    grctx.lineWidth = 3.2;
    grctx.beginPath();
    grctx.moveTo(bx, 126);
    grctx.quadraticCurveTo((bx + topX) * 0.5, 82, topX, topY);
    grctx.stroke();
  }
  const grassBladeMap = new THREE.CanvasTexture(grc);
  grassBladeMap.colorSpace = THREE.SRGBColorSpace;

  // 9. Realistic architectural weathered window glass + blinds
  const [wfc, wfctx] = makeCanvas(128);
  const wGrad = wfctx.createLinearGradient(0, 0, 0, 128);
  wGrad.addColorStop(0, '#101924');
  wGrad.addColorStop(0.55, '#1d2b3a');
  wGrad.addColorStop(1, '#0c1118');
  wfctx.fillStyle = wGrad;
  wfctx.fillRect(0, 0, 128, 128);
  // Subtle dusty blinds & reflection slash
  wfctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 10; y < 86; y += 8) {
    wfctx.fillRect(6, y, 116, 3);
  }
  wfctx.fillStyle = 'rgba(255,255,255,0.09)';
  wfctx.beginPath();
  wfctx.moveTo(10, 12);
  wfctx.lineTo(52, 12);
  wfctx.lineTo(24, 116);
  wfctx.lineTo(8, 116);
  wfctx.closePath();
  wfctx.fill();
  // Dark outer frame & mullion bars
  wfctx.strokeStyle = '#181b20';
  wfctx.lineWidth = 8;
  wfctx.strokeRect(4, 4, 120, 120);
  wfctx.fillStyle = '#181b20';
  wfctx.fillRect(61, 0, 6, 128);
  wfctx.fillRect(0, 61, 128, 6);
  const windowFacadeMap = new THREE.CanvasTexture(wfc);
  windowFacadeMap.colorSpace = THREE.SRGBColorSpace;

  // 10. Ripstop tactical cloth weave (white-tinted so material color multiplies cleanly)
  const [fc, fctx] = makeCanvas(128);
  fctx.fillStyle = '#dcdcdc';
  fctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    fctx.fillStyle = y % 8 === 0 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    fctx.fillRect(0, y, 128, 2);
    fctx.fillRect(y, 0, 2, 128);
  }
  const fabricMap = new THREE.CanvasTexture(fc);
  fabricMap.colorSpace = THREE.SRGBColorSpace;
  fabricMap.wrapS = fabricMap.wrapT = THREE.RepeatWrapping;
  fabricMap.repeat.set(3, 3);

  // 11. Subtle sculpted human face texture (eyes, brows, nose shadow, mouth)
  const [skc, skctx] = makeCanvas(128);
  skctx.fillStyle = '#f2f2f2';
  skctx.fillRect(0, 0, 128, 128);
  // Face front lies near UV center x = 64
  skctx.fillStyle = 'rgba(0,0,0,0.09)';
  skctx.fillRect(46, 52, 14, 7);
  skctx.fillRect(68, 52, 14, 7);
  // Eyebrows
  skctx.fillStyle = '#261b14';
  skctx.fillRect(46, 48, 14, 3);
  skctx.fillRect(68, 48, 14, 3);
  // Eyes (sclera + dark iris)
  skctx.fillStyle = '#f8fafc';
  skctx.fillRect(49, 55, 8, 5);
  skctx.fillRect(71, 55, 8, 5);
  skctx.fillStyle = '#1e293b';
  skctx.fillRect(51, 55, 4, 5);
  skctx.fillRect(73, 55, 4, 5);
  // Subtle nose bridge shadow & mouth
  skctx.fillStyle = 'rgba(90,50,40,0.22)';
  skctx.fillRect(62, 56, 4, 15);
  skctx.fillStyle = 'rgba(110,55,50,0.45)';
  skctx.fillRect(57, 79, 14, 3);
  const faceSkinMap = new THREE.CanvasTexture(skc);
  faceSkinMap.colorSpace = THREE.SRGBColorSpace;

  // 12. Soft radial contact shadow disc
  const [sc, sctx] = makeCanvas(64);
  const grad = sctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  const shadowDiscMap = new THREE.CanvasTexture(sc);

  return {
    groundMap,
    groundBump,
    asphaltMap,
    concreteMap,
    corrugatedMap,
    woodMap,
    barkMap,
    pineFoliageMap,
    grassBladeMap,
    windowFacadeMap,
    fabricMap,
    faceSkinMap,
    shadowDiscMap,
  };
}
