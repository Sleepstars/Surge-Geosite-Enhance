import { parse, RootNode } from "regjsparser";

const DOT_BOUNDARY_PREFIXES = ["(^|\\.)", "(?:^|\\.)", "(\\.|^)"];

const stripAnchors = (input: string): string => {
  let value = input;
  while (value.startsWith("^")) value = value.slice(1);
  while (value.endsWith("$")) value = value.slice(0, -1);
  return value;
};

const normalizeWildcard = (input: string): string => {
  let value = input;
  value = value.replace(/\*{2,}/g, "*");
  value = value.replace(/\*\.+/g, "*.");
  return value;
};

export const regexAstToWildcard = (regex: string): string => {
  const trimmed = regex.replace(/^\/|\/$/g, "");

  let pattern = trimmed;
  let prefix = "";
  for (const dotBoundary of DOT_BOUNDARY_PREFIXES) {
    if (pattern.startsWith(dotBoundary)) {
      prefix = "*.";
      pattern = pattern.slice(dotBoundary.length);
      break;
    }
  }

  pattern = stripAnchors(pattern);

  if (!pattern) {
    return normalizeWildcard(prefix);
  }

  try {
    const ast = parse(pattern, "", {
      lookbehind: true,
      namedGroups: true,
      unicodePropertyEscape: true,
      unicodeSet: true,
      modifiers: true,
    });
    const wildcard = convertNodeToWildcard(ast);
    return normalizeWildcard(prefix + wildcard);
  } catch (error) {
    console.error("Error parsing regex:", error);
    return "";
  }
};

const convertNodeToWildcard = (
  node: RootNode<{
    lookbehind: true;
    namedGroups: true;
    unicodePropertyEscape: true;
    unicodeSet: true;
    modifiers: true;
  }>
): string => {
  switch (node.type) {
    case "alternative":
      return node.body.map(convertNodeToWildcard).join("");
    case "anchor":
      return "";
    case "characterClass":
      return "?";
    case "characterClassEscape":
      return "?";
    case "disjunction":
      return "*";
    case "dot":
      return "?";
    case "group":
      if (!Array.isArray(node.body) || node.body.length === 0) return "";
      if (node.body.length === 1) return convertNodeToWildcard(node.body[0]);
      const variants = node.body.map(convertNodeToWildcard);
      const [first, ...rest] = variants;
      if (rest.every((variant) => variant === first)) return first;
      return "*";
    case "quantifier": {
      const [child] = node.body;
      if (!child) return "*";
      const inner = convertNodeToWildcard(child);
      const { min, max } = node;
      if (typeof max === "number" && min === max) {
        return inner.repeat(max);
      }
      if (min === 0) {
        if (max == null) return "*";
        if (max <= 1) return "*";
      }
      if (min === 1 && max == null) {
        return inner + "*";
      }
      return "*";
    }
    case "reference":
      return "*";
    case "value":
      if (typeof node.codePoint === "number") {
        return String.fromCodePoint(node.codePoint);
      }
      return "?";
    case "unicodePropertyEscape":
      return "?";
  }
};
