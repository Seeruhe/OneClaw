import { html } from "lit";
import type { ConfigWizardProps } from "./index.ts";

export function renderCompleteStep(props: ConfigWizardProps) {
  const { state, onGoToStep } = props;
  const platformId = state.selectedPlatformId;
  const platform = platformId ? state.platforms.find((p) => p.id === platformId) : null;
  const config = platformId ? state.platformConfigs[platformId] : null;
  const testResult = config?.testResult;

  return html`
    <div class="wizard-content">
      <div class="card">
        <div class="card-title" style="color: var(--color-success);">
          Configuration Complete
        </div>
        <div class="card-sub">Your ${platform?.label ?? "platform"} has been configured</div>

        <div class="complete-content" style="margin-top: 24px; text-align: center;">
          <!-- Success icon -->
          <div
            class="success-icon"
            style="
              width: 64px;
              height: 64px;
              border-radius: 50%;
              background-color: var(--color-success-bg, #e8f5e9);
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
              font-size: 32px;
            "
          >
            &#10003;
          </div>

          ${
            testResult?.success
              ? html`
                <p class="success-message">
                  Your ${platform?.label ?? "platform"} is configured and the connection test passed.
                </p>
              `
              : html`
                <p>
                  Your ${platform?.label ?? "platform"} configuration has been saved.
                  ${
                    !testResult ? "Consider running a connection test to verify your settings." : ""
                  }
                </p>
              `
          }

          <div class="callout" style="margin-top: 24px; text-align: left;">
            <strong>Next steps:</strong>
            <ul style="margin-top: 8px; margin-left: 20px;">
              <li>The gateway will restart automatically to apply changes</li>
              <li>Check the Channels page to verify the platform is connected</li>
              <li>Send a test message to your bot to confirm everything works</li>
            </ul>
          </div>

          <!-- Quick actions -->
          <div class="quick-actions" style="margin-top: 32px; display: flex; gap: 12px; justify-content: center;">
            <button
              class="btn"
              @click=${() => {
                onGoToStep("platform-select");
              }}
            >
              Configure Another Platform
            </button>
            <button
              class="btn btn-secondary"
              @click=${() => {
                // Navigate to channels view
                window.location.href = "/?view=channels";
              }}
            >
              View Channels
            </button>
          </div>

          <!-- Summary -->
          <div
            class="config-summary"
            style="
              margin-top: 32px;
              padding: 16px;
              background-color: var(--color-bg-secondary);
              border-radius: 8px;
              text-align: left;
            "
          >
            <div style="font-weight: 600; margin-bottom: 12px;">Configuration Summary</div>
            <div class="summary-list" style="font-size: 13px;">
              ${state.platforms
                .filter((p) => p.enabled || p.configured)
                .map(
                  (p) => html`
                    <div
                      class="summary-item"
                      style="display: flex; justify-content: space-between; padding: 6px 0;"
                    >
                      <span>${p.label}</span>
                      <span>
                        ${
                          p.enabled
                            ? html`
                                <span class="badge badge-success" style="font-size: 11px">Enabled</span>
                              `
                            : p.configured
                              ? html`
                                  <span class="badge badge-muted" style="font-size: 11px">Configured</span>
                                `
                              : html`
                                  <span class="muted">Not configured</span>
                                `
                        }
                      </span>
                    </div>
                  `,
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
