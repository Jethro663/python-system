import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, School, Users } from "lucide-react";

import { AdminPageShell, AdminSectionCard } from "../components/admin/AdminPageShell";
import { adminApi } from "../lib/api";

export default function AdminReportsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .reports()
      .then((response) => setData(response))
      .catch((reportsError) => setError(reportsError.message));
  }, []);

  const snapshots = data?.grade_snapshots || [];
  const summary = useMemo(() => {
    const belowMastery = snapshots.filter((grade) => Number(grade.percentage) < 74).length;
    const average = snapshots.length
      ? Math.round(snapshots.reduce((sum, grade) => sum + Number(grade.percentage || 0), 0) / snapshots.length)
      : 0;
    return { belowMastery, average };
  }, [snapshots]);

  return (
    <AdminPageShell
      badge="Reports"
      title="Enrollment and grade snapshots"
      description="A compact admin reporting surface for section coverage, user counts, and current below-mastery grade pressure."
      icon={BarChart3}
      meta={
        <>
          <span>{data?.summary.section_count ?? 0} sections</span>
          <span>{data?.summary.total_enrollments ?? 0} enrollments</span>
          <span>{data?.summary.at_risk_grades ?? 0} below-mastery grades</span>
        </>
      }
      metrics={[
        {
          label: "Total Enrollments",
          value: data?.summary.total_enrollments ?? "-",
          caption: "Rostered section memberships",
        },
        {
          label: "Sections",
          value: data?.summary.section_count ?? "-",
          caption: "Classes represented in the report",
        },
        { label: "Users", value: data?.summary.user_count ?? "-", caption: "Accounts in scope" },
        {
          label: "Below Mastery",
          value: data?.summary.at_risk_grades ?? "-",
          caption: "Grades below threshold",
        },
      ]}
    >
      <AdminSectionCard
        eyebrow="Reports"
        title="Reporting pulse"
        description="Use this summary to see whether enrollment, grade pressure, and section spread look healthy before drilling into role-specific pages."
        action={<span className="admin-tag-chip">Executive view</span>}
      >
        {error ? <div className="form-error">{error}</div> : null}

        <div className="admin-report-pulse-grid">
          <article className="admin-report-pulse-card">
            <School size={18} />
            <div>
              <strong>{data?.summary.section_count ?? 0}</strong>
              <span>sections represented in the current report output</span>
            </div>
          </article>
          <article className="admin-report-pulse-card">
            <Users size={18} />
            <div>
              <strong>{data?.summary.user_count ?? 0}</strong>
              <span>accounts visible inside the reporting scope</span>
            </div>
          </article>
          <article className="admin-report-pulse-card">
            <AlertTriangle size={18} />
            <div>
              <strong>{summary.belowMastery}</strong>
              <span>grade rows currently landing below the mastery threshold</span>
            </div>
          </article>
          <article className="admin-report-pulse-card">
            <BarChart3 size={18} />
            <div>
              <strong>{summary.average ? `${summary.average}%` : "-"}</strong>
              <span>rough average across the currently visible snapshot rows</span>
            </div>
          </article>
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        eyebrow="Grade Snapshot"
        title="Enrollment and grade rows"
        description="This is the admin summary layer before drilling into teacher or student views."
        action={<span className="admin-tag-chip">Snapshot view</span>}
      >
        <div className="admin-report-grid">
          {snapshots.map((grade, index) => (
            <article className="admin-report-card" key={`${grade.assignment_id}-${grade.student_user_id}-${index}`}>
              <div className="admin-report-card__header">
                <div>
                  <p className="admin-report-card__eyebrow">{grade.section_name || grade.section_id}</p>
                  <strong>{grade.student_name || grade.student_user_id}</strong>
                  <span>{grade.assignment_title || grade.assignment_id}</span>
                </div>
                <span
                  className={`teacher-record-pill ${
                    Number(grade.percentage) < 74
                      ? "teacher-record-pill--risk"
                      : "teacher-record-pill--passing"
                  }`}
                >
                  {grade.percentage}%
                </span>
              </div>
              <div className="admin-report-card__metrics">
                <div>
                  <strong>Section</strong>
                  <span>{grade.section_name || grade.section_id}</span>
                </div>
                <div>
                  <strong>Score</strong>
                  <span>{grade.score}</span>
                </div>
              </div>
              <p className="admin-report-card__note">{grade.remarks || "No remarks attached to this row."}</p>
            </article>
          ))}
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
