import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

import { StudentPageShell, StudentSectionCard } from "../components/student/StudentPageShell";
import { studentApi } from "../lib/api";

export default function StudentHomePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    studentApi
      .dashboard()
      .then((response) => setData(response))
      .catch((dashboardError) => setError(dashboardError.message));
  }, []);

  return (
    <StudentPageShell
      badge="Student Dashboard"
      title="Classes, materials, results, and published updates"
      description="Student support remains lighter than admin and teacher, but it now reflects the class loop more directly: pending work, announcements, results, and remedial visibility."
      icon={Sparkles}
      meta={
        <>
          <span>{data?.summary.enrolled_sections ?? 0} active classes</span>
          <span>{data?.summary.pending_assignments ?? 0} pending tasks</span>
          <span>{data?.summary.intervention_required ? "intervention active" : "on track"}</span>
        </>
      }
      metrics={[
        { label: "Enrolled Sections", value: data?.summary.enrolled_sections ?? "-", caption: "Current class load" },
        { label: "Published Assignments", value: data?.summary.published_assignments ?? "-", caption: "Visible teacher work" },
        { label: "Pending Assignments", value: data?.summary.pending_assignments ?? "-", caption: "Still waiting on a submission" },
        { label: "Announcements", value: data?.summary.announcements ?? "-", caption: "Published class updates" },
        { label: "Intervention Required", value: data?.summary.intervention_required ? "Yes" : "No", caption: "Mastery follow-up state" },
      ]}
    >

      {error ? <div className="form-error">{error}</div> : null}

      <div className="student-dashboard-grid">
        <StudentSectionCard
          eyebrow="My Sections"
          title="Open a class to view modules, assignments, and announcements"
          description="Each section is the student-facing workspace for content, discussions, resources, and interventions."
        >
          <div className="student-course-grid">
            {(data?.sections || []).map((section) => (
              <article className="student-class-card student-class-card--rich" key={section.id}>
                <div className="student-class-card__header">
                  <div>
                    <p className="student-class-card__eyebrow">{section.grade_level}</p>
                    <h3>{section.name}</h3>
                  </div>
                  <span className="pill">{section.school_year}</span>
                </div>
                <p className="student-class-card__description">
                  Enter this workspace to continue assignments, review announcements, and check whether remedial work has opened.
                </p>
                <div className="student-class-card__meta-grid">
                  <div>
                    <strong>{data?.summary.pending_assignments ?? 0}</strong>
                    <span>Pending work</span>
                  </div>
                  <div>
                    <strong>{data?.summary.announcements ?? 0}</strong>
                    <span>Announcements</span>
                  </div>
                </div>
                <Link className="student-cta-button" to={`/student/classes/${section.id}`}>
                  Open class
                </Link>
              </article>
            ))}
          </div>
        </StudentSectionCard>

        <StudentSectionCard
          eyebrow="Today"
          title="Student pulse"
          description="A compact at-a-glance rail modeled after the denser parent dashboard surfaces."
        >
          <div className="student-pulse-list">
            <article className="student-pulse-card">
              <p className="student-pulse-card__label">Pending Assignments</p>
              <strong>{data?.summary.pending_assignments ?? 0}</strong>
              <span>Work still waiting on a submission from you.</span>
            </article>
            <article className="student-pulse-card">
              <p className="student-pulse-card__label">Latest Results</p>
              <strong>{data?.results?.length ?? 0}</strong>
              <span>Graded outcomes currently visible in your record.</span>
            </article>
            <article className="student-pulse-card">
              <p className="student-pulse-card__label">Mastery Status</p>
              <strong>{data?.summary.intervention_required ? "Review needed" : "On track"}</strong>
              <span>Intervention visibility updates when a teacher flags below-threshold performance.</span>
            </article>
          </div>
        </StudentSectionCard>
      </div>

      <StudentSectionCard
        eyebrow="Latest Results"
        title="Recent graded outcomes"
        description="Pending resubmissions no longer show stale grades while waiting for teacher review."
      >
        <div className="student-result-grid">
          {(data?.results || []).map((result) => {
            const statusTone =
              result.submission_status === "submitted"
                ? "student-result-card--awaiting"
                : Number(result.percentage) < 74
                  ? "student-result-card--risk"
                  : "student-result-card--passing";

            return (
              <article className={`student-result-card ${statusTone}`} key={`${result.assignment_id}-${result.section_id}`}>
                <div className="student-result-card__header">
                  <div>
                    <strong>{result.assignment_title || result.assignment_id}</strong>
                    <span>{result.section_name || result.section_id}</span>
                  </div>
                  <span className="teacher-record-pill">
                    {result.submission_status || result.remarks || "-"}
                  </span>
                </div>

                <div className="student-result-card__metrics">
                  <div>
                    <strong>Score</strong>
                    <span>{result.score ?? "-"}</span>
                  </div>
                  <div>
                    <strong>Percentage</strong>
                    <span>{result.percentage != null ? `${result.percentage}%` : "-"}</span>
                  </div>
                </div>

                <div className="student-result-card__feedback">
                  <p>{result.feedback || result.remarks || "No feedback attached to this result yet."}</p>
                </div>
              </article>
            );
          })}
        </div>
      </StudentSectionCard>
    </StudentPageShell>
  );
}
