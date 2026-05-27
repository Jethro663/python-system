import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

const DEFAULT_FILTERS = {
  section_id: "",
  assignment_id: "",
  submission_status: "",
  student_query: "",
  score_band: "",
  min_percentage: "",
  max_percentage: "",
};

export default function TeacherReportsPage() {
  const [report, setReport] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const loadReport = async (nextFilters = filters) => {
    try {
      const response = await teacherApi.filteredReports(nextFilters);
      setReport(response);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadReport(DEFAULT_FILTERS);
  }, []);

  const summary = report?.summary;
  const metrics = useMemo(
    () => [
      { label: "Classes", value: summary?.classes ?? "-", caption: "Classes in this filtered report" },
      { label: "Assignments", value: summary?.assignments ?? "-", caption: "Assessment workload in scope" },
      { label: "Submissions", value: summary?.submissions ?? "-", caption: "Filtered student work rows" },
      { label: "Open Interventions", value: summary?.open_interventions ?? "-", caption: "Students still flagged" },
    ],
    [summary]
  );

  return (
    <TeacherPageShell
      badge="Teacher Reports"
      title="Assessment reports and class records"
      description="Filter records, inspect student results, and export a teacher-facing CSV shaped around the same reporting workflow as the main reference project."
      icon={ClipboardList}
      headerMeta={
        <>
          <span>{summary?.classes ?? 0} classes</span>
          <span>{summary?.submissions ?? 0} submissions</span>
          <span>{summary?.open_interventions ?? 0} open interventions</span>
        </>
      }
      metrics={metrics}
      actions={
        <button
          className="primary-button"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            setError("");
            try {
              const blob = await teacherApi.downloadReportsCsv(filters);
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "teacher-reports.csv";
              document.body.appendChild(link);
              link.click();
              link.remove();
              URL.revokeObjectURL(url);
            } catch (downloadError) {
              setError(downloadError.message);
            } finally {
              setDownloading(false);
            }
          }}
        >
          {downloading ? "Downloading..." : "Download CSV"}
        </button>
      }
    >
      {error ? <div className="form-error">{error}</div> : null}

        <TeacherSectionCard
          eyebrow="Report Filters"
          title="Refine the report view"
          description="Slice by class, assignment, student name or ID, submission status, score band, and percentage range."
        actions={
          <button
            className="secondary-button"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              loadReport(DEFAULT_FILTERS);
            }}
          >
            Reset
          </button>
        }
      >
        <form
          className="teacher-filter-grid"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            loadReport(filters);
          }}
        >
          <label className="field">
            <span>Class</span>
            <select
              name="report_section_id"
              value={filters.section_id}
              onChange={(event) => setFilters((current) => ({ ...current, section_id: event.target.value }))}
            >
              <option value="">All assigned classes</option>
              {(report?.sections || []).map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Student query</span>
            <input
              name="report_student_query"
              value={filters.student_query}
              placeholder="Name, school ID, or email"
              onChange={(event) =>
                setFilters((current) => ({ ...current, student_query: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Submission status</span>
            <select
              name="report_submission_status"
              value={filters.submission_status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, submission_status: event.target.value }))
              }
            >
              <option value="">All statuses</option>
              <option value="submitted">Submitted</option>
              <option value="graded">Graded</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <label className="field">
            <span>Assignment</span>
            <select
              name="report_assignment_id"
              value={filters.assignment_id}
              onChange={(event) =>
                setFilters((current) => ({ ...current, assignment_id: event.target.value }))
              }
            >
              <option value="">All assignments</option>
              {(report?.assignments || []).map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Score band</span>
            <select
              name="report_score_band"
              value={filters.score_band}
              onChange={(event) =>
                setFilters((current) => ({ ...current, score_band: event.target.value }))
              }
            >
              <option value="">All scores</option>
              <option value="at_risk">Below 74%</option>
              <option value="passing">74% and above</option>
              <option value="high">90% and above</option>
            </select>
          </label>
          <label className="field">
            <span>Min %</span>
            <input
              name="report_min_percentage"
              type="number"
              value={filters.min_percentage}
              onChange={(event) =>
                setFilters((current) => ({ ...current, min_percentage: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Max %</span>
            <input
              name="report_max_percentage"
              type="number"
              value={filters.max_percentage}
              onChange={(event) =>
                setFilters((current) => ({ ...current, max_percentage: event.target.value }))
              }
            />
          </label>
          <button className="primary-button" type="submit">
            Apply filters
          </button>
        </form>
      </TeacherSectionCard>

        <TeacherSectionCard
          eyebrow="Class Records"
          title="Per-class grade visibility"
          description="Each student row summarizes assignment percentages for the current filter set."
          action={<span className="admin-tag-chip">Report view</span>}
        >
        <div className="teacher-report-card-grid">
          {(report?.class_records || []).map((record) => (
            <article className="teacher-class-card teacher-class-card--report" key={record.section_id}>
              <div className="teacher-class-card__header">
                <div>
                  <p className="teacher-class-card__eyebrow">Class Record</p>
                  <h3>{record.section_name}</h3>
                </div>
                <span className="pill">{(record.students || []).length} students</span>
              </div>
              <div className="teacher-class-card__metric-grid">
                <div>
                  <strong>{(record.students || []).length}</strong>
                  <span>Students</span>
                </div>
                <div>
                  <strong>
                    {record.students?.reduce((sum, student) => sum + (student.grades || []).length, 0) || 0}
                  </strong>
                  <span>Grades</span>
                </div>
              </div>
              <div className="teacher-report-list">
                {(record.students || []).map((student) => (
                  <div key={student.student_user_id}>
                    <strong>{student.student_name}</strong>
                    <span>
                      {(student.grades || []).length
                        ? student.grades.map((grade) => `${grade.percentage}%`).join(", ")
                        : "No grades yet"}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Submission Summary"
        title="Reviewed work"
        description="Submitted and graded outputs with score, feedback, and current status."
      >
        <div className="teacher-review-grid">
          {(report?.submission_summaries || []).map((submission) => (
            <article className="review-card review-card--teacher" key={submission.id}>
              <div className="review-card__header">
                <strong>{submission.assignment_title}</strong>
                <span>{submission.student_name}</span>
              </div>
              <div className="teacher-review-grid__meta">
                <div>
                  <strong>Status</strong>
                  <span>{submission.status}</span>
                </div>
                <div>
                  <strong>Score</strong>
                  <span>{submission.final_score ?? "-"}</span>
                </div>
              </div>
              <p>{submission.response_text || submission.uploaded_file_path || "No student response captured."}</p>
              <div className="teacher-feedback-box">
                <strong>Feedback</strong>
                <span>{submission.feedback || "No feedback yet."}</span>
              </div>
            </article>
          ))}
          {!report?.submission_summaries?.length ? (
            <p className="empty-state">No submissions matched the current filter set.</p>
          ) : null}
        </div>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Interventions"
        title="At-risk students"
        description="Filtered intervention queue with section and teacher notes."
      >
        <div className="teacher-intervention-list">
          {(report?.intervention_list || []).map((item) => (
            <article className="teacher-intervention-card" key={item.id}>
              <div className="teacher-intervention-card__header">
                <div>
                  <strong>{item.student_name || item.student_user_id}</strong>
                  <span>{item.section_name || item.section_id}</span>
                </div>
                <span className={`teacher-intervention-card__status teacher-intervention-card__status--${item.status}`}>
                  {item.status}
                </span>
              </div>
              <div className="teacher-intervention-card__body">
                <div>
                  <strong>Trigger</strong>
                  <span>{item.trigger_score}</span>
                </div>
                <div>
                  <strong>Teacher note</strong>
                  <span>{item.teacher_note || "-"}</span>
                </div>
              </div>
            </article>
          ))}
          {!report?.intervention_list?.length ? (
            <p className="empty-state">No intervention rows matched the current filter set.</p>
          ) : null}
        </div>
      </TeacherSectionCard>
    </TeacherPageShell>
  );
}
