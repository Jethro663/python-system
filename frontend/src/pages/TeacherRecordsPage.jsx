import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookMarked, CheckCircle2, Users } from "lucide-react";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

function getStudentRecordState(student) {
  const grades = student.grades || [];
  const latest = grades[grades.length - 1];

  if (!latest) {
    return {
      label: "Pending",
      className: "teacher-record-pill teacher-record-pill--pending",
      percentage: null,
    };
  }

  if (latest.percentage < 74) {
    return {
      label: "At risk",
      className: "teacher-record-pill teacher-record-pill--risk",
      percentage: latest.percentage,
    };
  }

  return {
    label: "Passing",
    className: "teacher-record-pill teacher-record-pill--passing",
    percentage: latest.percentage,
  };
}

export default function TeacherRecordsPage() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    teacherApi
      .records()
      .then((response) => {
        setRecords(response.class_records || []);
        setSummary(response.summary || null);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const derived = useMemo(() => {
    const students = records.flatMap((record) => record.students || []);
    const pending = students.filter((student) => !(student.grades || []).length).length;
    const atRisk = students.filter((student) => {
      const latest = (student.grades || []).slice(-1)[0];
      return latest && latest.percentage < 74;
    }).length;

    return {
      pending,
      atRisk,
      totalStudents: students.length,
    };
  }, [records]);

  return (
    <TeacherPageShell
      badge="Teacher Records"
      title="Manage class records"
      description="Per-class grade visibility with pass and at-risk signals for each enrolled student."
      metrics={[
        { label: "Classes", value: summary?.classes ?? "-", caption: "Classes represented in the records view" },
        { label: "Assignments", value: summary?.assignments ?? "-", caption: "Assessments contributing to records" },
        { label: "Open Interventions", value: summary?.open_interventions ?? "-", caption: "Students still below mastery" },
        { label: "Pending Grades", value: derived.pending, caption: "Students still waiting for a graded result" },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}

      <TeacherSectionCard
        eyebrow="Records Snapshot"
        title="Class record pulse"
        description="Use this overview to see how much of the gradebook is healthy, pending, or sliding below mastery."
      >
        <div className="teacher-record-pulse-grid">
          <article className="teacher-record-pulse-card">
            <Users size={18} />
            <div>
              <strong>{derived.totalStudents}</strong>
              <span>students represented across all class record groups</span>
            </div>
          </article>
          <article className="teacher-record-pulse-card">
            <CheckCircle2 size={18} />
            <div>
              <strong>{Math.max(derived.totalStudents - derived.pending - derived.atRisk, 0)}</strong>
              <span>students currently sitting in a passing state</span>
            </div>
          </article>
          <article className="teacher-record-pulse-card">
            <AlertTriangle size={18} />
            <div>
              <strong>{derived.atRisk}</strong>
              <span>students below the 74% mastery threshold</span>
            </div>
          </article>
          <article className="teacher-record-pulse-card">
            <BookMarked size={18} />
            <div>
              <strong>{derived.pending}</strong>
              <span>students with no recorded score yet</span>
            </div>
          </article>
        </div>
      </TeacherSectionCard>

      {records.map((record) => (
        <TeacherSectionCard
          key={record.section_id}
          eyebrow="Class Record"
          title={record.section_name}
          description="Student grades are grouped by class so the teacher can quickly spot pass or at-risk patterns."
        >
          <div className="teacher-record-summary-grid">
            <div>
              <strong>Students</strong>
              <span>{(record.students || []).length}</span>
            </div>
            <div>
              <strong>At-risk learners</strong>
              <span>
                {(record.students || []).filter((student) => {
                  const latest = (student.grades || []).slice(-1)[0];
                  return latest && latest.percentage < 74;
                }).length}
              </span>
            </div>
            <div>
              <strong>Pending grades</strong>
              <span>{(record.students || []).filter((student) => !(student.grades || []).length).length}</span>
            </div>
            <div>
              <strong>Grade spread</strong>
              <span>
                {(record.students || []).some((student) => (student.grades || []).length)
                  ? "Mixed active gradebook"
                  : "No scores posted yet"}
              </span>
            </div>
          </div>

          <div className="teacher-record-ledger-grid">
            {(record.students || []).map((student) => {
              const grades = student.grades || [];
              const latest = grades[grades.length - 1];
              const state = getStudentRecordState(student);

              return (
                <article className="teacher-record-ledger-card" key={student.student_user_id}>
                  <div className="teacher-record-ledger-card__header">
                    <div>
                      <strong>{student.student_name}</strong>
                      <span>{student.grade_level || "Grade level not set"}</span>
                    </div>
                    <span className={state.className}>{state.label}</span>
                  </div>

                  <div className="teacher-record-ledger-card__metrics">
                    <div>
                      <strong>Latest score</strong>
                      <span>{state.percentage !== null ? `${state.percentage}%` : "Pending"}</span>
                    </div>
                    <div>
                      <strong>All percentages</strong>
                      <span>{grades.length ? grades.map((grade) => `${grade.percentage}%`).join(", ") : "No grades yet"}</span>
                    </div>
                  </div>

                  <p className="teacher-record-ledger-card__note">
                    {latest
                      ? latest.percentage < 74
                        ? "Keep this learner on the intervention watchlist."
                        : "Current performance is above mastery."
                      : "This learner still needs an initial graded result."}
                  </p>
                </article>
              );
            })}
          </div>
        </TeacherSectionCard>
      ))}
    </TeacherPageShell>
  );
}
