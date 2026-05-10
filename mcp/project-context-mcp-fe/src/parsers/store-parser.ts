import generateModule from "@babel/generator";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import type * as t from "@babel/types";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

import type { StoreSliceInfo } from "../types.js";

const traverse = ((traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule) as typeof traverseModule;
const generate = ((generateModule as unknown as { default?: typeof generateModule }).default ?? generateModule) as typeof generateModule;

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walkFiles(path));
    else if (SOURCE_EXTENSIONS.has(extname(path))) out.push(path);
  }
  return out;
}

function nodeText(node: t.Node | null | undefined): string {
  return node ? generate(node).code : "unknown";
}

function memberName(name: t.Expression | t.PrivateName | t.Identifier | t.StringLiteral | t.NumericLiteral): string {
  if (name.type === "Identifier") return name.name;
  if (name.type === "StringLiteral" || name.type === "NumericLiteral") return String(name.value);
  return nodeText(name);
}

function isFunctionishType(type: t.TSType): boolean {
  return type.type === "TSFunctionType" || type.type === "TSConstructorType";
}

export function parseStoreSlice(appRoot: string, sliceName: string): StoreSliceInfo {
  const normalized = sliceName.replace(/store$/i, "").replace(/[-_]/g, "").toLowerCase();
  const candidates = walkFiles(join(appRoot, "store"))
    .filter((path) => basename(path, extname(path)).replace(/[-_]/g, "").toLowerCase().includes(normalized))
    .sort();

  if (candidates.length === 0) {
    return { filePath: "", state: {}, actions: [] };
  }

  const filePath = candidates[0];
  const ast = parse(readFileSync(filePath, "utf8"), {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  const state: Record<string, string> = {};
  const actions = new Set<string>();

  traverse(ast, {
    TSInterfaceDeclaration(path) {
      if (!path.node.id.name.toLowerCase().includes(normalized)) return;
      for (const member of path.node.body.body) {
        if (member.type !== "TSPropertySignature" || !member.key) continue;
        const name = memberName(member.key as t.Identifier | t.StringLiteral | t.NumericLiteral);
        const typeNode = member.typeAnnotation?.typeAnnotation;
        if (typeNode && isFunctionishType(typeNode)) actions.add(name);
        else state[name] = typeNode ? nodeText(typeNode) : "unknown";
      }
    },
    TSTypeAliasDeclaration(path) {
      if (!path.node.id.name.toLowerCase().includes(normalized)) return;
      const annotation = path.node.typeAnnotation;
      if (annotation.type !== "TSTypeLiteral") return;
      for (const member of annotation.members) {
        if (member.type !== "TSPropertySignature" || !member.key) continue;
        const name = memberName(member.key as t.Identifier | t.StringLiteral | t.NumericLiteral);
        const typeNode = member.typeAnnotation?.typeAnnotation;
        if (typeNode && isFunctionishType(typeNode)) actions.add(name);
        else state[name] = typeNode ? nodeText(typeNode) : "unknown";
      }
    },
  });

  return { filePath, state, actions: [...actions].sort() };
}
