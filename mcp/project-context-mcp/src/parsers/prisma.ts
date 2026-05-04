export interface PrismaField {
  name: string;
  rawType: string;
  isOptional: boolean;
  isList: boolean;
  attributes: string[];
}

export interface PrismaModel {
  name: string;
  fields: PrismaField[];
  modelAttributes: string[];
}

function stripInlineComment(line: string): string {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  return line.slice(0, idx);
}

export function parsePrismaModel(schema: string, entity: string): PrismaModel | null {
  const re = new RegExp(`(^|\\n)\\s*model\\s+${entity}\\s*\\{`, "m");
  const start = schema.search(re);
  if (start === -1) return null;

  const afterStart = schema.slice(start);
  const openIdx = afterStart.indexOf("{");
  if (openIdx === -1) return null;

  // Find matching closing brace for this model block.
  let depth = 0;
  let endRel = -1;
  for (let i = openIdx; i < afterStart.length; i++) {
    const ch = afterStart[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        endRel = i;
        break;
      }
    }
  }

  if (endRel === -1) return null;

  const body = afterStart.slice(openIdx + 1, endRel);
  const lines = body.split(/\r?\n/);

  const fields: PrismaField[] = [];
  const modelAttributes: string[] = [];

  for (const rawLine of lines) {
    const line = stripInlineComment(rawLine).trim();
    if (!line) continue;

    if (line.startsWith("@@")) {
      modelAttributes.push(line);
      continue;
    }

    // Field line: <name> <type> <attributes...>
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;

    const name = parts[0];
    const rawType = parts[1];
    const isOptional = rawType.endsWith("?");
    const isList = rawType.endsWith("[]") || rawType.includes("[]");

    const attributes = parts.slice(2);

    // Skip obvious non-field lines.
    if (name.startsWith("//")) continue;

    fields.push({ name, rawType, isOptional, isList, attributes });
  }

  return { name: entity, fields, modelAttributes };
}

export function listPrismaModels(schema: string): string[] {
  const names = Array.from(schema.matchAll(/\bmodel\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g)).map(
    (m) => m[1]
  );
  return Array.from(new Set(names));
}
