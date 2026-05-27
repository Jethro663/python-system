import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ShieldCheck } from "lucide-react";

import { AdminPageShell, AdminSectionCard } from "../components/admin/AdminPageShell";
import { adminApi } from "../lib/api";

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .dashboard()
      .then((data) => setDashboard(data))
      .catch((dashboardError) => setError(dashboardError.message));
  }, []);

  const totals = dashboard?.totals;
  const metrics = [
    { label: "Total Users", value: totals?.users ?? "-", caption: "Accounts across the portal" },
    { label: "Sections", value: totals?.sections ?? "-", caption: "Mapped class containers" },
    { label: "Students", value: totals?.students ?? "-", caption: "Learner records" },
    { label: "Teachers", value: totals?.teachers ?? "-", caption: "Instruction-side accounts" },
    { label: "Roster Records", value: totals?.roster_records ?? "-", caption: "Imported rows" },
    { label: "Active Interventions", value: totals?.active_interventions ?? "-", caption: "Open support cases" },
  ];
  const quickRoutes = useMemo(
    () => [
      {
        to: "/admin/users",
        label: "Manage Users",
        copy: `${totals?.users ?? 0} accounts under active management`,
      },
      {
        to: "/admin/sections",
        label: "Section Mapping",
        copy: `${totals?.sections ?? 0} class containers aligned to teachers`,
      },
      {
        to: "/admin/roster-import",
        label: "Roster Import",
        copy: `${totals?.roster_records ?? 0} imported learner rows ready for review`,
      },
      {
        to: "/admin/settings",
        label: "System Settings",
        copy: `${totals?.active_interventions ?? 0} live interventions tied to current policies`,
      },
    ],
    [totals?.active_interventions, totals?.roster_records, totals?.sections, totals?.users],
  );
  const healthCards = [
    { label: "User Provisioning", status: totals?.users ? "Healthy" : "Waiting", detail: "Accounts and role access" },
    { label: "Class Mapping", status: totals?.sections ? "Healthy" : "Setup", detail: "Sections and teacher assignment" },
    {
      label: "Roster Readiness",
      status: totals?.roster_records ? "Imported" : "Pending",
      detail: "CSV-backed student load status",
    },
    {
      label: "Intervention Watch",
      status: totals?.active_interventions ? "Attention" : "Stable",
      detail: "Below-threshold learner monitoring",
    },
  ];

  return (
    <AdminPageShell
      badge="Admin Dashboard"
      title="School setup status at a glance"
      description="This mirrors the capstone's admin-first flow: users, sections, rosters, interventions, and recent system movement before teacher operations."
      icon={ShieldCheck}
      meta={
        <>
          <span>Setup readiness</span>
          <span>{totals?.sections ?? 0} mapped sections</span>
          <span>{totals?.active_interventions ?? 0} live interventions</span>
        </>
      }
      metrics={metrics}
    >
      {error ? <div className="form-error">{error}</div> : null}

      <div className="admin-dashboard-grid">
        <AdminSectionCard
          eyebrow="Quick Routes"
          title="Admin control surfaces"
          description="These are the parent-folder style launch points for the admin-first workflow."
        >
          <div className="admin-quick-grid">
            {quickRoutes.map((route) => (
              <Link className="admin-quick-link" key={route.to} to={route.to}>
                <strong>{route.label}</strong>
                <span>{route.copy}</span>
              </Link>
            ))}
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="System Health"
          title="Current setup signal"
          description="A compact readiness read on the same setup path the parent repo emphasizes."
        >
          <div className="admin-health-grid">
            {healthCards.map((card) => (
              <article className="admin-health-card" key={card.label}>
                <p className="admin-health-card__label">{card.label}</p>
                <strong className="admin-health-card__status">{card.status}</strong>
                <span className="admin-health-card__detail">{card.detail}</span>
              </article>
            ))}
          </div>
        </AdminSectionCard>
      </div>

      <AdminSectionCard
        eyebrow="Recent Activity"
        title="Latest administrative actions"
        description="Cross-role activity is surfaced here before it becomes a support issue downstream."
        action={
          <span className="admin-tag-chip">
            <Activity size={14} />
            {dashboard?.recent_activity?.length ?? 0} items
          </span>
        }
      >
        <div className="admin-activity-grid">
          {(dashboard?.recent_activity || []).map((entry) => (
            <article className="admin-activity-card" key={entry.id}>
              <div className="admin-activity-card__header">
                <div>
                  <p className="admin-activity-card__eyebrow">{entry.entity_type}</p>
                  <strong>{entry.action}</strong>
                </div>
                <span className="admin-tag-chip">{new Date(entry.created_at).toLocaleString()}</span>
              </div>
              <p className="admin-activity-card__note">
                {entry.meta_json ? JSON.stringify(entry.meta_json) : "No additional metadata captured."}
              </p>
            </article>
          ))}
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
