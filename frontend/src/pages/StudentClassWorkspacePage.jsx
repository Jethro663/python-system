import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { StudentPageShell, StudentSectionCard } from "../components/student/StudentPageShell";
import { studentApi } from "../lib/api";

function responseMapFromSubmission(submission) {
  const responses = submission?.responses || submission?.response_payload?.responses || [];
  if (!Array.isArray(responses)) {
    return {};
  }

  return responses.reduce((mapped, response) => {
    if (response?.question_id) {
      mapped[response.question_id] = response.answer ?? "";
    }
    return mapped;
  }, {});
}

function formFromAssignment(assignment) {
  return {
    response_text: assignment.submission?.response_text || "",
    uploaded_file_path: assignment.submission?.uploaded_file_path || "",
    responses: responseMapFromSubmission(assignment.submission),
  };
}

function choiceValue(choice) {
  if (choice && typeof choice === "object") {
    return String(choice.value ?? choice.label ?? choice.text ?? choice.id ?? "");
  }
  return String(choice ?? "");
}

function choiceLabel(choice) {
  if (choice && typeof choice === "object") {
    return String(choice.label ?? choice.text ?? choice.value ?? choice.id ?? "");
  }
  return String(choice ?? "");
}

function formatScore(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function moduleAttachmentHref(filePath) {
  if (!filePath) {
    return "";
  }
  if (/^https?:\/\//i.test(filePath)) {
    return filePath;
  }
  if (filePath.startsWith("/")) {
    return filePath;
  }
  return "";
}

export default function StudentClassWorkspacePage() {
  const { sectionId } = useParams();
  const [classroom, setClassroom] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [submissionForms, setSubmissionForms] = useState({});
  const [activeTab, setActiveTab] = useState("assessments");
  const [selectedModule, setSelectedModule] = useState(null);

  const loadWorkspace = () => {
    studentApi
      .classWorkspace(sectionId)
      .then((response) => {
        setClassroom(response.classroom);
        const nextForms = {};
        for (const assignment of response.classroom?.assignments || []) {
          nextForms[assignment.id] = formFromAssignment(assignment);
        }
        setSubmissionForms(nextForms);
      })
      .catch((loadError) => setError(loadError.message));
  };

  useEffect(() => {
    loadWorkspace();
  }, [sectionId]);

  const updateForm = (assignmentId, patch) => {
    setSubmissionForms((current) => ({
      ...current,
      [assignmentId]: {
        response_text: "",
        uploaded_file_path: "",
        responses: {},
        ...(current[assignmentId] || {}),
        ...patch,
      },
    }));
  };

  const updateQuestionAnswer = (assignmentId, questionId, value) => {
    setSubmissionForms((current) => ({
      ...current,
      [assignmentId]: (() => {
        const existing = current[assignmentId] || {};
        return {
          response_text: "",
          uploaded_file_path: "",
          ...existing,
          responses: {
            ...(existing.responses || {}),
            [questionId]: value,
          },
        };
      })(),
    }));
  };

  const workspaceMap = useMemo(
    () => [
      { title: "Modules", detail: `${classroom?.modules?.length ?? 0} learning materials available` },
      {
        title: "Assessments",
        detail: `${classroom?.assignments?.length ?? 0} visible work items`,
      },
      {
        title: "Class Updates",
        detail: `${classroom?.announcements?.length ?? 0} announcements and ${classroom?.discussion_threads?.length ?? 0} threads`,
      },
      {
        title: "Calendar & Resources",
        detail: `${classroom?.calendar_events?.length ?? 0} events and ${classroom?.resources?.length ?? 0} resources`,
      },
    ],
    [classroom]
  );

  const subjects = classroom?.subjects?.length ? classroom.subjects.join(", ") : "Class subject";
  const gradedAssignments = (classroom?.assignments || []).filter(
    (assignment) => assignment.result || assignment.submission
  );
  const tabs = [
    { id: "assessments", label: "Assessments", count: classroom?.assignments?.length ?? 0 },
    { id: "modules", label: "Modules", count: classroom?.modules?.length ?? 0 },
    { id: "grades", label: "Grades", count: gradedAssignments.length },
    { id: "resources", label: "Resources", count: classroom?.resources?.length ?? 0 },
    { id: "updates", label: "Updates", count: (classroom?.announcements?.length ?? 0) + (classroom?.discussion_threads?.length ?? 0) },
    { id: "calendar", label: "Calendar", count: classroom?.calendar_events?.length ?? 0 },
  ];

  return (
    <StudentPageShell
      badge="Class Workspace"
      title={classroom?.name || "Loading class..."}
      description={`${subjects} materials, assessments, results, and teacher updates for this section.`}
      metrics={[
        { label: "Modules", value: classroom?.modules?.length ?? "-", caption: "Published learning materials" },
        { label: "Assessments", value: classroom?.assignments?.length ?? "-", caption: "Visible work items" },
        { label: "Resources", value: classroom?.resources?.length ?? "-", caption: "Shared references" },
        { label: "Events", value: classroom?.calendar_events?.length ?? "-", caption: "Calendar items in class" },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <div className="workspace-tabs" role="tablist" aria-label="Class workspace filters">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={`workspace-tab${activeTab === tab.id ? " workspace-tab--active" : ""}`}
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedModule(null);
            }}
            role="tab"
            type="button"
          >
            <span>{tab.label}</span>
            <strong>{tab.count}</strong>
          </button>
        ))}
      </div>

      <StudentSectionCard
        eyebrow={classroom?.grade_level || "Class"}
        title={subjects}
        description={classroom?.schedule_text || classroom?.school_year || "Active student workspace"}
      >
        <div className="student-workspace-map">
          {workspaceMap.map((item) => (
            <article className="student-workspace-map__card" key={item.title}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
            </article>
          ))}
        </div>
      </StudentSectionCard>

      <section className="student-workspace-grid student-workspace-grid--feature">
        {activeTab === "modules" ? (
        <StudentSectionCard
          eyebrow="Modules"
          title={selectedModule ? selectedModule.title : "Published learning materials"}
          actions={
            selectedModule ? (
              <button className="secondary-button" type="button" onClick={() => setSelectedModule(null)}>
                Back to modules
              </button>
            ) : (
              <span className="admin-tag-chip">Learning lane</span>
            )
          }
        >
          {selectedModule ? (
            <article className="module-reader">
              <div className="module-reader__header">
                <div>
                  <p>{selectedModule.subject_tag || "Module"}</p>
                  <h3>{selectedModule.title}</h3>
                </div>
                <span className="pill">{selectedModule.published_at ? "Published" : "Available"}</span>
              </div>
              <div className="module-reader__body">
                <p>{selectedModule.description || "No module description has been added yet."}</p>
              </div>
              <div className="module-reader__attachment">
                <strong>Attachment</strong>
                {selectedModule.file_path ? (
                  moduleAttachmentHref(selectedModule.file_path) ? (
                    <a href={moduleAttachmentHref(selectedModule.file_path)} target="_blank" rel="noreferrer">
                      {selectedModule.file_path}
                    </a>
                  ) : (
                    <span>{selectedModule.file_path}</span>
                  )
                ) : (
                  <span>No attachment path saved yet.</span>
                )}
              </div>
            </article>
          ) : (
          <ul className="workspace-list">
            {(classroom?.modules || []).map((module) => (
              <li className="student-content-card student-content-card--clickable" key={module.id}>
                <div className="student-content-card__header">
                  <strong>{module.title}</strong>
                  <span>{module.subject_tag || "Module"}</span>
                </div>
                <p>{module.description || "No module description yet."}</p>
                <em>{module.file_path || "No attachment path saved yet."}</em>
                <button className="secondary-button" type="button" onClick={() => setSelectedModule(module)}>
                  View module
                </button>
              </li>
            ))}
            {!classroom?.modules?.length ? <li className="empty-state">No published modules yet.</li> : null}
          </ul>
          )}
        </StudentSectionCard>
        ) : null}

        {activeTab === "assessments" ? (
        <StudentSectionCard
          eyebrow="Assessments"
          title="Assignments and assessment results"
          actions={<span className="admin-tag-chip">Student work</span>}
        >
          <div className="workspace-list">
            {(classroom?.assignments || []).map((assignment) => {
              const questions = assignment.questions || [];
              const hasQuestions = questions.length > 0;
              const formState = submissionForms[assignment.id] || {
                response_text: "",
                uploaded_file_path: "",
                responses: {},
              };
              const result = assignment.result;
              const submittedResponses = assignment.submission?.responses || [];

              return (
                <form
                  key={assignment.id}
                  className="review-card review-card--student-work"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setSaving(true);
                    setError("");
                    setSuccess("");
                    try {
                      const payload = hasQuestions
                        ? {
                            responses: formState.responses || {},
                            uploaded_file_path: formState.uploaded_file_path || "",
                          }
                        : {
                            response_text: formState.response_text || "",
                            uploaded_file_path: formState.uploaded_file_path || "",
                          };
                      await studentApi.submitAssignment(sectionId, assignment.id, payload);
                      setSuccess(hasQuestions ? "Assessment submitted." : "Assignment submitted.");
                      loadWorkspace();
                    } catch (submitError) {
                      setError(submitError.message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <div className="review-card__header">
                    <strong>{assignment.title}</strong>
                    <span>{assignment.submission_status}</span>
                  </div>
                  <p>{assignment.instructions || "No instructions provided yet."}</p>

                  <div className="student-assignment-meta">
                    <div>
                      <strong>Type</strong>
                      <span>{assignment.type}</span>
                    </div>
                    <div>
                      <strong>Status</strong>
                      <span>{assignment.submission_status}</span>
                    </div>
                    <div>
                      <strong>Questions</strong>
                      <span>{questions.length}</span>
                    </div>
                    <div>
                      <strong>Remedial</strong>
                      <span>{assignment.remedial_access ? "Open" : "Locked"}</span>
                    </div>
                  </div>

                  {result ? (
                    <div className="student-assignment-result">
                      <div>
                        <strong>{formatScore(result.percentage)}%</strong>
                        <span>{result.remarks}</span>
                      </div>
                      <div>
                        <strong>{formatScore(result.score)}</strong>
                        <span>Score</span>
                      </div>
                    </div>
                  ) : null}

                  {hasQuestions ? (
                    <div className="student-assessment-question-list">
                      {questions.map((question, questionIndex) => {
                        const currentAnswer = formState.responses?.[question.id] ?? "";
                        const choices = Array.isArray(question.choices_json)
                          ? question.choices_json
                          : [];

                        return (
                          <div className="student-assessment-question" key={question.id}>
                            <div className="student-assessment-question__header">
                              <div>
                                <strong>
                                  {questionIndex + 1}. {question.question_text}
                                </strong>
                                <span>{question.question_type.replace("_", " ")}</span>
                              </div>
                              <span>{formatScore(question.points)} pts</span>
                            </div>

                            {question.question_type === "multiple_choice" && choices.length ? (
                              <div className="student-answer-options">
                                {choices.map((choice, choiceIndex) => {
                                  const value = choiceValue(choice);
                                  return (
                                    <button
                                      className={`student-answer-option${
                                        currentAnswer === value ? " student-answer-option--selected" : ""
                                      }`}
                                      key={`${question.id}-${choiceIndex}`}
                                      type="button"
                                      onClick={() => updateQuestionAnswer(assignment.id, question.id, value)}
                                    >
                                      {choiceLabel(choice)}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <label className="field">
                                <span>{question.question_type === "file_upload" ? "File path" : "Answer"}</span>
                                {question.question_type === "short_answer" ? (
                                  <textarea
                                    value={currentAnswer}
                                    onChange={(event) =>
                                      updateQuestionAnswer(assignment.id, question.id, event.target.value)
                                    }
                                  />
                                ) : (
                                  <input
                                    value={currentAnswer}
                                    onChange={(event) =>
                                      updateQuestionAnswer(assignment.id, question.id, event.target.value)
                                    }
                                  />
                                )}
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      <label className="field">
                        <span>Written response</span>
                        <input
                          value={formState.response_text}
                          onChange={(event) => updateForm(assignment.id, { response_text: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Uploaded file path</span>
                        <input
                          value={formState.uploaded_file_path}
                          onChange={(event) =>
                            updateForm(assignment.id, { uploaded_file_path: event.target.value })
                          }
                        />
                      </label>
                    </>
                  )}

                  {submittedResponses.length ? (
                    <div className="student-response-review">
                      <strong>Submitted answers</strong>
                      {submittedResponses.map((response) => (
                        <div key={response.question_id}>
                          <span>{response.question_text}</span>
                          <em>{String(response.answer ?? "")}</em>
                          {response.is_correct !== null && response.is_correct !== undefined ? (
                            <b>{response.is_correct ? "Correct" : "Needs review"}</b>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {assignment.feedback ? (
                    <div className="teacher-feedback-box">
                      <strong>Feedback</strong>
                      <span>{assignment.feedback}</span>
                    </div>
                  ) : null}

                  {assignment.remedial_access ? (
                    <div className="form-error">
                      Remedial access is active because this work is below the 74% mastery threshold.
                    </div>
                  ) : null}

                  <button className="secondary-button" type="submit" disabled={saving}>
                    {saving
                      ? "Submitting..."
                      : assignment.submission_status === "pending"
                      ? hasQuestions
                        ? "Submit assessment"
                        : "Submit assignment"
                      : hasQuestions
                      ? "Resubmit assessment"
                      : "Resubmit assignment"}
                  </button>
                </form>
              );
            })}
            {!classroom?.assignments?.length ? <p className="empty-state">No published assessments yet.</p> : null}
          </div>
        </StudentSectionCard>
        ) : null}

        {activeTab === "grades" ? (
        <StudentSectionCard
          eyebrow="Grades"
          title="Assessment results and submission state"
          actions={<span className="admin-tag-chip">Results</span>}
        >
          <div className="student-result-grid">
            {gradedAssignments.map((assignment) => {
              const result = assignment.result;
              return (
                <article className="student-result-card" key={assignment.id}>
                  <div className="student-result-card__header">
                    <div>
                      <strong>{assignment.title}</strong>
                      <span>{assignment.type}</span>
                    </div>
                    <span className="teacher-record-pill">{assignment.submission_status}</span>
                  </div>
                  <div className="student-result-card__metrics">
                    <div>
                      <strong>Score</strong>
                      <span>{result ? formatScore(result.score) : "-"}</span>
                    </div>
                    <div>
                      <strong>Percentage</strong>
                      <span>{result?.percentage != null ? `${formatScore(result.percentage)}%` : "-"}</span>
                    </div>
                  </div>
                  <div className="student-result-card__feedback">
                    <p>{assignment.feedback || result?.remarks || "No feedback attached yet."}</p>
                  </div>
                </article>
              );
            })}
            {!gradedAssignments.length ? <p className="empty-state">No submitted or graded work yet.</p> : null}
          </div>
        </StudentSectionCard>
        ) : null}

        {activeTab === "resources" ? (
        <StudentSectionCard
          eyebrow="Resources"
          title="Shared files and references"
          actions={<span className="admin-tag-chip">Reference shelf</span>}
        >
          <ul className="workspace-list">
            {(classroom?.resources || []).map((resource) => (
              <li className="student-content-card" key={resource.id}>
                <div className="student-content-card__header">
                  <strong>{resource.title}</strong>
                  <span>{resource.category || "Resource"}</span>
                </div>
                <p>{resource.description || "Teacher-shared reference material for this class workspace."}</p>
                <em>{resource.file_path}</em>
              </li>
            ))}
            {!classroom?.resources?.length ? <li className="empty-state">No shared resources yet.</li> : null}
          </ul>
        </StudentSectionCard>
        ) : null}

        {activeTab === "updates" ? (
        <>
        <StudentSectionCard
          eyebrow="Announcements"
          title="Teacher-published class updates"
          actions={<span className="admin-tag-chip">Class updates</span>}
        >
          <ul className="workspace-list">
            {(classroom?.announcements || []).map((announcement) => (
              <li className="student-content-card" key={announcement.id}>
                <div className="student-content-card__header">
                  <strong>{announcement.title}</strong>
                  <span>Published notice</span>
                </div>
                <p>{announcement.body}</p>
              </li>
            ))}
            {!classroom?.announcements?.length ? <li className="empty-state">No announcements yet.</li> : null}
          </ul>
        </StudentSectionCard>

        <StudentSectionCard
          eyebrow="Discussion Board"
          title="Published help threads and replies"
          actions={<span className="admin-tag-chip">Community board</span>}
        >
          <div className="workspace-list">
            {(classroom?.discussion_threads || []).map((thread) => (
              <div key={thread.id} className="review-card">
                <div className="review-card__header">
                  <strong>{thread.title}</strong>
                  <span>
                    {thread.author_name}
                    {thread.is_pinned ? " / pinned" : ""}
                  </span>
                </div>
                <p>{thread.body}</p>
                <div className="workspace-list">
                  {(thread.replies || []).map((reply) => (
                    <div className="student-discussion-reply" key={reply.id}>
                      <strong>{reply.author_name}</strong>
                      <span>{reply.body}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!classroom?.discussion_threads?.length ? <p className="empty-state">No discussion threads yet.</p> : null}
          </div>
        </StudentSectionCard>
        </>
        ) : null}

        {activeTab === "calendar" ? (
        <StudentSectionCard
          eyebrow="Calendar"
          title="Upcoming section events"
          actions={<span className="admin-tag-chip">Schedule</span>}
        >
          <ul className="workspace-list">
            {(classroom?.calendar_events || []).map((event) => (
              <li className="student-content-card" key={event.id}>
                <div className="student-content-card__header">
                  <strong>{event.title}</strong>
                  <span>{event.event_type}</span>
                </div>
                <p>{event.description || "Class event or due date update from your teacher."}</p>
                <em>{event.start_at || "Schedule TBD"}</em>
              </li>
            ))}
            {!classroom?.calendar_events?.length ? <li className="empty-state">No class events yet.</li> : null}
          </ul>
        </StudentSectionCard>
        ) : null}
      </section>
    </StudentPageShell>
  );
}
