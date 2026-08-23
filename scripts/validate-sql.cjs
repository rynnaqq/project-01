// Validates SQL migration files against the real PostgreSQL grammar using the
// pg-query-emscripten WASM parser. Exits non-zero if any statement fails to parse.
const fs = require('fs');
const path = require('path');
const initPgQuery = require('pg-query-emscripten').default;

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

initPgQuery().then((pg) => {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let failed = false;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const result = pg.parse(sql);
    if (result.error) {
      failed = true;
      console.error(`FAIL ${file}: ${result.error.message} at cursor ${result.error.cursorpos}`);
    } else {
      const count = result.parse_tree && result.parse_tree.stmts ? result.parse_tree.stmts.length : 0;
      console.log(`OK   ${file} (${count} statements parsed)`);
    }
  }

  process.exit(failed ? 1 : 0);
});
