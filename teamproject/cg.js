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
light.position.set(10, 20, 10);
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


// === 카메라 위치 및 컨트롤 ===
camera.position.set(0, 10, 20);

// === 모델 로더 선언 ===
const loader = new GLTFLoader();

// === 전역 변수 ===
let player;
let partyStarted = false;
const animals = [];
const animalPaths = ['./models/sheep.glb', './models/chicken.glb', './models/cow.glb'];
const animalPositions = [[-12, 2.7, -10], [0, 2.7, -15], [23, 2.7, -6]];
const inventory = [];
let collected = 0;

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

  // 주변 반경 10 내외
  state.target.set(
    center.x + (Math.random() - 0.5) * 20,
    2.7,
    center.z + (Math.random() - 0.5) * 20
  );

  // 전체 맵 벗어나지 않도록 제한
  state.target.x = Math.max(Math.min(state.target.x, 50), -50);
  state.target.z = Math.max(Math.min(state.target.z, 50), -50);

  state.waitTime = 0;
}

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
    const z = -HALF + i * FENCE_SPACING + 5;ㅁ

    clone.position.set(x, 0, z);
    clone.rotation.y = 0;
    clone.scale.set(FENCE_SCALE, FENCE_SCALE, FENCE_SCALE);
    scene.add(clone);
  }
});

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
tip.innerText = '동물들에게 가서 E 키로 아이템을 얻으세요!';
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

// === 동물 모델 로딩 ===
for (let i = 0; i < animalPaths.length; i++) {
  loader.load(animalPaths[i], (gltf) => {
    const model = gltf.scene;
    model.scale.set(3, 3, 3);

    // wrapper 그룹 생성 (전체를 감싸는 바구니)
    const wrapper = new THREE.Group();
    wrapper.add(model);
    wrapper.position.set(...animalPositions[i]);

    model.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
    animals.push(wrapper);
    scene.add(wrapper);
    setNewTarget(i);
  });
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
      flying.obj.position.y = flying.originalY + Math.sin(t * Math.PI) * 3;  // 위아래 곡선
      flying.obj.rotation.y += 0.2;
      flying.obj.rotation.x = Math.sin(t * 10) * 0.1; // 살짝 흔들림 느낌
    }
  }


  if (player) {
    if (keys['w']) player.position.z -= speed;
    if (keys['s']) player.position.z += speed;
    if (keys['a']) player.position.x -= speed;
    if (keys['d']) player.position.x += speed;

    // 이동 방향으로 회전
    const dx = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0);
    const dz = (keys['s'] ? 1 : 0) - (keys['w'] ? 1 : 0);
    if (dx !== 0 || dz !== 0) {
      const angle = Math.atan2(dx, dz);
      player.rotation.y = angle;
    }

    // 카메라가 주인공을 따라감
    const offset = new THREE.Vector3(0, 8, 15); // 뒤에서 위쪽에서 따라가는 거리
    const cameraTarget = player.position.clone().add(offset);
    camera.position.lerp(cameraTarget, 0.1); // 부드럽게 따라가도록 보간
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
      if (keys['e'] && !inventory.includes(i)) {
        inventory.push(i);
        collected++;
        message.innerText = '아이템을 획득했습니다!';

        // 동물 날기 애니메이션 시작
        flyingAnimals.push({
          obj: animal,
          startTime: Date.now(),
          originalY: animal.position.y
        });

        if (collected === 3) {
          tip.style.display = 'none';
          message.innerText = '아이템을 모두 모았습니다! 파티가 곧 시작됩니다 🎉';
          setTimeout(() => {
            startParty();
          }, 5000); // 5000ms = 5초 후 파티 시작
        }
      }
      break;
    }
  }
  if (!nearAnimal) {
    // 파티 시작 전이고, 메시지가 특정 안내일 때는 유지
    if (!partyStarted && message.innerText.includes('파티가 곧 시작')) {
      // 그대로 둔다
    } else {
      message.innerText = '';
    }
  }

  if (partyStarted) {
    tip.style.display = 'none';
    animals.forEach((animal, idx) => {
      animal.rotation.y += 0.01;
      animal.position.y = Math.sin(Date.now() / 300 + idx) * 0.3;
    });
  } else {
    // 자유 배회
    animals.forEach((animal, idx) => {
      const state = animalStates[idx];
      const dist = animal.position.distanceTo(state.target);
  
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
  message.innerText = '파티가 시작되었습니다!';
}
