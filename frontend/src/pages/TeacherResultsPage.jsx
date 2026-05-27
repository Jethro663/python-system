import { useEffect, useMemo, useState } from "react";
import { Filter, ListChecks, Search, SlidersHorizontal } from "lucide-react";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

const DEFAULT_FILTERS = {
  section_id: "",
  assignment_id: "",
  student_query: "",
  submission_status: "",
  min_percentage: "",
  max_percentage: "",
};

export default function TeacherResultsPage() {
  const [report, setReport] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [error, setError] = useState("");

  const loadResults = async (nextFilters = filters) => {
    try {
      const response = await teacherApi.filteredReports(nextFilters);
      setReport(response);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadResults(DEFAULT_FILTERS);
  }, []);

  const metrics = useMemo(
    () => [
      { label: "Submissions", value: report?.summary?.submissions ?? "-", caption: "Rows in the current result set" },
      { label: "Assignments", value: report?.summary?.assignments ?? "-", caption: "Assessments covered by the filter" },
      { label: "Classes", value: report?.summary?.classes ?? "-", caption: "Classes represented in results" },
      {
        label: "Visible Results",
        value: report?.submission_summaries?.length ?? "-",
        caption: "Teacher-visible outcome cards currently loaded",
      },
    ],
    [report]
  );

  return (
    <TeacherPageShell
      badge="Teacher Results"
      title="View student results"
      description="Filter by student, assignment, score range, and submission status to inspect teacher-side outcomes directly."
      headerMeta={
        <>
          <span>{report?.summary?.submissions ?? 0} submissions</span>
          <span>{report?.summary?.assignments ?? 0} assignments</span>
          <span>{filters.submission_status || "all statuses"}</span>
        </>
      }
      metrics={metrics}
    >
      {error ? <div className="form-error">{error}</div> : null}

      <TeacherSectionCard
        eyebrow="Result Filters"
        title="Refine result visibility"
        description="This is the teacher-side result view requested in the checklist."
        actions={
          <button
            className="secondary-button"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              loadResults(DEFAULT_FILTERS);
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
            loadResults(filters);
          }}
        >
          <div className="teacher-results-callout-grid">
            <article className="admin-mini-callout">
              <Filter size={18} />
              <div>
                <strong>Focused review</strong>
                <span>Use filters to isolate one class, one assignment, or one score band before making decisions.</span>
              </div>
            </article>
            <article className="admin-mini-callout">
              <Search size={18} />
              <div>
                <strong>Student lookup</strong>
                <span>Search by name, school ID, or email when you need to inspect one learner's current result path.</span>
              </div>
            </article>
          </div>

          <label className="field">
            <span>Class</span>
            <select
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
            <span>Assignment</span>
            <select
              value={filters.assignment_id}
              onChange={(event) => setFilters((current) => ({ ...current, assignment_id: event.target.value }))}
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
            <span>Student query</span>
            <input
              value={filters.student_query}
              placeholder="Name, school ID, or email"
              onChange={(event) => setFilters((current) => ({ ...current, student_query: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select
              value={filters.submission_status}
              onChange={(event) => setFilters((current) => ({ ...current, submission_status: event.target.value }))}
            >
              <option value="">All statuses</option>
              <option value="submitted">Submitted</option>
              <option value="graded">Graded</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <label className="field">
            <span>Min %</span>
            <input
              type="number"
              value={filters.min_percentage}
              onChange={(event) => setFilters((current) => ({ ...current, min_percentage: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Max %</span>
            <input
              type="number"
              value={filters.max_percentage}
              onChange={(event) => setFilters((current) => ({ ...current, max_percentage: event.target.value }))}
            />
          </label>
          <button className="primary-button" type="submit">
            Apply filters
          </button>
        </form>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Student Outcomes"
        title="Filtered results"
        description="Each card shows the teacher-visible outcome state with score and feedback."
      >
        <div className="teacher-results-summary-grid">
          <article className="teacher-results-summary-card">
            <ListChecks size={18} />
            <div>
              <strong>{report?.submission_summaries?.length || 0}</strong>
              <span>submission rows currently matching the active filter set</span>
            </div>
          </article>
          <article className="teacher-results-summary-card">
            <SlidersHorizontal size={18} />
            <div>
              <strong>{filters.submission_status || "All"}</strong>
              <span>current status filter applied to the result list</span>
            </div>
          </article>
        </div>

        <div className="teacher-results-grid">
          {(report?.submission_summaries || []).map((submission) => (
            <article className="teacher-result-card" key={submission.id}>
              <div className="teacher-result-card__header">
                <div>
                  <p className="teacher-result-card__eyebrow">{submission.assignment_title}</p>
                  <strong>{submission.student_name}</strong>
                </div>
                <span className="teacher-record-pill teacher-record-pill--pending">{submission.status}</span>
              </div>
              <div className="teacher-result-card__metrics">
                <div>
                  <strong>Percentage</strong>
                  <span>{submission.final_score ?? "-"}</span>
                </div>
                <div>
                  <strong>Assignment state</strong>
                  <span>{submission.status || "-"}</span>
                </div>
              </div>
              <p className="teacher-result-card__note">{submission.feedback || "No feedback written yet."}</p>
            </article>
          ))}
        </div>
      </TeacherSectionCard>
    </TeacherPageShell>
  );
}
