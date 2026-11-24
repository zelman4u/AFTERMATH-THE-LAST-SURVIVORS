import { Router } from 'express';
import { getAdminOverview, getPlayerProfile } from '../controllers/playerController';
import { requireAdmin, requireAuth } from '../middlewares/authMiddleware';

export const playerRoutes = Router();

playerRoutes.get('/profile', getPlayerProfile);
playerRoutes.get('/admin/overview', requireAuth, requireAdmin, getAdminOverview);
