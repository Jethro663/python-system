import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, Users } from "lucide-react";

import { StudentPageShell, StudentSectionCard } from "../components/student/StudentPageShell";
import { studentApi } from "../lib/api";

export default function StudentClassesPage() {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");

  const schoolYears = new Set(classes.map((section) => section.school_year).filter(Boolean)).size;
  const totalModules = classes.reduce((total, section) => total + (section.module_count || 0), 0);
  const totalAssignments = classes.reduce((total, section) => total + (section.assignment_count || 0), 0);
  const pendingAssignments = classes.reduce((total, section) => total + (section.pending_assignment_count || 0), 0);

  useEffect(() => {
    studentApi
      .classes()
      .then((response) => setClasses(response.classes || []))
      .catch((loadError) => setError(loadError.message));
  }, []);

  return (
    <StudentPageShell
      badge="Student Classes"
      title="Open modules, assignments, resources, and updates"
      description="This surface now follows the stronger role shells: direct class cards instead of a thin utility table."
      icon={BookOpen}
      meta={
        <>
          <span>{classes.length} class workspaces</span>
          <span>{schoolYears || 0} school year groups</span>
          <span>{pendingAssignments} pending assessments</span>
        </>
      }
      metrics={[
        { label: "Classes", value: classes.length || "-", caption: "Assigned section workspaces" },
        { label: "School Years", value: schoolYears || "-", caption: "Enrollment spans currently visible" },
        { label: "Modules", value: totalModules || "-", caption: "Published learning materials" },
        { label: "Assessments", value: totalAssignments || "-", caption: "Visible work items" },
      ]}
    >
      <StudentSectionCard
        eyebrow="My Classes"
        title="Assigned section workspaces"
        description="Open each class to continue submissions, review teacher updates, and access remedial content when needed."
      >

        {error ? <div className="form-error">{error}</div> : null}

        <div className="student-course-grid">
          {classes.map((section) => (
            <article className="student-class-card student-class-card--rich" key={section.id}>
              <div className="student-class-card__hero">
                <div className="student-class-card__hero-pattern" />
                <div className="student-class-card__hero-top">
                  <span className="student-class-card__status">{section.status || "Ready"}</span>
                  <span className="pill">{section.school_year || "Active"}</span>
                </div>
                <div className="student-class-card__hero-copy">
                  <p className="student-class-card__eyebrow">{section.subjects?.[0] || section.grade_level || "Class"}</p>
                  <h3>{section.name}</h3>
                  <p className="student-class-card__subline">
                    {section.schedule_text || "Modules, assessments, resources, and updates live inside this workspace."}
                  </p>
                </div>
              </div>

              <div className="student-class-card__header student-class-card__header--body">
                <div>
                  <p className="student-class-card__section-label">Class focus</p>
                  <h3>{section.name}</h3>
                </div>
                <span className="student-class-card__route-chip">
                  {section.pending_assignment_count || 0} pending
                </span>
              </div>
              <p className="student-class-card__description">
                {(section.subjects || []).join(", ") || "Subject details will appear after teacher assignment."}
              </p>

              <div className="student-class-card__kpi-grid">
                <div>
                  <Users size={16} />
                  <strong>{section.grade_level || "-"}</strong>
                  <span>Grade</span>
                </div>
                <div>
                  <CalendarDays size={16} />
                  <strong>{section.school_year || "-"}</strong>
                  <span>School year</span>
                </div>
                <div>
                  <BookOpen size={16} />
                  <strong>{section.module_count || 0}</strong>
                  <span>Learning lane</span>
                </div>
                <div>
                  <ClipboardCheck size={16} />
                  <strong>{section.assignment_count || 0}</strong>
                  <span>Assessment queue</span>
                </div>
              </div>

              <div className="student-class-card__footer">
                <div className="student-class-card__footer-tags">
                  {(section.subjects?.length ? section.subjects : ["Announcements", "Resources", "Calendar"]).map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <Link className="student-cta-button" to={`/student/classes/${section.id}`}>
                  Open class
                  <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ))}
          {!classes.length && !error ? (
            <div className="empty-state">
              No active class enrollments yet. Classes appear here after a teacher or admin adds you to a section.
            </div>
          ) : null}
        </div>
      </StudentSectionCard>
    </StudentPageShell>
  );
}
