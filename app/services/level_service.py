import json
import os

from app.schemas.level import LevelConfig


class LevelService:
    def __init__(self, levels_path) -> None:
        self._levels_path = levels_path
        self._levels = []

    def load_levels(self) -> None:
        if not self._levels_path.exists():
            raise RuntimeError(f'Levels directory not found: {self._levels_path}')

        self._levels = list(map(lambda x: x[:-5], os.listdir(self._levels_path)))

        if not self._levels:
            raise RuntimeError('No levels were loaded')

    def get_level(self, level_id: str) -> LevelConfig:
        if level_id not in self._levels:
            raise KeyError

        with open(f'{self._levels_path}\\{level_id}.json', 'r', encoding='utf-8') as file:
            level = json.load(file)

        return level
