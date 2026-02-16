import Phaser from "phaser";

import "./style.css";
import { BootScene } from "./game/scenes/BootScene";
import { PlayScene } from "./game/scenes/PlayScene";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = "";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 800,
  height: 600,
  backgroundColor: "#0f0f14",
  scene: [BootScene, PlayScene],
  fps: {
    target: 60,
    forceSetTimeOut: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

(window as Window & { __game?: Phaser.Game }).__game = game;
