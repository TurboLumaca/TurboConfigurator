import { createRunId, nowIso } from "../domain/workspaceTypes.js";
import { getActionReadiness, getWorkspaceReadiness } from "../domain/workspaceSchema.js";
import { executeAction } from "./actionHandlers.js";

function getLogger(logger) {
  if (typeof logger === "function") {
    return logger;
  }

  return null;
}

export async function runWorkspace(workspace, options = {}) {
  const logger = getLogger(options.logger);
  const workspaceReadiness = getWorkspaceReadiness(workspace);
  const startedAt = nowIso();
  const runId = options.runId || createRunId();
  const actionResults = [];
  const continueOnError = Boolean(options.continueOnError);
  const dryRun = Boolean(options.dryRun);

  if (!workspaceReadiness.executable) {
    const failedRun = {
      runId,
      workspaceId: workspace?.id || null,
      workspaceName: workspace?.name || "",
      status: "failed",
      executable: false,
      reason: workspaceReadiness.reason,
      startedAt,
      finishedAt: nowIso(),
      durationMs: 0,
      actionResults: [],
    };

    if (logger) {
      logger({
        type: "workspace:failed_readiness",
        workspace,
        result: failedRun,
      });
    }

    return failedRun;
  }

  for (const [index, action] of workspaceReadiness.workspace.actions.entries()) {
    const actionReadiness = getActionReadiness(action);

    if (!actionReadiness.executable) {
      const skipped = {
        actionId: action.id,
        actionType: action.type,
        status: "failed",
        skipped: true,
        startedAt: nowIso(),
        finishedAt: nowIso(),
        durationMs: 0,
        message: actionReadiness.reason,
        output: null,
        error: {
          name: "ValidationError",
          message: actionReadiness.reason,
          stack: null,
        },
        index,
      };

      actionResults.push(skipped);

      if (logger) {
        logger({
          type: "action:invalid",
          workspace,
          action,
          result: skipped,
        });
      }

      if (!continueOnError) {
        break;
      }

      continue;
    }

    if (dryRun) {
      const dryResult = {
        actionId: action.id,
        actionType: action.type,
        status: "skipped",
        skipped: true,
        startedAt: nowIso(),
        finishedAt: nowIso(),
        durationMs: 0,
        message: "Dry run enabled",
        output: null,
        error: null,
        index,
      };

      actionResults.push(dryResult);
      continue;
    }

    const result = await executeAction(action);
    result.index = index;
    result.readiness = actionReadiness;
    actionResults.push(result);

    if (logger) {
      logger({
        type: "action:finished",
        workspace,
        action,
        result,
      });
    }

    if (result.status === "failed" && !continueOnError) {
      break;
    }
  }

  const finishedAt = nowIso();
  const status = actionResults.some((item) => item.status === "failed") ? "partial" : "success";

  return {
    runId,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    status,
    executable: true,
    reason: workspaceReadiness.reason,
    startedAt,
    finishedAt,
    durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
    actionResults,
  };
}

