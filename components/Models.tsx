import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh } from 'three';

export const FighterJet = () => {
  return (
    <group>
      {/* Fuselage - Rotated to point along -Z */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 4, 8]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Cockpit */}
      <mesh position={[0, 0.5, 0.5]}>
        <boxGeometry args={[0.4, 0.4, 1.5]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* Wings */}
      <mesh position={[0, 0, 1]}>
        <boxGeometry args={[4, 0.1, 1.5]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      {/* Tail */}
      <mesh position={[0, 0.5, 2]}>
        <boxGeometry args={[0.1, 1, 1]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      <mesh position={[0, 0, 2]}>
        <boxGeometry args={[2, 0.1, 1]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      {/* Engine Glow */}
      <mesh position={[0, 0, 2.1]}>
        <sphereGeometry args={[0.3]} />
        <meshBasicMaterial color="orange" />
      </mesh>
    </group>
  );
};

export const PropellerPlane = () => {
  const propRef = useRef<Mesh>(null);
  
  useFrame((_, delta) => {
    if (propRef.current) {
      propRef.current.rotation.z += delta * 15;
    }
  });

  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.2, 3, 8]} />
        <meshStandardMaterial color="#166534" roughness={0.8} />
      </mesh>
      {/* Wings */}
      <mesh position={[0, 0, 0.5]}>
        <boxGeometry args={[4.5, 0.1, 1]} />
        <meshStandardMaterial color="#14532d" />
      </mesh>
      {/* Tail */}
      <mesh position={[0, 0, 2]}>
        <boxGeometry args={[1.5, 0.1, 0.8]} />
        <meshStandardMaterial color="#14532d" />
      </mesh>
      <mesh position={[0, 0.4, 2]}>
        <boxGeometry args={[0.1, 0.8, 0.6]} />
        <meshStandardMaterial color="#14532d" />
      </mesh>
      {/* Propeller */}
      <group position={[0, 0, -1.2]}>
        <mesh ref={propRef}>
          <boxGeometry args={[2.5, 0.1, 0.1]} />
          <meshStandardMaterial color="#444" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.2]} />
          <meshStandardMaterial color="#888" />
        </mesh>
      </group>
    </group>
  );
};

export const EnemyPlane = () => {
    const propRef = useRef<Mesh>(null);
    
    useFrame((_, delta) => {
      if (propRef.current) {
        propRef.current.rotation.z += delta * 15;
      }
    });
  
    return (
      <group>
        {/* Body */}
        <mesh position={[0, 0, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.3, 3.5, 8]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.5} />
        </mesh>
        {/* Wings */}
        <mesh position={[0, 0, 0.5]}>
          <boxGeometry args={[5, 0.1, 1.2]} />
          <meshStandardMaterial color="#991b1b" polygonOffset polygonOffsetFactor={1} />
        </mesh>
        {/* Tail */}
        <mesh position={[0, 0, 2]}>
          <boxGeometry args={[1.8, 0.1, 1]} />
          <meshStandardMaterial color="#991b1b" />
        </mesh>
        <mesh position={[0, 0.5, 2]}>
          <boxGeometry args={[0.1, 1, 0.8]} />
          <meshStandardMaterial color="#991b1b" />
        </mesh>
        {/* Propeller */}
        <group position={[0, 0, -1.3]}>
          <mesh ref={propRef}>
            <boxGeometry args={[2.8, 0.1, 0.15]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.25]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
        {/* Cockpit - Dark */}
        <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.5, 0.4, 1]} />
            <meshStandardMaterial color="#000" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>
    );
  };

export const Helicopter = () => {
  const rotorRef = useRef<Group>(null);
  const tailRotorRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (rotorRef.current) rotorRef.current.rotation.y += delta * 20;
    if (tailRotorRef.current) tailRotorRef.current.rotation.x += delta * 20;
  });

  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0, 0.5]}>
        <boxGeometry args={[1, 1.2, 2.5]} />
        <meshStandardMaterial color="#78350f" roughness={0.7} />
      </mesh>
      {/* Tail Boom */}
      <mesh position={[0, 0.2, 2.5]}>
        <boxGeometry args={[0.3, 0.3, 2.5]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      {/* Main Rotor */}
      <group position={[0, 0.8, 0.5]} ref={rotorRef}>
        <mesh>
          <boxGeometry args={[6, 0.05, 0.3]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[6, 0.05, 0.3]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.4]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      </group>
      {/* Tail Rotor */}
      <group position={[0.2, 0.2, 3.7]} rotation={[0, 0, Math.PI / 2]} ref={tailRotorRef}>
        <mesh>
          <boxGeometry args={[1.5, 0.05, 0.1]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
      {/* Skids */}
      <mesh position={[0.5, -0.7, 0.5]}>
        <boxGeometry args={[0.1, 0.1, 2]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[-0.5, -0.7, 0.5]}>
        <boxGeometry args={[0.1, 0.1, 2]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  );
};
