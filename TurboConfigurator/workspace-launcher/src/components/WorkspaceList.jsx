function WorkspaceList({
  workspaces = [],
  activeWorkspaceId,
  onSelectWorkspace,
  title = "Workspaces",
  subtitle = "Available presets",
}) {
  const safeWorkspaces = Array.isArray(workspaces) ? workspaces : [];

  return (
    <section className="panel-shell list-panel">
      <div className="panel-shell__header">
        <div>
          <p className="panel-shell__eyebrow">{title}</p>
          <h2 className="panel-shell__title">Preset list</h2>
        </div>
        <p className="panel-shell__subline">{subtitle}</p>
      </div>

      <div className="panel-shell__body">
        <div className="workspace-stack">
          {safeWorkspaces.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">No workspaces in this group</p>
              <p className="empty-state__copy">Pick another group to show its presets.</p>
            </div>
          ) : (
            safeWorkspaces.map((workspace, index) => {
              const isActive = workspace.id === activeWorkspaceId;
              const safeActions = Array.isArray(workspace.actions) ? workspace.actions : [];

              return (
                <button
                  key={workspace.id}
                  type="button"
                  className={`workspace-card ${isActive ? "is-active" : ""}`}
                  onClick={() => onSelectWorkspace?.(workspace.id)}
                  aria-pressed={isActive}
                >
                  <div className="workspace-card__header">
                    <div className="workspace-card__identity">
                      <span className="workspace-card__index">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <div className="workspace-card__copy">
                        <h3 className="workspace-card__title">{workspace.title}</h3>
                        <p className="workspace-card__description">{workspace.description || "No description"}</p>
                      </div>
                    </div>

                    <span
                      className={`workspace-card__status ${
                        workspace.status !== "Ready" ? "workspace-card__status--warning" : ""
                      }`}
                    >
                      {workspace.status || "Unknown"}
                    </span>
                  </div>

                  <div className="workspace-card__meta">
                    <span className="workspace-pill">{workspace.category || "Other"}</span>
                    <span className="workspace-pill">{safeActions.length} actions</span>
                    <span className="workspace-pill workspace-pill--soft">
                      {workspace.executionState || "Not executable"}
                    </span>
                    {workspace.trigger ? (
                      <span className="workspace-pill workspace-pill--ghost">
                        {workspace.trigger}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

export default WorkspaceList;
