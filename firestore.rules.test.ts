import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = fs.readFileSync('firestore.rules', 'utf8');

test('firestore.rules includes default-deny catch-all and Eight Pillars guards', () => {
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  assert.match(rules, /email_verified == true/);
  assert.match(rules, /isValidUserProfile\(incoming\(\)\)/);
  assert.match(rules, /isValidGameSave\(incoming\(\), saveId\)/);
  assert.match(rules, /allow list: if false;/);
  assert.match(rules, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly/);
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rules, /allow get: if isVerifiedOwner\(userId\) && isValidId\(saveId\) && \(resource == null \|\| existing\(\)\.ownerId == request\.auth\.uid\)/);
});
