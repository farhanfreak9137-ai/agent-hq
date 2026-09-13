import { Position } from '../types/index.ts';
import { ROOMS_DATA } from '../data/rooms.ts';

export interface Waypoint {
  id: string;
  x: number;
  y: number;
  connections: string[];
}

export class OfficePathfinding {
  private waypoints: Map<string, Waypoint> = new Map();

  constructor() {
    this.buildWaypointGraph();
  }

  private buildWaypointGraph(): void {
    // Corridors & Doorways Graph
    const points: Waypoint[] = [
      // Left Hallway (x: 510)
      { id: 'hall_tl', x: 510, y: 175, connections: ['hall_ml', 'door_coding', 'hall_tc'] },
      { id: 'hall_ml', x: 510, y: 340, connections: ['hall_tl', 'hall_tc', 'hall_cl', 'door_design'] },
      { id: 'hall_cl', x: 510, y: 505, connections: ['hall_ml', 'hall_bl', 'door_design', 'hall_mc'] },
      { id: 'hall_bl', x: 510, y: 670, connections: ['hall_cl', 'hall_bc', 'door_research', 'hall_bbl'] },
      { id: 'hall_bbl', x: 510, y: 835, connections: ['hall_bl', 'door_research'] },

      // Center Hallway (x: 760)
      { id: 'door_command', x: 760, y: 300, connections: ['hall_tc'] },
      { id: 'hall_tc', x: 760, y: 340, connections: ['door_command', 'hall_tl', 'hall_tr', 'door_common_n'] },
      { id: 'door_common_n', x: 760, y: 380, connections: ['hall_tc', 'common_inside'] },
      { id: 'common_inside', x: 760, y: 505, connections: ['door_common_n', 'door_common_s'] },
      { id: 'door_common_s', x: 760, y: 630, connections: ['common_inside', 'hall_mc'] },
      { id: 'hall_mc', x: 760, y: 670, connections: ['door_common_s', 'hall_cl', 'hall_cr', 'door_core'] },
      { id: 'door_core', x: 760, y: 710, connections: ['hall_mc', 'core_inside'] },
      { id: 'core_inside', x: 760, y: 835, connections: ['door_core'] },
      { id: 'hall_bc', x: 760, y: 970, connections: ['hall_bl', 'hall_br'] },

      // Right Hallway (x: 1010)
      { id: 'hall_tr', x: 1010, y: 175, connections: ['hall_mr', 'door_security', 'hall_tc'] },
      { id: 'hall_mr', x: 1010, y: 340, connections: ['hall_tr', 'hall_tc', 'hall_cr', 'door_testing'] },
      { id: 'hall_cr', x: 1010, y: 505, connections: ['hall_mr', 'hall_br', 'door_testing', 'hall_mc'] },
      { id: 'hall_br', x: 1010, y: 670, connections: ['hall_cr', 'hall_bc', 'door_review', 'hall_bbr'] },
      { id: 'hall_bbr', x: 1010, y: 835, connections: ['hall_br', 'door_review'] },

      // Room Doors
      { id: 'door_coding', x: 480, y: 175, connections: ['hall_tl'] },
      { id: 'door_security', x: 1040, y: 175, connections: ['hall_tr'] },
      { id: 'door_design', x: 480, y: 505, connections: ['hall_cl'] },
      { id: 'door_testing', x: 1040, y: 505, connections: ['hall_cr'] },
      { id: 'door_research', x: 480, y: 835, connections: ['hall_bbl'] },
      { id: 'door_review', x: 1040, y: 835, connections: ['hall_bbr'] },
    ];

    points.forEach((p) => this.waypoints.set(p.id, p));

    // Ensure bidirectional
    points.forEach((p) => {
      p.connections.forEach((connId) => {
        const other = this.waypoints.get(connId);
        if (other && !other.connections.includes(p.id)) {
          other.connections.push(p.id);
        }
      });
    });
  }

  public findRoom(pos: Position): string | null {
    for (const room of ROOMS_DATA) {
      if (
        pos.x >= room.x &&
        pos.x <= room.x + room.width &&
        pos.y >= room.y &&
        pos.y <= room.y + room.height
      ) {
        return room.id;
      }
    }
    return null;
  }

  public getRoomDoorway(roomId: string): Position | null {
    const r = ROOMS_DATA.find((room) => room.id === roomId);
    return r ? { ...r.doorway } : null;
  }

  private getClosestWaypoint(pos: Position): Waypoint {
    let closest: Waypoint = Array.from(this.waypoints.values())[0];
    let minDist = Infinity;

    this.waypoints.forEach((wp) => {
      const d = Math.hypot(wp.x - pos.x, wp.y - pos.y);
      if (d < minDist) {
        minDist = d;
        closest = wp;
      }
    });

    return closest;
  }

  /**
   * Breadth-First-Search / Dijkstra shortest path on waypoint graph.
   */
  public findPath(start: Position, target: Position): Position[] {
    const startRoom = this.findRoom(start);
    const targetRoom = this.findRoom(target);

    // If both in the same room and no major distance, walk directly
    if (startRoom && targetRoom && startRoom === targetRoom) {
      return [{ ...start }, { ...target }];
    }

    // Connect start to nearest waypoint
    const startWp = this.getClosestWaypoint(start);
    const targetWp = this.getClosestWaypoint(target);

    if (startWp.id === targetWp.id) {
      return [{ ...start }, { x: startWp.x, y: startWp.y }, { ...target }];
    }

    // BFS
    const queue: { wpId: string; path: string[] }[] = [{ wpId: startWp.id, path: [startWp.id] }];
    const visited = new Set<string>([startWp.id]);
    let foundPath: string[] | null = null;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.wpId === targetWp.id) {
        foundPath = current.path;
        break;
      }

      const wp = this.waypoints.get(current.wpId);
      if (!wp) continue;

      for (const nextId of wp.connections) {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push({
            wpId: nextId,
            path: [...current.path, nextId],
          });
        }
      }
    }

    const result: Position[] = [{ ...start }];

    if (foundPath) {
      for (const wpId of foundPath) {
        const wp = this.waypoints.get(wpId);
        if (wp) {
          result.push({ x: wp.x, y: wp.y });
        }
      }
    } else {
      result.push({ x: startWp.x, y: startWp.y }, { x: targetWp.x, y: targetWp.y });
    }

    result.push({ ...target });
    return result;
  }
}

export const Pathfinding = new OfficePathfinding();
