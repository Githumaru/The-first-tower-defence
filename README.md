# The First Tower Defence

A Phaser + TypeScript tower defense MVP with:
- Archer (damage) and Ziggurat (slow) towers
- Wave-based enemy spawning
- Live HUD stats: gold, lives, score, time, wave, enemies, tower counts
- End-game overlay (`VICTORY` / `GAME OVER`) with:
  - `Retry`
  - `Send result` (`POST /api/v1/game-results`)

## Tech stack
- Frontend: Phaser 3, TypeScript, Vite
- Package manager: npm

## Project structure
- `td-frontend/` - game frontend
- `td-frontend/src/game/scenes/PlayScene.ts` - main gameplay scene
- `td-frontend/src/game/loadLevel.ts` - level loading (`GET /api/v1/levels/:id` with fallback)
- `td-frontend/src/game/api.ts` - game result API client (`POST /api/v1/game-results`)

## Run locally
```bash
cd td-frontend
npm install
npm run dev
```

Build for production:
```bash
cd td-frontend
npm run build
```

## Controls
- `1` - select Archer tower
- `2` - select Ziggurat tower
- Mouse move - placement preview (range + validation)
- Mouse click - place selected tower

## Current gameplay flow
1. Boot scene loads level `1` from backend (`/api/v1/levels/1`).
2. If backend level is unavailable/invalid, frontend uses `DEFAULT_LEVEL`.
3. Player places towers.
4. Waves start automatically after a short delay.
5. On finish:
   - `VICTORY` when all waves are cleared
   - `GAME OVER` when lives reach `0`
6. End overlay allows retry and result submission.

## Backend API contract (used by frontend)

### `GET /api/v1/levels/:id`
- Expected: level config shape compatible with `LevelConfig`
- Fallback: frontend uses local `DEFAULT_LEVEL` on error or invalid payload

### `POST /api/v1/game-results`
Request body (`GameResultCreate`):
```json
{
  "level_id": 1,
  "level_version": 1,
  "player_name": "Player",
  "waves_completed": 2,
  "score": 130,
  "time_played": 47
}
```

Expected response (`GameResultResponse`):
```json
{
  "status": "accepted",
  "rank": 5,
  "message": "optional"
}
```

Notes:
- Frontend handles network/backend failures safely and shows error text in overlay.
- Frontend prevents duplicate send after successful submission.

## Manual smoke check
1. Start game and finish with either victory or game over.
2. Confirm end overlay appears with `Retry` and `Send result`.
3. Click `Send result`:
   - success: `Sent` status appears
   - backend off: `Error: ...` appears (no crash)
4. Click `Retry` and confirm level restarts.
