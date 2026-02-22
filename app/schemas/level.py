from typing import List, Literal, Union
from pydantic import BaseModel, Field, field_validator, model_validator


# -------------------------
# Base Structures
# -------------------------

class Point(BaseModel):
    x: int
    y: int


class MapConfig(BaseModel):
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    path: List[Point]

    @field_validator('path')
    @classmethod
    def validate_path_not_empty(cls, value: List[Point]) -> List[Point]:
        if not value:
            raise ValueError('Map path must not be empty')
        return value


# -------------------------
# Enemy
# -------------------------

class EnemyType(BaseModel):
    id: str
    name: str
    hp: int = Field(gt=0)
    speed: float = Field(ge=0)
    reward: int = Field(ge=0)
    slow_resistance: float = Field(ge=0, le=1)


# -------------------------
# Towers
# -------------------------

class DamageTower(BaseModel):
    id: str
    name: str
    damage: int = Field(gt=0)
    attack_speed: float = Field(gt=0)
    range: float = Field(gt=0)
    cost: int = Field(gt=0)
    type: Literal['damage']


class SlowTower(BaseModel):
    id: str
    name: str
    slow_percent: float = Field(gt=0, le=1)
    slow_duration: float = Field(gt=0)
    range: float = Field(gt=0)
    cost: int = Field(gt=0)
    type: Literal['slow']


TowerType = Union[DamageTower, SlowTower]


# -------------------------
# Waves
# -------------------------

class Spawn(BaseModel):
    enemy_type: str
    count: int = Field(gt=0)
    spawn_interval: float = Field(gt=0)


class Wave(BaseModel):
    number: int = Field(gt=0)
    spawns: List[Spawn]

    @field_validator('spawns')
    @classmethod
    def validate_spawns_not_empty(cls, value: List[Spawn]) -> List[Spawn]:
        if not value:
            raise ValueError('Wave must contain at least one spawn')
        return value


# -------------------------
# Root Level Config
# -------------------------

class LevelConfig(BaseModel):
    id: int
    name: str
    start_gold: int = Field(ge=0)
    lives: int = Field(gt=0)
    map: MapConfig
    enemy_types: List[EnemyType]
    tower_types: List[TowerType]
    waves: List[Wave]

    @model_validator(mode='after')
    def validate_references(self) -> 'LevelConfig':
        enemy_ids = {enemy.id for enemy in self.enemy_types}
        tower_ids = {tower.id for tower in self.tower_types}

        # Проверка уникальности
        if len(enemy_ids) != len(self.enemy_types):
            raise ValueError('EnemyType ids must be unique')

        if len(tower_ids) != len(self.tower_types):
            raise ValueError('TowerType ids must be unique')

        # Проверка ссылок из волн
        for wave in self.waves:
            for spawn in wave.spawns:
                if spawn.enemy_type not in enemy_ids:
                    raise ValueError(
                        f'Unknown enemy_type "{spawn.enemy_type}" in wave {wave.number}'
                    )

        return self
