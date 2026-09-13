import { getDatabase } from '../server/db/database.ts';
import { seedDatabase } from '../server/db/migrations.ts';
import { createRepositories } from '../server/repositories/index.ts';
import { AuthService } from '../server/auth/authService.ts';

export async function testAuthAndAuthorization(): Promise<boolean> {
  console.log('\n--- 3. Testing Authentication & Role-Based Authorization ---');

  const db = getDatabase({ inMemory: true });
  seedDatabase(db);
  const repos = createRepositories(db);
  const authService = new AuthService(repos.users);

  // 1. Password Verification
  const badLogin = authService.login('admin', 'wrongpassword');
  if (badLogin !== null) {
    throw new Error('Auth failed: login with wrong password succeeded');
  }
  console.log('✓ Invalid password correctly rejected');

  const adminLogin = authService.login('admin', 'adminpassword123');
  if (!adminLogin || adminLogin.user.role !== 'ADMIN' || !adminLogin.token) {
    throw new Error('Auth failed: valid admin login failed');
  }
  console.log('✓ Admin login succeeded with secure session token');

  const userLogin = authService.login('user', 'userpassword123');
  if (!userLogin || userLogin.user.role !== 'USER' || !userLogin.token) {
    throw new Error('Auth failed: valid user login failed');
  }
  console.log('✓ Standard user login succeeded with USER role');

  // 2. Tamper-Proof Token Verification
  const validSession = authService.verifySessionToken(adminLogin.token);
  if (!validSession || validSession.username !== 'admin' || validSession.role !== 'ADMIN') {
    throw new Error('Auth failed: token verification failed for valid token');
  }

  // Tamper with signature
  const tamperedToken = adminLogin.token.slice(0, -4) + 'abcd';
  const tamperedSession = authService.verifySessionToken(tamperedToken);
  if (tamperedSession !== null) {
    throw new Error('Auth security failure: tampered token was accepted');
  }
  console.log('✓ Cryptographic HMAC signature validated: tampered token rejected');

  // 3. Dev Login Route
  const devAdmin = authService.devLogin('ADMIN');
  if (devAdmin.user.role !== 'ADMIN') {
    throw new Error('Auth failed: devLogin ADMIN returned incorrect role');
  }
  const devUser = authService.devLogin('USER');
  if (devUser.user.role !== 'USER') {
    throw new Error('Auth failed: devLogin USER returned incorrect role');
  }
  console.log('✓ Development auto-login flow verified for frictionless pairing');

  // 4. Role Authorization Checks
  let adminAccessGranted = false;
  const mockReqAdmin: any = {
    cookies: { agent_hq_session: adminLogin.token },
    headers: {},
  };
  const mockRes: any = {
    status: (code: number) => ({
      json: (data: any) => ({ code, data }),
    }),
  };

  authService.requireAdmin(mockReqAdmin, mockRes, () => {
    adminAccessGranted = true;
  });
  if (!adminAccessGranted) {
    throw new Error('Authorization failed: valid ADMIN was blocked from admin action');
  }
  console.log('✓ requireAdmin middleware allows ADMIN user');

  let userBlockedFromAdmin = false;
  const mockReqUser: any = {
    cookies: { agent_hq_session: userLogin.token },
    headers: {},
  };
  authService.requireAdmin(mockReqUser, {
    status: (code: number) => {
      if (code === 403) userBlockedFromAdmin = true;
      return { json: () => {} };
    },
  } as any, () => {
    throw new Error('Security failure: normal USER was granted admin privileges');
  });
  if (!userBlockedFromAdmin) {
    throw new Error('Authorization failed: normal USER was not rejected with 403');
  }
  console.log('✓ requireAdmin middleware correctly blocks USER with 403 Forbidden');

  return true;
}
