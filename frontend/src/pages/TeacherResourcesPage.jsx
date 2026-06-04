import { useEffect, useMemo, useState } from "react";
import { FileUp, FolderOpenDot, Library, Send, Upload } from "lucide-react";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

const EMPTY_FORM = {
  section_id: "",
  title: "",
  category: "PDF",
  file_path: "",
  visibility: "section",
};

function categoryFromFile(file) {
  const extension = file?.name?.split(".").pop()?.toUpperCase();
  if (!extension) return "FILE";
  if (extension === "PPTX") return "PPT";
  return extension;
}

export default function TeacherResourcesPage() {
  const [sections, setSections] = useState([]);
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [publishTargets, setPublishTargets] = useState({});
  const [resourceFile, setResourceFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState(null);

  const loadResources = async () => {
    try {
      const response = await teacherApi.resources();
      const loadedSections = response.sections || [];
      setSections(loadedSections);
      setResources(response.resources || []);
      if (!form.section_id && loadedSections[0]) {
        setForm((current) => ({ ...current, section_id: String(loadedSections[0].id) }));
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  const libraryResources = useMemo(
    () => resources.filter((resource) => resource.source === "nexora"),
    [resources]
  );
  const sectionResources = useMemo(
    () => resources.filter((resource) => resource.can_edit || resource.visibility === "section"),
    [resources]
  );

  return (
    <TeacherPageShell
      badge="Teacher Resources"
      title="Resources and Nexora Library"
      description="Review shared library files, then publish the useful ones to your own sections."
      icon={Library}
      headerMeta={
        <>
          <span>{libraryResources.length} library files</span>
          <span>{sectionResources.length} section files</span>
        </>
      }
      metrics={[
        { label: "Library Files", value: libraryResources.length || "-", caption: "Shared by admin" },
        { label: "Section Files", value: sectionResources.length || "-", caption: "Visible in classes" },
        { label: "Sections", value: sections.length || "-", caption: "Classes you can publish to" },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <TeacherSectionCard
        eyebrow="Nexora Library"
        title="Shared files from admin"
        description="Choose a shared file and publish it to one of your sections for students to see."
        action={<span className="admin-tag-chip">{libraryResources.length} shared</span>}
      >
        <div className="teacher-resource-grid">
          {libraryResources.map((resource) => {
            const targetSectionId = publishTargets[resource.id] || sections[0]?.id || "";
            return (
              <article className="teacher-resource-card teacher-resource-card--library" key={resource.id}>
                <div className="teacher-resource-card__hero">
                  <div>
                    <p className="teacher-resource-card__eyebrow">{resource.category || "FILE"}</p>
                    <strong>{resource.title}</strong>
                  </div>
                  <span className="teacher-record-pill teacher-record-pill--pending">
                    {resource.visibility === "teachers" ? "Teachers" : "School"}
                  </span>
                </div>
                <div className="teacher-resource-card__metrics">
                  <div>
                    <strong>Source</strong>
                    <span>{resource.uploader_name || "Nexora Library"}</span>
                  </div>
                  <div>
                    <strong>File</strong>
                    <span>{resource.file_path}</span>
                  </div>
                </div>
                <div className="teacher-resource-publish-row">
                  <label className="field">
                    <span>Publish to section</span>
                    <select
                      value={targetSectionId}
                      onChange={(event) =>
                        setPublishTargets((current) => ({ ...current, [resource.id]: event.target.value }))
                      }
                    >
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={!targetSectionId || publishingId === resource.id}
                    onClick={async () => {
                      setPublishingId(resource.id);
                      setError("");
                      setSuccess("");
                      try {
                        await teacherApi.publishResourceToSection(resource.id, {
                          section_id: Number(targetSectionId),
                        });
                        setSuccess("Library file published to your section.");
                        await loadResources();
                      } catch (publishError) {
                        setError(publishError.message);
                      } finally {
                        setPublishingId(null);
                      }
                    }}
                  >
                    <Send size={16} />
                    {publishingId === resource.id ? "Publishing..." : "Publish"}
                  </button>
                </div>
              </article>
            );
          })}
          {!libraryResources.length ? <p className="empty-state">No shared library files are available yet.</p> : null}
        </div>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Section Files"
        title="Files students can see"
        description="These resources are already attached to one of your sections."
        action={<span className="admin-tag-chip">{sectionResources.length} section files</span>}
      >
        <div className="teacher-resource-grid">
          {sectionResources.map((resource) => (
            <article className="teacher-resource-card" key={resource.id}>
              <div className="teacher-resource-card__hero">
                <div>
                  <p className="teacher-resource-card__eyebrow">{resource.category || "FILE"}</p>
                  <strong>{resource.title}</strong>
                </div>
                <span className="teacher-record-pill teacher-record-pill--submitted">
                  {resource.section_name || "Teacher file"}
                </span>
              </div>
              <div className="teacher-resource-card__metrics">
                <div>
                  <strong>Section</strong>
                  <span>{resource.section_name || "Not attached"}</span>
                </div>
                <div>
                  <strong>File</strong>
                  <span>{resource.file_path}</span>
                </div>
              </div>
            </article>
          ))}
          {!sectionResources.length ? <p className="empty-state">No resources have been published to your sections yet.</p> : null}
        </div>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Upload"
        title="Add your own section file"
        description="Upload a new file directly to a section when it is specific to your class."
      >
        <form
          className="teacher-filter-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError("");
            setSuccess("");
            try {
              let filePath = form.file_path;
              if (resourceFile) {
                const uploadForm = new FormData();
                uploadForm.append("file", resourceFile);
                uploadForm.append("kind", "resource");
                const uploaded = await teacherApi.uploadFile(uploadForm);
                filePath = uploaded.file_path;
              }

              if (!filePath) {
                throw new Error("Choose a file before saving.");
              }

              await teacherApi.createResource({
                ...form,
                title: form.title || resourceFile?.name || "Untitled resource",
                category: form.category || categoryFromFile(resourceFile),
                file_path: filePath,
                section_id: form.section_id ? Number(form.section_id) : null,
                visibility: "section",
              });
              setForm((current) => ({ ...EMPTY_FORM, section_id: current.section_id }));
              setResourceFile(null);
              setSuccess("Section resource uploaded.");
              await loadResources();
            } catch (saveError) {
              setError(saveError.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="teacher-resource-callout-grid">
            <article className="admin-mini-callout">
              <FolderOpenDot size={18} />
              <div>
                <strong>Section file</strong>
                <span>Attach class-specific files to one section.</span>
              </div>
            </article>
            <article className="admin-mini-callout">
              <Upload size={18} />
              <div>
                <strong>Upload once</strong>
                <span>The saved file appears in the section resource list.</span>
              </div>
            </article>
          </div>

          <label className="field">
            <span>Section</span>
            <select value={form.section_id} onChange={(event) => setForm((current) => ({ ...current, section_id: event.target.value }))}>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>File</span>
            <input
              type="file"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null;
                setResourceFile(nextFile);
                if (nextFile) {
                  setForm((current) => ({
                    ...current,
                    title: current.title || nextFile.name,
                    category: categoryFromFile(nextFile),
                  }));
                }
              }}
            />
          </label>
          <label className="field">
            <span>Title</span>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <button className="primary-button" type="submit" disabled={saving || !form.section_id}>
            <FileUp size={16} />
            {saving ? "Uploading..." : "Upload section file"}
          </button>
        </form>
      </TeacherSectionCard>
    </TeacherPageShell>
  );
}
