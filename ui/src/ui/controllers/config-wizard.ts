import type { GatewayBrowserClient } from "../gateway.ts";

// Wizard step types
export type WizardStep =
  | "welcome"
  | "platform-select"
  | "platform-configure"
  | "review"
  | "complete";

// Platform info from backend
// Keep in sync with src/gateway/server-methods/config-wizard.ts
export type PlatformInfo = {
  id: string;
  label: string;
  description: string;
  icon?: string;
  configured: boolean;
  enabled: boolean;
  connected?: boolean;
  hasError?: boolean;
  lastError?: string;
};

// Form field types
export type FormFieldType = "text" | "password" | "select" | "toggle" | "textarea" | "number";

export type PlatformFormField = {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
  advanced?: boolean;
};

export type PlatformSchema = {
  id: string;
  label: string;
  description: string;
  icon?: string;
  enabledKey: string;
  fields: PlatformFormField[];
  advancedFields?: PlatformFormField[];
};

export type TestResult = {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
};

export type PlatformConfigState = {
  schema: PlatformSchema | null;
  values: Record<string, unknown>;
  testResult: TestResult | null;
  testing: boolean;
  loading: boolean;
};

export type ServiceStatus = {
  configValid: boolean;
  configPath: string;
  configHash: string | null;
  lastModified: number | null;
  issues: unknown[];
};

// Main wizard state
export type ConfigWizardState = {
  client: GatewayBrowserClient | null;
  connected: boolean;

  // Wizard flow
  currentStep: WizardStep;
  selectedPlatformId: string | null;

  // Platform data
  platforms: PlatformInfo[];
  platformsLoading: boolean;

  // Platform configurations
  platformConfigs: Record<string, PlatformConfigState>;

  // Service status
  serviceStatus: ServiceStatus | null;
  serviceStatusLoading: boolean;

  // Saving
  saving: boolean;
  saveError: string | null;

  // Errors
  lastError: string | null;
};

// Initial state factory
export function createInitialWizardState(): ConfigWizardState {
  return {
    client: null,
    connected: false,
    currentStep: "welcome",
    selectedPlatformId: null,
    platforms: [],
    platformsLoading: false,
    platformConfigs: {},
    serviceStatus: null,
    serviceStatusLoading: false,
    saving: false,
    saveError: null,
    lastError: null,
  };
}

// Load available platforms
export async function loadPlatforms(state: ConfigWizardState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.platformsLoading = true;
  state.lastError = null;

  try {
    const result = await state.client.request<{ platforms: PlatformInfo[] }>(
      "configWizard.getPlatforms",
      {},
    );
    state.platforms = result.platforms;
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : "Failed to load platforms";
  } finally {
    state.platformsLoading = false;
  }
}

// Load platform schema
export async function loadPlatformSchema(
  state: ConfigWizardState,
  platformId: string,
): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  const existing = state.platformConfigs[platformId];
  if (existing?.schema) {
    return; // Already loaded
  }

  state.platformConfigs[platformId] = {
    schema: null,
    values: {},
    testResult: null,
    testing: false,
    loading: true,
  };

  try {
    const result = await state.client.request<{ schema: PlatformSchema }>(
      "configWizard.getPlatformSchema",
      { platformId },
    );

    // Initialize values with defaults
    const values: Record<string, unknown> = {};
    for (const field of result.schema.fields) {
      if (field.defaultValue !== undefined) {
        values[field.key] = field.defaultValue;
      }
    }
    for (const field of result.schema.advancedFields ?? []) {
      if (field.defaultValue !== undefined) {
        values[field.key] = field.defaultValue;
      }
    }

    state.platformConfigs[platformId] = {
      schema: result.schema,
      values,
      testResult: null,
      testing: false,
      loading: false,
    };
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : "Failed to load platform schema";
    state.platformConfigs[platformId].loading = false;
  }
}

// Update platform config value
export function updatePlatformConfigValue(
  state: ConfigWizardState,
  platformId: string,
  key: string,
  value: unknown,
): void {
  const config = state.platformConfigs[platformId];
  if (!config) {
    return;
  }

  config.values = { ...config.values, [key]: value };
  config.testResult = null; // Clear test result when config changes
}

// Test platform connection
export async function testPlatformConnection(
  state: ConfigWizardState,
  platformId: string,
): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  const config = state.platformConfigs[platformId];
  if (!config) {
    return;
  }

  config.testing = true;
  config.testResult = null;

  try {
    // Extract only the platform-specific values (strip prefix)
    const platformValues: Record<string, unknown> = {};
    const prefix = `channels.${platformId}.`;
    for (const [key, value] of Object.entries(config.values)) {
      if (key.startsWith(prefix)) {
        const strippedKey = key.slice(prefix.length);
        platformValues[strippedKey] = value;
      }
    }

    const result = await state.client.request<TestResult>("configWizard.testConnection", {
      platformId,
      config: platformValues,
    });

    config.testResult = result;
  } catch (err) {
    config.testResult = {
      success: false,
      message: err instanceof Error ? err.message : "Connection test failed",
    };
  } finally {
    config.testing = false;
  }
}

// Save platform configuration
export async function savePlatformConfig(
  state: ConfigWizardState,
  platformId: string,
  baseHash?: string,
): Promise<boolean> {
  if (!state.client || !state.connected) {
    return false;
  }

  const config = state.platformConfigs[platformId];
  if (!config) {
    return false;
  }

  state.saving = true;
  state.saveError = null;

  try {
    // Extract only the platform-specific values (strip prefix)
    const platformValues: Record<string, unknown> = {};
    const prefix = `channels.${platformId}.`;
    for (const [key, value] of Object.entries(config.values)) {
      if (key.startsWith(prefix)) {
        const strippedKey = key.slice(prefix.length);
        platformValues[strippedKey] = value;
      }
    }

    await state.client.request("configWizard.savePlatformConfig", {
      platformId,
      config: platformValues,
      enabled: true,
      baseHash,
    });

    return true;
  } catch (err) {
    state.saveError = err instanceof Error ? err.message : "Failed to save configuration";
    return false;
  } finally {
    state.saving = false;
  }
}

// Load service status
export async function loadServiceStatus(state: ConfigWizardState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  state.serviceStatusLoading = true;

  try {
    const result = await state.client.request<ServiceStatus>("configWizard.getServiceStatus", {});
    state.serviceStatus = result;
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : "Failed to load service status";
  } finally {
    state.serviceStatusLoading = false;
  }
}

// Navigation helpers
export function goToStep(state: ConfigWizardState, step: WizardStep): void {
  state.currentStep = step;
  // Trigger platform loading when entering the select step
  if (step === "platform-select" && state.platforms.length === 0 && !state.platformsLoading) {
    void loadPlatforms(state);
  }
}

export function selectPlatform(state: ConfigWizardState, platformId: string): void {
  state.selectedPlatformId = platformId;
}

export function goBack(state: ConfigWizardState): void {
  switch (state.currentStep) {
    case "platform-select":
      state.currentStep = "welcome";
      break;
    case "platform-configure":
      state.currentStep = "platform-select";
      break;
    case "review":
      state.currentStep = "platform-configure";
      break;
    case "complete":
      state.currentStep = "review";
      break;
    default:
      break;
  }
}

export function goNext(state: ConfigWizardState): void {
  switch (state.currentStep) {
    case "welcome":
      state.currentStep = "platform-select";
      // Trigger platform loading when entering the select step
      if (state.platforms.length === 0 && !state.platformsLoading) {
        void loadPlatforms(state);
      }
      break;
    case "platform-select":
      if (state.selectedPlatformId) {
        state.currentStep = "platform-configure";
      }
      break;
    case "platform-configure":
      state.currentStep = "review";
      break;
    case "review":
      state.currentStep = "complete";
      break;
    default:
      break;
  }
}

// Get enabled/configured platforms
export function getConfiguredPlatforms(state: ConfigWizardState): PlatformInfo[] {
  return state.platforms.filter((p) => p.configured);
}

export function getEnabledPlatforms(state: ConfigWizardState): PlatformInfo[] {
  return state.platforms.filter((p) => p.enabled);
}

// Check if current platform config is valid
export function isCurrentConfigValid(state: ConfigWizardState): boolean {
  if (!state.selectedPlatformId) {
    return false;
  }

  const config = state.platformConfigs[state.selectedPlatformId];
  if (!config?.schema) {
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
