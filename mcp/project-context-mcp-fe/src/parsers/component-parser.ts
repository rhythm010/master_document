import generateModule from "@babel/generator";
import { parse } from "@babel/parser";
import traverseModule, { type NodePath } from "@babel/traverse";
import type * as t from "@babel/types";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

import type { ComponentInfo, ComponentProp } from "../types.js";

const traverse = ((traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule) as typeof traverseModule;
const generate = ((generateModule as unknown as { default?: typeof generateModule }).default ?? generateModule) as typeof generateModule;

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".expo", ".git", "coverage"]);

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walkFiles(path));
    else if (SOURCE_EXTENSIONS.has(extname(path))) out.push(path);
  }
  return out;
}

function parseSource(source: string) {
  return parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
}

function nodeText(node: t.Node | null | undefined): string {
  if (!node) return "unknown";
  return generate(node).code;
}

function memberName(name: t.Expression | t.PrivateName | t.Identifier | t.StringLiteral | t.NumericLiteral): string {
  if (name.type === "Identifier") return name.name;
  if (name.type === "StringLiteral" || name.type === "NumericLiteral") return String(name.value);
  return nodeText(name);
}

function typeMemberToProp(member: t.TSTypeElement): ComponentProp | null {
  if (member.type !== "TSPropertySignature" || !member.key) return null;
  return {
    name: memberName(member.key as t.Identifier | t.StringLiteral | t.NumericLiteral),
    type: member.typeAnnotation ? nodeText(member.typeAnnotation.typeAnnotation) : "unknown",
    isRequired: !member.optional,
    defaultValue: null,
  };
}

function extractPropsFromTypeNode(node: t.TSTypeLiteral | t.TSInterfaceBody): ComponentProp[] {
  const members = node.type === "TSTypeLiteral" ? node.members : node.body;
  return members.map(typeMemberToProp).filter((prop): prop is ComponentProp => Boolean(prop));
}

function findPropsTypes(ast: t.File, componentName: string): Map<string, ComponentProp[]> {
  const propsByTypeName = new Map<string, ComponentProp[]>();

  traverse(ast, {
    TSInterfaceDeclaration(path) {
      const name = path.node.id.name;
      if (name.endsWith("Props") || name === `${componentName}Props`) {
        propsByTypeName.set(name, extractPropsFromTypeNode(path.node.body));
      }
    },
    TSTypeAliasDeclaration(path) {
      const name = path.node.id.name;
      const annotation = path.node.typeAnnotation;
      if ((name.endsWith("Props") || name === `${componentName}Props`) && annotation.type === "TSTypeLiteral") {
        propsByTypeName.set(name, extractPropsFromTypeNode(annotation));
      }
    },
  });

  return propsByTypeName;
}

function collectParamDefaults(param: t.Function["params"][number], props: Map<string, ComponentProp>): void {
  if (param.type !== "ObjectPattern") return;
  const typeNode = param.typeAnnotation?.type === "TSTypeAnnotation" ? param.typeAnnotation.typeAnnotation : null;
  if (typeNode?.type === "TSTypeLiteral") {
    for (const prop of extractPropsFromTypeNode(typeNode)) {
      if (!props.has(prop.name)) props.set(prop.name, prop);
    }
  }
  for (const property of param.properties) {
    if (property.type !== "ObjectProperty") continue;
    const propName = memberName(property.key as t.Identifier | t.StringLiteral | t.NumericLiteral);
    if (!props.has(propName)) continue;
    const current = props.get(propName)!;
    if (property.value.type === "AssignmentPattern") {
      props.set(propName, { ...current, defaultValue: nodeText(property.value.right) });
    }
  }
}

function findComponentParamDefaults(ast: t.File, componentName: string, props: Map<string, ComponentProp>): void {
  const maybeComponentFunction = (path: NodePath<t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression>) => {
    const parent = path.parentPath?.node;
    const declaredName =
      path.node.type === "FunctionDeclaration"
        ? path.node.id?.name
        : parent?.type === "VariableDeclarator" && parent.id.type === "Identifier"
          ? parent.id.name
          : null;

    if (declaredName && declaredName !== componentName) return;
    for (const param of path.node.params) collectParamDefaults(param, props);
  };

  traverse(ast, {
    FunctionDeclaration: maybeComponentFunction,
    FunctionExpression: maybeComponentFunction,
    ArrowFunctionExpression: maybeComponentFunction,
  });
}

function rankComponentFile(path: string, componentName: string): number {
  const base = basename(path, extname(path));
  if (base === componentName) return 0;
  if (base.toLowerCase() === componentName.toLowerCase()) return 1;
  if (base.replace(/[-_]/g, "").toLowerCase() === componentName.toLowerCase()) return 2;
  return 3;
}

export function parseComponent(appRoot: string, componentName: string): ComponentInfo {
  const candidates = walkFiles(join(appRoot, "components"))
    .filter((path) => basename(path, extname(path)).replace(/[-_]/g, "").toLowerCase().includes(componentName.replace(/[-_]/g, "").toLowerCase()))
    .sort((a, b) => rankComponentFile(a, componentName) - rankComponentFile(b, componentName));

  if (candidates.length === 0) {
    return { filePath: "", props: [], emits: [], slots: [] };
  }

  const filePath = candidates[0];
  const ast = parseSource(readFileSync(filePath, "utf8"));
  const propsByTypeName = findPropsTypes(ast, componentName);
  const preferredType = propsByTypeName.get(`${componentName}Props`) ?? [...propsByTypeName.values()][0] ?? [];
  const propsByName = new Map(preferredType.map((prop) => [prop.name, prop]));
  findComponentParamDefaults(ast, componentName, propsByName);

  const props = [...propsByName.values()];
  const emits = props.filter((prop) => /^on[A-Z]/.test(prop.name) || prop.type.includes("=>")).map((prop) => prop.name);
  const slots = props.filter((prop) => prop.name === "children" || prop.type.includes("ReactNode")).map((prop) => prop.name);

  return { filePath, props, emits, slots };
}
