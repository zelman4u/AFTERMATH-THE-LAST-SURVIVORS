import type { Request, Response } from 'express';
import { getAllCharacterDocuments } from '../models/Character';

export function listCharacters(_req: Request, res: Response) {
  res.json({ characters: getAllCharacterDocuments() });
}
