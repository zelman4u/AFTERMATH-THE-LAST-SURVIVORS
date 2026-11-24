import type { Request, Response } from 'express';
import { syncAuthenticatedUser } from '../services/authenticationService';

export function postAuthSession(req: Request, res: Response) {
  if (!req.authUser) {
    res.status(401).json({ error: 'Valid Google Firebase Bearer token required.' });
    return;
  }
  const userDoc = syncAuthenticatedUser(req.authUser);
  res.json({
    user: userDoc,
    isAdmin: req.authUser.isAdmin,
  });
}

export function getAuthStatus(req: Request, res: Response) {
  if (!req.authUser) {
    res.json({ authenticated: false, isAdmin: false, user: null });
    return;
  }
  res.json({
    authenticated: true,
    isAdmin: req.authUser.isAdmin,
    user: req.authUser,
  });
}
