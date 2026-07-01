import "./SubcontractorTable.css";

const fmt = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return v;
};

const fmtMoney = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function ReconBadge({ flag }) {
  if (!flag || flag === "N/A") return <span className="recon-badge na">N/A</span>;
  if (flag === "MATCH") return <span className="recon-badge match">✓ MATCH</span>;
  return <span className="recon-badge diff">⚠ {flag}</span>;
}

function SigBadge({ val }) {
  if (!val) return <span className="sig-badge unknown">—</span>;
  const upper = val.trim().toUpperCase();
  if (upper === "YES") return <span className="sig-badge yes">✓</span>;
  if (upper === "NO")  return <span className="sig-badge no">✗</span>;
  return <span className="sig-badge unknown">{val}</span>;
}

export default function SubcontractorTable({ apps }) {
  if (!apps || apps.length === 0) {
    return (
      <div className="sub-empty">
        <p>No subcontractor applications found yet.</p>
        <p className="sub-empty-hint">Upload the subcontractor PDF in the Journey panel above and run extraction.</p>
      </div>
    );
  }

  // Summary stats
  const totalDue = apps.reduce((s, a) => s + (parseFloat(a.current_payment_due) || 0), 0);
  const diffCount = apps.filter((a) => a.recon_flag && a.recon_flag !== "MATCH" && a.recon_flag !== "N/A").length;
  const noSigCount = apps.filter((a) => (a.contractor_signature || "").trim().toUpperCase() !== "YES").length;

  return (
    <div className="sub-wrapper">
      {/* ── Summary bar ── */}
      <div className="sub-summary-bar">
        <div className="sub-stat">
          <span className="sub-stat-val">{apps.length}</span>
          <span className="sub-stat-lbl">Applications</span>
        </div>
        <div className="sub-stat">
          <span className="sub-stat-val">{fmtMoney(totalDue)}</span>
          <span className="sub-stat-lbl">Total Due This Period</span>
        </div>
        <div className={`sub-stat ${diffCount > 0 ? "warn" : "ok"}`}>
          <span className="sub-stat-val">{diffCount}</span>
          <span className="sub-stat-lbl">G702 vs G703 Discrepancies</span>
        </div>
        <div className={`sub-stat ${noSigCount > 0 ? "warn" : "ok"}`}>
          <span className="sub-stat-val">{noSigCount}</span>
          <span className="sub-stat-lbl">Missing Signatures</span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="sub-scroll">
        <table className="sub-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Subcontractor</th>
              <th>App No.</th>
              <th>Period</th>
              <th>Contract Sum</th>
              <th>Completed to Date</th>
              <th>This Period</th>
              <th>Retainage</th>
              <th>Current Payment Due</th>
              <th>G702 vs G703</th>
              <th>Contractor Sig</th>
              <th>Arch Sig</th>
              <th>Supporting Docs</th>
              <th>Pages</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => {
              const isWarning = app.recon_flag && app.recon_flag !== "MATCH" && app.recon_flag !== "N/A";
              const noSig = (app.contractor_signature || "").trim().toUpperCase() !== "YES";
              return (
                <tr
                  key={app.id}
                  className={isWarning || noSig ? "sub-row-warn" : ""}
                >
                  <td className="sub-seq">{app.seq_id}</td>
                  <td className="sub-name">{app.subcontractor_name || "—"}</td>
                  <td className="sub-appno">{fmt(app.application_no)}</td>
                  <td className="sub-period">
                    {app.period_from || app.period_to
                      ? `${app.period_from || "?"} – ${app.period_to || "?"}`
                      : "—"}
                  </td>
                  <td className="sub-money">{fmtMoney(app.contract_sum_to_date)}</td>
                  <td className="sub-money">{fmtMoney(app.total_completed_stored)}</td>
                  <td className="sub-money sub-this">{fmtMoney(app.completed_work_this_period)}</td>
                  <td className="sub-money">{fmtMoney(app.total_retainage)}</td>
                  <td className="sub-money sub-due">{fmtMoney(app.current_payment_due)}</td>
                  <td><ReconBadge flag={app.recon_flag} /></td>
                  <td><SigBadge val={app.contractor_signature} /></td>
                  <td><SigBadge val={app.architect_signature} /></td>
                  <td className="sub-docs">{app.additional_supporting_docs || "—"}</td>
                  <td className="sub-pages">
                    {app.start_page}
                    {app.end_page && app.end_page !== app.start_page ? `–${app.end_page}` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
