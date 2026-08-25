import { z } from "zod";
function jsonSchemaToZodRawShape(inputSchema) {
  if (!inputSchema || inputSchema.type !== "object" || !inputSchema.properties) {
    return {};
  }
  const required = new Set(inputSchema.required ?? []);
  const shape = {};
  for (const [name, raw] of Object.entries(inputSchema.properties)) {
    let zodType;
    try {
      zodType = jsonPropertyToZod(raw);
    } catch {
      zodType = z.any();
    }
    if (!required.has(name)) {
      zodType = zodType.optional();
    }
    shape[name] = zodType;
  }
  return shape;
}
function jsonPropertyToZod(prop) {
  if (!prop || typeof prop !== "object") {
    return z.any();
  }
  let base;
  if (Array.isArray(prop.enum) && prop.enum.length > 0) {
    const literals = prop.enum.filter(
      (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null
    );
    if (literals.length === 0) {
      base = z.any();
    } else if (literals.length === 1) {
      base = z.literal(literals[0]);
    } else {
      base = z.union(literals.map((v) => z.literal(v)));
    }
  } else if (Array.isArray(prop.oneOf) && prop.oneOf.length > 0) {
    base = unionOf(prop.oneOf);
  } else if (Array.isArray(prop.anyOf) && prop.anyOf.length > 0) {
    base = unionOf(prop.anyOf);
  } else {
    const type = Array.isArray(prop.type) ? prop.type[0] : prop.type;
    switch (type) {
      case "string":
        base = z.string();
        break;
      case "number":
        base = z.number();
        break;
      case "integer":
        base = z.number().int();
        break;
      case "boolean":
        base = z.boolean();
        break;
      case "array":
        base = z.array(prop.items ? jsonPropertyToZod(prop.items) : z.any());
        break;
      case "object": {
        const sub = {};
        const subRequired = new Set(prop.required ?? []);
        for (const [n, p] of Object.entries(prop.properties ?? {})) {
          let t;
          try {
            t = jsonPropertyToZod(p);
          } catch {
            t = z.any();
          }
          if (!subRequired.has(n)) {
            t = t.optional();
          }
          sub[n] = t;
        }
        base = z.object(sub);
        break;
      }
      case "null":
        base = z.null();
        break;
      default:
        base = z.any();
    }
  }
  if (prop.nullable) {
    base = base.nullable();
  }
  if (prop.description) {
    base = base.describe(prop.description);
  }
  if (prop.default !== void 0) {
    base = base.default(prop.default);
  }
  return base;
}
function unionOf(schemas) {
  const variants = schemas.map((s) => {
    try {
      return jsonPropertyToZod(s);
    } catch {
      return z.any();
    }
  });
  if (variants.length === 1) {
    return variants[0];
  }
  return z.union(variants);
}
export {
  jsonSchemaToZodRawShape
};
