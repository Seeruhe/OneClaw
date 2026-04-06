import { html, nothing } from "lit";
import type { ConfigWizardState } from "../../controllers/config-wizard.ts";
import { renderCompleteStep } from "./complete-step.ts";
import { renderPlatformConfigureStep } from "./platform-configure-step.ts";
import { renderPlatformSelectStep } from "./platform-select-step.ts";
import { renderReviewStep } from "./review-step.ts";
import { renderWelcomeStep } from "./welcome-step.ts";

export type ConfigWizardProps = {
  state: ConfigWizardState;

  // Navigation callbacks
  onNext: () => void;
  onBack: () => void;
  onSelectPlatform: (platformId: string) => void;
  onGoToStep: (step: ConfigWizardState["currentStep"]) => void;

  // Platform configuration callbacks
  onLoadPlatforms: () => void;
  onLoadPlatformSchema: (platformId: string) => void;
  onConfigValueChange: (platformId: string, key: string, value: unknown) => void;
  onTestConnection: (platformId: string) => void;
  onSaveConfig: (platformId: string) => void;

  // Service callbacks
  onLoadServiceStatus: () => void;

  // Misc
  onDismissError: () => void;
};

export function renderConfigWizard(props: ConfigWizardProps) {
  const { state } = props;

  return html`
    <div class="config-wizard">
      ${renderWizardHeader(props)} ${renderWizardSteps(props)}
      ${state.lastError ? renderErrorBanner(state.lastError, props.onDismissError) : nothing}
      ${renderStepContent(props)}
    </div>
  `;
}

function renderWizardHeader(_props: ConfigWizardProps) {
  return html`
    <div class="wizard-header">
      <div class="wizard-title">OpenClaw Configuration Wizard</div>
      <div class="wizard-subtitle">Configure messaging platforms and services</div>
    </div>
  `;
}

function renderWizardSteps(props: ConfigWizardProps) {
  const { state } = props;
  const steps = [
    { id: "welcome", label: "Welcome" },
    { id: "platform-select", label: "Select Platform" },
    { id: "platform-configure", label: "Configure" },
    { id: "review", label: "Review" },
    { id: "complete", label: "Complete" },
  ] as const;

  const currentIndex = steps.findIndex((s) => s.id === state.currentStep);

  return html`
    <div class="wizard-steps">
      ${steps.map(
        (step, index) => html`
          <div
            class="wizard-step ${
              index === currentIndex ? "active" : index < currentIndex ? "completed" : ""
            }"
          >
            <div class="wizard-step-number">${index + 1}</div>
            <div class="wizard-step-label">${step.label}</div>
          </div>
          ${
            index < steps.length - 1
              ? html`<div class="wizard-step-connector ${index < currentIndex ? "completed" : ""}"></div>`
              : nothing
          }
        `,
      )}
    </div>
  `;
}

function renderStepContent(props: ConfigWizardProps) {
  const { state } = props;

  switch (state.currentStep) {
    case "welcome":
      return renderWelcomeStep(props);
    case "platform-select":
      return renderPlatformSelectStep(props);
    case "platform-configure":
      return renderPlatformConfigureStep(props);
    case "review":
      return renderReviewStep(props);
    case "complete":
      return renderCompleteStep(props);
    default:
      return html`
        <div>Unknown step</div>
      `;
  }
}

function renderErrorBanner(message: string, onDismiss: () => void) {
  return html`
    <div class="callout danger" style="margin-top: 16px;">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <span>${message}</span>
        <button class="btn btn-small" @click=${onDismiss}>Dismiss</button>
      </div>
    </div>
  `;
}

// Shared wizard navigation buttons
export function renderWizardNav(
  props: ConfigWizardProps,
  options: {
    showBack?: boolean;
    showNext?: boolean;
    nextLabel?: string;
    nextDisabled?: boolean;
    onNext?: () => void;
  },
) {
  const {
    showBack = true,
    showNext = true,
    nextLabel = "Next",
    nextDisabled = false,
    onNext,
  } = options;

  return html`
    <div class="wizard-nav" style="margin-top: 24px;">
      <div class="row" style="justify-content: space-between;">
        <div>
          ${
            showBack
              ? html`<button class="btn btn-secondary" @click=${props.onBack}>Back</button>`
              : nothing
          }
        </div>
        <div>
          ${
            showNext
              ? html`
                <button
                  class="btn"
                  ?disabled=${nextDisabled || props.state.saving}
                  @click=${onNext ?? props.onNext}
                >
                  ${props.state.saving ? "Saving..." : nextLabel}
                </button>
              `
              : nothing
          }
        </div>
      </div>
    </div>
  `;
}
