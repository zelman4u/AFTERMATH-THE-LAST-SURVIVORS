import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { ENV } from '../config/environment';

export interface VerifiedAuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: VerifiedAuthUser | null;
    }
  }
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> = {};
let certsExpireAt = 0;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < certsExpireAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }
  const resp = await fetch(GOOGLE_CERTS_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch Firebase public certs (${resp.status})`);
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = (await resp.json()) as Record<string, string>;
  certsExpireAt = now + maxAgeSec * 1000;
  return cachedCerts;
}

function decodeBase64Url(segment: string): Buffer {
  const pad = segment.length % 4 === 0 ? '' : '='.repeat(4 - (segment.length % 4));
  return Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export async function verifyFirebaseIdToken(token: string): Promise<VerifiedAuthUser | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(decodeBase64Url(headerB64).toString('utf-8')) as {
    alg?: string;
    kid?: string;
  };
  const payload = JSON.parse(decodeBase64Url(payloadB64).toString('utf-8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (header.alg !== 'RS256' || !header.kid) return null;
  if (payload.aud !== ENV.firebaseProjectId) return null;
  if (payload.iss !== `https://securetoken.google.com/${ENV.firebaseProjectId}`) return null;
  if (!payload.sub || typeof payload.sub !== 'string') return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSec) return null;

  const certs = await getFirebasePublicCerts();
  const cert = certs[header.kid];
  if (!cert) return null;

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const validSig = verifier.verify(cert, decodeBase64Url(sigB64));
  if (!validSig) return null;

  const email = (payload.email || '').toLowerCase();
  const emailVerified = Boolean(payload.email_verified);
  return {
    uid: payload.sub,
    email,
    emailVerified,
    name: payload.name || 'Survivor',
    picture: payload.picture || '',
    isAdmin: emailVerified && email === ENV.adminEmail,
  };
}

export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        req.authUser = await verifyFirebaseIdToken(token);
      } catch {
        req.authUser = null;
      }
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser || !req.authUser.uid) {
    res.status(401).json({ error: 'Authentication required. Sign in with Google first.' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser || !req.authUser.isAdmin) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }
  next();
}
