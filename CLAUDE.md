# Pixel Sniper — CLAUDE.md

## 프로젝트 개요

Three.js 기반 1인칭 FPS 스나이퍼 게임. 별도 빌드 툴 없이 순수 ES 모듈 + CDN으로 동작한다.
Tinkercad에서 제작한 총 모델(`models/tinker.obj`)을 플레이어 무기로 사용한다.
조준경 메시는 Three.js에서 gunWrapper 자식으로 직접 생성한다 (OBJ에 포함 아님).

## 파일 구조

```
Pixel-Sniper/
├── index.html        # importmap + HUD DOM (overlay, crosshair, hud)
├── main.js           # 게임 로직 전체 (Three.js ES module)
├── style.css         # 전체화면 캔버스 + HUD 스타일
└── models/
    ├── tinker.obj    # Tinkercad 제작 총 모델 (X: -179~135, Y: 15~117, Z: 1~36)
    └── obj.mtl       # 색상 재질 정의
```

## 실행 방법

로컬 서버 필수 (OBJ 로딩 CORS):
```bash
npx serve .
# → http://localhost:3000
```

## 기술 스택

- **Three.js r0.170.0** — CDN importmap (`three`, `three/addons/`)
- **빌드 툴 없음** — `type="module"` + importmap으로 브라우저에서 직접 실행
- **외부 의존성 없음** — package.json 없음

## main.js 구조

### 핵심 변수

| 변수 | 설명 |
|---|---|
| `camera` | PerspectiveCamera, `scene.add(camera)` 필수 (총이 camera child이기 때문) |
| `controls` | PointerLockControls — `controls.isLocked`로 게임 활성 여부 판별 |
| `gunWrapper` | OBJ 로드 후 생성되는 Group, camera의 자식. 비동기 로드라 초기값 null |
| `targets[]` | 씬에 배치된 BoxMesh 표적 배열. 적중 시 scene.remove + splice로 제거 |
| `HIP / ADS` | 총 위치/FOV 상수. animate 루프에서 lerp로 전환 |

### 게임 루프 (animate)

```
animate()
├── delta = clock.getDelta()
├── WASD 이동 (controls.moveForward / moveRight)
├── 중력 & 점프 (verticalVelocity, GRAVITY)
├── ADS lerp (gunWrapper position/scale + camera.fov)
└── renderer.render(scene, camera)
```

### 발사 시스템

`shoot()` → raycaster.setFromCamera({x:0, y:0}) → intersectObjects(targets) → 적중 시 제거 + spawnHitEffect

총구 방향: `gunWrapper.rotation.y = -Math.PI / 2`
- Tinkercad OBJ: 배럴이 -X 방향(X=-179이 총구), 개머리판이 +X(X=135)
- 회전 후 z_cam = x_gw × scale → 배럴(-X)이 -Z(화면 안쪽)으로 정렬

조준경 메시 위치 (gunWrapper 로컬 좌표, 모델 센터 기준):
- scopeTube: (47, 55, 0), 길이 150 — 수신기 상단(Y_gw=50)+반지름5
- capFront: (-28, 55, 0) — 배럴쪽 (목적 렌즈, 화면 안쪽)
- capRear: (122, 55, 0) — 개머리판쪽 (접안 렌즈, 뷰어 쪽)

ADS 리얼 얼굴-조준경 공식: capRear y_cam = gunWrapper.y + 55×0.002 = 0 → gunWrapper.y = -0.11
capRear z_cam = gunWrapper.z + 122×0.002 = -0.15 → gunWrapper.z = -0.394

## 조작키

| 키 | 기능 |
|---|---|
| 클릭 | 게임 시작 (포인터 락) |
| 좌클릭 | 발사 |
| 우클릭 | 조준(ADS) + FOV 45→15 줌 |
| WASD | 이동 |
| Space | 점프 |
| R | 재장전 (ammo 10 복구) |
| ESC | 일시정지 |

## HUD DOM 구조

```
#overlay       → 게임 시작 전 전체화면 오버레이 (.hidden 클래스로 토글)
#crosshair     → 화면 중앙 조준점 (+)
#hud
  ├── #score   → "SCORE: N"
  └── #ammo    → "AMMO: N" (노란색)
```

`updateHUD()` 함수로 score/ammo 동기화.

## 게임 상수

```js
GROUND_Y   = 50     // 카메라 지면 높이
MOVE_SPEED = 80     // 초당 이동 거리 (Three.js 단위)
JUMP_SPEED = 120    // 점프 초속
GRAVITY    = 250    // 중력 가속도
```

## GitHub

저장소: `https://github.com/kmathlove-wq/Pixel-Sniper`
브랜치: `main`

코드 변경 후 항상 커밋 + 푸시할 것 (사용자 요청).
push 명령: `git push origin main` (remote URL에 인증 포함됨)

## 주의사항

- `scene.add(camera)` — camera가 씬에 추가되어 있어야 camera child인 총 모델이 렌더됨
- OBJ 로드는 비동기 → `gunWrapper`는 로드 완료 전 `null`. null 체크 필수
- `controls.moveForward/Right`는 PointerLockControls 내장 메서드로 카메라 방향 기준 이동
- ADS 중 `gunRecoil()`의 `position.z` 오프셋은 ADS/HIP lerp target에 더해지므로 시각적 충돌 없음
- Three.js importmap은 `index.html`에 정의됨 — `main.js`에서 `import 'three'`로 사용 가능

## 작업 규칙

### 절약 규칙
- 이미 읽은 파일은 다시 확인하지 않는다
- 불필요한 도구 호출은 하지 않는다
- 가능한 도구 호출은 동시에 실행한다
- 20줄 이상의 불필요한 출력은 서브에이전트에 위임한다
- 사용자가 이미 설명한 내용을 다시 반복하지 않는다

### 기타 규칙
- 새로 알게된 내용은 반드시 자동으로 이 파일(CLAUDE.md)에 추가한다
- 이 파일은 반드시 200줄이 넘으면 안 된다
