import { Router } from 'express';
import { validateInventoryEndpoint } from '../controllers/inventoryController';

export const inventoryRoutes = Router();

inventoryRoutes.post('/validate', validateInventoryEndpoint);
