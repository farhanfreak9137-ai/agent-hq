import { AgentModel, Position } from '../types/index.ts';

export interface SpatialBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 2D Spatial Grid Index for high-density agent environments (50–100+ agents).
 * Provides O(1) proximity lookups, collision bounds, and viewport frustum filtering.
 */
export class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, AgentModel[]> = new Map();

  constructor(cellSize: number = 80) {
    this.cellSize = cellSize;
  }

  private getKey(cellX: number, cellY: number): string {
    return `${cellX}:${cellY}`;
  }

  public clear(): void {
    this.grid.clear();
  }

  /**
   * Rebuild the spatial index with current agent positions.
   */
  public rebuild(agents: AgentModel[]): void {
    this.grid.clear();
    for (const agent of agents) {
      const cellX = Math.floor(agent.currentPosition.x / this.cellSize);
      const cellY = Math.floor(agent.currentPosition.y / this.cellSize);
      const key = this.getKey(cellX, cellY);

      let cell = this.grid.get(key);
      if (!cell) {
        cell = [];
        this.grid.set(key, cell);
      }
      cell.push(agent);
    }
  }

  /**
   * Query all agents located within the specified bounding rectangle.
   */
  public queryBounds(bounds: SpatialBounds): AgentModel[] {
    const minCellX = Math.floor(bounds.minX / this.cellSize);
    const maxCellX = Math.floor(bounds.maxX / this.cellSize);
    const minCellY = Math.floor(bounds.minY / this.cellSize);
    const maxCellY = Math.floor(bounds.maxY / this.cellSize);

    const result: AgentModel[] = [];
    const seen = new Set<string>();

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const cell = this.grid.get(this.getKey(cx, cy));
        if (cell) {
          for (const agent of cell) {
            if (!seen.has(agent.id)) {
              if (
                agent.currentPosition.x >= bounds.minX &&
                agent.currentPosition.x <= bounds.maxX &&
                agent.currentPosition.y >= bounds.minY &&
                agent.currentPosition.y <= bounds.maxY
              ) {
                seen.add(agent.id);
                result.push(agent);
              }
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Find nearest agent to a given point within a maximum radius.
   */
  public findNearest(pos: Position, maxRadius: number = 120): { agent: AgentModel; distance: number } | null {
    const bounds: SpatialBounds = {
      minX: pos.x - maxRadius,
      maxX: pos.x + maxRadius,
      minY: pos.y - maxRadius,
      maxY: pos.y + maxRadius,
    };

    const candidates = this.queryBounds(bounds);
    let nearest: AgentModel | null = null;
    let minDistanceSq = maxRadius * maxRadius;

    for (const agent of candidates) {
      const dx = agent.currentPosition.x - pos.x;
      const dy = agent.currentPosition.y - pos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        nearest = agent;
      }
    }

    return nearest ? { agent: nearest, distance: Math.sqrt(minDistanceSq) } : null;
  }
}
