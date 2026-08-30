export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const GRID_COLS = 2;
export const GRID_ROWS = 4;
export const GRID_ORIGIN = { x: 78, y: 168 };
export const CELL = { w: 88, h: 112 };
export const WALL_X = 305;
export const WALL_BAR = { x: 332, y: 168, w: 20, h: 380 };

export type GridCell = {
  id: number;
  col: number;
  row: number;
  x: number;
  y: number;
};

export function createGrid(): GridCell[] {
  const cells: GridCell[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      cells.push({
        id: cells.length,
        col,
        row,
        x: GRID_ORIGIN.x + col * CELL.w + CELL.w / 2,
        y: GRID_ORIGIN.y + row * CELL.h + CELL.h / 2,
      });
    }
  }
  return cells;
}

export function cellCenter(id: number): { x: number; y: number } {
  const cell = createGrid()[id];
  return { x: cell.x, y: cell.y };
}
