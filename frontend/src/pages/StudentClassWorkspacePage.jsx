import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { StudentPageShell, StudentSectionCard } from "../components/student/StudentPageShell";
import { studentApi } from "../lib/api";

export default function StudentClassWorkspacePage() {
  const { sectionId } = useParams();
  const [classroom, setClassroom] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [submissionForms, setSubmissionForms] = useState({});

  const loadWorkspace = () => {
    studentApi
      .classWorkspace(sectionId)
      .then((response) => {
        setClassroom(response.classroom);
        const nextForms = {};
        for (const assignment of response.classroom?.assignments || []) {
          nextForms[assignment.id] = {
            response_text: assignment.submission?.response_text || "",
            uploaded_file_path: assignment.submission?.uploaded_file_path || "",
          };
        }
        setSubmissionForms(nextForms);
      })
      .catch((loadError) => setError(loadError.message));
  };

  useEffect(() => {
    loadWorkspace();
  }, [sectionId]);

  const workspaceMap = useMemo(
    () => [
      { title: "Modules", detail: `${classroom?.modules?.length ?? 0} learning materials available` },
      {
        title: "Assignments",
        detail: `${classroom?.assignments?.length ?? 0} visible work items to complete or review`,
      },
      {
        title: "Class Updates",
        detail: `${classroom?.announcements?.length ?? 0} announcements and ${classroom?.discussion_threads?.length ?? 0} discussion threads`,
      },
      {
        title: "Calendar & Resources",
        detail: `${classroom?.calendar_events?.length ?? 0} events and ${classroom?.resources?.length ?? 0} resources in scope`,
      },
    ],
    [classroom]
  );

  return (
    <StudentPageShell
      badge="Class Workspace"
      title={classroom?.name || "Loading class..."}
      description="Published modules, assignments, discussion threads, shared resources, and schedule updates now surface directly to the enrolled student."
      metrics={[
        { label: "Modules", value: classroom?.modules?.length ?? "-", caption: "Published learning materials" },
        { label: "Assignments", value: classroom?.assignments?.length ?? "-", caption: "Visible work items" },
        { label: "Resources", value: classroom?.resources?.length ?? "-", caption: "Shared references" },
        { label: "Events", value: classroom?.calendar_events?.length ?? "-", caption: "Calendar items in class" },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <StudentSectionCard
        eyebrow="Class Pulse"
        title="How this class is organized"
        description="A denser orientation layer so the student workspace feels closer to the parent folder's class loop."
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
        <StudentSectionCard
          eyebrow="Modules"
          title="Published learning materials"
          description="This workspace now follows the denser parent pattern: richer content cards instead of plain file lists."
          actions={<span className="admin-tag-chip">Learning lane</span>}
        >
          <ul className="workspace-list">
            {(classroom?.modules || []).map((module) => (
              <li className="student-content-card" key={module.id}>
                <div className="student-content-card__header">
                  <strong>{module.title}</strong>
                  <span>{module.subject_tag || "Module"}</span>
                </div>
                <p>{module.description || "No module description yet."}</p>
                <em>{module.file_path || "No attachment path saved yet."}</em>
              </li>
            ))}
          </ul>
        </StudentSectionCard>

        <StudentSectionCard
          eyebrow="Assignments"
          title="Submit work and monitor review state"
          description="Resubmissions clear stale grades until the teacher reviews again, so this card behaves more like a live work queue than a static assignment list."
          actions={<span className="admin-tag-chip">Submission queue</span>}
        >
          <div className="workspace-list">
            {(classroom?.assignments || []).map((assignment) => (
              <form
                key={assignment.id}
                className="review-card review-card--student-work"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setSaving(true);
                  setError("");
                  setSuccess("");
                  try {
                    await studentApi.submitAssignment(sectionId, assignment.id, submissionForms[assignment.id]);
                    setSuccess("Assignment submitted.");
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
                  <span>{assignment.submission_status} / {assignment.feedback || "No feedback yet"}</span>
                </div>
                <p>{assignment.instructions || "No instructions provided yet."}</p>
                <div className="student-assignment-meta">
                  <div>
                    <strong>Status</strong>
                    <span>{assignment.submission_status}</span>
                  </div>
                  <div>
                    <strong>Remedial</strong>
                    <span>{assignment.remedial_access ? "Open" : "Locked"}</span>
                  </div>
                </div>
                <label className="field">
                  <span>Written response</span>
                  <input
                    value={submissionForms[assignment.id]?.response_text ?? ""}
                    onChange={(event) =>
                      setSubmissionForms((current) => ({
                        ...current,
                        [assignment.id]: {
                          ...current[assignment.id],
                          response_text: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Uploaded file path</span>
                  <input
                    value={submissionForms[assignment.id]?.uploaded_file_path ?? ""}
                    onChange={(event) =>
                      setSubmissionForms((current) => ({
                        ...current,
                        [assignment.id]: {
                          ...current[assignment.id],
                          uploaded_file_path: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                {assignment.remedial_access ? (
                  <div className="form-error">
                    Remedial access is active for this assignment because your score fell below the 74% mastery threshold.
                  </div>
                ) : null}
                <button className="secondary-button" type="submit" disabled={saving}>
                  {saving ? "Submitting..." : "Submit assignment"}
                </button>
              </form>
            ))}
          </div>
        </StudentSectionCard>

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
          </ul>
        </StudentSectionCard>

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
          </div>
        </StudentSectionCard>

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
          </ul>
        </StudentSectionCard>
      </section>
    </StudentPageShell>
  );
}
