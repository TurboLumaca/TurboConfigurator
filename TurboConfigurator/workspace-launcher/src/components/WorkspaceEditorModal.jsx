import { WORKSPACE_CATEGORIES } from "../domain/workspaceTypes";

const CATEGORY_OPTIONS = [
  { value: WORKSPACE_CATEGORIES.STUDY, label: "Study" },
  { value: WORKSPACE_CATEGORIES.CODING, label: "Coding" },
  { value: WORKSPACE_CATEGORIES.OPERATIONS, label: "Operations" },
  { value: WORKSPACE_CATEGORIES.PERSONAL, label: "Personal" },
  { value: WORKSPACE_CATEGORIES.OTHER, label: "Other" },
];

function WorkspaceEditorModal({
  open = false,
  mode = "create",
  value,
  busy = false,
  errorMessage = "",
  onChange,
  onClose,
  onSubmit,
  onDelete,
  canDelete = false,
}) {
  if (!open) {
    return null;
  }

  const form = value || {};
  const title = mode === "edit" ? "Edit workspace" : "Create workspace";
  const submitLabel = mode === "edit" ? "Save changes" : "Create workspace";

  const setField = (field) => (event) => {
    onChange?.(field, event.target.value);
  };

  return (
    <div className="editor-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="editor-card">
        <header className="editor-card__header">
          <h2 className="editor-card__title">{title}</h2>
          <button type="button" className="editor-inline-button" onClick={onClose} disabled={busy}>
            Close
          </button>
        </header>

        <form
          className="editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.();
          }}
        >
          <label className="editor-field">
            <span className="editor-field__label">Name</span>
            <input
              data-testid="workspace-name-input"
              className="editor-input"
              value={form.name || ""}
              onChange={setField("name")}
              placeholder="Aurea Dev Session"
              disabled={busy}
            />
          </label>

          <label className="editor-field">
            <span className="editor-field__label">Description</span>
            <textarea
              data-testid="workspace-description-input"
              className="editor-input editor-input--textarea"
              value={form.description || ""}
              onChange={setField("description")}
              placeholder="What this workspace prepares"
              disabled={busy}
            />
          </label>

          <div className="editor-row">
            <label className="editor-field">
              <span className="editor-field__label">Category</span>
              <select
                data-testid="workspace-category-input"
                className="editor-input"
                value={form.category || WORKSPACE_CATEGORIES.STUDY}
                onChange={setField("category")}
                disabled={busy}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="editor-field">
              <span className="editor-field__label">Quick shortcut</span>
              <input
                data-testid="workspace-shortcut-input"
                className="editor-input"
                value={form.shortcut || ""}
                onChange={setField("shortcut")}
                placeholder="Cmd+Opt+8"
                disabled={busy}
              />
            </label>
          </div>

          <label className="editor-field">
            <span className="editor-field__label">Primary path</span>
            <input
              data-testid="workspace-path-input"
              className="editor-input"
              value={form.primaryPath || ""}
              onChange={setField("primaryPath")}
              placeholder="~/Documents/Project"
              disabled={busy}
            />
          </label>

          <label className="editor-field">
            <span className="editor-field__label">Focus note</span>
            <textarea
              data-testid="workspace-notes-input"
              className="editor-input editor-input--textarea"
              value={form.notes || ""}
              onChange={setField("notes")}
              placeholder="Optional note shown in workspace detail"
              disabled={busy}
            />
          </label>

          {errorMessage ? <p className="editor-error">{errorMessage}</p> : null}

          <footer className="editor-actions">
            {canDelete ? (
              <button type="button" className="editor-danger-button" onClick={onDelete} disabled={busy}>
                Delete workspace
              </button>
            ) : (
              <span />
            )}

            <div className="editor-actions__right">
              <button type="button" className="editor-inline-button" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="editor-primary-button" disabled={busy}>
                {busy ? "Saving..." : submitLabel}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default WorkspaceEditorModal;
