function WorkspaceGroups({
  groups = [],
  activeGroupId,
  onSelectGroup,
  title = "Groups",
  subtitle = "Saved workspace contexts",
}) {
  const safeGroups = Array.isArray(groups) ? groups : [];

  return (
    <aside className="panel-shell sidebar-panel">
      <div className="panel-shell__header">
        <div>
          <p className="panel-shell__eyebrow">{title}</p>
          <h2 className="panel-shell__title">Context groups</h2>
        </div>
        <p className="panel-shell__subline">{subtitle}</p>
      </div>

      <div className="panel-shell__body">
        <div className="group-stack">
          {safeGroups.map((group) => {
            const isActive = group.id === activeGroupId;

            return (
              <button
                key={group.id}
                type="button"
                className={`group-item ${isActive ? "is-active" : ""}`}
                onClick={() => onSelectGroup?.(group.id)}
                aria-pressed={isActive}
              >
                <span className="group-item__glyph" aria-hidden="true">
                  {group.symbol}
                </span>

                <span className="group-item__copy">
                  <span className="group-item__title">{group.title}</span>
                  <span className="group-item__subtitle">{group.subtitle}</span>
                </span>

                <span className="group-item__count" aria-label={`${group.count} workspaces`}>
                  {String(group.count ?? 0).padStart(2, "0")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export default WorkspaceGroups;
