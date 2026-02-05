import type { LLVMIRBuilder } from "./builder";

/**
 * Declare built-in functions as external LLVM IR declarations.
 * These will be linked against at runtime.
 */
export function declareBuiltins(builder: LLVMIRBuilder): void {
  // I/O functions - simple versions that will be linked with C library
  builder.emitInstruction("declare void @printInt(i32)");
  builder.emitInstruction("declare void @printlnInt(i32)");
  builder.emitInstruction("declare i32 @getInt()");

  // System functions
  builder.emitInstruction("declare void @exit(i32)");
}
