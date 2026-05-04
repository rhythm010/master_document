import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { log } from "./util.js";

async function run(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: { ...process.env },
  });

  const client = new Client(
    { name: "project-context-mcp-smoke", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  const tools = await client.listTools();
  log(`listTools returned ${tools.tools.length} tool(s)`);

  // 1) One real module
  const mod = await client.callTool({ name: "get_module_contract", arguments: { module: "identity" } });
  log(`get_module_contract(identity) ok; contentItems=${mod.content.length}`);

  // 2) One real feature SDS (current/latest)
  const sds = await client.callTool({ name: "get_feature_sds", arguments: { feature: "matching-flow" } });
  log(`get_feature_sds(matching-flow) ok; contentItems=${sds.content.length}`);

  // 3) One real schema entity
  const ent = await client.callTool({ name: "get_schema_entity", arguments: { entity: "User" } });
  log(`get_schema_entity(User) ok; contentItems=${ent.content.length}`);

  await client.close();
  process.stdout.write("SMOKE_OK\n");
}

run().catch((err) => {
  process.stderr.write(`SMOKE_FAIL: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
