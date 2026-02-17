import Phaser from "phaser";
import type { EnemyType } from "../types";
import { PolylinePath } from "../path/PolylinePath";

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export class Enemy extends Phaser.GameObjects.Arc {
  public readonly typeId: string;

  public readonly maxHp: number;
  public hp: number;

  public readonly baseSpeed: number; // px/sec (before effects)
  public readonly reward: number;

  public readonly slowResistance: number; // 0..1

  public isDead = false;

  private dist = 0;
  private readonly path: PolylinePath;

  // slow state
  private slowStrength = 0; // 0..0.9 (speed reduction)
  private slowTimer = 0; // seconds

  constructor(scene: Phaser.Scene, path: PolylinePath, def: EnemyType) {
    super(scene, 0, 0, 10, 0, 360, false, 0x66cc66);

    this.typeId = def.id;

    this.maxHp = def.hp;
    this.hp = def.hp;

    this.baseSpeed = def.speed;
    this.reward = def.reward;

    this.slowResistance = clamp(def.slow_resistance ?? 0, 0, 1);

    this.path = path;

    const start = this.path.getPointAtDistance(0);
    this.setPosition(start.x, start.y);

    scene.add.existing(this);
  }

  /** called by ziggurats/effects */
  applySlow(slowPercent: number, durationSec: number) {
    if (this.isDead) return;

    const sp = clamp(slowPercent, 0, 1);
    const dur = Math.max(0, durationSec);

    const effective = clamp(sp * (1 - this.slowResistance), 0, 0.9);

    // max slow wins
    if (effective > this.slowStrength) this.slowStrength = effective;

    // duration refresh
    if (dur > 0) this.slowTimer = Math.max(this.slowTimer, dur);
  }

  /** dtSec - seconds. true if reached path end */
  step(dtSec: number): boolean {
    if (this.isDead) return false;

    // tick slow timer
    if (this.slowTimer > 0) {
      this.slowTimer -= dtSec;
      if (this.slowTimer <= 0) {
        this.slowTimer = 0;
        this.slowStrength = 0;
      }
    }

    const speedNow = this.baseSpeed * (1 - this.slowStrength);

    this.dist += speedNow * dtSec;
    const p = this.path.getPointAtDistance(this.dist);
    this.setPosition(p.x, p.y);
    return p.done;
  }

  /** true if dead */
  takeDamage(amount: number): boolean {
    if (this.isDead) return true;

    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      return true;
    }
    return false;
  }

  /** debug helper (can be removed later) */
  getDebugSlowStrength(): number {
    return this.slowStrength;
  }
}
