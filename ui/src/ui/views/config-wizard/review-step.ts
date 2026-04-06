import { html, nothing } from "lit";
import type { ConfigWizardProps } from "./index.ts";
import { renderWizardNav } from "./index.ts";

export function renderReviewStep(props: ConfigWizardProps) {
  const { state, onSaveConfig } = props;
  const platformId = state.selectedPlatformId;

  if (!platformId) {
    return html`
      <div class="wizard-content">
        <div class="card">
          <div class="card-title">No Configuration to Review</div>
          ${renderWizardNav(props, { showNext: false })}
        </div>
      </div>
    `;
  }

  const config = state.platformConfigs[platformId];
  const platform = state.platforms.find((p) => p.id === platformId);

  if (!config?.schema) {
    return html`
      <div class="wizard-content">
        <div class="card">
          <div class="card-title">Configuration Not Loaded</div>
          ${renderWizardNav(props, { showNext: false })}
        </div>
      </div>
    `;
  }

  return html`
    <div class="wizard-content">
      <div class="card">
        <div class="card-title">Review Configuration</div>
        <div class="card-sub">Confirm your ${platform?.label ?? platformId} settings</div>

        <div class="review-content" style="margin-top: 24px;">
          <!-- Platform summary -->
          <div class="review-section" style="margin-bottom: 24px;">
            <div class="review-section-title" style="font-weight: 600; margin-bottom: 12px;">
              Platform
            </div>
            <div class="review-item">
              <span class="label">Name:</span>
              <span>${platform?.label ?? platformId}</span>
            </div>
            <div class="review-item">
              <span class="label">Status:</span>
              <span>
                ${
                  config.values[config.schema.enabledKey] !== false
                    ? html`
                        <span class="badge badge-success">Will be enabled</span>
                      `
                    : html`
                        <span class="badge badge-muted">Will be disabled</span>
                      `
                }
              </span>
            </div>
          </div>

          <!-- Configuration values -->
          <div class="review-section">
            <div class="review-section-title" style="font-weight: 600; margin-bottom: 12px;">
              Configuration
            </div>
            ${renderConfigValues(config.schema.fields, config.values)}
            ${
              config.schema.advancedFields
                ? renderConfigValues(config.schema.advancedFields, config.values, true)
                : nothing
            }
          </div>

          <!-- Connection test result -->
          ${
            config.testResult
              ? html`
                <div class="review-section" style="margin-top: 24px;">
                  <div class="review-section-title" style="font-weight: 600; margin-bottom: 12px;">
                    Connection Test
                  </div>
                  <div
                    class="test-result ${config.testResult.success ? "success" : "error"}"
                    style="
                      padding: 12px;
                      border-radius: 4px;
                      background-color: ${
                        config.testResult.success
                          ? "var(--color-success-bg, #e8f5e9)"
                          : "var(--color-error-bg, #ffebee)"
                      };
                    "
                  >
                    ${config.testResult.message}
                  </div>
                </div>
              `
              : html`
                  <div class="callout warning" style="margin-top: 24px">
                    Connection test not run. Consider testing before saving.
                  </div>
                `
          }
        </div>

        <!-- Save/Apply -->
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--color-border);">
          <div class="row" style="align-items: center; gap: 12px;">
            <button
              class="btn"
              ?disabled=${state.saving}
              @click=${() => {
                onSaveConfig(platformId);
                props.onNext();
              }}
            >
              ${state.saving ? "Saving..." : "Save Configuration"}
            </button>
            ${
              state.saveError
                ? html`
                  <span class="error" style="color: var(--color-danger);">${state.saveError}</span>
                `
                : nothing
            }
          </div>
          <div class="muted" style="margin-top: 8px; font-size: 12px;">
            Saving will update your configuration file and restart the gateway.
          </div>
        </div>

        ${renderWizardNav(props, { showNext: false })}
      </div>
    </div>
  `;
}

function renderConfigValues(
  fields: { key: string; label: string; type?: string; advanced?: boolean }[],
  values: Record<string, unknown>,
  isAdvanced = false,
) {
  const visibleFields = fields.filter((f) => {
    const value = values[f.key];
    // Show field if it has a value or if it's not advanced
    return value !== undefined && value !== null && value !== "";
  });

  if (visibleFields.length === 0) {
    return nothing;
  }

  return html`
    <div class="config-values ${isAdvanced ? "advanced" : ""}" style="margin-top: ${isAdvanced ? "12px" : "0"};">
      ${
        isAdvanced
          ? html`
              <div class="muted" style="margin-bottom: 8px">Advanced Options:</div>
            `
          : nothing
      }
      ${visibleFields.map(
        (field) => html`
          <div class="review-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--color-border-light);">
            <span class="label">${field.label}</span>
            <span class="value">${renderValue(values[field.key], field.type)}</span>
          </div>
        `,
      )}
    </div>
  `;
}

function safeString(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function renderValue(value: unknown, type?: string): unknown {
  if (value === undefined || value === null) {
    return html`
      <span class="muted">Not set</span>
    `;
  }

  if (type === "password") {
    const str = safeString(value);
    const masked = str.length > 8 ? str.slice(0, 4) + "****" + str.slice(-4) : "****";
    return html`<code class="mono">${masked}</code>`;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return html`<code class="mono">${JSON.stringify(value)}</code>`;
  }

  return html`<code class="mono">${safeString(value)}</code>`;
}
