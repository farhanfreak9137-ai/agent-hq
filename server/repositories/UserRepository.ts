import Database from 'better-sqlite3';

export interface UserEntity {
  id: string;
  username: string;
  password_hash: string;
  role: 'ADMIN' | 'USER';
  created_at: number;
  updated_at: number;
}

export class UserRepository {
  constructor(private db: Database.Database) {}

  public findByUsername(username: string): UserEntity | null {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    return (row as UserEntity) || null;
  }

  public findById(id: string): UserEntity | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return (row as UserEntity) || null;
  }

  public create(user: Omit<UserEntity, 'created_at' | 'updated_at'>): UserEntity {
    const now = Date.now();
    this.db
      .prepare(
        'INSERT INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(user.id, user.username, user.password_hash, user.role, now, now);

    return { ...user, created_at: now, updated_at: now };
  }

  public list(): Omit<UserEntity, 'password_hash'>[] {
    return this.db
      .prepare('SELECT id, username, role, created_at, updated_at FROM users')
      .all() as Omit<UserEntity, 'password_hash'>[];
  }
}
