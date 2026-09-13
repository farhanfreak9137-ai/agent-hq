import { TaskNode, TaskNodeStatus, TaskGraphModel } from '../types';

/**
 * TaskGraph manages a Directed Acyclic Graph (DAG) of executable task nodes,
 * resolving dependencies, detecting circular cycles, and computing ready nodes.
 */
export class TaskGraph {
  public readonly id: string;
  public readonly name: string;
  public readonly initiativeId: string;
  public status: TaskGraphModel['status'] = 'idle';
  public readonly createdAt: number;
  public completedAt?: number;
  public error?: string;

  private nodes: Map<string, TaskNode> = new Map();

  constructor(
    idOrOptions?: string | { id?: string; name?: string; initiativeId?: string },
    name?: string,
    initiativeId?: string
  ) {
    if (typeof idOrOptions === 'object' && idOrOptions !== null) {
      this.id = idOrOptions.id || 'graph-' + Math.random().toString(36).slice(2, 9);
      this.name = idOrOptions.name || this.id;
      this.initiativeId = idOrOptions.initiativeId || this.id;
    } else {
      this.id = (idOrOptions as string) || 'graph-' + Math.random().toString(36).slice(2, 9);
      this.name = name || this.id;
      this.initiativeId = initiativeId || this.id;
    }
    this.createdAt = Date.now();
  }

  /**
   * Add a node to the graph.
   */
  public addNode(node: TaskNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node with id "${node.id}" already exists in TaskGraph "${this.id}".`);
    }
    const newNode: TaskNode = {
      ...node,
      dependencies: [...(node.dependencies || [])],
      dependents: [...(node.dependents || [])],
      status: node.status || 'pending',
      retryCount: node.retryCount || 0,
      maxRetries: node.maxRetries ?? 2,
    };
    this.nodes.set(node.id, newNode);

    // Auto-link bidirectional dependency edges
    for (const depId of newNode.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode && !depNode.dependents.includes(node.id)) {
        depNode.dependents.push(node.id);
      }
    }
    for (const otherNode of this.nodes.values()) {
      if (otherNode.dependencies.includes(node.id) && !newNode.dependents.includes(otherNode.id)) {
        newNode.dependents.push(otherNode.id);
      }
    }
  }

  /**
   * Add a directed dependency edge: fromNodeId must complete before toNodeId can run.
   */
  public addEdge(fromNodeId: string, toNodeId: string): void {
    const fromNode = this.nodes.get(fromNodeId);
    const toNode = this.nodes.get(toNodeId);

    if (!fromNode) {
      throw new Error(`Source node "${fromNodeId}" does not exist in graph.`);
    }
    if (!toNode) {
      throw new Error(`Target node "${toNodeId}" does not exist in graph.`);
    }
    if (fromNodeId === toNodeId) {
      throw new Error(`Self-loop detected: node "${fromNodeId}" cannot depend on itself.`);
    }

    if (!fromNode.dependents.includes(toNodeId)) {
      fromNode.dependents.push(toNodeId);
    }
    if (!toNode.dependencies.includes(fromNodeId)) {
      toNode.dependencies.push(fromNodeId);
    }
  }

  /**
   * Validates the graph for:
   * 1. Unknown dependency references
   * 2. Circular dependencies (cycles) via Kahn's algorithm
   * 3. Disconnected loops
   */
  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.nodes.size === 0) {
      return { valid: false, errors: ['TaskGraph contains no nodes.'] };
    }

    // 1. Verify all dependency IDs exist
    for (const [nodeId, node] of this.nodes) {
      for (const depId of node.dependencies) {
        if (!this.nodes.has(depId)) {
          errors.push(`Node "${nodeId}" depends on non-existent node "${depId}".`);
        }
      }
      for (const childId of node.dependents) {
        if (!this.nodes.has(childId)) {
          errors.push(`Node "${nodeId}" lists non-existent dependent "${childId}".`);
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // 2. Cycle Detection using Kahn's Algorithm (topological sort)
    const inDegree = new Map<string, number>();
    for (const [nodeId, node] of this.nodes) {
      inDegree.set(nodeId, node.dependencies.length);
    }

    const queue: string[] = [];
    for (const [nodeId, deg] of inDegree) {
      if (deg === 0) {
        queue.push(nodeId);
      }
    }

    let visitedCount = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      visitedCount++;

      const node = this.nodes.get(current);
      if (node) {
        for (const childId of node.dependents) {
          const currentDeg = (inDegree.get(childId) || 0) - 1;
          inDegree.set(childId, currentDeg);
          if (currentDeg === 0) {
            queue.push(childId);
          }
        }
      }
    }

    if (visitedCount !== this.nodes.size) {
      // Unvisited nodes contain a cycle
      const cycleNodes: string[] = [];
      for (const [nodeId, deg] of inDegree) {
        if (deg > 0) {
          cycleNodes.push(nodeId);
        }
      }
      errors.push(
        `Circular dependency cycle detected in graph. Nodes involved in cycle: [${cycleNodes.join(', ')}]`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Returns all nodes that are eligible for execution:
   * (Status is 'pending' or 'ready', and all dependencies have completed successfully)
   */
  public getReadyNodes(): TaskNode[] {
    const ready: TaskNode[] = [];

    for (const node of this.nodes.values()) {
      if (node.status !== 'pending' && node.status !== 'ready') {
        continue;
      }

      const allDepsCompleted = node.dependencies.every((depId) => {
        const depNode = this.nodes.get(depId);
        return depNode && depNode.status === 'completed';
      });

      if (allDepsCompleted) {
        node.status = 'ready';
        ready.push(node);
      }
    }

    return ready;
  }

  /**
   * Mark a node as currently running.
   */
  public markRunning(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = 'running';
      if (this.status === 'idle') {
        this.status = 'running';
      }
    }
  }

  /**
   * Mark a node as successfully completed.
   * Returns IDs of any child nodes that became unblocked.
   */
  public markCompleted(nodeId: string, result?: TaskNode['result']): string[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];

    node.status = 'completed';
    node.result = result;

    const unblockedNodeIds: string[] = [];
    for (const childId of node.dependents) {
      const child = this.nodes.get(childId);
      if (child && (child.status === 'pending' || child.status === 'blocked')) {
        const allDepsDone = child.dependencies.every((depId) => {
          const d = this.nodes.get(depId);
          return d && d.status === 'completed';
        });
        if (allDepsDone) {
          child.status = 'ready';
          unblockedNodeIds.push(childId);
        }
      }
    }

    // Check if entire graph completed
    if (this.isCompleted()) {
      this.status = 'completed';
      this.completedAt = Date.now();
    }

    return unblockedNodeIds;
  }

  /**
   * Mark a node as failed.
   * Cascades 'blocked' status to dependents unless retried.
   */
  public markFailed(nodeId: string, error: string): string[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];

    node.status = 'failed';
    node.error = error;

    const blockedChildIds: string[] = [];
    const queue = [...node.dependents];

    while (queue.length > 0) {
      const childId = queue.shift()!;
      const child = this.nodes.get(childId);
      if (child && child.status !== 'completed' && child.status !== 'failed') {
        child.status = 'blocked';
        child.error = `Blocked by upstream failure of node "${nodeId}"`;
        blockedChildIds.push(childId);
        queue.push(...child.dependents);
      }
    }

    this.status = 'failed';
    this.error = `Node "${nodeId}" failed: ${error}`;

    return blockedChildIds;
  }

  /**
   * Mark all incomplete nodes as cancelled.
   */
  public cancel(): void {
    this.status = 'cancelled';
    for (const node of this.nodes.values()) {
      if (node.status === 'pending' || node.status === 'ready' || node.status === 'running') {
        node.status = 'cancelled';
      }
    }
  }

  /**
   * Checks if all nodes have completed successfully.
   */
  public isCompleted(): boolean {
    if (this.nodes.size === 0) return false;
    for (const node of this.nodes.values()) {
      if (node.status !== 'completed') return false;
    }
    return true;
  }

  /**
   * Checks if graph execution is terminated with a failure.
   */
  public isFailed(): boolean {
    return this.status === 'failed';
  }

  public getNode(nodeId: string): TaskNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getAllNodes(): TaskNode[] {
    return Array.from(this.nodes.values());
  }

  public getRootNodeIds(): string[] {
    const roots: string[] = [];
    for (const [id, node] of this.nodes) {
      if (node.dependencies.length === 0) {
        roots.push(id);
      }
    }
    return roots;
  }
}
