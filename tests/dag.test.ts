import assert from 'node:assert/strict';
import { TaskGraph } from '../src/orchestration/TaskGraph.ts';

export async function testDag(): Promise<void> {
  console.log('\n--- Running DAG Tests ---');

  // Test 1: Cycle Detection (A -> B -> C -> A)
  {
    const graph = new TaskGraph('graph_cycle', 'Cycle Test', 'init_cycle');
    graph.addNode({
      id: 'A',
      taskId: 't_a',
      title: 'Task A',
      dependencies: ['C'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
    });
    graph.addNode({
      id: 'B',
      taskId: 't_b',
      title: 'Task B',
      dependencies: ['A'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
    });
    graph.addNode({
      id: 'C',
      taskId: 't_c',
      title: 'Task C',
      dependencies: ['B'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
    });

    graph.addEdge('C', 'A');
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'C');

    const validation = graph.validate();
    assert.equal(validation.valid, false, 'Cycle graph should be invalid');
    assert.ok(
      validation.errors.some((e) => e.includes('Circular dependency cycle detected')),
      'Should report circular dependency cycle'
    );
    console.log('✓ Test 1 Passed: Circular dependency cycle (A->B->C->A) correctly rejected');
  }

  // Test 2: Diamond Multi-Dependency Graph:
  // A, B, C can run in parallel.
  // D depends on A + B.
  // E depends on B + C.
  // F depends on D + E.
  {
    const graph = new TaskGraph('graph_diamond', 'Diamond Test', 'init_diamond');
    const nodes = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const id of nodes) {
      graph.addNode({
        id,
        taskId: `task_${id}`,
        title: `Task ${id}`,
        dependencies: [],
        dependents: [],
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
      });
    }

    // D depends on A + B
    graph.addEdge('A', 'D');
    graph.addEdge('B', 'D');

    // E depends on B + C
    graph.addEdge('B', 'E');
    graph.addEdge('C', 'E');

    // F depends on D + E
    graph.addEdge('D', 'F');
    graph.addEdge('E', 'F');

    const validation = graph.validate();
    assert.equal(validation.valid, true, `Diamond graph should be valid: ${validation.errors.join(', ')}`);

    // Initially, only A, B, C should be ready
    const ready1 = graph.getReadyNodes().map((n) => n.id).sort();
    assert.deepEqual(ready1, ['A', 'B', 'C'], 'A, B, C must be ready initially');

    // Complete A
    graph.markCompleted('A');
    // D still needs B, so no new ready nodes yet
    const ready2 = graph.getReadyNodes().map((n) => n.id).sort();
    assert.deepEqual(ready2, ['B', 'C'], 'Only remaining B, C should be ready');

    // Complete B
    const unblockedAfterB = graph.markCompleted('B');
    // D now has A + B completed! E still needs C.
    assert.deepEqual(unblockedAfterB, ['D'], 'D should become unblocked after B finishes');

    // Complete C
    const unblockedAfterC = graph.markCompleted('C');
    assert.deepEqual(unblockedAfterC, ['E'], 'E should become unblocked after C finishes');

    // Complete D
    const unblockedAfterD = graph.markCompleted('D');
    assert.deepEqual(unblockedAfterD, [], 'F should not be unblocked until E also completes');

    // Complete E -> F becomes unblocked!
    const unblockedAfterE = graph.markCompleted('E');
    assert.deepEqual(unblockedAfterE, ['F'], 'F should become unblocked when both D and E are completed');

    // Complete F
    graph.markCompleted('F');
    assert.equal(graph.isCompleted(), true, 'Graph should be marked completed');
    console.log('✓ Test 2 Passed: Multi-dependency graph (A,B,C -> D,E -> F) resolved in exact dependency order');
  }

  // Test 3: Failure Propagation and Downstream Blocking
  {
    const graph = new TaskGraph('graph_fail', 'Failure Test', 'init_fail');
    graph.addNode({ id: 'X', taskId: 't_x', title: 'Task X', dependencies: [], dependents: [], status: 'pending', retryCount: 0, maxRetries: 1 });
    graph.addNode({ id: 'Y', taskId: 't_y', title: 'Task Y', dependencies: ['X'], dependents: [], status: 'pending', retryCount: 0, maxRetries: 1 });
    graph.addNode({ id: 'Z', taskId: 't_z', title: 'Task Z', dependencies: ['Y'], dependents: [], status: 'pending', retryCount: 0, maxRetries: 1 });

    graph.addEdge('X', 'Y');
    graph.addEdge('Y', 'Z');

    graph.markFailed('X', 'Connection timeout');
    assert.equal(graph.getNode('X')?.status, 'failed');
    assert.equal(graph.getNode('Y')?.status, 'blocked');
    assert.equal(graph.getNode('Z')?.status, 'blocked');
    assert.equal(graph.isFailed(), true);
    console.log('✓ Test 3 Passed: Upstream failure cascaded "blocked" state to downstream dependents');
  }
}
