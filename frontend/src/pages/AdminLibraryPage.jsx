import { useEffect, useMemo, useState } from "react";
import { FolderKanban, Link2, School, Upload } from "lucide-react";

import { AdminPageShell, AdminSectionCard } from "../components/admin/AdminPageShell";
import { adminApi } from "../lib/api";

const DEFAULT_RESOURCE = {
  title: "",
  category: "pdf",
  file_path: "",
  visibility: "school",
  section_id: "",
};

function createResourceEditForm(resource) {
  return {
    title: resource.title || "",
    category: resource.category || "pdf",
    file_path: resource.file_path || "",
    visibility: resource.visibility || "school",
    section_id: resource.section_id ? String(resource.section_id) : "",
  };
}

export default function AdminLibraryPage() {
  const [resources, setResources] = useState([]);
  const [sections, setSections] = useState([]);
  const [form, setForm] = useState(DEFAULT_RESOURCE);
  const [selectedResourceId, setSelectedResourceId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resourceFile, setResourceFile] = useState(null);
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    try {
      const [resourcesData, sectionsData] = await Promise.all([
        adminApi.resources(),
        adminApi.sections(),
      ]);
      const loadedResources = resourcesData.resources || [];
      setResources(loadedResources);
      setSections(sectionsData.sections || []);
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
    loadData();
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
    <AdminPageShell
      badge="Library / Resources"
      title="Institution-wide files and references"
      description="This is the admin-facing resource library for shared downloads and section-scoped files."
      metrics={[
        { label: "Resources", value: resources.length || "-", caption: "Current library entries" },
        { label: "School-wide", value: resourceSummary.school, caption: "Files visible to the entire institution" },
        { label: "Section", value: resourceSummary.section, caption: "Files scoped to specific sections" },
        { label: "Sections", value: sections.length || "-", caption: "Available section targets" },
      ]}
    >
      <div className="page-grid page-grid--admin">
        <AdminSectionCard
          eyebrow="Library / Resources"
          title="Institution-wide files and references"
          description="Review school and section resource entries before publishing or updating them."
        >
          {error ? <div className="form-error">{error}</div> : null}
          {success ? <div className="form-success">{success}</div> : null}

          <div className="admin-library-grid">
            {resources.map((resource) => (
              <article
                className={`admin-library-card ${resource.id === selectedResourceId ? "admin-library-card--selected" : ""}`}
                key={resource.id}
                onClick={() => {
                  setSelectedResourceId(resource.id);
                  setEditForm(createResourceEditForm(resource));
                  setSuccess("");
                }}
              >
                <div className="admin-library-card__header">
                  <div>
                    <p className="admin-library-card__eyebrow">
                      {resource.section_name || resource.section_id || "School-wide"}
                    </p>
                    <strong>{resource.title}</strong>
                  </div>
                  <span className="admin-tag-chip">{resource.visibility}</span>
                </div>
                <div className="admin-library-card__metrics">
                  <div>
                    <strong>Category</strong>
                    <span>{resource.category || "-"}</span>
                  </div>
                  <div>
                    <strong>Path</strong>
                    <span>{resource.file_path || "-"}</span>
                  </div>
                </div>
                <p className="admin-library-card__note">
                  {resource.visibility === "school"
                    ? "Visible across the entire institution library."
                    : "Scoped to the selected section library only."}
                </p>
              </article>
            ))}
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Selected Resource"
          title="Library spotlight"
          description="Keep the chosen resource visible while adjusting its visibility, path, or section scope."
        >
          {selectedResource ? (
            <div className="admin-spotlight-card">
              <div className="admin-spotlight-card__header">
                <div>
                  <p className="admin-spotlight-card__eyebrow">Selected Resource</p>
                  <h3>{selectedResource.title}</h3>
                  <p>{selectedResource.category || "General file"} • {selectedResource.visibility}</p>
                </div>
                <span className="admin-tag-chip">{selectedResource.visibility}</span>
              </div>
              <div className="admin-spotlight-grid">
                <div>
                  <strong>Target</strong>
                  <span>{selectedResource.section_name || selectedResource.section_id || "School-wide library"}</span>
                </div>
                <div>
                  <strong>File path</strong>
                  <span>{selectedResource.file_path}</span>
                </div>
                <div>
                  <strong>Usage note</strong>
                  <span>School-wide references should be stable, high-signal documents rather than section-specific noise.</span>
                </div>
                <div>
                  <strong>Delivery</strong>
                  <span>These entries feed teacher and student download surfaces.</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="empty-state">Select a resource row to review it.</p>
          )}
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Create Resource"
          title="Shared references and downloadable files"
          description="Create school-wide or section-linked file entries from the same admin shell."
        >
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              setSuccess("");
              try {
                await adminApi.createResource({
                  ...form,
                  section_id: form.section_id ? Number(form.section_id) : null,
                });
                setForm(DEFAULT_RESOURCE);
                setResourceFile(null);
                setSuccess("Resource created.");
                await loadData();
              } catch (saveError) {
                setError(saveError.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="admin-form-callout-grid">
              <article className="admin-mini-callout">
                <FolderKanban size={18} />
                <div>
                  <strong>Library curation</strong>
                  <span>Use clear titles so teachers and students can identify the right file at a glance.</span>
                </div>
              </article>
              <article className="admin-mini-callout">
                <School size={18} />
                <div>
                  <strong>Visibility discipline</strong>
                  <span>Keep school-wide visibility for materials that truly belong across all sections.</span>
                </div>
              </article>
            </div>

            {[
              ["title", "Title"],
              ["category", "Category"],
              ["file_path", "File path"],
            ].map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input
                  value={form[key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </label>
            ))}

            <label className="field">
              <span>Upload file</span>
              <input type="file" onChange={(event) => setResourceFile(event.target.files?.[0] || null)} />
            </label>

            <label className="field">
              <span>Visibility</span>
              <select
                value={form.visibility}
                onChange={(event) =>
                  setForm((current) => ({ ...current, visibility: event.target.value }))
                }
              >
                <option value="school">School-wide</option>
                <option value="section">Section</option>
              </select>
            </label>

            <label className="field">
              <span>Section</span>
              <select
                value={form.section_id}
                onChange={(event) =>
                  setForm((current) => ({ ...current, section_id: event.target.value }))
                }
              >
                <option value="">School-wide</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
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
                    const uploaded = await adminApi.uploadFile(formData);
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
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Update Resource"
          title="Selected library entry"
          description="Adjust metadata or file paths for existing resources."
        >
          {selectedResource && editForm ? (
            <form
              className="form-grid"
              onSubmit={async (event) => {
                event.preventDefault();
                setSaving(true);
                setError("");
                setSuccess("");
                try {
                  await adminApi.updateResource(selectedResource.id, {
                    ...editForm,
                    section_id: editForm.section_id ? Number(editForm.section_id) : null,
                  });
                  setSuccess("Resource updated.");
                  await loadData();
                } catch (saveError) {
                  setError(saveError.message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div className="admin-form-callout-grid">
                <article className="admin-mini-callout">
                  <Link2 size={18} />
                  <div>
                    <strong>Path review</strong>
                    <span>Keep file paths stable so existing teacher and student links do not break.</span>
                  </div>
                </article>
              </div>

              {[
                ["title", "Title"],
                ["category", "Category"],
                ["file_path", "File path"],
              ].map(([key, label]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <input
                    value={editForm[key]}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                </label>
              ))}

              <label className="field">
                <span>Visibility</span>
                <select
                  value={editForm.visibility}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, visibility: event.target.value }))
                  }
                >
                  <option value="school">School-wide</option>
                  <option value="section">Section</option>
                </select>
              </label>

              <label className="field">
                <span>Section</span>
                <select
                  value={editForm.section_id}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, section_id: event.target.value }))
                  }
                >
                  <option value="">School-wide</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>

              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save resource changes"}
              </button>
            </form>
          ) : (
            <p className="empty-state">Select a resource row to edit it.</p>
          )}
        </AdminSectionCard>
      </div>
    </AdminPageShell>
  );
}
