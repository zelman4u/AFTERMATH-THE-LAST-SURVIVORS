import { Router } from 'express';
import { getAuthStatus, postAuthSession } from '../controllers/authController';
import { requireAuth } from '../middlewares/authMiddleware';

export const authRoutes = Router();

authRoutes.get('/status', getAuthStatus);
authRoutes.post('/session', requireAuth, postAuthSession);
