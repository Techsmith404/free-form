import fs from 'fs';
import path from 'path';
import os from 'os';
import { afterAll, beforeAll } from 'vitest';

// Create an isolated ephemeral directory for test execution
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freeform-test-'));
process.env.DATA_DIR = tempDir;

afterAll(async () => {
  try {
    // Dynamically import db to close connections before directory cleanup
    const { db } = await import('./db/index.js');
    if (db && db.open) {
      db.close();
    }
  } catch {}

  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
});
