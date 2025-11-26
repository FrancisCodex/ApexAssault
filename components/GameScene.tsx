import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Stars, Cloud, Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { PLANE_STATS, PlaneType } from '../types';
import { FighterJet, PropellerPlane, Helicopter, EnemyPlane } from './Models';

// --- Utility Types ---
interface Bullet {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  owner: 'PLAYER' | 'ENEMY';
  life: number;
}

interface Missile {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  target?: Enemy; // For homing
  life: number;
  type: 'HOMER' | 'TRAILING' | 'BARRAGE';
}

interface Enemy {
  id: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  velocity: THREE.Vector3;
  health: number;
  type: PlaneType;
  nextShot: number;
}

interface Particle {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  color: string;
}

// --- Constants ---
const BULLET_SPEED = 1000;
const BULLET_LIFETIME = 2.5;
const WORLD_BOUNDARY = 1500;

// --- Sub-Components for Rendering ---

const PlayerObject = ({
  type,
  positionRef,
  rotationRef
}: {
  type: PlaneType,
  positionRef: React.MutableRefObject<THREE.Vector3>,
  rotationRef: React.MutableRefObject<THREE.Quaternion>
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.copy(positionRef.current);
      groupRef.current.quaternion.copy(rotationRef.current);
    }
  });

  return (
    <group ref={groupRef}>
      {type === 'FIGHTER' && <FighterJet />}
      {type === 'PROPELLER' && <PropellerPlane />}
      {type === 'HELICOPTER' && <Helicopter />}
    </group>
  );
};

const EnemyObject = ({ data }: { data: Enemy }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.copy(data.position);
      groupRef.current.quaternion.copy(data.quaternion);
    }
  });

  return (
    <group ref={groupRef}>
      <EnemyPlane />
      <Billboard position={[0, 4, 0]}>
        <mesh>
          <planeGeometry args={[4 * (data.health / 100), 0.4]} />
          <meshBasicMaterial color="red" depthTest={false} />
        </mesh>
      </Billboard>
    </group>
  );
};

// Bullet Object Wrapper - Improved visibility
// Bullet Object Wrapper - Improved visibility
const BulletObject = ({ data }: { data: Bullet }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(data.position);
      // Orient bullet to velocity
      const lookAt = data.position.clone().add(data.velocity);
      meshRef.current.lookAt(lookAt);
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.8, 0.8, 15]} />
      <meshBasicMaterial
        color={data.owner === 'PLAYER' ? "#00ffff" : "#ffaa00"}
        toneMapped={false}
      />
      <pointLight distance={20} intensity={2} color={data.owner === 'PLAYER' ? "#00ffff" : "#ffaa00"} />
    </mesh>
  );
};

const MissileObject = ({ data }: { data: Missile }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(data.position);
      meshRef.current.lookAt(data.position.clone().add(data.velocity));
    }
  });
  return (
    <mesh ref={meshRef}>
      <capsuleGeometry args={[0.5, 3, 4, 8]} />
      <meshStandardMaterial color="yellow" emissive="orange" emissiveIntensity={2} />
      <pointLight distance={30} intensity={5} color="orange" />
    </mesh>
  );
};

const ParticleObject = ({ data }: { data: Particle }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(data.position);
      const scale = data.life * 2;
      meshRef.current.scale.set(scale, scale, scale);
      (meshRef.current.material as THREE.Material).opacity = data.life;
    }
  })
  return (
    <mesh ref={meshRef}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={data.color} transparent />
    </mesh>
  )
}

const Minimap = ({
  playerPos,
  playerRot,
  enemiesRef
}: {
  playerPos: React.MutableRefObject<THREE.Vector3>,
  playerRot: React.MutableRefObject<THREE.Quaternion>,
  enemiesRef: React.MutableRefObject<Enemy[]>
}) => {

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 200, 200);

    // Background
    ctx.fillStyle = "rgba(0,20,0,0.5)";
    ctx.beginPath();
    ctx.arc(100, 100, 98, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Player
    ctx.fillStyle = "#00ffff";
    ctx.beginPath();
    ctx.arc(100, 100, 3, 0, Math.PI * 2);
    ctx.fill();

    const range = 3000;
    const scale = 100 / range;

    const euler = new THREE.Euler().setFromQuaternion(playerRot.current);
    const yaw = euler.y;

    enemiesRef.current.forEach(e => {
      const relX = e.position.x - playerPos.current.x;
      const relZ = e.position.z - playerPos.current.z;

      const rotX = relX * Math.cos(yaw) - relZ * Math.sin(yaw);
      const rotZ = relX * Math.sin(yaw) + relZ * Math.cos(yaw);

      const mapX = 100 + rotX * scale;
      const mapY = 100 + rotZ * scale;

      const dist = Math.sqrt(rotX * rotX + rotZ * rotZ);
      if (dist < range) {
        ctx.fillStyle = "#ff0000";
        ctx.beginPath();
        ctx.arc(mapX, mapY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  // normal animation loop (not R3F)
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      requestAnimationFrame(loop);
    };
    loop();
    return () => { running = false };
  }, []);

  return (
    <div className="pointer-events-none">
      <canvas ref={canvasRef} width={200} height={200} className="rounded-full" />
    </div>
  );
};


// --- Game Manager (Logic & State) ---
const MAX_BULLETS = 500; // limit



const GameManager = () => {
  const {
    selectedPlane,
    status,
    updateHealth,
    registerKill,
    setGameStatus,
    wave,
    nextWave,
    pauseGame,
    settings,
    skillCooldown,
    triggerSkill
  } = useGameStore();

  const { camera } = useThree();

  // Physics State (Mutable)
  const playerPos = useRef(new THREE.Vector3(0, 100, 0));
  const playerRot = useRef(new THREE.Quaternion());
  const playerVel = useRef(new THREE.Vector3(0, 0, 0));
  const playerHP = useRef(PLANE_STATS[selectedPlane].health);
  const lastShotTime = useRef(0);
  const bulletMeshRef = useRef<THREE.InstancedMesh>(null);
  const bulletDummy = new THREE.Object3D();

  // Lists for Rendering (State to trigger mounts)
  // Lists for Rendering (State to trigger mounts)
  const [enemyList, setEnemyList] = useState<Enemy[]>([]);
  // const [bulletList, setBulletList] = useState<Bullet[]>([]); // REMOVED STATE
  const [particleList, setParticleList] = useState<Particle[]>([]);

  // Force Update for Ref-based rendering
  const [, forceUpdate] = useState({});

  // Refs to list data for loop access without stale closures
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Skill State
  const barrageTimer = useRef(0);

  const keys = useRef<{ [key: string]: boolean }>({});
  const mouse = useRef(new THREE.Vector2());

  const spawnEnemies = useCallback((waveNum: number) => {
    const enemyCount = Math.max(5, 3 + Math.ceil(waveNum * 1.5));
    useGameStore.getState().setEnemiesRemaining(enemyCount);
    const newEnemies: Enemy[] = [];
    useGameStore.getState().setRefs(playerPos, playerRot, enemiesRef);

    for (let i = 0; i < enemyCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 600 + Math.random() * 400;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const y = 100 + Math.random() * 200;

      const types: PlaneType[] = ['FIGHTER', 'PROPELLER', 'HELICOPTER'];
      const type = types[Math.floor(Math.random() * types.length)];

      const e = {
        id: Math.random().toString(36),
        position: new THREE.Vector3(x, y, z),
        quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI, 0)),
        velocity: new THREE.Vector3(),
        health: PLANE_STATS[type].health,
        type: type,
        nextShot: Math.random() * 2000
      };
      newEnemies.push(e);
    }
    enemiesRef.current = newEnemies;
    setEnemyList([...newEnemies]);
  }, []);

  // Strict Reset when entering PLAYING state
  useEffect(() => {
    if (status === 'PLAYING') {
      const stats = PLANE_STATS[selectedPlane];
      playerPos.current.set(0, 100, 0);
      playerRot.current.setFromEuler(new THREE.Euler(0, 0, 0));
      playerHP.current = stats.health;

      // Explicitly clear refs
      bulletsRef.current = [];
      enemiesRef.current = [];
      missilesRef.current = [];
      particlesRef.current = [];

      // Force UI clear
      // setBulletList([]); // REMOVED
      setParticleList([]);
      setEnemyList([]);

      // Initial Spawn
      spawnEnemies(1);
    }
  }, [status, selectedPlane, spawnEnemies]);

  // Wave Management
  useEffect(() => {
    if (status === 'PLAYING' && wave > 1) {
      spawnEnemies(wave);
    }
  }, [wave, spawnEnemies, status]);

  // Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'Escape') {
        pauseGame();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.code] = false);
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const handleMouseDown = () => {
      keys.current['Click'] = true;
    };
    const handleMouseUp = () => {
      keys.current['Click'] = false;
    };
    // Skill Input
    const handleSkill = (e: KeyboardEvent) => {
      if ((e.code === 'KeyE' || e.code === 'ShiftLeft') && status === 'PLAYING') {
        activateSkill();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleSkill);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleSkill);
    };
  }, [pauseGame, status]);

  // Main Loop
  useFrame((state, delta) => {
    if (status !== 'PLAYING') return;

    // Safety Cap on Delta
    const safeDelta = Math.min(delta, 0.1);

    // 1. Player Physics
    const stats = PLANE_STATS[selectedPlane];
    const speed = keys.current['KeyW'] ? stats.speed * 40 : (keys.current['KeyS'] ? stats.speed * 15 : stats.speed * 25);

    // Control Schemes
    let targetPitch = 0;
    let targetYaw = 0;
    let roll = 0;

    if (settings.controlScheme === 'MOUSE') {
      // Mouse controls steering, W/S throttle, Space/Click shoots
      targetPitch = mouse.current.y * 1.5;
      targetYaw = -mouse.current.x * 1.5;
      roll = -mouse.current.x * 1.2;
    } else {
      // Keyboard controls steering (Arrow keys), W/S throttle, Click shoots
      if (keys.current['ArrowUp']) targetPitch = 1.2;
      if (keys.current['ArrowDown']) targetPitch = -1.2;
      if (keys.current['ArrowLeft']) { targetYaw = 1.2; roll = 0.8; }
      if (keys.current['ArrowRight']) { targetYaw = -1.2; roll = -0.8; }
    }

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(playerRot.current);

    // Smoothly interpolate towards target pitch/yaw
    euler.x += (targetPitch - euler.x) * stats.turnSpeed * safeDelta;
    euler.y += (targetYaw * stats.turnSpeed * safeDelta);
    euler.z = THREE.MathUtils.lerp(euler.z, roll, safeDelta * 3);

    playerRot.current.setFromEuler(euler);

    // Forward vector (Z is negative in Three.js default look direction)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerRot.current);
    playerVel.current.copy(forward).multiplyScalar(speed * safeDelta * 10);
    playerPos.current.add(playerVel.current);

    // Bounds
    if (Math.abs(playerPos.current.x) > WORLD_BOUNDARY) playerPos.current.x = Math.sign(playerPos.current.x) * WORLD_BOUNDARY;
    if (Math.abs(playerPos.current.z) > WORLD_BOUNDARY) playerPos.current.z = Math.sign(playerPos.current.z) * WORLD_BOUNDARY;
    if (playerPos.current.y < 10) playerPos.current.y = 10;
    if (playerPos.current.y > 1000) playerPos.current.y = 1000;

    // 2. Camera Chase
    // Camera should be behind (-Z local is forward, so +Z local is behind) and above
    const camOffset = new THREE.Vector3(0, 10, 40).applyQuaternion(playerRot.current);
    const camPos = playerPos.current.clone().add(camOffset);
    camera.position.lerp(camPos, 0.1);
    const lookTarget = playerPos.current.clone().add(forward.clone().multiplyScalar(100));
    camera.lookAt(lookTarget);

    // 3. Shooting
    const now = state.clock.elapsedTime * 1000;

    const isUIFiring = useGameStore.getState().isFiring;

    // Universal firing inputs - Works in ALL control modes
    const isSpacePressed = keys.current['Space'] || keys.current['CodeSpace'] || keys.current['Enter'];
    const isMousePressed = keys.current['Click'];

    const isFiring = isUIFiring || isSpacePressed || isMousePressed;

    const fireDelay = stats.fireRate;

    if (bulletMeshRef.current) {
      bulletsRef.current.forEach((b, i) => {
        bulletDummy.position.copy(b.position);

        // Point bullet along velocity
        const lookTarget = b.position.clone().add(b.velocity);
        bulletDummy.lookAt(lookTarget);

        bulletDummy.updateMatrix();
        bulletMeshRef.current!.setMatrixAt(i, bulletDummy.matrix);
      });

      bulletMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (isFiring && now - lastShotTime.current >= fireDelay) {
      lastShotTime.current = now;

      // Aim Assist Logic
      let finalVelocity = forward.clone().multiplyScalar(BULLET_SPEED);

      // Find nearest enemy in front
      let bestTarget = null;
      let maxDot = 0.96; // ~15 degree cone

      for (const enemy of enemiesRef.current) {
        const dirToEnemy = enemy.position.clone().sub(playerPos.current).normalize();
        const dot = forward.dot(dirToEnemy);
        if (dot > maxDot && enemy.position.distanceTo(playerPos.current) < 800) {
          maxDot = dot;
          bestTarget = enemy;
        }
      }

      if (bestTarget) {
        const dirToTarget = bestTarget.position.clone().sub(playerPos.current).normalize();
        // Blend current forward with target direction for a "curve" effect or just direct hit
        // For simple assist, we just shoot AT them
        finalVelocity = dirToTarget.multiplyScalar(BULLET_SPEED);
      }

      // Bullet spawn
      const b: Bullet = {
        id: Math.random().toString(36),
        position: playerPos.current.clone().add(forward.clone().multiplyScalar(15)),
        velocity: finalVelocity,
        owner: 'PLAYER',
        life: BULLET_LIFETIME
      };

      bulletsRef.current.push(b);
    }

    // Skill Logic (Barrage)
    if (barrageTimer.current > 0) {
      barrageTimer.current -= delta;
      if (now % 100 < 20) {
        const bVel = forward.clone().multiplyScalar(BULLET_SPEED);
        // Find target
        let target: Enemy | undefined;
        let minDist = 1000;
        enemiesRef.current.forEach(e => {
          const d = e.position.distanceTo(playerPos.current);
          if (d < minDist) { minDist = d; target = e; }
        });

        missilesRef.current.push({
          id: Math.random().toString(),
          position: playerPos.current.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, 0, 0)),
          velocity: bVel,
          target: target,
          life: 3.0,
          type: 'BARRAGE'
        });
        forceUpdate({});
      }
    }

    // 4. Enemy Logic
    let enemiesChanged = false;
    enemiesRef.current.forEach(enemy => {
      // AI
      const dirToPlayer = playerPos.current.clone().sub(enemy.position).normalize();

      // Rotate towards player smoothly
      const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dirToPlayer);
      enemy.quaternion.slerp(targetQuat, PLANE_STATS[enemy.type].turnSpeed * safeDelta * 0.5);

      // Move
      const enemyStats = PLANE_STATS[enemy.type];
      const moveSpeed = enemyStats.speed * 20;
      const velocity = new THREE.Vector3(0, 0, -1).applyQuaternion(enemy.quaternion).multiplyScalar(moveSpeed * safeDelta * 10);
      enemy.position.add(velocity);

      // Shoot
      const dist = enemy.position.distanceTo(playerPos.current);
      if (dist < 600 && now > enemy.nextShot) {
        enemy.nextShot = now + enemyStats.fireRate * 8; // Much slower enemy fire (was *3)
        const bVel = dirToPlayer.clone().multiplyScalar(BULLET_SPEED * 0.8);
        const b: Bullet = {
          id: Math.random().toString(),
          position: enemy.position.clone().add(dirToPlayer.multiplyScalar(8)),
          velocity: bVel,
          owner: 'ENEMY',
          life: BULLET_LIFETIME
        };
        bulletsRef.current.push(b);
        forceUpdate({}); // Trigger render
      }
    });

    // 5. Bullets Physics
    let bulletsChanged = false;
    for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
      const b = bulletsRef.current[i];
      b.life -= safeDelta;
      b.position.add(b.velocity.clone().multiplyScalar(safeDelta));

      let hit = false;

      // Player Bullet hits Enemy
      if (b.owner === 'PLAYER') {
        for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
          const e = enemiesRef.current[j];
          // Simple sphere collision
          if (b.position.distanceTo(e.position) < 15) {
            hit = true;
            e.health -= stats.damage;
            spawnExplosion(b.position, 'orange', 1);
            if (e.health <= 0) {
              spawnExplosion(e.position, 'red', 40);
              enemiesRef.current.splice(j, 1);
              registerKill(100);
              useGameStore.getState().setEnemiesRemaining(enemiesRef.current.length);
              enemiesChanged = true;
              useGameStore.getState().setRefs(playerPos, playerRot, enemiesRef);

            }
            break;
          }
        }
      }
      // Enemy hits Player
      else if (b.owner === 'ENEMY') {
        if (b.position.distanceTo(playerPos.current) < 10) {
          hit = true;
          playerHP.current -= 5;
          updateHealth(playerHP.current);
          spawnExplosion(b.position, 'red', 5);
          if (playerHP.current <= 0) {
            setGameStatus('GAMEOVER');
          }
        }
      }

      if (hit || b.life <= 0) {
        bulletsRef.current.splice(i, 1);
        bulletsChanged = true;
      }
    }

    if (bulletsChanged) forceUpdate({});

    // Missiles Physics
    let missilesChanged = false;
    for (let i = missilesRef.current.length - 1; i >= 0; i--) {
      const m = missilesRef.current[i];
      m.life -= safeDelta;

      // Homing Logic
      if (m.target && enemiesRef.current.includes(m.target)) {
        const dir = m.target.position.clone().sub(m.position).normalize();
        // Steer towards target
        m.velocity.lerp(dir.multiplyScalar(BULLET_SPEED * 0.8), safeDelta * 5);
      } else if (m.type === 'HOMER' || m.type === 'BARRAGE') {
        // Find new target if lost
        let minDist = 2000;
        enemiesRef.current.forEach(e => {
          const d = e.position.distanceTo(m.position);
          if (d < minDist) { minDist = d; m.target = e; }
        });
      }

      m.position.add(m.velocity.clone().multiplyScalar(safeDelta));

      // Collision
      let hit = false;
      for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
        const e = enemiesRef.current[j];
        if (m.position.distanceTo(e.position) < 20) {
          hit = true;
          const dmg = m.type === 'BARRAGE' ? 30 : 75;
          e.health -= dmg;
          spawnExplosion(m.position, 'orange', 10);
          if (e.health <= 0) {
            spawnExplosion(e.position, 'red', 40);
            enemiesRef.current.splice(j, 1);
            registerKill(100);
            useGameStore.getState().setEnemiesRemaining(enemiesRef.current.length);
            enemiesChanged = true;
          }
          break;
        }
      }

      if (hit || m.life <= 0) {
        missilesRef.current.splice(i, 1);
        missilesChanged = true;
      }
    }
    if (missilesChanged) forceUpdate({});

    if (enemiesChanged) {
      setEnemyList([...enemiesRef.current]);
      useGameStore.getState().setRefs(playerPos, playerRot, enemiesRef);
    }

    // 6. Particles
    let particlesChanged = false;
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.life -= safeDelta * 1.5;
      p.position.add(p.velocity.clone().multiplyScalar(safeDelta));
      if (p.life <= 0) {
        particlesRef.current.splice(i, 1);
        particlesChanged = true;
      }
    }
    if (particlesChanged) setParticleList([...particlesRef.current]);

    // 7. Wave Check || FOR VICTORY AND GLORY
    if (enemiesRef.current.length === 0 && status === 'PLAYING') {
      if (wave >= 10) {
        setGameStatus('VICTORY');
      } else {
        nextWave();
      }
    }
  });

  const spawnExplosion = (pos: THREE.Vector3, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: Math.random().toString(),
        position: pos.clone(),
        velocity: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(Math.random() * 50),
        life: 1.0,
        color
      });
    }
    setParticleList([...particlesRef.current]);
  };

  const activateSkill = () => {
    const now = Date.now();
    if (now < useGameStore.getState().skillCooldown) return;

    triggerSkill();
    const stats = PLANE_STATS[selectedPlane];

    if (selectedPlane === 'FIGHTER') {
      // Homer Missile
      let target: Enemy | undefined;
      let minDist = 2000;
      enemiesRef.current.forEach(e => {
        const d = e.position.distanceTo(playerPos.current);
        if (d < minDist) { minDist = d; target = e; }
      });

      const m: Missile = {
        id: Math.random().toString(),
        position: playerPos.current.clone().add(new THREE.Vector3(0, -2, 0)),
        velocity: new THREE.Vector3(0, -10, 0).applyQuaternion(playerRot.current).add(playerVel.current), // Drop then ignite
        target: target,
        life: 5.0,
        type: 'HOMER'
      };
      missilesRef.current.push(m);
      forceUpdate({});
    }
    else if (selectedPlane === 'PROPELLER') {
      // Trailing Missile (Fires backwards)
      const back = new THREE.Vector3(0, 0, 1).applyQuaternion(playerRot.current);
      const m: Missile = {
        id: Math.random().toString(),
        position: playerPos.current.clone().add(back.multiplyScalar(10)),
        velocity: back.multiplyScalar(BULLET_SPEED * 0.5),
        life: 5.0,
        type: 'TRAILING'
      };
      // Find target behind
      enemiesRef.current.forEach(e => {
        const dir = e.position.clone().sub(playerPos.current).normalize();
        if (back.dot(dir) > 0.8) m.target = e;
      });
      missilesRef.current.push(m);
      forceUpdate({});
    }
    else if (selectedPlane === 'HELICOPTER') {
      // Barrage
      barrageTimer.current = 3.0;
    }
  };

  useEffect(() => {
    useGameStore.getState().setRefs(playerPos, playerRot, enemiesRef);
  }, []);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 200, 50]} intensity={2} castShadow />

      {/* Dynamic Objects */}
      <PlayerObject type={selectedPlane} positionRef={playerPos} rotationRef={playerRot} />

      {enemyList.map(e => <EnemyObject key={e.id} data={e} />)}
      <instancedMesh
        ref={bulletMeshRef}
        args={[null, null, MAX_BULLETS]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.6, 0.6, 10]} />
        <meshBasicMaterial color="#00ffff" toneMapped={false} />
      </instancedMesh>

      {missilesRef.current.map(m => <MissileObject key={m.id} data={m} />)}

      {particleList.map(p => <ParticleObject key={p.id} data={p} />)}

      {/* Scenery */}
      <Environment preset="sunset" />
      {settings.showClouds && (
        <Cloud opacity={0.3} segments={30} bounds={[400, 100, 400]} volume={300} color="white" position={[0, 150, 0]} />
      )}
      <Stars radius={500} depth={100} count={5000} factor={4} fade />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -10, 0]}>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color="#27272a" roughness={0.9} />
      </mesh>
      <gridHelper args={[6000, 60]} position={[0, -9, 0]} />
    </>
  );
};

export const GameScene = () => {
  const playerPos = useGameStore(state => state.playerPosRef);
  const playerRot = useGameStore(state => state.playerRotRef);
  const enemiesRef = useGameStore(state => state.enemiesRef);

  return (
    <div className="w-full h-full relative">

      <Canvas shadows camera={{ fov: 60, position: [0, 10, 30] }}>
        <GameManager />
      </Canvas>

      {/* Only render when refs are ready */}
      {playerPos && playerRot && enemiesRef && (
        <div className="absolute bottom-6 right-6 z-50 pointer-events-none">
          <Minimap playerPos={playerPos} playerRot={playerRot} enemiesRef={enemiesRef} />
        </div>
      )}
    </div>
  );
};