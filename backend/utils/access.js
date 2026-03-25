const pool = require("../../db");

/**
 * Checks if a user has access to a specific board.
 * @param {string} boardId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function checkBoardAccess(boardId, userId) {
  const check = await pool.query(
    `SELECT id FROM boards WHERE id = $1 AND user_id = $2
     UNION
     SELECT board_id FROM board_members WHERE board_id = $1 AND user_id = $2`,
    [boardId, userId],
  );
  return check.rows.length > 0;
}

module.exports = { checkBoardAccess };
