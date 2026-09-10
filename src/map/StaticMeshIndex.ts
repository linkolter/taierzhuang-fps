import { Mesh, Ray, type PickingInfo } from '@babylonjs/core';

/** Conservative X/Z broad phase over the existing merged/chunked solid meshes. */
export class StaticMeshIndex {
  private cells = new Map<string, Mesh[]>();
  private candidates = new Set<Mesh>();
  queries = 0; candidateCount = 0;
  constructor(meshes: Mesh[], private size = 15) { for (const mesh of meshes) this.add(mesh); }
  add(mesh: Mesh) {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    for (let x = Math.floor(box.minimumWorld.x / this.size); x <= Math.floor(box.maximumWorld.x / this.size); x++) {
      for (let z = Math.floor(box.minimumWorld.z / this.size); z <= Math.floor(box.maximumWorld.z / this.size); z++) {
        const key = `${x}:${z}`, list = this.cells.get(key) ?? [];
        list.push(mesh); this.cells.set(key, list);
      }
    }
  }
  pick(ray: Ray): PickingInfo | null {
    this.queries++; this.candidates.clear();
    // Half-cell samples plus adjacent cells conservatively cover every crossed cell,
    // including vertical rays and rays exactly on cell boundaries.
    const steps = Math.max(1, Math.ceil(Math.hypot(ray.direction.x, ray.direction.z) * ray.length / (this.size / 2)));
    for (let i = 0; i <= steps; i++) {
      const distance = ray.length * i / steps;
      const x = Math.floor((ray.origin.x + ray.direction.x * distance) / this.size);
      const z = Math.floor((ray.origin.z + ray.direction.z * distance) / this.size);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        for (const mesh of this.cells.get(`${x + dx}:${z + dz}`) ?? []) this.candidates.add(mesh);
      }
    }
    let closest: PickingInfo | null = null;
    for (const mesh of this.candidates) {
      if (mesh.isDisposed() || !mesh.isEnabled() || !mesh.isPickable) continue;
      const box = mesh.getBoundingInfo().boundingBox;
      if (!ray.intersectsBoxMinMax(box.minimumWorld, box.maximumWorld)) continue;
      this.candidateCount++;
      const hit = ray.intersectsMesh(mesh, false);
      if (hit.hit && hit.distance <= ray.length && (!closest || hit.distance < closest.distance)) closest = hit;
    }
    return closest;
  }
}
