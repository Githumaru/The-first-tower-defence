import type { LevelConfig } from "./types";

export const DEFAULT_LEVEL: LevelConfig = {
  id: 1,
  name: "Green Plains",
  start_gold: 100,
  lives: 10,
  map: {
    width: 800,
    height: 600,
    path: [
      { x: 0, y: 250 },
      { x: 200, y: 250 },
      { x: 200, y: 100 },
      { x: 600, y: 100 },
      { x: 600, y: 400 },
      { x: 800, y: 400 },
    ],
  },
  enemy_types: [
    {
      id: "goblin",
      name: "Goblin",
      hp: 100,
      speed: 60,
      reward: 10,
      slow_resistance: 0.0,
    },
  ],
  tower_types: [
    {
      id: "archer",
      name: "Archer Tower",
      type: "damage",
      damage: 25,
      attack_speed: 1.0,
      range: 120,
      cost: 50,
    },
    {
      id: "ziggurat",
      name: "Ziggurat of Slow",
      type: "slow",
      slow_percent: 0.4,
      slow_duration: 2.0,
      range: 150,
      cost: 70,
    },
  ],
  waves: [
    {
      number: 1,
      spawns: [{ enemy_type: "goblin", count: 5, spawn_interval: 1.5 }],
    },
    {
      number: 2,
      spawns: [{ enemy_type: "goblin", count: 8, spawn_interval: 1.2 }],
    },
  ],
};
