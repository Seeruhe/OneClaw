import { listChannelPlugins } from "../../channels/plugins/index.js";
import {
  loadConfig,
  readConfigFileSnapshot,
  readConfigFileSnapshotForWrite,
  resolveConfigSnapshotHash,
  validateConfigObjectWithPlugins,
  writeConfigFile,
} from "../../config/config.js";
import { applyMergePatch } from "../../config/merge-patch.js";
import {
  redactConfigObject,
  redactConfigSnapshot,
  restoreRedactedValues,
} from "../../config/redact-snapshot.js";
import { buildConfigSchema, type ConfigSchemaResponse } from "../../config/schema.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { loadOpenClawPlugins } from "../../plugins/loader.js";
import { diffConfigPaths } from "../config-reload.js";
import { scheduleGatewaySigusr1Restart } from "../infra/restart.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { resolveBaseHashParam } from "./base-hash.js";
import type { GatewayRequestHandlers, RespondFn } from "./types.js";
import { assertValidParams } from "./validation.js";

// Platform configuration schema for UI forms
export type PlatformFormField = {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "toggle" | "textarea" | "number";
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

export type TestConnectionResult = {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
};

function loadSchemaWithPlugins(): ConfigSchemaResponse {
  const cfg = loadConfig();
  const workspaceDir = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
  const pluginRegistry = loadOpenClawPlugins({
    config: cfg,
    cache: true,
    workspaceDir,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  });
  return buildConfigSchema({
    plugins: pluginRegistry.plugins.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      configUiHints: plugin.configUiHints,
      configSchema: plugin.configJsonSchema,
    })),
    channels: listChannelPlugins().map((entry) => ({
      id: entry.id,
      label: entry.meta.label,
      description: entry.meta.blurb,
      configSchema: entry.configSchema?.schema,
      configUiHints: entry.configSchema?.uiHints,
    })),
  });
}

// Built-in platform schemas for the wizard UI
const BUILTIN_PLATFORM_SCHEMAS: PlatformSchema[] = [
  {
    id: "telegram",
    label: "Telegram",
    description: "Connect via Telegram Bot API for DMs and groups",
    enabledKey: "channels.telegram.enabled",
    fields: [
      {
        key: "channels.telegram.botToken",
        label: "Bot Token",
        type: "password",
        required: true,
        placeholder: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
        helpText: "Get from @BotFather on Telegram",
      },
      {
        key: "channels.telegram.dmPolicy",
        label: "DM Policy",
        type: "select",
        defaultValue: "pairing",
        options: [
          { value: "pairing", label: "Pairing - Unknown senders need approval" },
          { value: "allowlist", label: "Allowlist - Only allowed users" },
          { value: "open", label: "Open - Allow all DMs" },
          { value: "disabled", label: "Disabled - Block all DMs" },
        ],
      },
      {
        key: "channels.telegram.streaming",
        label: "Streaming Mode",
        type: "select",
        defaultValue: "off",
        options: [
          { value: "off", label: "Off - No streaming preview" },
          { value: "partial", label: "Partial - Edit single preview message" },
          { value: "block", label: "Block - Stream in larger chunks" },
        ],
      },
    ],
    advancedFields: [
      {
        key: "channels.telegram.allowFrom",
        label: "Allowed User IDs",
        type: "textarea",
        placeholder: "123456789, 987654321",
        helpText: "Comma-separated Telegram user IDs",
      },
      {
        key: "channels.telegram.webhookUrl",
        label: "Webhook URL",
        type: "text",
        placeholder: "https://your-domain.com/webhook",
        helpText: "Optional webhook URL for Telegram updates",
      },
      {
        key: "channels.telegram.proxy",
        label: "Proxy URL",
        type: "text",
        placeholder: "http://proxy:8080",
      },
    ],
  },
  {
    id: "discord",
    label: "Discord",
    description: "Connect via Discord Bot for DMs and guilds",
    enabledKey: "channels.discord.enabled",
    fields: [
      {
        key: "channels.discord.token",
        label: "Bot Token",
        type: "password",
        required: true,
        placeholder: "ODk...(your bot token)",
        helpText: "Get from Discord Developer Portal",
      },
      {
        key: "channels.discord.dmPolicy",
        label: "DM Policy",
        type: "select",
        defaultValue: "pairing",
        options: [
          { value: "pairing", label: "Pairing - Unknown senders need approval" },
          { value: "allowlist", label: "Allowlist - Only allowed users" },
          { value: "open", label: "Open - Allow all DMs" },
          { value: "disabled", label: "Disabled - Block all DMs" },
        ],
      },
      {
        key: "channels.discord.streaming",
        label: "Streaming Mode",
        type: "select",
        defaultValue: "off",
        options: [
          { value: "off", label: "Off - No streaming preview" },
          { value: "partial", label: "Partial - Edit single preview message" },
          { value: "block", label: "Block - Stream in larger chunks" },
        ],
      },
    ],
    advancedFields: [
      {
        key: "channels.discord.allowFrom",
        label: "Allowed Users",
        type: "textarea",
        placeholder: "user_id_1, user_id_2",
        helpText: "Comma-separated Discord user IDs",
      },
      {
        key: "channels.discord.proxy",
        label: "Proxy URL",
        type: "text",
        placeholder: "http://proxy:8080",
      },
      {
        key: "channels.discord.intents.guildMembers",
        label: "Guild Members Intent",
        type: "toggle",
        defaultValue: false,
        helpText: "Requires Discord Portal opt-in",
      },
      {
        key: "channels.discord.intents.presence",
        label: "Presence Intent",
        type: "toggle",
        defaultValue: false,
        helpText: "Requires Discord Portal opt-in",
      },
    ],
  },
  {
    id: "slack",
    label: "Slack",
    description: "Connect via Slack App for DMs and channels",
    enabledKey: "channels.slack.enabled",
    fields: [
      {
        key: "channels.slack.botToken",
        label: "Bot Token",
        type: "password",
        required: true,
        placeholder: "xoxb-...",
        helpText: "Get from Slack App OAuth & Permissions",
      },
      {
        key: "channels.slack.appToken",
        label: "App-Level Token",
        type: "password",
        placeholder: "xapp-...",
        helpText: "Get from Slack App Basic Information",
      },
    ],
    advancedFields: [
      {
        key: "channels.slack.signingSecret",
        label: "Signing Secret",
        type: "password",
        placeholder: "abc123...",
        helpText: "Get from Slack App Basic Information",
      },
    ],
  },
  {
    id: "signal",
    label: "Signal",
    description: "Connect via signald for Signal messaging",
    enabledKey: "channels.signal.enabled",
    fields: [
      {
        key: "channels.signal.phoneNumber",
        label: "Phone Number",
        type: "text",
        required: true,
        placeholder: "+1234567890",
        helpText: "Your Signal phone number",
      },
    ],
  },
  {
    id: "imessage",
    label: "iMessage",
    description: "Connect via iMessage (macOS only)",
    enabledKey: "channels.imessage.enabled",
    fields: [
      {
        key: "channels.imessage.imessageGroup",
        label: "iMessage Group",
        type: "text",
        placeholder: "chat-guid",
        helpText: "Optional: iMessage group chat GUID",
      },
    ],
  },
  {
    id: "googlechat",
    label: "Google Chat",
    description: "Connect via Google Chat webhook",
    enabledKey: "channels.googlechat.enabled",
    fields: [
      {
        key: "channels.googlechat.webhookUrl",
        label: "Webhook URL",
        type: "password",
        required: true,
        placeholder: "https://chat.googleapis.com/v1/...",
      },
    ],
  },
];

function getChannelStatusFromSnapshot(
  snapshot: Awaited<ReturnType<typeof readConfigFileSnapshot>>,
  channelId: string,
): { configured: boolean; enabled: boolean } {
  const config = snapshot.config as Record<string, unknown> | null;
  const channels = (config?.channels as Record<string, unknown>) ?? {};
  const channel = channels[channelId] as Record<string, unknown> | undefined;

  const enabled = channel?.enabled !== false;
  const configured = channel != null && Object.keys(channel).length > 0;

  return { configured, enabled };
}

export const configWizardHandlers: GatewayRequestHandlers = {
  "configWizard.getPlatforms": async ({ respond }) => {
    const snapshot = await readConfigFileSnapshot();
    const channelPlugins = listChannelPlugins();

    // Build platform list from built-in schemas and channel plugins
    const platforms: PlatformInfo[] = BUILTIN_PLATFORM_SCHEMAS.map((schema) => {
      const status = getChannelStatusFromSnapshot(snapshot, schema.id);
      return {
        id: schema.id,
        label: schema.label,
        description: schema.description,
        icon: schema.icon,
        configured: status.configured,
        enabled: status.enabled,
      };
    });

    // Add extension channels
    for (const plugin of channelPlugins) {
      if (!platforms.find((p) => p.id === plugin.id)) {
        const status = getChannelStatusFromSnapshot(snapshot, plugin.id);
        platforms.push({
          id: plugin.id,
          label: plugin.meta.label,
          description: plugin.meta.blurb,
          configured: status.configured,
          enabled: status.enabled,
        });
      }
    }

    respond(true, { platforms }, undefined);
  },

  "configWizard.getPlatformSchema": ({ params, respond }) => {
    const platformId = (params as { platformId?: unknown }).platformId;
    if (typeof platformId !== "string") {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "platformId (string) required"),
      );
      return;
    }

    // Find built-in schema
    const builtinSchema = BUILTIN_PLATFORM_SCHEMAS.find((s) => s.id === platformId);
    if (builtinSchema) {
      respond(true, { schema: builtinSchema }, undefined);
      return;
    }

    // Try to build from channel plugin
    const channelPlugins = listChannelPlugins();
    const plugin = channelPlugins.find((p) => p.id === platformId);
    if (plugin) {
      const schema: PlatformSchema = {
        id: plugin.id,
        label: plugin.meta.label,
        description: plugin.meta.blurb,
        enabledKey: `channels.${plugin.id}.enabled`,
        fields: [],
      };

      // Convert JSON Schema to form fields if available
      if (plugin.configSchema?.schema) {
        const jsonSchema = plugin.configSchema.schema as {
          properties?: Record<string, unknown>;
          required?: string[];
        };
        const properties = jsonSchema.properties ?? {};
        const required = new Set(jsonSchema.required ?? []);

        for (const [key, value] of Object.entries(properties)) {
          const prop = value as {
            type?: string;
            description?: string;
            enum?: string[];
            default?: unknown;
          };
          const isRequired = required.has(key);

          schema.fields.push({
            key: `channels.${plugin.id}.${key}`,
            label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1"),
            type: prop.type === "boolean" ? "toggle" : prop.enum ? "select" : "text",
            required: isRequired,
            helpText: prop.description,
            defaultValue: prop.default,
            options: prop.enum?.map((v) => ({ value: v, label: v })),
          });
        }
      }

      respond(true, { schema }, undefined);
      return;
    }

    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INVALID_REQUEST, `Unknown platform: ${platformId}`),
    );
  },

  "configWizard.testConnection": async ({ params, respond }) => {
    const platformId = (params as { platformId?: unknown }).platformId;
    const config = (params as { config?: unknown }).config;

    if (typeof platformId !== "string") {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "platformId (string) required"),
      );
      return;
    }

    // Platform-specific connection tests
    try {
      const result = await testPlatformConnection(platformId, config as Record<string, unknown>);
      respond(true, result, undefined);
    } catch (err) {
      respond(
        true,
        {
          success: false,
          message: err instanceof Error ? err.message : "Connection test failed",
        },
        undefined,
      );
    }
  },

  "configWizard.savePlatformConfig": async ({ params, respond, client, context }) => {
    const platformId = (params as { platformId?: unknown }).platformId;
    const config = (params as { config?: unknown }).config;
    const enabled = (params as { enabled?: unknown }).enabled;
    const baseHash = resolveBaseHashParam(params);

    if (typeof platformId !== "string") {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "platformId (string) required"),
      );
      return;
    }

    if (typeof config !== "object" || config === null) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "config (object) required"),
      );
      return;
    }

    // Load current config
    const { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();

    // Validate base hash
    if (snapshot.exists) {
      const snapshotHash = resolveConfigSnapshotHash(snapshot);
      if (snapshotHash && baseHash && baseHash !== snapshotHash) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "config changed since last load; re-run config.get and retry",
          ),
        );
        return;
      }
    }

    // Build merge patch
    const platformConfig: Record<string, unknown> = {
      ...config,
      enabled: enabled !== false,
    };

    const patch = {
      channels: {
        [platformId]: platformConfig,
      },
    };

    // Apply merge
    const merged = applyMergePatch(snapshot.config ?? {}, patch, {
      mergeObjectArraysById: true,
    });

    // Validate
    const schema = loadSchemaWithPlugins();
    const restored = restoreRedactedValues(merged, snapshot.config ?? {}, schema.uiHints);
    if (!restored.ok) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          restored.humanReadableMessage ?? "Invalid config",
        ),
      );
      return;
    }

    const validated = validateConfigObjectWithPlugins(restored.result);
    if (!validated.ok) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "Invalid config", {
          details: { issues: validated.issues },
        }),
      );
      return;
    }

    // Write config
    const changedPaths = diffConfigPaths(snapshot.config ?? {}, validated.config);
    context?.logGateway?.info(
      `configWizard.savePlatformConfig platform=${platformId} changedPaths=${changedPaths.length}`,
    );

    await writeConfigFile(validated.config, writeOptions);

    // Schedule restart
    const restart = scheduleGatewaySigusr1Restart({
      reason: "configWizard.savePlatformConfig",
      audit: {
        actor: "config-wizard",
        deviceId: null,
        clientIp: null,
        changedPaths,
      },
    });

    respond(
      true,
      {
        ok: true,
        config: redactConfigObject(validated.config, schema.uiHints),
        restart,
      },
      undefined,
    );
  },

  "configWizard.getServiceStatus": async ({ respond }) => {
    const snapshot = await readConfigFileSnapshot();
    const schema = loadSchemaWithPlugins();
    const redacted = redactConfigSnapshot(snapshot, schema.uiHints);

    respond(
      true,
      {
        configValid: snapshot.valid,
        configPath: snapshot.path,
        configHash: redacted.hash,
        lastModified: snapshot.mtime,
        issues: snapshot.issues,
      },
      undefined,
    );
  },
};

// Platform-specific connection test implementations
async function testPlatformConnection(
  platformId: string,
  config: Record<string, unknown>,
): Promise<TestConnectionResult> {
  switch (platformId) {
    case "telegram": {
      const botToken = config.botToken as string | undefined;
      if (!botToken) {
        return { success: false, message: "Bot token is required" };
      }

      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const data = (await response.json()) as { ok?: boolean; result?: { username?: string } };

        if (data.ok) {
          return {
            success: true,
            message: `Connected as @${data.result?.username ?? "unknown"}`,
            details: { username: data.result?.username },
          };
        }
        return { success: false, message: "Invalid bot token" };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Connection failed",
        };
      }
    }

    case "discord": {
      const token = config.token as string | undefined;
      if (!token) {
        return { success: false, message: "Bot token is required" };
      }

      try {
        const response = await fetch("https://discord.com/api/v10/users/@me", {
          headers: { Authorization: `Bot ${token}` },
        });

        if (response.ok) {
          const data = (await response.json()) as { username?: string };
          return {
            success: true,
            message: `Connected as ${data.username ?? "unknown"}`,
            details: { username: data.username },
          };
        }
        if (response.status === 401) {
          return { success: false, message: "Invalid bot token" };
        }
        return { success: false, message: `Discord API error: ${response.status}` };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Connection failed",
        };
      }
    }

    case "slack": {
      const botToken = config.botToken as string | undefined;
      if (!botToken) {
        return { success: false, message: "Bot token is required" };
      }

      try {
        const response = await fetch("https://slack.com/api/auth.test", {
          headers: { Authorization: `Bearer ${botToken}` },
        });

        const data = (await response.json()) as { ok?: boolean; user?: string; team?: string };

        if (data.ok) {
          return {
            success: true,
            message: `Connected to ${data.team ?? "workspace"} as ${data.user ?? "bot"}`,
            details: { user: data.user, team: data.team },
          };
        }
        return { success: false, message: "Invalid bot token or insufficient permissions" };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Connection failed",
        };
      }
    }

    case "googlechat": {
      const webhookUrl = config.webhookUrl as string | undefined;
      if (!webhookUrl) {
        return { success: false, message: "Webhook URL is required" };
      }

      // Basic URL validation
      try {
        new URL(webhookUrl);
        return { success: true, message: "Webhook URL is valid" };
      } catch {
        return { success: false, message: "Invalid webhook URL format" };
      }
    }

    default:
      // For platforms without specific tests, return a basic validation
      return { success: true, message: "Configuration saved (no connection test available)" };
  }
}
