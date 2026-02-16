import Phaser from "phaser";
import type { TowerTypeDamage } from "../types";
import type { Enemy } from "./Enemy";

export type ShotResult = {
  didShoot: boolean;
  target?: Enemy;
  killed?: boolean;
};

export class ArcherTower extends Phaser.GameObjects.Rectangle {
  public readonly towerId: string;
  public readonly range: number;
  public readonly damage: number;
  public readonly attackSpeed: number; // shots/sec

  private cooldown = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, def: TowerTypeDamage) {
    super(scene, x, y, 20, 20, 0xc9a35a);

    this.towerId = def.id;
    this.range = def.range;
    this.damage = def.damage;
    this.attackSpeed = def.attack_speed;

    this.setOrigin(0.5);
    this.setStrokeStyle(2, 0x2a2a33);

    scene.add.existing(this);
  }

  step(dtSec: number, enemies: Enemy[]): ShotResult {
    this.cooldown -= dtSec;
    if (this.cooldown > 0) return { didShoot: false };

    const r2 = this.range * this.range;

    let best: Enemy | undefined;
    let bestD2 = Number.POSITIVE_INFINITY;

    for (const e of enemies) {
      if (e.isDead) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2 && d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }

    if (!best) return { didShoot: false };

    // shoot now
    this.cooldown = this.attackSpeed > 0 ? 1 / this.attackSpeed : 0.5;

    const killed = best.takeDamage(this.damage);
    return { didShoot: true, target: best, killed };
  }
}
