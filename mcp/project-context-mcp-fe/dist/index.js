import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { appendFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseApiContract } from "./parsers/api-parser.js";
import { parseBackendGaps } from "./parsers/backend-gap-parser.js";
import { parseComponent } from "./parsers/component-parser.js";
import { parseDesignTokens } from "./parsers/design-token-parser.js";
import { parseRouterConfig } from "./parsers/router-parser.js";
import { parseStoreSlice } from "./parsers/store-parser.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = realpathSync(resolve(__dirname, "..", "..", ".."));
const APP_ROOT = resolve(REPO_ROOT, "technical", "frontend-companion", "companion-app");
const MCP_USAGE_DIR = join(REPO_ROOT, ".mcp-usage");
const MCP_USAGE_LOG = join(MCP_USAGE_DIR, "project-context-mcp-fe.jsonl");
const GST_OFFSET_MS = 4 * 60 * 60 * 1000;
const server = new Server({ name: "project-context-mcp-fe", version: "1.0.0" }, { capabilities: { tools: {} } });
function jsonText(data) {
    return { type: "text", text: JSON.stringify(data, null, 2) };
}
function nowGst() {
    return new Date(Date.now() + GST_OFFSET_MS).toISOString().replace("Z", "+04:00");
}
function log(message) {
    const timestampUtc = new Date().toISOString();
    const timestampGst = nowGst();
    process.stderr.write(`[project-context-mcp-fe] ${timestampGst} ${message}\n`);
    try {
        mkdirSync(MCP_USAGE_DIR, { recursive: true });
        appendFileSync(MCP_USAGE_LOG, `${JSON.stringify({ timestamp: timestampGst, timestampGst, timestampUtc, server: "project-context-mcp-fe", message })}\n`);
    }
    catch {
        // Usage logging must never break MCP responses.
    }
}
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_fe_component",
                description: "Find a React Native component by name and return props, callback props, and children-like slots.",
                inputSchema: {
                    type: "object",
                    required: ["componentName"],
                    properties: {
                        componentName: { type: "string", description: "Component name or component file basename." },
                    },
                },
            },
            {
                name: "get_fe_router_config",
                description: "Parse Expo Router app/ files and return route paths, files, dynamic flags, and nearest layouts.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_fe_store_slice",
                description: "Find a Zustand store slice by name and return state fields and action names.",
                inputSchema: {
                    type: "object",
                    required: ["sliceName"],
                    properties: {
                        sliceName: { type: "string", description: "Store/slice name, e.g. session." },
                    },
                },
            },
            {
                name: "get_fe_api_contract",
                description: "Find client-side API function/type context for an endpoint path, function name, or tag.",
                inputSchema: {
                    type: "object",
                    required: ["endpoint_or_tag"],
                    properties: {
                        endpoint_or_tag: { type: "string", description: "Endpoint path fragment, API function name, or domain tag." },
                    },
                },
            },
            {
                name: "get_fe_design_tokens",
                description: "Return design tokens from the frontend theme for colors, spacing, or typography.",
                inputSchema: {
                    type: "object",
                    required: ["category"],
                    properties: {
                        category: { type: "string", enum: ["colors", "spacing", "typography"] },
                    },
                },
            },
            {
                name: "get_fe_backend_gaps",
                description: "Parse the frontend backend-gap register and optionally filter by open/resolved/workaround status.",
                inputSchema: {
                    type: "object",
                    properties: {
                        status: { type: "string", enum: ["open", "resolved", "workaround"] },
                    },
                },
            },
        ],
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const started = Date.now();
    log(`Tool called: ${name} | args: ${JSON.stringify(args)}`);
    try {
        if (name === "get_fe_component") {
            return { content: [jsonText(parseComponent(APP_ROOT, String(args.componentName ?? "")))] };
        }
        if (name === "get_fe_router_config") {
            return { content: [jsonText(parseRouterConfig(APP_ROOT))] };
        }
        if (name === "get_fe_store_slice") {
            return { content: [jsonText(parseStoreSlice(APP_ROOT, String(args.sliceName ?? "")))] };
        }
        if (name === "get_fe_api_contract") {
            return { content: [jsonText(parseApiContract(APP_ROOT, String(args.endpoint_or_tag ?? "")))] };
        }
        if (name === "get_fe_design_tokens") {
            return { content: [jsonText(parseDesignTokens(APP_ROOT, String(args.category ?? "colors")))] };
        }
        if (name === "get_fe_backend_gaps") {
            const status = args.status ? String(args.status) : undefined;
            return { content: [jsonText(parseBackendGaps(REPO_ROOT, status))] };
        }
        return { content: [jsonText({ error: `Unknown tool: ${name}` })], isError: true };
    }
    catch (error) {
        return {
            content: [jsonText({ error: error instanceof Error ? error.message : String(error) })],
            isError: true,
        };
    }
    finally {
        log(`Tool finished: ${name} | durationMs=${Date.now() - started}`);
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log("project-context-mcp-fe started on stdio transport");
}
main().catch((err) => {
    process.stderr.write(`Fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
});
