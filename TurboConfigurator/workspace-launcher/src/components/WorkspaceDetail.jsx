import RunButton from "./RunButton";

const actionGlyphs = {
  OPEN_APP: "APP",
  OPEN_FOLDER: "FOLDER",
  OPEN_URL: "URL",
  RUN_SHELL_COMMAND: "SHELL",
  OPEN_VSCODE_PROJECT: "VSCODE",
  OPEN_LATEST_FILE_IN_FOLDER: "LATEST",
};

function toStatusLabel(runtime, workspaceId) {
  if (!runtime?.lastRun || runtime.lastRun.workspaceId !== workspaceId) {
    return "No run yet";
  }

  if (runtime.lastRun.status === "success") {
    return "Last run succeeded";
  }

  if (runtime.lastRun.status === "partial") {
    return "Last run partial";
  }

  return "Last run failed";
}

function WorkspaceDetail({ workspace, runtime, running = false, onRunWorkspace }) {
  if (!workspace) {
    return (
      <main className="detail-panel">
        <section className="panel-shell detail-empty">
          <p className="panel-shell__eyebrow">Workspace detail</p>
          <h2 className="panel-shell__title">Select a preset</h2>
          <p className="panel-shell__subline">
            The selected workspace will show its action order, status, and launch summary here.
          </p>
        </section>
      </main>
    );
  }

  const safeActions = Array.isArray(workspace.actions) ? workspace.actions : [];
  const safeDetails = Array.isArray(workspace.details) ? workspace.details : [];
  const lastRun = runtime?.lastRun;
  const isCurrentRun = runtime?.isRunning && runtime?.activeRunId !== null;
  const runLabel = running ? "Running workspace" : "Run workspace";
  const runHint = running ? "Executing action sequence in order" : "Launch every action in order";
  const triggerLabel = workspace.trigger || "Manual only";

  return (
    <main className="detail-panel">
      <section className="detail-hero">
        <div className="detail-hero__copy">
          <p className="panel-shell__eyebrow">Selected workspace</p>
          <h2 className="detail-hero__title">{workspace.title || "Untitled workspace"}</h2>
          <p className="detail-hero__description">{workspace.description || "No description available."}</p>

          <div className="detail-hero__chips">
            <span className="status-chip status-chip--success">{workspace.status || "Unknown"}</span>
            <span className="status-chip status-chip--primary">{workspace.executionState || "Unknown"}</span>
            <span className="status-chip status-chip--neutral">{workspace.category || "Other"}</span>
          </div>
        </div>

        <div className="detail-hero__actions">
          <RunButton
            onClick={() => onRunWorkspace?.(workspace)}
            label={runLabel}
            hint={runHint}
            shortcut={workspace.trigger || "Cmd + Enter"}
            disabled={running || (workspace.status || "") !== "Ready"}
          />

          <div className="detail-info-card">
            <div className="detail-info-card__label">Quick trigger</div>
            <div className="detail-info-card__value">{triggerLabel}</div>
            <div className="detail-info-card__hint">
              {workspace.trigger
                ? "Keyboard shortcut available for immediate launch."
                : "This workspace launches from the UI only."}
            </div>
          </div>
        </div>
      </section>

      <section className="detail-metrics">
        <div className="metric-card">
          <span className="metric-card__label">Category</span>
          <span className="metric-card__value">{workspace.category || "Other"}</span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">Actions</span>
          <span className="metric-card__value">{safeActions.length}</span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">Estimated launch</span>
          <span className="metric-card__value">{workspace.estimatedTime || "N/A"}</span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">Primary path</span>
          <span className="metric-card__value metric-card__value--small">{workspace.primaryPath || "Not set"}</span>
        </div>
      </section>

      <section className="detail-grid">
        <div className="detail-card">
          <div className="detail-card__header">
            <div>
              <p className="panel-shell__eyebrow">Action sequence</p>
              <h3 className="detail-card__title">Ordered steps</h3>
            </div>
            <span className="detail-card__badge">{workspace.executionState}</span>
          </div>

          <ol className="action-list">
            {safeActions.map((action, index) => (
              <li key={`${workspace.id}-${action.type}-${index}`} className="action-item">
                <div className="action-item__index">{String(index + 1).padStart(2, "0")}</div>
                <div className="action-item__copy">
                  <div className="action-item__head">
                    <span className="action-item__glyph">{actionGlyphs[action.type] || "STEP"}</span>
                    <div className="action-item__titles">
                      <div className="action-item__title">{action.title || `Action ${index + 1}`}</div>
                      <div className="action-item__type">{action.type || "UNKNOWN"}</div>
                    </div>
                  </div>
                  <p className="action-item__description">{action.description || "No action description."}</p>
                  {action.target ? <div className="action-item__target">{action.target}</div> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="detail-rail">
          <div className="detail-card">
            <div className="detail-card__header">
              <div>
                <p className="panel-shell__eyebrow">Key details</p>
                <h3 className="detail-card__title">Workspace facts</h3>
              </div>
            </div>

            <div className="detail-kv-grid">
              {safeDetails.map((item) => (
                <div key={`${workspace.id}-${item.label}`} className="detail-kv">
                  <span className="detail-kv__label">{item.label}</span>
                  <span className="detail-kv__value">{item.value || "N/A"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="detail-card">
            <div className="detail-card__header">
              <div>
                <p className="panel-shell__eyebrow">Launch context</p>
                <h3 className="detail-card__title">Runtime</h3>
              </div>
            </div>

            <div className="launch-state">
              <div className="launch-state__row">
                <span className="launch-state__label">Status</span>
                <span className="launch-state__value">{workspace.status || "Unknown"}</span>
              </div>
              <div className="launch-state__row">
                <span className="launch-state__label">Execution</span>
                <span className="launch-state__value">{workspace.executionState || "Unknown"}</span>
              </div>
              <div className="launch-state__row">
                <span className="launch-state__label">Last run</span>
                <span className="launch-state__value">{toStatusLabel(runtime, workspace.id)}</span>
              </div>
              <div className="launch-state__row">
                <span className="launch-state__label">Trigger</span>
                <span className="launch-state__value">{workspace.trigger || "Manual only"}</span>
              </div>
              <div className="launch-state__row">
                <span className="launch-state__label">Focus</span>
                <span className="launch-state__value">{workspace.focus || "No focus note."}</span>
              </div>
              {lastRun?.workspaceId === workspace.id ? (
                <div className="launch-state__row">
                  <span className="launch-state__label">Last run actions</span>
                  <span className="launch-state__value">
                    {lastRun.actionResults?.length || 0} steps | {lastRun.status}
                    {isCurrentRun ? " | running" : ""}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default WorkspaceDetail;
