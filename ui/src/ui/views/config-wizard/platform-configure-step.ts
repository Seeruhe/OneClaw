import { html, nothing } from "lit";
import type { ConfigWizardProps, PlatformFormField, PlatformConfigState } from "../../controllers/config-wizard.ts";
import { renderWizardNav } from "./index.ts";

export function renderPlatformConfigureStep(props: ConfigWizardProps) {
  const { state, onSelectPlatform } = props;
  const platformId = state.selectedPlatformId;

  if (!platformId) {
    return html`
      <div class="wizard-content">
        <div class="card">
          <div class="card-title">No Platform Selected</div>
          <div class="card-sub">Please go back and select a platform</div>
          ${renderWizardNav(props, { showNext: false })}
        </div>
      </div>
    `;
  }

  const config = state.platformConfigs[platformId];
  const platform = state.platforms.find((p) => p.id === platformId);

  if (!config || config.loading) {
    return html`
      <div class="wizard-content">
        <div class="card">
          <div class="card-title">Loading...</div>
          <div class="muted">Loading platform configuration</div>
        </div>
      </div>
    `;
  }

  return html`
    <div class="wizard-content">
      <div class="card">
        <div class="row" style="justify-content: space-between; align-items: center;">
          <div>
            <div class="card-title">${platform?.label ?? platformId} Configuration</div>
            <div class="card-sub">${platform?.description ?? ""}</div>
          </div>
          ${platform?.enabled
            ? html`<span class="badge badge-success">Currently Enabled</span>`
            : nothing}
        </div>

        <!-- Platform tabs for quick switching -->
        <div class="platform-tabs" style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
          ${state.platforms.map(
            (p) => html`
              <button
                class="btn btn-small ${p.id === platformId ? "btn-primary" : "btn-secondary"}"
                @click=${() => {
                  onSelectPlatform(p.id);
                  props.onLoadPlatformSchema(p.id);
                }}
              >
                ${p.label}
              </button>
            `,
          )}
        </div>

        ${renderConfigForm(props, config)}

        ${renderWizardNav(props, {
          nextLabel: "Review",
          nextDisabled: !isConfigValid(config),
          onNext: props.onNext,
        })}
      </div>
    </div>
  `;
}

function renderConfigForm(props: ConfigWizardProps, config: PlatformConfigState) {
  const schema = config.schema;
  if (!schema) {
    return html`<div class="muted">No configuration available</div>`;
  }

  return html`
    <div class="config-form" style="margin-top: 24px;">
      <!-- Enable toggle -->
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="field" style="display: flex; align-items: center; gap: 12px;">
          <input
            type="checkbox"
            ?checked=${config.values[`${schema.enabledKey}`] !== false}
            @change=${(e: Event) => {
              const checked = (e.target as HTMLInputElement).checked;
              props.onConfigValueChange(props.state.selectedPlatformId!, schema.enabledKey, checked);
            }}
          />
          <span>Enable ${schema.label}</span>
        </label>
      </div>

      <!-- Main fields -->
      <div class="form-fields">
        ${schema.fields.map((field) => renderFormField(props, config, field))}
      </div>

      <!-- Advanced fields (collapsible) -->
      ${schema.advancedFields && schema.advancedFields.length > 0
        ? html`
            <details class="advanced-section" style="margin-top: 16px;">
              <summary style="cursor: pointer; color: var(--color-primary);">Show Advanced Options</summary>
              <div class="form-fields" style="margin-top: 12px;">
                ${schema.advancedFields.map((field) => renderFormField(props, config, field))}
              </div>
            </details>
          `
        : nothing}

      <!-- Connection test -->
      <div class="test-connection" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--color-border);">
        <div class="row" style="align-items: center; gap: 12px;">
          <button
            class="btn btn-secondary"
            ?disabled=${config.testing}
            @click=${() => props.onTestConnection(props.state.selectedPlatformId!)}
          >
            ${config.testing ? "Testing..." : "Test Connection"}
          </button>
          ${renderTestResult(config.testResult)}
        </div>
      </div>
    </div>
  `;
}

function renderFormField(props: ConfigWizardProps, config: PlatformConfigState, field: PlatformFormField) {
  const value = config.values[field.key] ?? field.defaultValue ?? "";
  const platformId = props.state.selectedPlatformId!;

  const onChange = (e: Event) => {
    let newValue: unknown;
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

    if (target instanceof HTMLInputElement) {
      if (target.type === "checkbox") {
        newValue = target.checked;
      } else if (target.type === "number") {
        newValue = parseFloat(target.value) || 0;
      } else {
        newValue = target.value;
      }
    } else {
      newValue = target.value;
    }

    props.onConfigValueChange(platformId, field.key, newValue);
  };

  return html`
    <div class="form-group" style="margin-bottom: 16px;">
      <label class="field">
        <span class="field-label">
          ${field.label}
          ${field.required ? html`<span class="required" style="color: var(--color-danger);">*</span>` : nothing}
        </span>
        ${renderFieldInput(field, value, onChange)}
        ${field.helpText ? html`<span class="field-help muted" style="font-size: 12px; margin-top: 4px;">${field.helpText}</span>` : nothing}
      </label>
    </div>
  `;
}

function renderFieldInput(field: PlatformFormField, value: unknown, onChange: (e: Event) => void) {
  switch (field.type) {
    case "text":
      return html`
        <input
          type="text"
          .value=${String(value ?? "")}
          .placeholder=${field.placeholder ?? ""}
          @input=${onChange}
        />
      `;

    case "password":
      return html`
        <input
          type="password"
          .value=${String(value ?? "")}
          .placeholder=${field.placeholder ?? ""}
          @input=${onChange}
          autocomplete="off"
        />
      `;

    case "number":
      return html`
        <input
          type="number"
          .value=${String(value ?? "")}
          .placeholder=${field.placeholder ?? ""}
          @input=${onChange}
        />
      `;

    case "toggle":
      return html`
        <input
          type="checkbox"
          ?checked=${Boolean(value)}
          @change=${onChange}
        />
      `;

    case "select":
      return html`
        <select .value=${String(value ?? "")} @change=${onChange}>
          ${field.options?.map(
            (opt) => html`
              <option value=${opt.value} ?selected=${String(value) === opt.value}>
                ${opt.label}
              </option>
            `,
          )}
        </select>
      `;

    case "textarea":
      return html`
        <textarea
          .value=${String(value ?? "")}
          .placeholder=${field.placeholder ?? ""}
          @input=${onChange}
          rows="3"
        ></textarea>
      `;

    default:
      return html`
        <input
          type="text"
          .value=${String(value ?? "")}
          .placeholder=${field.placeholder ?? ""}
          @input=${onChange}
        />
      `;
  }
}

function renderTestResult(result: { success: boolean; message: string } | null) {
  if (!result) {
    return nothing;
  }

  return html`
    <div
      class="test-result ${result.success ? "success" : "error"}"
      style="
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 13px;
        background-color: ${result.success ? "var(--color-success-bg, #e8f5e9)" : "var(--color-error-bg, #ffebee)"};
        color: ${result.success ? "var(--color-success, #2e7d32)" : "var(--color-danger, #c62828)"};
      "
    >
      ${result.message}
    </div>
  `;
}

function isConfigValid(config: PlatformConfigState): boolean {
  if (!config.schema) {
    return false;
  }

  // Check required fields
  for (const field of config.schema.fields) {
    if (field.required) {
      const value = config.values[field.key];
      if (value === undefined || value === null || value === "") {
        return false;
      }
    }
  }

  return true;
}
