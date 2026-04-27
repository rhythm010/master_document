import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { parseRunnerArgs, readTestDefinition, resolveResultsDir, runTestFile } from "./runner";

function printUsage(): void {
  console.log("Usage: npx tsx src/test-runner/index.ts [--cleanup] <test1.json> <test2.json>");
}

async function main(): Promise<void> {
  const { cleanup, files } = parseRunnerArgs(process.argv.slice(2));

  if (files.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.error(`Test file not found: ${filePath}`);
      continue;
    }

    const testDef = readTestDefinition(filePath);
    const resultsDir = resolveResultsDir(testDef, filePath);
    fs.mkdirSync(resultsDir, { recursive: true });

    const report = await runTestFile(filePath, cleanup);
    const fileName = `${path.basename(filePath, ".json")}-result.json`;
    const resultPath = path.join(resultsDir, fileName);
    fs.writeFileSync(resultPath, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${resultPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
