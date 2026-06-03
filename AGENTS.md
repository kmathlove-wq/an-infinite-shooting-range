# Pixel Sniper — AGENTS.md

## 프로젝트 개요

Three.js 기반 1인칭 FPS 스나이퍼 게임. 별도 빌드 툴 없이 순수 ES 모듈 + CDN으로 동작한다.
Tinkercad에서 제작한 총 모델(`models/tinker.obj`)을 플레이어 무기로 사용한다.
조준경 메시는 Three.js에서 `gunWrapper` 자식으로 직접 생성하지만, 실제 ADS 화면은 DOM 기반 `#scope-overlay`로 표시한다.

## 파일 구조

```
Pixel-Sniper/
├── AGENTS.md         # Codex 작업 지침
├── CLAUDE.md         # 기존 Claude 작업 지침
├── favicon.ico       # 초록색 Tinkercad 총 레퍼런스 기반 브라우저 탭 favicon
├── favicon.svg       # 같은 favicon의 SVG 버전
├── index.html        # importmap + HUD/overlay/modal DOM
├── main.js           # 게임 로직 전체 (Three.js ES module)
├── style.css         # 전체화면 캔버스 + HUD/모달 스타일
├── CNAME             # GitHub Pages custom domain
└── models/
    ├── tinker.obj    # Tinkercad 제작 총 모델 (X: -179~135, Y: 15~117, Z: 1~36)
    └── obj.mtl       # 색상 재질 정의
```

## 실행 방법

로컬 서버 필수 (ES module/OBJ 로딩):
```bash
npx serve .
# 일반적으로 http://localhost:3000
```

## 기술 스택

- **Three.js r0.170.0** — `index.html` importmap (`three`, `three/addons/`)
- **Firebase Realtime Database 10.14.0** — CDN import, 글로벌 리더보드 저장/조회
- **빌드 툴 없음** — `type="module"` + CDN import로 브라우저에서 직접 실행
- **package.json 없음** — 의존성 설치 없이 CDN과 정적 파일로 구동

## main.js 구조

### 핵심 변수

| 변수 | 설명 |
|---|---|
| `camera` | PerspectiveCamera, `scene.add(camera)` 필수 (총/총구 라이트가 camera child이기 때문) |
| `controls` | PointerLockControls, `controls.isLocked`로 게임 입력 활성 여부 판별 |
| `gunWrapper` | OBJ 로드 후 생성되는 Group, camera의 자식. 비동기 로드라 초기값 null |
| `scopeGroup` | Three.js 조준경 메시 Group. 현재 기본적으로 숨김 처리됨 |
| `targets[]` | 씬에 배치된 BoxMesh 표적 배열. 적중 시 scene.remove + splice로 제거 |
| `collidables[]` | 벽/구조물 AABB 충돌 박스 목록 |
| `HIP / ADS` | 총 위치/FOV 상수. animate 루프에서 lerp로 전환 |
| `timerStart / gameActive / gameComplete` | 기록 측정과 완료 상태 제어 |

### 게임 루프 (animate)

```
animate()
├── delta = clock.getDelta()
├── WASD 이동 (controls.moveForward / moveRight)
├── 중력 & 점프 (verticalVelocity, GRAVITY)
├── AABB 충돌 처리 (collidables)
├── ADS lerp (gunWrapper position/scale + camera.fov)
└── renderer.render(scene, camera)
```

### 씬 구성

- 하늘색 배경 + 안개(`scene.fog`)
- ambient/directional/hemisphere light
- 950x950 플랫폼과 외벽
- 내부 엄폐물/구조물
- 경기장 아래 흰 구름 plane
- 빨간 박스 표적 8개
- 카메라 자식 총구 플래시용 `PointLight`

### 발사 시스템

`shoot()` → `raycaster.setFromCamera({ x: 0, y: 0 }, camera)` → `intersectObjects(targets)` → 적중 시 제거 + 점수 증가 + `spawnHitEffect`

- 탄약은 기본 10발, `R` 키로 10발 복구
- 모든 표적 제거 시 `stopTimer()` 호출
- `gunRecoil()`은 `gunWrapper.position.z`에 짧은 반동 오프셋을 준다

### 기록 시스템

- `startTimer()`는 첫 포인터 락 시 시작된다.
- 완료 시 `saveRecord(finalTime)`으로 localStorage와 Firebase Realtime Database에 저장한다.
- `records-btn` 클릭 시 Firebase `leaderboard`와 localStorage 기록을 병합/중복 제거한 뒤 상위 10개를 표시한다.
- Firebase 조회 실패 시에도 localStorage 기록만으로 순위를 표시한다.
- 기존 localStorage의 6초대 테스트 기록은 `pixelSniperRemovedSixSecondRecord` 플래그로 1회만 정리한다.

### 총 모델과 ADS

총구 방향: `gunWrapper.rotation.y = -Math.PI / 2`
- Tinkercad OBJ: 배럴이 -X 방향(X=-179이 총구), 개머리판이 +X(X=135)
- 회전 후 z_cam = x_gw × scale → 배럴(-X)이 -Z(화면 안쪽)으로 정렬

조준경 메시 위치 (gunWrapper 로컬 좌표, 모델 센터 기준):
- scopeTube: (47, 55, 0), 길이 150
- capFront: (-28, 55, 0), 배럴쪽 (목적 렌즈, 화면 안쪽)
- capRear: (122, 55, 0), 개머리판쪽 (접안 렌즈, 뷰어 쪽)

ADS 리얼 얼굴-조준경 공식:
- capRear y_cam = gunWrapper.y + 55×0.002 = 0 → gunWrapper.y = -0.11
- capRear z_cam = gunWrapper.z + 122×0.002 = -0.15 → gunWrapper.z = -0.394

현재 우클릭 ADS 시 Three.js `scopeGroup`은 숨기고 DOM `#scope-overlay`를 표시한다.

## 조작키

| 입력 | 기능 |
|---|---|
| 오버레이 클릭 | 게임 시작 / 포인터 락 |
| 좌클릭 | 발사 |
| 우클릭 홀드 | 조준(ADS) + FOV 45→15 줌 + 스코프 오버레이 표시 |
| WASD | 이동 |
| Space | 점프 |
| R | 재장전 (ammo 10 복구) |
| ESC | 포인터 락 해제 / 일시정지 |
| 기록보기 버튼 | 기록 모달 열기 |

## HUD DOM 구조

```
#overlay              → 게임 시작 전 전체화면 오버레이 (.hidden 클래스로 토글)
#crosshair            → 화면 중앙 조준점 (+)
#scope-overlay        → 우클릭 ADS 중 표시되는 SVG 스코프 UI
#hud
  ├── #score          → "SCORE: N"
  ├── #timer          → "MM:SS.CS"
  └── #ammo           → "AMMO: N" (노란색)
#completion-message   → 모든 표적 제거 후 완료 시간 + 다시 시작 버튼
#records-btn          → 기록보기 버튼
#records-modal        → 상위 기록 목록과 내 최근 기록
#map-credit           → 맵 출처 표시
```

`updateHUD()` 함수는 score/ammo만 동기화하고, timer는 `startTimer()`의 interval에서 갱신한다.

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

코드 변경 후 사용자가 요청하면 커밋 + 푸시한다.
push 명령: `git push origin main` (remote URL에 인증 포함됨)

## 주의사항

- `scene.add(camera)` — camera가 씬에 추가되어 있어야 camera child인 총 모델/총구 라이트가 렌더됨
- OBJ 로드는 비동기 → `gunWrapper`는 로드 완료 전 `null`. null 체크 필수
- `controls.moveForward/Right`는 PointerLockControls 내장 메서드로 카메라 방향 기준 이동
- ADS 중 `gunRecoil()`의 `position.z` 오프셋은 ADS/HIP lerp target에 더해진다
- `scopeGroup.visible`은 현재 false로 유지되고, 실제 조준 화면은 `#scope-overlay`가 담당한다
- Three.js importmap은 `index.html`에 정의됨 — `main.js`에서 `import 'three'`로 사용 가능
- Firebase 네트워크 실패 시 기록 조회는 localStorage로 fallback되지만, Firebase CDN 자체 로딩 실패는 앱 초기화에 영향을 줄 수 있다

## 작업 규칙

### 절약 규칙
- 이미 읽은 파일은 다시 확인하지 않는다
- 불필요한 도구 호출은 하지 않는다
- 가능한 도구 호출은 동시에 실행한다
- 긴 출력은 필요한 범위만 잘라 확인한다
- 사용자가 이미 설명한 내용을 다시 반복하지 않는다

### 기타 규칙
- 새로 알게된 프로젝트 지식은 필요할 때 AGENTS.md 또는 CLAUDE.md에 반영한다
- AGENTS.md와 CLAUDE.md는 각각 200줄을 넘기지 않는다
- 사용자 요청 없이 기존 변경사항을 되돌리지 않는다
