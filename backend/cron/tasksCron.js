const cron = require("node-cron");
const pool = require("../../db");

function initCron() {
  cron.schedule("25 10 * * *", async () => {
    console.log("CRON JOB: Cleaning soft-deleted tasks");
    try {
      await pool.query("DELETE FROM tasks WHERE is_deleted = TRUE");
    } catch (err) {
      console.error("CRON JOB ERROR: ", err);
    }
  });

  cron.schedule("26 10 * * *", async () => {
    console.log("CRON JOB: Archiving old tasks");
    try {
      await pool.query(
        `
        UPDATE tasks 
        SET column_id = 'archived'
        WHERE column_id = 'done'
        AND created_at < NOW() - INTERVAL '30 days'
        AND is_deleted = FALSE
        `,
      );
    } catch (err) {
      console.error("CRON JOB ERROR: ", err);
    }
  });
}

module.exports = { initCron };
