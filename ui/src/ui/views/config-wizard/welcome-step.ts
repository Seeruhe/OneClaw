import { html } from "lit";
import type { ConfigWizardProps } from "./index.ts";
import { renderWizardNav } from "./index.ts";

export function renderWelcomeStep(props: ConfigWizardProps) {
  const { state } = props;

  return html`
    <div class="wizard-content">
      <div class="card">
        <div class="card-title">Welcome to OpenClaw</div>
        <div class="card-sub">Let's configure your messaging platforms</div>

        <div class="welcome-content" style="margin-top: 24px;">
          <p>
            OpenClaw connects AI assistants to your favorite messaging platforms. This wizard will
            help you:
          </p>

          <ul style="margin-top: 16px; margin-left: 24px;">
            <li>Select which messaging platforms to enable</li>
            <li>Configure bot tokens and API keys</li>
            <li>Set up security policies (DM access, allowlists)</li>
            <li>Test connections before saving</li>
          </ul>

          <div class="callout" style="margin-top: 24px;">
            <strong>Quick Setup:</strong> You'll need the bot token or API credentials for each
            platform you want to configure. Most can be obtained from the platform's developer
            portal.
          </div>

          ${state.platforms.length > 0
            ? html`
                <div style="margin-top: 24px;">
                  <div class="muted">Already configured platforms:</div>
                  <div class="row" style="margin-top: 8px; gap: 8px; flex-wrap: wrap;">
                    ${state.platforms
                      .filter((p) => p.configured)
                      .map(
                        (p) => html`
                          <span class="badge ${p.enabled ? "badge-success" : "badge-muted"}">
                            ${p.label}
                          </span>
                        `,
                      )}
                  </div>
                </div>
              `
            : nothing}
        </div>

        ${renderWizardNav(props, { showBack: false, nextLabel: "Get Started" })}
      </div>
    </div>
  `;
}
