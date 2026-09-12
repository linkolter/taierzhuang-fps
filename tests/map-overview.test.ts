import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera, FreeCamera, Matrix, MeshBuilder, NullEngine, Scene, Vector3, Viewport } from '@babylonjs/core';
import { fitOverviewCamera, measureMapBounds } from '../src/dev/MapOverview';
import { World } from '../src/map/World';
import { OBJECTIVES, RAMPS } from '../src/map/MapLayout';

test('actual static map fits landscape, ultrawide and portrait without clipping; north stays up', () => {
  const engine = new NullEngine(), scene = new Scene(engine), world = new World(scene);
  try {
    world.buildVillage();
    const meshes = [...scene.meshes], bounds = measureMapBounds(meshes);
    assert.ok(bounds.max.x - bounds.min.x >= 180);
    assert.ok(bounds.max.z - bounds.min.z >= 90);
    const camera = new FreeCamera('overview-test', Vector3.Zero(), scene);
    const graph = world.tactical, obstacles = world.obstacles.length;
    for (const aspect of [16 / 9, 32 / 9, 1, 9 / 16]) {
      fitOverviewCamera(camera, bounds, aspect);
      assert.equal(camera.mode, Camera.ORTHOGRAPHIC_CAMERA);
      const transform = camera.getViewMatrix(true).multiply(camera.getProjectionMatrix(true));
      const project = (p: Vector3) => Vector3.Project(p, Matrix.Identity(), transform, new Viewport(0, 0, 1000, 1000));
      for (const mesh of meshes) for (const corner of mesh.getBoundingInfo().boundingBox.vectorsWorld) {
        const p = project(corner);
        assert.ok(p.x > 0 && p.x < 1000 && p.y > 0 && p.y < 1000 && p.z > 0 && p.z < 1, `${aspect}: ${mesh.name} ${p}`);
      }
      for (const [x, z] of [...OBJECTIVES.map(p => [p.x, p.z]), [-82, 0], [82, 0], ...RAMPS.map(r => r.lip)]) {
        const p = project(new Vector3(x, 0, z));
        assert.ok(p.x > 0 && p.x < 1000 && p.y > 0 && p.y < 1000);
      }
      const center = bounds.min.add(bounds.max).scale(.5), p = project(center);
      assert.ok(Math.abs(p.x - 500) < 1e-3 && Math.abs(p.y - 500) < 1e-3);
      assert.ok(project(center.add(new Vector3(0, 0, 1))).y < p.y);
      assert.ok(project(center.add(new Vector3(1, 0, 0))).x > p.x);
      assert.ok(Math.abs(project(center.add(new Vector3(0, 10, 0))).y - p.y) < 1e-3);
    }
    assert.equal(world.tactical, graph);
    assert.equal(world.obstacles.length, obstacles);
    assert.deepEqual(scene.meshes, meshes);
  } finally { scene.dispose(); engine.dispose(); }
});

test('bounds include transformed geometry and fitting adapts to a different map size and center', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const mesh = MeshBuilder.CreateBox('static-map', { width: 300, height: 40, depth: 120 }, scene);
    mesh.position.set(125, 12, -73);
    mesh.rotation.y = .3;
    const bounds = measureMapBounds([mesh]);
    MeshBuilder.CreateBox('unrelated-dynamic-effect', { size: 1000 }, scene);
    assert.deepEqual(measureMapBounds([mesh]), bounds);
    const camera = new FreeCamera('overview-test', Vector3.Zero(), scene);
    fitOverviewCamera(camera, bounds, 2);
    assert.ok(Math.abs(camera.position.x - 125) < 1e-4);
    assert.ok(Math.abs(camera.position.z + 73) < 1e-4);
    assert.ok(camera.position.y > bounds.max.y);
    assert.ok(camera.orthoRight! * 2 > bounds.max.x - bounds.min.x);
    assert.ok(camera.orthoTop! * 2 > bounds.max.z - bounds.min.z);
  } finally { scene.dispose(); engine.dispose(); }
});
