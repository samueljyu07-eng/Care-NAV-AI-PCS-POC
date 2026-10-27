import { z } from "zod";
import { pathwayResponseSchema } from "./schema";

type JsonSchema = Record<string, unknown>;

function isSchema(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Zod's JSON Schema includes enum and const, which Claude's structured outputs
// accept. The SDK helper moves those keywords into a description, so this walk
// keeps them and drops limits the API rejects, such as minimum and maxItems.
function outputSchema(node: JsonSchema): JsonSchema {
  const next: JsonSchema = {};

  if (isSchema(node.$defs)) {
    const defs: JsonSchema = {};
    for (const [name, definition] of Object.entries(node.$defs)) {
      if (isSchema(definition)) {
        defs[name] = outputSchema(definition);
      }
    }
    next.$defs = defs;
  }

  if (typeof node.$ref === "string") {
    next.$ref = node.$ref;
    return next;
  }

  if (node.type !== undefined) {
    next.type = node.type;
  }
  if (node.enum !== undefined) {
    next.enum = node.enum;
  }
  if (node.const !== undefined) {
    next.const = node.const;
  }

  if (node.type === "object" && isSchema(node.properties)) {
    const properties: JsonSchema = {};
    for (const [key, property] of Object.entries(node.properties)) {
      if (isSchema(property)) {
        properties[key] = outputSchema(property);
      }
    }
    next.properties = properties;
    next.additionalProperties = false;
    if (node.required !== undefined) {
      next.required = node.required;
    }
  }

  if (node.type === "array" && isSchema(node.items)) {
    next.items = outputSchema(node.items);
    if (node.minItems === 0 || node.minItems === 1) {
      next.minItems = node.minItems;
    }
  }

  return next;
}

export function pathwayOutputFormat(): {
  type: "json_schema";
  schema: JsonSchema;
  parse: (content: string) => unknown;
} {
  return {
    type: "json_schema",
    schema: outputSchema(
      z.toJSONSchema(pathwayResponseSchema, { reused: "ref" }) as JsonSchema,
    ),
    parse(content) {
      try {
        return JSON.parse(content);
      } catch {
        return null;
      }
    },
  };
}
