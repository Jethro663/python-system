import { useEffect, useMemo, useState } from "react";
import { FileUp, Library, School, Users } from "lucide-react";

import { AdminPageShell, AdminSectionCard } from "../components/admin/AdminPageShell";
import { adminApi } from "../lib/api";

const EMPTY_FORM = {
  title: "",
  category: "PDF",
  visibility: "school",
  file_path: "",
};

function categoryFromFile(file) {
  const extension = file?.name?.split(".").pop()?.toUpperCase();
  if (!extension) return "FILE";
  if (extension === "PPTX") return "PPT";
  return extension;
}

export default function AdminLibraryPage() {
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resourceFile, setResourceFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const loadResources = async () => {
    try {
      const data = await adminApi.resources();
      setResources(data.resources || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  const summary = useMemo(() => ({
    school: resources.filter((resource) => resource.visibility === "school").length,
    teachers: resources.filter((resource) => resource.visibility === "teachers").length,
  }), [resources]);

  return (
    <AdminPageShell
      badge="Nexora Library"
      title="Upload shared school files"
      description="Choose whether a file is available to everyone or only to teachers."
      metrics={[
        { label: "Files", value: resources.length || "-", caption: "Uploaded library entries" },
        { label: "Entire School", value: summary.school, caption: "Visible across the school" },
        { label: "Teachers", value: summary.teachers, caption: "Available for teacher reuse" },
      ]}
    >
      <div className="page-grid page-grid--admin">
        <AdminSectionCard
          eyebrow="Upload"
          title="Add a file to the Nexora Library"
          description="Upload one file, choose its audience, and save it to the shared library."
        >
          {error ? <div className="form-error">{error}</div> : null}
          {success ? <div className="form-success">{success}</div> : null}

          <form
            className="form-grid"
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
                  const uploaded = await adminApi.uploadFile(uploadForm);
                  filePath = uploaded.file_path;
                }

                if (!filePath) {
                  throw new Error("Choose a file before saving.");
                }

                await adminApi.createResource({
                  ...form,
                  title: form.title || resourceFile?.name || "Untitled resource",
                  category: form.category || categoryFromFile(resourceFile),
                  file_path: filePath,
                  section_id: null,
                });
                setForm(EMPTY_FORM);
                setResourceFile(null);
                setSuccess("Library file uploaded.");
                await loadResources();
              } catch (saveError) {
                setError(saveError.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="admin-form-callout-grid">
              <article className="admin-mini-callout">
                <School size={18} />
                <div>
                  <strong>Entire school</strong>
                  <span>Students and teachers can see this file.</span>
                </div>
              </article>
              <article className="admin-mini-callout">
                <Users size={18} />
                <div>
                  <strong>Teachers only</strong>
                  <span>Teachers can reuse the file in their sections.</span>
                </div>
              </article>
            </div>

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
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>Audience</span>
              <select
                value={form.visibility}
                onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}
              >
                <option value="school">Entire school</option>
                <option value="teachers">Teachers only</option>
              </select>
            </label>

            <button className="primary-button" type="submit" disabled={saving}>
              <FileUp size={16} />
              {saving ? "Uploading..." : "Upload to library"}
            </button>
          </form>
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Files"
          title="Current library"
          description="A simple list of files currently available from the admin library."
          actions={<span className="admin-tag-chip">{resources.length} files</span>}
        >
          <div className="admin-library-grid">
            {resources.map((resource) => (
              <article className="admin-library-card" key={resource.id}>
                <div className="admin-library-card__header">
                  <div>
                    <p className="admin-library-card__eyebrow">{resource.category || "FILE"}</p>
                    <strong>{resource.title}</strong>
                  </div>
                  <span className="admin-tag-chip">
                    {resource.visibility === "teachers" ? "Teachers" : "School"}
                  </span>
                </div>
                <div className="admin-library-card__metrics">
                  <div>
                    <strong>Audience</strong>
                    <span>{resource.visibility === "teachers" ? "Teachers only" : "Entire school"}</span>
                  </div>
                  <div>
                    <strong>File</strong>
                    <span>{resource.file_path}</span>
                  </div>
                </div>
              </article>
            ))}
            {!resources.length ? <p className="empty-state">No files have been uploaded yet.</p> : null}
          </div>
        </AdminSectionCard>
      </div>
    </AdminPageShell>
  );
}
