import type { Type } from "../semantic/info";

/**
 * Map a semantic Type to its LLVM IR type string representation.
 */
export function typeToLLVM(type: Type): string {
  switch (type.kind) {
    case "primitiveType":
      switch (type.name) {
        case "i32":
          return "i32";
        case "bool":
          return "i1";
        case "unit":
          return "void";
        case "integer":
          return "i32";
        case "u32":
          return "i32";
        case "usize":
        case "isize":
          return "i64";
        case "char":
          return "i8";
        case "never":
          return "void";
        default:
          throw new Error(`Unsupported primitive type: ${type.name}`);
      }

    case "arrayType": {
      const elementType = typeToLLVM(type.type);
      return `[${type.size} x ${elementType}]`;
    }

    case "structType": {
      const fields = Array.from(type.fields.values())
        .map((t) => typeToLLVM(t))
        .join(", ");
      return `{ ${fields} }`;
    }

    case "refType":
      return "ptr";

    case "enum":
      // For now, treat enums as i32 discriminants
      return "i32";

    default:
      throw new Error(`Unsupported type kind: ${(type as any).kind}`);
  }
}
