import { useEffect, useMemo, useState } from "react";
import { Activity, LockKeyhole, Settings2, UserCog } from "lucide-react";

import { AdminPageShell, AdminSectionCard } from "../components/admin/AdminPageShell";
import { adminApi } from "../lib/api";

function getActionIcon(action = "") {
  const value = action.toLowerCase();
  if (value.includes("login") || value.includes("logout")) return LockKeyhole;
  if (value.includes("setting") || value.includes("transition")) return Settings2;
  return UserCog;
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .audit()
      .then((data) => setEntries(data.entries || []))
      .catch((auditError) => setError(auditError.message));
  }, []);

  const summary = useMemo(() => {
    const logins = entries.filter((entry) => String(entry.action || "").toLowerCase().includes("login")).length;
    const settings = entries.filter((entry) => String(entry.action || "").toLowerCase().includes("setting")).length;
    const userChanges = entries.filter((entry) => String(entry.entity_type || "").toLowerCase().includes("user")).length;
    return { logins, settings, userChanges };
  }, [entries]);

  return (
    <AdminPageShell
      badge="Diagnostics & Audit Trail"
      title="Recent admin and auth activity"
      description="This covers the docx requirement to log logins, imports, settings changes, and major admin actions."
      icon={Activity}
      meta={
        <>
          <span>{entries.length} visible events</span>
          <span>{summary.logins} auth actions</span>
          <span>{summary.settings} settings changes</span>
        </>
      }
      metrics={[
        { label: "Audit Entries", value: entries.length || "-", caption: "Visible log rows" },
        { label: "Auth Events", value: summary.logins, caption: "Login or logout activity" },
        { label: "Settings Events", value: summary.settings, caption: "Configuration-level changes" },
        { label: "User Changes", value: summary.userChanges, caption: "User-related activity captured" },
      ]}
    >
      <AdminSectionCard
        eyebrow="Operations Snapshot"
        title="What the audit trail is seeing"
        description="A denser operations overview so this route feels closer to the parent folder's admin diagnostics surfaces."
        action={<span className="admin-tag-chip">Operations feed</span>}
      >
        <div className="admin-audit-summary-grid">
          <article className="admin-audit-summary-card">
            <LockKeyhole size={18} />
            <div>
              <strong>{summary.logins}</strong>
              <span>authentication events captured across the visible window</span>
            </div>
          </article>
          <article className="admin-audit-summary-card">
            <Settings2 size={18} />
            <div>
              <strong>{summary.settings}</strong>
              <span>configuration changes recorded from the admin side</span>
            </div>
          </article>
          <article className="admin-audit-summary-card">
            <UserCog size={18} />
            <div>
              <strong>{summary.userChanges}</strong>
              <span>user lifecycle or provisioning events in the current feed</span>
            </div>
          </article>
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        eyebrow="Diagnostics & Audit Trail"
        title="Recent admin and auth activity"
        description="Cross-role admin, auth, and operations events are recorded here for review."
        action={<span className="admin-tag-chip">Activity feed</span>}
      >
        {error ? <div className="form-error">{error}</div> : null}

        <div className="admin-audit-grid">
          {entries.map((entry) => {
            const Icon = getActionIcon(entry.action);
            return (
              <article className="admin-audit-card" key={entry.id}>
                <div className="admin-audit-card__header">
                  <div className="admin-audit-card__icon">
                    <Icon size={18} />
                  </div>
                  <div className="admin-audit-card__copy">
                    <strong>{entry.action}</strong>
                    <span>{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                  <span className="teacher-record-pill teacher-record-pill--pending">{entry.entity_type}</span>
                </div>

                <div className="admin-audit-card__metrics">
                  <div>
                    <strong>Entity ID</strong>
                    <span>{entry.entity_id ?? "-"}</span>
                  </div>
                  <div>
                    <strong>Event family</strong>
                    <span>Activity captured</span>
                  </div>
                </div>

                <div className="admin-audit-card__payload">
                  <p>Payload</p>
                  <code className="audit-code">{JSON.stringify(entry.meta_json || {})}</code>
                </div>
              </article>
            );
          })}
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
