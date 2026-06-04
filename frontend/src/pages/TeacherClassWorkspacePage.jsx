import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

const EMPTY_MODULE = {
  title: "",
  description: "",
  subject_tag: "",
  file_path: "",
  status: "draft",
};
const EMPTY_ASSIGNMENT = { title: "", type: "quiz", instructions: "", status: "draft" };
const EMPTY_ANNOUNCEMENT = { title: "", body: "", visibility: "section", status: "draft" };
const EMPTY_DISCUSSION = { title: "", body: "", visibility: "section", is_pinned: false, status: "draft" };
const EMPTY_QUESTION = {
  question_text: "",
  question_type: "multiple_choice",
  choices_json: "[]",
  answer_key: "",
  points: "1",
  sort_order: "0",
};

function buildQuestionEditState(assignments) {
  const next = {};
  for (const assignment of assignments || []) {
    next[assignment.id] = { ...EMPTY_QUESTION };
    for (const question of assignment.questions || []) {
      next[`${assignment.id}:${question.id}`] = {
        question_text: question.question_text || "",
        question_type: question.question_type || "multiple_choice",
        choices_json: JSON.stringify(question.choices_json || []),
        answer_key: question.answer_key || "",
        points: String(question.points ?? 1),
        sort_order: String(question.sort_order ?? 0),
      };
    }
  }
  return next;
}

function buildReviewForms(submissions) {
  const next = {};
  for (const submission of submissions || []) {
    next[submission.id] = {
      raw_score: submission.raw_score ?? "",
      percentage: submission.final_score ?? "",
      feedback: submission.feedback ?? "",
    };
  }
  return next;
}

function buildModuleEditForms(modules) {
  const next = {};
  for (const module of modules || []) {
    next[module.id] = {
      title: module.title || "",
      description: module.description || "",
      subject_tag: module.subject_tag || "",
      file_path: module.file_path || "",
      status: module.status || "draft",
    };
  }
  return next;
}

function buildAssignmentEditForms(assignments) {
  const next = {};
  for (const assignment of assignments || []) {
    next[assignment.id] = {
      title: assignment.title || "",
      type: assignment.type || "quiz",
      instructions: assignment.instructions || "",
      status: assignment.status || "draft",
    };
  }
  return next;
}

function buildAnnouncementEditForms(announcements) {
  const next = {};
  for (const announcement of announcements || []) {
    next[announcement.id] = {
      title: announcement.title || "",
      body: announcement.body || "",
      visibility: announcement.visibility || "section",
      status: announcement.status || "draft",
    };
  }
  return next;
}

function buildDiscussionEditForms(threads) {
  const next = {};
  for (const thread of threads || []) {
    next[thread.id] = {
      title: thread.title || "",
      body: thread.body || "",
      visibility: thread.visibility || "section",
      is_pinned: Boolean(thread.is_pinned),
      status: thread.status || "draft",
    };
  }
  return next;
}

function buildDiscussionReplyForms(threads) {
  const next = {};
  for (const thread of threads || []) {
    next[thread.id] = { body: "" };
  }
  return next;
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

export default function TeacherClassWorkspacePage() {
  const { sectionId } = useParams();
  const [classroom, setClassroom] = useState(null);
  const [moduleForm, setModuleForm] = useState(EMPTY_MODULE);
  const [assignmentForm, setAssignmentForm] = useState(EMPTY_ASSIGNMENT);
  const [announcementForm, setAnnouncementForm] = useState(EMPTY_ANNOUNCEMENT);
  const [discussionForm, setDiscussionForm] = useState(EMPTY_DISCUSSION);
  const [questionForms, setQuestionForms] = useState({});
  const [reviewForms, setReviewForms] = useState({});
  const [moduleEditForms, setModuleEditForms] = useState({});
  const [assignmentEditForms, setAssignmentEditForms] = useState({});
  const [announcementEditForms, setAnnouncementEditForms] = useState({});
  const [discussionEditForms, setDiscussionEditForms] = useState({});
  const [discussionReplyForms, setDiscussionReplyForms] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingModule, setUploadingModule] = useState(false);
  const [moduleFile, setModuleFile] = useState(null);
  const [activeTab, setActiveTab] = useState("assessments");
  const [selectedModule, setSelectedModule] = useState(null);

  const loadWorkspace = async () => {
    try {
      const response = await teacherApi.classWorkspace(sectionId);
      const room = response.classroom;
      setClassroom(room);
      setQuestionForms(buildQuestionEditState(room?.assignments));
      setReviewForms(buildReviewForms(room?.submissions));
      setModuleEditForms(buildModuleEditForms(room?.modules));
      setAssignmentEditForms(buildAssignmentEditForms(room?.assignments));
      setAnnouncementEditForms(buildAnnouncementEditForms(room?.announcements));
      setDiscussionEditForms(buildDiscussionEditForms(room?.discussion_threads));
      setDiscussionReplyForms(buildDiscussionReplyForms(room?.discussion_threads));
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [sectionId]);

  const sectionMetrics = [
    { label: "Students", value: classroom?.student_count ?? "-", caption: "Current class roster" },
    { label: "Assignments", value: classroom?.assignments?.length ?? "-", caption: "Drafts and published work" },
    { label: "Submissions", value: classroom?.submissions?.length ?? "-", caption: "Student work in review" },
    {
      label: "Support Watch",
      value: classroom?.interventions?.filter((item) => item.status === "open").length ?? "-",
      caption: "Below-threshold follow-up cases",
    },
  ];
  const workspaceMap = useMemo(
    () => [
      {
        title: "Content Authoring",
        detail: `${classroom?.modules?.length ?? 0} modules, ${classroom?.assignments?.length ?? 0} assignments`,
      },
      {
        title: "Assessment Builder",
        detail: `${classroom?.assignments?.reduce((sum, item) => sum + (item.questions?.length || 0), 0) ?? 0} question rows`,
      },
      {
        title: "Class Communication",
        detail: `${classroom?.announcements?.length ?? 0} announcements, ${classroom?.discussion_threads?.length ?? 0} threads`,
      },
      {
        title: "Submission Review",
        detail: `${classroom?.submissions?.length ?? 0} submissions waiting in the review lane`,
      },
    ],
    [classroom]
  );
  const openInterventions = classroom?.interventions?.filter((item) => item.status === "open") || [];
  const teacherTabs = [
    { id: "overview", label: "Overview", count: classroom ? 1 : 0 },
    { id: "assessments", label: "Assessments", count: classroom?.assignments?.length ?? 0 },
    { id: "modules", label: "Modules", count: classroom?.modules?.length ?? 0 },
    { id: "grades", label: "Grades", count: classroom?.submissions?.length ?? 0 },
    { id: "students", label: "Students", count: classroom?.students?.length ?? 0 },
    { id: "calendar", label: "Calendar", count: classroom?.calendar_events?.length ?? 0 },
    { id: "updates", label: "Updates", count: (classroom?.announcements?.length ?? 0) + (classroom?.discussion_threads?.length ?? 0) },
  ];

  return (
    <TeacherPageShell
      badge="Class Workspace"
      title={classroom?.name || "Loading class workspace..."}
      description="This workspace now covers the real teacher management loop: module authoring, assessment setup, class communication, and submission review."
      metrics={sectionMetrics}
      actions={
        <div className="action-row">
          <Link className="secondary-button" to="/teacher/classes">
            Back to classes
          </Link>
          <Link className="secondary-button" to="/teacher/roster">
            Roster
          </Link>
          <Link className="secondary-button" to="/teacher/records">
            Records
          </Link>
          <Link className="secondary-button" to="/teacher/results">
            Results
          </Link>
          <Link className="secondary-button" to="/teacher/performance">
            Performance
          </Link>
        </div>
      }
    >
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <div className="workspace-tabs" role="tablist" aria-label="Teacher class workspace filters">
        {teacherTabs.map((tab) => (
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

      {activeTab === "overview" ? (
      <>
      <TeacherSectionCard
        eyebrow="Workspace Map"
        title="Operating lanes for this class"
        description="This class shell is organized into the same major teacher rhythms as the parent workspace: authoring, assessment setup, communication, and review."
      >
        <div className="teacher-workspace-map-grid">
          {workspaceMap.map((item) => (
            <article className="teacher-workspace-map-card" key={item.title}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
            </article>
          ))}
        </div>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Workspace Overview"
        title="Class context"
        description="Subjects, schedule, roster size, and near-term classroom pressure, framed more like the parent operating surface."
      >
        <div className="teacher-class-grid">
          <article className="teacher-class-card">
            <div className="teacher-class-card__header">
              <div>
                <p className="teacher-class-card__eyebrow">Subjects</p>
                <h3>{classroom?.grade_level}</h3>
              </div>
              <span className="pill">{classroom?.school_year}</span>
            </div>
            <p className="teacher-class-card__subjects">{classroom?.subjects?.join(", ") || "-"}</p>
            <div className="teacher-class-card__meta">
              <span>{classroom?.student_count || 0} students</span>
              <span>{classroom?.at_risk_students || 0} support watch</span>
              <span>{classroom?.schedule_text || "No schedule set"}</span>
            </div>
          </article>
          <article className="teacher-class-card">
            <div className="teacher-class-card__header">
              <div>
                <p className="teacher-class-card__eyebrow">Upcoming events</p>
                <h3>Calendar pressure</h3>
              </div>
            </div>
            <div className="teacher-report-list">
              {(classroom?.calendar_events || []).slice(0, 3).map((event) => (
                <div key={event.id}>
                  <strong>{event.title}</strong>
                  <span>{event.event_type}</span>
                </div>
              ))}
              {!classroom?.calendar_events?.length ? <p className="empty-state">No class events yet.</p> : null}
            </div>
          </article>
          <article className="teacher-class-card">
            <div className="teacher-class-card__header">
              <div>
                <p className="teacher-class-card__eyebrow">Class pressure</p>
                <h3>Review and support</h3>
              </div>
            </div>
            <div className="teacher-class-card__metric-grid">
              <div>
                <strong>{classroom?.submissions?.length || 0}</strong>
                <span>Submissions</span>
              </div>
              <div>
                <strong>{classroom?.interventions?.filter((item) => item.status === "open").length || 0}</strong>
                <span>Open support items</span>
              </div>
            </div>
            <div className="teacher-event-stack">
              <div>
                <strong>{classroom?.assignments?.filter((item) => item.status === "draft").length || 0} draft assignments</strong>
                <span>Still waiting on publish or revision</span>
              </div>
              <div>
                <strong>{classroom?.discussion_threads?.filter((item) => item.is_pinned).length || 0} pinned threads</strong>
                <span>Active discussion anchors inside this class</span>
              </div>
            </div>
          </article>
        </div>
      </TeacherSectionCard>
      </>
      ) : null}

      {activeTab === "modules" ? (
      <TeacherSectionCard
        eyebrow="Content Authoring"
        title="Modules and assignments"
        description="Create lessons and assessments, then revise them directly from the same class workspace."
      >
        <div className="teacher-two-column">
          <form
            className="form-grid teacher-form-panel"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              setSuccess("");
              try {
                await teacherApi.createModule(sectionId, moduleForm);
                setModuleForm(EMPTY_MODULE);
                setModuleFile(null);
                setSuccess("Module saved.");
                await loadWorkspace();
              } catch (saveError) {
                setError(saveError.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <h3>Create module</h3>
            <label className="field">
              <span>Title</span>
              <input value={moduleForm.title} onChange={(event) => setModuleForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea value={moduleForm.description} onChange={(event) => setModuleForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label className="field">
              <span>Subject tag</span>
              <input value={moduleForm.subject_tag} onChange={(event) => setModuleForm((current) => ({ ...current, subject_tag: event.target.value }))} placeholder="Algebra, Literature, Science" />
            </label>
            <label className="field">
              <span>File path</span>
              <input value={moduleForm.file_path} onChange={(event) => setModuleForm((current) => ({ ...current, file_path: event.target.value }))} />
            </label>
            <label className="field">
              <span>Upload file</span>
              <input type="file" onChange={(event) => setModuleFile(event.target.files?.[0] || null)} />
            </label>
            <label className="field">
              <span>Status</span>
              <select value={moduleForm.status} onChange={(event) => setModuleForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <div className="action-row">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save module"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={uploadingModule || !moduleFile}
                onClick={async () => {
                  setUploadingModule(true);
                  setError("");
                  setSuccess("");
                  try {
                    const formData = new FormData();
                    formData.append("file", moduleFile);
                    formData.append("kind", "module");
                    const uploaded = await teacherApi.uploadFile(formData);
                    setModuleForm((current) => ({ ...current, file_path: uploaded.file_path }));
                    setSuccess("Module file uploaded. Review the path and save the module.");
                  } catch (uploadError) {
                    setError(uploadError.message);
                  } finally {
                    setUploadingModule(false);
                  }
                }}
              >
                {uploadingModule ? "Uploading..." : "Upload file"}
              </button>
            </div>
          </form>

          <form
            className="form-grid teacher-form-panel"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              setSuccess("");
              try {
                await teacherApi.createAssignment(sectionId, assignmentForm);
                setAssignmentForm(EMPTY_ASSIGNMENT);
                setSuccess("Assignment saved.");
                await loadWorkspace();
              } catch (saveError) {
                setError(saveError.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <h3>Create assignment</h3>
            <label className="field">
              <span>Title</span>
              <input value={assignmentForm.title} onChange={(event) => setAssignmentForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="field">
              <span>Type</span>
              <select value={assignmentForm.type} onChange={(event) => setAssignmentForm((current) => ({ ...current, type: event.target.value }))}>
                <option value="quiz">Quiz</option>
                <option value="written_work">Written Work</option>
                <option value="performance_task">Performance Task</option>
                <option value="discussion">Discussion Activity</option>
              </select>
            </label>
            <label className="field">
              <span>Instructions</span>
              <textarea value={assignmentForm.instructions} onChange={(event) => setAssignmentForm((current) => ({ ...current, instructions: event.target.value }))} />
            </label>
            <label className="field">
              <span>Status</span>
              <select value={assignmentForm.status} onChange={(event) => setAssignmentForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save assignment"}
            </button>
          </form>
        </div>

        <div className="teacher-two-column">
          <div className="teacher-assignment-stack">
            <div className="teacher-stack-heading">
              <h3>{selectedModule ? selectedModule.title : "Existing modules"}</h3>
              {selectedModule ? (
                <button className="secondary-button" type="button" onClick={() => setSelectedModule(null)}>
                  Back to modules
                </button>
              ) : null}
            </div>
            {selectedModule ? (
              <article className="module-reader">
                <div className="module-reader__header">
                  <div>
                    <p>{selectedModule.subject_tag || "Module"}</p>
                    <h3>{selectedModule.title}</h3>
                  </div>
                  <span className="pill">{selectedModule.status || "module"}</span>
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
            <>
            {(classroom?.modules || []).map((module) => (
              <form
                key={module.id}
                className="teacher-assignment-card"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setSaving(true);
                  setError("");
                  setSuccess("");
                  try {
                    await teacherApi.updateModule(sectionId, module.id, moduleEditForms[module.id]);
                    setSuccess("Module updated.");
                    await loadWorkspace();
                  } catch (updateError) {
                    setError(updateError.message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <div className="teacher-class-card__header">
                  <div>
                    <p className="teacher-class-card__eyebrow">{module.subject_tag || "Module"}</p>
                    <h3>{module.title}</h3>
                  </div>
                  <span className="pill">{module.status}</span>
                </div>
                <button className="secondary-button" type="button" onClick={() => setSelectedModule(module)}>
                  View module
                </button>
                <label className="field">
                  <span>Title</span>
                  <input value={moduleEditForms[module.id]?.title ?? ""} onChange={(event) => setModuleEditForms((current) => ({ ...current, [module.id]: { ...current[module.id], title: event.target.value } }))} />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea value={moduleEditForms[module.id]?.description ?? ""} onChange={(event) => setModuleEditForms((current) => ({ ...current, [module.id]: { ...current[module.id], description: event.target.value } }))} />
                </label>
                <label className="field">
                  <span>Subject tag</span>
                  <input value={moduleEditForms[module.id]?.subject_tag ?? ""} onChange={(event) => setModuleEditForms((current) => ({ ...current, [module.id]: { ...current[module.id], subject_tag: event.target.value } }))} />
                </label>
                <label className="field">
                  <span>File path</span>
                  <input value={moduleEditForms[module.id]?.file_path ?? ""} onChange={(event) => setModuleEditForms((current) => ({ ...current, [module.id]: { ...current[module.id], file_path: event.target.value } }))} />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select value={moduleEditForms[module.id]?.status ?? "draft"} onChange={(event) => setModuleEditForms((current) => ({ ...current, [module.id]: { ...current[module.id], status: event.target.value } }))}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </label>
                <button className="secondary-button" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Update module"}
                </button>
              </form>
            ))}
            {!classroom?.modules?.length ? <p className="empty-state">No modules created yet.</p> : null}
            </>
            )}
          </div>

          <div className="teacher-assignment-stack">
            <h3>Existing assignments</h3>
            {(classroom?.assignments || []).map((assignment) => (
              <form
                key={assignment.id}
                className="teacher-assignment-card"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setSaving(true);
                  setError("");
                  setSuccess("");
                  try {
                    await teacherApi.updateAssignment(sectionId, assignment.id, assignmentEditForms[assignment.id]);
                    setSuccess("Assignment updated.");
                    await loadWorkspace();
                  } catch (updateError) {
                    setError(updateError.message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <div className="teacher-class-card__header">
                  <div>
                    <p className="teacher-class-card__eyebrow">{assignment.type}</p>
                    <h3>{assignment.title}</h3>
                  </div>
                  <span className="pill">{assignment.status}</span>
                </div>
                <label className="field">
                  <span>Title</span>
                  <input value={assignmentEditForms[assignment.id]?.title ?? ""} onChange={(event) => setAssignmentEditForms((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], title: event.target.value } }))} />
                </label>
                <label className="field">
                  <span>Type</span>
                  <select value={assignmentEditForms[assignment.id]?.type ?? "quiz"} onChange={(event) => setAssignmentEditForms((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], type: event.target.value } }))}>
                    <option value="quiz">Quiz</option>
                    <option value="written_work">Written Work</option>
                    <option value="performance_task">Performance Task</option>
                    <option value="discussion">Discussion Activity</option>
                  </select>
                </label>
                <label className="field">
                  <span>Instructions</span>
                  <textarea value={assignmentEditForms[assignment.id]?.instructions ?? ""} onChange={(event) => setAssignmentEditForms((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], instructions: event.target.value } }))} />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select value={assignmentEditForms[assignment.id]?.status ?? "draft"} onChange={(event) => setAssignmentEditForms((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], status: event.target.value } }))}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </label>
                <button className="secondary-button" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Update assignment"}
                </button>
              </form>
            ))}
          {!classroom?.assignments?.length ? <p className="empty-state">No assignments created yet.</p> : null}
          </div>
        </div>
      </TeacherSectionCard>
      ) : null}

      {activeTab === "assessments" ? (
      <TeacherSectionCard
        eyebrow="Assessment Builder"
        title="Assignment questions"
        description="Add and revise multiple choice, short answer, or file-upload prompts directly under each assignment."
      >
        <div className="teacher-assignment-stack">
          {(classroom?.assignments || []).map((assignment) => (
            <article className="teacher-assignment-card" key={assignment.id}>
              <div className="teacher-class-card__header">
                <div>
                  <p className="teacher-class-card__eyebrow">{assignment.type}</p>
                  <h3>{assignment.title}</h3>
                </div>
                <span className="pill">{assignment.status}</span>
              </div>
              <p className="teacher-class-card__subjects">{assignment.instructions || "No instructions yet."}</p>

              <div className="teacher-report-list">
                {(assignment.questions || []).map((question) => (
                  <form
                    className="teacher-question-card"
                    key={question.id}
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setSaving(true);
                      setError("");
                      setSuccess("");
                      try {
                        const current = questionForms[`${assignment.id}:${question.id}`];
                        await teacherApi.updateAssignmentQuestion(sectionId, assignment.id, question.id, {
                          ...current,
                          points: Number(current.points || 0),
                          sort_order: Number(current.sort_order || 0),
                          choices_json: JSON.parse(current.choices_json || "[]"),
                        });
                        setSuccess("Question updated.");
                        await loadWorkspace();
                      } catch (updateError) {
                        setError(updateError.message);
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    <label className="field">
                      <span>Question</span>
                      <input
                        value={questionForms[`${assignment.id}:${question.id}`]?.question_text ?? ""}
                        onChange={(event) =>
                          setQuestionForms((current) => ({
                            ...current,
                            [`${assignment.id}:${question.id}`]: {
                              ...current[`${assignment.id}:${question.id}`],
                              question_text: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <div className="review-grid">
                      <label className="field">
                        <span>Type</span>
                        <select
                          value={questionForms[`${assignment.id}:${question.id}`]?.question_type ?? "multiple_choice"}
                          onChange={(event) =>
                            setQuestionForms((current) => ({
                              ...current,
                              [`${assignment.id}:${question.id}`]: {
                                ...current[`${assignment.id}:${question.id}`],
                                question_type: event.target.value,
                              },
                            }))
                          }
                        >
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="short_answer">Short Answer</option>
                          <option value="file_upload">File Upload</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Points</span>
                        <input
                          value={questionForms[`${assignment.id}:${question.id}`]?.points ?? "1"}
                          onChange={(event) =>
                            setQuestionForms((current) => ({
                              ...current,
                              [`${assignment.id}:${question.id}`]: {
                                ...current[`${assignment.id}:${question.id}`],
                                points: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Sort order</span>
                        <input
                          value={questionForms[`${assignment.id}:${question.id}`]?.sort_order ?? "0"}
                          onChange={(event) =>
                            setQuestionForms((current) => ({
                              ...current,
                              [`${assignment.id}:${question.id}`]: {
                                ...current[`${assignment.id}:${question.id}`],
                                sort_order: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                    <label className="field">
                      <span>Choices JSON</span>
                      <input
                        value={questionForms[`${assignment.id}:${question.id}`]?.choices_json ?? "[]"}
                        onChange={(event) =>
                          setQuestionForms((current) => ({
                            ...current,
                            [`${assignment.id}:${question.id}`]: {
                              ...current[`${assignment.id}:${question.id}`],
                              choices_json: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Answer key</span>
                      <input
                        value={questionForms[`${assignment.id}:${question.id}`]?.answer_key ?? ""}
                        onChange={(event) =>
                          setQuestionForms((current) => ({
                            ...current,
                            [`${assignment.id}:${question.id}`]: {
                              ...current[`${assignment.id}:${question.id}`],
                              answer_key: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <button className="secondary-button" type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Update question"}
                    </button>
                  </form>
                ))}
              </div>

              <form
                className="teacher-question-card teacher-question-card--new"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setSaving(true);
                  setError("");
                  setSuccess("");
                  try {
                    const current = questionForms[assignment.id];
                    await teacherApi.createAssignmentQuestion(sectionId, assignment.id, {
                      ...current,
                      points: Number(current.points || 0),
                      sort_order: Number(current.sort_order || 0),
                      choices_json: JSON.parse(current.choices_json || "[]"),
                    });
                    setSuccess("Question created.");
                    await loadWorkspace();
                  } catch (createError) {
                    setError(createError.message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <h4>Add question</h4>
                <label className="field">
                  <span>Question</span>
                  <input
                    value={questionForms[assignment.id]?.question_text ?? ""}
                    onChange={(event) =>
                      setQuestionForms((current) => ({
                        ...current,
                        [assignment.id]: {
                          ...current[assignment.id],
                          question_text: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <div className="review-grid">
                  <label className="field">
                    <span>Type</span>
                    <select
                      value={questionForms[assignment.id]?.question_type ?? "multiple_choice"}
                      onChange={(event) =>
                        setQuestionForms((current) => ({
                          ...current,
                          [assignment.id]: {
                            ...current[assignment.id],
                            question_type: event.target.value,
                          },
                        }))
                      }
                    >
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="short_answer">Short Answer</option>
                      <option value="file_upload">File Upload</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Points</span>
                    <input
                      value={questionForms[assignment.id]?.points ?? "1"}
                      onChange={(event) =>
                        setQuestionForms((current) => ({
                          ...current,
                          [assignment.id]: {
                            ...current[assignment.id],
                            points: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Sort order</span>
                    <input
                      value={questionForms[assignment.id]?.sort_order ?? "0"}
                      onChange={(event) =>
                        setQuestionForms((current) => ({
                          ...current,
                          [assignment.id]: {
                            ...current[assignment.id],
                            sort_order: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Choices JSON</span>
                  <input
                    value={questionForms[assignment.id]?.choices_json ?? "[]"}
                    onChange={(event) =>
                      setQuestionForms((current) => ({
                        ...current,
                        [assignment.id]: {
                          ...current[assignment.id],
                          choices_json: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Answer key</span>
                  <input
                    value={questionForms[assignment.id]?.answer_key ?? ""}
                    onChange={(event) =>
                      setQuestionForms((current) => ({
                        ...current,
                        [assignment.id]: {
                          ...current[assignment.id],
                          answer_key: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <button className="primary-button" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Add question"}
                </button>
              </form>
            </article>
          ))}
          {!classroom?.assignments?.length ? <p className="empty-state">Create an assignment first to add questions.</p> : null}
        </div>
      </TeacherSectionCard>
      ) : null}

      {activeTab === "updates" ? (
      <TeacherSectionCard
        eyebrow="Class Communication"
        title="Announcements and discussion"
        description="Publish updates and run classroom threads from the teacher workspace."
      >
        <div className="teacher-two-column">
          <form
            className="form-grid teacher-form-panel"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              setSuccess("");
              try {
                await teacherApi.createAnnouncement(sectionId, announcementForm);
                setAnnouncementForm(EMPTY_ANNOUNCEMENT);
                setSuccess("Announcement saved.");
                await loadWorkspace();
              } catch (saveError) {
                setError(saveError.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <h3>Create announcement</h3>
            <label className="field">
              <span>Title</span>
              <input value={announcementForm.title} onChange={(event) => setAnnouncementForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="field">
              <span>Body</span>
              <textarea value={announcementForm.body} onChange={(event) => setAnnouncementForm((current) => ({ ...current, body: event.target.value }))} />
            </label>
            <label className="field">
              <span>Visibility</span>
              <select value={announcementForm.visibility} onChange={(event) => setAnnouncementForm((current) => ({ ...current, visibility: event.target.value }))}>
                <option value="section">Section</option>
                <option value="school">School</option>
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select value={announcementForm.status} onChange={(event) => setAnnouncementForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save announcement"}
            </button>
          </form>

          <form
            className="form-grid teacher-form-panel"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              setSuccess("");
              try {
                await teacherApi.createDiscussion(sectionId, discussionForm);
                setDiscussionForm(EMPTY_DISCUSSION);
                setSuccess("Discussion saved.");
                await loadWorkspace();
              } catch (saveError) {
                setError(saveError.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <h3>Create discussion</h3>
            <label className="field">
              <span>Title</span>
              <input value={discussionForm.title} onChange={(event) => setDiscussionForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="field">
              <span>Body</span>
              <textarea value={discussionForm.body} onChange={(event) => setDiscussionForm((current) => ({ ...current, body: event.target.value }))} />
            </label>
            <label className="field">
              <span>Status</span>
              <select value={discussionForm.status} onChange={(event) => setDiscussionForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <label className="field">
              <span>Visibility</span>
              <select value={discussionForm.visibility} onChange={(event) => setDiscussionForm((current) => ({ ...current, visibility: event.target.value }))}>
                <option value="section">Section</option>
                <option value="school">School</option>
              </select>
            </label>
            <label className="field teacher-checkbox">
              <input type="checkbox" checked={discussionForm.is_pinned} onChange={(event) => setDiscussionForm((current) => ({ ...current, is_pinned: event.target.checked }))} />
              <span>Pin thread</span>
            </label>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save discussion"}
            </button>
          </form>
        </div>

        <div className="teacher-two-column">
          <div className="teacher-assignment-stack">
            <h3>Existing announcements</h3>
            {(classroom?.announcements || []).map((announcement) => (
              <form
                key={announcement.id}
                className="teacher-assignment-card"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setSaving(true);
                  setError("");
                  setSuccess("");
                  try {
                    await teacherApi.updateAnnouncement(sectionId, announcement.id, announcementEditForms[announcement.id]);
                    setSuccess("Announcement updated.");
                    await loadWorkspace();
                  } catch (updateError) {
                    setError(updateError.message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <div className="teacher-class-card__header">
                  <div>
                    <p className="teacher-class-card__eyebrow">{announcement.visibility}</p>
                    <h3>{announcement.title}</h3>
                  </div>
                  <span className="pill">{announcement.status}</span>
                </div>
                <label className="field">
                  <span>Title</span>
                  <input value={announcementEditForms[announcement.id]?.title ?? ""} onChange={(event) => setAnnouncementEditForms((current) => ({ ...current, [announcement.id]: { ...current[announcement.id], title: event.target.value } }))} />
                </label>
                <label className="field">
                  <span>Body</span>
                  <textarea value={announcementEditForms[announcement.id]?.body ?? ""} onChange={(event) => setAnnouncementEditForms((current) => ({ ...current, [announcement.id]: { ...current[announcement.id], body: event.target.value } }))} />
                </label>
                <label className="field">
                  <span>Visibility</span>
                  <select value={announcementEditForms[announcement.id]?.visibility ?? "section"} onChange={(event) => setAnnouncementEditForms((current) => ({ ...current, [announcement.id]: { ...current[announcement.id], visibility: event.target.value } }))}>
                    <option value="section">Section</option>
                    <option value="school">School</option>
                  </select>
                </label>
                <label className="field">
                  <span>Status</span>
                  <select value={announcementEditForms[announcement.id]?.status ?? "draft"} onChange={(event) => setAnnouncementEditForms((current) => ({ ...current, [announcement.id]: { ...current[announcement.id], status: event.target.value } }))}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </label>
                <button className="secondary-button" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Update announcement"}
                </button>
              </form>
            ))}
            {!classroom?.announcements?.length ? <p className="empty-state">No announcements yet.</p> : null}
          </div>

          <div className="teacher-assignment-stack">
            <h3>Existing discussions</h3>
            {(classroom?.discussion_threads || []).map((thread) => (
              <article key={thread.id} className="teacher-assignment-card">
                <form
                  className="form-grid"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setSaving(true);
                    setError("");
                    setSuccess("");
                    try {
                      await teacherApi.updateDiscussion(sectionId, thread.id, discussionEditForms[thread.id]);
                      setSuccess("Discussion updated.");
                      await loadWorkspace();
                    } catch (updateError) {
                      setError(updateError.message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <div className="teacher-class-card__header">
                    <div>
                      <p className="teacher-class-card__eyebrow">
                        {thread.visibility === "school" ? "School discussion" : thread.is_pinned ? "Pinned thread" : "Discussion thread"}
                      </p>
                      <h3>{thread.title}</h3>
                    </div>
                    <span className="pill">{thread.status}</span>
                  </div>
                  <label className="field">
                    <span>Title</span>
                    <input value={discussionEditForms[thread.id]?.title ?? ""} onChange={(event) => setDiscussionEditForms((current) => ({ ...current, [thread.id]: { ...current[thread.id], title: event.target.value } }))} />
                  </label>
                  <label className="field">
                    <span>Body</span>
                    <textarea value={discussionEditForms[thread.id]?.body ?? ""} onChange={(event) => setDiscussionEditForms((current) => ({ ...current, [thread.id]: { ...current[thread.id], body: event.target.value } }))} />
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <select value={discussionEditForms[thread.id]?.status ?? "draft"} onChange={(event) => setDiscussionEditForms((current) => ({ ...current, [thread.id]: { ...current[thread.id], status: event.target.value } }))}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Visibility</span>
                    <select value={discussionEditForms[thread.id]?.visibility ?? "section"} onChange={(event) => setDiscussionEditForms((current) => ({ ...current, [thread.id]: { ...current[thread.id], visibility: event.target.value } }))}>
                      <option value="section">Section</option>
                      <option value="school">School</option>
                    </select>
                  </label>
                  <label className="field teacher-checkbox">
                    <input type="checkbox" checked={discussionEditForms[thread.id]?.is_pinned ?? false} onChange={(event) => setDiscussionEditForms((current) => ({ ...current, [thread.id]: { ...current[thread.id], is_pinned: event.target.checked } }))} />
                    <span>Pin thread</span>
                  </label>
                  <button className="secondary-button" type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Update discussion"}
                  </button>
                </form>

                <div className="teacher-report-list">
                  {(thread.replies || []).map((reply) => (
                    <div key={reply.id}>
                      <strong>{reply.author_name || "Teacher reply"}</strong>
                      <span>{reply.body}</span>
                    </div>
                  ))}
                  {!thread.replies?.length ? <p className="empty-state">No replies yet.</p> : null}
                </div>

                <form
                  className="teacher-question-card teacher-question-card--new"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setSaving(true);
                    setError("");
                    setSuccess("");
                    try {
                      await teacherApi.createDiscussionReply(sectionId, thread.id, discussionReplyForms[thread.id]);
                      setSuccess("Reply posted.");
                      await loadWorkspace();
                    } catch (replyError) {
                      setError(replyError.message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <label className="field">
                    <span>Reply</span>
                    <input value={discussionReplyForms[thread.id]?.body ?? ""} onChange={(event) => setDiscussionReplyForms((current) => ({ ...current, [thread.id]: { body: event.target.value } }))} />
                  </label>
                  <button className="primary-button" type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Post reply"}
                  </button>
                </form>
              </article>
            ))}
            {!classroom?.discussion_threads?.length ? <p className="empty-state">No discussion threads yet.</p> : null}
          </div>
        </div>
      </TeacherSectionCard>
      ) : null}

      {activeTab === "students" ? (
      <TeacherSectionCard
        eyebrow="Students"
        title="Class roster and support status"
        description="Use this tab as the roster lane for the selected class instead of mixing student cards into the assessment screen."
      >
        <div className="teacher-student-grid">
          {(classroom?.students || []).map((student) => (
            <article className="teacher-class-card" key={student.id}>
              <div className="teacher-class-card__header">
                <div>
                  <p className="teacher-class-card__eyebrow">{student.school_id || "Student"}</p>
                  <h3>{student.full_name}</h3>
                </div>
                <span className="pill">{student.intervention_status || "clear"}</span>
              </div>
              <p className="teacher-class-card__subjects">{student.email}</p>
              <div className="teacher-class-card__meta">
                <span>{student.grade_level || classroom?.grade_level || "Grade level"}</span>
                <span>{student.status || "active"}</span>
                <span>{student.guardian_name || "No guardian saved"}</span>
              </div>
              {student.intervention_note ? (
                <div className="teacher-feedback-box">
                  <strong>Support note</strong>
                  <span>{student.intervention_note}</span>
                </div>
              ) : null}
            </article>
          ))}
          {!classroom?.students?.length ? <p className="empty-state">No active students in this class yet.</p> : null}
        </div>

        <div className="teacher-assignment-stack">
          <h3>Open support items</h3>
          {openInterventions.map((intervention) => (
            <article className="teacher-intervention-card" key={intervention.id}>
              <div className="teacher-intervention-card__header">
                <strong>Student #{intervention.student_user_id}</strong>
                <span className="teacher-intervention-card__status teacher-intervention-card__status--open">
                  {intervention.status}
                </span>
              </div>
              <div className="teacher-intervention-card__body">
                <div>
                  <strong>Trigger score</strong>
                  <span>{intervention.trigger_score}%</span>
                </div>
                <div>
                  <strong>Teacher note</strong>
                  <span>{intervention.teacher_note || "No note yet."}</span>
                </div>
              </div>
            </article>
          ))}
          {!openInterventions.length ? <p className="empty-state">No open support items for this class.</p> : null}
        </div>
      </TeacherSectionCard>
      ) : null}

      {activeTab === "calendar" ? (
      <TeacherSectionCard
        eyebrow="Calendar"
        title="Class events and schedule"
        description="A focused calendar lane for the selected class so events are not buried between authoring tools."
      >
        <div className="teacher-class-grid">
          {(classroom?.calendar_events || []).map((event) => (
            <article className="teacher-class-card" key={event.id}>
              <div className="teacher-class-card__header">
                <div>
                  <p className="teacher-class-card__eyebrow">{event.event_type}</p>
                  <h3>{event.title}</h3>
                </div>
                <span className="pill">Class event</span>
              </div>
              <p className="teacher-class-card__subjects">{event.description || "No description saved."}</p>
              <div className="teacher-class-card__meta">
                <span>{event.start_at || "Start TBD"}</span>
                <span>{event.end_at || "End TBD"}</span>
              </div>
            </article>
          ))}
          {!classroom?.calendar_events?.length ? <p className="empty-state">No class events yet.</p> : null}
        </div>
      </TeacherSectionCard>
      ) : null}

      {activeTab === "grades" ? (
      <TeacherSectionCard
        eyebrow="Submission Review"
        title="Student work and grading"
        description="Inspect responses, assign scores, and trigger support follow-up from the same review surface."
      >
        <div className="teacher-assignment-stack">
          {(classroom?.submissions || []).map((submission) => (
            <form
              key={submission.id}
              className="teacher-assignment-card"
              onSubmit={async (event) => {
                event.preventDefault();
                setSaving(true);
                setError("");
                setSuccess("");
                try {
                  await teacherApi.reviewSubmission(sectionId, submission.id, {
                    raw_score: Number(reviewForms[submission.id]?.raw_score || 0),
                    percentage: Number(reviewForms[submission.id]?.percentage || 0),
                    feedback: reviewForms[submission.id]?.feedback || "",
                  });
                  setSuccess("Submission reviewed.");
                  await loadWorkspace();
                } catch (reviewError) {
                  setError(reviewError.message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div className="teacher-class-card__header">
                <div>
                  <p className="teacher-class-card__eyebrow">{submission.student_name}</p>
                  <h3>{submission.assignment_title}</h3>
                </div>
                <span className="pill">{submission.status}</span>
              </div>
              <div className="teacher-report-list">
                <div>
                  <strong>Written response</strong>
                  <span>{submission.response_text || "No written response submitted."}</span>
                </div>
                <div>
                  <strong>Uploaded file path</strong>
                  <span>{submission.uploaded_file_path || "No uploaded file path provided."}</span>
                </div>
              </div>
              <div className="review-grid">
                <label className="field">
                  <span>Raw score</span>
                  <input
                    value={reviewForms[submission.id]?.raw_score ?? ""}
                    onChange={(event) =>
                      setReviewForms((current) => ({
                        ...current,
                        [submission.id]: { ...current[submission.id], raw_score: event.target.value },
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Percentage</span>
                  <input
                    value={reviewForms[submission.id]?.percentage ?? ""}
                    onChange={(event) =>
                      setReviewForms((current) => ({
                        ...current,
                        [submission.id]: { ...current[submission.id], percentage: event.target.value },
                      }))
                    }
                  />
                </label>
              </div>
              <label className="field">
                <span>Feedback</span>
                <textarea
                  value={reviewForms[submission.id]?.feedback ?? ""}
                  onChange={(event) =>
                    setReviewForms((current) => ({
                      ...current,
                      [submission.id]: { ...current[submission.id], feedback: event.target.value },
                    }))
                  }
                />
              </label>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Review submission"}
              </button>
            </form>
          ))}
          {!classroom?.submissions?.length ? <p className="empty-state">No student submissions yet.</p> : null}
        </div>
      </TeacherSectionCard>
      ) : null}
    </TeacherPageShell>
  );
}
