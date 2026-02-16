import Phaser from "phaser";
import type { LevelConfig, Point, EnemyType, TowerType, TowerTypeDamage } from "../types";
import { PolylinePath } from "../path/PolylinePath";
import { Enemy } from "../entities/Enemy";
import { ArcherTower } from "../entities/ArcherTower";

type PlayInitData = { level: LevelConfig };

export class PlayScene extends Phaser.Scene {
  private level!: LevelConfig;
  private gold = 0;
  private lives = 0;

  private hudText!: Phaser.GameObjects.Text;

  private path!: PolylinePath;

  private enemyTypes = new Map<string, EnemyType>();
  private towerTypes = new Map<string, TowerType>();

  private enemies: Enemy[] = [];
  private towers: ArcherTower[] = [];

  private currentWaveIndex = -1;
  private waveInProgress = false;
  private pendingSpawnGroups = 0;

  private isGameOver = false;
  private isVictory = false;

  private selectedTowerId: string = "archer";

  // no-build зона вокруг дороги (px)
  private readonly noBuildRadius = 24;

  constructor() {
    super("Play");
  }

  init(data: PlayInitData) {
    this.level = data.level;
  }

  create() {
    this.scale.resize(this.level.map.width, this.level.map.height);
    this.cameras.main.setBackgroundColor(0x0f0f14);
    this.path = new PolylinePath(this.level.map.path);

    for (const e of this.level.enemy_types) this.enemyTypes.set(e.id, e);
    for (const t of this.level.tower_types) this.towerTypes.set(t.id, t);

    this.gold = this.level.start_gold;
    this.lives = this.level.lives;

    this.drawPath(this.level.map.path);

    this.hudText = this.add
      .text(12, 10, "", { color: "#e6e6e6", fontSize: "14px" })
      .setDepth(10);

    this.add
      .text(
        12,
        32,
        "1 — Archer | Click — place tower | (no-build on road)",
        { color: "#a8a8a8", fontSize: "12px" }
      )
      .setDepth(10);

    this.setupInputs();

    this.updateHud();

    // чуть больше времени, чтобы успеть поставить башню
    this.time.delayedCall(1500, () => this.startWave(0));
  }

  update(_time: number, deltaMs: number) {
    if (this.isGameOver || this.isVictory) return;

    const dtSec = Math.min(deltaMs, 50) / 1000;

    // towers shoot first (чтобы можно было убивать до входа в базу)
    for (const tower of this.towers) {
      const res = tower.step(dtSec, this.enemies);
      if (res.didShoot && res.target) {
        this.drawShot(tower.x, tower.y, res.target.x, res.target.y);
        if (res.killed) {
          this.handleEnemyKilled(res.target);
        }
      }
    }

    // move enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isDead) continue;

      const reachedEnd = enemy.step(dtSec);
      if (reachedEnd) {
        enemy.destroy();
        this.enemies.splice(i, 1);
        this.lives -= 1;

        if (this.lives <= 0) {
          this.lives = 0;
          this.gameOver();
          return;
        }

        this.updateHud();
        this.checkWaveComplete();
      }
    }
  }

  private setupInputs() {
    const kb = this.input.keyboard;
    if (kb) {
      const key1 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
      key1.on("down", () => {
        this.selectedTowerId = "archer";
        this.flashText("Selected: Archer");
        this.updateHud();
      });
    }

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.isGameOver || this.isVictory) return;
      const x = pointer.worldX;
      const y = pointer.worldY;
      this.tryPlaceTower(x, y);
    });
  }

  private tryPlaceTower(x: number, y: number) {
    // bounds
    if (x < 0 || y < 0 || x > this.level.map.width || y > this.level.map.height) return;

    // запрет на дорогу
    if (this.path.isNearPath(x, y, this.noBuildRadius)) {
      this.floatText(x, y, "Can't build on road");
      return;
    }

    // только Archer на этом шаге
    const t = this.towerTypes.get(this.selectedTowerId);
    if (!t || t.type !== "damage") {
      this.floatText(x, y, "Tower unavailable");
      return;
    }

    const def = t as TowerTypeDamage;

    if (this.gold < def.cost) {
      this.floatText(x, y, "Not enough gold");
      return;
    }

    // списываем стоимость
    this.gold -= def.cost;

    const tower = new ArcherTower(this, x, y, def);
    this.towers.push(tower);

    this.updateHud();
  }

  private startWave(index: number) {
    if (this.isGameOver || this.isVictory) return;
    if (index < 0 || index >= this.level.waves.length) return;

    this.currentWaveIndex = index;
    this.waveInProgress = true;

    const wave = this.level.waves[index];
    this.pendingSpawnGroups = wave.spawns.length;

    this.updateHud();

    for (const spawn of wave.spawns) {
      const def = this.enemyTypes.get(spawn.enemy_type);
      if (!def) {
        this.pendingSpawnGroups -= 1;
        continue;
      }

      const intervalMs = Math.max(0.05, spawn.spawn_interval) * 1000;
      let left = Math.max(0, spawn.count);

      if (left === 0) {
        this.pendingSpawnGroups -= 1;
        continue;
      }

      let event!: Phaser.Time.TimerEvent;

      const doSpawn = () => {
        if (this.isGameOver || this.isVictory) {
          event?.remove(false);
          return;
        }

        this.spawnEnemy(def);
        left -= 1;

        if (left <= 0) {
          event.remove(false);
          this.pendingSpawnGroups -= 1;
          this.checkWaveComplete();
        }
      };

      doSpawn();

      if (left > 0) {
        event = this.time.addEvent({
          delay: intervalMs,
          loop: true,
          callback: doSpawn,
        });
      }
    }

    this.checkWaveComplete();
  }

  private spawnEnemy(def: EnemyType) {
    const e = new Enemy(this, this.path, def);
    this.enemies.push(e);
    this.updateHud();
  }

  private handleEnemyKilled(enemy: Enemy) {
    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0) {
      // награда
      this.gold += enemy.reward;

      enemy.destroy();
      this.enemies.splice(idx, 1);

      this.updateHud();
      this.checkWaveComplete();
    }
  }

  private checkWaveComplete() {
    if (!this.waveInProgress) return;

    const noMoreSpawns = this.pendingSpawnGroups <= 0;
    const anyAlive = this.enemies.some((e) => !e.isDead);

    if (noMoreSpawns && !anyAlive) {
      this.waveInProgress = false;

      const next = this.currentWaveIndex + 1;
      if (next < this.level.waves.length) {
        this.time.delayedCall(900, () => this.startWave(next));
      } else {
        this.victory();
      }
    }
  }

  private updateHud() {
    const waveLabel =
      this.currentWaveIndex >= 0 ? `${this.currentWaveIndex + 1}/${this.level.waves.length}` : "-";

    // tower cost (если выбран archer и есть)
    const sel = this.towerTypes.get(this.selectedTowerId);
    const selCost = sel && sel.type === "damage" ? sel.cost : undefined;

    const text =
      `Level: ${this.level.name} | Gold: ${this.gold} | Lives: ${this.lives} | ` +
      `Wave: ${waveLabel} | Enemies: ${this.enemies.length} | Towers: ${this.towers.length} | ` +
      `Selected: ${this.selectedTowerId}${selCost !== undefined ? ` (${selCost}g)` : ""}`;

    this.hudText.setText(text);
  }

  private gameOver() {
    this.isGameOver = true;
    this.updateHud();
    this.add
      .text(this.level.map.width / 2, this.level.map.height / 2, "GAME OVER", {
        color: "#ffdddd",
        fontSize: "48px",
      })
      .setOrigin(0.5)
      .setDepth(20);
  }

  private victory() {
    this.isVictory = true;
    this.updateHud();
    this.add
      .text(this.level.map.width / 2, this.level.map.height / 2, "VICTORY", {
        color: "#ddffdd",
        fontSize: "48px",
      })
      .setOrigin(0.5)
      .setDepth(20);
  }

  private floatText(x: number, y: number, msg: string) {
    const t = this.add.text(x, y, msg, { color: "#ffffff", fontSize: "12px" }).setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: y - 20,
      alpha: 0,
      duration: 650,
      onComplete: () => t.destroy(),
    });
  }

  private flashText(msg: string) {
    const t = this.add.text(this.level.map.width / 2, 60, msg, { color: "#ffffff", fontSize: "14px" }).setOrigin(0.5);
    this.tweens.add({
      targets: t,
      alpha: 0,
      duration: 650,
      onComplete: () => t.destroy(),
    });
  }

  private drawShot(x1: number, y1: number, x2: number, y2: number) {
    const line = this.add.line(0, 0, x1, y1, x2, y2, 0xffffff).setOrigin(0, 0).setDepth(5);
    line.setLineWidth(2, 2);
    this.time.delayedCall(60, () => line.destroy());
  }

  private drawPath(path: Point[]) {
    const g = this.add.graphics();

    g.lineStyle(18, 0x2a2a33, 1);
    g.beginPath();
    g.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y);
    g.strokePath();

    g.lineStyle(3, 0x6a6a7a, 1);
    g.beginPath();
    g.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y);
    g.strokePath();

    for (const p of path) {
      g.fillStyle(0x9aa0ff, 1);
      g.fillCircle(p.x, p.y, 5);
    }
  }
}
