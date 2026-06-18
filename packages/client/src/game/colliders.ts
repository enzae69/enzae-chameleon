import * as THREE from "three";

/**
 * Objects the third-person camera raycasts against so it pulls in when a wall or
 * building would block the view. Arena meshes register here on mount.
 */
export const colliders: THREE.Object3D[] = [];

export function registerCollider(o: THREE.Object3D | null): void {
  if (o && !colliders.includes(o)) colliders.push(o);
}

export function unregisterCollider(o: THREE.Object3D | null): void {
  if (!o) return;
  const i = colliders.indexOf(o);
  if (i >= 0) colliders.splice(i, 1);
}
