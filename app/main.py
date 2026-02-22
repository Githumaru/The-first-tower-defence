from pathlib import Path

from fastapi import FastAPI

from app.services.level_service import LevelService
from app.api.levels import get_levels_router

app = FastAPI()

level_path = Path(__file__).parent / 'config' / 'levels'
level_service = LevelService(level_path)
level_service.load_levels()

levels_router = get_levels_router(level_service)
app.include_router(levels_router)
