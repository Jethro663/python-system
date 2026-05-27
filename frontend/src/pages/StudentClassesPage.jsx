import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, Users } from "lucide-react";

import { StudentPageShell, StudentSectionCard } from "../components/student/StudentPageShell";
import { studentApi } from "../lib/api";

export default function StudentClassesPage() {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");

  const schoolYears = new Set(classes.map((section) => section.school_year).filter(Boolean)).size;

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
          <span>modules, assignments, updates</span>
        </>
      }
      metrics={[
        { label: "Classes", value: classes.length || "-", caption: "Assigned section workspaces" },
        { label: "School Years", value: schoolYears || "-", caption: "Enrollment spans currently visible" },
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
                  <span className="student-class-card__status">Ready</span>
                  <span className="pill">{section.school_year || "Active"}</span>
                </div>
                <div className="student-class-card__hero-copy">
                  <p className="student-class-card__eyebrow">{section.grade_level || "Class"}</p>
                  <h3>{section.name}</h3>
                  <p className="student-class-card__subline">
                    Grade lane, updates, assignments, and shared resources live inside this workspace.
                  </p>
                </div>
              </div>

              <div className="student-class-card__header student-class-card__header--body">
                <div>
                  <p className="student-class-card__section-label">Class focus</p>
                  <h3>{section.name}</h3>
                </div>
                <span className="student-class-card__route-chip">Student workspace</span>
              </div>
              <p className="student-class-card__description">
                Modules, assignments, resources, discussions, and schedule changes all route through this class surface.
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
                  <strong>Modules</strong>
                  <span>Learning lane</span>
                </div>
                <div>
                  <ClipboardCheck size={16} />
                  <strong>Tasks</strong>
                  <span>Assessment queue</span>
                </div>
              </div>

              <div className="student-class-card__footer">
                <div className="student-class-card__footer-tags">
                  <span>Announcements</span>
                  <span>Resources</span>
                  <span>Calendar</span>
                </div>
                <Link className="student-cta-button" to={`/student/classes/${section.id}`}>
                  Open class
                  <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </StudentSectionCard>
    </StudentPageShell>
  );
}
