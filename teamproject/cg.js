import * as THREE from 'https://cdn.skypack.dev/three@0.129.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js';


// === 기본 장면 설정 ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// === 배경 텍스처 ===
const textureLoader = new THREE.TextureLoader();
const dayTexture = textureLoader.load('textures/day.jpg');
const nightTexture = textureLoader.load('textures/night.jpg');
scene.background = dayTexture;

// === 바닥 잔디 텍스처 ===
const grassTexture = textureLoader.load('textures/grass.jpg');
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(50, 50); // 반복 횟수 (지형 넓이에 맞게 조정)

// === 바닥 생성 ===
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ map: grassTexture })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// === 조명 ===
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 20, 10);
light.castShadow = true;
light.intensity = 1;
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 밝은 회색, 중간 밝기
scene.add(ambientLight);
scene.add(light);
light.shadow.mapSize.width = 1024;
light.shadow.mapSize.height = 1024;
light.shadow.radius = 4;

light.shadow.camera.left = -50;
light.shadow.camera.right = 50;
light.shadow.camera.top = 50;
light.shadow.camera.bottom = -50;
light.shadow.camera.near = 1;
light.shadow.camera.far = 100;

// === 인벤토리 UI 생성 ===
const inventoryBox = document.createElement('div');
inventoryBox.style.position = 'absolute';
inventoryBox.style.top = '10px';
inventoryBox.style.left = '10px';
inventoryBox.style.width = '250px';
inventoryBox.style.height = '80px';
inventoryBox.style.border = '3px solid white';
inventoryBox.style.padding = '10px';
inventoryBox.style.display = 'flex';
inventoryBox.style.gap = '5px';
inventoryBox.style.backgroundColor = 'rgba(0,0,0,0.5)';
document.body.appendChild(inventoryBox);

const animalItems = {
  0: { name: '🧵 실을 얻었습니다! 🧵', emoji: '🧵' }, // 양
  1: { name: '🥚 달걀을 얻었습니다! 🥚', emoji: '🥚' }, // 닭
  2: { name: '🥩 고기를 얻었습니다! 🥩', emoji: '🥩' }  // 소
};

// === 카메라 위치 및 컨트롤 ===
camera.position.set(0, 10, 20);

// === 모델 로더 선언 ===
const loader = new GLTFLoader();

// === 전역 변수 ===
let player;
let partyStarted = false;
const animals = [];
const animalPaths = ['./models/sheep.glb', './models/chicken.glb', './models/cow.glb'];
const animalPositions = [[-12, 0, -10], [0, 0, -15], [23, 0, -6]];
const inventory = [];
let collected = 0;

const animalScales = [
  3,    // sheep: 양 → 더 큼
  2,  // chicken: 닭 → 더 작음
  4     // cow: 소 → 제일 큼
];

const partyTargets = [];       // 동물별 파티 위치
const dancingStates = [];      // 동물별 도착 여부


// === 동물 상태 (배회용) ===
const animalStates = animalPaths.map(() => ({
  target: new THREE.Vector3(),
  waitTime: 0,
  speed: 0.02 + Math.random() * 0.01
}));

const flyingAnimals = [];  // [{ obj, startTime, originalY }]

function setNewTarget(index) {
  const animal = animals[index];
  const state = animalStates[index];
  if (!animal) return;

  const center = animal.position;
  const safeDistance = 3.0;
  let attempts = 0;

  do {
    state.target.set(
      center.x + (Math.random() - 0.5) * 20,
      center.y,
      center.z + (Math.random() - 0.5) * 20
    );

    // 전체 맵 벗어나지 않도록 제한
    state.target.x = Math.max(Math.min(state.target.x, 50), -50);
    state.target.z = Math.max(Math.min(state.target.z, 50), -50);

    attempts++;
  } while (
    player && state.target.distanceTo(player.position) < safeDistance &&
    attempts < 10
  );

  state.waitTime = 0;
}

// === 바위와 나무 위치 지정 배치 ===
const objectInfo = [
  { path: 'models/rock1.glb', scale: 1.5, positions: [
    [-30, 0, 10], [-15, 0, 23], [0, 0, 24], [15, 0, 23], [30, 0, 22], // 윗쪽
    [-30, 0, 30], [-30, 0, 10], [-32, 0, -10], [-40, 0, -30],         // 왼쪽
    [42, 0, 30], [43, 0, 10], [41, 0, -10], [42, 0, -30]              // 오른쪽
  ]},
  { path: 'models/rock2.glb', scale: 1.5, positions: [
    [-25, 0, 41], [-10, 0, 42], [5, 0, 43], [20, 0, 41], // 윗쪽 중간
    [-43, 0, 0], [43, 0, 0]                            // 좌우 중앙
  ]},
  { path: 'models/tree1.glb', scale: 2, positions: [
    [-35, 0, -34], [-20, 0, -38], [6, 0, -35], [20, 0, -45], [25, 0, -20], // 윗쪽
    [-44, 0, 15], [-44, 0, -25],  // 왼쪽
    [44, 0, 25], [44, 0, -25]     // 오른쪽
  ]},
  { path: 'models/tree2.glb', scale: 2, positions: [
    [-15, 0, -30], [0, 0, -30], [20, 0, -25], // 윗쪽 중심
    [-40, 0, 0], [-44, 0, -15],          // 왼쪽
    [44, 0, 15], [44, 0, -15]             // 오른쪽
  ]}
];

// === 로딩 및 배치 ===
objectInfo.forEach(({ path, scale, positions }) => {
  loader.load(path, (gltf) => {
    const base = gltf.scene;

    base.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    positions.forEach(([x, y, z]) => {
      const clone = base.clone(true);
      clone.position.set(x, y, z);
      clone.scale.set(scale, scale, scale);
      clone.rotation.y = Math.random() * Math.PI * 2;
      scene.add(clone);
    });
  });
});



// 잔디 심기
const NUM_GRASS = 300;  // 원하는 잔디 수
const grassModels = []; // 심어진 풀 저장

loader.load('./models/grass.glb', (gltf) => {
  const baseGrass = gltf.scene;

  for (let i = 0; i < NUM_GRASS; i++) {
    const clone = baseGrass.clone(true); // 깊은 복사
    const x = (Math.random() - 0.5) * 100; // 지형이 100x100이라면
    const z = (Math.random() - 0.5) * 100;

    clone.position.set(x, 0, z);

    // 회전 & 크기 약간 랜덤
    clone.rotation.y = Math.random() * Math.PI * 2;
    const scale = 0.2 + Math.random() * 0.1;
    clone.scale.set(scale, scale, scale);


    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(clone);
    grassModels.push(clone);
  }
});


// 꽃 심기
const NUM_FLOWERS = 100;
const NUM_CLUSTERS = 7;   // 꽃 무더기 중심 수
const FLOWERS_PER_CLUSTER = 10;
const FLOWER_Y = 1;

loader.load('./models/flower.glb', (gltf) => {
  const baseFlower = gltf.scene;

  const clusterCenters = [];

  // 무더기 중심 위치 생성
  for (let i = 0; i < NUM_CLUSTERS; i++) {
    const x = (Math.random() - 0.5) * 80;
    const z = (Math.random() - 0.5) * 80;
    clusterCenters.push({ x, z });
  }

  // 무리지은 꽃 배치
  for (let i = 0; i < NUM_CLUSTERS; i++) {
    for (let j = 0; j < FLOWERS_PER_CLUSTER; j++) {
      const clone = baseFlower.clone(true);
      const cx = clusterCenters[i].x;
      const cz = clusterCenters[i].z;

      // 중심에서 ±3 이내로 퍼뜨림
      const x = cx + (Math.random() - 0.5) * 16;
      const z = cz + (Math.random() - 0.5) * 16;

      clone.position.set(x, FLOWER_Y, z);
      clone.rotation.y = Math.random() * Math.PI * 2;
      const scale = 0.3 + Math.random() * 0.2;
      clone.scale.set(scale, scale, scale);

      clone.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(clone);
    }
  }

  // 흩어진 꽃 (전체 영역에 랜덤)
  const remaining = NUM_FLOWERS - NUM_CLUSTERS * FLOWERS_PER_CLUSTER;
  for (let i = 0; i < remaining; i++) {
    const clone = baseFlower.clone(true);
    const x = (Math.random() - 0.5) * 100;
    const z = (Math.random() - 0.5) * 100;

    clone.position.set(x, 0, z);
    clone.rotation.y = Math.random() * Math.PI * 2;
    const scale = 0.3 + Math.random() * 0.2;
    clone.scale.set(scale, scale, scale);

    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(clone);
  }
});

// 울타리 배치
const FENCE_SPACING = 7;
const FENCE_SCALE = 0.4;
const FIELD_SIZE = 90; // 땅 크기 (100x100 기준)
const HALF = FIELD_SIZE / 2;
const NUM_HORIZONTAL = FIELD_SIZE / FENCE_SPACING;
const NUM_VERTICAL = FIELD_SIZE / FENCE_SPACING;

loader.load('./models/fence.glb', (gltf) => {
  const baseFence = gltf.scene;

  // 윗줄 (x 방향, z = +50)
  for (let i = 0; i < NUM_HORIZONTAL; i++) {
    const clone = baseFence.clone(true);
    const x = -HALF + i * FENCE_SPACING + 5;
    const z = HALF;

    clone.position.set(x, 0, z);
    clone.rotation.y = Math.PI / 2;
    clone.scale.set(FENCE_SCALE, FENCE_SCALE, FENCE_SCALE);
    scene.add(clone);
  }

  // 아랫줄 (x 방향, z = -50)
  for (let i = 0; i < NUM_HORIZONTAL; i++) {
    const clone = baseFence.clone(true);
    const x = -HALF + i * FENCE_SPACING + 5;
    const z = -HALF;

    clone.position.set(x, 0, z);
    clone.rotation.y = Math.PI / 2;
    clone.scale.set(FENCE_SCALE, FENCE_SCALE, FENCE_SCALE);
    scene.add(clone);
  }

  // 왼쪽줄 (z 방향, x = -50)
  for (let i = 0; i < NUM_VERTICAL; i++) {
    const clone = baseFence.clone(true);
    const x = -HALF;
    const z = -HALF + i * FENCE_SPACING + 5;

    clone.position.set(x, 0, z);
    clone.rotation.y = 0;
    clone.scale.set(FENCE_SCALE, FENCE_SCALE, FENCE_SCALE);
    scene.add(clone);
  }

  // 오른쪽줄 (z 방향, x = +50)
  for (let i = 0; i < NUM_VERTICAL; i++) {
    const clone = baseFence.clone(true);
    const x = HALF;
    const z = -HALF + i * FENCE_SPACING + 5;

    clone.position.set(x, 0, z);
    clone.rotation.y = 0;
    clone.scale.set(FENCE_SCALE, FENCE_SCALE, FENCE_SCALE);
    scene.add(clone);
  }
});

// 집 배치
loader.load('models/house.glb', (gltf) => {
  const house = gltf.scene;

  // 크기와 위치 조정
  house.scale.set(15, 15, 15);
  house.position.set(-35, 0, -30);

  // 그림자 적용
  house.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;   
      child.material.metalness = 0.1;
      child.material.roughness = 0.8;
      // 색상 보정 및 밝기 향상
      child.material.emissive.set('#4B2E1B');        // 살짝 발광
      child.material.emissiveIntensity = 0.5;
    }
  });

  scene.add(house);
});

// 거리 기반 충돌 감지 후 이동 제한
function checkCollisionWithAnimals(nextPos) {
  const minDist = 2.5; // 충돌 최소 거리

  for (let animal of animals) {
    const dist = animal.position.distanceTo(nextPos);
    if (dist < minDist) {
      return true; // 충돌 발생
    }
  }
  return false;
}


// === UI 메시지 ===
const message = document.createElement('div');
message.style.position = 'absolute';
message.style.bottom = '10px';
message.style.left = '50%';
message.style.transform = 'translateX(-50%)';
message.style.color = 'white';
message.style.fontSize = '24px';
message.style.textShadow = '1px 1px 2px black';
document.body.appendChild(message);

// 고정 메시지
const tip = document.createElement('div');
tip.style.position = 'absolute';
tip.style.top = '10px';
tip.style.left = '50%';
tip.style.transform = 'translateX(-50%)';
tip.style.color = 'white';
tip.style.fontSize = '20px';
tip.style.textShadow = '1px 1px 2px black';
tip.innerText = '동물들에게 가서 E 키로 아이템을 얻으세요! (방향키: WASD)';
document.body.appendChild(tip);

// === 키 입력 처리 ===
const keys = {};
document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// === 창 크기 조정 대응 ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let tipTimeout = null;

function showTip(text, duration = 3000) {
  tip.innerText = text;
  if (tipTimeout) clearTimeout(tipTimeout);
  tipTimeout = setTimeout(() => {
    tip.innerText = '동물들에게 가서 E 키로 아이템을 얻으세요!';
  }, duration);
}


// === 동물 모델 로딩 ===
for (let i = 0; i < animalPaths.length; i++) {
  loader.load(animalPaths[i], (gltf) => {
    const model = gltf.scene;
    const scale = animalScales[i];
    model.scale.set(scale, scale, scale); // 💡 크기 다르게 적용

    // === 모델 바닥을 y=0에 맞추기 위한 보정 ===
    const box = new THREE.Box3().setFromObject(model);
    const yOffset = box.min.y * 3; // 스케일이 적용되므로 * 3
    model.position.y = -yOffset;

    // wrapper 그룹 생성 (전체를 감싸는 바구니)
    const wrapper = new THREE.Group();
    wrapper.add(model);
    wrapper.position.set(...animalPositions[i]);

    // 동물 타입 저장
    wrapper.userData.type = i;

    model.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
    animals.push(wrapper);
    scene.add(wrapper);
    setNewTarget(i);
  });
}
// 아이템 획득 시 하늘에서 이모지 떨어지기
function showFallingEmoji(emojiChar, x, z) {
  for (let i = 0; i < 10; i++) {
    const emoji = document.createElement('div');
    emoji.innerText = emojiChar;
    emoji.style.position = 'absolute';
    emoji.style.fontSize = `${30 + Math.random() * 20}px`; // 다양한 크기
    emoji.style.pointerEvents = 'none';
    emoji.style.zIndex = '1000';
    emoji.style.opacity = '1';
    emoji.style.transition = 'transform 2s ease-in, opacity 2s';
    emoji.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(emoji);

    // 약간의 랜덤 오프셋 위치
    const start = new THREE.Vector3(
      x + (Math.random() - 0.5) * 4,
      10 + Math.random() * 2,
      z + (Math.random() - 0.5) * 4
    );
    const screen = start.project(camera);
    const sx = (screen.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-screen.y * 0.5 + 0.5) * window.innerHeight;

    emoji.style.left = `${sx}px`;
    emoji.style.top = `${sy}px`;

    // 떨어뜨리는 애니메이션
    requestAnimationFrame(() => {
      emoji.style.opacity = '0';
      emoji.style.transform = `translate(-50%, ${200 + Math.random() * 100}px) scale(1.2)`;
    });

    // 제거
    setTimeout(() => emoji.remove(), 2100);
  }
}


// === 플레이어 로딩 후 시작 ===
loader.load('./models/player.glb', (gltf) => {
  player = gltf.scene;
  player.position.set(0, 0, 0);
  player.scale.set(5, 5, 5);
  player.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  scene.add(player);

  document.getElementById('loading').style.display = 'none';
  animate();
});

// === 애니메이션 루프 ===
function animate() {
  requestAnimationFrame(animate);

  const speed = 0.1;
  
  // === 날아오르는 동물 처리 ===
  const now = Date.now();
  for (let i = flyingAnimals.length - 1; i >= 0; i--) {
    const flying = flyingAnimals[i];
    const t = (now - flying.startTime) / 1000; // 초 단위

    if (t >= 5) {
      // 애니메이션 종료 → 원래 위치로 복귀
      flying.obj.position.y = flying.originalY;
      flying.obj.rotation.set(0, 0, 0);
      flyingAnimals.splice(i, 1); // 리스트에서 제거
    } else {
      // 5초 동안 위로 이동하며 회전
      flying.obj.position.y = flying.originalY + Math.abs(Math.sin(t * Math.PI)) * 3;  // 위아래 곡선
      flying.obj.rotation.y += 0.2;
      flying.obj.rotation.x = Math.sin(t * 10) * 0.1; // 살짝 흔들림 느낌
    }
  }
 
  // 주인공 캐릭터 점프 중일 때
  if (player.userData.jumping) {
    const t = (Date.now() - player.userData.jumpStartTime) / 1000;
    if (t > 5) {
      player.userData.jumping = false;
      player.position.y = 0;
      player.rotation.y = 0;
    } else {
      player.position.y = Math.abs(Math.sin(t * Math.PI)) * 0.5;
      player.rotation.y += 0.2;
    }
  }


  if (player) {
    const dirX = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0);
    const dirZ = (keys['s'] ? 1 : 0) - (keys['w'] ? 1 : 0);
  
    const moveX = new THREE.Vector3(dirX, 0, 0).normalize().multiplyScalar(speed);
    const moveZ = new THREE.Vector3(0, 0, dirZ).normalize().multiplyScalar(speed);
  
    const posX = player.position.clone().add(moveX);
    const posZ = player.position.clone().add(moveZ);
  
    // x축 이동 검사
    if (dirX !== 0 && !checkCollisionWithAnimals(posX)) {
      player.position.x += moveX.x;
    }
  
    // z축 이동 검사
    if (dirZ !== 0 && !checkCollisionWithAnimals(posZ)) {
      player.position.z += moveZ.z;
    }
  
    // 이동 방향으로 회전
    if (dirX !== 0 || dirZ !== 0) {
      const angle = Math.atan2(dirX, dirZ);
      player.rotation.y = angle;
    }
  
    // 카메라 따라가기
    const offset = new THREE.Vector3(0, 8, 15);
    const cameraTarget = player.position.clone().add(offset);
    camera.position.lerp(cameraTarget, 0.1);
    camera.lookAt(player.position);
  }
  
  

  let nearAnimal = false;
  for (let i = 0; i < animals.length; i++) {
    const animal = animals[i];
    const dx = player.position.x - animal.position.x;
    const dz = player.position.z - animal.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 4) {
      nearAnimal = true;
      message.innerText = 'E 키를 눌러 상호작용';
      const type = animal.userData.type;

      if (keys['e'] && !inventory.includes(type)) {
        inventory.push(type);
        collected++;
        
        const item = animalItems[type];
        showTip(item.name);  // 5초간 아이템 획득 메시지 출력

        const emojiChar = item.emoji;
        showFallingEmoji(emojiChar, animal.position.x, animal.position.z);
              
        // 이모티콘 추가
        const itemSpan = document.createElement('span');
        itemSpan.textContent = item.emoji;
        itemSpan.style.fontSize = '60px';  // 크기 조절
        inventoryBox.appendChild(itemSpan);
      
        // 동물 날기 애니메이션 시작
        flyingAnimals.push({
          obj: animal,
          startTime: Date.now(),
          originalY: 0
        });

        // 주인공 반응 애니메이션 추가
        player.userData.jumpStartTime = Date.now();
        player.userData.jumping = true;        

        if (collected === 3) {
          setTimeout(() => {
            showTip('아이템을 모두 모았습니다! 파티가 곧 시작됩니다 🎉', 5000);
            message.innerText = '';
            setTimeout(() => {
              startParty();
            }, 5000);
          }, 3000);  // 0.5초 후에 파티 메시지 표시
        }
      }
      break;
    }
  }
  if (!nearAnimal || partyStarted) {
    message.innerText = '';
  }

  if (partyStarted) {
    setTimeout(() => {
      showTip('파티가 시작되었습니다 🎉', 5000);
      message.innerText = '';
      setTimeout(() => {
        startParty();
      }, 5000);
    }, 0);
    animals.forEach((animal, idx) => {
      const target = partyTargets[idx];
  
      if (!dancingStates[idx]) {
        const dist = animal.position.distanceTo(target);
        if (dist > 0.1) {
          const dir = new THREE.Vector3().subVectors(target, animal.position).normalize();
          animal.position.addScaledVector(dir, 0.05); // 걷는 속도
          animal.rotation.y = Math.atan2(dir.x, dir.z);
        } else {
          dancingStates[idx] = true;
        }
      }
  
      // 춤추기
      if (dancingStates[idx]) {
        const t = Date.now() / 300 + idx;
        animal.position.y = Math.sin(t) * 0.5;
        animal.rotation.y += Math.sin(t * 3 + idx) * 0.05;
      }
    });
  
    // 캐릭터도 춤
    const t = Date.now() / 300;
    player.position.y = Math.abs(Math.sin(t)) * 0.5;
    player.rotation.y += 0.1;
    
  } else {
  // 자유 배회
  animals.forEach((animal, idx) => {
    const state = animalStates[idx];
    const dist = animal.position.distanceTo(state.target);

    // 플레이어와 너무 가까우면 target 무시하고 도망 방향으로 이동
    if (player) {
      const distToPlayer = animal.position.distanceTo(player.position);
      if (distToPlayer < 3.0) {
        const awayDir = new THREE.Vector3().subVectors(animal.position, player.position).normalize();
        animal.position.addScaledVector(awayDir, state.speed * 0.7); // 도망 이동
        animal.rotation.y = Math.atan2(awayDir.x, awayDir.z);
        return; // 아래 로직 생략하고 탈출
      }
    }

    if (dist < 0.5) {
      state.waitTime += 1;
      if (state.waitTime > 100) {
        setNewTarget(idx);
      }
    } else {
      const dir = new THREE.Vector3().subVectors(state.target, animal.position).normalize();
      animal.position.addScaledVector(dir, state.speed);

      // 회전 방향 설정
      const angle = Math.atan2(dir.x, dir.z);
      animal.rotation.y = angle;
    }
  });
  }
  renderer.render(scene, camera);
}

// === 파티 시작 ===
function startParty() {
  if (partyStarted) return;
  partyStarted = true;

  scene.background = nightTexture;
  light.color.set(0x111144);
  light.intensity = 0.3;
  ambientLight.intensity = 0.4;
  animals.forEach((animal, idx) => {
    const emoji = document.createElement('div');
    emoji.innerText = '🥳';
    emoji.style.position = 'absolute';
    emoji.style.fontSize = '36px';
    emoji.style.pointerEvents = 'none';
    emoji.style.textShadow = '1px 1px 3px black';
    document.body.appendChild(emoji);
    animal.userData.emojiEl = emoji;
  });
  
  const center = player.position.clone();
  const radius = 4;
  
  animals.forEach((animal, idx) => {
    const angle = (Math.PI * 2 * idx) / animals.length;
    const x = center.x + Math.cos(angle) * radius;
    const z = center.z + Math.sin(angle) * radius;
    const target = new THREE.Vector3(x, 0, z);
  
    partyTargets[idx] = target;
    dancingStates[idx] = false;
  
    // 방향 설정
    const dir = new THREE.Vector3().subVectors(center, target);
    animal.rotation.y = Math.atan2(dir.x, dir.z);
  });
  

  // 하늘에 회전하는 조명 구슬
  const discoBall = new THREE.PointLight(0xffffff, 1, 100);
  discoBall.position.set(0, 8, 0);
  scene.add(discoBall);

  const discoGeometry = new THREE.SphereGeometry(0.5, 16, 16);
  const discoMaterial = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 1, roughness: 0, emissive: 0x000000 });
  const discoMesh = new THREE.Mesh(discoGeometry, discoMaterial);
  discoBall.add(discoMesh);

  const colors = [0xff00ff, 0x00ffff, 0xffff00, 0xffffff];
  let colorIndex = 0;

  // 무대 조명
  const floorSpot = new THREE.SpotLight(0xffffff, 1.5);
  floorSpot.position.set(0, 0.5, 0);         // 바닥 중앙 근처
  floorSpot.target.position.set(0, 8, 0);    // 디스코볼 방향으로
  floorSpot.angle = Math.PI / 6;
  floorSpot.penumbra = 0.5;
  floorSpot.decay = 2;
  floorSpot.distance = 20;
  scene.add(floorSpot);
  scene.add(floorSpot.target);

  const floorGlow = new THREE.PointLight(0xeeeeff, 1.0, 20);
  floorGlow.position.set(0, 1.5, 0); // 약간만 위로 띄움
  scene.add(floorGlow);
  ground.material.metalness = 0.3;
  ground.material.roughness = 0.6;
  floorSpot.color.setHex(0xff66ff); // 핑크빛 무대 조명 느낌

// === 파티 풍선 배치 ===
loader.load('./models/balloon.glb', (gltf) => {
  const balloon = gltf.scene;
  balloon.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });

  const positions = [
    [-8, 5, -8], [8, 5, -8],
    [-8, 5, 8], [8, 5, 8],
    [0, 5, -10], [0, 5, 10]
  ];

  positions.forEach((pos) => {
    const clone = balloon.clone(true);
    clone.position.set(...pos);
    clone.scale.set(2.5, 2.5, 2.5); // 풍선 크기
    scene.add(clone);
  });
});

// === 가렌다 (삼각 장식 줄) 배치 ===
loader.load('./models/garland.glb', (gltf) => {
  const garland = gltf.scene;
  garland.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });

  const garlandPositions = [
    [-15, 6, 0],  // 왼쪽 벽면 느낌
    [15, 6, 0],   // 오른쪽 벽면 느낌
    [0, 6, -15],  // 앞
    [0, 6, 15]    // 뒤
  ];

  garlandPositions.forEach((pos, i) => {
    const clone = garland.clone(true);
    clone.position.set(...pos);
    clone.scale.set(3, 3, 3); // 크기 조정
    if (i % 2 === 1) clone.rotation.y = Math.PI; // 방향 반전
    scene.add(clone);
  });
});

// 풍선 및 가렌다 조명 (파티 중앙 위)
const decorLight = new THREE.PointLight(0xffccff, 1.2, 30);  // 부드러운 핑크빛 조명
decorLight.position.set(0, 7.5, 0);
scene.add(decorLight);


  // 미러볼
  loader.load('./models/partyBall.glb', (gltf) => {
  const discoMesh = gltf.scene;

  // 크기 조정 (필요에 따라 조정)
  discoMesh.scale.set(2.5, 2.5, 2.5);
  discoMesh.position.set(0, 8, 0);  // 공중에 매달린 느낌

  const textureLoader = new THREE.TextureLoader();
  const envMap = textureLoader.load('./textures/night.jpg'); // 또는 mirror.jpg 등
  envMap.mapping = THREE.EquirectangularReflectionMapping;

  // 그림자 및 반사 설정
  discoMesh.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
      child.material.metalness = 1.0;
      child.material.roughness = 0.05;
      child.material.envMap = envMap;
      child.material.envMapIntensity = 1.5;
      child.material.needsUpdate = true;
    }
  });

  scene.add(discoMesh);

  // 회전 애니메이션
  const rotateDisco = () => {
    if (!partyStarted) return;
    discoMesh.rotation.y += 0.02;
    requestAnimationFrame(rotateDisco);
  };
  rotateDisco();
});


  // 1초마다 색 변경
  setInterval(() => {
    discoBall.color.setHex(colors[colorIndex]);
    discoMaterial.color.setHex(colors[colorIndex]);
    discoMaterial.emissive.setHex(colors[colorIndex]);
    colorIndex = (colorIndex + 1) % colors.length;
  }, 500);

  // 회전 효과
  const rotateBall = () => {
    requestAnimationFrame(rotateBall);
    discoMesh.rotation.y += 0.05;
    discoBall.position.x = Math.sin(Date.now() * 0.001) * 5;
    discoBall.position.z = Math.cos(Date.now() * 0.001) * 5;
  };
  rotateBall();

  // 음악 효과 (선택사항, HTML <audio> 태그 필요)
  const audio = new Audio('./sounds/party.mp3');
  audio.loop = true;
  audio.volume = 0.1;
  audio.play();

  showTip('🎊 파티 타임! 친구들과 즐기세요 🎊', 7000);
  message.innerText = '파티가 시작되었습니다!';
}
