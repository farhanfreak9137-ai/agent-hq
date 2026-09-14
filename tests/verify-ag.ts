import { AntigravityProvider } from '../src/agents/providers/AntigravityProvider';
import { EventBus } from '../src/events/EventBus';

async function main() {
  const events: string[] = [];
  EventBus.on('runtime.started', () => events.push('runtime.started'));
  EventBus.on('runtime.thinking', () => events.push('runtime.thinking'));
  EventBus.on('runtime.completed', () => events.push('runtime.completed'));

  const provider = new AntigravityProvider('http://127.0.0.1:3001');
  await provider.initialize();
  const health = await provider.healthCheck();
  console.log('Provider Health:', health);

  if (health.status !== 'available') {
    throw new Error('Antigravity provider not available: ' + health.message);
  }

  const agent = {
    id: 'nova',
    name: 'NOVA',
    role: 'Coder',
    providerId: 'antigravity',
    capabilities: ['coding'],
  };

  const runtime = await provider.createRuntime(agent as any);
  console.log('Executing minimal verification task through AntigravityProvider...');

  const result = await runtime.executeTask({
    id: 'task_verify_agy_' + Date.now(),
    title: 'Verification ping',
    description: 'Return JSON: {"status": "ok", "agent": "nova"}',
    status: 'IN_PROGRESS',
    assignedAgentId: 'nova',
    priority: 'LOW',
  } as any);

  console.log('RESULT:', JSON.stringify(result, null, 2));
  console.log('EVENTS:', events);

  if (result.executionMode !== 'real') {
    throw new Error('Expected executionMode to be real, got: ' + result.executionMode);
  }
  if (!result.success) {
    throw new Error('Expected execution to succeed');
  }

  console.log('[VERIFIED] REAL Antigravity execution succeeded!');
}

main().catch((err) => {
  console.error('[FAILED]', err);
  process.exit(1);
});
