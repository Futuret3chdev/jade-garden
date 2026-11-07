export const TILE_W = 68;
export const TILE_H = 84;
export const STEP_X = 70;
export const STEP_Y = 86;
export const ORIGIN_X = 36;
export const ORIGIN_Y = 42;
export const Z_SHIFT_X = 8;
export const Z_SHIFT_Y = 12;

export const BOARD_W = ORIGIN_X + 9 * STEP_X + TILE_W + Z_SHIFT_X * 2 + 28;
export const BOARD_H = ORIGIN_Y + 7 * STEP_Y + TILE_H + 36;

export function tilePosition(t: { x: number; y: number; z: number }) {
  return {
    left: ORIGIN_X + t.x * STEP_X + t.z * Z_SHIFT_X,
    top: ORIGIN_Y + t.y * STEP_Y - t.z * Z_SHIFT_Y,
  };
}
