import { html, nothing } from "lit";
import { formatRelativeTimestamp } from "../format.ts";
import type { GatewayBrowserClient } from "../gateway.ts";

export type DiagnosticCheck = {
  id: string;
  name: string;
  category: "config" | "connection" | "security" | "runtime";
  status: "ok" | "warning" | "error" | "pending" | "skipped";
  message: string;
  details?: Record<string, unknown>;
  suggestion?: string;
  timestamp?: number;
};

export type DiagnosticsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;

  // Check results
  checks: DiagnosticCheck[];
  running: boolean;
  lastRun: number | null;

  // Summary
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
  };

  // Filter
  filter: "all" | "ok" | "warning" | "error";

  // Errors
  lastError: string | null;
};

export type DiagnosticsProps = {
  state: DiagnosticsState;

  // Callbacks
  onRunDiagnostics: () => void;
  onFilterChange: (filter: DiagnosticsState["filter"]) => void;
  onDismissError: () => void;
};

export function renderDiagnostics(props: DiagnosticsProps) {
  const { state } = props;

  const filteredChecks =
    state.filter === "all" ? state.checks : state.checks.filter((c) => c.status === state.filter);

  return html`
    <section class="diagnostics">
      <!-- Header -->
      <div class="card">
        <div class="card-title">Diagnostics</div>
        <div class="card-sub">System health check and troubleshooting</div>

        <!-- Summary -->
        <div class="diagnostics-summary" style="margin-top: 24px;">
          <div class="summary-stats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            ${renderSummaryStat("Total", state.summary.total, null)}
            ${renderSummaryStat("Passed", state.summary.passed, "success")}
            ${renderSummaryStat("Warnings", state.summary.warnings, "warning")}
            ${renderSummaryStat("Errors", state.summary.errors, "error")}
          </div>

          ${
            state.lastRun
              ? html`
                <div class="muted" style="margin-top: 12px; font-size: 12px;">
                  Last run: ${formatRelativeTimestamp(state.lastRun)}
                </div>
              `
              : nothing
          }
        </div>

        <!-- Controls -->
        <div class="diagnostics-controls row" style="margin-top: 24px; gap: 12px; align-items: center;">
          <button
            class="btn"
            ?disabled=${state.running || !state.connected}
            @click=${props.onRunDiagnostics}
          >
            ${state.running ? "Running..." : "Run Diagnostics"}
          </button>

          <!-- Filters -->
          <div class="filter-buttons" style="display: flex; gap: 8px;">
            ${(["all", "ok", "warning", "error"] as const).map(
              (filter) => html`
                <button
                  class="btn btn-small ${state.filter === filter ? "btn-primary" : "btn-secondary"}"
                  @click=${() => props.onFilterChange(filter)}
                >
                  ${filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              `,
            )}
          </div>
        </div>

        ${
          state.lastError
            ? html`
              <div class="callout danger" style="margin-top: 16px;">
                <div class="row" style="justify-content: space-between; align-items: center;">
                  <span>${state.lastError}</span>
                  <button class="btn btn-small" @click=${props.onDismissError}>Dismiss</button>
                </div>
              </div>
            `
            : nothing
        }
      </div>

      <!-- Results -->
      <div class="diagnostics-results" style="margin-top: 18px;">
        ${
          state.checks.length === 0 && !state.running
            ? html`
                <div class="card">
                  <div class="muted" style="text-align: center; padding: 32px">
                    Click "Run Diagnostics" to check system health
                  </div>
                </div>
              `
            : nothing
        }

        ${
          state.running && state.checks.length === 0
            ? html`
                <div class="card">
                  <div class="muted" style="text-align: center; padding: 32px">Running diagnostics...</div>
                </div>
              `
            : nothing
        }

        <!-- Group by category -->
        ${renderCheckCategory(props, "config", "Configuration", filteredChecks)}
        ${renderCheckCategory(props, "connection", "Connections", filteredChecks)}
        ${renderCheckCategory(props, "security", "Security", filteredChecks)}
        ${renderCheckCategory(props, "runtime", "Runtime", filteredChecks)}
      </div>
    </section>
  `;
}

function renderSummaryStat(
  label: string,
  value: number,
  status: "success" | "warning" | "error" | null,
) {
  return html`
    <div
      class="summary-stat"
      style="
        padding: 12px 16px;
        background-color: var(--color-bg-secondary);
        border-radius: 8px;
        text-align: center;
      "
    >
      <div
        class="stat-value"
        style="
          font-size: 24px;
          font-weight: 600;
          ${status === "success" ? "color: var(--color-success);" : ""}
          ${status === "warning" ? "color: var(--color-warning);" : ""}
          ${status === "error" ? "color: var(--color-danger);" : ""}
        "
      >
        ${value}
      </div>
      <div class="stat-label muted" style="font-size: 12px;">${label}</div>
    </div>
  `;
}

function renderCheckCategory(
  props: DiagnosticsProps,
  category: DiagnosticCheck["category"],
  title: string,
  checks: DiagnosticCheck[],
) {
  const categoryChecks = checks.filter((c) => c.category === category);
  if (categoryChecks.length === 0) {
    return nothing;
  }

  return html`
    <div class="card" style="margin-bottom: 16px;">
      <div class="card-title">${title}</div>
      <div class="check-list" style="margin-top: 16px;">
        ${categoryChecks.map((check) => renderCheckItem(check))}
      </div>
    </div>
  `;
}

function renderCheckItem(check: DiagnosticCheck) {
  const statusColors = {
    ok: "var(--color-success)",
    warning: "var(--color-warning)",
    error: "var(--color-danger)",
    pending: "var(--color-muted)",
    skipped: "var(--color-muted)",
  };

  const statusIcons = {
    ok: "\u2713",
    warning: "\u26A0",
    error: "\u2717",
    pending: "\u231B",
    skipped: "\u2014",
  };

  return html`
    <div
      class="check-item"
      style="
        padding: 16px;
        border-left: 4px solid ${statusColors[check.status]};
        background-color: var(--color-bg-secondary);
        margin-bottom: 8px;
        border-radius: 4px;
      "
    >
      <div class="row" style="justify-content: space-between; align-items: start;">
        <div>
          <div class="check-name" style="font-weight: 600;">
            <span class="status-icon" style="margin-right: 8px;">
              ${
                check.status === "pending"
                  ? html`
                      <span class="spinner"></span>
                    `
                  : nothing
              }
            </span>
            ${check.name}
          </div>
          <div class="check-message" style="margin-top: 4px; font-size: 13px;">
            ${check.message}
          </div>
          ${
            check.suggestion
              ? html`
                <div
                  class="check-suggestion"
                  style="
                    margin-top: 8px;
                    padding: 8px 12px;
                    background-color: var(--color-bg);
                    border-radius: 4px;
                    font-size: 12px;
                  "
                >
                  <strong>Suggestion:</strong> ${check.suggestion}
                </div>
              `
              : nothing
          }
        </div>
        <div
          class="check-status"
          style="
            font-size: 20px;
            color: ${statusColors[check.status]};
          "
        >
          ${check.status !== "pending" ? html`<span>${statusIcons[check.status]}</span>` : nothing}
        </div>
      </div>

      ${
        check.details && Object.keys(check.details).length > 0
          ? html`
            <details style="margin-top: 8px;">
              <summary style="cursor: pointer; font-size: 12px; color: var(--color-primary);">
                Show details
              </summary>
              <pre
                class="code-block"
                style="
                  margin-top: 8px;
                  font-size: 11px;
                  max-height: 200px;
                  overflow: auto;
                "
              >${JSON.stringify(check.details, null, 2)}</pre>
            </details>
          `
          : nothing
      }
    </div>
  `;
}

// Controller functions
export async function runDiagnostics(
  client: GatewayBrowserClient | null,
): Promise<DiagnosticCheck[]> {
  if (!client) {
    return [];
  }

  const checks: DiagnosticCheck[] = [];

  // 1. Configuration validation
  try {
    const configStatus = await client.request<{
      valid?: boolean;
      issues?: Array<{ message?: string; path?: string }>;
    }>("configWizard.getServiceStatus", {});

    checks.push({
      id: "config-valid",
      name: "Configuration Validity",
      category: "config",
      status: configStatus.valid ? "ok" : "error",
      message: configStatus.valid
        ? "Configuration is valid"
        : `Configuration has ${configStatus.issues?.length ?? 0} issues`,
      details: { issues: configStatus.issues },
      suggestion: configStatus.valid ? undefined : "Fix configuration errors and reload",
    });
  } catch (err) {
    checks.push({
      id: "config-valid",
      name: "Configuration Validity",
      category: "config",
      status: "error",
      message: `Failed to check configuration: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }

  // 2. Channel status
  try {
    const channelsStatus = await client.request<{
      channels?: Record<
        string,
        { configured?: boolean; running?: boolean; connected?: boolean; lastError?: string }
      >;
    }>("channels.status", {});

    const channels = channelsStatus.channels ?? {};
    for (const [channelId, status] of Object.entries(channels)) {
      if (status.configured) {
        checks.push({
          id: `channel-${channelId}`,
          name: `${channelId.charAt(0).toUpperCase() + channelId.slice(1)} Channel`,
          category: "connection",
          status: status.connected ? "ok" : status.running ? "warning" : "error",
          message: status.connected
            ? "Connected and running"
            : status.running
              ? "Running but not connected"
              : (status.lastError ?? "Not connected"),
          suggestion: status.lastError ? "Check channel configuration and credentials" : undefined,
        });
      }
    }
  } catch (err) {
    checks.push({
      id: "channels-status",
      name: "Channel Status",
      category: "connection",
      status: "error",
      message: `Failed to check channels: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }

  // 3. Secrets/credentials
  try {
    await client.request("secrets.reload", {});
    checks.push({
      id: "secrets",
      name: "Secrets Store",
      category: "security",
      status: "ok",
      message: "Secrets store is accessible",
    });
  } catch {
    checks.push({
      id: "secrets",
      name: "Secrets Store",
      category: "security",
      status: "warning",
      message: "Could not reload secrets store (may be expected)",
    });
  }

  // 4. Health check
  try {
    const health = await client.request<{
      uptimeMs?: number;
      memory?: { heapUsed?: number; heapTotal?: number };
    }>("health", {});

    const memoryUsage =
      health.memory?.heapUsed && health.memory?.heapTotal
        ? Math.round((health.memory.heapUsed / health.memory.heapTotal) * 100)
        : null;

    checks.push({
      id: "health",
      name: "Gateway Health",
      category: "runtime",
      status: "ok",
      message: `Gateway is healthy (uptime: ${Math.round((health.uptimeMs ?? 0) / 1000)}s)`,
      details: {
        uptimeMs: health.uptimeMs,
        memoryUsage: memoryUsage ? `${memoryUsage}%` : "N/A",
      },
    });
  } catch (err) {
    checks.push({
      id: "health",
      name: "Gateway Health",
      category: "runtime",
      status: "error",
      message: `Health check failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }

  return checks;
}

export function computeSummary(checks: DiagnosticCheck[]): DiagnosticsState["summary"] {
  return {
    total: checks.length,
    passed: checks.filter((c) => c.status === "ok").length,
    warnings: checks.filter((c) => c.status === "warning").length,
    errors: checks.filter((c) => c.status === "error").length,
  };
}
