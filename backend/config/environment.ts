import fs from 'fs';
import path from 'path';

export interface AppEnvironment {
  port: number;
  nodeEnv: string;
  firebaseProjectId: string;
  mongoUri: string;
  adminEmail: string;
  autoSaveIntervalSec: number;
}

function readProjectId(): string {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as { projectId?: string };
      if (parsed.projectId) return parsed.projectId;
    }
  } catch {
    // Fallback below
  }
  return process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0259642423';
}

export const ENV: AppEnvironment = {
  port: 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  firebaseProjectId: readProjectId(),
  mongoUri: process.env.MONGODB_URI || '',
  adminEmail: (process.env.ADMIN_EMAIL || 'funcionelmar@gmail.com').toLowerCase(),
  autoSaveIntervalSec: 45,
};
