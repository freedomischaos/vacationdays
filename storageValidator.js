// storageValidator.js

const fs   = require("fs").promises;
const path = require("path");

/**
 * validateStorageRead()
 *
 * - Verifies that `data/` exists and is a directory.
 * - Verifies that `data/defaultData.json` exists and is readable (R_OK).
 * - Throws if any check fails.
 */
async function validateStorageRead() {
  const dataDir     = path.join(__dirname, "data");
  const defaultFile = path.join(dataDir, "defaultData.json");

  // 1) Check that 'data/' exists and is a directory
  let stats;
  try {
    stats = await fs.stat(dataDir);
  } catch (statErr) {
    throw new Error(
      `Storage-read check failed: data directory "${dataDir}" is not accessible (${statErr.message}).`
    );
  }
  if (!stats.isDirectory()) {
    throw new Error(`Storage-read check failed: "${dataDir}" exists but is not a directory.`);
  }

  // 2) Check that 'defaultData.json' exists and is readable
  try {
    await fs.access(defaultFile, fs.constants.R_OK);
  } catch (accessErr) {
    throw new Error(
      `Storage-read check failed: "${defaultFile}" is not readable or does not exist (${accessErr.message}).`
    );
  }

  // If we reach here, both checks passed
  return;
}

/**
 * validateStorageWrite()
 *
 * - Verifies that `data/` exists and is a directory.
 * - Attempts to write a temp file (`.write_test.tmp`) inside `data/`.
 * - If writing succeeds, attempts to delete that temp file.
 * - Throws if it cannot write OR if it cannot delete the temp file.
 */
async function validateStorageWrite() {
  const dataDir = path.join(__dirname, "data");
  const testFile = path.join(dataDir, ".write_test.tmp");

  // 1) Ensure the 'data/' folder exists and is a directory
  let stats;
  try {
    stats = await fs.stat(dataDir);
  } catch (statErr) {
    throw new Error(
      `Storage-write check failed: data directory "${dataDir}" is not accessible (${statErr.message}).`
    );
  }
  if (!stats.isDirectory()) {
    throw new Error(`Storage-write check failed: "${dataDir}" exists but is not a directory.`);
  }

  // 2) Try writing a tiny file
  const sampleContent = "ok";
  try {
    await fs.writeFile(testFile, sampleContent, { encoding: "utf8", flag: "w" });
  } catch (writeErr) {
    throw new Error(
      `Storage-write check failed: cannot write to "${testFile}" (${writeErr.message}).`
    );
  }

  // 3) Try deleting the temp file. If this fails, treat it as a fatal error.
  try {
    await fs.unlink(testFile);
  } catch (unlinkErr) {
    throw new Error(
      `Storage-write check failed: wrote "${testFile}" but could not delete it (${unlinkErr.message}).`
    );
  }

  // If we reach here, both write and delete succeeded.
  return;
}

module.exports = {
  validateStorageRead,
  validateStorageWrite,
};
