import Phaser from "phaser";
import type { TowerTypeSlow } from "../types";
import type { Enemy } from "./Enemy";

export class ZigguratTower extends Phaser.GameObjects.Rectangle {
  public readonly towerId: string;
  public readonly range: number;
  public readonly slowPercent: number;
  public readonly slowDuration: number;

  private rangeGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, def: TowerTypeSlow) {
    super(scene, x, y, 22, 22, 0x7b61ff);

    this.towerId = def.id;
    this.range = def.range;
    this.slowPercent = def.slow_percent;
    this.slowDuration = def.slow_duration;

    this.setOrigin(0.5);
    this.setStrokeStyle(2, 0x2a2a33);

    scene.add.existing(this);

    // debug radius circle
    this.rangeGfx = scene.add.graphics().setDepth(2);
    this.rangeGfx.lineStyle(2, 0x7b61ff, 0.25);
    this.rangeGfx.strokeCircle(this.x, this.y, this.range);
  }

  step(_dtSec: number, enemies: Enemy[]) {
    const r2 = this.range * this.range;

    for (const e of enemies) {
      if (e.isDead) continue;

      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d2 = dx * dx + dy * dy;

      if (d2 <= r2) {
        e.applySlow(this.slowPercent, this.slowDuration);
      }
    }
  }

  override destroy(fromScene?: boolean) {
    this.rangeGfx.destroy();
    super.destroy(fromScene);
  }
}
