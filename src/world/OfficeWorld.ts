import { AgentModel, FlyingEnvelope, Position, RoomModel } from '../types/index.ts';
import { ROOMS_DATA } from '../data/rooms.ts';
import { AgentSpriteRenderer } from './AgentSprite.ts';
import { FurnitureRenderer } from './Furniture.ts';
import { Camera } from './Camera.ts';
import { EventBus } from '../events/EventBus.ts';
import { AgentMessageSentEvent } from '../events/EventTypes.ts';
import { AgentManager } from '../agents/AgentManager.ts';
import { generateId } from '../utils/id.ts';
import { SpatialGrid } from './SpatialIndex.ts';

export interface WorldRenderOptions {
  selectedAgentId: string | null;
  hoveredAgentId: string | null;
  hoveredRoomId: string | null;
  showMinimap?: boolean;
}

export class OfficeWorld {
  public width: number = 1520;
  public height: number = 1020;
  public flyingEnvelopes: FlyingEnvelope[] = [];
  private ambientParticles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];
  private eventUnsubscribers: (() => void)[] = [];
  private spatialGrid: SpatialGrid = new SpatialGrid(80);

  constructor() {
    this.initParticles();
    this.setupEventSubscriptions();
  }

  private setupEventSubscriptions(): void {
    const unsub = EventBus.on('agent.message_sent', (event) => {
      const msgEvent = event as AgentMessageSentEvent;
      const fromId = msgEvent.sourceAgentId;
      const toId = msgEvent.targetAgentId;
      if (!fromId || !toId) return;

      let fromPos = msgEvent.sourcePosition;
      let toPos = msgEvent.targetPosition;
      let color = msgEvent.accentColor || '#38bdf8';

      if (!fromPos || !toPos) {
        const fromAgent = AgentManager.getById(fromId);
        const toAgent = AgentManager.getById(toId);
        if (!fromAgent || !toAgent) return;
        fromPos = fromPos || fromAgent.currentPosition;
        toPos = toPos || toAgent.currentPosition;
        color = fromAgent.avatar.accentColor || color;
      }

      this.addEnvelope(fromId, toId, fromPos, toPos, msgEvent.content, color);
    });

    this.eventUnsubscribers.push(unsub);
  }

  public destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
  }

  private initParticles(): void {
    this.ambientParticles = [];
    for (let i = 0; i < 40; i++) {
      this.ambientParticles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.2 - Math.random() * 0.3,
        size: 1 + Math.random() * 2,
        alpha: 0.2 + Math.random() * 0.4,
      });
    }
  }

  public addEnvelope(
    fromAgentId: string,
    toAgentId: string,
    fromPos: Position,
    toPos: Position,
    messageText: string,
    color: string = '#38bdf8'
  ): void {
    this.flyingEnvelopes.push({
      id: generateId('env'),
      fromAgentId,
      toAgentId,
      fromPos: { ...fromPos },
      toPos: { ...toPos },
      currentPos: { ...fromPos },
      progress: 0,
      messageText,
      color,
    });
  }

  public update(deltaTime: number, speedMultiplier: number): void {
    const step = (deltaTime / 1000) * 0.8 * speedMultiplier;

    // Update flying envelopes
    for (let i = this.flyingEnvelopes.length - 1; i >= 0; i--) {
      const env = this.flyingEnvelopes[i];
      env.progress += step * 1.5;

      if (env.progress >= 1) {
        this.flyingEnvelopes.splice(i, 1);
      } else {
        // Curved arc trajectory
        const t = env.progress;
        const dx = env.toPos.x - env.fromPos.x;
        const dy = env.toPos.y - env.fromPos.y;
        const arcHeight = -Math.sin(t * Math.PI) * 45;

        env.currentPos.x = env.fromPos.x + dx * t;
        env.currentPos.y = env.fromPos.y + dy * t + arcHeight;
      }
    }

    // Update ambient floating particles
    for (const p of this.ambientParticles) {
      p.x += p.vx * speedMultiplier;
      p.y += p.vy * speedMultiplier;
      if (p.y < 0) {
        p.y = this.height;
        p.x = Math.random() * this.width;
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    agents: AgentModel[],
    animTime: number,
    options: WorldRenderOptions
  ): void {
    const { width: vw, height: vh } = { width: camera.viewportWidth, height: camera.viewportHeight };

    // Clear background
    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    // Apply camera transformation
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // 1. Render World Boundary & Floor Grid
    this.renderFloor(ctx, options.hoveredRoomId);

    // 2. Render Rooms & Props
    this.renderRooms(ctx, animTime, options.hoveredRoomId);

    // 3. Render Hallway Waypoint Path lines (subtle cyber trace)
    this.renderHallwayGuides(ctx, animTime);

    // 4. Render Ambient Particles
    this.renderParticles(ctx);

    // 5. Render Flying Envelopes
    this.renderEnvelopes(ctx, animTime);

    // 6. Frustum culling & Spatial index filtering for 50-100 agents
    this.spatialGrid.rebuild(agents);
    const margin = 80;
    const halfW = vw / (2 * camera.zoom);
    const halfH = vh / (2 * camera.zoom);
    const visibleAgents = this.spatialGrid.queryBounds({
      minX: camera.x - halfW - margin,
      maxX: camera.x + halfW + margin,
      minY: camera.y - halfH - margin,
      maxY: camera.y + halfH + margin,
    });

    // Y-sorted for 2.5D depth illusion
    const sortedAgents = visibleAgents.sort((a, b) => a.currentPosition.y - b.currentPosition.y);
    for (const agent of sortedAgents) {
      const isSelected = agent.id === options.selectedAgentId;
      const isHovered = agent.id === options.hoveredAgentId;
      AgentSpriteRenderer.draw(ctx, agent, animTime, isSelected, isHovered);
    }

    ctx.restore(); // Restore camera transform

    // 7. Render Screen HUD Overlays (Minimap)
    if (options.showMinimap !== false) {
      this.renderMinimap(ctx, camera, agents);
    }
  }

  /**
   * Derives and validates physical world state purely from runtime agent models,
   * determining room occupancy, facing angle, and visual status without animation history.
   */
  public static deriveWorldState(agents: AgentModel[]): {
    roomOccupancy: Record<string, string[]>;
    activeAgentsCount: number;
    agentSummary: Record<string, { room: string; status: string; currentTaskId: string | null }>;
  } {
    const occupancy: Record<string, string[]> = {};
    const summary: Record<string, { room: string; status: string; currentTaskId: string | null }> = {};
    let activeCount = 0;

    for (const room of ROOMS_DATA) {
      occupancy[room.id] = [];
    }

    for (const agent of agents) {
      if (agent.status !== 'OFFLINE') activeCount++;

      let detectedRoomId = agent.roomId;
      for (const room of ROOMS_DATA) {
        if (
          agent.currentPosition.x >= room.x &&
          agent.currentPosition.x <= room.x + room.width &&
          agent.currentPosition.y >= room.y &&
          agent.currentPosition.y <= room.y + room.height
        ) {
          detectedRoomId = room.id;
          break;
        }
      }

      if (occupancy[detectedRoomId]) {
        occupancy[detectedRoomId].push(agent.id);
      }

      summary[agent.id] = {
        room: detectedRoomId,
        status: agent.status,
        currentTaskId: agent.currentTaskId,
      };
    }

    return {
      roomOccupancy: occupancy,
      activeAgentsCount: activeCount,
      agentSummary: summary,
    };
  }

  private renderFloor(ctx: CanvasRenderingContext2D, hoveredRoomId: string | null): void {
    // Outer office boundary
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle grid pattern
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    const gridSize = 40;

    ctx.beginPath();
    for (let x = 0; x <= this.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = 0; y <= this.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();

    // Central Corridor Walkway highlights
    ctx.fillStyle = '#0f172a';
    // Main vertical halls
    ctx.fillRect(490, 40, 40, 940);
    ctx.fillRect(740, 290, 40, 430);
    ctx.fillRect(990, 40, 40, 940);
    // Main horizontal halls
    ctx.fillRect(470, 310, 580, 50);
    ctx.fillRect(470, 640, 580, 50);

    // Floor neon runway strip in corridors
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(510, 60); ctx.lineTo(510, 960);
    ctx.moveTo(1010, 60); ctx.lineTo(1010, 960);
    ctx.moveTo(510, 335); ctx.lineTo(1010, 335);
    ctx.moveTo(510, 665); ctx.lineTo(1010, 665);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private renderRooms(ctx: CanvasRenderingContext2D, animTime: number, hoveredRoomId: string | null): void {
    for (const room of ROOMS_DATA) {
      const isHovered = room.id === hoveredRoomId;

      // Room Floor
      ctx.save();
      ctx.fillStyle = '#111827';
      ctx.fillRect(room.x, room.y, room.width, room.height);

      // Room interior border
      ctx.strokeStyle = isHovered ? room.colorTheme : '#1f2937';
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.strokeRect(room.x, room.y, room.width, room.height);

      // Room Corner Accents (Cyber brackets)
      ctx.strokeStyle = room.colorTheme;
      ctx.lineWidth = 2.5;
      const bracket = 14;
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(room.x, room.y + bracket);
      ctx.lineTo(room.x, room.y);
      ctx.lineTo(room.x + bracket, room.y);
      // Top-Right
      ctx.moveTo(room.x + room.width - bracket, room.y);
      ctx.lineTo(room.x + room.width, room.y);
      ctx.lineTo(room.x + room.width, room.y + bracket);
      // Bottom-Left
      ctx.moveTo(room.x, room.y + room.height - bracket);
      ctx.lineTo(room.x, room.y + room.height);
      ctx.lineTo(room.x + bracket, room.y + room.height);
      // Bottom-Right
      ctx.moveTo(room.x + room.width - bracket, room.y + room.height);
      ctx.lineTo(room.x + room.width, room.y + room.height);
      ctx.lineTo(room.x + room.width, room.y + room.height - bracket);
      ctx.stroke();

      // Doorway cutout indicator
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = room.colorTheme;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(room.doorway.x, room.doorway.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Room Title Badge
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      const titleWidth = ctx.measureText(room.name.toUpperCase()).width + 18;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(room.x + 12, room.y + 10, titleWidth, 22, 4);
      ctx.fill();
      ctx.strokeStyle = isHovered ? room.colorTheme : 'rgba(71, 85, 105, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Mini room dot
      ctx.fillStyle = room.colorTheme;
      ctx.beginPath();
      ctx.arc(room.x + 22, room.y + 21, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Text
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(room.name.toUpperCase(), room.x + 30, room.y + 21);

      ctx.restore();

      // Props inside this room
      for (const prop of room.props) {
        FurnitureRenderer.drawProp(ctx, prop, animTime);
      }
    }
  }

  private renderHallwayGuides(ctx: CanvasRenderingContext2D, animTime: number): void {
    // Subtle animated data pulse in corridors
    const pulseOffset = (animTime / 30) % 60;
    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.beginPath();
    ctx.arc(510, (pulseOffset * 16) % this.height, 2, 0, Math.PI * 2);
    ctx.arc(1010, (this.height - (pulseOffset * 16) % this.height), 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.ambientParticles) {
      ctx.fillStyle = `rgba(56, 189, 248, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderEnvelopes(ctx: CanvasRenderingContext2D, animTime: number): void {
    for (const env of this.flyingEnvelopes) {
      ctx.save();
      ctx.translate(env.currentPos.x, env.currentPos.y);

      // Particle tail
      const tailX = -Math.cos(animTime / 50) * 8;
      ctx.fillStyle = env.color;
      ctx.shadowColor = env.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(tailX, 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Holographic Envelope Box
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = env.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-12, -8, 24, 16, 3);
      ctx.fill();
      ctx.stroke();

      // Flap crease
      ctx.beginPath();
      ctx.moveTo(-12, -8);
      ctx.lineTo(0, 1);
      ctx.lineTo(12, -8);
      ctx.stroke();

      // Glow pulse
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  private renderMinimap(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    agents: AgentModel[]
  ): void {
    const mapW = 160;
    const mapH = 110;
    const pad = 16;
    const mx = camera.viewportWidth - mapW - pad;
    const my = camera.viewportHeight - mapH - pad;

    ctx.save();
    // Minimap Container Box
    ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(mx, my, mapW, mapH, 6);
    ctx.fill();
    ctx.stroke();

    // Scale factors
    const scaleX = mapW / this.width;
    const scaleY = mapH / this.height;

    // Mini rooms
    for (const room of ROOMS_DATA) {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
      ctx.strokeStyle = room.colorTheme;
      ctx.lineWidth = 1;
      ctx.fillRect(mx + room.x * scaleX, my + room.y * scaleY, room.width * scaleX, room.height * scaleY);
      ctx.strokeRect(mx + room.x * scaleX, my + room.y * scaleY, room.width * scaleX, room.height * scaleY);
    }

    // Mini agents blips
    for (const agent of agents) {
      const ax = mx + agent.currentPosition.x * scaleX;
      const ay = my + agent.currentPosition.y * scaleY;
      ctx.fillStyle = agent.avatar.accentColor;
      ctx.beginPath();
      ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mini camera viewport rectangle
    const topLeft = camera.screenToWorld(0, 0);
    const botRight = camera.screenToWorld(camera.viewportWidth, camera.viewportHeight);
    const vx = mx + Math.max(0, topLeft.x) * scaleX;
    const vy = my + Math.max(0, topLeft.y) * scaleY;
    const vw = Math.min(mapW, (botRight.x - topLeft.x) * scaleX);
    const vh = Math.min(mapH, (botRight.y - topLeft.y) * scaleY);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(vx, vy, vw, vh);

    // Label
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('RADAR', mx + 6, my + 12);

    ctx.restore();
  }

  public getAgentAt(worldPos: Position, agents: AgentModel[], hitRadius: number = 24): AgentModel | null {
    for (const agent of agents) {
      const d = Math.hypot(agent.currentPosition.x - worldPos.x, agent.currentPosition.y - worldPos.y);
      if (d <= hitRadius) {
        return agent;
      }
    }
    return null;
  }

  public getRoomAt(worldPos: Position): RoomModel | null {
    for (const room of ROOMS_DATA) {
      if (
        worldPos.x >= room.x &&
        worldPos.x <= room.x + room.width &&
        worldPos.y >= room.y &&
        worldPos.y <= room.y + room.height
      ) {
        return room;
      }
    }
    return null;
  }
}
