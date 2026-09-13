import { AgentModel, Position } from '../types/index.ts';
import { AgentManager } from '../agents/AgentManager.ts';
import { TaskManager } from '../tasks/TaskManager.ts';
import { MessageBus } from '../communication/MessageBus.ts';
import { EventBus } from '../events/EventBus.ts';
import { Pathfinding } from '../world/Pathfinding.ts';
import { BossOrchestrator } from '../orchestration/BossOrchestrator.ts';
import { generateId } from '../utils/id.ts';

export interface AgentPathState {
  waypoints: Position[];
  targetFacing?: 'up' | 'down' | 'left' | 'right';
  onComplete?: () => void;
}

export class SimulationEngine {
  public isPlaying: boolean = true;
  public speed: number = 1.0; // 1x, 2x, 4x
  public isAutonomous: boolean = true;
  public activeMissionName: string | null = null;
  public activeMissionStep: number = 0;
  public totalMissionSteps: number = 0;

  private agentPaths: Map<string, AgentPathState> = new Map();
  private autonomousTimer: number = 0;
  private missionAbortController: AbortController | null = null;

  constructor() {
    // Canvas decoupling: SimulationEngine does not take or store OfficeWorld reference
  }

  public play(): void {
    this.isPlaying = true;
    EventBus.emit({
      id: generateId('ev'),
      type: 'simulation.play',
      timestamp: Date.now(),
      message: 'Simulation resumed',
    });
  }

  public pause(): void {
    this.isPlaying = false;
    EventBus.emit({
      id: generateId('ev'),
      type: 'simulation.pause',
      timestamp: Date.now(),
      message: 'Simulation paused',
    });
  }

  public togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public setSpeed(speed: number): void {
    this.speed = speed;
    EventBus.emit({
      id: generateId('ev'),
      type: 'simulation.speed',
      timestamp: Date.now(),
      message: `Simulation speed set to ${speed}x`,
      speed,
    });
  }

  public reset(): void {
    if (this.missionAbortController) {
      this.missionAbortController.abort();
      this.missionAbortController = null;
    }
    this.activeMissionName = null;
    this.activeMissionStep = 0;
    this.totalMissionSteps = 0;
    this.agentPaths.clear();
    BossOrchestrator.getInstance().cancel();
    AgentManager.reset();
    TaskManager.reset();
    MessageBus.clear();
    EventBus.clearHistory();

    EventBus.emit({
      id: generateId('ev'),
      type: 'simulation.reset',
      timestamp: Date.now(),
      message: 'Agent HQ simulation state reset to factory state',
    });
  }

  /**
   * Main simulation tick called from animation loop.
   */
  public update(deltaTimeMs: number): void {
    if (!this.isPlaying) return;

    const effectiveDelta = deltaTimeMs * this.speed;

    // 1. Update Agent Path Movements
    this.updateAgentMovements(effectiveDelta);

    // 2. Clear expired speech bubbles
    this.updateSpeechBubbles();

    // 3. Autonomous ambient behaviors (conversations, desk work, coffee runs)
    if (this.isAutonomous && !this.activeMissionName) {
      this.updateAutonomousBehavior(effectiveDelta);
    }
  }

  /**
   * Navigate agent along waypoint path using Pathfinding.
   */
  public moveAgentTo(
    agentId: string,
    target: Position,
    onComplete?: () => void,
    targetFacing?: 'up' | 'down' | 'left' | 'right'
  ): void {
    const agent = AgentManager.getById(agentId);
    if (!agent) return;

    const path = Pathfinding.findPath(agent.currentPosition, target);
    if (path.length <= 1) {
      AgentManager.setPosition(agentId, target, targetFacing);
      if (onComplete) onComplete();
      return;
    }

    AgentManager.setStatus(agentId, 'WALKING', 'In transit...');
    this.agentPaths.set(agentId, {
      waypoints: path.slice(1), // first is current position
      targetFacing: targetFacing || 'down',
      onComplete,
    });
  }

  private updateAgentMovements(deltaMs: number): void {
    const moveSpeed = 160 * (deltaMs / 1000); // pixels per second

    this.agentPaths.forEach((pathState, agentId) => {
      const agent = AgentManager.getById(agentId);
      if (!agent) {
        this.agentPaths.delete(agentId);
        return;
      }

      if (pathState.waypoints.length === 0) {
        // Arrived!
        if (pathState.targetFacing) {
          AgentManager.setPosition(agentId, agent.currentPosition, pathState.targetFacing);
        }
        this.agentPaths.delete(agentId);
        if (pathState.onComplete) {
          pathState.onComplete();
        }
        return;
      }

      const nextTarget = pathState.waypoints[0];
      const dx = nextTarget.x - agent.currentPosition.x;
      const dy = nextTarget.y - agent.currentPosition.y;
      const dist = Math.hypot(dx, dy);

      // Determine facing direction
      let facing: 'up' | 'down' | 'left' | 'right' = agent.facing;
      if (Math.abs(dx) > Math.abs(dy)) {
        facing = dx > 0 ? 'right' : 'left';
      } else {
        facing = dy > 0 ? 'down' : 'up';
      }

      if (dist <= moveSpeed) {
        // Snap to this waypoint and move to next
        AgentManager.setPosition(agentId, nextTarget, facing);
        pathState.waypoints.shift();
      } else {
        // Interpolate
        const newX = agent.currentPosition.x + (dx / dist) * moveSpeed;
        const newY = agent.currentPosition.y + (dy / dist) * moveSpeed;
        AgentManager.setPosition(agentId, { x: newX, y: newY }, facing);
      }
    });
  }

  private updateSpeechBubbles(): void {
    const now = Date.now();
    for (const agent of AgentManager.getAll()) {
      if (agent.speechBubble && agent.speechBubble.expiresAt <= now) {
        AgentManager.clearSpeech(agent.id);
      }
    }
  }

  private updateAutonomousBehavior(deltaMs: number): void {
    this.autonomousTimer += deltaMs;

    // Trigger an ambient autonomous event roughly every 6-9 seconds
    if (this.autonomousTimer > 7500) {
      this.autonomousTimer = 0;
      this.triggerAmbientActivity();
    }
  }

  private triggerAmbientActivity(): void {
    const agents = AgentManager.getAll();
    const idleOrWorking = agents.filter(
      (a) => a.status === 'IDLE' || a.status === 'WORKING' || a.status === 'THINKING'
    );
    if (idleOrWorking.length === 0) return;

    const chosen = idleOrWorking[Math.floor(Math.random() * idleOrWorking.length)];
    const roll = Math.random();

    if (roll < 0.35) {
      // Send a brief message / observation
      const targets = agents.filter((a) => a.id !== chosen.id);
      const target = targets[Math.floor(Math.random() * targets.length)];

      const sampleChatter = [
        `Code coverage hit 99.4% in latest commit.`,
        `Checked memory allocation profile, looks razor sharp.`,
        `Running differential regression check now.`,
        `Latency overhead is under 2.4ms across all hops.`,
        `Optimized AST parser pass for 15% throughput jump.`,
        `Reviewing security headers and CORS strict policy.`,
        `Vector clustering recall metrics are stable.`,
      ];
      const text = sampleChatter[Math.floor(Math.random() * sampleChatter.length)];

      this.sendAgentMessage(chosen.id, target.id, text);
    } else if (roll < 0.65) {
      // Thought bubble
      const thoughts = [
        'Calculating branch pruning heuristics...',
        'Benchmarking zero-copy buffer transfers...',
        'Pondering quantum-resistant signature schemes...',
        'Refactoring state machine transitions...',
        'Synthesizing multi-modal telemetry streams...',
      ];
      const thought = thoughts[Math.floor(Math.random() * thoughts.length)];
      AgentManager.setThought(chosen.id, thought);
      setTimeout(() => AgentManager.setThought(chosen.id, undefined), 4000);
    } else if (roll < 0.85 && chosen.id !== 'boss' && !this.agentPaths.has(chosen.id)) {
      // Stroll to Lounge / Commons for coffee or chat
      const loungeSpots = [
        { x: 720, y: 480 },
        { x: 790, y: 480 },
        { x: 620, y: 440 }, // near water cooler
        { x: 890, y: 440 }, // near vending machine
      ];
      const targetSpot = loungeSpots[Math.floor(Math.random() * loungeSpots.length)];

      AgentManager.setStatus(chosen.id, 'WALKING', 'Visiting Commons Lounge...');
      this.moveAgentTo(chosen.id, targetSpot, () => {
        AgentManager.setStatus(chosen.id, 'COMMUNICATING', 'Taking quick refresh...');
        AgentManager.setSpeech(chosen.id, 'Taking a short hydration break!', 3500);

        setTimeout(() => {
          AgentManager.setStatus(chosen.id, 'WALKING', 'Returning to workstation...');
          this.moveAgentTo(chosen.id, chosen.deskPosition, () => {
            AgentManager.setStatus(chosen.id, 'WORKING', 'Resumed core tasks');
          });
        }, 4000);
      });
    }
  }

  /**
   * Helper to send an in-world message.
   * MessageBus emits 'agent.message_sent' event which OfficeWorld visualizes.
   */
  public sendAgentMessage(fromId: string, toId: string, text: string): void {
    const fromAgent = AgentManager.getById(fromId);
    const toAgent = AgentManager.getById(toId);
    if (!fromAgent || !toAgent) return;

    AgentManager.incrementStats(fromId, 'messagesSent');
    AgentManager.incrementStats(toId, 'messagesReceived');

    // MessageBus handles storage and structured event emission
    MessageBus.sendMessage(fromId, toId, text);

    // Show speech bubble on sender
    AgentManager.setSpeech(fromId, text, 3000);

    // When envelope arrives (approx 1.2s), receiver displays speech bubble reaction
    setTimeout(() => {
      const recipient = AgentManager.getById(toId);
      if (recipient) {
        AgentManager.setSpeech(toId, `Acknowledged: "${text.substring(0, 24)}..."`, 3000);
      }
    }, 1200 / this.speed);
  }

  /**
   * Run Demo Mission:
   * Launches multi-agent orchestrated workflow via BossOrchestrator and DAG:
   * "Operation Aegis: Zero-Trust Authentication Architecture"
   */
  public async runDemoMission(): Promise<void> {
    if (this.missionAbortController) {
      this.missionAbortController.abort();
    }
    this.missionAbortController = new AbortController();

    this.activeMissionName = 'Operation Aegis: Zero-Trust Authentication Architecture';
    this.activeMissionStep = 1;
    this.totalMissionSteps = 7;

    EventBus.emit({
      id: generateId('ev'),
      type: 'mission.started',
      timestamp: Date.now(),
      message: 'MISSION LAUNCHED: "Operation Aegis — Zero-Trust Authentication Architecture" (DAG Pipeline)',
      missionId: 'mission_aegis',
      missionName: this.activeMissionName,
      stepIndex: 1,
      totalSteps: 7,
    });

    try {
      const orchestrator = BossOrchestrator.getInstance();
      const result = await orchestrator.runOperationAegis();

      if (result.success) {
        // Confetti celebration
        try {
          const confetti = (await import('canvas-confetti')).default;
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#38bdf8', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
          });
        } catch {
          // ignore
        }

        EventBus.emit({
          id: generateId('ev'),
          type: 'mission.completed',
          timestamp: Date.now(),
          message: 'MISSION ACCOMPLISHED: Operation Aegis DAG executed successfully across all nodes!',
          missionId: 'mission_aegis',
          missionName: this.activeMissionName,
          stepIndex: 7,
          totalSteps: 7,
        });

        await new Promise((r) => setTimeout(r, 4000 / this.speed));
      } else {
        EventBus.emit({
          id: generateId('ev'),
          type: 'mission.failed',
          timestamp: Date.now(),
          missionId: 'mission_aegis',
          missionName: this.activeMissionName || 'Operation Aegis',
          error: result.error || 'DAG execution failed',
          message: `Mission halted: ${result.error}`,
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      EventBus.emit({
        id: generateId('ev'),
        type: 'mission.failed',
        timestamp: Date.now(),
        missionId: 'mission_aegis',
        missionName: this.activeMissionName || 'Operation Aegis',
        error: errorMsg,
        message: `Mission failed: ${errorMsg}`,
      });
    } finally {
      this.activeMissionName = null;
      this.activeMissionStep = 0;
      this.totalMissionSteps = 0;
    }
  }
}
