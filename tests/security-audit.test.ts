import { getDatabase } from '../server/db/database.ts';
import { seedDatabase } from '../server/db/migrations.ts';
import { createRepositories } from '../server/repositories/index.ts';

export async function testSecurityAudit(): Promise<boolean> {
  console.log('\n--- 5. Performing Security Audit & Zero Secret Leakage Check ---');

  const db = getDatabase({ inMemory: true });
  seedDatabase(db);
  const repos = createRepositories(db);

  // 1. Audit User Database Records: Ensure no plain passwords
  const users = db.prepare('SELECT * FROM users').all() as any[];
  for (const user of users) {
    if (!user.password_hash.startsWith('$2a$') && !user.password_hash.startsWith('$2b$')) {
      throw new Error(`Security failure: Plaintext password found in database for user ${user.username}`);
    }
    if (user.password_hash.includes('adminpassword123') || user.password_hash.includes('userpassword123')) {
      throw new Error(`Security failure: Raw password string leaked in user record: ${user.username}`);
    }
  }
  console.log(`✓ Audited ${users.length} user records: 100% bcrypt hashed, 0 raw passwords stored`);

  // 2. Audit Provider Configuration Records: Ensure no API keys stored in DB
  const providerConfigs = db.prepare('SELECT * FROM provider_configs').all() as any[];
  for (const prov of providerConfigs) {
    const serialized = JSON.stringify(prov);
    if (serialized.toLowerCase().includes('apikey') || serialized.toLowerCase().includes('secret')) {
      throw new Error(`Security failure: Provider config leaked credentials in DB: ${prov.id}`);
    }
  }
  console.log(`✓ Audited ${providerConfigs.length} provider configs: zero credentials or API keys in database`);

  // 3. Audit Sanitized Provider API Output
  const sanitizedProvs = repos.providers.getAll();
  for (const sp of sanitizedProvs) {
    if ('apiKey' in sp || 'secret' in sp) {
      throw new Error(`Security failure: Sanitized provider entity exposes secret keys: ${sp.id}`);
    }
  }
  console.log('✓ Provider public repository interface exposes only safe metadata (name, models, timeout)');

  // 4. Audit Audit Log System: Ensure passwords/keys are never logged
  repos.audit.record({
    actor_id: 'user_admin',
    actor_name: 'admin',
    action: 'provider.check',
    resource: 'provider',
    resource_id: 'gemini',
    success: true,
    metadata: {
      status: 'checked',
      sanitized: true,
    },
  });

  const logs = repos.audit.getRecent(10);
  for (const log of logs) {
    const raw = JSON.stringify(log);
    if (raw.includes('AIza') || raw.includes('password123')) {
      throw new Error('Security failure: Audit logs contained credential token');
    }
  }
  console.log('✓ Security audit logs verified free of credentials and private secrets');

  return true;
}
