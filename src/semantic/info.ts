import { genUUID, UUID } from "./util";
import * as ast from "../parser/ast";
import { Evaluated } from "./const-eval";

// 语义错误类
export class SemanticError extends Error {
  constructor(message: string, public node?: ast.ASTNode) {
    super(message);
    this.name = "SemanticError";
  }
}

// 变量符号
export interface VariableSymbol {
  UUID: UUID;
  name: string;
  type: Type;
  mutable: boolean;  // 添加可变性信息
  evaluated?: Evaluated;  // 对于常量，存储编译时求值的结果（可扩展到任何类型）
}

// 类型符号
export interface TypeSymbol {
  UUID: UUID;
  name: string;
  type: Type;
  declaration?: ast.ASTNode;
}

// 函数符号
export interface FunctionSymbol {
  UUID: UUID;
  name: string;
  params: Type[];
  returnType: Type;
  declaration?: ast.FuncItem;
}

// 类型定义
export type Type = 
  | PrimitiveType
  | TypePath
  | ArrayType
  | FunctionType
  | StructType;

export interface PrimitiveType {
  kind: "primitiveType";
  name: "i32" | "u32" | "usize" | "isize" | "integer" | "bool" | "char" | "str" | "unit";
}

export interface TypePath {
  kind: "typePath";
  symbol: TypeSymbol;
}

export interface ArrayType {
  kind: "arrayType";
  type: Type;
  expr: ast.Expr;
}

export interface FunctionType {
  kind: "functionType";
  params: Type[];
  returnType: Type;
}

export interface StructType {
  kind: "structType";
  fields: Map<string, Type>;
  methods?: Map<string, FunctionSymbol>;  // Methods associated with this struct
}

// 基本类型实例
export const unitType: () => Type = () => ({ 
  kind: "primitiveType", 
  name: "unit" 
});

export const i32Type: () => Type = () => ({
  kind: "primitiveType",
  name: "i32"
});

export const u32Type: () => Type = () => ({
  kind: "primitiveType",
  name: "u32"
});

export const usizeType: () => Type = () => ({
  kind: "primitiveType",
  name: "usize"
});

export const isizeType: () => Type = () => ({
  kind: "primitiveType",
  name: "isize"
});

export const integerType: () => Type = () => ({
  kind: "primitiveType",
  name: "integer"
});

export const boolType: () => Type = () => ({
  kind: "primitiveType",
  name: "bool"
});

// 作用域接口
export interface Scope {
  variables: Map<string, VariableSymbol>;
  types: Map<string, TypeSymbol>;
  functions: Map<string, FunctionSymbol>;
  parent: Scope | null;
  depth: number;
}

// 符号表接口
export interface SymbolTable {
  // 作用域管理
  enterScope(): void;
  exitScope(): void;
  
  // 变量符号管理
  insertVariable(name: string, symbol: VariableSymbol): void;
  lookupVariable(name: string): VariableSymbol | undefined;
  lookupVariableInCurrentScope(name: string): VariableSymbol | undefined;
  
  // 类型符号管理
  insertType(name: string, symbol: TypeSymbol): void;
  lookupType(name: string): TypeSymbol | undefined;
  lookupTypeInCurrentScope(name: string): TypeSymbol | undefined;

  // 函数符号管理
  insertFunction(name: string, symbol: FunctionSymbol): void;
  lookupFunction(name: string): FunctionSymbol | undefined;
  lookupFunctionInCurrentScope(name: string): FunctionSymbol | undefined;
}

// 符号表实现
export class SymbolTableImpl implements SymbolTable {
  private scopes: Scope[];
  private globalScope: Scope;

  constructor() {
    // 初始化全局作用域
    this.globalScope = {
      variables: new Map(),
      types: new Map(),
      functions: new Map(),
      parent: null,
      depth: 0
    };

    this.scopes = [this.globalScope];

    // 初始化内置类型
    this.initializePrimitiveTypes();

    // 初始化内置函数
    this.initializeBuiltinFunctions();
  }

  // 初始化内置类型
  private initializePrimitiveTypes(): void {
    const primitiveTypes: Array<[string, "i32" | "u32" | "usize" | "isize" | "bool" | "char" | "str" | "unit"]> = [
      ["i32", "i32"],
      ["u32", "u32"],
      ["usize", "usize"],
      ["isize", "isize"],
      ["bool", "bool"],
      ["char", "char"],
      ["str", "str"],
      ["()", "unit"]
    ];

    for (const [name, typeName] of primitiveTypes) {
      const symbol: TypeSymbol = {
        UUID: genUUID(),
        name: name,
        type: {
          kind: "primitiveType",
          name: typeName
        }
      };
      this.globalScope.types.set(name, symbol);
    }
  }

  // 初始化内置函数
  private initializeBuiltinFunctions(): void {
    // Register exit function: fn exit(code: i32) -> ()
    const exitFunction: FunctionSymbol = {
      UUID: genUUID(),
      name: "exit",
      params: [i32Type()],
      returnType: unitType()
    };
    this.globalScope.functions.set("exit", exitFunction);
  }

  // 获取当前作用域
  private getCurrentScope(): Scope {
    if (this.scopes.length === 0) {
      throw new Error("No scopes available");
    }
    return this.scopes[this.scopes.length - 1]!;
  }

  // 作用域管理
  enterScope(): void {
    const currentScope = this.getCurrentScope();
    const newScope: Scope = {
      variables: new Map(),
      types: new Map(),
      functions: new Map(),
      parent: currentScope,
      depth: currentScope.depth + 1
    };
    this.scopes.push(newScope);
  }

  exitScope(): void {
    if (this.scopes.length <= 1) {
      throw new SemanticError("Cannot exit global scope");
    }
    this.scopes.pop();
  }

  // 变量符号管理
  insertVariable(name: string, symbol: VariableSymbol): void {
    const currentScope = this.getCurrentScope();
    
    // 检查当前作用域是否已存在同名符号
    if (currentScope.variables.has(name)) {
      throw new SemanticError(`Duplicate variable declaration: ${name}`);
    }
    
    // 插入符号
    currentScope.variables.set(name, symbol);
  }

  lookupVariable(name: string): VariableSymbol | undefined {
    // 从当前作用域开始，向上查找
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const scope = this.scopes[i]!;
      const symbol = scope.variables.get(name);
      if (symbol) {
        return symbol;
      }
    }
    return undefined;
  }

  lookupVariableInCurrentScope(name: string): VariableSymbol | undefined {
    const currentScope = this.getCurrentScope();
    return currentScope.variables.get(name);
  }

  // 类型符号管理
  insertType(name: string, symbol: TypeSymbol): void {
    const currentScope = this.getCurrentScope();
    
    // 检查当前作用域是否已存在同名类型
    if (currentScope.types.has(name)) {
      throw new SemanticError(`Duplicate type declaration: ${name}`);
    }
    
    // 插入类型符号
    currentScope.types.set(name, symbol);
  }

  lookupType(name: string): TypeSymbol | undefined {
    // 从当前作用域开始，向上查找
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const scope = this.scopes[i]!;
      const symbol = scope.types.get(name);
      if (symbol) {
        return symbol;
      }
    }
    return undefined;
  }

  lookupTypeInCurrentScope(name: string): TypeSymbol | undefined {
    const currentScope = this.getCurrentScope();
    return currentScope.types.get(name);
  }

  // 函数符号管理
  insertFunction(name: string, symbol: FunctionSymbol): void {
    const currentScope = this.getCurrentScope();

    // 检查当前作用域是否已存在同名函数
    if (currentScope.functions.has(name)) {
      throw new SemanticError(`Duplicate function declaration: ${name}`);
    }

    // 插入函数符号
    currentScope.functions.set(name, symbol);
  }

  lookupFunction(name: string): FunctionSymbol | undefined {
    // 从当前作用域开始，向上查找
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const scope = this.scopes[i]!;
      const symbol = scope.functions.get(name);
      if (symbol) {
        return symbol;
      }
    }
    return undefined;
  }

  lookupFunctionInCurrentScope(name: string): FunctionSymbol | undefined {
    const currentScope = this.getCurrentScope();
    return currentScope.functions.get(name);
  }
}

// 类型推断映射
export const inferredType = new Map<ast.ASTNode, Type>();
import { evaluateExpr } from "./const-eval";

// Type equality checking function
export function areTypesEqual(type1: Type, type2: Type, symbolTable?: SymbolTable): boolean {
  // Compare basic types
  if (type1.kind !== type2.kind) {
    return false;
  }

  // Compare based on type kind
  switch (type1.kind) {
    case "primitiveType":
      const prim1 = type1 as PrimitiveType;
      const prim2 = type2 as PrimitiveType;

      // Exact match
      if (prim1.name === prim2.name) {
        return true;
      }

      // Integer literal compatibility: 'integer' is compatible with any integer type
      const integerTypes = ["i32", "u32", "usize", "isize"];
      if (prim1.name === "integer" && integerTypes.includes(prim2.name)) {
        return true;
      }
      if (prim2.name === "integer" && integerTypes.includes(prim1.name)) {
        return true;
      }

      return false;

    case "arrayType":
      const arrayType2 = type2 as ArrayType;
      // Compare element types
      if (!areTypesEqual(type1.type, arrayType2.type, symbolTable)) {
        return false;
      }
      // Compare array size expressions (by evaluating them)
      const size1 = evaluateExpr(type1.expr, symbolTable);
      const size2 = evaluateExpr(arrayType2.expr, symbolTable);
      return size1 !== undefined && size2 !== undefined &&
             typeof size1.value === 'number' && typeof size2.value === 'number' &&
             size1.value === size2.value;

    default:
      // For other types, use simple equality check for now
      return JSON.stringify(type1) === JSON.stringify(type2);
  }
}