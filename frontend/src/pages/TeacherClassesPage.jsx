import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    teacherApi
      .classes()
      .then((response) => setClasses(response.classes || []))
      .catch((loadError) => setError(loadError.message));
  }, []);

  return (
    <TeacherPageShell
      badge="Teacher Classes"
      title="My classes and workspaces"
      description="Open each assigned section through the same workspace pattern used in the main Nexora teacher flow."
      icon={BookOpen}
      headerMeta={
        <>
          <span>{classes.length} assigned classes</span>
          <span>{classes.reduce((sum, item) => sum + (item.student_count || 0), 0)} students</span>
          <span>{classes.reduce((sum, item) => sum + (item.at_risk_students || 0), 0)} at risk</span>
        </>
      }
      metrics={[
        { label: "Assigned Classes", value: classes.length || "-", caption: "Sections mapped to your account" },
        {
          label: "Enrolled Students",
          value: classes.reduce((sum, item) => sum + (item.student_count || 0), 0) || "-",
          caption: "Across current sections",
        },
        {
          label: "At-Risk Students",
          value: classes.reduce((sum, item) => sum + (item.at_risk_students || 0), 0) || "-",
          caption: "Open intervention counts",
        },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}

        <TeacherSectionCard
          eyebrow="Class Directory"
          title="Assigned sections"
          description="Each class card leads into the modules, assignments, records, discussion, and submission review workspace."
          action={<span className="admin-tag-chip">Workspace launch</span>}
        >
        <div className="teacher-class-grid">
          {classes.map((section) => (
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
              <p className="teacher-class-card__subjects">
                Schedule: {section.schedule_text || "Not set"}
              </p>
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
                    <span>Nothing scheduled yet for this class</span>
                  </div>
                ) : null}
              </div>
              <div className="action-row">
                <Link className="teacher-link-button" to={`/teacher/classes/${section.id}`}>
                  Open workspace
                </Link>
              </div>
            </article>
          ))}
        </div>
      </TeacherSectionCard>
    </TeacherPageShell>
  );
}
