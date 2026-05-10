import generateModule from "@babel/generator";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
const traverse = (traverseModule.default ?? traverseModule);
const generate = (generateModule.default ?? generateModule);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
function walkFiles(root) {
    if (!existsSync(root))
        return [];
    const out = [];
    for (const entry of readdirSync(root)) {
        const path = join(root, entry);
        const stat = statSync(path);
        if (stat.isDirectory())
            out.push(...walkFiles(path));
        else if (SOURCE_EXTENSIONS.has(extname(path)))
            out.push(path);
    }
    return out;
}
function nodeText(node) {
    return node ? generate(node).code : "unknown";
}
function memberName(name) {
    if (name.type === "Identifier")
        return name.name;
    if (name.type === "StringLiteral" || name.type === "NumericLiteral")
        return String(name.value);
    return nodeText(name);
}
function isFunctionishType(type) {
    return type.type === "TSFunctionType" || type.type === "TSConstructorType";
}
export function parseStoreSlice(appRoot, sliceName) {
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
    const state = {};
    const actions = new Set();
    traverse(ast, {
        TSInterfaceDeclaration(path) {
            if (!path.node.id.name.toLowerCase().includes(normalized))
                return;
            for (const member of path.node.body.body) {
                if (member.type !== "TSPropertySignature" || !member.key)
                    continue;
                const name = memberName(member.key);
                const typeNode = member.typeAnnotation?.typeAnnotation;
                if (typeNode && isFunctionishType(typeNode))
                    actions.add(name);
                else
                    state[name] = typeNode ? nodeText(typeNode) : "unknown";
            }
        },
        TSTypeAliasDeclaration(path) {
            if (!path.node.id.name.toLowerCase().includes(normalized))
                return;
            const annotation = path.node.typeAnnotation;
            if (annotation.type !== "TSTypeLiteral")
                return;
            for (const member of annotation.members) {
                if (member.type !== "TSPropertySignature" || !member.key)
                    continue;
                const name = memberName(member.key);
                const typeNode = member.typeAnnotation?.typeAnnotation;
                if (typeNode && isFunctionishType(typeNode))
                    actions.add(name);
                else
                    state[name] = typeNode ? nodeText(typeNode) : "unknown";
            }
        },
    });
    return { filePath, state, actions: [...actions].sort() };
}
