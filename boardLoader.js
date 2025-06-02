// boardLoader.js

const fs   = require("fs").promises;
const path = require("path");

/**
 * loadBoardData(boardId)
 *
 * • If data/<boardId>.json exists, just load & return it.
 * • Otherwise, read data/defaultData.json, extract the template (activeBoard),
 *   then override its "name" to boardId.split("_").join(" "), and write that
 *   as data/<boardId>.json. Finally return the parsed new file.
 */
async function loadBoardData(boardId) {
  // 1) Validate that boardId uses only letters, numbers, and underscores
  if (!/^[A-Za-z0-9_]+$/.test(boardId)) {
    throw new Error("Invalid board ID. Only alphanumerics and underscores allowed.");
  }

  // 2) Build the paths
  const dataDir     = path.join(__dirname, "data");
  const defaultFile = path.join(dataDir, "defaultData.json");
  const boardFile   = path.join(dataDir, `${boardId}.json`);

  // 3) Check if boardFile already exists
  try {
    await fs.access(boardFile, fs.constants.R_OK);
    // If we get here, data/<boardId>.json already exists → no initialization needed
  } catch (err) {
    if (err.code === "ENOENT") {
      // boardFile is missing. Initialize it by copying template + overriding "name"
      let rawDefault;
      try {
        rawDefault = await fs.readFile(defaultFile, "utf8");
      } catch (readErr) {
        throw new Error(`Cannot read defaultData.json: ${readErr.message}`);
      }

      let defaultData;
      try {
        defaultData = JSON.parse(rawDefault);
      } catch (parseErr) {
        throw new Error(`Invalid JSON in defaultData.json: ${parseErr.message}`);
      }

      // Extract the template board object
      const templateBoardId = defaultData.activeBoard;
      if (
        !defaultData.boards ||
        typeof defaultData.boards !== "object" ||
        !templateBoardId ||
        !defaultData.boards[templateBoardId]
      ) {
        throw new Error(
          `defaultData.json must have a "boards" object and an "activeBoard" key.`
        );
      }

      const templateBoardObject = defaultData.boards[templateBoardId];

      // Override its "name" to match boardId but with underscores replaced by spaces
      const displayName = boardId.replace(/_/g, " ");
      const newBoardObject = {
        ...templateBoardObject,
        name: displayName,
      };

      // Write the new board file
      try {
        await fs.writeFile(
          boardFile,
          JSON.stringify(newBoardObject, null, 2),
          "utf8"
        );
      } catch (writeErr) {
        throw new Error(`Failed to create new board: ${writeErr.message}`);
      }
    } else {
      // Other I/O error
      throw new Error(`Cannot access "${boardFile}": ${err.message}`);
    }
  }

  // 4) Read & parse data/<boardId>.json
  let rawBoard;
  try {
    rawBoard = await fs.readFile(boardFile, "utf8");
  } catch (readErr) {
    throw new Error(`Failed to read "${boardFile}": ${readErr.message}`);
  }

  let boardData;
  try {
    boardData = JSON.parse(rawBoard);
  } catch (parseErr) {
    throw new Error(`Invalid JSON in "${boardFile}": ${parseErr.message}`);
  }

  return boardData;
}

module.exports = { loadBoardData };
