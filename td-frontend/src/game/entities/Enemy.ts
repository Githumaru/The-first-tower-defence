import Phaser from "phaser";
import type { EnemyType } from "../types";
import { PolylinePath } from "../path/PolylinePath";

export class Enemy extends Phaser.GameObjects.Arc {
  public readonly typeId: string;
  public readonly maxHp: number;
  public hp: number;
  public readonly speed: number; // px/sec
  public readonly reward: number;

  public isDead = false;

  private dist = 0;
  private readonly path: PolylinePath;

  constructor(scene: Phaser.Scene, path: PolylinePath, def: EnemyType) {
    super(scene, 0, 0, 10, 0, 360, false, 0x66cc66);

    this.typeId = def.id;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.speed = def.speed;
    this.reward = def.reward;
    this.path = path;

    const start = this.path.getPointAtDistance(0);
    this.setPosition(start.x, start.y);

    scene.add.existing(this);
  }

  /** dtSec — секунды. true если дошёл до конца пути */
  step(dtSec: number): boolean {
    if (this.isDead) return false;
    this.dist += this.speed * dtSec;
    const p = this.path.getPointAtDistance(this.dist);
    this.setPosition(p.x, p.y);
    return p.done;
  }

  /** true если умер */
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
}
