#!/usr/bin/env node
// Blocks until the Docker Postgres accepts connections (up to ~30s), so
// `npm run db:reset` can chain `docker compose up` straight into migrations.
// Exits 0 when ready, 1 with an actionable message when it gives up.

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { waitForDatabase } = require('../src/db/waitForDb');

waitForDatabase({ log: (message) => console.log(`[wait-for-db] ${message}`) })
  .then(() => {
    console.log('[wait-for-db] PostgreSQL is ready.');
  })
  .catch((err) => {
    console.error(`[wait-for-db] ${err.message}`);
    process.exit(1);
  });
