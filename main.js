import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 400, 700);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 50, 150);
scene.add(camera);

const controls = new PointerLockControls(camera, document.body);

const overlay = document.getElementById('overlay');
const scopeOverlay = document.getElementById('scope-overlay');
const crosshairEl = document.getElementById('crosshair');
overlay.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => overlay.classList.add('hidden'));
controls.addEventListener('unlock', () => overlay.classList.remove('hidden'));

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(100, 200, 100);
scene.add(dirLight);

const rimLight = new THREE.DirectionalLight(0x8888ff, 0.4);
rimLight.position.set(-100, -50, -100);
scene.add(rimLight);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1200, 1200),
  new THREE.MeshStandardMaterial({ color: 0x2a2a3a })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Targets
const targets = [];
const targetGeo = new THREE.BoxGeometry(25, 25, 25);

for (let i = 0; i < 8; i++) {
  const mesh = new THREE.Mesh(
    targetGeo,
    new THREE.MeshStandardMaterial({ color: 0xff4444 })
  );
  mesh.position.set(
    (Math.random() - 0.5) * 400,
    12.5,
    -100 - Math.random() * 350
  );
  scene.add(mesh);
  targets.push(mesh);
}

// Muzzle flash (camera child)
const muzzleLight = new THREE.PointLight(0xffaa00, 0, 60);
muzzleLight.position.set(0, 0, -0.5);
camera.add(muzzleLight);

// Movement
const clock = new THREE.Clock();
const keys = { w: false, a: false, s: false, d: false };
let verticalVelocity = 0;
const GROUND_Y = 50;
const MOVE_SPEED = 80;
const JUMP_SPEED = 120;
const GRAVITY = 250;

// ADS
let isAiming = false;
const HIP = { x: 0.2,  y: -0.18, z: -0.45, fov: 45,   scale: 0.002  };
const ADS = { x: 0,      y: -0.11, z: -0.394, fov: 15, scale: 0.002  };

// Game state
let score = 0;
let ammo = 10;
let gunWrapper = null;
let scopeGroup = null;

function updateHUD() {
  document.getElementById('score').textContent = `SCORE: ${score}`;
  document.getElementById('ammo').textContent = `AMMO: ${ammo}`;
}

function spawnHitEffect(point) {
  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(4, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  );
  spark.position.copy(point);
  scene.add(spark);
  setTimeout(() => scene.remove(spark), 200);
}

function gunRecoil() {
  if (!gunWrapper) return;
  muzzleLight.intensity = 3;
  gunWrapper.position.z += 0.04;
  setTimeout(() => {
    muzzleLight.intensity = 0;
    if (gunWrapper) gunWrapper.position.z -= 0.04;
  }, 80);
}

const raycaster = new THREE.Raycaster();

function shoot() {
  if (!controls.isLocked || ammo <= 0) return;
  ammo--;
  updateHUD();

  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hits = raycaster.intersectObjects(targets);

  if (hits.length > 0) {
    const hit = hits[0].object;
    scene.remove(hit);
    targets.splice(targets.indexOf(hit), 1);
    score++;
    updateHUD();
    spawnHitEffect(hits[0].point);
  }

  gunRecoil();
}

// Input events
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    shoot();
  } else if (e.button === 2 && controls.isLocked) {
    isAiming = true;
    if (scopeGroup) scopeGroup.visible = false;
    scopeOverlay.style.display = 'block';
    crosshairEl.style.display = 'none';
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 2) {
    isAiming = false;
    scopeOverlay.style.display = 'none';
    crosshairEl.style.display = 'block';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'w' || e.key === 'W') keys.w = true;
  if (e.key === 'a' || e.key === 'A') keys.a = true;
  if (e.key === 's' || e.key === 'S') keys.s = true;
  if (e.key === 'd' || e.key === 'D') keys.d = true;
  if (e.key === ' ' && controls.isLocked && camera.position.y <= GROUND_Y + 1)
    verticalVelocity = JUMP_SPEED;
  if ((e.key === 'r' || e.key === 'R') && controls.isLocked) { ammo = 10; updateHUD(); }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'w' || e.key === 'W') keys.w = false;
  if (e.key === 'a' || e.key === 'A') keys.a = false;
  if (e.key === 's' || e.key === 'S') keys.s = false;
  if (e.key === 'd' || e.key === 'D') keys.d = false;
});

// Load gun model
const mtlLoader = new MTLLoader();
mtlLoader.load('models/obj.mtl', (materials) => {
  materials.preload();
  const objLoader = new OBJLoader();
  objLoader.setMaterials(materials);
  objLoader.load('models/tinker.obj', (object) => {
    const box = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.sub(center);

    gunWrapper = new THREE.Group();
    gunWrapper.add(object);

    // 조준경 튜브
    const scopeMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 150, 16), scopeMat);
    scopeTube.rotation.z = Math.PI / 2;
    scopeTube.position.set(47, 55, 0);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 });
    const capGeo = new THREE.CylinderGeometry(5.5, 5.5, 3, 16);
    const capFront = new THREE.Mesh(capGeo, capMat);
    capFront.rotation.z = Math.PI / 2;
    capFront.position.set(-28, 55, 0);
    const capRear = new THREE.Mesh(capGeo, capMat);
    capRear.rotation.z = Math.PI / 2;
    capRear.position.set(122, 55, 0);
    scopeGroup = new THREE.Group();
    scopeGroup.add(scopeTube, capFront, capRear);
    scopeGroup.visible = false;
    gunWrapper.add(scopeGroup);

    gunWrapper.scale.setScalar(HIP.scale);
    gunWrapper.rotation.y = -Math.PI / 2;
    gunWrapper.position.set(HIP.x, HIP.y, HIP.z);
    camera.add(gunWrapper);
  });
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (controls.isLocked) {
    // WASD movement
    const spd = MOVE_SPEED * delta;
    if (keys.w) controls.moveForward(spd);
    if (keys.s) controls.moveForward(-spd);
    if (keys.d) controls.moveRight(spd);
    if (keys.a) controls.moveRight(-spd);

    // Gravity & jump
    verticalVelocity -= GRAVITY * delta;
    camera.position.y += verticalVelocity * delta;
    if (camera.position.y <= GROUND_Y) {
      camera.position.y = GROUND_Y;
      verticalVelocity = 0;
    }
  }

  // ADS lerp
  const t = Math.min(10 * delta, 1);
  const aim = isAiming ? ADS : HIP;

  if (gunWrapper) {
    gunWrapper.position.x = THREE.MathUtils.lerp(gunWrapper.position.x, aim.x, t);
    gunWrapper.position.y = THREE.MathUtils.lerp(gunWrapper.position.y, aim.y, t);
    gunWrapper.position.z = THREE.MathUtils.lerp(gunWrapper.position.z, aim.z, t);
    gunWrapper.scale.setScalar(THREE.MathUtils.lerp(gunWrapper.scale.x, aim.scale, t));
  }

  if (Math.abs(camera.fov - aim.fov) > 0.1) {
    camera.fov = THREE.MathUtils.lerp(camera.fov, aim.fov, t);
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera);
}
animate();
