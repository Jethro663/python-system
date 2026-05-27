import { useEffect, useMemo, useState } from "react";
import { FolderOpenDot, Link2, Library, Upload } from "lucide-react";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

const EMPTY_FORM = {
  section_id: "",
  title: "",
  category: "PDF",
  file_path: "",
  visibility: "section",
};

function createResourceEditForm(resource) {
  return {
    section_id: resource.section_id ? String(resource.section_id) : "",
    title: resource.title || "",
    category: resource.category || "PDF",
    file_path: resource.file_path || "",
    visibility: resource.visibility || "section",
  };
}

export default function TeacherResourcesPage() {
  const [sections, setSections] = useState([]);
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedResourceId, setSelectedResourceId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resourceFile, setResourceFile] = useState(null);

  const loadResources = async () => {
    try {
      const response = await teacherApi.resources();
      const loadedSections = response.sections || [];
      const loadedResources = response.resources || [];
      setSections(loadedSections);
      setResources(loadedResources);
      if (!form.section_id && loadedSections[0]) {
        setForm((current) => ({ ...current, section_id: String(loadedSections[0].id) }));
      }
      if (selectedResourceId) {
        const nextResource = loadedResources.find((resource) => resource.id === selectedResourceId);
        if (nextResource) {
          setEditForm(createResourceEditForm(nextResource));
        }
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  const selectedResource =
    resources.find((resource) => resource.id === selectedResourceId) || resources[0] || null;

  useEffect(() => {
    if (selectedResource && selectedResource.id !== selectedResourceId) {
      setSelectedResourceId(selectedResource.id);
    }
    if (selectedResource) {
      setEditForm(createResourceEditForm(selectedResource));
    } else {
      setEditForm(null);
    }
  }, [selectedResourceId, selectedResource]);

  const resourceSummary = useMemo(() => ({
    school: resources.filter((resource) => resource.visibility === "school").length,
    section: resources.filter((resource) => resource.visibility === "section").length,
  }), [resources]);

  return (
    <TeacherPageShell
      badge="Teacher Resources"
      title="Teaching files and shared references"
      description="Teacher-owned files and class-linked resources now sit in the same visual language as the main copied workspace."
      icon={Library}
      headerMeta={
        <>
          <span>{resources.length} resources</span>
          <span>{resourceSummary.section} section scoped</span>
          <span>{resourceSummary.school} school scoped</span>
        </>
      }
      metrics={[
        { label: "Resources", value: resources.length || "-", caption: "Visible files and links" },
        { label: "Section Scope", value: resourceSummary.section, caption: "Resources attached to a section" },
        { label: "School Scope", value: resourceSummary.school, caption: "Resources published beyond one class" },
        { label: "Sections", value: sections.length || "-", caption: "Classes you can publish to" },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <TeacherSectionCard
        eyebrow="Resource Library"
        title="Current files"
        description="Review teacher and shared resource entries already visible through your classes."
        action={<span className="admin-tag-chip">Library view</span>}
      >
        <div className="teacher-resource-grid">
          {resources.map((resource) => (
            <article
              className={`teacher-resource-card ${resource.id === selectedResourceId ? "teacher-resource-card--selected" : ""}`}
              key={resource.id}
              onClick={() => {
                setSelectedResourceId(resource.id);
                setEditForm(createResourceEditForm(resource));
                setSuccess("");
              }}
            >
              <div className="teacher-resource-card__hero">
                <div>
                  <p className="teacher-resource-card__eyebrow">{resource.category || "-"}</p>
                  <strong>{resource.title}</strong>
                </div>
                <span className="teacher-record-pill teacher-record-pill--pending">{resource.visibility}</span>
              </div>
              <div className="teacher-resource-card__metrics">
                <div>
                  <strong>Section</strong>
                  <span>{resource.section_name || resource.section_id || "Teacher-owned / school-wide"}</span>
                </div>
                <div>
                  <strong>Path</strong>
                  <span>{resource.file_path}</span>
                </div>
              </div>
              <p className="teacher-resource-card__note">
                {resource.description || "Shared through the teacher resource lane for this class set."}
              </p>
            </article>
          ))}
        </div>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Create Resource"
        title="Add a teacher or class file reference"
        description="Create new PDF, DOCX, PPT, or link entries using the same teacher shell structure."
      >
        <form
          className="teacher-filter-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError("");
            setSuccess("");
            try {
              await teacherApi.createResource({
                ...form,
                section_id: form.section_id ? Number(form.section_id) : null,
              });
              setForm((current) => ({ ...EMPTY_FORM, section_id: current.section_id }));
              setSuccess("Resource created.");
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
              <Library size={18} />
              <div>
                <strong>Teaching library</strong>
                <span>Use clear titles so students can spot the right file from the class workspace quickly.</span>
              </div>
            </article>
            <article className="admin-mini-callout">
              <FolderOpenDot size={18} />
              <div>
                <strong>Section targeting</strong>
                <span>Keep section scope for class-specific handouts; widen visibility only when the resource truly travels.</span>
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
            <span>Title</span>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label className="field">
            <span>File path</span>
            <input value={form.file_path} onChange={(event) => setForm((current) => ({ ...current, file_path: event.target.value }))} />
          </label>
          <label className="field">
            <span>Upload file</span>
            <input type="file" onChange={(event) => setResourceFile(event.target.files?.[0] || null)} />
          </label>
          <label className="field">
            <span>Category</span>
            <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
              <option value="PDF">PDF</option>
              <option value="DOCX">DOCX</option>
              <option value="PPT">PPT</option>
              <option value="LINK">Link</option>
            </select>
          </label>
          <label className="field">
            <span>Visibility</span>
            <select value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}>
              <option value="section">Section</option>
              <option value="school">School</option>
            </select>
          </label>
          <div className="action-row">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create resource"}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={uploading || !resourceFile}
              onClick={async () => {
                setUploading(true);
                setError("");
                setSuccess("");
                try {
                  const formData = new FormData();
                  formData.append("file", resourceFile);
                  formData.append("kind", "resource");
                  const uploaded = await teacherApi.uploadFile(formData);
                  setForm((current) => ({ ...current, file_path: uploaded.file_path }));
                  setSuccess("Resource file uploaded. Review the path and save the resource.");
                } catch (uploadError) {
                  setError(uploadError.message);
                } finally {
                  setUploading(false);
                }
              }}
            >
              {uploading ? "Uploading..." : "Upload file"}
            </button>
          </div>
        </form>
      </TeacherSectionCard>

      <TeacherSectionCard
        eyebrow="Update Resource"
        title="Selected file reference"
        description="Adjust teacher or class resource metadata without recreating the row."
      >
        {selectedResource && editForm ? (
          <form
            className="teacher-filter-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              setSuccess("");
              try {
                await teacherApi.updateResource(selectedResource.id, {
                  ...editForm,
                  section_id: editForm.section_id ? Number(editForm.section_id) : null,
                });
                setSuccess("Resource updated.");
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
                <Link2 size={18} />
                <div>
                  <strong>Reference hygiene</strong>
                  <span>Keep paths and labels stable so existing class links remain understandable to students.</span>
                </div>
              </article>
            </div>

            <label className="field">
              <span>Section</span>
              <select value={editForm.section_id} onChange={(event) => setEditForm((current) => ({ ...current, section_id: event.target.value }))}>
                <option value="">Teacher-owned only</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Title</span>
              <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="field">
              <span>File path</span>
              <input value={editForm.file_path} onChange={(event) => setEditForm((current) => ({ ...current, file_path: event.target.value }))} />
            </label>
            <label className="field">
              <span>Category</span>
              <select value={editForm.category} onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))}>
                <option value="PDF">PDF</option>
                <option value="DOCX">DOCX</option>
                <option value="PPT">PPT</option>
                <option value="LINK">Link</option>
              </select>
            </label>
            <label className="field">
              <span>Visibility</span>
              <select value={editForm.visibility} onChange={(event) => setEditForm((current) => ({ ...current, visibility: event.target.value }))}>
                <option value="section">Section</option>
                <option value="school">School</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save resource changes"}
            </button>
          </form>
        ) : (
          <p className="empty-state">Select a resource row to edit it.</p>
        )}
      </TeacherSectionCard>
    </TeacherPageShell>
  );
}
