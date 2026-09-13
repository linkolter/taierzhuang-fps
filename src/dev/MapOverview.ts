import { Camera, FreeCamera, Vector3, type AbstractMesh } from '@babylonjs/core';
import type { Game } from '../game/Game';
import { CONFIG } from '../config/gameConfig';
import { MAP, RAMPS, SURFACE_CONNECTIONS } from '../map/MapLayout';

export interface MapBounds { min: Vector3; max: Vector3 }

/** Capture only the built static map, before actors, weapons or debug meshes exist. */
export function measureMapBounds(meshes: readonly AbstractMesh[]): MapBounds {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const mesh of meshes) {
    if (mesh.isDisposed() || !mesh.getTotalVertices()) continue;
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    min.minimizeInPlace(box.minimumWorld);
    max.maximizeInPlace(box.maximumWorld);
  }
  if (![...min.asArray(), ...max.asArray()].every(Number.isFinite)) throw new Error('Map has no static bounds');
  return { min, max };
}

export function fitOverviewCamera(camera: FreeCamera, bounds: MapBounds, aspect: number) {
  const size = bounds.max.subtract(bounds.min);
  const center = bounds.min.add(bounds.max).scale(.5);
  const padding = Math.max(size.x, size.z) * .04;
  const halfHeight = Math.max(size.z / 2 + padding, (size.x / 2 + padding) / aspect);
  const clearance = Math.max(size.x, size.y, size.z, 1);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.position.set(center.x, bounds.max.y + clearance, center.z);
  // +Z is north. Avoid setTarget's vertical-look epsilon and keep east on the right.
  camera.rotation.set(Math.PI / 2, 0, 0);
  camera.upVector.set(0, 0, 1);
  camera.minZ = clearance * .001;
  camera.maxZ = clearance + size.y + padding;
  camera.orthoTop = halfHeight;
  camera.orthoBottom = -halfHeight;
  camera.orthoRight = halfHeight * aspect;
  camera.orthoLeft = -halfHeight * aspect;
}

export class MapOverview {
  readonly camera: FreeCamera;
  readonly bounds: MapBounds;
  active = false;
  private overlay = document.createElement('div');
  private events = new AbortController();
  private markers: { element: HTMLElement; x: number; z: number }[] = [];
  private saved?: {
    camera: Camera | null; hudHidden: boolean; menuHidden: boolean; weaponEnabled: boolean;
    paused: boolean; locked: boolean; fog: boolean; lights: number[];
  };

  constructor(private game: Game, staticMeshes: readonly AbstractMesh[]) {
    this.bounds = measureMapBounds(staticMeshes);
    this.camera = new FreeCamera('map-overview-camera', Vector3.Zero(), game.scene);
    this.camera.inputs.clear();
    this.overlay.id = 'map-overview';
    this.overlay.hidden = true;
    this.overlay.innerHTML = '<div class="map-overview-help">COMBAT MAP V3 · 鲁南村镇　|　F8 返回第一人称</div><div class="map-overview-north">↑ N 北</div><div class="map-overview-legend">高地 +2～+5 m　 /　 村心 0 m　 /　 南沟 −1～−2 m　 ·　 对局暂停</div>';
    for (const point of game.capture.points) this.addMarker(`${point.id} · ${point.name}`, point.x, point.z, 'point');
    this.addMarker('中国方出生区', CONFIG.player.spawnX, 0, 'cn');
    this.addMarker('日军出生区', MAP.spawnX, 0, 'jp');
    for (const ramp of RAMPS) this.addMarker(`${ramp.id} · ${ramp.role}`, ...ramp.lip, ramp.id === 'central' ? 'tunnel basement' : 'tunnel');
    for (const gate of SURFACE_CONNECTIONS) this.addMarker(gate.z > 0 ? '① 高地转线口' : '② 南沟转线口', gate.x, gate.z, 'gate');
    document.body.append(this.overlay);
    document.addEventListener('keydown', event => {
      if (event.code !== 'F8') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) this.active ? this.leave() : this.enter();
    }, { capture: true, signal: this.events.signal });
    game.engine.onResizeObservable.add(this.resize);
  }

  private addMarker(text: string, x: number, z: number, kind: string) {
    const element = document.createElement('div');
    element.className = `map-overview-marker ${kind}`;
    element.textContent = text;
    this.overlay.append(element);
    this.markers.push({ element, x, z });
  }

  private resize = () => {
    if (!this.active) return;
    const engine = this.game.engine;
    fitOverviewCamera(this.camera, this.bounds, engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()));
    for (const { element, x, z } of this.markers) {
      element.style.left = `${50 + (x - this.camera.position.x) / this.camera.orthoRight! * 50}%`;
      element.style.top = `${50 - (z - this.camera.position.z) / this.camera.orthoTop! * 50}%`;
    }
  };

  enter() {
    if (this.active) return;
    const g = this.game;
    this.saved = {
      camera: g.scene.activeCamera, hudHidden: g.hud.root.hidden, menuHidden: g.hud.menu.hidden,
      weaponEnabled: g.weapon.root.isEnabled(), paused: g.paused, locked: g.player.locked,
      fog: g.scene.fogEnabled, lights: [g.ambient.intensity, g.sun.intensity, g.lamp.intensity],
    };
    this.active = true;
    g.paused = true;
    g.audio.pause(true);
    g.player.setInputBlocked(true);
    g.weapon.root.setEnabled(false);
    g.hud.root.hidden = true;
    // FPS distance fog and underground lighting otherwise obscure the whole map.
    g.scene.fogEnabled = false;
    g.ambient.intensity = .8;
    g.sun.intensity = .9;
    g.lamp.intensity = 0;
    g.scene.activeCamera = this.camera;
    this.overlay.hidden = false;
    this.resize();
  }

  leave(restoreLock = true) {
    if (!this.active || !this.saved) return;
    const g = this.game, saved = this.saved;
    this.active = false;
    this.overlay.hidden = true;
    g.scene.activeCamera = saved.camera;
    g.scene.fogEnabled = saved.fog;
    [g.ambient.intensity, g.sun.intensity, g.lamp.intensity] = saved.lights;
    g.weapon.root.setEnabled(saved.weaponEnabled);
    g.hud.root.hidden = saved.hudHidden;
    g.hud.menu.hidden = saved.menuHidden;
    g.player.setInputBlocked(false);
    g.paused = saved.locked ? true : saved.paused;
    g.audio.pause(g.paused);
    this.saved = undefined;
    if (restoreLock && saved.locked) void g.player.lock();
  }

  dispose() {
    this.events.abort();
    this.game.engine.onResizeObservable.removeCallback(this.resize);
    this.leave(false);
    this.overlay.remove();
    this.camera.dispose();
  }
}
