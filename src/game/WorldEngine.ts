import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import {
  ITEMS_CATALOG,
  PLAYABLE_CHARACTERS,
  RECRUITABLE_SURVIVORS,
  WORLD_ZONES,
  ZOMBIE_DEFINITIONS,
} from './data';
import {
  buildBuildingMesh,
  buildStructureMesh,
  buildSurvivorMesh,
  buildTreeMesh,
  buildVehicleMesh,
  buildZombieMesh,
} from './models';
import {
  addItemToInventory,
  advanceCalendar,
  computeWeaponDamage,
  evaluateAchievementsAndChapters,
  getArmorDefense,
  getCharacterById,
  getEvolutionScaling,
  getItemCount,
  getZoneAtPosition,
  removeItemFromInventory,
  tickSurvivalNeeds,
} from './simulation';
import { createWorldTextures, type WorldTextures } from './textures';
import { soundEngine } from './audio';
import type {
  GameSaveRecord,
  GameScreenState,
  HudSnapshot,
  ZombieDefinition,
} from './types';

// Pre-allocated scratch math (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface LootNode {
  id: string;
  zoneId: string;
  x: number;
  z: number;
  mesh: THREE.Group;
  lid: THREE.Mesh;
  looted: boolean;
  respawnTimer: number;
}

interface ZombieActor {
  uid: string;
  def: ZombieDefinition;
  mesh: THREE.Group;
  hitMaterials: THREE.MeshStandardMaterial[];
  x: number;
  z: number;
  vx: number;
  vz: number;
  rotY: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  state: 'idle' | 'alert' | 'windup' | 'cooldown' | 'ko';
  stateTimer: number;
  hitFlash: number;
  koTimer: number;
  orbitDir: number;
  telegraphRing: THREE.Mesh;
}

interface Projectile {
  active: boolean;
  fromPlayer: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  life: number;
  mesh: THREE.Mesh;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

interface NpcActor {
  id: string;
  name: string;
  mesh: THREE.Group;
  x: number;
  z: number;
  recruited: boolean;
  marker: THREE.Mesh;
}

interface VehicleActor {
  id: string;
  x: number;
  z: number;
  rotY: number;
  speed: number;
  mesh: THREE.Group;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onSaveChanged: (save: GameSaveRecord, triggerAutoSave?: boolean) => void;
  onGameOver: (save: GameSaveRecord) => void;
  onToast: (msg: string) => void;
}

export class WorldEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: WorldTextures;
  private isSoftwareGl = false;

  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private campfireLight!: THREE.PointLight;
  private flashlight!: THREE.SpotLight;
  private sky!: Sky;
  private sunDir = new THREE.Vector3();
  private campfireFlames: THREE.Mesh[] = [];

  private playerGroup!: THREE.Group;
  private playerLeftLeg!: THREE.Object3D;
  private playerRightLeg!: THREE.Object3D;
  private playerRightArm!: THREE.Group;

  private obstacles: ObstacleBox[] = [];
  private lootNodes: LootNode[] = [];
  private zombies: ZombieActor[] = [];
  private projectiles: Projectile[] = [];
  private npcs: NpcActor[] = [];
  private vehicles: VehicleActor[] = [];
  private placedStructureMeshes = new Map<string, THREE.Group>();

  // Pooled particles
  private particleCount = 120;
  private particleMesh!: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private particleCursor = 0;

  // Rain system
  private rainPoints!: THREE.Points;
  private rainPositions!: Float32Array;

  // Input state
  private keys = new Set<string>();
  private touchMoveX = 0;
  private touchMoveZ = 0;
  private touchSprinting = false;
  private cameraYaw = 0;
  private cameraPitch = 0.16;
  private cameraZoom = 1.0;
  private pointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerMovedDist = 0;

  // Sim state
  private gameState: GameScreenState = 'title';
  private save!: GameSaveRecord;
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private elapsedTime = 0;
  private hudThrottle = 0;
  private simTickAccum = 0;
  private attackCooldown = 0;
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private walkCycle = 0;
  private isCrouching = false;
  private noiseLevel = 0;
  private activeEventBanner: string | null = null;
  private eventTimer = 0;
  private spawnTimer = 0;
  private autoSaveTimer = 0;

  // Bound listeners
  private onKeyDownBound = (e: KeyboardEvent) => this.handleKeyDown(e);
  private onKeyUpBound = (e: KeyboardEvent) => this.handleKeyUp(e);
  private onResizeBound = () => this.handleResize();
  private onBlurBound = () => this.clearInputs();

  constructor(container: HTMLElement, initialSave: GameSaveRecord, callbacks: EngineCallbacks) {
    this.container = container;
    this.save = initialSave;
    this.callbacks = callbacks;

    this.initRendererAndScene();
    this.buildOpenWorld();
    this.buildPlayerModel();
    this.syncWorldFromSave(initialSave);
    this.bindEvents();
    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initRendererAndScene() {
    this.isSoftwareGl = this.detectSoftwareGl();
    const width = Math.max(320, this.container.clientWidth || window.innerWidth);
    const height = Math.max(240, this.container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#27323f');
    this.scene.fog = new THREE.FogExp2('#6e7c89', 0.0068);

    this.camera = new THREE.PerspectiveCamera(54, width / height, 0.2, 420);
    this.camera.position.set(0, 3.5, 16);

    // Physical atmospheric scattering Sky dome
    this.sky = new Sky();
    this.sky.scale.setScalar(4500);
    const skyUniforms = this.sky.material.uniforms;
    skyUniforms.turbidity.value = 4.2;
    skyUniforms.rayleigh.value = 1.65;
    skyUniforms.mieCoefficient.value = 0.003;
    skyUniforms.mieDirectionalG.value = 0.78;
    this.scene.add(this.sky);

    // Mandatory studio environment reflection
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createWorldTextures(maxAniso);

    // 3-point warm/cool outdoor lighting rig (<= 1 shadow caster)
    this.hemiLight = new THREE.HemisphereLight('#8db4d8', '#332b24', 0.85);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight('#ffdfb0', 1.65);
    this.keyLight.position.set(28, 46, 24);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    const d = 38;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 110;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    // Campfire warm point light at Safe Haven clearing (-7, -0.5)
    this.campfireLight = new THREE.PointLight('#fb923c', 2.6, 22, 1.5);
    this.campfireLight.position.set(-7, 1.6, -0.5);
    this.scene.add(this.campfireLight);

    // Player flashlight
    this.flashlight = new THREE.SpotLight('#fef3c7', 0, 32, Math.PI / 5, 0.45, 1.2);
    this.scene.add(this.flashlight);
    this.scene.add(this.flashlight.target);

    // Pooled particle mesh (fine sparks & debris, never blocky blobs)
    const pGeo = new THREE.DodecahedronGeometry(0.055, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.particleCount);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 0,
        color: new THREE.Color('#ffffff'),
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _color.set('#ffffff'));
    }
    this.scene.add(this.particleMesh);

    // Rain Points
    const rainCount = 600;
    this.rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 60;
      this.rainPositions[i * 3 + 1] = Math.random() * 26;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: '#cbd5e1',
      size: 0.18,
      transparent: true,
      opacity: 0.55,
    });
    this.rainPoints = new THREE.Points(rainGeo, rainMat);
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);

    // Pre-allocate projectile pool
    const projGeo = new THREE.SphereGeometry(0.16, 8, 8);
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(
        projGeo,
        new THREE.MeshBasicMaterial({ color: '#fbbf24' }),
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({
        active: false,
        fromPlayer: true,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        damage: 0,
        life: 0,
        mesh,
      });
    }
  }

  /**
   * Computes rolling wilderness terrain height while preserving flat asphalt roads,
   * Safe Haven clearing, building pads, and southern coastal shoreline at y = 0.
   */
  private groundHeightAt(x: number, z: number): number {
    // Keep roads, Safe Haven plaza, and south coastline flat
    const onNSRoad = Math.abs(x) < 10.5 && z < 88;
    const onEWRoad1 = z > -24 && z < -4;
    const onEWRoad2 = z > -70 && z < -54;
    const inHaven = x > -17 && x < 14 && z > -15 && z < 18;
    const nearCoast = z > 74;
    if (onNSRoad || onEWRoad1 || onEWRoad2 || inHaven || nearCoast) {
      return 0;
    }

    // Smoothly blend out of flat zones into rolling wooded hillsides
    const roadDist = Math.min(
      Math.abs(Math.abs(x) - 10.5),
      Math.min(Math.abs(z + 14) - 10, Math.abs(z + 62) - 8),
    );
    const radial = Math.hypot(x, z);
    const flatBlend = Math.max(0, Math.min(1, (Math.min(Math.abs(x) - 10.5, radial - 18)) / 14));
    const ridge =
      Math.max(0, Math.sin(x * 0.042) * Math.cos(z * 0.038) * 1.9 + Math.sin((x - z) * 0.025) * 1.1);
    const perimeterHills = Math.max(0, (radial - 72) / 38) * 3.8;
    const coastFade = z > 58 ? Math.max(0, (74 - z) / 16) : 1;
    void roadDist;
    return (ridge * flatBlend + perimeterHills * flatBlend) * coastFade;
  }

  private buildOpenWorld() {
    // Subdivided rolling terrain ground extending to the horizon
    const groundGeo = new THREE.PlaneGeometry(360, 360, 108, 108);
    groundGeo.rotateX(-Math.PI / 2);
    const gPos = groundGeo.attributes.position;
    for (let i = 0; i < gPos.count; i++) {
      const gx = gPos.getX(i);
      const gz = gPos.getZ(i);
      gPos.setY(i, this.groundHeightAt(gx, gz));
    }
    groundGeo.computeVertexNormals();

    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({
        map: this.textures.groundMap,
        bumpMap: this.textures.groundBump,
        bumpScale: 0.28,
        color: '#ffffff',
        roughness: 0.94,
        metalness: 0.02,
      }),
    );
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Coastal ocean along southern perimeter (z > 90)
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 120),
      new THREE.MeshStandardMaterial({
        color: '#163b52',
        roughness: 0.2,
        metalness: 0.68,
      }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, 0.04, 146);
    this.scene.add(ocean);

    // Asphalt highway arteries (offset Y >= 0.03 to avoid Z-fighting)
    const roadMat = new THREE.MeshStandardMaterial({
      map: this.textures.asphaltMap,
      color: '#ffffff',
      roughness: 0.86,
      metalness: 0.05,
    });
    const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(10, 180), roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.set(0, 0.03, -6);
    nsRoad.receiveShadow = true;
    this.scene.add(nsRoad);

    const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(9, 170), roadMat);
    ewRoad.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    ewRoad.position.set(0, 0.04, -14);
    ewRoad.receiveShadow = true;
    this.scene.add(ewRoad);

    const northCrossRoad = new THREE.Mesh(new THREE.PlaneGeometry(8, 156), roadMat);
    northCrossRoad.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    northCrossRoad.position.set(0, 0.04, -62);
    this.scene.add(northCrossRoad);

    // Highway W-beam steel guardrails & roadside wooden utility poles
    const railMat = new THREE.MeshStandardMaterial({
      color: '#6b7280',
      roughness: 0.45,
      metalness: 0.72,
    });
    const poleMat = new THREE.MeshStandardMaterial({
      map: this.textures.barkMap,
      color: '#d4c3b0',
      roughness: 0.92,
    });
    const railPostGeo = new THREE.BoxGeometry(0.12, 0.78, 0.12);
    const railBeamGeo = new THREE.BoxGeometry(0.08, 0.24, 11.5);
    for (const segZ of [-32, -46, 22, 42]) {
      for (const side of [-5.35, 5.35]) {
        const beam = new THREE.Mesh(railBeamGeo, railMat);
        beam.position.set(side, 0.62, segZ);
        beam.castShadow = true;
        this.scene.add(beam);
        for (let pz = -5; pz <= 5; pz += 2.5) {
          const post = new THREE.Mesh(railPostGeo, railMat);
          post.position.set(side, 0.39, segZ + pz);
          this.scene.add(post);
        }
      }
    }
    for (const poleZ of [-76, -50, -26, 2, 26, 52]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 7.2, 8), poleMat);
      pole.position.set(-6.3, 3.6, poleZ);
      pole.castShadow = true;
      const crossArm = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.14), poleMat);
      crossArm.position.set(-6.3, 6.65, poleZ);
      this.scene.add(pole, crossArm);
    }

    // Safe Haven Campfire on grass clearing beside cabin (-7, -0.5)
    const campfireGroup = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#44403c', roughness: 0.9 });
    const logMat = new THREE.MeshStandardMaterial({ map: this.textures.barkMap, color: '#8a6b52', roughness: 0.92 });
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), stoneMat);
      stone.position.set(Math.cos(ang) * 0.8, 0.14, Math.sin(ang) * 0.8);
      campfireGroup.add(stone);
    }
    for (let l = 0; l < 3; l++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.15, 7), logMat);
      log.rotation.z = Math.PI / 2 - 0.18;
      log.rotation.y = (l / 3) * Math.PI;
      log.position.y = 0.18;
      campfireGroup.add(log);
    }
    const embers = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.52, 0.08, 10),
      new THREE.MeshStandardMaterial({
        color: '#451a03',
        emissive: '#ea580c',
        emissiveIntensity: 1.4,
        roughness: 0.9,
      }),
    );
    embers.position.y = 0.05;
    campfireGroup.add(embers);

    // Layered natural flickering fire tongues
    this.campfireFlames = [];
    const flameColors = ['#ef4444', '#f97316', '#f59e0b', '#fde047'];
    for (let f = 0; f < 4; f++) {
      const fMat = new THREE.MeshBasicMaterial({
        color: flameColors[f],
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.14 - f * 0.02, 0.42 - f * 0.04, 6),
        fMat,
      );
      const ang = (f / 4) * Math.PI * 2;
      flame.position.set(Math.cos(ang) * 0.09, 0.28 + f * 0.02, Math.sin(ang) * 0.09);
      flame.rotation.z = (f % 2 === 0 ? 1 : -1) * 0.14;
      campfireGroup.add(flame);
      this.campfireFlames.push(flame);
    }
    campfireGroup.position.set(-7, 0, -0.5);
    this.scene.add(campfireGroup);

    // Safe Haven Cabin with front deck porch & gable roof
    const shelterMesh = buildBuildingMesh(
      7.5,
      3.8,
      5.5,
      this.textures.woodMap,
      '#443b34',
      this.textures,
    );
    shelterMesh.position.set(-7, 0, -6);
    this.scene.add(shelterMesh);
    this.obstacles.push({ minX: -10.8, maxX: -3.2, minZ: -8.8, maxZ: -1.5 });

    // Safe Haven perimeter watchtower at east highway edge
    const havenTower = buildStructureMesh('watchtower', this.textures);
    havenTower.position.set(7.8, 0, -8.5);
    this.scene.add(havenTower);
    this.obstacles.push({ minX: 6.3, maxX: 9.3, minZ: -10.0, maxZ: -7.0 });

    // Landmark buildings across the 9 zones
    const buildingSpecs: { x: number; z: number; w: number; h: number; d: number; color: string; tex: THREE.Texture }[] = [
      // City
      { x: -16, z: -46, w: 10, h: 12, d: 9, color: '#334155', tex: this.textures.concreteMap },
      { x: 16, z: -48, w: 11, h: 14, d: 9, color: '#475569', tex: this.textures.concreteMap },
      { x: -17, z: -74, w: 12, h: 16, d: 10, color: '#1e293b', tex: this.textures.concreteMap },
      { x: 16, z: -76, w: 10, h: 11, d: 8, color: '#3f3f46', tex: this.textures.concreteMap },
      // Suburbs
      { x: -48, z: -24, w: 7, h: 4.5, d: 6, color: '#7c2d12', tex: this.textures.woodMap },
      { x: -64, z: -4, w: 7.5, h: 4.5, d: 6.5, color: '#365314', tex: this.textures.woodMap },
      // Hospital
      { x: -58, z: -76, w: 14, h: 10, d: 10, color: '#9f1239', tex: this.textures.concreteMap },
      // Military Base
      { x: 64, z: -78, w: 13, h: 7, d: 11, color: '#3f6212', tex: this.textures.corrugatedMap },
      // Industrial
      { x: 62, z: -26, w: 12, h: 8, d: 10, color: '#7c2d12', tex: this.textures.corrugatedMap },
      { x: 52, z: -4, w: 9, h: 6, d: 8, color: '#52525b', tex: this.textures.corrugatedMap },
      // Farmland Barn
      { x: 56, z: 38, w: 10, h: 6, d: 8, color: '#991b1b', tex: this.textures.woodMap },
      // Underground Bunker Entrance + Port Warehouse
      { x: -12, z: 76, w: 9, h: 5, d: 8, color: '#4c1d95', tex: this.textures.concreteMap },
      { x: 14, z: 80, w: 9, h: 4.5, d: 7, color: '#1e3a5f', tex: this.textures.corrugatedMap },
    ];

    for (const b of buildingSpecs) {
      const mesh = buildBuildingMesh(b.w, b.h, b.d, b.tex, b.color, this.textures);
      mesh.position.set(b.x, this.groundHeightAt(b.x, b.z), b.z);
      this.scene.add(mesh);
      this.obstacles.push({
        minX: b.x - b.w / 2 - 0.5,
        maxX: b.x + b.w / 2 + 0.5,
        minZ: b.z - b.d / 2 - 0.5,
        maxZ: b.z + b.d / 2 + 0.5,
      });
    }

    // Coastal wooden dock at south end
    const dock = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.5, 16),
      new THREE.MeshStandardMaterial({ map: this.textures.woodMap, color: '#ffffff', roughness: 0.85 }),
    );
    dock.position.set(0, 0.3, 94);
    this.scene.add(dock);

    // Conifer Pine Forest (alpha-cutout pine bough clusters on bark trunks)
    const treePositions: [number, number, number][] = [
      [-18, 12, 1.05], [-24, 6, 1.15], [-28, 22, 1.15], [-36, 34, 1.25], [-52, 42, 1.3],
      [-66, 52, 1.15], [-44, 58, 1.05], [-72, 24, 1.2], [-76, -34, 1.1], [-32, -32, 1.0],
      [19, 14, 1.1], [28, 26, 1.15], [38, 48, 1.2], [74, 24, 1.15], [78, -42, 1.2],
      [28, -26, 1.0], [-24, 62, 1.1], [28, 60, 1.05], [-16, -26, 1.0], [18, -28, 1.05],
    ];
    for (let i = 0; i < 48; i++) {
      const ang = (i / 48) * Math.PI * 2;
      const rad = 86 + (i % 3) * 10;
      const rx = Math.cos(ang) * rad;
      const rz = Math.sin(ang) * rad;
      if (rz < 82 && Math.abs(rx) > 9) {
        treePositions.push([rx, rz, 1.15 + (i % 4) * 0.14]);
      }
    }
    for (const [tx, tz, sc] of treePositions) {
      const tree = buildTreeMesh(sc, this.textures);
      tree.position.set(tx, this.groundHeightAt(tx, tz), tz);
      tree.rotation.y = (tx * 0.37 + tz * 0.21) % (Math.PI * 2);
      this.scene.add(tree);
      this.obstacles.push({
        minX: tx - 0.85,
        maxX: tx + 0.85,
        minZ: tz - 0.85,
        maxZ: tz + 0.85,
      });
    }

    // InstancedMesh Wild Tall Grass Tufts along shoulders, clearings & woodland
    const grassGeo = new THREE.PlaneGeometry(0.95, 0.92);
    grassGeo.translate(0, 0.44, 0);
    const grassMat = new THREE.MeshStandardMaterial({
      map: this.textures.grassBladeMap,
      color: '#cfd8b8',
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.92,
      metalness: 0.0,
    });
    const grassCount = 1100;
    const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    let gIdx = 0;
    for (let i = 0; i < grassCount * 2 && gIdx < grassCount; i++) {
      const gx = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 165;
      const gz = (Math.sin(i * 78.233 + 17) * 43758.5453 % 1) * 165;
      const wx = ((gx - Math.floor(gx)) - 0.5) * 170;
      const wz = ((gz - Math.floor(gz)) - 0.5) * 160;
      // Skip asphalt strips & southern ocean
      if (Math.abs(wx) < 5.4 || (wz > -19 && wz < -9) || (wz > -66 && wz < -58) || wz > 84) {
        continue;
      }
      const gy = this.groundHeightAt(wx, wz);
      _dummy.position.set(wx, gy, wz);
      _dummy.rotation.set(0, (i * 1.13) % Math.PI, 0);
      const gScale = 0.75 + ((i * 7) % 10) * 0.06;
      _dummy.scale.set(gScale, gScale, gScale);
      _dummy.updateMatrix();
      grassInst.setMatrixAt(gIdx++, _dummy.matrix);
    }
    grassInst.count = gIdx;
    grassInst.instanceMatrix.needsUpdate = true;
    this.scene.add(grassInst);

    // InstancedMesh Weathered Granite Rocks / Boulders
    const rockGeo = new THREE.DodecahedronGeometry(0.62, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      map: this.textures.concreteMap,
      color: '#5a5f64',
      roughness: 0.95,
      metalness: 0.04,
    });
    const rockCount = 140;
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    let rIdx = 0;
    for (let i = 0; i < rockCount * 2 && rIdx < rockCount; i++) {
      const rx = Math.sin(i * 41.7) * 84;
      const rz = Math.cos(i * 23.3) * 80;
      if (Math.abs(rx) < 8 || (rz > -22 && rz < -6) || Math.hypot(rx, rz - 4) < 16) continue;
      const ry = this.groundHeightAt(rx, rz);
      _dummy.position.set(rx, ry + 0.2, rz);
      _dummy.rotation.set(i * 0.4, i * 0.9, i * 0.2);
      const sx = 0.7 + (i % 5) * 0.35;
      const sy = 0.45 + (i % 3) * 0.25;
      _dummy.scale.set(sx, sy, sx * 0.85);
      _dummy.updateMatrix();
      rockInst.setMatrixAt(rIdx++, _dummy.matrix);
    }
    rockInst.count = rIdx;
    rockInst.instanceMatrix.needsUpdate = true;
    this.scene.add(rockInst);

    // Drivable vehicles parked on highways + rusted highway wrecks for atmosphere
    const vehicleSpecs: { id: string; x: number; z: number; rotY: number; color: string; wrecked?: boolean }[] = [
      { id: 'pickup_haven', x: 6.8, z: 12, rotY: 0.25, color: '#6b3e2e' },
      { id: 'jeep_city', x: -3.2, z: -42, rotY: Math.PI, color: '#3b4d2b' },
      { id: 'wreck_1', x: 2.3, z: -26, rotY: 2.55, color: '#4c382c', wrecked: true },
      { id: 'wreck_2', x: -2.6, z: -56, rotY: -0.45, color: '#4c382c', wrecked: true },
    ];
    for (const v of vehicleSpecs) {
      const mesh = buildVehicleMesh(this.textures, v.color, v.wrecked);
      mesh.position.set(v.x, this.groundHeightAt(v.x, v.z), v.z);
      mesh.rotation.y = v.rotY;
      this.scene.add(mesh);
      if (v.wrecked) {
        this.obstacles.push({
          minX: v.x - 1.5,
          maxX: v.x + 1.5,
          minZ: v.z - 2.3,
          maxZ: v.z + 2.3,
        });
      } else {
        this.vehicles.push({ id: v.id, x: v.x, z: v.z, rotY: v.rotY, speed: 0, mesh });
      }
    }

    // Military Supply Cases in every zone
    const crateMat = new THREE.MeshStandardMaterial({ color: '#3b4232', roughness: 0.72, metalness: 0.22 });
    const lidMat = new THREE.MeshStandardMaterial({ color: '#4c5440', roughness: 0.65, metalness: 0.28 });
    const latchMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.35, metalness: 0.75 });
    for (const zone of WORLD_ZONES) {
      const offsets: [number, number][] = [
        [7.5, 4.5],
        [-7.5, 6.5],
        [7.5, -5.5],
      ];
      offsets.forEach(([ox, oz], idx) => {
        const cx = zone.centerX + ox;
        const cz = zone.centerZ + oz;
        const cy = this.groundHeightAt(cx, cz);
        const crateGroup = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.52, 0.75), crateMat);
        box.position.y = 0.26;
        box.castShadow = true;
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.8), lidMat);
        lid.position.y = 0.58;
        const latchL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.08), latchMat);
        latchL.position.set(-0.32, 0.52, 0.41);
        const latchR = latchL.clone();
        latchR.position.x = 0.32;
        crateGroup.add(box, lid, latchL, latchR);
        crateGroup.position.set(cx, cy, cz);
        this.scene.add(crateGroup);
        this.lootNodes.push({
          id: `loot_${zone.id}_${idx}`,
          zoneId: zone.id,
          x: cx,
          z: cz,
          mesh: crateGroup,
          lid,
          looted: false,
          respawnTimer: 0,
        });
      });
    }

    // Recruitable Survivor NPCs
    for (const npc of RECRUITABLE_SURVIVORS) {
      const npcChar = {
        ...PLAYABLE_CHARACTERS[0],
        clothingColor: npc.shirtColor,
        accentColor: '#f59e0b',
        buildScale: [0.96, 1, 0.96] as [number, number, number],
      };
      const built = buildSurvivorMesh(npcChar, this.textures, true);
      built.group.position.set(npc.spawnX, this.groundHeightAt(npc.spawnX, npc.spawnZ), npc.spawnZ);
      const marker = new THREE.Mesh(
        new THREE.RingGeometry(0.95, 1.15, 20),
        new THREE.MeshBasicMaterial({ color: '#22c55e', side: THREE.DoubleSide }),
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.06;
      built.group.add(marker);
      this.scene.add(built.group);
      this.npcs.push({
        id: npc.id,
        name: npc.name,
        mesh: built.group,
        x: npc.spawnX,
        z: npc.spawnZ,
        recruited: false,
        marker,
      });
    }

    // Spawn initial zombies + zone bosses
    this.populateInitialZombies();
  }

  private buildPlayerModel() {
    if (this.playerGroup) {
      this.scene.remove(this.playerGroup);
    }
    const char = getCharacterById(this.save.characterId);
    const built = buildSurvivorMesh(char, this.textures, false);
    this.playerGroup = built.group;
    this.playerLeftLeg = built.leftLeg;
    this.playerRightLeg = built.rightLeg;
    this.playerRightArm = built.rightArm;
    const py = this.groundHeightAt(this.save.payload.position.x, this.save.payload.position.z);
    this.playerGroup.position.set(this.save.payload.position.x, py, this.save.payload.position.z);
    this.playerGroup.rotation.y = Math.PI;
    this.scene.add(this.playerGroup);
  }

  private spawnZombie(def: ZombieDefinition, x: number, z: number) {
    const built = buildZombieMesh(def, this.textures);
    built.group.position.set(x, this.groundHeightAt(x, z), z);
    const telegraphRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.35, 24),
      new THREE.MeshBasicMaterial({
        color: def.isBoss ? '#ef4444' : '#f97316',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      }),
    );
    telegraphRing.rotation.x = -Math.PI / 2;
    telegraphRing.position.y = 0.06;
    telegraphRing.visible = false;
    built.group.add(telegraphRing);

    this.scene.add(built.group);

    const scaling = getEvolutionScaling(this.save.day, this.save.difficulty);
    const maxHp = Math.round(def.baseHp * scaling.hpMult);
    const dmg = Math.round(def.damage * scaling.dmgMult);

    this.zombies.push({
      uid: `z_${def.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      def,
      mesh: built.group,
      hitMaterials: built.hitMaterials,
      x,
      z,
      vx: 0,
      vz: 0,
      rotY: Math.random() * Math.PI * 2,
      hp: maxHp,
      maxHp,
      speed: def.speed,
      damage: dmg,
      state: 'idle',
      stateTimer: 0,
      hitFlash: 0,
      koTimer: 0,
      orbitDir: Math.random() > 0.5 ? 1 : -1,
      telegraphRing,
    });
  }

  private populateInitialZombies() {
    // Clear existing zombies
    for (const z of this.zombies) {
      this.scene.remove(z.mesh);
    }
    this.zombies = [];

    const byId = (id: string) => ZOMBIE_DEFINITIONS.find((d) => d.id === id)!;

    // Near Safe Haven perimeter (clear starting path, zombies at 18–26m away so player is safe first few seconds)
    this.spawnZombie(byId('walker'), -14, -22);
    this.spawnZombie(byId('walker'), 14, -24);
    this.spawnZombie(byId('crawler'), 18, 12);

    // City
    this.spawnZombie(byId('walker'), -6, -42);
    this.spawnZombie(byId('runner'), 7, -50);
    this.spawnZombie(byId('screamer'), -8, -62);
    this.spawnZombie(byId('spitter'), 10, -66);

    // Suburbs
    this.spawnZombie(byId('walker'), -44, -14);
    this.spawnZombie(byId('runner'), -56, -8);

    // Industrial + Juggernaut Boss
    this.spawnZombie(byId('brute'), 52, -16);
    if (!this.save.payload.defeatedBossIds.includes('juggernaut')) {
      this.spawnZombie(byId('juggernaut'), 62, -16);
    }

    // Forest + Alpha Hunter Boss
    this.spawnZombie(byId('stalker'), -48, 36);
    if (!this.save.payload.defeatedBossIds.includes('alpha_hunter')) {
      this.spawnZombie(byId('alpha_hunter'), -58, 48);
    }

    // Hospital + Plague Mother Boss
    this.spawnZombie(byId('spitter'), -50, -56);
    if (!this.save.payload.defeatedBossIds.includes('plague_mother')) {
      this.spawnZombie(byId('plague_mother'), -58, -64);
    }

    // Military + The Warden Boss
    this.spawnZombie(byId('brute'), 54, -58);
    if (!this.save.payload.defeatedBossIds.includes('the_warden')) {
      this.spawnZombie(byId('the_warden'), 62, -68);
    }

    // Underground Bunker + The Origin Final Boss
    this.spawnZombie(byId('stalker'), -8, 64);
    if (!this.save.payload.defeatedBossIds.includes('the_origin')) {
      this.spawnZombie(byId('the_origin'), 0, 74);
    }
  }

  public syncWorldFromSave(newSave: GameSaveRecord) {
    const charChanged = this.save.characterId !== newSave.characterId;
    this.save = newSave;
    if (charChanged) {
      this.buildPlayerModel();
    }
    this.playerGroup.position.set(
      newSave.payload.position.x,
      this.groundHeightAt(newSave.payload.position.x, newSave.payload.position.z),
      newSave.payload.position.z,
    );

    // Sync loot nodes
    for (const node of this.lootNodes) {
      const isLooted = newSave.payload.lootedContainerIds.includes(node.id);
      node.looted = isLooted;
      node.lid.rotation.x = isLooted ? -0.9 : 0;
    }

    // Sync placed base structures
    for (const [uid, mesh] of this.placedStructureMeshes.entries()) {
      if (!newSave.payload.structures.some((s) => s.uid === uid)) {
        this.scene.remove(mesh);
        this.placedStructureMeshes.delete(uid);
      }
    }
    for (const s of newSave.payload.structures) {
      if (!this.placedStructureMeshes.has(s.uid)) {
        const mesh = buildStructureMesh(s.structureId, this.textures);
        mesh.position.set(s.x, this.groundHeightAt(s.x, s.z), s.z);
        mesh.rotation.y = s.rotationY;
        this.scene.add(mesh);
        this.placedStructureMeshes.set(s.uid, mesh);
      }
    }

    // Sync recruited NPCs (move recruited NPCs into Safe Haven patrol positions)
    let havenSlot = 0;
    for (const npc of this.npcs) {
      const isRecruited = newSave.payload.recruitedIds.includes(npc.id);
      npc.recruited = isRecruited;
      npc.marker.visible = !isRecruited;
      if (isRecruited) {
        const ang = (havenSlot / Math.max(1, newSave.payload.recruitedIds.length)) * Math.PI * 2;
        npc.x = Math.cos(ang) * 7.5;
        npc.z = Math.sin(ang) * 7.5;
        npc.mesh.position.set(npc.x, this.groundHeightAt(npc.x, npc.z), npc.z);
        havenSlot++;
      }
    }

    this.emitHud();
  }

  public setGameState(state: GameScreenState) {
    this.gameState = state;
    document.body.dataset.state = state;
    if (state !== 'playing') {
      this.clearInputs();
    }
  }

  public getSaveSnapshot(): GameSaveRecord {
    return this.save;
  }

  public setMoveInput(x: number, z: number) {
    this.touchMoveX = Math.max(-1, Math.min(1, x));
    this.touchMoveZ = Math.max(-1, Math.min(1, z));
  }

  public setTouchSprint(active: boolean) {
    this.touchSprinting = active;
  }

  public addCameraYaw(delta: number) {
    this.cameraYaw += delta;
  }

  public toggleCrouch() {
    this.isCrouching = !this.isCrouching;
    this.emitHud();
  }

  public triggerAttack() {
    if (this.gameState !== 'playing' || this.attackCooldown > 0) return;
    if (this.save.payload.inVehicle) return;

    const firearmDef = ITEMS_CATALOG[this.save.payload.equippedWeaponId];
    const isFirearm = firearmDef?.category === 'firearm';
    const magAmmo = this.save.payload.ammoInMag[this.save.payload.equippedWeaponId] ?? 0;

    if (isFirearm && magAmmo > 0) {
      // Fire projectile
      this.attackCooldown = firearmDef.cooldown ?? 0.3;
      const nextAmmoInMag = {
        ...this.save.payload.ammoInMag,
        [firearmDef.id]: magAmmo - 1,
      };
      this.save = {
        ...this.save,
        payload: { ...this.save.payload, ammoInMag: nextAmmoInMag },
      };

      const dmg = computeWeaponDamage(this.save, firearmDef.id);
      const dirX = -Math.sin(this.cameraYaw);
      const dirZ = -Math.cos(this.cameraYaw);
      const px = this.save.payload.position.x + dirX * 1.05;
      const pz = this.save.payload.position.z + dirZ * 1.05;

      this.spawnProjectile(true, px, 1.32, pz, dirX * 38, 0, dirZ * 38, dmg);
      this.spawnParticleBurst(px, 1.32, pz, '#fde047', 4, 2.4);
      this.noiseLevel = Math.max(this.noiseLevel, firearmDef.noiseRadius ?? 28);
      this.cameraTrauma = Math.min(1, this.cameraTrauma + (firearmDef.id === 'shotgun' ? 0.45 : 0.2));
      this.playerRightArm.rotation.x = -0.35;
      soundEngine.playGunshot(firearmDef.id === 'shotgun' || firearmDef.id === 'hunting_rifle');
      this.emitHud();
    } else {
      // Melee swing fallback (never leaves player helpless when out of ammo!)
      const meleeId = this.save.payload.equippedMeleeId || 'kitchen_knife';
      const meleeDef = ITEMS_CATALOG[meleeId] ?? ITEMS_CATALOG.kitchen_knife;
      this.attackCooldown = meleeDef.cooldown ?? 0.45;
      const dmg = computeWeaponDamage(this.save, meleeDef.id);
      const range = (meleeDef.range ?? 2.5) + 0.6;
      this.playerRightArm.rotation.x = -1.2;
      soundEngine.playMeleeSwing();

      const px = this.save.payload.position.x;
      const pz = this.save.payload.position.z;
      let hitAny = false;
      for (const z of this.zombies) {
        if (z.state === 'ko') continue;
        const dist = Math.hypot(z.x - px, z.z - pz);
        if (dist <= range) {
          this.damageZombie(z, dmg, true);
          hitAny = true;
        }
      }
      if (hitAny) {
        this.hitstopTimer = 0.04;
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.25);
        soundEngine.playHitImpact(false);
      }
    }
  }

  public triggerReload() {
    if (this.gameState !== 'playing') return;
    const wId = this.save.payload.equippedWeaponId;
    const def = ITEMS_CATALOG[wId];
    if (!def || def.category !== 'firearm' || !def.ammoType || !def.magSize) return;
    const currentMag = this.save.payload.ammoInMag[wId] ?? 0;
    const needed = def.magSize - currentMag;
    if (needed <= 0) return;
    const available = getItemCount(this.save.payload.inventory, def.ammoType);
    if (available <= 0) {
      this.callbacks.onToast('Out of reserve ammunition!');
      return;
    }
    const loadAmount = Math.min(needed, available);
    const nextInv = removeItemFromInventory(this.save.payload.inventory, def.ammoType, loadAmount);
    if (!nextInv) return;
    this.save = {
      ...this.save,
      payload: {
        ...this.save.payload,
        inventory: nextInv,
        ammoInMag: { ...this.save.payload.ammoInMag, [wId]: currentMag + loadAmount },
      },
    };
    soundEngine.playCraft();
    this.callbacks.onSaveChanged(this.save);
    this.emitHud();
  }

  public triggerInteract() {
    if (this.gameState !== 'playing') return;
    const px = this.save.payload.position.x;
    const pz = this.save.payload.position.z;

    // Exit vehicle if currently driving
    if (this.save.payload.inVehicle) {
      this.save = {
        ...this.save,
        payload: { ...this.save.payload, inVehicle: false },
      };
      this.playerGroup.visible = true;
      this.callbacks.onToast('Exited vehicle.');
      this.callbacks.onSaveChanged(this.save);
      this.emitHud();
      return;
    }

    // 1. Check nearby NPCs to recruit
    for (const npc of this.npcs) {
      if (!npc.recruited && Math.hypot(npc.x - px, npc.z - pz) < 3.6) {
        const npcDef = RECRUITABLE_SURVIVORS.find((n) => n.id === npc.id)!;
        const recruitedIds = [...this.save.payload.recruitedIds, npc.id];
        this.save = {
          ...this.save,
          payload: {
            ...this.save.payload,
            recruitedIds,
            survivorTasks: { ...this.save.payload.survivorTasks, [npc.id]: npcDef.assignedTask },
            survivorTrust: { ...this.save.payload.survivorTrust, [npc.id]: npcDef.trust },
            score: this.save.payload.score + 120,
          },
        };
        const evalRes = evaluateAchievementsAndChapters(this.save);
        this.save = evalRes.save;
        this.syncWorldFromSave(this.save);
        soundEngine.playPickup();
        this.callbacks.onToast(`${npc.name} (${npcDef.role}) joined Safe Haven!`);
        this.callbacks.onSaveChanged(this.save, true);
        return;
      }
    }

    // 2. Check nearby Loot Crates
    for (const node of this.lootNodes) {
      if (!node.looted && Math.hypot(node.x - px, node.z - pz) < 3.2) {
        const zone = WORLD_ZONES.find((z) => z.id === node.zoneId) ?? WORLD_ZONES[0];
        const pool = zone.lootPool;
        const picked1 = pool[Math.floor(Math.random() * pool.length)];
        const picked2 = pool[Math.floor(Math.random() * pool.length)];
        let inv = addItemToInventory(this.save.payload.inventory, picked1, ITEMS_CATALOG[picked1]?.category === 'ammo' ? 8 : 1);
        inv = addItemToInventory(inv, picked2, ITEMS_CATALOG[picked2]?.category === 'ammo' ? 6 : 1);

        node.looted = true;
        node.lid.rotation.x = -0.9;
        node.respawnTimer = 180;

        this.save = {
          ...this.save,
          payload: {
            ...this.save.payload,
            inventory: inv,
            lootedContainerIds: [...this.save.payload.lootedContainerIds, node.id],
            itemsCollected: this.save.payload.itemsCollected + 2,
            score: this.save.payload.score + 25,
          },
        };
        const evalRes = evaluateAchievementsAndChapters(this.save);
        this.save = evalRes.save;
        soundEngine.playPickup();
        this.callbacks.onToast(
          `Found ${ITEMS_CATALOG[picked1]?.name} & ${ITEMS_CATALOG[picked2]?.name}`,
        );
        this.callbacks.onSaveChanged(this.save, true);
        this.emitHud();
        return;
      }
    }

    // 3. Check nearby Vehicle
    for (const v of this.vehicles) {
      if (Math.hypot(v.x - px, v.z - pz) < 4.5) {
        this.save = {
          ...this.save,
          payload: { ...this.save.payload, inVehicle: true },
        };
        this.playerGroup.visible = false;
        soundEngine.playCraft();
        this.callbacks.onToast('Entered vehicle! Press E to exit.');
        this.callbacks.onSaveChanged(this.save);
        this.emitHud();
        return;
      }
    }

    // 4. Check Safe Haven Campfire / Rest Bed at (-7, -0.5)
    if (Math.hypot(px - -7, pz - -0.5) < 4.0) {
      const adv = advanceCalendar(this.save, 6);
      this.save = adv.save;
      this.save.payload.stats.energy = 100;
      this.save.payload.stats.health = Math.min(
        this.save.payload.stats.maxHealth,
        this.save.payload.stats.health + 20,
      );
      const evalRes = evaluateAchievementsAndChapters(this.save);
      this.save = evalRes.save;
      soundEngine.playPickup();
      this.callbacks.onToast('Rested by the campfire (+6 hrs, Energy restored).');
      this.callbacks.onSaveChanged(this.save, true);
      this.emitHud();
    }
  }

  private spawnProjectile(
    fromPlayer: boolean,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    damage: number,
  ) {
    const p = this.projectiles.find((pr) => !pr.active);
    if (!p) return;
    p.active = true;
    p.fromPlayer = fromPlayer;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.damage = damage;
    p.life = fromPlayer ? 1.1 : 2.2;
    (p.mesh.material as THREE.MeshBasicMaterial).color.set(fromPlayer ? '#fde047' : '#84cc16');
    p.mesh.position.set(x, y, z);
    p.mesh.visible = true;
  }

  private spawnParticleBurst(
    x: number,
    y: number,
    z: number,
    hex: string,
    count: number,
    speed: number,
  ) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particleCount;
      p.active = true;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = (Math.random() - 0.5) * speed;
      p.vy = Math.random() * speed * 0.8 + 1;
      p.vz = (Math.random() - 0.5) * speed;
      p.life = 0.45 + Math.random() * 0.25;
      p.maxLife = p.life;
      p.scale = 0.7 + Math.random() * 0.6;
      p.color.set(hex);
    }
  }

  private damageZombie(z: ZombieActor, dmg: number, knockback: boolean) {
    z.hp -= dmg;
    z.hitFlash = 0.08;
    for (const mat of z.hitMaterials) {
      mat.emissive.set('#ffffff');
      mat.emissiveIntensity = 0.85;
    }

    const dx = z.x - this.save.payload.position.x;
    const dz = z.z - this.save.payload.position.z;
    const dist = Math.max(0.1, Math.hypot(dx, dz));
    if (knockback) {
      z.x += (dx / dist) * 0.85;
      z.z += (dz / dist) * 0.85;
    }

    this.spawnParticleBurst(z.x, 1.2, z.z, '#dc2626', 10, 5);

    if (z.hp <= 0 && z.state !== 'ko') {
      z.state = 'ko';
      z.koTimer = 0.42;
      z.telegraphRing.visible = false;
      this.hitstopTimer = z.def.isBoss ? 0.07 : 0.035;
      this.cameraTrauma = Math.min(1, this.cameraTrauma + (z.def.isBoss ? 0.65 : 0.28));

      let inv = this.save.payload.inventory;
      const drop = z.def.drops[Math.floor(Math.random() * z.def.drops.length)];
      if (drop) {
        inv = addItemToInventory(inv, drop, ITEMS_CATALOG[drop]?.category === 'ammo' ? 5 : 1);
      }

      const defeatedBossIds =
        z.def.isBoss && !this.save.payload.defeatedBossIds.includes(z.def.id)
          ? [...this.save.payload.defeatedBossIds, z.def.id]
          : this.save.payload.defeatedBossIds;

      const stats = { ...this.save.payload.stats };
      stats.xp += z.def.xpReward;

      this.save = {
        ...this.save,
        payload: {
          ...this.save.payload,
          stats,
          inventory: inv,
          defeatedBossIds,
          zombieKills: this.save.payload.zombieKills + 1,
          score: this.save.payload.score + z.def.xpReward,
        },
      };

      const evalRes = evaluateAchievementsAndChapters(this.save);
      this.save = evalRes.save;
      for (const chTitle of evalRes.newlyCompletedChapters) {
        this.callbacks.onToast(`Mission Complete: ${chTitle}`);
      }
      for (const achTitle of evalRes.newlyUnlockedAchievements) {
        this.callbacks.onToast(`Achievement Unlocked: ${achTitle}`);
      }
      if (z.def.isBoss) {
        this.callbacks.onToast(`BOSS DEFEATED: ${z.def.name}!`);
      }
      this.callbacks.onSaveChanged(this.save, z.def.isBoss);
    }
  }

  private damagePlayer(rawDmg: number, infectionGain = 2) {
    if (this.gameState !== 'playing') return;
    const def = getArmorDefense(this.save.payload.equippedArmorId);
    const dmg = Math.max(2, Math.round(rawDmg * (1 - def / 100)));
    const stats = { ...this.save.payload.stats };
    stats.health = Math.max(0, stats.health - dmg);
    stats.infection = Math.min(100, stats.infection + infectionGain);
    if (Math.random() < 0.16) {
      stats.bleeding = true;
    }

    this.save = {
      ...this.save,
      payload: { ...this.save.payload, stats },
    };
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.45);
    soundEngine.playPlayerHurt();

    if (stats.health <= 0) {
      this.setGameState('gameover');
      this.callbacks.onGameOver(this.save);
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.gameState !== 'playing') return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    this.keys.add(e.code);
    if (e.code === 'Space') this.triggerAttack();
    if (e.code === 'KeyE') this.triggerInteract();
    if (e.code === 'KeyR') this.triggerReload();
    if (e.code === 'KeyC') this.toggleCrouch();
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.code);
  }

  private clearInputs() {
    this.keys.clear();
    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.touchSprinting = false;
    this.pointerDown = false;
  }

  private handleResize() {
    if (!this.container || this.disposed) return;
    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const h = Math.max(240, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('resize', this.onResizeBound);
    window.addEventListener('blur', this.onBlurBound);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      this.pointerDown = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.pointerMovedDist = 0;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.pointerDown || this.gameState !== 'playing') return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.pointerMovedDist += Math.abs(dx) + Math.abs(dy);
      this.cameraYaw -= dx * 0.0055;
      this.cameraPitch = Math.max(-0.15, Math.min(0.65, this.cameraPitch + dy * 0.003));
    });
    window.addEventListener('pointerup', () => {
      if (this.pointerDown && this.pointerMovedDist < 8 && this.gameState === 'playing') {
        this.triggerAttack();
      }
      this.pointerDown = false;
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        if (this.gameState !== 'playing') return;
        this.cameraZoom = Math.max(0.7, Math.min(1.85, this.cameraZoom + e.deltaY * 0.001));
      },
      { passive: true },
    );
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    // Render first frame immediately so Title Screen / initial viewport is never blank
    this.update(0.016);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number) {
    this.elapsedTime += dt;

    // Update sky/day-night atmosphere continuously
    this.updateAtmosphere(dt);

    // Hit flash & particle updates always tick smoothly in real dt
    this.updateParticles(dt);
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.8);

    if (this.gameState === 'title') {
      // Grounded, cinematic low-angle orbit showcasing Safe Haven, campfire, pickup truck, pine forest & skyline
      const angle = 0.34 + this.elapsedTime * 0.12;
      this.camera.position.set(
        -2.5 + Math.sin(angle) * 12.2,
        2.8 + Math.sin(this.elapsedTime * 0.35) * 0.35,
        4.5 + Math.cos(angle) * 12.2,
      );
      this.camera.lookAt(-2.5, 1.75, -8);
      return;
    }

    if (this.gameState !== 'playing') return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.noiseLevel = Math.max(0, this.noiseLevel - dt * 14);
    this.playerRightArm.rotation.x += (0 - this.playerRightArm.rotation.x) * Math.min(1, dt * 10);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // Player movement
    this.updatePlayerMovement(dt);

    // Projectiles & Zombies
    this.updateProjectiles(dt);
    this.updateZombies(dt);

    // Calendar, survival decay & auto-save
    this.simTickAccum += dt;
    this.autoSaveTimer += dt;
    if (this.eventTimer > 0) {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0) this.activeEventBanner = null;
    }

    if (this.simTickAccum >= 0.5) {
      const step = this.simTickAccum;
      this.simTickAccum = 0;

      // 1 in-game hour = 30 real seconds -> 24h day in 12 mins
      const adv = advanceCalendar(this.save, step / 30);
      this.save = adv.save;
      if (adv.newDayTriggered) {
        this.callbacks.onToast(`Day ${this.save.day} Dawn — Keep surviving!`);
        this.callbacks.onSaveChanged(this.save, true);
      }

      const nearCampfire =
        Math.hypot(this.save.payload.position.x + 7, this.save.payload.position.z + 0.5) < 6;
      const isNight = this.save.timeOfDay < 6 || this.save.timeOfDay >= 20;
      const sprinting =
        (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchSprinting) &&
        this.save.payload.stats.stamina > 5;

      this.save.payload.stats = tickSurvivalNeeds(this.save.payload.stats, {
        dt: step,
        isSprinting: sprinting,
        isNight,
        weather: this.save.weather,
        nearCampfire,
        character: getCharacterById(this.save.characterId),
        difficulty: this.save.difficulty,
        armorId: this.save.payload.equippedArmorId,
      });

      if (this.save.payload.stats.health <= 0) {
        this.setGameState('gameover');
        this.callbacks.onGameOver(this.save);
        return;
      }

      // Dynamic Zone discovery
      const zone = getZoneAtPosition(this.save.payload.position.x, this.save.payload.position.z);
      if (!this.save.payload.discoveredZoneIds.includes(zone.id)) {
        this.save.payload.discoveredZoneIds = [...this.save.payload.discoveredZoneIds, zone.id];
        this.callbacks.onToast(`Discovered: ${zone.name}`);
        const evalRes = evaluateAchievementsAndChapters(this.save);
        this.save = evalRes.save;
      }
    }

    // Periodic zombie respawn & dynamic world events
    this.spawnTimer += dt;
    if (this.spawnTimer >= 12) {
      this.spawnTimer = 0;
      const scaling = getEvolutionScaling(this.save.day, this.save.difficulty);
      if (this.zombies.length < scaling.spawnBudget) {
        const ang = Math.random() * Math.PI * 2;
        const rx = Math.max(-88, Math.min(88, this.save.payload.position.x + Math.cos(ang) * 28));
        const rz = Math.max(-88, Math.min(84, this.save.payload.position.z + Math.sin(ang) * 28));
        const pool = ZOMBIE_DEFINITIONS.filter((d) => !d.isBoss);
        const chosen = pool[Math.floor(Math.random() * Math.min(pool.length, 3 + Math.floor(this.save.day / 2)))];
        this.spawnZombie(chosen, rx, rz);
      }
    }

    // Loot crate respawn
    for (const node of this.lootNodes) {
      if (node.looted && node.respawnTimer > 0) {
        node.respawnTimer -= dt;
        if (node.respawnTimer <= 0) {
          node.looted = false;
          node.lid.rotation.x = 0;
          this.save.payload.lootedContainerIds = this.save.payload.lootedContainerIds.filter(
            (id) => id !== node.id,
          );
        }
      }
    }

    if (this.autoSaveTimer >= 45) {
      this.autoSaveTimer = 0;
      this.callbacks.onSaveChanged(this.save, true);
    }

    // Update camera smoothly
    this.updateFollowCamera(dt);

    this.hudThrottle += dt;
    if (this.hudThrottle >= 0.1) {
      this.hudThrottle = 0;
      this.emitHud();
    }
  }

  private updateAtmosphere(dt: number) {
    const t = this.save.timeOfDay;
    const sunAngle = ((t - 6) / 24) * Math.PI * 2;
    const elevDeg = Math.sin(sunAngle) * 58;
    const isDay = elevDeg > -2;
    const dayFactor = Math.max(0, Math.min(1, (elevDeg + 10) / 34));

    // Update physical atmospheric Sky scattering dome & HDR exposure calibration
    const phi = THREE.MathUtils.degToRad(90 - Math.max(-2.5, elevDeg));
    const theta = THREE.MathUtils.degToRad(155);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    this.sky.visible = elevDeg > -14;
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 0.56, dayFactor);

    // Sky/fog color transitions between dusk/night/dawn/day
    const nightCol = _color.set('#0b1018');
    const dayCol = _v1.set(0.46, 0.58, 0.70);
    const r = THREE.MathUtils.lerp(nightCol.r, dayCol.x, dayFactor);
    const g = THREE.MathUtils.lerp(nightCol.g, dayCol.y, dayFactor);
    const b = THREE.MathUtils.lerp(nightCol.b, dayCol.z, dayFactor);
    (this.scene.background as THREE.Color).setRGB(r, g, b);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setRGB(r, g, b);
      this.scene.fog.density =
        this.save.weather === 'fog' ? 0.022 : this.save.weather === 'storm' ? 0.015 : 0.0062;
    }

    this.keyLight.intensity = 0.4 + dayFactor * 2.15;
    this.hemiLight.intensity = 0.42 + dayFactor * 0.72;
    this.keyLight.position.set(
      this.save.payload.position.x + this.sunDir.x * 48,
      Math.max(14, this.sunDir.y * 48 + 14),
      this.save.payload.position.z + this.sunDir.z * 48,
    );
    this.keyLight.target.position.set(
      this.save.payload.position.x,
      0,
      this.save.payload.position.z,
    );

    // Campfire flicker & flame animation
    this.campfireLight.intensity = 2.0 + Math.sin(this.elapsedTime * 11) * 0.45;
    for (let f = 0; f < this.campfireFlames.length; f++) {
      const fl = this.campfireFlames[f];
      fl.scale.y = 0.8 + Math.sin(this.elapsedTime * 14 + f * 2.1) * 0.25;
      fl.rotation.z = Math.sin(this.elapsedTime * 9 + f) * 0.16;
    }

    // Player flashlight at night
    this.flashlight.intensity = isDay ? 0 : 2.6;
    const px = this.save.payload.position.x;
    const pz = this.save.payload.position.z;
    this.flashlight.position.set(px, 1.6, pz);
    this.flashlight.target.position.set(
      px - Math.sin(this.cameraYaw) * 10,
      0.5,
      pz - Math.cos(this.cameraYaw) * 10,
    );

    // Weather rain particles
    const raining = this.save.weather === 'rain' || this.save.weather === 'storm';
    this.rainPoints.visible = raining;
    if (raining) {
      this.rainPoints.position.set(px, 0, pz);
      const arr = this.rainPositions;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= dt * 26;
        if (arr[i + 1] < 0) arr[i + 1] = 24;
      }
      this.rainPoints.geometry.attributes.position.needsUpdate = true;
    }
  }

  private updatePlayerMovement(dt: number) {
    let moveX = this.touchMoveX;
    let moveZ = this.touchMoveZ;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveZ -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveZ += 1;

    const len = Math.hypot(moveX, moveZ);
    if (len > 0.01) {
      moveX /= Math.max(1, len);
      moveZ /= Math.max(1, len);

      const sinY = Math.sin(this.cameraYaw);
      const cosY = Math.cos(this.cameraYaw);
      const worldDx = moveX * cosY + moveZ * sinY;
      const worldDz = -moveX * sinY + moveZ * cosY;

      const char = getCharacterById(this.save.characterId);
      const sprinting =
        (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchSprinting) &&
        this.save.payload.stats.stamina > 5 &&
        !this.isCrouching;

      let speed = 7.2 * (char.bonuses.moveSpeedMult ?? 1.0);
      if (this.save.payload.inVehicle) {
        if (this.save.payload.vehicleFuel > 0) {
          speed = 16.5;
          this.save.payload.vehicleFuel = Math.max(0, this.save.payload.vehicleFuel - dt * 1.4);
          this.noiseLevel = Math.max(this.noiseLevel, 30);
        } else {
          speed = 4.5;
        }
      } else if (sprinting) {
        speed *= 1.48;
        this.noiseLevel = Math.max(this.noiseLevel, 14);
      } else if (this.isCrouching) {
        speed *= 0.58;
      } else {
        this.noiseLevel = Math.max(this.noiseLevel, 7);
      }

      const nextX = Math.max(-92, Math.min(92, this.save.payload.position.x + worldDx * speed * dt));
      const nextZ = Math.max(-92, Math.min(88, this.save.payload.position.z + worldDz * speed * dt));

      // Obstacle sliding collision
      if (!this.collidesWithObstacle(nextX, this.save.payload.position.z, 0.55)) {
        this.save.payload.position.x = nextX;
      }
      if (!this.collidesWithObstacle(this.save.payload.position.x, nextZ, 0.55)) {
        this.save.payload.position.z = nextZ;
      }

      const targetRot = Math.atan2(worldDx, worldDz);
      this.playerGroup.rotation.y = targetRot;
      this.walkCycle += dt * speed * 1.8;

      if (this.save.payload.inVehicle) {
        const activeVeh = this.vehicles[0];
        if (activeVeh) {
          activeVeh.x = this.save.payload.position.x;
          activeVeh.z = this.save.payload.position.z;
          activeVeh.rotY = targetRot;
          activeVeh.mesh.position.set(activeVeh.x, this.groundHeightAt(activeVeh.x, activeVeh.z), activeVeh.z);
          activeVeh.mesh.rotation.y = targetRot;
        }
      }
    } else {
      this.walkCycle *= 0.85;
    }

    const groundY = this.groundHeightAt(this.save.payload.position.x, this.save.payload.position.z);
    this.playerGroup.position.set(this.save.payload.position.x, groundY, this.save.payload.position.z);
    this.playerGroup.scale.y = this.isCrouching ? 0.72 : 1;
    this.playerLeftLeg.rotation.x = 0.08 + Math.sin(this.walkCycle) * 0.52;
    this.playerRightLeg.rotation.x = -0.09 - Math.sin(this.walkCycle) * 0.52;
  }

  private collidesWithObstacle(x: number, z: number, radius: number): boolean {
    for (const o of this.obstacles) {
      if (x + radius > o.minX && x - radius < o.maxX && z + radius > o.minZ && z - radius < o.maxZ) {
        return true;
      }
    }
    return false;
  }

  private updateProjectiles(dt: number) {
    const px = this.save.payload.position.x;
    const pz = this.save.payload.position.z;

    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);

      if (p.life <= 0 || this.collidesWithObstacle(p.x, p.z, 0.2)) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      if (p.fromPlayer) {
        for (const z of this.zombies) {
          if (z.state === 'ko') continue;
          const hitRadius = 0.85 * z.def.scale[0];
          if (Math.hypot(p.x - z.x, p.z - z.z) <= hitRadius) {
            this.damageZombie(z, p.damage, true);
            soundEngine.playHitImpact(false);
            p.active = false;
            p.mesh.visible = false;
            break;
          }
        }
      } else {
        if (Math.hypot(p.x - px, p.z - pz) <= 0.8) {
          this.damagePlayer(p.damage, 4);
          this.spawnParticleBurst(px, 1.1, pz, '#84cc16', 8, 4);
          p.active = false;
          p.mesh.visible = false;
        }
      }
    }
  }

  private updateZombies(dt: number) {
    const px = this.save.payload.position.x;
    const pz = this.save.payload.position.z;
    const char = getCharacterById(this.save.characterId);
    const stealthMult = (this.isCrouching ? 0.6 : 1.0) / (char.bonuses.stealthMult ?? 1.0);
    let activeAttackers = 0;

    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];

      if (z.hitFlash > 0) {
        z.hitFlash -= dt;
        if (z.hitFlash <= 0) {
          for (const mat of z.hitMaterials) {
            mat.emissive.set(z.def.isBoss ? z.def.accentColor : '#000000');
            mat.emissiveIntensity = z.def.isBoss ? 0.25 : 0;
          }
        }
      }

      if (z.state === 'ko') {
        z.koTimer -= dt;
        z.mesh.rotation.x = Math.min(Math.PI / 2, z.mesh.rotation.x + dt * 5);
        z.mesh.position.y = Math.max(-0.5, z.mesh.position.y - dt * 1.4);
        if (z.koTimer <= 0) {
          this.scene.remove(z.mesh);
          this.zombies.splice(i, 1);
        }
        continue;
      }

      // Check base spike traps
      for (const st of this.save.payload.structures) {
        if (st.structureId === 'spike_trap' && Math.hypot(z.x - st.x, z.z - st.z) < 1.7) {
          this.damageZombie(z, 18 * dt, false);
        }
      }

      const dx = px - z.x;
      const dz = pz - z.z;
      const dist = Math.max(0.01, Math.hypot(dx, dz));
      const effectiveDetect = (z.def.detectRange + this.noiseLevel * 0.45) * stealthMult;

      if (z.state === 'windup') {
        z.stateTimer -= dt;
        z.telegraphRing.visible = true;
        z.telegraphRing.scale.setScalar(1 + Math.sin(this.elapsedTime * 18) * 0.15);
        if (z.stateTimer <= 0) {
          z.telegraphRing.visible = false;
          if (z.def.policy === 'spitter') {
            this.spawnProjectile(false, z.x, 1.3, z.z, (dx / dist) * 14, 0, (dz / dist) * 14, z.damage);
          } else if (z.def.policy === 'screamer') {
            soundEngine.playScreamerShriek();
            this.noiseLevel = Math.max(this.noiseLevel, 38);
            this.activeEventBanner = 'Screamer Shriek! Nearby infected alerted!';
            this.eventTimer = 4;
          } else if (dist <= z.def.attackRange + 0.9) {
            this.damagePlayer(z.damage, z.def.isBoss ? 6 : 2);
          }
          z.state = 'cooldown';
          z.stateTimer = z.def.isBoss ? 1.1 : 0.9;
        }
        continue;
      }

      if (z.state === 'cooldown') {
        z.stateTimer -= dt;
        if (z.stateTimer <= 0) z.state = 'alert';
        continue;
      }

      if (dist <= effectiveDetect || z.hp < z.maxHp) {
        z.state = 'alert';
        const nx = dx / dist;
        const nz = dz / dist;
        z.rotY = Math.atan2(nx, nz);

        // Policy-specific movement
        let moveFactor = 1.0;
        let lateral = 0;

        if (z.def.policy === 'spitter') {
          if (dist < 7.5) moveFactor = -0.65; // Kiter backs away
          else if (dist < 12.5) moveFactor = 0.1;
        } else if (z.def.policy === 'stalker') {
          if (dist < 6 && dist > 2.2) lateral = z.orbitDir * 0.75; // Flank orbit
          if (z.hp < z.maxHp * 0.3) moveFactor = -0.8; // Retreats when badly injured
        } else if (z.def.policy === 'runner') {
          moveFactor = 1.15;
        }

        const stepX = (nx * moveFactor - nz * lateral) * z.speed * dt;
        const stepZ = (nz * moveFactor + nx * lateral) * z.speed * dt;
        const candX = z.x + stepX;
        const candZ = z.z + stepZ;

        if (!this.collidesWithObstacle(candX, z.z, 0.45)) z.x = candX;
        if (!this.collidesWithObstacle(z.x, candZ, 0.45)) z.z = candZ;

        // Attack initiation with crowd token pool
        if (dist <= z.def.attackRange && activeAttackers < 3) {
          activeAttackers++;
          z.state = 'windup';
          z.stateTimer = z.def.isBoss || z.def.policy === 'brute' ? 0.55 : 0.35;
        }
      } else {
        // Gentle idle wander
        z.x += Math.sin(this.elapsedTime * 0.6 + i) * 0.35 * dt;
        z.z += Math.cos(this.elapsedTime * 0.5 + i) * 0.35 * dt;
      }

      z.mesh.position.set(z.x, this.groundHeightAt(z.x, z.z), z.z);
      z.mesh.rotation.y = z.rotY;
    }
  }

  private updateParticles(dt: number) {
    let dirty = false;
    for (let i = 0; i < this.particleCount; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.life -= dt;
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      if (p.life <= 0) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.001);
      } else {
        _dummy.position.set(p.x, p.y, p.z);
        _dummy.scale.setScalar(p.scale * (p.life / p.maxLife));
      }
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    if (dirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private updateFollowCamera(dt: number) {
    const px = this.save.payload.position.x;
    const pz = this.save.payload.position.z;
    const py = this.groundHeightAt(px, pz);
    const inVeh = this.save.payload.inVehicle;
    const dist = (inVeh ? 9.5 : 4.2) * this.cameraZoom;
    const height = py + (inVeh ? 3.8 : 1.78 + this.cameraPitch * 1.45);

    // Over-the-shoulder right offset so survivor frames cleanly in left-center third
    const shoulder = inVeh ? 0 : 0.58;
    const rightX = Math.cos(this.cameraYaw) * shoulder;
    const rightZ = -Math.sin(this.cameraYaw) * shoulder;

    const targetX = px + Math.sin(this.cameraYaw) * dist + rightX;
    const targetZ = pz + Math.cos(this.cameraYaw) * dist + rightZ;

    const alpha = 1 - Math.exp(-10 * dt);
    this.camera.position.x += (targetX - this.camera.position.x) * alpha;
    this.camera.position.y += (height - this.camera.position.y) * alpha;
    this.camera.position.z += (targetZ - this.camera.position.z) * alpha;

    const shake = this.cameraTrauma * this.cameraTrauma * 0.42;
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;

    // Look ahead past the character shoulder down the horizon
    const lookX = px - Math.sin(this.cameraYaw) * 6 + rightX * 0.65 + sx;
    const lookZ = pz - Math.cos(this.cameraYaw) * 6 + rightZ * 0.65;
    this.camera.lookAt(lookX, py + 1.55 + sy, lookZ);
  }

  private emitHud() {
    const px = this.save.payload.position.x;
    const pz = this.save.payload.position.z;
    const zone = getZoneAtPosition(px, pz);

    let nearbyPrompt: string | null = null;
    let nearbyTargetType: HudSnapshot['nearbyTargetType'] = null;

    if (this.save.payload.inVehicle) {
      nearbyPrompt = 'Exit Vehicle [E]';
      nearbyTargetType = 'vehicle';
    } else {
      for (const npc of this.npcs) {
        if (!npc.recruited && Math.hypot(npc.x - px, npc.z - pz) < 3.6) {
          nearbyPrompt = `Recruit ${npc.name} [E]`;
          nearbyTargetType = 'npc';
          break;
        }
      }
      if (!nearbyPrompt) {
        for (const node of this.lootNodes) {
          if (!node.looted && Math.hypot(node.x - px, node.z - pz) < 3.2) {
            nearbyPrompt = 'Scavenge Supply Crate [E]';
            nearbyTargetType = 'loot';
            break;
          }
        }
      }
      if (!nearbyPrompt) {
        for (const v of this.vehicles) {
          if (Math.hypot(v.x - px, v.z - pz) < 4.5) {
            nearbyPrompt = 'Drive Vehicle [E]';
            nearbyTargetType = 'vehicle';
            break;
          }
        }
      }
      if (!nearbyPrompt && Math.hypot(px + 7, pz + 0.5) < 4.0) {
        nearbyPrompt = 'Rest by Campfire (+6h) [E]';
        nearbyTargetType = 'campfire';
      }
    }

    let activeBoss: HudSnapshot['activeBoss'] = null;
    for (const z of this.zombies) {
      if (z.def.isBoss && z.state !== 'ko' && Math.hypot(z.x - px, z.z - pz) < 28) {
        activeBoss = { name: z.def.name, hp: Math.max(0, Math.round(z.hp)), maxHp: z.maxHp };
        break;
      }
    }

    const wId = this.save.payload.equippedWeaponId;
    const wDef = ITEMS_CATALOG[wId] ?? ITEMS_CATALOG.kitchen_knife;
    const magAmmo = this.save.payload.ammoInMag[wId] ?? 0;
    const reserveAmmo = wDef.ammoType ? getItemCount(this.save.payload.inventory, wDef.ammoType) : 0;

    let weight = 0;
    for (const item of this.save.payload.inventory) {
      const def = ITEMS_CATALOG[item.itemId];
      if (def) weight += def.weight * item.qty;
    }
    const maxWeight = ITEMS_CATALOG[this.save.payload.equippedBackpackId]?.backpackBonusKg ?? 25;

    this.callbacks.onHudUpdate({
      stats: this.save.payload.stats,
      day: this.save.day,
      timeOfDay: this.save.timeOfDay,
      weather: this.save.weather,
      zoneName: zone.name,
      zoneId: zone.id,
      equippedWeaponId: wId,
      equippedWeaponName: wDef.name,
      magAmmo,
      reserveAmmo,
      weightKg: Math.round(weight * 10) / 10,
      maxWeightKg: maxWeight,
      zombieKills: this.save.payload.zombieKills,
      score: this.save.payload.score,
      nearbyPrompt,
      nearbyTargetType,
      activeBoss,
      inVehicle: this.save.payload.inVehicle,
      vehicleFuel: Math.round(this.save.payload.vehicleFuel),
      noiseLevel: Math.round(this.noiseLevel),
      isCrouching: this.isCrouching,
      playerX: px,
      playerZ: pz,
      activeEventBanner: this.activeEventBanner,
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('blur', this.onBlurBound);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
