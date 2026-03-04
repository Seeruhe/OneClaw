import { html, nothing } from "lit";
import { formatRelativeTimestamp, formatDurationHuman } from "../format.ts";
import type { GatewayBrowserClient } from "../gateway.ts";

export type ServiceControlState = {
  client: GatewayBrowserClient | null;
  connected: boolean;

  // Gateway status
  gatewayRunning: boolean;
  gatewayPort: number | null;
  gatewayUptimeMs: number | null;
  gatewayVersion: string | null;

  // Config status
  configValid: boolean;
  configPath: string | null;
  configLastModified: number | null;
  configIssues: unknown[];

  // Operations
  restarting: boolean;
  reloading: boolean;

  // Errors
  lastError: string | null;
};

export type ServiceControlProps = {
  state: ServiceControlState;

  // Callbacks
  onRestart: () => void;
  onReloadConfig: () => void;
  onRefresh: () => void;
};

export function renderServiceControl(props: ServiceControlProps) {
  const { state } = props;

  return html`
    <section class="service-control">
      <!-- Gateway Status Card -->
      <div class="card">
        <div class="card-title">Gateway Status</div>
        <div class="card-sub">OpenClaw gateway service status and controls</div>

        <div class="status-grid" style="margin-top: 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
          ${renderStatusItem(
            "Status",
            state.connected && state.gatewayRunning ? "Running" : "Stopped",
            state.connected && state.gatewayRunning ? "success" : "warning",
          )}
          ${renderStatusItem(
            "Port",
            state.gatewayPort?.toString() ?? "N/A",
            null,
          )}
          ${renderStatusItem(
            "Uptime",
            state.gatewayUptimeMs ? formatDurationHuman(state.gatewayUptimeMs) : "N/A",
            null,
          )}
          ${renderStatusItem(
            "Version",
            state.gatewayVersion ?? "N/A",
            null,
          )}
        </div>

        <!-- Control buttons -->
        <div class="control-buttons row" style="margin-top: 24px; gap: 12px;">
          <button
            class="btn"
            ?disabled=${state.restarting || !state.connected}
            @click=${props.onRestart}
          >
            ${state.restarting ? "Restarting..." : "Restart Gateway"}
          </button>
          <button
            class="btn btn-secondary"
            ?disabled=${!state.connected}
            @click=${props.onRefresh}
          >
            Refresh Status
          </button>
        </div>

        ${state.lastError
          ? html`
              <div class="callout danger" style="margin-top: 16px;">
                ${state.lastError}
              </div>
            `
          : nothing}
      </div>

      <!-- Configuration Status Card -->
      <div class="card" style="margin-top: 18px;">
        <div class="card-title">Configuration</div>
        <div class="card-sub">Configuration file status and validation</div>

        <div class="config-status" style="margin-top: 24px;">
          <div class="row" style="justify-content: space-between; align-items: center;">
            <div>
              <div class="config-path" style="font-family: monospace; font-size: 13px;">
                ${state.configPath ?? "Not loaded"}
              </div>
              ${state.configLastModified
                ? html`
                    <div class="muted" style="font-size: 12px; margin-top: 4px;">
                      Last modified: ${formatRelativeTimestamp(state.configLastModified)}
                    </div>
                  `
                : nothing}
            </div>
            <div>
              ${state.configValid
                ? html`<span class="badge badge-success">Valid</span>`
                : html`<span class="badge badge-danger">Invalid</span>`}
            </div>
          </div>

          ${state.configIssues.length > 0
            ? html`
                <div class="config-issues" style="margin-top: 16px;">
                  <div style="font-weight: 600; margin-bottom: 8px;">Issues:</div>
                  <div class="issues-list" style="font-size: 13px;">
                    ${state.configIssues.map(
                      (issue) => html`
                        <div
                          class="issue-item"
                          style="
                            padding: 8px 12px;
                            background-color: var(--color-error-bg, #ffebee);
                            border-radius: 4px;
                            margin-bottom: 8px;
                          "
                        >
                          ${renderConfigIssue(issue)}
                        </div>
                      `,
                    )}
                  </div>
                </div>
              `
            : nothing}
        </div>

        <!-- Reload config button -->
        <div class="row" style="margin-top: 24px;">
          <button
            class="btn btn-secondary"
            ?disabled=${state.reloading || !state.connected}
            @click=${props.onReloadConfig}
          >
            ${state.reloading ? "Reloading..." : "Reload Configuration"}
          </button>
          <span class="muted" style="margin-left: 12px; font-size: 13px;">
            Apply configuration changes without full restart
          </span>
        </div>
      </div>

      <!-- Quick Actions Card -->
      <div class="card" style="margin-top: 18px;">
        <div class="card-title">Quick Actions</div>
        <div class="card-sub">Common operations and diagnostics</div>

        <div class="quick-actions" style="margin-top: 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <button
            class="btn btn-secondary"
            @click=${() => {
              window.location.href = "/?view=config";
            }}
          >
            Edit Configuration
          </button>
          <button
            class="btn btn-secondary"
            @click=${() => {
              window.location.href = "/?view=logs";
            }}
          >
            View Logs
          </button>
          <button
            class="btn btn-secondary"
            @click=${() => {
              window.location.href = "/?view=diagnostics";
            }}
          >
            Run Diagnostics
          </button>
          <button
            class="btn btn-secondary"
            @click=${() => {
              window.open("https://docs.openclaw.ai", "_blank");
            }}
          >
            Open Documentation
          </button>
        </div>
      </div>
    </section>
  `;
}

function renderStatusItem(label: string, value: string, status: "success" | "warning" | "error" | null) {
  return html`
    <div class="status-item" style="padding: 12px; background-color: var(--color-bg-secondary); border-radius: 8px;">
      <div class="status-label muted" style="font-size: 12px;">${label}</div>
      <div
        class="status-value"
        style="
          font-size: 18px;
          font-weight: 600;
          margin-top: 4px;
          ${status === "success" ? "color: var(--color-success);" : ""}
          ${status === "warning" ? "color: var(--color-warning);" : ""}
          ${status === "error" ? "color: var(--color-danger);" : ""}
        "
      >
        ${value}
      </div>
    </div>
  `;
}

function renderConfigIssue(issue: unknown): unknown {
  if (typeof issue === "string") {
    return issue;
  }

  if (typeof issue === "object" && issue !== null) {
    const obj = issue as { message?: string; path?: string; code?: string };
    return html`
      <div>
        ${obj.path ? html`<code class="mono">${obj.path}</code>: ` : nothing}
        ${obj.message ?? JSON.stringify(issue)}
      </div>
    `;
  }

  return JSON.stringify(issue);
}

// Controller functions
export async function loadServiceStatus(
  client: GatewayBrowserClient | null,
): Promise<Partial<ServiceControlState>> {
  if (!client) {
    return {};
  }

  try {
    // Get health status
    const health = await client.request<{
      uptimeMs?: number;
      version?: string;
      port?: number;
    }>("health", {});

    // Get config status
    const configStatus = await client.request<{
      valid?: boolean;
      path?: string;
      mtime?: number;
      issues?: unknown[];
    }>("configWizard.getServiceStatus", {});

    return {
      gatewayRunning: true,
      gatewayUptimeMs: health.uptimeMs ?? null,
      gatewayVersion: health.version ?? null,
      gatewayPort: health.port ?? null,
      configValid: configStatus.valid ?? true,
      configPath: configStatus.path ?? null,
      configLastModified: configStatus.mtime ?? null,
      configIssues: configStatus.issues ?? [],
    };
  } catch (err) {
    return {
      lastError: err instanceof Error ? err.message : "Failed to load service status",
    };
  }
}

export async function restartGateway(
  client: GatewayBrowserClient | null,
): Promise<{ success: boolean; error?: string }> {
  if (!client) {
    return { success: false, error: "Not connected" };
  }

  try {
    // Use config.apply with special flag to trigger restart
    await client.request("config.apply", {
      raw: "{}", // Empty patch just to trigger restart
      restartNow: true,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to restart gateway",
    };
  }
}

export async function reloadConfig(
  client: GatewayBrowserClient | null,
): Promise<{ success: boolean; error?: string }> {
  if (!client) {
    return { success: false, error: "Not connected" };
  }

  try {
    await client.request("secrets.reload", {});
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reload configuration",
    };
  }
}
