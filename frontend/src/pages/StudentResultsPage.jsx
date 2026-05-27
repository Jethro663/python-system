import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileClock,
  MessageSquareQuote,
  ShieldAlert,
  Trophy,
} from "lucide-react";

import { StudentPageShell, StudentSectionCard } from "../components/student/StudentPageShell";
import { studentApi } from "../lib/api";

export default function StudentResultsPage() {
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    studentApi
      .results()
      .then((response) => setResults(response.results || []))
      .catch((loadError) => setError(loadError.message));
  }, []);

  const summary = useMemo(
    () => ({
      awaiting: results.filter((result) => result.submission_status === "submitted").length,
      graded: results.filter((result) => result.submission_status !== "submitted").length,
      atRisk: results.filter((result) => Number(result.percentage) < 74).length,
      average: results.length
        ? Math.round(results.reduce((sum, result) => sum + Number(result.percentage || 0), 0) / results.length)
        : 0,
    }),
    [results]
  );

  return (
    <StudentPageShell
      badge="View Results"
      title="Scores, feedback, and submission status"
      description="Results now distinguish between graded outcomes and resubmissions still waiting on teacher review."
      icon={Trophy}
      meta={
        <>
          <span>{results.length} result rows</span>
          <span>{summary.awaiting} awaiting review</span>
          <span>{summary.atRisk} below mastery</span>
        </>
      }
      metrics={[
        { label: "Results Rows", value: results.length || "-", caption: "Visible assignment outcomes" },
        { label: "Awaiting Review", value: summary.awaiting, caption: "Resubmissions pending teacher scoring" },
      ]}
    >
      <div className="student-dashboard-grid">
        <StudentSectionCard
          eyebrow="Results Summary"
          title="Performance snapshot"
          description="A denser score summary that sits closer to the parent folder's reporting rhythm."
        >
          <div className="student-results-summary-grid">
            <article className="student-results-summary-card">
              <CheckCircle2 size={18} />
              <div>
                <strong>{summary.graded}</strong>
                <span>results currently finalized and visible in your record</span>
              </div>
            </article>
            <article className="student-results-summary-card">
              <FileClock size={18} />
              <div>
                <strong>{summary.awaiting}</strong>
                <span>updated work still waiting on another teacher review</span>
              </div>
            </article>
            <article className="student-results-summary-card">
              <AlertTriangle size={18} />
              <div>
                <strong>{summary.atRisk}</strong>
                <span>result rows currently landing below the mastery threshold</span>
              </div>
            </article>
            <article className="student-results-summary-card">
              <Trophy size={18} />
              <div>
                <strong>{summary.average ? `${summary.average}%` : "-"}</strong>
                <span>rough average across the result rows currently visible</span>
              </div>
            </article>
          </div>
        </StudentSectionCard>
      </div>

      <StudentSectionCard
        eyebrow="Results Ledger"
        title="Assessment outcomes and current submission state"
        description="Scores disappear while updated work is waiting in the teacher review queue."
        actions={<span className="admin-tag-chip">Result log</span>}
      >
        {error ? <div className="form-error">{error}</div> : null}

        <div className="student-result-grid">
          {results.map((result) => {
            const statusTone =
              result.submission_status === "submitted"
                ? "student-result-card--awaiting"
                : Number(result.percentage) < 74
                  ? "student-result-card--risk"
                  : "student-result-card--passing";

            return (
              <article className={`student-result-card ${statusTone}`} key={`${result.assignment_id}-${result.section_id}`}>
                <div className="student-result-card__header">
                  <div>
                    <strong>{result.assignment_title || result.assignment_id}</strong>
                    <span>{result.section_name || result.section_id}</span>
                  </div>
                  <span
                    className={`teacher-record-pill ${
                      result.submission_status === "submitted"
                        ? "teacher-record-pill--pending"
                        : Number(result.percentage) < 74
                          ? "teacher-record-pill--risk"
                          : "teacher-record-pill--passing"
                    }`}
                  >
                    {result.submission_status || "-"}
                  </span>
                </div>

                <div className="student-result-card__signal-row">
                  <div className="student-result-card__signal">
                    <Trophy size={16} />
                    <div>
                      <strong>{result.percentage != null ? `${result.percentage}%` : "-"}</strong>
                      <span>Current percentage</span>
                    </div>
                  </div>
                  <div className="student-result-card__signal">
                    {result.submission_status === "submitted" ? (
                      <FileClock size={16} />
                    ) : Number(result.percentage) < 74 ? (
                      <ShieldAlert size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    <div>
                      <strong>{result.score ?? "-"}</strong>
                      <span>Recorded score</span>
                    </div>
                  </div>
                </div>

                <div className="student-result-card__metrics">
                  <div>
                    <strong>Score</strong>
                    <span>{result.score ?? "-"}</span>
                  </div>
                  <div>
                    <strong>Percentage</strong>
                    <span>{result.percentage != null ? `${result.percentage}%` : "-"}</span>
                  </div>
                </div>

                <div className="student-result-card__feedback">
                  <MessageSquareQuote size={16} />
                  <p>{result.feedback || result.remarks || "No feedback or remarks attached to this result row yet."}</p>
                </div>

                {Number(result.percentage) < 74 && result.submission_status !== "submitted" ? (
                  <div className="student-result-card__callout">
                    This outcome is below the 74% mastery threshold. Remedial access should be available inside the class workspace.
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </StudentSectionCard>
    </StudentPageShell>
  );
}
