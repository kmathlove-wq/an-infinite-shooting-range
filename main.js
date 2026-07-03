import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getDatabase, ref, push, get } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js';

const firebaseApp = initializeApp({
  apiKey: "AIzaSyCl-zVnHgUwinHbCp2QdjX8JGdY0_xM9YQ",
  authDomain: "pixel-sniper.firebaseapp.com",
  databaseURL: "https://pixel-sniper-default-rtdb.firebaseio.com",
  projectId: "pixel-sniper",
  storageBucket: "pixel-sniper.firebasestorage.app",
  messagingSenderId: "819821964767",
  appId: "1:819821964767:web:8ca15de491cdcbb2c5686a"
});
const db = getDatabase(firebaseApp);

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0xC8E6FA, 600, 1100);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 50, 150);
scene.add(camera);

const controls = new PointerLockControls(camera, document.body);

const overlay = document.getElementById('overlay');
const scopeOverlay = document.getElementById('scope-overlay');
const crosshairEl = document.getElementById('crosshair');
const weaponButtons = document.querySelectorAll('.weapon-option');
const infiniteModeBtn = document.getElementById('infinite-mode-btn');
const competitiveModeBtn = document.getElementById('competitive-mode-btn');
infiniteModeBtn.addEventListener('click', () => startGame('infinite'));
competitiveModeBtn.addEventListener('click', () => startGame('competitive'));
controls.addEventListener('lock', () => {
  overlay.classList.add('hidden');
  if (currentMode === 'competitive' && !gameActive && !gameComplete) startTimer();
});
controls.addEventListener('unlock', () => {
  if (gameComplete) {
    document.getElementById('completion-message').classList.remove('hidden');
  } else {
    overlay.classList.remove('hidden');
  }
});

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 1.0));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(100, 200, 100);
scene.add(dirLight);

const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0xDDDDDD, 0.5);
scene.add(hemiLight);

// Arena floor platform
const platformMat = new THREE.MeshStandardMaterial({ color: 0xE8E8E8, roughness: 0.85 });
const platform = new THREE.Mesh(new THREE.BoxGeometry(950, 80, 950), platformMat);
platform.position.set(0, -40, 0);
scene.add(platform);

// Collidable bounding boxes (walls + structures)
const collidables = [];

// Arena walls
const wallMat = new THREE.MeshStandardMaterial({ color: 0xD8D8D8, roughness: 0.8 });
[
  [0, 60, -475, 950, 120, 22],
  [0, 60,  475, 950, 120, 22],
  [475, 60, 0, 22, 120, 950],
  [-475, 60, 0, 22, 120, 950],
].forEach(([x, y, z, w, h, d]) => {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  wall.position.set(x, y, z);
  scene.add(wall);
  collidables.push({ minX: x-w/2, maxX: x+w/2, minY: y-h/2, maxY: y+h/2, minZ: z-d/2, maxZ: z+d/2 });
});

// Interior structures
const structMat = new THREE.MeshStandardMaterial({ color: 0xDDDDDD, roughness: 0.9 });
[
  [-130, -80,  80,  60,  70],
  [ 130, -80,  80,  60,  70],
  [   0,-190,  60,  60, 110],
  [-210,-210, 110,  50,  60],
  [ 210,-210, 110,  50,  60],
  [ -90,-320,  50,  90,  65],
  [  90,-320,  50,  90,  65],
  [   0,-370, 130,  40,  50],
].forEach(([x, z, w, d, h]) => {
  const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), structMat);
  s.position.set(x, h / 2, z);
  scene.add(s);
  collidables.push({ minX: x-w/2, maxX: x+w/2, minY: 0, maxY: h, minZ: z-d/2, maxZ: z+d/2 });
});

// Cloud planes below arena
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
for (let i = 0; i < 15; i++) {
  const cloud = new THREE.Mesh(
    new THREE.PlaneGeometry(200 + Math.random() * 350, 80 + Math.random() * 130),
    cloudMat
  );
  cloud.rotation.x = -Math.PI / 2;
  cloud.position.set(
    (Math.random() - 0.5) * 3000,
    -150 - Math.random() * 120,
    (Math.random() - 0.5) * 3000
  );
  scene.add(cloud);
}

// Targets
const targets = [];
const targetGeo = new THREE.BoxGeometry(25, 25, 25);

function isValidTargetPos(x, z) {
  const TR = 30;
  for (const t of targets) {
    if (Math.abs(t.position.x - x) < TR * 2 && Math.abs(t.position.z - z) < TR * 2) return false;
  }
  for (const box of collidables) {
    if (x + TR > box.minX && x - TR < box.maxX && z + TR > box.minZ && z - TR < box.maxZ) return false;
  }
  return true;
}

function spawnTargets() {
  for (let i = 0; i < 8; i++) {
    let x, z, attempts = 0;
    do {
      x = (Math.random() - 0.5) * 750;
      z = -50 - Math.random() * 350;
      attempts++;
    } while (!isValidTargetPos(x, z) && attempts < 50);
    const mesh = new THREE.Mesh(targetGeo, new THREE.MeshStandardMaterial({ color: 0xff4444 }));
    mesh.position.set(x, 12.5, z);
    scene.add(mesh);
    targets.push(mesh);
  }
}
spawnTargets();

// Muzzle flash (camera child)
const muzzleLight = new THREE.PointLight(0xffaa00, 0, 60);
muzzleLight.position.set(0, 0, -0.5);
camera.add(muzzleLight);

// Movement
const clock = new THREE.Clock();
const keys = { w: false, a: false, s: false, d: false, shift: false };
let verticalVelocity = 0;
const GROUND_Y = 50;
const MOVE_SPEED = 80;
const SPRINT_MULTIPLIER = 1.6;
const JUMP_SPEED = 120;
const GRAVITY = 250;
const SLIDE_DURATION = 0.45;
const SLIDE_SPEED = 180;
const SLIDE_CAMERA_DROP = 18;
let slideTimer = 0;
let slideDirection = null;

// ADS
let isAiming = false;
const HIP = { x: 0.2,  y: -0.18, z: -0.45, fov: 45,   scale: 0.002  };
const ADS = { x: 0,      y: -0.11, z: -0.394, fov: 15, scale: 0.002  };

// Game state
let score = 0;
let ammo = 10;
let timerStart = null;
let timerInterval = null;
let gameActive = false;
let gameComplete = false;
let currentMode = null;
let gunWrapper = null;
let scopeGroup = null;

const WEAPONS = {
  pixel: {
    name: '픽셀스나',
    materialPath: 'models/픽셀스나.mtl'
  },
  event: {
    name: '이벤트 호라이즌',
    materialPath: 'models/이벤트 호라이즌.mtl'
  }
};
let selectedWeaponKey = localStorage.getItem('pixelSniperWeapon') || 'pixel';
if (!WEAPONS[selectedWeaponKey]) selectedWeaponKey = 'pixel';
let gunLoadId = 0;

function updateHUD() {
  document.getElementById('score').textContent = `SCORE: ${score}`;
  document.getElementById('ammo').textContent = `AMMO: ${ammo}`;
}

function formatTime(ms) {
  const cs = Math.floor(ms / 10) % 100;
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / 60000);
  return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

function startTimer() {
  timerStart = Date.now();
  gameActive = true;
  timerInterval = setInterval(() => {
    document.getElementById('timer').textContent = formatTime(Date.now() - timerStart);
  }, 50);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  const finalTime = Date.now() - timerStart;
  gameActive = false;
  gameComplete = true;
  saveRecord(finalTime);
  document.getElementById('completion-time').textContent = `완료!  ${formatTime(finalTime)}`;
  controls.unlock();
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerStart = null;
  gameActive = false;
  document.getElementById('timer').textContent = '00:00.00';
}

function resetTargets() {
  targets.forEach(t => scene.remove(t));
  targets.length = 0;
  spawnTargets();
}

function startGame(mode) {
  const shouldReset = currentMode !== mode || gameComplete;
  currentMode = mode;
  gameComplete = false;
  document.getElementById('completion-message').classList.add('hidden');

  if (shouldReset) {
    resetTargets();
    score = 0;
    ammo = 10;
    verticalVelocity = 0;
    slideTimer = 0;
    slideDirection = null;
    camera.position.set(0, GROUND_Y, 150);
  }

  if (mode === 'competitive') {
    if (shouldReset) resetTimer();
  } else {
    clearInterval(timerInterval);
    timerInterval = null;
    timerStart = null;
    gameActive = true;
    document.getElementById('timer').textContent = '무한모드';
  }

  updateHUD();
  controls.lock();
}

function saveRecord(ms) {
  const record = { time: ms, date: new Date().toISOString() };
  const local = getLocalRecords();
  local.push(record);
  localStorage.setItem('pixelSniperRecords', JSON.stringify(local));
  push(ref(db, 'leaderboard'), record).catch(() => {});
}

function getLocalRecords() {
  try {
    const records = JSON.parse(localStorage.getItem('pixelSniperRecords') || '[]');
    return normalizeRecords(removeExistingSixSecondRecords(Array.isArray(records) ? records : []));
  } catch {
    return [];
  }
}

function removeExistingSixSecondRecords(records) {
  if (localStorage.getItem('pixelSniperRemovedSixSecondRecord') === '1') return records;

  const cleaned = records.filter((record) => {
    const time = Number(record?.time);
    return !Number.isFinite(time) || time < 6000 || time >= 7000;
  });
  localStorage.setItem('pixelSniperRecords', JSON.stringify(cleaned));
  localStorage.setItem('pixelSniperRemovedSixSecondRecord', '1');
  return cleaned;
}

function normalizeRecords(records) {
  const seen = new Set();
  return records
    .map((record) => ({
      time: Number(record?.time),
      date: record?.date || new Date().toISOString()
    }))
    .filter((record) => Number.isFinite(record.time) && record.time >= 0)
    .filter((record) => {
      const key = `${record.time}-${record.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.time - b.time || new Date(a.date) - new Date(b.date));
}

async function getFirebaseRecords() {
  const snapshot = await get(ref(db, 'leaderboard'));
  const records = [];
  snapshot.forEach(child => records.push(child.val()));
  return records;
}

async function openRecordsModal() {
  document.getElementById('records-modal').classList.remove('hidden');
  document.getElementById('records-list').innerHTML = '<li class="no-record">불러오는 중...</li>';
  document.getElementById('my-latest-record').style.display = 'none';

  let remote = [];
  try {
    remote = await getFirebaseRecords();
  } catch {
    remote = [];
  }

  const local = getLocalRecords();
  const allRecords = normalizeRecords([...remote, ...local]);
  const top10 = allRecords.slice(0, 10);
  const listEl = document.getElementById('records-list');
  listEl.innerHTML = Array.from({ length: 10 }, (_, i) => {
    const record = top10[i];
    if (!record) {
      return `<li class="empty-rank"><span class="rank-num">${i + 1}위</span><span class="rank-time">--:--.--</span><span class="rank-date">기록 없음</span></li>`;
    }
    const date = new Date(record.date).toLocaleDateString('ko-KR');
    return `<li><span class="rank-num">${i + 1}위</span><span class="rank-time">${formatTime(record.time)}</span><span class="rank-date">${date}</span></li>`;
  }).join('');

  const latestEl = document.getElementById('my-latest-record');
  const latestRecords = normalizeRecords([local[local.length - 1]]);
  if (latestRecords.length > 0) {
    const latest = latestRecords[0];
    const rank = allRecords.findIndex(r => r.time === latest.time && r.date === latest.date) + 1;
    latestEl.innerHTML = `<div class="my-latest">내 최근 기록 ${rank > 0 ? `${rank}위` : ''}<br><span class="rank-time">${formatTime(latest.time)}</span></div>`;
    latestEl.style.display = 'block';
  }
}

function closeRecordsModal() {
  document.getElementById('records-modal').classList.add('hidden');
}

function restartGame() {
  resetTargets();
  score = 0;
  ammo = 10;
  resetTimer();
  document.getElementById('completion-message').classList.add('hidden');
  updateHUD();
  controls.lock();
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

function setWeapon(key) {
  if (!WEAPONS[key] || key === selectedWeaponKey) return;
  selectedWeaponKey = key;
  localStorage.setItem('pixelSniperWeapon', key);
  updateWeaponButtons();
  loadGunModel();
}

function updateWeaponButtons() {
  weaponButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.weapon === selectedWeaponKey);
  });
}

function createScopeGroup() {
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
  const group = new THREE.Group();
  group.add(scopeTube, capFront, capRear);
  group.visible = false;
  return group;
}

function loadGunModel() {
  const loadId = ++gunLoadId;
  const weapon = WEAPONS[selectedWeaponKey];

  if (gunWrapper) {
    camera.remove(gunWrapper);
    gunWrapper = null;
    scopeGroup = null;
  }

  const mtlLoader = new MTLLoader();
  mtlLoader.load(weapon.materialPath, (materials) => {
    if (loadId !== gunLoadId) return;
    materials.preload();
    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    objLoader.load('models/tinker.obj', (object) => {
      if (loadId !== gunLoadId) return;
      const box = new THREE.Box3().setFromObject(object);
      const center = new THREE.Vector3();
      box.getCenter(center);
      object.position.sub(center);

      gunWrapper = new THREE.Group();
      gunWrapper.add(object);

      scopeGroup = createScopeGroup();
      gunWrapper.add(scopeGroup);

      gunWrapper.scale.setScalar(HIP.scale);
      gunWrapper.rotation.y = -Math.PI / 2;
      gunWrapper.position.set(HIP.x, HIP.y, HIP.z);
      camera.add(gunWrapper);
    });
  });
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
    if (targets.length === 0) {
      if (currentMode === 'infinite') {
        spawnTargets();
      } else {
        stopTimer();
      }
    }
  }

  gunRecoil();
}

function startSlide() {
  if (!controls.isLocked || slideTimer > 0 || camera.position.y > GROUND_Y + 1) return;
  if (!keys.w && !keys.a && !keys.s && !keys.d) return;

  slideTimer = SLIDE_DURATION;
  slideDirection = new THREE.Vector3();
  camera.getWorldDirection(slideDirection);
  slideDirection.y = 0;
  slideDirection.normalize();
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
  if (e.key === 'Shift') keys.shift = true;
  if (e.key === 'c' || e.key === 'C') startSlide();
  if (e.key === ' ' && controls.isLocked && camera.position.y <= GROUND_Y + 1)
    verticalVelocity = JUMP_SPEED;
  if ((e.key === 'r' || e.key === 'R') && controls.isLocked) { ammo = 10; updateHUD(); }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'w' || e.key === 'W') keys.w = false;
  if (e.key === 'a' || e.key === 'A') keys.a = false;
  if (e.key === 's' || e.key === 'S') keys.s = false;
  if (e.key === 'd' || e.key === 'D') keys.d = false;
  if (e.key === 'Shift') keys.shift = false;
});

weaponButtons.forEach((button) => {
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    setWeapon(button.dataset.weapon);
  });
});
updateWeaponButtons();
loadGunModel();

document.getElementById('records-btn').addEventListener('click', openRecordsModal);
document.getElementById('modal-close-btn').addEventListener('click', closeRecordsModal);
document.getElementById('records-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('records-modal')) closeRecordsModal();
});
document.getElementById('restart-btn').addEventListener('click', () => {
  gameComplete = false;
  if (currentMode === 'infinite') {
    startGame('infinite');
  } else {
    restartGame();
  }
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
    const isSprinting = keys.shift && keys.w && slideTimer <= 0;
    const spd = MOVE_SPEED * (isSprinting ? SPRINT_MULTIPLIER : 1) * delta;
    if (keys.w) controls.moveForward(spd);
    if (keys.s) controls.moveForward(-spd);
    if (keys.d) controls.moveRight(spd);
    if (keys.a) controls.moveRight(-spd);

    const wasSliding = slideTimer > 0;
    if (wasSliding && slideDirection) {
      const slideStep = SLIDE_SPEED * (slideTimer / SLIDE_DURATION) * delta;
      camera.position.addScaledVector(slideDirection, slideStep);
      slideTimer = Math.max(0, slideTimer - delta);
    }

    // Gravity & jump
    verticalVelocity -= GRAVITY * delta;
    camera.position.y += verticalVelocity * delta;
    const targetGroundY = wasSliding ? GROUND_Y - SLIDE_CAMERA_DROP : GROUND_Y;
    if (camera.position.y <= targetGroundY) {
      camera.position.y = targetGroundY;
      verticalVelocity = 0;
    } else if (slideTimer <= 0 && camera.position.y < GROUND_Y) {
      camera.position.y = Math.min(GROUND_Y, camera.position.y + SLIDE_CAMERA_DROP * 8 * delta);
    }

    // AABB collision with walls and structures
    const R = 18;
    for (const box of collidables) {
      if (camera.position.y - GROUND_Y > box.maxY) continue;
      const cx = camera.position.x, cz = camera.position.z;
      const overlapX = Math.min(cx + R, box.maxX) - Math.max(cx - R, box.minX);
      if (overlapX <= 0) continue;
      const overlapZ = Math.min(cz + R, box.maxZ) - Math.max(cz - R, box.minZ);
      if (overlapZ <= 0) continue;
      if (overlapX <= overlapZ) {
        camera.position.x += cx < (box.minX + box.maxX) / 2 ? -overlapX : overlapX;
      } else {
        camera.position.z += cz < (box.minZ + box.maxZ) / 2 ? -overlapZ : overlapZ;
      }
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
