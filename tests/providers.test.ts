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

  // Test 3: Antigravity provider clean fallback/unconfigured report
  const agHealth = await registry.checkHealth('antigravity');
  const statusStr = agHealth?.status as string;
  if (!agHealth || (statusStr !== 'unavailable' && statusStr !== 'unconfigured')) {
    throw new Error(`Expected antigravity provider to report unavailable or unconfigured, got: ${agHealth?.status}`);
  }
  console.log(`[PASS] Antigravity provider clean status check: ${agHealth.status} (${agHealth.message || 'clean'})`);

  // Test 4: Safe resolution with fallback
  // If agent requests 'antigravity' but it is unavailable, registry fallback should safely provide mock provider
  const resolved = registry.resolveProviderForAgent({
    id: 'test-agent',
    name: 'Test Agent',
    role: 'Tester',
    providerId: 'antigravity',
  } as any);

  if (resolved.provider.id !== 'mock') {
    throw new Error(`Expected fallback to 'mock' provider, got: ${resolved.provider.id}`);
  }
  console.log('[PASS] Safe fallback resolution routed unavailable provider to mock provider');

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
