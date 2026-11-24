import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSaveRecord } from '../../src/game/simulation';
import {
  hasUnsafeNoSqlKeys,
  isValidSaveSlotId,
  sanitizeGuestOwnerId,
} from '../middlewares/validationMiddleware';
import {
  deleteSaveSlot,
  getSaveBackups,
  listPlayerSaveSlots,
  restoreSaveFromBackup,
  upsertSaveSlot,
} from '../services/gameSaveService';
import { validateAndSanitizeInventory } from '../services/inventoryService';

const TEST_OWNER = 'guest_unit_test_suite';

test('NoSQL injection sanitizer blocks $ and dotted keys recursively', () => {
  assert.equal(hasUnsafeNoSqlKeys({ day: 5, items: [{ itemId: 'bandage', qty: 2 }] }), false);
  assert.equal(hasUnsafeNoSqlKeys({ $ne: null }), true);
  assert.equal(hasUnsafeNoSqlKeys({ payload: { 'inventory.0': 99 } }), true);
  assert.equal(isValidSaveSlotId('active'), true);
  assert.equal(isValidSaveSlotId('slot_2'), true);
  assert.equal(isValidSaveSlotId('../etc'), false);
  assert.equal(sanitizeGuestOwnerId('guest_abc123'), 'guest_abc123');
  assert.equal(sanitizeGuestOwnerId('admin$123'), 'guest_local');
});

test('Anti-duplication inventory validator rejects forged items and excessive stacks', () => {
  const valid = validateAndSanitizeInventory(
    [
      { itemId: 'bandage', qty: 3 },
      { itemId: 'bandage', qty: 2 },
    ],
    'small_backpack',
  );
  assert.equal(valid.valid, true);
  assert.equal(valid.sanitizedInventory.length, 1);
  assert.equal(valid.sanitizedInventory[0].qty, 5);

  const unknownItem = validateAndSanitizeInventory([{ itemId: 'forged_god_gun', qty: 1 }], 'small_backpack');
  assert.equal(unknownItem.valid, false);

  const dupedStack = validateAndSanitizeInventory([{ itemId: 'bandage', qty: 1500 }], 'military_backpack');
  assert.equal(dupedStack.valid, false);

  const negativeQty = validateAndSanitizeInventory([{ itemId: 'bandage', qty: -5 }], 'small_backpack');
  assert.equal(negativeQty.valid, false);
});

test('Multi-slot saves isolate slot_1/slot_2, rotate up to 10 backups, and restore snapshots', () => {
  deleteSaveSlot(TEST_OWNER, 'slot_1');
  deleteSaveSlot(TEST_OWNER, 'slot_2');

  const baseSave = createInitialSaveRecord({
    ownerId: TEST_OWNER,
    characterId: 'ethan_walker',
    mode: 'story',
    difficulty: 'normal',
  });

  const first = upsertSaveSlot({
    ownerId: TEST_OWNER,
    saveId: 'slot_1',
    incoming: { ...baseSave, day: 2 },
    reason: 'manual',
    syncSource: 'web',
  });
  assert.equal(first.ok, true);
  assert.equal(first.save?.day, 2);

  const second = upsertSaveSlot({
    ownerId: TEST_OWNER,
    saveId: 'slot_1',
    incoming: { ...baseSave, day: 5, version: 2 },
    reason: 'auto',
    syncSource: 'web',
  });
  assert.equal(second.ok, true);
  assert.equal(second.save?.day, 5);

  const slot2 = upsertSaveSlot({
    ownerId: TEST_OWNER,
    saveId: 'slot_2',
    incoming: { ...baseSave, characterId: 'maria_santos', day: 9 },
    reason: 'manual',
    syncSource: 'unity',
  });
  assert.equal(slot2.ok, true);

  const list = listPlayerSaveSlots(TEST_OWNER);
  assert.equal(list.slots.length >= 2, true);

  const backups = getSaveBackups(TEST_OWNER, 'slot_1');
  assert.equal(backups.length >= 1, true);
  assert.equal(backups[0].day, 2);

  const restored = restoreSaveFromBackup(TEST_OWNER, 'slot_1', backups[0].backupId);
  assert.equal(restored.ok, true);
  assert.equal(restored.save?.day, 2);

  // Clean up test owner entries
  deleteSaveSlot(TEST_OWNER, 'slot_1');
  deleteSaveSlot(TEST_OWNER, 'slot_2');
});
