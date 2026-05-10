import generateModule from "@babel/generator";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import type * as t from "@babel/types";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import type { ApiContractInfo } from "../types.js";

const traverse = ((traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule) as typeof traverseModule;
const generate = ((generateModule as unknown as { default?: typeof generateModule }).default ?? generateModule) as typeof generateModule;

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const HTTP_METHODS = new Set(["get", "post", "patch", "delete"]);

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walkFiles(path));
    else if (SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) out.push(path);
  }
  return out;
}

function nodeText(node: t.Node | null | undefined): string {
  return node ? generate(node).code : "";
}

function enclosingFunctionName(path: import("@babel/traverse").NodePath): string {
  const fn = path.getFunctionParent();
  if (!fn) return "";
  const node = fn.node;
  if (node.type === "FunctionDeclaration") return node.id?.name ?? "";
  const parent = fn.parentPath?.node;
  if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
  return "";
}

function endpointFromCall(node: t.CallExpression): string | null {
  const first = node.arguments[0];
  if (!first) return null;
  if (first.type === "StringLiteral") return first.value;
  if (first.type === "TemplateLiteral" && first.quasis.length === 1) return first.quasis[0].value.cooked ?? first.quasis[0].value.raw;
  return null;
}

function responseTypeFromCall(node: t.CallExpression): string {
  const params = node.typeParameters;
  if (params?.type === "TSTypeParameterInstantiation" && params.params[0]) return nodeText(params.params[0]);
  return "";
}

function requestTypeFromCall(node: t.CallExpression): string {
  const body = node.arguments[1];
  if (!body) return "";
  if (body.type === "Identifier") return body.name;
  return body.type;
}

function collectQueryKeys(ast: t.File, endpointOrTag: string): string[] {
  const keys = new Set<string>();
  traverse(ast, {
    ObjectProperty(path) {
      const key = path.node.key;
      const name = key.type === "Identifier" ? key.name : key.type === "StringLiteral" ? key.value : "";
      if (name !== "queryKey") return;
      const valueText = nodeText(path.node.value);
      if (valueText.toLowerCase().includes(endpointOrTag.toLowerCase())) keys.add(valueText);
    },
    VariableDeclarator(path) {
      const id = path.node.id;
      if (id.type !== "Identifier" || !id.name.toLowerCase().includes("querykey")) return;
      const valueText = nodeText(path.node.init);
      if (valueText.toLowerCase().includes(endpointOrTag.toLowerCase())) keys.add(valueText);
    },
  });
  return [...keys];
}

export function parseApiContract(appRoot: string, endpointOrTag: string): ApiContractInfo {
  const files = [...walkFiles(join(appRoot, "lib")), ...walkFiles(join(appRoot, "hooks"))];
  const needle = endpointOrTag.toLowerCase();
  const fallback: ApiContractInfo = {
    serviceFilePath: "",
    functionName: "",
    requestTypePath: "",
    responseTypePath: "",
    queryKey: [],
  };

  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    const ast = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] });
    const queryKey = collectQueryKeys(ast, endpointOrTag);
    let found: ApiContractInfo | null = null;

    traverse(ast, {
      CallExpression(path) {
        if (found) return;
        const callee = path.node.callee;
        if (
          callee.type !== "MemberExpression" ||
          callee.object.type !== "Identifier" ||
          callee.object.name !== "apiClient" ||
          callee.property.type !== "Identifier" ||
          !HTTP_METHODS.has(callee.property.name)
        ) {
          return;
        }

        const endpoint = endpointFromCall(path.node);
        const functionName = enclosingFunctionName(path);
        const haystack = `${endpoint ?? ""} ${functionName} ${relative(appRoot, filePath)}`.toLowerCase();
        if (!haystack.includes(needle)) return;

        found = {
          serviceFilePath: filePath,
          functionName,
          requestTypePath: requestTypeFromCall(path.node),
          responseTypePath: responseTypeFromCall(path.node),
          queryKey,
        };
      },
    });

    if (found) return found;
    if (queryKey.length > 0 && !fallback.queryKey.length) {
      fallback.serviceFilePath = filePath;
      fallback.queryKey = queryKey;
    }
  }

  return fallback;
}
