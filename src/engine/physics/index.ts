import type { Vector2 } from '../utils/Vector2.ts';

/**
 * Rush Engine Physics system contracts and types for rigid body and collision management.
 */
export interface IPhysicsWorld {
  gravity: Vector2;
  step(fixedDeltaTime: number): void;
  clear(): void;
}

export * from './Rigidbody2D.ts';
export * from './BoxCollider.ts';
