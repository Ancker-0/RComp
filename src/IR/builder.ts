import type { Type } from "../semantic/info";
import type { Operator } from "../lexer/token";

/**
 * LLVMValue represents a value generated during code generation.
 */
export interface LLVMValue {
  register: string; // The register or variable name (e.g., "%3", "@global")
  type: string; // LLVM type string (e.g., "i32", "i1")
  isLValue: boolean; // Whether this is an lvalue (can be assigned to)
}

/**
 * VariableAllocation tracks stack-allocated variables.
 */
interface VariableAllocation {
  allocaRegister: string; // The alloca register (e.g., "%x.addr")
  type: string; // The LLVM type
}

/**
 * LLVMIRBuilder generates LLVM IR text.
 * It handles instruction emission, register/label generation, and basic block management.
 */
export class LLVMIRBuilder {
  private buffer: string[] = [];
  private registerCounter = 0;
  private labelCounter = 0;
  private allocaCounter = 0;  // For generating unique alloca register names
  private variableAllocations = new Map<string, VariableAllocation>();

  /**
   * Get the LLVM type string for a semantic type.
   */
  getType(type: Type): string {
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
      case "arrayType":
        const elementType = this.getType(type.type);
        return `[${type.size} x ${elementType}]`;
      case "structType":
        const fields = Array.from(type.fields.values())
          .map((t) => this.getType(t))
          .join(", ");
        return `{ ${fields} }`;
      case "refType":
        return "ptr";
      case "enum":
        return "i32";
      default:
        throw new Error(`Unsupported type kind: ${(type as any).kind}`);
    }
  }

  /**
   * Generate a fresh SSA register name.
   */
  freshRegister(): string {
    return `%${this.registerCounter++}`;
  }

  /**
   * Generate a fresh label name.
   */
  freshLabel(prefix: string): string {
    return `${prefix}_${this.labelCounter++}`;
  }

  /**
   * Emit a comment.
   */
  emitComment(text: string): void {
    this.buffer.push(`; ${text}`);
  }

  /**
   * Emit an empty line.
   */
  emitEmptyLine(): void {
    this.buffer.push("");
  }

  /**
   * Emit an instruction.
   */
  emitInstruction(instr: string): void {
    this.buffer.push(instr);
  }

  /**
   * Generate an integer literal value.
   */
  literalI32(value: number): string {
    return value.toString();
  }

  /**
   * Generate a boolean literal value.
   */
  literalBool(value: boolean): string {
    return value ? "1" : "0";
  }

  /**
   * Allocate stack space for a local variable.
   */
  alloca(name: string, type: string): string {
    const uniqueId = this.allocaCounter++;
    const allocaReg = `%${name}.addr.${uniqueId}`;
    this.emitInstruction(`${allocaReg} = alloca ${type}`);
    this.variableAllocations.set(name, { allocaRegister: allocaReg, type });
    return allocaReg;
  }

  /**
   * Store a value to a variable's stack allocation.
   */
  store(valueReg: string, valueType: string, varName: string): void {
    const alloc = this.variableAllocations.get(varName);
    if (!alloc) {
      throw new Error(`Variable ${varName} not allocated`);
    }
    this.emitInstruction(`store ${valueType} ${valueReg}, ptr ${alloc.allocaRegister}`);
  }

  /**
   * Load a value from a variable's stack allocation.
   */
  load(varName: string): { register: string; type: string } {
    const alloc = this.variableAllocations.get(varName);
    if (!alloc) {
      throw new Error(`Variable ${varName} not allocated`);
    }
    const resultReg = this.freshRegister();
    this.emitInstruction(`${resultReg} = load ${alloc.type}, ptr ${alloc.allocaRegister}`);
    return { register: resultReg, type: alloc.type };
  }

  /**
   * Generate a binary operation.
   */
  binop(op: Operator, left: string, right: string, type: string): string {
    const resultReg = this.freshRegister();
    const llvmOp = this.mapBinaryOperator(op);
    this.emitInstruction(`${resultReg} = ${llvmOp} ${type} ${left}, ${right}`);
    return resultReg;
  }

  /**
   * Generate a comparison operation (icmp).
   */
  icmp(cond: string, left: string, right: string, type: string = "i32"): string {
    const resultReg = this.freshRegister();
    this.emitInstruction(`${resultReg} = icmp ${cond} ${type} ${left}, ${right}`);
    return resultReg;
  }

  /**
   * Generate a unary operation.
   */
  unaryOp(op: Operator, operand: string, operandType: string): string {
    const resultReg = this.freshRegister();
    if (op === "-") {
      this.emitInstruction(`${resultReg} = sub ${operandType} 0, ${operand}`);
    } else if (op === "!") {
      this.emitInstruction(`${resultReg} = xor i1 ${operand}, 1`);
    } else if (op === "*") {
      // Dereference: load from pointer
      this.emitInstruction(`${resultReg} = load ${operandType}, ptr ${operand}`);
    } else if (op === "&") {
      // Reference: already a pointer, just return it
      return operand;
    } else {
      throw new Error(`Unsupported unary operator: ${op}`);
    }
    return resultReg;
  }

  /**
   * Map an operator to its LLVM IR instruction.
   */
  private mapBinaryOperator(op: Operator): string {
    const arithmeticOps: Partial<Record<Operator, string>> = {
      "+": "add",
      "-": "sub",
      "*": "mul",
      "/": "sdiv",
      "%": "srem",
    };

    const logicalOps: Partial<Record<Operator, string>> = {
      "&&": "and",
      "||": "or",
    };

    if (op in arithmeticOps) return arithmeticOps[op]!;
    if (op in logicalOps) return logicalOps[op]!;

    throw new Error(`Unsupported binary operator: ${op}`);
  }

  /**
   * Map a comparison operator to its LLVM IR condition.
   */
  mapComparisonOperator(op: Operator): string {
    const comparisonOps: Partial<Record<Operator, string>> = {
      "==": "eq",
      "!=": "ne",
      "<": "slt",
      ">": "sgt",
      "<=": "sle",
      ">=": "sge",
    };

    if (op in comparisonOps) return comparisonOps[op]!;

    throw new Error(`Unsupported comparison operator: ${op}`);
  }

  /**
   * Generate an unconditional branch.
   */
  br(label: string): void {
    this.emitInstruction(`br label %${label}`);
  }

  /**
   * Generate a conditional branch.
   */
  condBr(cond: string, trueLabel: string, falseLabel: string): void {
    this.emitInstruction(`br i1 ${cond}, label %${trueLabel}, label %${falseLabel}`);
  }

  /**
   * Generate a basic block label.
   */
  label(name: string): void {
    this.buffer.push(`${name}:`);
  }

  /**
   * Start a function definition.
   */
  define(retType: string, name: string, params: { name: string; type: string }[]): void {
    const paramsStr = params.map((p) => `${p.type} %${p.name}`).join(", ");
    this.emitInstruction(`define ${retType} @${name}(${paramsStr}) {`);
  }

  /**
   * End a function definition.
   */
  endFunction(): void {
    this.emitInstruction("}");
  }

  /**
   * Generate a return instruction.
   */
  ret(value?: string): void {
    if (value) {
      this.emitInstruction(`ret i32 ${value}`);
    } else {
      this.emitInstruction("ret void");
    }
  }

  /**
   * Generate a function call.
   */
  call(retType: string, funcName: string, args: { value: string; type: string }[]): string | null {
    const argsStr = args.map((a) => `${a.type} ${a.value}`).join(", ");
    if (retType === "void") {
      this.emitInstruction(`call void @${funcName}(${argsStr})`);
      return null;
    } else {
      const resultReg = this.freshRegister();
      this.emitInstruction(`${resultReg} = call ${retType} @${funcName}(${argsStr})`);
      return resultReg;
    }
  }

  /**
   * Generate a phi node.
   */
  phi(type: string, values: { value: string; label: string }[]): string {
    const resultReg = this.freshRegister();
    const incoming = values.map((v) => `[ ${v.value}, %${v.label} ]`).join(", ");
    this.emitInstruction(`${resultReg} = phi ${type} ${incoming}`);
    return resultReg;
  }

  /**
   * Generate a getelementptr instruction.
   */
  getelementptr(ptrType: string, basePtr: string, indices: { value: string; type: string }[]): string {
    const resultReg = this.freshRegister();
    const indicesStr = indices.map(i => `${i.type} ${i.value}`).join(", ");
    this.emitInstruction(`${resultReg} = getelementptr ${ptrType}, ptr ${basePtr}, ${indicesStr}`);
    return resultReg;
  }

  /**
   * Get variable allocation info.
   */
  getAllocation(name: string): VariableAllocation | undefined {
    return this.variableAllocations.get(name);
  }

  /**
   * Get the generated LLVM IR as a string.
   */
  getIR(): string {
    return this.buffer.join("\n");
  }

  /**
   * Zero-extend a value to a larger type.
   */
  zext(value: string, fromType: string, toType: string): string {
    const resultReg = this.freshRegister();
    this.emitInstruction(`${resultReg} = zext ${fromType} ${value} to ${toType}`);
    return resultReg;
  }

  /**
   * Truncate a value to a smaller type.
   */
  trunc(value: string, fromType: string, toType: string): string {
    const resultReg = this.freshRegister();
    this.emitInstruction(`${resultReg} = trunc ${fromType} ${value} to ${toType}`);
    return resultReg;
  }

  /**
   * Reset the builder state.
   */
  reset(): void {
    this.buffer = [];
    this.registerCounter = 0;
    this.labelCounter = 0;
    this.allocaCounter = 0;
    this.variableAllocations.clear();
  }

  /**
   * Clear variable allocations (e.g., when starting a new function).
   */
  clearAllocations(): void {
    this.variableAllocations.clear();
    this.allocaCounter = 0;  // Reset counter for new function
    this.registerCounter = 0;  // Reset counter for new function
  }
}
