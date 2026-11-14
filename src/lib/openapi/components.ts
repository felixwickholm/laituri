import { z } from "zod";
import { SCHEMAS, type SchemaName } from "./schemas";

type JsonSchema = Record<string, unknown>;

export const COMPONENT_PREFIX = "#/components/schemas/";

function strip(schema: JsonSchema): JsonSchema {
  const { $schema, $id, ...rest } = schema;
  void $schema;
  void $id;
  return rest;
}

let cached: Record<string, JsonSchema> | undefined;

/** JSON Schema 2020-12 for every named schema; shared parts become $refs between components. */
export function componentSchemas(): Record<string, JsonSchema> {
  if (cached) return cached;
  const registry = z.registry<{ id: string }>();
  for (const [name, schema] of Object.entries(SCHEMAS)) registry.add(schema, { id: name });
  const { schemas } = z.toJSONSchema(registry, {
    uri: (name) => COMPONENT_PREFIX + name,
    io: "input",
    unrepresentable: "any",
  });
  cached = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, strip(schema as JsonSchema)]));
  return cached;
}

/** A self-contained schema (no $refs), as MCP tool definitions need. */
export function inlineSchema(schema: SchemaName | z.ZodType, io: "input" | "output"): JsonSchema {
  const zod = typeof schema === "string" ? SCHEMAS[schema] : schema;
  return strip(z.toJSONSchema(zod, { io, unrepresentable: "any" }) as JsonSchema);
}
