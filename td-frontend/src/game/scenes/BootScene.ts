import Phaser from "phaser";

import { loadLevel } from "../loadLevel";
import type { LevelConfig } from "../types";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  async create(): Promise<void> {
    const level: LevelConfig = await loadLevel(1);
    this.scene.start("Play", { level });
  }
}
