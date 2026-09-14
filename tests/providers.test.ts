import { ProviderRegistry } from '../src/agents/ProviderRegistry';
import { MockAgentProvider } from '../src/agents/AgentProvider';
import { GeminiProvider } from '../src/agents/providers/GeminiProvider';
import { AntigravityProvider } from '../src/agents/providers/AntigravityProvider';

export async function testProviders() {
  console.log('--- Testing Provider Registry & Adapters ---');

  const registry = ProviderRegistry.getInstance();
  if (!registry.get('mock')) registry.register(new MockAgentProvider());
  if (!registry.get('gemini')) registry.register(new GeminiProvider());
  if (!registry.get('antigravity')) registry.register(new AntigravityProvider());

  // Test 1: Providers registered
  const mockProvider = registry.getProvider('mock');
  if (!mockProvider) {
    throw new Error('MockAgentProvider not registered');
  }
  const geminiProvider = registry.getProvider('gemini');
  if (!geminiProvider) {
    throw new Error('GeminiProvider not registered');
  }
  const antigravityProvider = registry.getProvider('antigravity');
  if (!antigravityProvider) {
    throw new Error('AntigravityProvider not registered');
  }
  console.log('[PASS] Core providers registered in ProviderRegistry');

  // Test 2: Mock health check is available
  const mockHealth = await mockProvider.healthCheck();
  if (mockHealth.status !== 'available') {
    throw new Error(`Expected mock provider to be available, got ${mockHealth.status}`);
  }
  console.log('[PASS] Mock provider reports available');

  // Test 3: Antigravity provider health report
  const agHealth = await registry.checkHealth('antigravity');
  if (!agHealth || (agHealth.status !== 'available' && agHealth.status !== 'unavailable')) {
    throw new Error(`Expected antigravity provider to report available or unavailable, got: ${agHealth?.status}`);
  }
  console.log(`[PASS] Antigravity provider clean status check: ${agHealth.status} (${agHealth.message || 'clean'})`);

  // Test 4: Provider resolution with safe fallback
  // Unregistered / unavailable provider safely routes to mock
  const fallbackResolved = registry.resolveProviderForAgent({
    id: 'test-agent-fallback',
    name: 'Test Fallback Agent',
    role: 'Tester',
    providerId: 'unregistered-or-offline-provider',
  } as any);

  if (fallbackResolved.provider.id !== 'mock') {
    throw new Error(`Expected fallback to 'mock' provider, got: ${fallbackResolved.provider.id}`);
  }
  console.log('[PASS] Safe fallback resolution routed unavailable provider to mock provider');

  // When Antigravity is available, verify it resolves directly to antigravity
  if (agHealth.status === 'available') {
    const agResolved = registry.resolveProviderForAgent({
      id: 'test-agent-ag',
      name: 'Test AG Agent',
      role: 'Coder',
      providerId: 'antigravity',
    } as any);

    if (agResolved.provider.id !== 'antigravity') {
      throw new Error(`Expected resolved provider to be 'antigravity', got: ${agResolved.provider.id}`);
    }
    console.log('[PASS] Active Antigravity provider successfully resolved for agent');
  }

  // Test 5: Health check all
  const allHealth = await registry.healthCheckAll();
  if (allHealth.size < 3) {
    throw new Error(`Expected at least 3 health statuses, got: ${allHealth.size}`);
  }
  console.log(`[PASS] Health check all completed (${allHealth.size} providers checked)`);

  console.log('Provider tests passed successfully!\n');
}

if (process.argv[1]?.endsWith('providers.test.ts')) {
  testProviders().catch((err) => {
    console.error('[FAIL]', err);
    process.exit(1);
  });
}
