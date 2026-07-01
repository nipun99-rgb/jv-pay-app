const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "projects.db");

let _db = null;

/** Persist the in-memory database to disk */
function save() {
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/** Initialise (load from disk or create fresh) and return the db */
async function getDb() {
  if (_db) return _db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      baseline    TEXT NOT NULL,
      pdf_path    TEXT,
      created_at  TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Migration: add pdf_path to existing DBs
  try { _db.run("ALTER TABLE projects ADD COLUMN pdf_path TEXT"); } catch (e) {}

  _db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL,
      step_number INTEGER NOT NULL,
      step_name   TEXT NOT NULL,
      status      TEXT DEFAULT 'pending',
      created_at  TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS line_items (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id              INTEGER NOT NULL,
      item_no                 TEXT,
      time_period             TEXT,
      phases                  TEXT,
      type_of_work            TEXT,
      contractor_name         TEXT,
      scheduled_original      REAL DEFAULT 0,
      scheduled_change_orders REAL DEFAULT 0,
      scheduled_current       REAL DEFAULT 0,
      work_completed_prev     REAL DEFAULT 0,
      work_completed_this     REAL DEFAULT 0,
      materials_stored        REAL DEFAULT 0,
      total_completed         REAL DEFAULT 0,
      pct                     TEXT,
      balance_to_finish       REAL DEFAULT 0,
      retainage               REAL DEFAULT 0,
      source_page             INTEGER,
      review_notes            TEXT,
      validation_status       TEXT DEFAULT 'unchecked',
      validation_note         TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // Migration: add validation columns to existing DBs
  try { _db.run("ALTER TABLE line_items ADD COLUMN validation_status TEXT DEFAULT 'unchecked'"); } catch (e) {}
  try { _db.run("ALTER TABLE line_items ADD COLUMN validation_note TEXT"); } catch (e) {}

  _db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL,
      level       TEXT DEFAULT 'info',
      message     TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS cover_page (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id            INTEGER NOT NULL UNIQUE,
      to_owner              TEXT,
      from_contractor       TEXT,
      project_name          TEXT,
      application_no        TEXT,
      period                TEXT,
      original_contract_sum REAL,
      net_change_orders     REAL,
      contract_sum_to_date  REAL,
      total_completed_stored REAL,
      retainage_completed   REAL,
      retainage_materials   REAL,
      total_retainage       REAL,
      total_earned_less_ret REAL,
      less_prev_certificates REAL,
      current_payment_due   REAL,
      balance_to_finish     REAL,
      change_order_summary  TEXT,
      architect_signature   TEXT,
      contractor_signature  TEXT,
      source_page           INTEGER DEFAULT 1,
      review_notes          TEXT,
      validation_notes      TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // Migration: add cover_page validation column to existing DBs
  try { _db.run("ALTER TABLE cover_page ADD COLUMN validation_notes TEXT"); } catch (e) {}

  // ── Subcontractor applications (Phase 2) ──────────────────────────────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS subcontractor_applications (
      id                          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id                  INTEGER NOT NULL,
      seq_id                      INTEGER,
      start_page                  INTEGER,
      end_page                    INTEGER,
      document_type               TEXT,
      document_category           TEXT,
      subcontractor_name          TEXT,
      application_no              TEXT,
      application_date            TEXT,
      period_from                 TEXT,
      period_to                   TEXT,
      invoice_to                  TEXT,
      project_name_on_doc         TEXT,
      contract_po_number          TEXT,
      original_contract_sum       REAL,
      net_change_orders           REAL,
      contract_sum_to_date        REAL,
      total_completed_stored      REAL,
      completed_work_this_period  REAL,
      total_retainage             REAL,
      retainage_percent           REAL,
      total_earned_less_retainage REAL,
      less_prev_certificates      REAL,
      current_payment_due         REAL,
      balance_to_finish           REAL,
      g703_scheduled_value        REAL,
      g703_work_prev              REAL,
      g703_work_this_period       REAL,
      g703_materials_stored       REAL,
      g703_total_completed        REAL,
      g703_retainage              REAL,
      g703_earned_less_ret        REAL,
      g703_balance_to_finish      REAL,
      recon_flag                  TEXT,
      contractor_signature        TEXT,
      architect_signature         TEXT,
      notarized                   TEXT,
      additional_supporting_docs  TEXT,
      validation_status           TEXT DEFAULT 'unchecked',
      validation_note             TEXT,
      raw_json                    TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // ── Migrate: add validation columns to existing subcontractor_applications rows ──
  try { _db.run("ALTER TABLE subcontractor_applications ADD COLUMN validation_status TEXT DEFAULT 'unchecked'"); } catch (e) {}
  try { _db.run("ALTER TABLE subcontractor_applications ADD COLUMN validation_note TEXT"); } catch (e) {}

  // ── Project phases — track what files have been uploaded per project ───────
  _db.run(`
    CREATE TABLE IF NOT EXISTS project_phases (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id   INTEGER NOT NULL,
      phase_number INTEGER NOT NULL,
      phase_name   TEXT NOT NULL,
      status       TEXT DEFAULT 'pending',
      pdf_path     TEXT,
      item_count   INTEGER DEFAULT 0,
      summary_json TEXT,
      completed_at TEXT,
      UNIQUE(project_id, phase_number),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // ── Migrate existing phase names to new wording ───────────────────────────
  try {
    _db.run("UPDATE project_phases SET phase_name='Contractor Payment Application' WHERE phase_number=1");
    _db.run("UPDATE project_phases SET phase_name='Subcontractor Payment Application' WHERE phase_number=2");
    _db.run("UPDATE project_phases SET phase_name='GC GR' WHERE phase_number=3");
  } catch (e) {}

  save();

  return _db;
}

module.exports = { getDb, save };
