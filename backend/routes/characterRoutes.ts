import { Router } from 'express';
import { listCharacters } from '../controllers/characterController';

export const characterRoutes = Router();

characterRoutes.get('/', listCharacters);
