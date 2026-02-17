import Phaser from "phaser";
import type {
  LevelConfig,
  Point,
  EnemyType,
  TowerType,
  TowerTypeDamage,
  TowerTypeSlow,
  GameResultCreate,
} from "../types";
import { PolylinePath } from "../path/PolylinePath";
import { Enemy } from "../entities/Enemy";
import { ArcherTower } from "../entities/ArcherTower";
import { ZigguratTower } from "../entities/ZigguratTower";
import { postGameResult } from "../api";

type PlayInitData = { level: LevelConfig };

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export class PlayScene extends Phaser.Scene {
  private level!: LevelConfig;

  private gold = 0;
  private lives = 0;

  private score = 0;
  private startTimeMs = 0;
  private timePlayedSec = 0;

  private wavesCompleted = 0;

  private hudText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;

  private path!: PolylinePath;

  private enemyTypes = new Map<string, EnemyType>();
  private towerTypes = new Map<string, TowerType>();

  private enemies: Enemy[] = [];
  private archers: ArcherTower[] = [];
  private ziggurats: ZigguratTower[] = [];

  private currentWaveIndex = -1;
  private waveInProgress = false;
  private pendingSpawnGroups = 0;

  private isGameOver = false;
  private isVictory = false;

  private selectedTowerId: string = "archer";

  // no-build зона вокруг дороги (px)
  private readonly noBuildRadius = 24;

  // запрет ставить башни слишком близко друг к другу
  private readonly minTowerSpacing = 26;

  // --- placement preview UI ---
  private previewRect!: Phaser.GameObjects.Rectangle;
  private previewRange!: Phaser.GameObjects.Graphics;
  private previewText!: Phaser.GameObjects.Text;
  private previewVisible = false;

  // --- end overlay ---
  private endOverlay?: Phaser.GameObjects.Container;
  private endOverlayMsg?: Phaser.GameObjects.Text;
  private endOverlayStatus?: Phaser.GameObjects.Text;
  private endOverlaySent = false;

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

    this.score = 0;
    this.wavesCompleted = 0;
    this.startTimeMs = this.time.now;
    this.timePlayedSec = 0;

    this.drawPath(this.level.map.path);

    this.hudText = this.add
      .text(12, 10, "", { color: "#e6e6e6", fontSize: "14px" })
      .setDepth(10);

    this.helpText = this.add
      .text(
        12,
        32,
        "1 — Archer | 2 — Ziggurat | Move — preview | Click — place | (no-build on road)",
        { color: "#a8a8a8", fontSize: "12px" }
      )
      .setDepth(10);
    this.helpText.setVisible(true);

    this.createPlacementPreview();
    this.setupInputs();

    this.updateHud();

    // даём время поставить башни
    this.time.delayedCall(1500, () => this.startWave(0));
  }

  update(_time: number, deltaMs: number) {
    if (this.isGameOver || this.isVictory) {
      this.hidePlacementPreview();
      return;
    }

    const dtSec = Math.min(deltaMs, 50) / 1000;

    // время игры
    this.timePlayedSec = Math.floor((this.time.now - this.startTimeMs) / 1000);

    // 1) зиккураты накладывают slow
    for (const z of this.ziggurats) {
      z.step(dtSec, this.enemies);
    }

    // 2) лучники стреляют
    for (const tower of this.archers) {
      const res = tower.step(dtSec, this.enemies);
      if (res.didShoot && res.target) {
        this.drawShot(tower.x, tower.y, res.target.x, res.target.y);
        if (res.killed) {
          this.handleEnemyKilled(res.target);
        }
      }
    }

    // 3) враги двигаются (уже с учётом slow)
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

    // обновление HUD раз в кадр — нормально для MVP
    this.updateHud();
  }

  // ---------------------------
  // Placement preview UI
  // ---------------------------

  private createPlacementPreview() {
    this.previewRect = this.add
      .rectangle(0, 0, 22, 22, 0xffffff, 0.25)
      .setOrigin(0.5)
      .setDepth(9)
      .setVisible(false);

    this.previewRect.setStrokeStyle(2, 0xffffff, 0.7);

    this.previewRange = this.add.graphics().setDepth(8).setVisible(false);

    this.previewText = this.add
      .text(0, 0, "", { color: "#ffffff", fontSize: "12px" })
      .setDepth(10)
      .setVisible(false)
      .setOrigin(0.5, 1);

    this.previewVisible = false;
  }

  private hidePlacementPreview() {
    if (!this.previewVisible) return;
    this.previewVisible = false;
    this.previewRect.setVisible(false);
    this.previewRange.setVisible(false);
    this.previewRange.clear();
    this.previewText.setVisible(false);
  }

  private updatePlacementPreview(x: number, y: number) {
    const t = this.towerTypes.get(this.selectedTowerId);
    if (!t) {
      this.hidePlacementPreview();
      return;
    }

    const inBounds = x >= 0 && y >= 0 && x <= this.level.map.width && y <= this.level.map.height;
    const onRoad = this.path.isNearPath(x, y, this.noBuildRadius);
    const hasGold = this.gold >= t.cost;
    const spacingOk = this.isSpotFree(x, y);

    let ok = true;
    let reason = "OK";

    if (!inBounds) {
      ok = false;
      reason = "Out of bounds";
    } else if (onRoad) {
      ok = false;
      reason = "Can't build on road";
    } else if (!spacingOk) {
      ok = false;
      reason = "Too close to another tower";
    } else if (!hasGold) {
      ok = false;
      reason = "Not enough gold";
    }

    const fillColor = t.type === "damage" ? 0xc9a35a : 0x7b61ff;
    const size = t.type === "damage" ? 20 : 22;

    this.previewRect.setSize(size, size);
    this.previewRect.setFillStyle(fillColor, ok ? 0.35 : 0.18);
    this.previewRect.setStrokeStyle(2, ok ? 0xffffff : 0xff4444, ok ? 0.75 : 0.9);
    this.previewRect.setPosition(x, y).setVisible(true);

    this.previewRange.clear();
    this.previewRange.setVisible(true);
    this.previewRange.lineStyle(2, ok ? 0xffffff : 0xff4444, ok ? 0.22 : 0.3);
    this.previewRange.strokeCircle(x, y, t.range);

    const name = t.name ?? t.id;
    const text = `${name} (${t.cost}g) — ${reason}`;
    this.previewText.setText(text);
    this.previewText.setPosition(x, y - 14);
    this.previewText.setVisible(true);

    this.previewVisible = true;
  }

  private isSpotFree(x: number, y: number): boolean {
    const r2 = this.minTowerSpacing * this.minTowerSpacing;

    for (const a of this.archers) {
      const dx = a.x - x;
      const dy = a.y - y;
      if (dx * dx + dy * dy < r2) return false;
    }

    for (const z of this.ziggurats) {
      const dx = z.x - x;
      const dy = z.y - y;
      if (dx * dx + dy * dy < r2) return false;
    }

    return true;
  }

  // ---------------------------
  // Inputs
  // ---------------------------

  private setupInputs() {
    const kb = this.input.keyboard;
    if (kb) {
      const key1 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
      key1.on("down", () => {
        this.selectedTowerId = "archer";
        this.flashText("Selected: Archer");
        this.updateHud();
      });

      const key2 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
      key2.on("down", () => {
        this.selectedTowerId = "ziggurat";
        this.flashText("Selected: Ziggurat");
        this.updateHud();
      });
    }

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.isGameOver || this.isVictory) {
        this.hidePlacementPreview();
        return;
      }
      this.updatePlacementPreview(pointer.worldX, pointer.worldY);
    });

    this.input.on("pointerout", () => {
      this.hidePlacementPreview();
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.isGameOver || this.isVictory) return;
      const x = pointer.worldX;
      const y = pointer.worldY;
      this.tryPlaceTower(x, y);
    });
  }

  // ---------------------------
  // Building
  // ---------------------------

  private tryPlaceTower(x: number, y: number) {
    if (x < 0 || y < 0 || x > this.level.map.width || y > this.level.map.height) {
      this.floatText(x, y, "Out of bounds");
      return;
    }

    if (this.path.isNearPath(x, y, this.noBuildRadius)) {
      this.floatText(x, y, "Can't build on road");
      return;
    }

    if (!this.isSpotFree(x, y)) {
      this.floatText(x, y, "Too close to another tower");
      return;
    }

    const t = this.towerTypes.get(this.selectedTowerId);
    if (!t) {
      this.floatText(x, y, "Tower unavailable");
      return;
    }

    const cost = t.cost;

    if (this.gold < cost) {
      this.floatText(x, y, "Not enough gold");
      return;
    }

    this.gold -= cost;

    if (t.type === "damage") {
      const def = t as TowerTypeDamage;
      const tower = new ArcherTower(this, x, y, def);
      this.archers.push(tower);
    } else if (t.type === "slow") {
      const def = t as TowerTypeSlow;
      const tower = new ZigguratTower(this, x, y, def);
      this.ziggurats.push(tower);
    } else {
      this.gold += cost;
      this.floatText(x, y, "Unknown tower type");
      return;
    }

    this.updateHud();

    const p = this.input.activePointer;
    if (p) this.updatePlacementPreview(p.worldX, p.worldY);
  }

  // ---------------------------
  // Waves / enemies
  // ---------------------------

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
  }

  private handleEnemyKilled(enemy: Enemy) {
    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0) {
      this.gold += enemy.reward;
      this.score += enemy.reward; // простая формула score для MVP

      enemy.destroy();
      this.enemies.splice(idx, 1);

      this.checkWaveComplete();

      const p = this.input.activePointer;
      if (p) this.updatePlacementPreview(p.worldX, p.worldY);
    }
  }

  private checkWaveComplete() {
    if (!this.waveInProgress) return;

    const noMoreSpawns = this.pendingSpawnGroups <= 0;
    const anyAlive = this.enemies.some((e) => !e.isDead);

    if (noMoreSpawns && !anyAlive) {
      this.waveInProgress = false;

      // волна пройдена
      this.wavesCompleted = clamp(this.currentWaveIndex + 1, 0, this.level.waves.length);

      const next = this.currentWaveIndex + 1;
      if (next < this.level.waves.length) {
        this.time.delayedCall(900, () => this.startWave(next));
      } else {
        this.victory();
      }
    }
  }

  // ---------------------------
  // HUD / end states
  // ---------------------------

  private updateHud() {
    const waveLabel =
      this.currentWaveIndex >= 0 ? `${this.currentWaveIndex + 1}/${this.level.waves.length}` : "-";

    const sel = this.towerTypes.get(this.selectedTowerId);
    const selCost = sel ? sel.cost : undefined;

    const text =
      `Level: ${this.level.name} | Gold: ${this.gold} | Lives: ${this.lives} | ` +
      `Score: ${this.score} | Time: ${this.timePlayedSec}s | ` +
      `Wave: ${waveLabel} | Enemies: ${this.enemies.length} | ` +
      `Archers: ${this.archers.length} | Ziggurats: ${this.ziggurats.length} | ` +
      `Selected: ${this.selectedTowerId}${selCost !== undefined ? ` (${selCost}g)` : ""}`;

    this.hudText.setText(text);
  }

  private gameOver() {
    this.isGameOver = true;
    this.hidePlacementPreview();
    this.createEndOverlay("GAME OVER");
  }

  private victory() {
    this.isVictory = true;
    this.hidePlacementPreview();
    this.createEndOverlay("VICTORY");
  }

  // ---------------------------
  // End overlay + POST result
  // ---------------------------

  private createEndOverlay(title: string) {
    if (this.endOverlay) this.endOverlay.destroy(true);

    const w = this.level.map.width;
    const h = this.level.map.height;

    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6).setDepth(50);

    const panel = this.add.rectangle(w / 2, h / 2, 420, 240, 0x14141c, 0.95).setDepth(51);
    panel.setStrokeStyle(2, 0xffffff, 0.2);

    const header = this.add
      .text(w / 2, h / 2 - 85, title, { color: "#ffffff", fontSize: "40px" })
      .setOrigin(0.5)
      .setDepth(52);

    const summary = this.add
      .text(
        w / 2,
        h / 2 - 25,
        `Score: ${this.score}\nWaves: ${this.wavesCompleted}/${this.level.waves.length}\nTime: ${this.timePlayedSec}s`,
        { color: "#e6e6e6", fontSize: "16px", align: "center" }
      )
      .setOrigin(0.5)
      .setDepth(52);

    this.endOverlayMsg = this.add
      .text(w / 2, h / 2 + 35, "Choose an action:", { color: "#a8a8a8", fontSize: "14px" })
      .setOrigin(0.5)
      .setDepth(52);

    this.endOverlayStatus = this.add
      .text(w / 2, h / 2 + 60, "", { color: "#ffffff", fontSize: "14px" })
      .setOrigin(0.5)
      .setDepth(52);

    const retryBtn = this.makeButton(w / 2 - 110, h / 2 + 100, "Retry", async () => {
      this.scene.restart({ level: this.level });
    });

    const sendBtn = this.makeButton(w / 2 + 110, h / 2 + 100, "Send result", async () => {
      await this.sendResultOnce();
    });

    this.endOverlay = this.add
      .container(0, 0, [bg, panel, header, summary, this.endOverlayMsg, this.endOverlayStatus, retryBtn, sendBtn])
      .setDepth(60);

    this.endOverlaySent = false;
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void | Promise<void>) {
    const btnBg = this.add.rectangle(x, y, 170, 44, 0x2a2a33, 1).setOrigin(0.5).setDepth(53);
    btnBg.setStrokeStyle(2, 0xffffff, 0.15);

    const btnText = this.add
      .text(x, y, label, { color: "#ffffff", fontSize: "16px" })
      .setOrigin(0.5)
      .setDepth(54);

    const hit = this.add.rectangle(x, y, 170, 44, 0xffffff, 0).setOrigin(0.5).setDepth(55);
    hit.setInteractive({ useHandCursor: true });

    hit.on("pointerover", () => btnBg.setFillStyle(0x3a3a48, 1));
    hit.on("pointerout", () => btnBg.setFillStyle(0x2a2a33, 1));
    hit.on("pointerdown", async () => {
      await onClick();
    });

    return this.add.container(0, 0, [btnBg, btnText, hit]).setDepth(55);
  }

  private getPlayerName(): string {
    const key = "td_player_name";
    const existing = localStorage.getItem(key);
    if (existing && existing.trim().length > 0) return existing.trim();

    const name = (window.prompt("Enter player name:", "Player") || "Player").trim() || "Player";
    localStorage.setItem(key, name);
    return name;
  }

  private async sendResultOnce() {
    if (this.endOverlaySent) {
      this.setEndStatus("Already sent.");
      return;
    }

    this.setEndStatus("Sending...");
    const payload: GameResultCreate = {
      level_id: this.level.id,
      level_version: 1,
      player_name: this.getPlayerName(),
      waves_completed: this.wavesCompleted,
      score: this.score,
      time_played: this.timePlayedSec,
    };

    const resp = await postGameResult(payload);

    if (resp.status === "accepted") {
      this.endOverlaySent = true;
      const rankStr = typeof resp.rank === "number" ? ` Rank: ${resp.rank}` : "";
      this.setEndStatus(`Sent ✅${rankStr}`);
    } else {
      this.setEndStatus(`Error: ${resp.message ?? "Unknown error"}`);
    }
  }

  private setEndStatus(msg: string) {
    if (this.endOverlayStatus) this.endOverlayStatus.setText(msg);
  }

  // ---------------------------
  // Small UI helpers
  // ---------------------------

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
    const t = this.add
      .text(this.level.map.width / 2, 60, msg, { color: "#ffffff", fontSize: "14px" })
      .setOrigin(0.5);
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
