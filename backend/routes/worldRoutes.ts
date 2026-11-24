import { Router } from 'express';
import { getWorldConfiguration } from '../controllers/worldController';

export const worldRoutes = Router();

worldRoutes.get('/config', getWorldConfiguration);
