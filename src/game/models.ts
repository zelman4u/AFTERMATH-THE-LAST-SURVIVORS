import * as THREE from 'three';
import type { WorldTextures } from './textures';
import type { CharacterProfile, ZombieDefinition } from './types';

function makeContactShadow(shadowMap: THREE.Texture, radius = 0.7): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 16);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.52,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.025;
  return mesh;
}

/**
 * Creates a sculpted human head geometry oriented with UV center (u=0.5) on +Z face,
 * deformed for jawline taper, chin, cheekbones, brow ridge, and nose bridge.
 */
function createSculptedHeadGeometry(radius: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, 18, 14, -Math.PI / 2, Math.PI * 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const ny = y / radius; // -1 (chin) .. +1 (crown)
    // Elongate cranium slightly vertically and narrow temples
    x *= 0.88;
    y *= 1.1;

    // Taper jaw/chin in lower front half
    if (ny < 0.05) {
      const jawFactor = Math.min(1, (-ny + 0.05) / 1.05);
      x *= 1 - jawFactor * 0.24;
      if (z > 0) {
        z += radius * 0.14 * (1 - Math.abs(x / radius)) * jawFactor;
      } else {
        // Taper neck base under back of skull
        z *= 1 - jawFactor * 0.18;
      }
    }

    // Subtle brow ridge & nose bridge on +Z face
    if (z > radius * 0.45) {
      if (ny > 0.05 && ny < 0.26 && Math.abs(x) < radius * 0.55) {
        z += radius * 0.06;
      }
      if (ny > -0.25 && ny < 0.16 && Math.abs(x) < radius * 0.14) {
        const noseTip = 1 - Math.abs((ny + 0.1) / 0.28);
        z += radius * 0.14 * Math.max(0, noseTip);
      }
    }

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Anatomical human torso using LatheGeometry (hip flare -> waist -> chest -> shoulders -> neck collar).
 */
function createTorsoGeometry(sx: number, sy: number, hunched = false): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.01, -0.30 * sy),
    new THREE.Vector2(0.185 * sx, -0.28 * sy),
    new THREE.Vector2(0.162 * sx, -0.15 * sy),
    new THREE.Vector2(0.152 * sx, -0.02 * sy),
    new THREE.Vector2(0.205 * sx, 0.14 * sy),
    new THREE.Vector2(0.224 * sx, 0.24 * sy),
    new THREE.Vector2(0.182 * sx, 0.29 * sy),
    new THREE.Vector2(0.085 * sx, 0.32 * sy),
    new THREE.Vector2(0.01, 0.32 * sy),
  ];
  const geo = new THREE.LatheGeometry(pts, 14);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    // Flatten front-to-back into realistic ribcage cross-section
    z *= 0.68;
    x *= 1.06;
    if (hunched && y > 0) {
      z += y * 0.28;
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted leg geometry pivoted from hip (y = 0 at hip down to -0.82 * sy at ankle).
 */
function createLegGeometry(sx: number, sy: number, heightScale = 1): THREE.BufferGeometry {
  const h = sy * heightScale;
  const pts = [
    new THREE.Vector2(0.01, -0.80 * h),
    new THREE.Vector2(0.055 * sx, -0.78 * h), // ankle
    new THREE.Vector2(0.078 * sx, -0.56 * h), // calf muscle
    new THREE.Vector2(0.072 * sx, -0.40 * h), // knee
    new THREE.Vector2(0.096 * sx, -0.18 * h), // thigh
    new THREE.Vector2(0.104 * sx, -0.02 * h), // hip
    new THREE.Vector2(0.01, 0.0),
  ];
  const geo = new THREE.LatheGeometry(pts, 12);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Realistic human survivor anatomy: sculpted LatheGeometry torso & limbs, staggered tactical stance,
 * two-handed carbine hold, sculpted face + hair, chest rig, and field backpack.
 */
export function buildSurvivorMesh(
  character: CharacterProfile,
  textures: WorldTextures,
  isNpc = false,
): { group: THREE.Group; leftLeg: THREE.Object3D; rightLeg: THREE.Object3D; rightArm: THREE.Group } {
  const group = new THREE.Group();
  const [sx, sy, sz] = character.buildScale;

  const clothMat = new THREE.MeshStandardMaterial({
    map: textures.fabricMap,
    color: character.clothingColor,
    roughness: 0.84,
    metalness: 0.05,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    map: textures.fabricMap,
    color: '#2b3036',
    roughness: 0.88,
    metalness: 0.04,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: '#191512',
    roughness: 0.68,
    metalness: 0.14,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    map: textures.faceSkinMap,
    color: character.skinTone,
    roughness: 0.64,
    metalness: 0.02,
  });
  const plainSkinMat = new THREE.MeshStandardMaterial({
    color: character.skinTone,
    roughness: 0.64,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: character.hairColor,
    roughness: 0.82,
    metalness: 0.04,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: '#1b1f24',
    roughness: 0.32,
    metalness: 0.82,
  });
  const gunWoodMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    color: '#6b4226',
    roughness: 0.72,
    metalness: 0.08,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    map: textures.fabricMap,
    color: '#31372c',
    roughness: 0.76,
    metalness: 0.12,
  });
  const packMat = new THREE.MeshStandardMaterial({
    map: textures.fabricMap,
    color: '#443b2c',
    roughness: 0.85,
    metalness: 0.06,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: '#1f2328',
    roughness: 0.78,
    metalness: 0.08,
  });

  // Hip-pivoted anatomical legs with treaded combat boots
  const legGeo = createLegGeometry(sx, sy);
  const bootUpperGeo = new THREE.CylinderGeometry(0.065 * sx, 0.072 * sx, 0.14 * sy, 10);
  const bootSoleGeo = new THREE.BoxGeometry(0.135 * sx, 0.065, 0.26 * sz);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.115 * sx, 0.88 * sy, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
  leftLegMesh.castShadow = true;
  const bootLTop = new THREE.Mesh(bootUpperGeo, bootMat);
  bootLTop.position.set(0, -0.74 * sy, 0);
  const bootLSole = new THREE.Mesh(bootSoleGeo, bootMat);
  bootLSole.position.set(0, -0.84 * sy, 0.045);
  leftLeg.add(leftLegMesh, bootLTop, bootLSole);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.115 * sx, 0.88 * sy, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
  rightLegMesh.castShadow = true;
  const bootRTop = new THREE.Mesh(bootUpperGeo, bootMat);
  bootRTop.position.set(0, -0.74 * sy, 0);
  const bootRSole = new THREE.Mesh(bootSoleGeo, bootMat);
  bootRSole.position.set(0, -0.84 * sy, 0.045);
  rightLeg.add(rightLegMesh, bootRTop, bootRSole);

  // Subtle natural athletic combat stance at rest
  leftLeg.rotation.set(0.08, 0.08, 0.03);
  rightLeg.rotation.set(-0.09, -0.06, -0.03);

  // Pelvis + Utility Belt + Holster
  const pelvis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165 * sx, 0.178 * sx, 0.2 * sy, 12),
    pantsMat,
  );
  pelvis.scale.set(1.06, 1, 0.72);
  pelvis.position.y = 0.88 * sy;

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.174 * sx, 0.174 * sx, 0.06, 12), bootMat);
  belt.scale.set(1.06, 1, 0.75);
  belt.position.y = 0.94 * sy;

  const holster = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.16, 0.11), bootMat);
  holster.position.set(0.19 * sx, 0.81 * sy, 0.02);

  // Sculpted Lathe Torso + Collar + Tactical Plate Carrier + Mag Pouches
  const torso = new THREE.Mesh(createTorsoGeometry(sx, sy), clothMat);
  torso.position.y = 1.24 * sy;
  torso.castShadow = true;

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.105 * sx, 0.125 * sx, 0.075, 12), clothMat);
  collar.position.y = 1.52 * sy;

  const vest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.195 * sx, 0.175 * sx, 0.36 * sy, 12),
    vestMat,
  );
  vest.scale.set(1.08, 1, 0.78);
  vest.position.y = 1.26 * sy;
  vest.castShadow = true;

  // Chest mag pouches
  for (let p = -1; p <= 1; p++) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.065 * sx, 0.11, 0.05), packMat);
    pouch.position.set(p * 0.078 * sx, 1.18 * sy, 0.145 * sz);
    group.add(pouch);
  }

  // Tactical Field Backpack + Bedroll + Canteen
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.29 * sx, 0.41 * sy, 0.18 * sz), packMat);
  pack.position.set(0, 1.26 * sy, -0.195 * sz);
  pack.castShadow = true;

  const packFlap = new THREE.Mesh(new THREE.BoxGeometry(0.305 * sx, 0.14 * sy, 0.195 * sz), vestMat);
  packFlap.position.set(0, 1.38 * sy, -0.195 * sz);

  const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.33 * sx, 10), bootMat);
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.set(0, 1.50 * sy, -0.2 * sz);

  // Left Arm (angled across chest to support rifle handguard when armed)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.212 * sx, 1.41 * sy, 0);
  const leftShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.066 * sx, 10, 8), clothMat);
  const leftUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.064 * sx, 0.054 * sx, 0.27 * sy, 10), clothMat);
  leftUpper.position.set(0, -0.13 * sy, 0.02);
  const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.053 * sx, 0.044 * sx, 0.25 * sy, 10), clothMat);
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.046 * sx, 8, 8), gloveMat);

  if (!isNpc) {
    leftUpper.rotation.set(-0.55, 0, -0.22);
    leftUpper.position.set(0.02, -0.12 * sy, 0.08);
    leftForearm.rotation.set(-1.32, 0, -0.68);
    leftForearm.position.set(0.12 * sx, -0.24 * sy, 0.26);
    leftHand.position.set(0.22 * sx, -0.25 * sy, 0.40);
  } else {
    leftUpper.rotation.set(-0.1, 0, 0.12);
    leftForearm.position.set(-0.03, -0.36 * sy, 0.06);
    leftForearm.rotation.set(-0.25, 0, 0.04);
    leftHand.position.set(-0.04, -0.49 * sy, 0.09);
  }
  leftUpper.castShadow = true;
  leftForearm.castShadow = true;
  leftArmGroup.add(leftShoulder, leftUpper, leftForearm, leftHand);

  // Right Arm + Tactical Rifle
  const rightArm = new THREE.Group();
  rightArm.position.set(0.212 * sx, 1.41 * sy, 0);
  const rightShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.066 * sx, 10, 8), clothMat);
  const rightUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.064 * sx, 0.054 * sx, 0.27 * sy, 10), clothMat);
  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.053 * sx, 0.044 * sx, 0.25 * sy, 10), clothMat);
  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.046 * sx, 8, 8), gloveMat);

  if (!isNpc) {
    rightUpper.position.set(-0.01, -0.13 * sy, 0.05);
    rightUpper.rotation.set(-0.42, 0, 0.14);
    rightForearm.position.set(-0.05, -0.25 * sy, 0.22);
    rightForearm.rotation.set(-1.35, 0, 0.22);
    rightHand.position.set(-0.075, -0.25 * sy, 0.34);

    // 7-part realistic survival rifle angled slightly inward toward left hand
    const gunGroup = new THREE.Group();
    gunGroup.position.set(-0.09, -0.24 * sy, 0.32);
    gunGroup.rotation.y = -0.34;
    gunGroup.rotation.x = 0.08;

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.105, 0.24), gunWoodMat);
    stock.position.set(0, -0.02, -0.15);
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.095, 0.34), metalMat);
    receiver.position.set(0, 0, 0.11);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.072, 0.26), gunWoodMat);
    handguard.position.set(0, -0.005, 0.38);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.16, 0.068), metalMat);
    mag.position.set(0, -0.10, 0.16);
    mag.rotation.x = 0.22;
    const optic = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), metalMat);
    optic.rotation.x = Math.PI / 2;
    optic.position.set(0, 0.068, 0.12);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.34, 8), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, 0.56);

    gunGroup.add(stock, receiver, handguard, mag, optic, barrel);
    rightArm.add(gunGroup);
  } else {
    rightUpper.position.set(0.01, -0.13 * sy, 0.02);
    rightUpper.rotation.set(-0.1, 0, -0.12);
    rightForearm.position.set(0.03, -0.36 * sy, 0.06);
    rightForearm.rotation.set(-0.25, 0, -0.04);
    rightHand.position.set(0.04, -0.49 * sy, 0.09);
  }
  rightUpper.castShadow = true;
  rightForearm.castShadow = true;
  rightArm.add(rightShoulder, rightUpper, rightForearm, rightHand);

  // Neck + Sculpted Head + Ears + Textured Hair
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.082, 0.14, 10), plainSkinMat);
  neck.position.y = 1.56 * sy;

  const head = new THREE.Mesh(createSculptedHeadGeometry(0.152), skinMat);
  head.position.y = 1.72 * sy;
  head.castShadow = true;

  const earGeo = new THREE.SphereGeometry(0.032, 6, 6);
  earGeo.scale(0.45, 1.15, 0.75);
  const earL = new THREE.Mesh(earGeo, plainSkinMat);
  earL.position.set(-0.132, 1.71 * sy, -0.005);
  const earR = new THREE.Mesh(earGeo, plainSkinMat);
  earR.position.set(0.132, 1.71 * sy, -0.005);

  const hairCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.156, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
    new THREE.MeshStandardMaterial({
      map: textures.fabricMap,
      color: character.hairColor,
      roughness: 0.9,
      metalness: 0.02,
    }),
  );
  hairCrown.scale.set(0.92, 1.09, 1.03);
  hairCrown.position.set(0, 1.74 * sy, -0.024);
  hairCrown.rotation.x = -0.26;

  // Hair nape / side fade & textured front locks
  const hairFront = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.048, 0.08), hairMat);
  hairFront.position.set(0, 1.83 * sy, 0.085);
  hairFront.rotation.x = 0.25;

  const hairBack = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.098, 0.14, 10), hairMat);
  hairBack.position.set(0, 1.69 * sy, -0.065);
  hairBack.rotation.x = 0.16;

  group.add(
    makeContactShadow(textures.shadowDiscMap, 0.62),
    leftLeg,
    rightLeg,
    pelvis,
    belt,
    holster,
    torso,
    collar,
    vest,
    pack,
    packFlap,
    bedroll,
    leftArmGroup,
    rightArm,
    neck,
    head,
    earL,
    earR,
    hairCrown,
    hairFront,
    hairBack,
  );

  return { group, leftLeg, rightLeg, rightArm };
}

/**
 * Realistic hunched anatomical infected & mutated boss meshes.
 */
export function buildZombieMesh(
  def: ZombieDefinition,
  textures: WorldTextures,
): { group: THREE.Group; hitMaterials: THREE.MeshStandardMaterial[] } {
  const group = new THREE.Group();
  const [sx, sy, sz] = def.scale;

  const skinMat = new THREE.MeshStandardMaterial({
    map: textures.faceSkinMap,
    color: def.skinColor,
    roughness: 0.85,
    metalness: 0.04,
  });
  const limbSkinMat = new THREE.MeshStandardMaterial({
    color: def.skinColor,
    roughness: 0.85,
    metalness: 0.04,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: def.accentColor,
    roughness: 0.52,
    metalness: 0.16,
    emissive: def.isBoss || def.id === 'spitter' || def.id === 'screamer' ? def.accentColor : '#000000',
    emissiveIntensity: def.isBoss ? 0.26 : 0.12,
  });
  const ragMat = new THREE.MeshStandardMaterial({
    map: textures.fabricMap,
    color: '#2c3033',
    roughness: 0.94,
    metalness: 0.03,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: def.isBoss ? '#fbbf24' : '#ef4444',
    emissive: def.isBoss ? '#f59e0b' : '#dc2626',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  const hitMaterials = [skinMat, limbSkinMat, accentMat, ragMat];

  // Staggered anatomical legs
  const legHeightScale = def.id === 'crawler' ? 0.45 : 0.95;
  const legGeo = createLegGeometry(sx, sy, legHeightScale);
  const leftLeg = new THREE.Mesh(legGeo, ragMat);
  leftLeg.position.set(-0.13 * sx, 0.82 * sy * legHeightScale, def.id === 'crawler' ? -0.34 : 0);
  leftLeg.rotation.set(0.16, 0.08, 0.06);
  const rightLeg = new THREE.Mesh(legGeo, ragMat);
  rightLeg.position.set(0.13 * sx, 0.82 * sy * legHeightScale, def.id === 'crawler' ? -0.34 : 0);
  rightLeg.rotation.set(-0.14, -0.1, -0.05);

  // Hunched Lathe ribcage torso
  const torsoY = def.id === 'crawler' ? 0.34 : 1.12 * sy;
  const torso = new THREE.Mesh(createTorsoGeometry(sx * 1.05, sy, true), ragMat);
  torso.position.set(0, torsoY, def.id === 'crawler' ? 0 : 0.04);
  torso.rotation.x = def.id === 'crawler' ? Math.PI / 2.3 : 0.3;
  torso.rotation.z = 0.05;
  torso.castShadow = true;

  // Exposed mutated rib/biomass mass
  const chestPlate = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 * sx, 1), accentMat);
  chestPlate.scale.set(1.12, 1.05, 0.72);
  chestPlate.position.set(0, torsoY + 0.05 * sy, 0.1 * sz);

  // Crooked outstretched two-segment arms
  const armUpperGeo = new THREE.CylinderGeometry(0.068 * sx, 0.056 * sx, 0.28 * sy, 8);
  const armForeGeo = new THREE.CylinderGeometry(0.054 * sx, 0.042 * sx, 0.28 * sy, 8);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.27 * sx, torsoY + 0.22 * sy, 0.08 * sz);
  const lUp = new THREE.Mesh(armUpperGeo, limbSkinMat);
  lUp.rotation.set(-1.05, 0, 0.18);
  lUp.position.set(-0.02, -0.06, 0.11);
  const lFo = new THREE.Mesh(armForeGeo, limbSkinMat);
  lFo.rotation.set(-1.42, 0, 0.06);
  lFo.position.set(-0.04, -0.11, 0.33);
  leftArm.add(lUp, lFo);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.27 * sx, torsoY + 0.19 * sy, 0.08 * sz);
  const rUp = new THREE.Mesh(armUpperGeo, limbSkinMat);
  rUp.rotation.set(-1.12, 0, -0.2);
  rUp.position.set(0.02, -0.07, 0.11);
  const rFo = new THREE.Mesh(armForeGeo, limbSkinMat);
  rFo.rotation.set(-1.36, 0, -0.05);
  rFo.position.set(0.04, -0.12, 0.33);
  rightArm.add(rUp, rFo);

  // Sculpted Skull + Sunken Glowing Infected Eyes
  const headY = def.id === 'crawler' ? 0.5 : 1.56 * sy;
  const headZ = def.id === 'crawler' ? 0.45 : 0.18 * sz;
  const head = new THREE.Mesh(createSculptedHeadGeometry(0.155 * sx), skinMat);
  head.position.set(0, headY, headZ);
  head.rotation.set(0.24, 0, -0.08);
  head.castShadow = true;

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.022 * sx, 6, 6), eyeMat);
  eyeL.position.set(-0.052 * sx, headY + 0.02 * sy, headZ + 0.125 * sz);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.022 * sx, 6, 6), eyeMat);
  eyeR.position.set(0.052 * sx, headY + 0.02 * sy, headZ + 0.125 * sz);

  group.add(
    makeContactShadow(textures.shadowDiscMap, 0.65 * sx),
    leftLeg,
    rightLeg,
    torso,
    chestPlate,
    leftArm,
    rightArm,
    head,
    eyeL,
    eyeR,
  );

  // Mutated dorsal spines / shoulder growths on Specials & World Bosses
  if (def.isBoss || def.id === 'brute' || def.id === 'spitter') {
    for (let s = -1; s <= 1; s++) {
      const spine = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11 * sx, 0), accentMat);
      spine.scale.set(0.7, 2.1, 0.7);
      spine.position.set(s * 0.15 * sx, torsoY + 0.36 * sy, -0.08 * sz);
      spine.rotation.x = -0.45;
      group.add(spine);
    }
  }

  return { group, hitMaterials };
}

/**
 * Natural conifer pine tree built with rough bark trunk, angled branches,
 * and 16 alpha-cutout crossed pine bough needle clusters (zero smooth Roblox cones!).
 */
export function buildTreeMesh(scale: number, textures: WorldTextures): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    map: textures.barkMap,
    color: '#ffffff',
    roughness: 0.94,
    metalness: 0.02,
  });
  const needleMat = new THREE.MeshStandardMaterial({
    map: textures.pineFoliageMap,
    color: '#d8e6d2',
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.88,
    metalness: 0.02,
  });

  // Tapered bark trunk + root flare
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * scale, 0.34 * scale, 5.4 * scale, 9),
    trunkMat,
  );
  trunk.position.y = 2.7 * scale;
  trunk.castShadow = true;

  const rootFlare = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32 * scale, 0.56 * scale, 0.75 * scale, 8),
    trunkMat,
  );
  rootFlare.position.y = 0.36 * scale;

  // Woody side limbs
  for (let b = 0; b < 4; b++) {
    const ang = b * (Math.PI * 0.5) + 0.4;
    const limb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04 * scale, 0.09 * scale, 1.5 * scale, 6),
      trunkMat,
    );
    limb.position.set(Math.cos(ang) * 0.52 * scale, (2.6 + b * 0.75) * scale, Math.sin(ang) * 0.52 * scale);
    limb.rotation.z = -Math.cos(ang) * 0.85;
    limb.rotation.x = Math.sin(ang) * 0.85;
    group.add(limb);
  }

  // Crossed organic evergreen pine bough planes (4 vertical tiers, 4 crossed angled fronds per tier)
  const tiers: [number, number, number][] = [
    [2.65, 3.6, 0.35],
    [3.85, 3.1, 0.30],
    [5.05, 2.5, 0.26],
    [6.15, 1.8, 0.20],
  ];
  for (let t = 0; t < tiers.length; t++) {
    const [ty, span, droop] = tiers[t];
    for (let f = 0; f < 4; f++) {
      const ang = (f / 4) * Math.PI * 2 + t * 0.55;
      const planeGeo = new THREE.PlaneGeometry(span * scale, span * 0.92 * scale);
      const frond = new THREE.Mesh(planeGeo, needleMat);
      frond.position.set(
        Math.cos(ang) * span * 0.14 * scale,
        ty * scale,
        Math.sin(ang) * span * 0.14 * scale,
      );
      frond.rotation.y = ang + Math.PI / 2;
      frond.rotation.x = droop;
      frond.castShadow = true;
      group.add(frond);
    }
  }

  group.add(makeContactShadow(textures.shadowDiscMap, 2.2 * scale), trunk, rootFlare);
  return group;
}

/**
 * Beveled ExtrudeGeometry post-apocalyptic pickup truck (or rusted highway wreck).
 */
export function buildVehicleMesh(
  textures: WorldTextures,
  color = '#4a5568',
  wrecked = false,
): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = wrecked
    ? new THREE.MeshStandardMaterial({
        map: textures.corrugatedMap,
        color: '#4c382c',
        roughness: 0.88,
        metalness: 0.42,
      })
    : new THREE.MeshStandardMaterial({
        color,
        roughness: 0.44,
        metalness: 0.62,
      });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#1b2026', roughness: 0.72, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: wrecked ? '#1e242b' : '#0f172a',
    roughness: wrecked ? 0.55 : 0.12,
    metalness: wrecked ? 0.3 : 0.88,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.94, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#9ca3af', roughness: 0.35, metalness: 0.78 });
  const lightMat = new THREE.MeshStandardMaterial({
    color: wrecked ? '#334155' : '#fef08a',
    emissive: wrecked ? '#000000' : '#fde047',
    emissiveIntensity: wrecked ? 0 : 0.7,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: wrecked ? '#451a1a' : '#ef4444',
    emissive: wrecked ? '#000000' : '#dc2626',
    emissiveIntensity: wrecked ? 0 : 0.45,
  });

  // Side-profile 2D silhouette extruded across vehicle width (2.0m) -> centered at x = 0
  // Profile uses X = z-forward (-2.35 rear to +2.35 front), Y = height above ground
  const profile = new THREE.Shape();
  profile.moveTo(-2.3, 0.38);
  profile.lineTo(-2.3, 1.05); // rear tailgate
  profile.lineTo(-0.55, 1.05); // truck cargo bed top
  profile.lineTo(-0.35, 1.72); // rear cab wall
  profile.lineTo(0.45, 1.72); // cab roof
  profile.lineTo(1.02, 1.14); // angled windshield
  profile.lineTo(2.22, 0.98); // sloped hood
  profile.lineTo(2.32, 0.42); // front nose
  profile.lineTo(1.85, 0.38);
  profile.absarc(1.42, 0.42, 0.48, 0, Math.PI, false); // front wheel arch cutout
  profile.lineTo(-0.92, 0.38);
  profile.absarc(-1.42, 0.42, 0.48, 0, Math.PI, false); // rear wheel arch cutout
  profile.lineTo(-2.3, 0.38);

  const extrudeGeo = new THREE.ExtrudeGeometry(profile, {
    depth: 1.88,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  // Rotate so profile X becomes +Z (forward) and extrusion depth centers on X
  extrudeGeo.translate(0, 0, -0.94);
  extrudeGeo.rotateY(-Math.PI / 2);

  const hull = new THREE.Mesh(extrudeGeo, bodyMat);
  hull.castShadow = true;
  group.add(hull);

  // Angled windshield glass & side cab glass
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.56, 0.08), glassMat);
  windshield.position.set(0, 1.43, 0.74);
  windshield.rotation.x = -0.82;

  const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.44, 0.76), glassMat);
  sideGlass.position.set(0, 1.42, 0.05);

  // Front steel bull bar & radiator grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.38, 0.1), trimMat);
  grille.position.set(0, 0.72, 2.32);

  const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.22, 0.24), trimMat);
  bumperFront.position.set(0, 0.46, 2.38);

  const bullBar = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.32, 0.08), trimMat);
  bullBar.position.set(0, 0.76, 2.44);

  const bumperRear = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 0.2), trimMat);
  bumperRear.position.set(0, 0.44, -2.35);

  // Spare wheel & crate in pickup cargo bed
  const cargoBedInner = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.28, 1.55), trimMat);
  cargoBedInner.position.set(0, 0.88, -1.4);

  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), lightMat);
  headL.position.set(-0.74, 0.76, 2.34);
  const headR = headL.clone();
  headR.position.x = 0.74;

  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.08), tailMat);
  tailL.position.set(-0.84, 0.82, -2.34);
  const tailR = tailL.clone();
  tailR.position.x = 0.84;

  group.add(
    makeContactShadow(textures.shadowDiscMap, 2.7),
    windshield,
    sideGlass,
    grille,
    bumperFront,
    bullBar,
    bumperRear,
    cargoBedInner,
    headL,
    headR,
    tailL,
    tailR,
  );

  // Treaded Wheels & Rims
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 10);
  rimGeo.rotateZ(Math.PI / 2);
  const wheelSpots: [number, number, number][] = [
    [-0.98, 0.42, 1.42],
    [0.98, 0.42, 1.42],
    [-0.98, 0.42, -1.42],
    [0.98, 0.42, -1.42],
  ];
  for (let i = 0; i < wheelSpots.length; i++) {
    if (wrecked && i === 2) continue; // missing rear wheel on wreck
    const [wx, wy, wz] = wheelSpots[i];
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, wrecked ? trimMat : rimMat);
    rim.position.set(wx, wy, wz);
    group.add(wheel, rim);
  }

  if (wrecked) {
    group.rotation.z = 0.07;
  }

  return group;
}

/**
 * Architectural multi-detail buildings:
 * - Cabins/Houses: concrete plinth, timber deck porch + steps + wooden railings,
 *   ExtrudeGeometry overhanging pitched gable roof + chimney, recessed dusty window facades + boarded planks.
 * - Urban/Industrial/Hospital/Military: reinforced concrete pilasters, floor cornices,
 *   multi-bay recessed windows on all 4 facades, rooftop parapet, HVAC & radio mast.
 */
export function buildBuildingMesh(
  width: number,
  height: number,
  depth: number,
  wallTex: THREE.Texture,
  accentHex: string,
  textures: WorldTextures,
): THREE.Group {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    color: '#ffffff',
    roughness: 0.88,
    metalness: 0.05,
  });
  const plinthMat = new THREE.MeshStandardMaterial({
    map: textures.concreteMap,
    color: '#6b7280',
    roughness: 0.92,
    metalness: 0.1,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.corrugatedMap,
    color: accentHex,
    roughness: 0.68,
    metalness: 0.25,
  });
  const trimWoodMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    color: '#a89078',
    roughness: 0.88,
    metalness: 0.04,
  });
  const steelMat = new THREE.MeshStandardMaterial({ color: '#2f3640', roughness: 0.45, metalness: 0.68 });
  const winMat = new THREE.MeshStandardMaterial({
    map: textures.windowFacadeMap,
    color: '#ffffff',
    roughness: 0.26,
    metalness: 0.55,
  });

  // Raised concrete foundation plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.5, depth + 0.5), plinthMat);
  plinth.position.y = 0.25;
  plinth.receiveShadow = true;

  const mainWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat);
  mainWall.position.y = height / 2 + 0.45;
  mainWall.castShadow = true;
  mainWall.receiveShadow = true;

  // Corner structural pilasters
  for (const cx of [-width / 2, width / 2]) {
    for (const cz of [-depth / 2, depth / 2]) {
      const pilaster = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, height + 0.08, 0.32),
        height <= 6.5 ? trimWoodMat : plinthMat,
      );
      pilaster.position.set(cx, height / 2 + 0.45, cz);
      group.add(pilaster);
    }
  }

  if (height <= 6.5) {
    // True pitched Gable Roof using ExtrudeGeometry (overhangs walls + gables)
    const roofPeak = Math.max(1.8, width * 0.28);
    const overhangW = width / 2 + 0.65;
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-overhangW, 0);
    gableShape.lineTo(0, roofPeak);
    gableShape.lineTo(overhangW, 0);
    gableShape.lineTo(overhangW - 0.16, -0.14);
    gableShape.lineTo(0, roofPeak - 0.18);
    gableShape.lineTo(-overhangW + 0.16, -0.14);
    gableShape.closePath();

    const roofGeo = new THREE.ExtrudeGeometry(gableShape, {
      depth: depth + 1.1,
      bevelEnabled: false,
    });
    roofGeo.translate(0, 0, -(depth + 1.1) / 2);
    const gableRoof = new THREE.Mesh(roofGeo, roofMat);
    gableRoof.position.y = height + 0.45;
    gableRoof.castShadow = true;

    // Triangular gable end infill walls
    const infillShape = new THREE.Shape();
    infillShape.moveTo(-width / 2, 0);
    infillShape.lineTo(0, roofPeak - 0.12);
    infillShape.lineTo(width / 2, 0);
    infillShape.closePath();
    const infillGeo = new THREE.ExtrudeGeometry(infillShape, { depth, bevelEnabled: false });
    infillGeo.translate(0, 0, -depth / 2);
    const infillMesh = new THREE.Mesh(infillGeo, wallMat);
    infillMesh.position.y = height + 0.45;

    // Rusted stovepipe chimney
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 1.8, 10), steelMat);
    chimney.position.set(width * 0.24, height + roofPeak * 0.65 + 0.9, -depth * 0.18);

    // Front timber deck porch + wooden posts + porch railings + steps
    const porchDepth = 1.9;
    const porchDeck = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.4, 0.28, porchDepth),
      trimWoodMat,
    );
    porchDeck.position.set(0, 0.36, depth / 2 + porchDepth / 2);
    porchDeck.receiveShadow = true;

    const porchRoof = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.5, 0.14, porchDepth + 0.35),
      roofMat,
    );
    porchRoof.position.set(0, 2.75, depth / 2 + porchDepth / 2);
    porchRoof.rotation.x = 0.22;

    for (const px of [-width / 2 + 0.25, -1.25, 1.25, width / 2 - 0.25]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.35, 0.18), trimWoodMat);
      post.position.set(px, 1.55, depth / 2 + porchDepth - 0.15);
      post.castShadow = true;
      group.add(post);
    }
    // Porch railings left & right of steps
    const railLen = Math.max(0.8, width / 2 - 1.35);
    for (const side of [-1, 1]) {
      const rx = side * (1.35 + railLen / 2);
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(railLen, 0.1, 0.1), trimWoodMat);
      topRail.position.set(rx, 1.25, depth / 2 + porchDepth - 0.15);
      const midRail = new THREE.Mesh(new THREE.BoxGeometry(railLen, 0.08, 0.08), trimWoodMat);
      midRail.position.set(rx, 0.85, depth / 2 + porchDepth - 0.15);
      group.add(topRail, midRail);
    }
    // Front wooden stairs
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.5), trimWoodMat);
    step1.position.set(0, 0.12, depth / 2 + porchDepth + 0.28);

    group.add(gableRoof, infillMesh, chimney, porchDeck, porchRoof, step1);
  } else {
    // Tall urban / industrial / hospital building: horizontal floor cornices + parapet + HVAC + radio mast
    const floors = Math.max(2, Math.round(height / 3.8));
    for (let f = 1; f < floors; f++) {
      const ledge = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.28, 0.22, depth + 0.28),
        plinthMat,
      );
      ledge.position.y = (f / floors) * height + 0.45;
      group.add(ledge);
    }
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(width + 0.45, 0.65, depth + 0.45), roofMat);
    parapet.position.y = height + 0.72;
    const hvac = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.95, 1.6), steelMat);
    hvac.position.set(-width * 0.2, height + 1.35, -depth * 0.15);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 3.8, 6), steelMat);
    mast.position.set(width * 0.25, height + 2.6, 0);
    // Ground-floor corrugated storefront awning
    const entryAwning = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.4), roofMat);
    entryAwning.position.set(0, 2.95, depth / 2 + 0.68);
    entryAwning.rotation.x = 0.2;
    group.add(parapet, hvac, mast, entryAwning);
  }

  // Reinforced doorway
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.55, 2.35, 0.24), steelMat);
  doorFrame.position.set(0, 1.62, depth / 2 + 0.05);
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.15, 0.28), trimWoodMat);
  doorPanel.position.set(0, 1.55, depth / 2 + 0.06);

  // Recessed realistic dusty glass windows + boarded planks on front & side facades
  const rows = height > 8 ? [height * 0.34, height * 0.68] : [height * 0.56 + 0.2];
  for (const wy of rows) {
    for (const side of [-1, 1]) {
      const wx = side * width * 0.28;
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.42, 1.18, 0.14), winMat);
      win.position.set(wx, wy, depth / 2 + 0.04);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.12, 0.24), plinthMat);
      sill.position.set(wx, wy - 0.62, depth / 2 + 0.08);
      // Boarded survival plank across one window
      if (side === -1) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.2, 0.18), trimWoodMat);
        plank.position.set(wx, wy - 0.05, depth / 2 + 0.12);
        plank.rotation.z = 0.16;
        group.add(plank);
      }
      group.add(win, sill);
    }
    // Side wall windows for 360-degree realism
    for (const xSide of [-1, 1]) {
      const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.18, 1.42), winMat);
      sideWin.position.set(xSide * (width / 2 + 0.04), wy, 0);
      group.add(sideWin);
    }
  }

  group.add(
    makeContactShadow(textures.shadowDiscMap, Math.max(width, depth) * 0.72),
    plinth,
    mainWall,
    doorFrame,
    doorPanel,
  );
  return group;
}

/**
 * Fortified survivor-crafted structures (lashed timber palisades with rear bracing struts,
 * timber lookout watchtower with railings & gable roof, spike barricades, solar rig, raised farm beds).
 */
export function buildStructureMesh(
  structureId: string,
  textures: WorldTextures,
): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ map: textures.woodMap, color: '#ffffff', roughness: 0.88 });
  const barkMat = new THREE.MeshStandardMaterial({ map: textures.barkMap, color: '#d6c3af', roughness: 0.92 });
  const steelMat = new THREE.MeshStandardMaterial({
    map: textures.corrugatedMap,
    color: '#64748b',
    roughness: 0.42,
    metalness: 0.7,
  });
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#3b2c1e', roughness: 0.95 });

  if (structureId === 'wood_wall' || structureId === 'metal_wall') {
    const isSteel = structureId === 'metal_wall';
    const postMat = isSteel ? steelMat : barkMat;
    // Irregular organic palisade stakes + sharpened tips + rear angled braces
    for (let i = -3; i <= 3; i++) {
      const h = 2.6 + ((Math.abs(i) * 37) % 5) * 0.09;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, h, 8), postMat);
      post.position.set(i * 0.5, h / 2, (i % 2) * 0.04);
      post.rotation.z = (i % 3 - 1) * 0.02;
      post.castShadow = true;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.165, 0.42, 8), postMat);
      tip.position.set(i * 0.5, h + 0.21, (i % 2) * 0.04);
      group.add(post, tip);
    }
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.18, 0.38), isSteel ? steelMat : ropeMat);
    crossBeam.position.y = 1.45;
    const lowerBeam = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.15, 0.36), isSteel ? steelMat : woodMat);
    lowerBeam.position.y = 0.65;
    group.add(crossBeam, lowerBeam);
    // Diagonal rear ground brace struts
    for (const bx of [-1.1, 1.1]) {
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), woodMat);
      brace.position.set(bx, 0.85, -0.65);
      brace.rotation.x = 0.62;
      group.add(brace);
    }
  } else if (structureId === 'watchtower') {
    for (const [px, pz] of [[-1.05, -1.05], [1.05, -1.05], [-1.05, 1.05], [1.05, 1.05]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.15, 8), barkMat);
      leg.position.set(px, 2.57, pz);
      leg.castShadow = true;
      group.add(leg);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.22, 2.8), woodMat);
    deck.position.y = 3.45;
    // Open waist-high railings + X-bracing
    for (const side of [-1, 1]) {
      const rFB = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 0.12), woodMat);
      rFB.position.set(0, 4.25, side * 1.32);
      const rLR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.7), woodMat);
      rLR.position.set(side * 1.32, 4.25, 0);
      group.add(rFB, rLR);
    }
    // Pitched corrugated watchtower shelter roof attached cleanly to the 4 corner posts
    const roofPeak = new THREE.Mesh(new THREE.ConeGeometry(2.25, 0.85, 4), steelMat);
    roofPeak.rotation.y = Math.PI / 4;
    roofPeak.position.y = 5.45;
    group.add(deck, roofPeak);
  } else if (structureId === 'spike_trap') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 2.4), woodMat);
    base.position.y = 0.11;
    group.add(base);
    for (let i = -1; i <= 1; i += 2) {
      for (let j = -1; j <= 1; j += 2) {
        const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.12, 1.15, 7), barkMat);
        spike.position.set(i * 0.55, 0.58, j * 0.55);
        spike.rotation.z = i * -0.25;
        spike.rotation.x = j * 0.22;
        group.add(spike);
      }
    }
  } else if (structureId === 'solar_panel') {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 1.3, 8), steelMat);
    stand.position.y = 0.65;
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.1, 1.6),
      new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.2, metalness: 0.85 }),
    );
    panel.position.y = 1.4;
    panel.rotation.x = 0.45;
    group.add(stand, panel);
  } else if (structureId === 'farm_plot') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.34, 2.8), woodMat);
    frame.position.y = 0.17;
    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.36, 2.4),
      new THREE.MeshStandardMaterial({ color: '#3b2818', roughness: 0.96 }),
    );
    soil.position.y = 0.18;
    group.add(frame, soil);
    const cropMat = new THREE.MeshStandardMaterial({ color: '#4d7c0f', roughness: 0.78 });
    for (let i = -0.7; i <= 0.7; i += 0.7) {
      for (let j = -0.6; j <= 0.6; j += 1.2) {
        const crop = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 1), cropMat);
        crop.position.set(i, 0.46, j);
        group.add(crop);
      }
    }
  } else {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.4), woodMat);
    base.position.y = 0.5;
    const vise = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), steelMat);
    vise.position.set(0.6, 1.15, 0.35);
    group.add(base, vise);
  }

  group.add(makeContactShadow(textures.shadowDiscMap, 1.4));
  return group;
}
