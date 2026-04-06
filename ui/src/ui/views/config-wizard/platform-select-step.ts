import { html, nothing } from "lit";
import type { ConfigWizardProps } from "./index.ts";
import { renderWizardNav } from "./index.ts";

export function renderPlatformSelectStep(props: ConfigWizardProps) {
  const { state } = props;

  return html`
    <div class="wizard-content">
      <div class="card">
        <div class="card-title">Select Platform</div>
        <div class="card-sub">Choose a messaging platform to configure</div>

        ${
          state.platformsLoading
            ? html`
                <div class="muted" style="margin-top: 24px">Loading platforms...</div>
              `
            : renderPlatformGrid(props)
        }

        ${renderWizardNav(props, {
          showNext: !!state.selectedPlatformId,
          nextLabel: "Configure",
          nextDisabled: !state.selectedPlatformId,
          onNext: () => {
            if (state.selectedPlatformId) {
              props.onLoadPlatformSchema(state.selectedPlatformId);
              props.onNext();
            }
          },
        })}
      </div>
    </div>
  `;
}

function renderPlatformGrid(props: ConfigWizardProps) {
  const { state, onSelectPlatform } = props;

  // Sort platforms: enabled/configured first
  const sortedPlatforms = [...state.platforms].toSorted((a, b) => {
    if (a.enabled !== b.enabled) {
      return a.enabled ? -1 : 1;
    }
    if (a.configured !== b.configured) {
      return a.configured ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });

  return html`
    <div class="platform-grid" style="margin-top: 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;">
      ${sortedPlatforms.map((platform) =>
        renderPlatformCard(platform, state.selectedPlatformId, onSelectPlatform),
      )}
    </div>
  `;
}

function renderPlatformCard(
  platform: {
    id: string;
    label: string;
    description: string;
    configured: boolean;
    enabled: boolean;
  },
  selectedId: string | null,
  onSelect: (id: string) => void,
) {
  const isSelected = selectedId === platform.id;

  return html`
    <div
      class="platform-card ${isSelected ? "selected" : ""} ${platform.enabled ? "enabled" : ""}"
      style="
        padding: 16px;
        border: 2px solid ${isSelected ? "var(--color-primary)" : "var(--color-border)"};
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        ${platform.enabled ? "background-color: var(--color-success-bg, #e8f5e9);" : ""}
      "
      @click=${() => onSelect(platform.id)}
    >
      <div class="row" style="justify-content: space-between; align-items: start;">
        <div class="platform-label" style="font-weight: 600;">${platform.label}</div>
        ${
          platform.enabled
            ? html`
                <span class="badge badge-success" style="font-size: 11px">Active</span>
              `
            : platform.configured
              ? html`
                  <span class="badge badge-muted" style="font-size: 11px">Configured</span>
                `
              : nothing
        }
      </div>
      <div class="platform-description muted" style="margin-top: 8px; font-size: 13px;">
        ${platform.description}
      </div>
    </div>
  `;
}
