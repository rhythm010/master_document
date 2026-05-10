import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
const traverse = (traverseModule.default ?? traverseModule);
function literalValue(node) {
    if (!node)
        return null;
    if (node.type === "StringLiteral" || node.type === "NumericLiteral" || node.type === "BooleanLiteral")
        return node.value;
    if (node.type === "NullLiteral")
        return null;
    if (node.type === "Identifier")
        return node.name;
    if (node.type === "ObjectExpression")
        return objectValue(node);
    return null;
}
function objectValue(node) {
    const out = {};
    for (const prop of node.properties) {
        if (prop.type !== "ObjectProperty")
            continue;
        const key = prop.key.type === "Identifier"
            ? prop.key.name
            : prop.key.type === "StringLiteral" || prop.key.type === "NumericLiteral"
                ? String(prop.key.value)
                : null;
        if (!key)
            continue;
        out[key] = literalValue(prop.value);
    }
    return out;
}
function platformSelectValue(node) {
    const callee = node.callee;
    if (callee.type === "MemberExpression" &&
        callee.object.type === "Identifier" &&
        callee.object.name === "Platform" &&
        callee.property.type === "Identifier" &&
        callee.property.name === "select") {
        const first = node.arguments[0];
        if (first?.type === "ObjectExpression")
            return objectValue(first);
    }
    return null;
}
export function parseDesignTokens(appRoot, category) {
    const themePath = join(appRoot, "constants", "theme.ts");
    if (!existsSync(themePath))
        return {};
    const ast = parse(readFileSync(themePath, "utf8"), {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
    });
    const exportNameByCategory = {
        colors: ["Colors", "colors"],
        spacing: ["Spacing", "spacing"],
        typography: ["Typography", "typography", "Fonts", "fonts"],
    };
    let result = {};
    traverse(ast, {
        VariableDeclarator(path) {
            const id = path.node.id;
            if (id.type !== "Identifier" || !exportNameByCategory[category].includes(id.name))
                return;
            const init = path.node.init;
            if (init?.type === "ObjectExpression")
                result = objectValue(init);
            if (init?.type === "CallExpression") {
                const selected = platformSelectValue(init);
                if (selected && typeof selected === "object" && !Array.isArray(selected))
                    result = selected;
            }
        },
    });
    return result;
}
