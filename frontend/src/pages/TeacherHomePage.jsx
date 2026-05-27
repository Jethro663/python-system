import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

export default function TeacherHomePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    teacherApi
      .dashboard()
      .then((response) => setData(response))
      .catch((dashboardError) => setError(dashboardError.message));
  }, []);

  return (
    <TeacherPageShell
      badge="Teacher Dashboard"
      title="Assigned classes, flagged students, and next actions"
      description="The teacher shell now mirrors the main reference direction more closely: class pressure up top, quick workspace entry, and a cleaner assessment-first rhythm."
      icon={BarChart3}
      headerMeta={
        <>
          <span>{data?.summary.assigned_sections ?? 0} live classes</span>
          <span>{data?.summary.pending_submissions ?? 0} pending reviews</span>
          <span>{data?.summary.at_risk_students ?? 0} intervention watch</span>
        </>
      }
      metrics={[
        { label: "Assigned Sections", value: data?.summary.assigned_sections ?? "-", caption: "Current mapped classes" },
        { label: "Enrolled Students", value: data?.summary.enrolled_students ?? "-", caption: "Across your sections" },
        { label: "Draft Assignments", value: data?.summary.draft_assignments ?? "-", caption: "Still unpublished" },
        { label: "Pending Submissions", value: data?.summary.pending_submissions ?? "-", caption: "Waiting for review" },
        { label: "At-Risk Students", value: data?.summary.at_risk_students ?? "-", caption: "Open intervention cases" },
        { label: "Upcoming Events", value: data?.summary.upcoming_events ?? "-", caption: "Calendar load" },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}

      <div className="teacher-dashboard-grid">
        <TeacherSectionCard
          eyebrow="Quick Access"
          title="Open a live class workspace"
          description="Jump straight into the same class shell used for modules, assignments, questions, records, and submissions."
        >
          <div className="teacher-class-grid">
            {(data?.sections || []).map((section) => (
              <article className="teacher-class-card teacher-class-card--featured" key={section.id}>
                <div className="teacher-class-card__header">
                  <div>
                    <p className="teacher-class-card__eyebrow">{section.grade_level}</p>
                    <h3>{section.name}</h3>
                  </div>
                  <span className="pill">{section.school_year}</span>
                </div>
                <p className="teacher-class-card__subjects">
                  {section.subjects?.join(", ") || "No subjects mapped"}
                </p>
                <div className="teacher-class-card__metric-grid">
                  <div>
                    <strong>{section.student_count}</strong>
                    <span>Students</span>
                  </div>
                  <div>
                    <strong>{section.at_risk_students}</strong>
                    <span>At risk</span>
                  </div>
                </div>
                <div className="teacher-event-stack">
                  {(section.upcoming_events || []).slice(0, 2).map((event) => (
                    <div key={event.id}>
                      <strong>{event.title}</strong>
                      <span>{event.event_type}</span>
                    </div>
                  ))}
                  {!section.upcoming_events?.length ? (
                    <div>
                      <strong>No upcoming events</strong>
                      <span>Calendar is clear for this class</span>
                    </div>
                  ) : null}
                </div>
                <Link className="teacher-link-button" to={`/teacher/classes/${section.id}`}>
                  Open workspace
                </Link>
              </article>
            ))}
          </div>
        </TeacherSectionCard>

        <TeacherSectionCard
          eyebrow="Teaching Pulse"
          title="What needs attention now"
          description="A tighter right-rail summary, closer to the parent workspace rhythm."
          action={<span className="admin-tag-chip">Today</span>}
        >
          <div className="teacher-alert-list">
            <article className="teacher-alert-card">
              <p className="teacher-alert-card__label">Pending Reviews</p>
              <strong>{data?.summary.pending_submissions ?? 0}</strong>
              <span>Submissions still waiting on feedback and scoring.</span>
            </article>
            <article className="teacher-alert-card">
              <p className="teacher-alert-card__label">Draft Assessments</p>
              <strong>{data?.summary.draft_assignments ?? 0}</strong>
              <span>Unpublished work that still needs a classroom release decision.</span>
            </article>
            <article className="teacher-alert-card">
              <p className="teacher-alert-card__label">Intervention Watch</p>
              <strong>{data?.summary.at_risk_students ?? 0}</strong>
              <span>Learners currently below the mastery threshold.</span>
            </article>
          </div>
        </TeacherSectionCard>
      </div>
    </TeacherPageShell>
  );
}
