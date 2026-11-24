import fs from 'fs';
import path from 'path';
import { ENV } from './environment';

export interface SaveBackupEntry {
  backupId: string;
  saveId: string;
  ownerId: string;
  version: number;
  day: number;
  characterId: string;
  zoneId: string;
  reason: 'auto' | 'manual' | 'pre_restore' | 'sync';
  createdAtIso: string;
  snapshot: Record<string, unknown>;
}

export interface MongoStoreSnapshot {
  users: Record<string, Record<string, unknown>>;
  players: Record<string, Record<string, unknown>>;
  inventories: Record<string, Record<string, unknown>>;
  worlds: Record<string, Record<string, unknown>>;
  bases: Record<string, Record<string, unknown>>;
  gamesaves: Record<string, Record<string, unknown>>;
  savebackups: Record<string, SaveBackupEntry[]>;
  achievements: Record<string, string[]>;
  auditLogs: {
    id: string;
    ownerId: string;
    action: string;
    status: 'accepted' | 'rejected';
    detail: string;
    timestampIso: string;
  }[];
}

export const COLLECTION_NAMES = [
  'users',
  'players',
  'characters',
  'inventories',
  'weapons',
  'armor',
  'craftingrecipes',
  'bases',
  'worlds',
  'quests',
  'zombies',
  'bosses',
  'gamesaves',
  'achievements',
] as const;

const DB_DIR = path.resolve(process.cwd(), 'backend', 'database');
const DB_FILE = path.join(DB_DIR, 'store.json');

function createEmptyStore(): MongoStoreSnapshot {
  return {
    users: {},
    players: {},
    inventories: {},
    worlds: {},
    bases: {},
    gamesaves: {},
    savebackups: {},
    achievements: {},
    auditLogs: [],
  };
}

class DocumentDatabase {
  private data: MongoStoreSnapshot;
  public readonly mode: 'mongodb-configured' | 'local-document-store';

  constructor() {
    this.mode = ENV.mongoUri ? 'mongodb-configured' : 'local-document-store';
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): MongoStoreSnapshot {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<MongoStoreSnapshot>;
        return {
          ...createEmptyStore(),
          ...parsed,
        };
      }
    } catch {
      // Fallback to fresh store
    }
    return createEmptyStore();
  }

  public persist() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('Database persist warning:', err);
    }
  }

  public getStore(): MongoStoreSnapshot {
    return this.data;
  }

  public appendAuditLog(entry: {
    ownerId: string;
    action: string;
    status: 'accepted' | 'rejected';
    detail: string;
  }) {
    this.data.auditLogs.unshift({
      id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ...entry,
      timestampIso: new Date().toISOString(),
    });
    if (this.data.auditLogs.length > 100) {
      this.data.auditLogs.length = 100;
    }
    this.persist();
  }
}

export const database = new DocumentDatabase();
