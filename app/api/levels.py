from fastapi import APIRouter, Request, HTTPException
from starlette.responses import Response, JSONResponse

from app.services.level_service import LevelService


def get_levels_router(level_service: LevelService) -> APIRouter:
    router = APIRouter(prefix='/api/v1', tags=['levels'])

    @router.get('/levels/{level_id}')
    async def get_level(level_id: str):
        try:
            level = level_service.get_level(level_id)
        except KeyError:
            raise HTTPException(status_code=404, detail='Level not found')
        return level

    return router

