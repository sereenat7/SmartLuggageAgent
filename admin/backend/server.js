const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = require("./app");
const initializeDatabase = require("./utils/initDB");
const seedDefaultAdmin = require("./utils/seedAdmin");
const { startMailboxSyncScheduler } = require("./utils/mailboxSync");

const port = Number(process.env.PORT || 5001);
const host = "0.0.0.0";

initializeDatabase(() => {
  seedDefaultAdmin().then(() => {
    app.listen(port, host, () => {
      console.log("------------------------------------");
      console.log(`✅ Admin API running on http://${host}:${port}`);
      console.log("------------------------------------");
    });

    startMailboxSyncScheduler(60000);
    console.log("✅ Mailbox sync scheduler started (every 60s)");
  });
});
