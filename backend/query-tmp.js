const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'autorisations_parentales' ORDER BY ordinal_position"))
  .then(r => { console.table(r.rows); return c.end(); })
  .catch(e => { console.error(e); c.end(); });
