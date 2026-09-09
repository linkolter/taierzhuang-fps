import { Vector3 } from '@babylonjs/core';
import type { Team } from '../config/gameConfig';
export interface Actor { id: number; team: Team; position: Vector3; health: number; alive: boolean; respawnAt: number; protection: number; crouching?: boolean }
export interface Objective { id: string; x: number; z: number; y?:number; owner: Team | null; progress: number }
