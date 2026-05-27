import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CalendarClock, TrendingUp } from "lucide-react";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

function formatAverage(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return `${value}%`;
}

export default function TeacherPerformancePage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    teacherApi
      .performance()
      .then((response) => setReport(response))
      .catch((loadError) => setError(loadError.message));
  }, []);

  const summary = report?.summary;

  const strongestClass = useMemo(() => {
    const items = report?.section_summaries || [];
    return items.reduce((best, current) => {
      if (!best) return current;
      return Number(current.class_average || 0) > Number(best.class_average || 0) ? current : best;
    }, null);
  }, [report]);

  return (
    <TeacherPageShell
      badge="Teacher Performance"
      title="Track student performance"
      description="Simple class averages, low scorers, and assignment trend tables to support demo-ready teacher monitoring."
      metrics={[
        { label: "Classes", value: summary?.classes ?? "-", caption: "Tracked teacher sections" },
        { label: "Assignments", value: summary?.tracked_assignments ?? "-", caption: "Assignments in the trend table" },
        { label: "Low Scorers", value: summary?.low_scorers ?? "-", caption: "Below the mastery threshold" },
        { label: "Overall Average", value: summary?.overall_average ?? "-", caption: "Combined class percentage" },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}

      <TeacherSectionCard
        eyebrow="Performance Pulse"
        title="Instructional signals"
        description="This condensed pulse card behaves more like the parent workspace: quick cues first, deeper tables after."
      >
        <div className="teacher-performance-pulse-grid">
          <article className="teacher-performance-pulse-card">
            <TrendingUp size={18} />
            <div>
              <strong>{strongestClass?.section_name || "No class yet"}</strong>
              <span>highest current class average in the dataset</span>
            </div>
          </article>
          <article className="teacher-performance-pulse-card">
            <BarChart3 size={18} />
            <div>
              <strong>{formatAverage(strongestClass?.class_average)}</strong>
              <span>best class average currently visible on the performance board</span>
            </div>
          </article>
          <article className="teacher-performance-pulse-card">
            <AlertTriangle size={18} />
            <div>
              <strong>{summary?.low_scorers ?? 0}</strong>
              <span>students already surfacing as low scorers in the performance lane</span>
            </div>
          </article>
          <article className="teacher-performance-pulse-card">
            <CalendarClock size={18} />
            <div>
              <strong>{summary?.tracked_assignments ?? 0}</strong>
              <span>assignments actively contributing to current performance trends</span>
            </div>
          </article>
        </div>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Section Summary"
        title="Class averages"
        description="Per-class averages and at-risk counts act as the simplified performance overview."
      >
        <div className="teacher-performance-grid">
          {(report?.section_summaries || []).map((item) => (
            <article className="teacher-performance-card" key={item.section_id}>
              <div className="teacher-performance-card__header">
                <div>
                  <strong>{item.section_name}</strong>
                  <span>{item.schedule_text || "Schedule not set"}</span>
                </div>
                <span className="teacher-record-pill teacher-record-pill--passing">
                  {formatAverage(item.class_average)}
                </span>
              </div>

              <div className="teacher-performance-card__metrics">
                <div>
                  <strong>Students</strong>
                  <span>{item.student_count}</span>
                </div>
                <div>
                  <strong>Assignments</strong>
                  <span>{item.assignment_count}</span>
                </div>
                <div>
                  <strong>At risk</strong>
                  <span>{item.at_risk_count}</span>
                </div>
                <div>
                  <strong>Reading</strong>
                  <span>
                    {item.at_risk_count ? "Needs intervention watch" : "Stable class pulse"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Assignment Trends"
        title="Assessment averages"
        description="A card-led view of assignment trends keeps the workflow closer to the parent teacher reporting surface."
      >
        <div className="teacher-performance-trend-grid">
          {(report?.assignment_trends || []).map((item) => (
            <article className="teacher-performance-trend-card" key={item.assignment_id}>
              <div className="teacher-performance-trend-card__header">
                <div>
                  <strong>{item.assignment_title}</strong>
                  <span>{item.section_name || item.section_id}</span>
                </div>
                <span className="teacher-record-pill teacher-record-pill--pending">
                  {formatAverage(item.average_percentage)}
                </span>
              </div>

              <div className="teacher-performance-trend-card__metrics">
                <div>
                  <strong>Submissions</strong>
                  <span>{item.submission_count}</span>
                </div>
                <div>
                  <strong>Average</strong>
                  <span>{formatAverage(item.average_percentage)}</span>
                </div>
              </div>

              <p className="teacher-performance-trend-card__note">
                Use this to see which assignments are dragging class averages down before posting interventions.
              </p>
            </article>
          ))}
        </div>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Low Scorers"
        title="Students needing attention"
        description="This is the simplified performance-side queue for students below the mastery threshold."
      >
        <div className="teacher-performance-alert-grid">
          {(report?.low_scorers || []).map((item) => (
            <article className="teacher-performance-alert-card" key={`${item.section_id}-${item.student_user_id}`}>
              <div className="teacher-performance-alert-card__header">
                <div>
                  <strong>{item.student_name}</strong>
                  <span>{item.section_name || item.section_id}</span>
                </div>
                <span className="teacher-record-pill teacher-record-pill--risk">
                  {formatAverage(item.percentage)}
                </span>
              </div>

              <div className="teacher-performance-alert-card__metrics">
                <div>
                  <strong>Percentage</strong>
                  <span>{formatAverage(item.percentage)}</span>
                </div>
                <div>
                  <strong>Remarks</strong>
                  <span>{item.remarks || "Needs review"}</span>
                </div>
              </div>

              <p className="teacher-performance-alert-card__note">
                Prioritize this learner for re-check, feedback, or intervention follow-through.
              </p>
            </article>
          ))}
        </div>
      </TeacherSectionCard>
    </TeacherPageShell>
  );
}
