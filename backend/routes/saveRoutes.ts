import { Router } from 'express';
import {
  deleteSaveHandler,
  getBackupsHandler,
  getSavesHandler,
  restoreBackupHandler,
  upsertSaveHandler,
} from '../controllers/saveController';

export const saveRoutes = Router();

saveRoutes.get('/', getSavesHandler);
saveRoutes.put('/:slotId', upsertSaveHandler);
saveRoutes.get('/:slotId/backups', getBackupsHandler);
saveRoutes.post('/:slotId/restore/:backupId', restoreBackupHandler);
saveRoutes.delete('/:slotId', deleteSaveHandler);
