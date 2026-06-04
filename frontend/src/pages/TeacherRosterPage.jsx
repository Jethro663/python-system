import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, UserPlus2, Users } from "lucide-react";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

export default function TeacherRosterPage() {
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [roster, setRoster] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const loadRoster = async (sectionId) => {
    try {
      const data = await teacherApi.roster();
      const grouped = data.sections || [];
      setSections(grouped);
      const nextSectionId = sectionId || selectedSectionId || String(grouped[0]?.section?.id || "");
      if (nextSectionId) {
        setSelectedSectionId(String(nextSectionId));
        const details = await teacherApi.classRoster(nextSectionId);
        setRoster(details);
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadRoster();
  }, []);

  const summary = useMemo(() => {
    const students = roster?.students || [];
    return {
      interventions: students.filter((student) => student.intervention_status === "open").length,
      atRisk: students.filter((student) => Number(student.latest_percentage) < 74).length,
    };
  }, [roster]);

  return (
    <TeacherPageShell
      badge="Teacher Roster"
      title="Class roster and enrollment visibility"
      description="Review enrolled students, recent results, support state, and optionally add eligible students to a class."
      headerMeta={
        <>
          <span>{sections.length} assigned classes</span>
          <span>{roster?.students?.length ?? 0} enrolled learners</span>
          <span>{roster?.eligible_students?.length ?? 0} eligible additions</span>
        </>
      }
      metrics={[
        { label: "Assigned Classes", value: sections.length || "-", caption: "Classes visible to this teacher" },
        { label: "Enrolled Students", value: roster?.students?.length ?? "-", caption: "Current class roster size" },
        { label: "Eligible Additions", value: roster?.eligible_students?.length ?? "-", caption: "Students available for optional add" },
        { label: "Open Flags", value: summary.interventions, caption: "Students with active support state" },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <TeacherSectionCard
        eyebrow="Roster Scope"
        title="Choose a class"
        description="Switch between assigned classes to manage enrolled students and optional add-ins."
        actions={
          <select
            className="table-search"
            value={selectedSectionId}
            onChange={async (event) => {
              setSelectedSectionId(event.target.value);
              setError("");
              setSuccess("");
              const details = await teacherApi.classRoster(event.target.value);
              setRoster(details);
            }}
          >
            {sections.map((item) => (
              <option key={item.section.id} value={item.section.id}>
                {item.section.name}
              </option>
            ))}
          </select>
        }
      >
        <div className="teacher-roster-summary-grid">
          <article className="teacher-roster-summary-card">
            <Users size={18} />
            <div>
              <strong>{roster?.students?.length ?? 0}</strong>
              <span>students currently enrolled in the selected class</span>
            </div>
          </article>
          <article className="teacher-roster-summary-card">
            <ShieldAlert size={18} />
            <div>
              <strong>{summary.atRisk}</strong>
              <span>learners currently below the 74% mastery threshold</span>
            </div>
          </article>
          <article className="teacher-roster-summary-card">
            <UserPlus2 size={18} />
            <div>
              <strong>{roster?.eligible_students?.length ?? 0}</strong>
              <span>existing student accounts available for roster add</span>
            </div>
          </article>
        </div>

        <div className="teacher-roster-grid">
          {(roster?.students || []).map((student) => (
            <article className="teacher-roster-card" key={student.id}>
              <div className="teacher-roster-card__header">
                <div>
                  <strong>{student.full_name}</strong>
                  <span>{student.school_id}</span>
                </div>
                <span
                  className={`teacher-record-pill ${
                    student.intervention_status === "open"
                      ? "teacher-record-pill--risk"
                      : "teacher-record-pill--passing"
                  }`}
                >
                  {student.intervention_status}
                </span>
              </div>
              <div className="teacher-roster-card__metrics">
                <div>
                  <strong>Grade</strong>
                  <span>{student.grade_level || "-"}</span>
                </div>
                <div>
                  <strong>Latest %</strong>
                  <span>{student.latest_percentage ?? "-"}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Optional Add"
        title="Eligible students"
        description="If demo policy allows it, add existing student accounts into the selected class roster."
      >
        <div className="teacher-roster-grid">
          {(roster?.eligible_students || []).map((student) => (
            <article className="teacher-roster-card teacher-roster-card--eligible" key={student.id}>
              <div className="teacher-roster-card__header">
                <div>
                  <strong>{student.full_name}</strong>
                  <span>{student.school_id}</span>
                </div>
                <span className="teacher-record-pill teacher-record-pill--pending">eligible</span>
              </div>
              <div className="teacher-roster-card__metrics">
                <div>
                  <strong>Grade</strong>
                  <span>{student.grade_level || "-"}</span>
                </div>
                <div>
                  <strong>Roster action</strong>
                  <span>Ready for add</span>
                </div>
              </div>
              <button
                className="secondary-button"
                disabled={saving || !selectedSectionId}
                onClick={async () => {
                  setSaving(true);
                  setError("");
                  setSuccess("");
                  try {
                    await teacherApi.addStudentToRoster(selectedSectionId, {
                      student_user_id: student.id,
                    });
                    setSuccess("Student added to class roster.");
                    await loadRoster(selectedSectionId);
                  } catch (actionError) {
                    setError(actionError.message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Add to class
              </button>
            </article>
          ))}
        </div>
      </TeacherSectionCard>
    </TeacherPageShell>
  );
}
