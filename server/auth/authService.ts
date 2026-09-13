import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { UserRepository, UserEntity } from '../repositories/UserRepository.ts';

const SESSION_SECRET = process.env.SESSION_SECRET || 'agent-hq-secure-dev-session-key-2026';
const COOKIE_NAME = 'agent_hq_session';

export interface AuthSessionPayload {
  userId: string;
  username: string;
  role: 'ADMIN' | 'USER';
  issuedAt: number;
  expiresAt: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthSessionPayload;
}

export class AuthService {
  constructor(private userRepo: UserRepository) {}

  /**
   * Generates a tamper-proof HMAC-SHA256 signed session token.
   */
  public generateSessionToken(user: Pick<UserEntity, 'id' | 'username' | 'role'>, expiresInMs: number = 86400000): string {
    const payload: AuthSessionPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      issuedAt: Date.now(),
      expiresAt: Date.now() + expiresInMs,
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadBase64).digest('base64url');

    return `${payloadBase64}.${signature}`;
  }

  /**
   * Verifies session token and signature.
   */
  public verifySessionToken(token: string): AuthSessionPayload | null {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadBase64).digest('base64url');

    // Constant-time signature comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as AuthSessionPayload;
      if (payload.expiresAt && Date.now() > payload.expiresAt) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Authenticates user with username & password.
   */
  public login(username: string, password: string): { user: Omit<UserEntity, 'password_hash'>; token: string } | null {
    const user = this.userRepo.findByUsername(username);
    if (!user) return null;

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return null;

    const token = this.generateSessionToken(user);
    const { password_hash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  /**
   * Quick development login without credentials for local frictionless pairing.
   */
  public devLogin(asRole: 'ADMIN' | 'USER' = 'ADMIN'): { user: Omit<UserEntity, 'password_hash'>; token: string } {
    const username = asRole === 'ADMIN' ? 'admin' : 'user';
    let user = this.userRepo.findByUsername(username);

    if (!user) {
      const now = Date.now();
      const hash = bcrypt.hashSync(`${username}password123`, 10);
      user = this.userRepo.create({
        id: `user_${username}_01`,
        username,
        password_hash: hash,
        role: asRole,
      });
    }

    const token = this.generateSessionToken(user);
    const { password_hash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  /**
   * Extracts session token from cookie or Authorization header.
   */
  public extractToken(req: Request): string | null {
    // 1. From HttpOnly Cookie
    if (req.cookies && req.cookies[COOKIE_NAME]) {
      return req.cookies[COOKIE_NAME];
    }

    // 2. From Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  /**
   * Attaches session cookie to response.
   */
  public setCookie(res: Response, token: string): void {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: false, // Localhost dev
      sameSite: 'lax',
      maxAge: 86400000, // 24h
      path: '/',
    });
  }

  /**
   * Clears session cookie on logout.
   */
  public clearCookie(res: Response): void {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }

  /**
   * Express Middleware: Require valid session authentication.
   */
  public requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const token = this.extractToken(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized. Authentication session required.' });
      return;
    }

    const session = this.verifySessionToken(token);
    if (!session) {
      res.status(401).json({ error: 'Unauthorized. Invalid or expired session token.' });
      return;
    }

    req.user = session;
    next();
  };

  /**
   * Express Middleware: Require ADMIN role.
   */
  public requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    this.requireAuth(req, res, () => {
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden. Administrator privileges required for this action.' });
        return;
      }
      next();
    });
  };

  /**
   * Express Middleware: Optional authentication (attaches user if session exists).
   */
  public optionalAuth = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const token = this.extractToken(req);
    if (token) {
      const session = this.verifySessionToken(token);
      if (session) {
        req.user = session;
      }
    }
    next();
  };
}
