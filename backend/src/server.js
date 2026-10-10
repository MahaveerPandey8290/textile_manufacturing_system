import { config } from './config/env.js';
import { pool } from './db/pool.js';
import { createApp } from './app.js';

const server = createApp().listen(config.PORT, () => {
  console.log(`MillOS API listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

// Finish in-flight requests and close DB connections cleanly on Ctrl+C / container stop.
function shutDown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutDown('SIGINT'));
process.on('SIGTERM', () => shutDown('SIGTERM'));
