import type { GameResultCreate, GameResultResponse } from "./types";

export async function postGameResult(payload: GameResultCreate): Promise<GameResultResponse> {
  try {
    const res = await fetch("/api/v1/game-results", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      return {
        status: "error",
        message: data?.message ?? `HTTP ${res.status}: ${text || "Bad response"}`,
      };
    }

    // ожидаем что бэк вернёт { status: "accepted", rank: number }
    if (data && typeof data === "object" && typeof data.status === "string") {
      return {
        status: data.status,
        rank: typeof data.rank === "number" ? data.rank : undefined,
        message: typeof data.message === "string" ? data.message : undefined,
      };
    }

    return { status: "accepted" };
  } catch (e: any) {
    return { status: "error", message: e?.message ?? "Network error" };
  }
}
