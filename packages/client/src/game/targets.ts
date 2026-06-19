import * as THREE from "three";

/** Remote players registered as tap-to-aim targets for the seeker's laser. */
export interface Target {
  object: THREE.Object3D;
  sessionId: string;
}

export const targets: Target[] = [];

export function registerTarget(object: THREE.Object3D | null, sessionId: string): void {
  if (object) targets.push({ object, sessionId });
}

export function unregisterTarget(object: THREE.Object3D | null): void {
  if (!object) return;
  const i = targets.findIndex((t) => t.object === object);
  if (i >= 0) targets.splice(i, 1);
}

/** Walk up from a hit mesh to find which registered player it belongs to. */
export function ownerSessionId(hit: THREE.Object3D | null): string | undefined {
  let o: THREE.Object3D | null = hit;
  while (o) {
    const t = targets.find((x) => x.object === o);
    if (t) return t.sessionId;
    o = o.parent;
  }
  return undefined;
}
