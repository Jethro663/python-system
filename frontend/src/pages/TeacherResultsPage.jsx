import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, GraduationCap, ListChecks } from "lucide-react";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

export default function TeacherResultsPage() {
  const [report, setReport] = useState(null);
  const [sectionId, setSectionId] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    teacherApi
      .filteredReports({})
      .then((response) => {
        setReport(response);
        const firstSection = response.sections?.[0];
        if (firstSection) {
          setSectionId(String(firstSection.id));
        }
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const selectedClassRecord = useMemo(
    () => (report?.class_records || []).find((record) => String(record.section_id) === String(sectionId)) || null,
    [report, sectionId]
  );

  const classAssignments = useMemo(
    () => (report?.assignments || []).filter((assignment) => String(assignment.section_id) === String(sectionId)),
    [report, sectionId]
  );

  const enrolledStudents = selectedClassRecord?.students || [];

  useEffect(() => {
    const firstAssignment = classAssignments[0];
    setAssignmentId(firstAssignment ? String(firstAssignment.id) : "");
  }, [classAssignments]);

  useEffect(() => {
    const firstStudent = enrolledStudents[0];
    setStudentId(firstStudent ? String(firstStudent.student_user_id) : "");
  }, [enrolledStudents]);

  const selectedAssignment = classAssignments.find(
    (assignment) => String(assignment.id) === String(assignmentId)
  );
  const selectedStudent = enrolledStudents.find(
    (student) => String(student.student_user_id) === String(studentId)
  );
  const selectedGrade = selectedStudent?.grades?.find(
    (grade) => String(grade.assignment_id) === String(assignmentId)
  );

  const classAverage = useMemo(() => {
    const grades = enrolledStudents
      .map((student) => student.grades?.find((grade) => String(grade.assignment_id) === String(assignmentId)))
      .filter(Boolean);
    if (!grades.length) return null;
    const total = grades.reduce((sum, grade) => sum + Number(grade.percentage || 0), 0);
    return Math.round(total / grades.length);
  }, [enrolledStudents, assignmentId]);

  return (
    <TeacherPageShell
      badge="Teacher Results"
      title="View student grades"
      description="Choose a class, assignment, and enrolled student to see the recorded grade."
      headerMeta={
        <>
          <span>{report?.sections?.length ?? 0} classes</span>
          <span>{classAssignments.length} assignments</span>
          <span>{enrolledStudents.length} enrolled students</span>
        </>
      }
      metrics={[
        { label: "Classes", value: report?.sections?.length ?? "-", caption: "Assigned to you" },
        { label: "Assignments", value: classAssignments.length || "-", caption: "In selected class" },
        { label: "Students", value: enrolledStudents.length || "-", caption: "Enrolled in selected class" },
        { label: "Class Average", value: classAverage === null ? "-" : `${classAverage}%`, caption: "For selected assignment" },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}

      <TeacherSectionCard
        eyebrow="Result Lookup"
        title="Choose what to view"
        description="Use the dropdowns to move between classes, assignments, and enrolled students."
      >
        <div className="teacher-filter-grid">
          <label className="field">
            <span>Class</span>
            <select
              value={sectionId}
              onChange={(event) => {
                setSectionId(event.target.value);
                setAssignmentId("");
                setStudentId("");
              }}
            >
              {(report?.sections || []).map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Assignment</span>
            <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
              {classAssignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Student</span>
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              {enrolledStudents.map((student) => (
                <option key={student.student_user_id} value={student.student_user_id}>
                  {student.student_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Grade"
        title={selectedStudent?.student_name || "No student selected"}
        description={selectedAssignment ? selectedAssignment.title : "Choose an assignment to view a grade."}
      >
        <div className="teacher-results-summary-grid">
          <article className="teacher-results-summary-card">
            <GraduationCap size={18} />
            <div>
              <strong>{selectedGrade ? `${selectedGrade.percentage}%` : "-"}</strong>
              <span>Recorded percentage</span>
            </div>
          </article>
          <article className="teacher-results-summary-card">
            <BookOpenCheck size={18} />
            <div>
              <strong>{selectedGrade?.score ?? "-"}</strong>
              <span>Raw score</span>
            </div>
          </article>
          <article className="teacher-results-summary-card">
            <ListChecks size={18} />
            <div>
              <strong>{selectedGrade?.remarks || "No grade yet"}</strong>
              <span>Grade remarks</span>
            </div>
          </article>
        </div>

        {!selectedGrade ? (
          <p className="empty-state">No grade has been recorded yet for this student and assignment.</p>
        ) : null}
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Class List"
        title="Enrolled students for this assignment"
        description="A quick view of every enrolled student's current grade for the selected assignment."
      >
        <div className="teacher-results-grid">
          {enrolledStudents.map((student) => {
            const grade = student.grades?.find((item) => String(item.assignment_id) === String(assignmentId));
            return (
              <article className="teacher-result-card" key={student.student_user_id}>
                <div className="teacher-result-card__header">
                  <div>
                    <p className="teacher-result-card__eyebrow">{selectedAssignment?.title || "Assignment"}</p>
                    <strong>{student.student_name}</strong>
                  </div>
                  <span className={`teacher-record-pill ${grade ? "teacher-record-pill--passing" : "teacher-record-pill--pending"}`}>
                    {grade ? `${grade.percentage}%` : "No grade"}
                  </span>
                </div>
                <div className="teacher-result-card__metrics">
                  <div>
                    <strong>Score</strong>
                    <span>{grade?.score ?? "-"}</span>
                  </div>
                  <div>
                    <strong>Remarks</strong>
                    <span>{grade?.remarks || "-"}</span>
                  </div>
                </div>
              </article>
            );
          })}
          {!enrolledStudents.length ? <p className="empty-state">No students are enrolled in this class yet.</p> : null}
        </div>
      </TeacherSectionCard>
    </TeacherPageShell>
  );
}
