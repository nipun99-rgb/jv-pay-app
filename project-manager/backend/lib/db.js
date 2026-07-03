const { getDb, save } = require("../db");

// Helper: run a SELECT and return rows as plain objects
function query(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = [];
  stmt.bind(params);
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run INSERT/UPDATE/DELETE
function run(db, sql, params = []) {
  db.run(sql, params);
  save();
}

module.exports = { getDb, save, query, run };
