import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, School, UserRoundCheck, Users } from "lucide-react";

import { AdminPageShell, AdminSectionCard } from "../components/admin/AdminPageShell";
import { adminApi } from "../lib/api";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .students()
      .then((data) => setStudents(data.students || []))
      .catch((studentsError) => setError(studentsError.message));
  }, []);

  const summary = useMemo(
    () => ({
      support: students.filter((student) => student.intervention_status === "required").length,
      unassigned: students.filter((student) => !student.current_section).length,
      graded: students.filter(
        (student) => student.latest_percentage !== null && student.latest_percentage !== undefined
      ).length,
    }),
    [students]
  );

  return (
    <AdminPageShell
      badge="Student Records"
      title="Profiles, enrollment, and latest grade signals"
      description="This surface keeps the admin-first view of student assignment, section placement, and below-mastery support."
      metrics={[
        { label: "Students", value: students.length || "-", caption: "Visible learner records" },
        { label: "Needs Support", value: summary.support, caption: "Currently flagged students" },
        { label: "Unassigned", value: summary.unassigned, caption: "Learners without a current section" },
        { label: "With Grades", value: summary.graded, caption: "Learners already carrying a latest percentage" },
      ]}
    >
      <AdminSectionCard
        eyebrow="Access Student Records"
        title="Student roster pulse"
        description="Track section placement, latest grade signals, and support status from one admin view."
        action={<span className="admin-tag-chip">Roster pulse</span>}
      >
        {error ? <div className="form-error">{error}</div> : null}

        <div className="admin-student-pulse-grid">
          <article className="admin-student-pulse-card">
            <Users size={18} />
            <div>
              <strong>{students.length}</strong>
              <span>students currently visible in the admin roster view</span>
            </div>
          </article>
          <article className="admin-student-pulse-card">
            <AlertTriangle size={18} />
            <div>
              <strong>{summary.support}</strong>
              <span>students with an active support requirement</span>
            </div>
          </article>
          <article className="admin-student-pulse-card">
            <School size={18} />
            <div>
              <strong>{summary.unassigned}</strong>
              <span>students still missing a current section placement</span>
            </div>
          </article>
          <article className="admin-student-pulse-card">
            <UserRoundCheck size={18} />
            <div>
              <strong>{summary.graded}</strong>
              <span>students already carrying a latest percentage signal</span>
            </div>
          </article>
        </div>

        <div className="admin-student-grid">
          {students.map((student) => (
            <article className="admin-student-card" key={student.id}>
              <div className="admin-student-card__header">
                <div>
                  <p className="admin-student-card__eyebrow">{student.school_id}</p>
                  <strong>{student.full_name}</strong>
                  <span>{student.current_section || "Unassigned"}</span>
                </div>
                <span
                  className={`teacher-record-pill ${
                    student.intervention_status === "required"
                      ? "teacher-record-pill--risk"
                      : "teacher-record-pill--passing"
                  }`}
                >
                  {student.intervention_status}
                </span>
              </div>

              <div className="admin-student-card__metrics">
                <div>
                  <strong>Current section</strong>
                  <span>{student.current_section || "Unassigned"}</span>
                </div>
                <div>
                  <strong>Latest percentage</strong>
                  <span>
                    {student.latest_percentage === null || student.latest_percentage === undefined
                      ? "-"
                      : `${student.latest_percentage}%`}
                  </span>
                </div>
              </div>

              <p className="admin-student-card__note">
                {student.intervention_status === "required"
                  ? "This learner is currently surfacing in the support lane."
                  : "No active support flag is blocking this learner right now."}
              </p>
            </article>
          ))}
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
