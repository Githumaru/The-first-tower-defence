export type Point = { x: number; y: number };

export type EnemyType = {
  id: string;
  name: string;
  hp: number;
  speed: number; // px/sec
  reward: number;
  slow_resistance: number; // 0..1
};

export type TowerTypeDamage = {
  id: string;
  name: string;
  type: "damage";
  damage: number;
  attack_speed: number; // shots/sec
  range: number; // px
  cost: number;
};

export type TowerTypeSlow = {
  id: string;
  name: string;
  type: "slow";
  slow_percent: number; // 0..1
  slow_duration: number; // sec
  range: number; // px
  cost: number;
};

export type TowerType = TowerTypeDamage | TowerTypeSlow;

export type WaveSpawn = {
  enemy_type: string;
  count: number;
  spawn_interval: number; // sec
};

export type Wave = {
  number: number;
  spawns: WaveSpawn[];
};

export type LevelConfig = {
  id: number;
  name: string;
  start_gold: number;
  lives: number;
  map: {
    width: number;
    height: number;
    path: Point[];
  };
  enemy_types: EnemyType[];
  tower_types: TowerType[];
  waves: Wave[];
};
