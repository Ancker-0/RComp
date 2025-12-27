import { SymbolTableImpl, SemanticError, VariableSymbol, FunctionSymbol, Type, i32Type, boolType, unitType, areTypesEqual, StructType, usizeType, isNever, integerType, isUnit, EndTAlgebra, EndTRes, EndTypeF, neverType, isStruct, StringType, isIntegral, FunctionType } from "./info";
import { genUUID } from "./util";
import * as ast from "../parser/ast";
import { inferType } from "./type-infer";
import { evaluateExpr, Evaluated } from "./const-eval";
import util from 'util';
import { Control, CtrlBlock, CtrlFn, CtrlFnBlock, CtrlLoop } from "./control";

// 语义分析结果
export interface SemanticAnalysisResult {
  errors: SemanticError[];
}

// 语义分析器类
export class SemanticAnalyzer implements ast.Visitor<void> {
  private symbolTable: SymbolTableImpl;
  private errors: SemanticError[] = [];
  private loopDepth: number = 0; // 跟踪循环嵌套深度
  private inLoopContext: boolean = false; // 是否在 loop 中（支持 break value）
  ctrl: Control

  constructor() {
    this.symbolTable = new SymbolTableImpl();
    this.ctrl = new Control({
      symbolTable: this.symbolTable,
      reportError: this.reportError.bind(this),
      analyzeType: this.analyzeType.bind(this),
      inferExprType: this.inferExprType.bind(this),
      typeCastable: this.typeCastable.bind(this),
      unifyType: this.unifyType.bind(this),
      exitFunction: this.exitFunction,
    })
  }
  exitFunction: FunctionSymbol = {
    UUID: genUUID(),
    name: "exit",
    params: [i32Type()],
    returnType: unitType()
  };

  // 分析整个 crate
  analyze(crate: ast.Crate): SemanticAnalysisResult {
    this.visit(crate, this)
    // this.visit(crate, this.ctrl)  // can't work seperately
    return {
      errors: this.errors
    };
  }

  // 报告错误
  private reportError(message: string, node?: ast.ASTNode): void {
    const error = new SemanticError(message, node);
    this.errors.push(error);
  }

  unifyType = (u: Type, v: Type): Type | null => {
    if (u.kind != v.kind)
      return null
    const owner = u.owner ? u.owner : v.owner  // TODO: be consistent
    switch (u.kind) {
      case "arrayType":
        if (v.kind != u.kind) return null
        const szu = u.size
        const szv = v.size
        const type = this.unifyType(u.type, v.type)
        if (szu != szv || !type)
          return null
        return {
          kind: "arrayType",
          size: u.size,
          type,
          owner
        }
      case "primitiveType":
        if (v.kind != u.kind) return null
        if (u.name == v.name)
          return u
        if (u.name == "integer" && isIntegral(v))
          return v
        if (v.name == "integer" && isIntegral(u))
          return u
        return null  // TODO: unify integer type
      /*case "functionType":
        if (v.kind != u.kind) return null
        const returnT = unify(u.returnType, v.returnType)
        if (!returnT || u.params.length != v.params.length)
          return null
        const paramT = u.params.map((t, i) => unify(t, v.params[i]!))
        if (paramT.some(t => t == null))
          return null
        return {
          kind: "functionType",
          params: paramT as Type[],
          returnType: returnT,
          owner,
        }*/
      case "structType":
        if (v.kind != u.kind) return null
        return u.UUID == v.UUID ? u : null
      case "refType":
        return null  // TODO
    }
    return null
  }

  alg: EndTAlgebra<EndTRes> = (e: EndTypeF<EndTRes>) => {
    if ('type' in e) {
      return { succ: true, type: e.type }
    } else {
      if (e.sub.length == 0)
        return {
          succ: true,
          type: e.leading,
        }
      if (!e.sub.every(val => val.succ
        && val.type.kind == (e.sub[0]! as EndTRes & { succ: true }).type.kind))
        return { succ: false }
      const sub = e.sub.map(v => (v as EndTRes & { succ: true }))
      return { succ: false }
    }
  }

  private evaluateExpr(expr: ast.Expr): Evaluated | undefined {
    // TODO: migrate?
    return evaluateExpr(expr, this.symbolTable)
  }

  // 访问者模式实现
  onCrate(node: ast.NodeByKind<ast.ASTType.Crate>, self: ast.Visitor<void>): void {
    this.ctrl.onCratePre(node)
    try {
      // Pass 0: Register constant variables
      for (const item of node.items)
        if (item.kind === ast.ASTType.ConstItem)
          this.visit(item, self)

      // Pass 1: Register all struct types
      for (const item of node.items) {
        if (item.kind === ast.ASTType.StructItem) {
          this.registerStruct(item);
        }
      }

      // Pass 2: Register all impl blocks (methods)
      for (const item of node.items) {
        if (item.kind === ast.ASTType.InherentImpl) {
          this.registerImpl(item);
        }
      }

      // Pass 3: Register all function signatures
      for (const item of node.items) {
        if (item.kind === ast.ASTType.FnItem) {
          this.registerFunction(item);
        }
      }

      // Pass 4: Analyze all item contents
      for (const item of node.items)
        if (item.kind !== ast.ASTType.ConstItem)
          this.visit(item, self);
    } finally {
      this.ctrl.onCratePost(node)
    }
  }

  // TODO: fn using "self" as parameters
  onImpl(node: ast.NodeByKind<ast.ASTType.InherentImpl>, self: ast.Visitor<void>): void {
    this.symbolTable.enterScope()
    const myType = this.symbolTable.lookupType(node.type.value)
    if (!myType) {
      this.reportError(`Impl for non-existing type ${node.type.value}`)
      return
    }
    this.symbolTable.insertType("Self", myType)
    this.ctrl.onImplPre(node)
    ast.walk(node, self);
    this.ctrl.onImplPost(node)
    this.symbolTable.exitScope()
  }

  // 注册函数签名（不分析函数体）
  private registerFunction(node: ast.FuncItem): void {
    const paramTypes = node.params.map(p => this.analyzeType(p.type));
    const returnType = this.analyzeType(node.returnType);

    const funcSymbol: FunctionSymbol = {
      UUID: genUUID(),
      name: node.name,
      params: paramTypes,
      returnType: returnType,
      declaration: node
    };

    try {
      this.symbolTable.insertFunction(node.name, funcSymbol);
    } catch (error) {
      if (error instanceof SemanticError) {
        this.reportError(error.message);
      } else {
        throw error;
      }
    }
  }

  // Register struct type (without analyzing field expressions)
  private registerStruct(node: ast.StructItem): void {
    // Create field map
    const fields = new Map<string, Type>();

    for (const field of node.fields) {
      const fieldType = this.analyzeType(field.type);
      fields.set(field.name, fieldType);
    }

    // Create struct type
    const structType: StructType = {
      kind: "structType",
      UUID: genUUID(),
      name: node.name,
      fields,
      methods: new Map()  // Will be populated by registerImpl
    };

    try {
      this.symbolTable.insertType(node.name, structType);
    } catch (error) {
      if (error instanceof SemanticError) {
        this.reportError(error.message);
      } else {
        throw error;
      }
    }
  }

  // Register impl block methods
  private registerImpl(node: ast.InherentImpl): void {
    // Look up the type
    const typeName = node.type.value;
    const typeSymbol = this.symbolTable.lookupType(typeName);

    if (!typeSymbol) {
      this.reportError(`Unknown type in impl block: ${typeName}`, node);
      return;
    }

    // Ensure it's a struct type
    if (typeSymbol.kind !== "structType") {
      this.reportError(`Cannot implement methods for non-struct type: ${typeName}`, node);
      return;
    }

    const structType = typeSymbol

    // Register each method
    for (const method of node.fn) {
      // Analyze parameter types (excluding self parameter)
      const analyzeTypeImpl = (type: ast.Type): Type => {
        if (type.kind == ast.ASTType.TypePath && type.value == "Self")
          return structType
        return this.analyzeType(type)
      }
      const paramTypes = method.params.map(p => analyzeTypeImpl(p.type));
      const returnType = analyzeTypeImpl(method.returnType);

      const methodSymbol: FunctionSymbol = {
        UUID: genUUID(),
        name: method.name,
        params: paramTypes,
        returnType: returnType,
        declaration: method
      };

      // Add to struct's methods map
      if (!structType.methods) {
        structType.methods = new Map();
      }

      if (structType.methods.has(method.name)) {
        this.reportError(`Duplicate method definition: ${method.name} for type ${typeName}`, method);
      } else {
        structType.methods.set(method.name, methodSymbol);
      }
    }
  }

  onFn(node: ast.NodeByKind<ast.ASTType.FnItem>, self: ast.Visitor<void>): void {
    // 函数签名已经在 onCrate 中注册过了，这里只需要分析函数体

    // 进入函数作用域
    this.symbolTable.enterScope();

    const Self = this.symbolTable.lookupType("Self")
    if (Self && node.self) {  // inside some Impl
      this.symbolTable.insertVariable("self", {
        UUID: genUUID(),
        name: "self",
        type: { ...Self, owner: { kind: "left value", mutable: node.self.mutable } },
      })
    }

    try {
      // 处理函数参数
      for (const param of node.params) {
        this.analyzeParameter(param);
      }

      this.ctrl.onFnPre(node)
      const info = this.ctrl.ask(node) as CtrlFn | undefined
      if (node.name == "main" && info && info.parent && this.ctrl.ask(info.parent)?.kind == "crate") {
        this.symbolTable.insertFunction("exit", this.exitFunction)
      }
      // 处理函数体
      if (node.body) {
        this.visit(node.body, self);
        // TODO: not ready for this...
        // const retType = this.analyzeType(node.returnType)
        // const stmts = node.body.statements
        // const returnStmt = (stmt: ast.Statement) => stmt.kind == ast.ASTType.ExprStatement && stmt.expr
        // const returnExpr = stmts.length == 0 ? undefined : (returnStmt(stmts[stmts.length - 1]!) || undefined)
        // const endTypes = this.symbolTable.getEndTypes()
        //   .concat(node.body.expr ? [this.inferExprType(node.body.expr)] : [])
        //   .concat(returnExpr ? [this.inferExprType(returnExpr)] : [])
        // if (!isUnit(retType)) {
        //   if (node.body.expr === undefined && stmts.length == 0)
        //     this.reportError(`Expect return value, found none`)
        //   return
        // }
      }
    } finally {
      // 确保总是退出作用域
      this.ctrl.onFnPost(node)
      this.symbolTable.exitScope();
    }
  }

  onReturnExpr(node: ast.NodeByKind<ast.ASTType.ReturnExpr>, self: ast.Visitor<void>): void {
    this.ctrl.onReturnExprPre(node)
    ast.walk(node, self)
    this.ctrl.onReturnExprPost(node)
  }

  onBlock(node: ast.NodeByKind<ast.ASTType.BlockExpr>, self: ast.Visitor<void>): void {
    // 进入块作用域
    this.symbolTable.enterScope();
    this.ctrl.onBlockPre(node)

    try {
      // Pass 0: Register constant variables
      for (const item of node.statements)
        if (item.kind === ast.ASTType.ConstItem)
          this.visit(item, self)

      // Pre-scan pass 1: Register all struct types in statements
      for (const stmt of node.statements) {
        if (stmt.kind === ast.ASTType.StructItem) {
          this.registerStruct(stmt);
        }
      }

      // Pre-scan pass 2: Register all impl blocks
      for (const stmt of node.statements) {
        if (stmt.kind === ast.ASTType.InherentImpl) {
          this.registerImpl(stmt);
        }
      }

      // Pre-scan pass 3: Register all function signatures
      for (const stmt of node.statements) {
        if (stmt.kind === ast.ASTType.FnItem) {
          this.registerFunction(stmt);
        }
      }

      // Process all statements in order
      for (const stmt of node.statements)
        if (stmt.kind !== ast.ASTType.ConstItem)
          this.visit(stmt, self);

      // 处理块中的表达式
      if (node.expr) {
        this.visit(node.expr, self);
      }
    } finally {
      this.ctrl.onBlockPost(node)
      // 确保总是退出作用域
      this.symbolTable.exitScope();
    }
  }

  private typeCastable(dest: Type, src: Type): boolean {
    if (areTypesEqual(dest, src, this.symbolTable) || isNever(src))
      return true
    switch (src.kind) {
      case "refType":
        if (dest.kind != "refType")
          return false
        if (!src.mutable && dest.mutable)
          return false
        return this.typeCastable(dest.under, src.under)
      case "primitiveType":
        if (dest.kind != "primitiveType")
          return false
        if (src.name == dest.name)
          return true
        if (src.name == "integer" && ["never"].indexOf(dest.name) != -1)
          return true
        return false
    }
    return false
  }

  onLet(node: ast.NodeByKind<ast.ASTType.LetStatement>, self: ast.Visitor<void>): void {
    // 分析右侧表达式（如果存在）
    let inferredType: Type | undefined;
    if (node.expr) {
      this.visit(node.expr, self);
      // 推断表达式类型
      inferredType = this.inferExprType(node.expr);
    }

    // 分析变量类型，并记录是否产生新错误
    const errorCountBefore = this.errors.length;
    let varType = this.analyzeType(node.type);
    const hasTypeError = this.errors.length > errorCountBefore;

    // 如果变量声明中没有指定类型，使用推断的类型
    if (node.type.kind === ast.ASTType.UnitType && inferredType) {
      varType = inferredType;
    }

    // 如果声明了类型且有初始化表达式，检查类型是否匹配
    // 但如果类型分析时已经报错（如未知类型），则跳过类型匹配检查以避免级联错误
    if (node.type.kind !== ast.ASTType.UnitType && inferredType && !hasTypeError) {
      if (!this.typeCastable(varType, inferredType)) {
        this.reportError(
          `Type mismatch in variable declaration: expected ${this.typeToString(varType)}, found ${this.typeToString(inferredType)}`,
          node
        );
      }
    }

    // 检查数组类型声明与初始化的一致性
    if (varType.kind === "arrayType" && node.expr) {
      this.checkArrayDimensions(varType, node.expr, node);
    }
    
    // 处理模式匹配
    if (node.pattern.kind === ast.ASTType.IdentifierPattern) {
      // 创建变量符号
      const symbol: VariableSymbol = {
        UUID: genUUID(),
        name: node.pattern.name,
        type: { ...varType, owner: { kind: "left value", mutable: node.pattern.mutable } },
        _mutable: node.pattern.mutable, // 添加可变性信息
      };
      // this.log('...', node)
      
      // 插入符号表
      try {
        this.symbolTable.insertVariable(node.pattern.name, symbol);
      } catch (error) {
        if (error instanceof SemanticError) {
          this.reportError(error.message, node);
        } else {
          throw error;
        }
      }
    }
    
    this.visit(node.type, self)
    this.visit(node.pattern, self)
  }

  onConst(node: ast.NodeByKind<ast.ASTType.ConstItem>, self: ast.Visitor<void>): void {
    // Analyze constant value (if exists)
    let inferredType: Type | undefined;
    let constValue: Evaluated | undefined;

    if (node.val) {
      this.visit(node.val, self);
      // Infer expression type
      inferredType = this.inferExprType(node.val);
      // Evaluate constant expression
      constValue = evaluateExpr(node.val, this.symbolTable);
    }

    // Analyze constant type
    let constType = this.analyzeType(node.type);

    // If no type specified, use inferred type
    if (node.type.kind === ast.ASTType.UnitType && inferredType) {
      constType = inferredType;
    }

    // Create constant symbol with evaluated value
    const symbol: VariableSymbol = {
      UUID: genUUID(),
      name: node.name,
      type: { ...constType, owner: { kind: "left value", mutable: false } },
      _mutable: false,  // Constants are immutable
      evaluated: constValue  // Store compile-time evaluated result
    };

    // Insert into symbol table
    try {
      this.symbolTable.insertVariable(node.name, symbol);
    } catch (error) {
      if (error instanceof SemanticError) {
        this.reportError(error.message, node);
      } else {
        throw error;
      }
    }

    // Continue processing child nodes
    ast.walk(node, self);
  }

  onPathExpr(node: ast.NodeByKind<ast.ASTType.PathExpr>, self: ast.Visitor<void>): void {
    // this.log("PathExpr", node)
    // 简单路径（单个标识符）
    this.ctrl.onPathExprPre(node)
    if (node.segs.length === 1) {
      const name = node.segs[0]!;

      // 首先尝试查找变量
      const varSymbol = this.symbolTable.lookupVariable(name);
      if (varSymbol) {
        // 设置表达式的类型
        node.evaluated = {
          type: varSymbol.type,
          value: undefined // 运行时求值
        };
        // this.log(`PathExpr ${name} evaluated:`, node.evaluated.type);
        return;
      }

      // 然后尝试查找函数
      const funcSymbol = this.symbolTable.lookupFunction(name);
      if (funcSymbol) {
        // 这是一个函数路径，通常出现在函数调用中
        // PathExpr 本身不需要设置 evaluated，CallExpr 会处理
        return;
      }

      // 然后尝试查找类型
      const typeSymbol = this.symbolTable.lookupType(name);
      if (typeSymbol) {
        // 这是一个类型路径
        // 可能需要特殊处理
        return;
      }

      // 都没找到，报错
      this.reportError(`Undeclared identifier: ${name}`, node);
      return;
    }

    // 复杂路径处理
    // TODO: 实现复杂路径处理
  }

  onArrayExpr(node: ast.NodeByKind<ast.ASTType.ArrayExpr>, self: ast.Visitor<void>): void {
    // 处理数组中的每个元素
    for (const element of node.val) {
      this.visit(element, self);
    }
    const tps = node.val.map(this.inferExprType.bind(this))
    const t = (tps as (Type | null)[])
      .reduce((u, v) => u && v && this.unifyType(u, v))
    if (!t)
      this.reportError("Can't determine array type")
  }
  
  onRepeatArrayExpr(node: ast.NodeByKind<ast.ASTType.RepeatArrayExpr>, self: ast.Visitor<void>): void {
    // 处理重复数组的值和重复次数
    this.visit(node.val, self);
    this.visit(node.repeat, self);
  }
  
  onIndexExpr(node: ast.NodeByKind<ast.ASTType.IndexExpr>, self: ast.Visitor<void>): void {
    // 处理索引表达式的数组和索引
    this.visit(node.arr, self);
    this.visit(node.idx, self);

    // 推断索引表达式的类型（返回数组元素类型）
    const arrayType = this.inferExprType(node.arr);
    const idxType = this.inferExprType(node.idx)
    if (!this.typeCastable(usizeType(), idxType))
      this.reportError(`Array cannot be indexed by ${this.typeToString(idxType)}`)
    // this.log(`IndexExpr type inference:`, { arr: node.arr.kind, arrayType, hasEvaluated: !!node.arr.evaluated });
    if (arrayType.kind === "arrayType") {
      node.evaluated = {
        type: arrayType.type,
        value: undefined
      };
      // this.log(`Set IndexExpr evaluated type:`, node.evaluated.type);
    }
  }
  
  // 默认处理方法
  default(node: ast.ASTNode, self: ast.Visitor<void>): void {
    // this.log('Visitor: found unhandled node:', ast.ASTType[node.kind])
    // 遍历子节点
    ast.walk(node, self);
  }

  // 辅助方法：分析参数
  private analyzeParameter(param: ast.Param): void {
    const paramType = this.analyzeType(param.type);
    
    if (param.pattern.kind === ast.ASTType.IdentifierPattern) {
      const symbol: VariableSymbol = {
        UUID: genUUID(),
        name: param.pattern.name,
        type: { ...paramType, owner: { kind: "left value", mutable: param.pattern.mutable } },
        _mutable: param.pattern.mutable,
      };
      
      try {
        this.symbolTable.insertVariable(param.pattern.name, symbol);
      } catch (error) {
        if (error instanceof SemanticError) {
          this.reportError(error.message, param);
        } else {
          throw error;
        }
      }
    } else
      this.reportError("Only support identifer pattern for function parameters")
  }

  // 辅助方法：分析类型
  private analyzeType(type: ast.Type): Type {
    switch (type.kind) {
      case ast.ASTType.UnitType:
        return unitType();
      
      case ast.ASTType.TypePath:
        const typePath = type as ast.TypePath;
        const typeSymbol = this.symbolTable.lookupType(typePath.value);
        if (typeSymbol) {
          return typeSymbol
        } else {
          this.reportError(`Unknown type: ${typePath.value}`, type);
          // 返回默认类型
          return unitType();
        }
      
      case ast.ASTType.ArrayType:
        // 分析数组元素类型
        const elementType = this.analyzeType(type.type);
        
        // 访问数组大小表达式
        this.visit(type.expr, this);

        // 检查数组大小是否为常量表达式
        const sizeEvaluated = evaluateExpr(type.expr, this.symbolTable);
        if (!sizeEvaluated) {
          this.reportError("Array size must be a constant expression", type.expr);
        } else if (typeof sizeEvaluated.value !== 'number' || sizeEvaluated.value < 0) {
          this.reportError("Array size must be a non-negative integer", type.expr);
        }
        
        return {
          kind: "arrayType",
          type: elementType,
          size: sizeEvaluated?.value as number
        };

      case ast.ASTType.RefType:
        return {
          kind: "refType",
          under: this.analyzeType(type.type),
          mutable: type.mutable,
        }
      
      default:
        // @ts-ignore: 这里是为了处理 TypeScript 的类型检查问题
        this.reportError(`Unsupported type kind: ${ast.ASTType[type.kind]}`, type);
        return unitType();
    }
  }

  // 辅助方法：访问节点
  private visit<R = void>(node: ast.ASTNode, visitor: ast.Visitor<R>): R | undefined {
    return ast.visit(node, visitor);
  }

  // Helper method to infer the return type of a call expression
  // TODO: collapse with this.inferFuncType
  /* Deprecated
  private inferCallExprType(expr: ast.CallExpr): Type {
    // Check if this is a method call (value is FieldExpr)
    if (expr.value.kind === ast.ASTType.FieldExpr) {
      const fieldExpr = expr.value as ast.FieldExpr;
      const objectType = this.autoDeref(this.inferExprType(fieldExpr.object),
        tp => ["structType", "arrayType", "u32", "usize", "integer"].includes(tp.kind));
      const methodName = fieldExpr.field;

      // Look up the method in the struct's methods
      if (objectType.kind === "structType") {
        const structType = objectType as StructType;
        if (structType.methods && structType.methods.has(methodName)) {
          const methodSymbol = structType.methods.get(methodName)!;
          return methodSymbol.returnType;
        } else {
          this.reportError(`Unknown method '${methodName}' for struct type`, expr);
          return unitType();
        }
      } else if (objectType.kind == "arrayType" && methodName == "len") {
        const sz = objectType.size
        return usizeType()
      } else if (objectType.kind == "primitiveType" && ["u32", "usize", "integer"].includes(objectType.name) && methodName == "to_string") {
        return StringType()
      } else {
        this.reportError(`Cannot call method on non-struct type`, expr);
        return unitType();
      }
    }

    // Regular function call (value is PathExpr)
    if (expr.value.kind === ast.ASTType.PathExpr && expr.value.segs.length === 1) {
      const funcName = expr.value.segs[0]!;
      const funcSymbol = this.symbolTable.lookupFunction(funcName);
      if (funcSymbol) {
        return funcSymbol.returnType;
      } else {
        this.reportError(`Unknown function '${funcName}'`, expr);
        return unitType();
      }
    }
    if (expr.value.kind === ast.ASTType.PathExpr && expr.value.segs.length === 2) {
      const typeSymbol = this.symbolTable.lookupType(expr.value.segs[0]!)
      if (!typeSymbol) {
        this.reportError(`Unknown type ${expr.value.segs[0]} on path expr`)
        return unitType()
      }
      if (typeSymbol.kind != "structType") {
        this.reportError(`Expect ${expr.value.segs[0]} to be struct type, found ${typeSymbol.kind}`)
        return unitType()
      }
      const funcSymbol = typeSymbol.methods?.get(expr.value.segs[1]!)
      if (funcSymbol)
        return funcSymbol.returnType
      else {
        this.reportError(`Unknown field ${expr.value.segs.join("::")}`, expr)
        return unitType()
      }
    }

    // Fallback - report error for unsupported call expression
    this.reportError(`Cannot infer type for call expression`, expr);
    return unitType();
  }
  */

  private autoDeref(t: Type, test?: (tp: Type) => boolean): Type {
    while (t.kind == "refType" && (!test || !test(t))) {
      const refMutable = t.mutable
      // this.log("Derefing", t, "to", t.under)
      t = t.under
      if (t.owner !== undefined)
        throw Error(`Expected underlying type to be right-value type, found ${t}`)
      t = { ...t, owner: { kind: "left value", mutable: refMutable } }
    }
    return t
  }

  // private autoDerefArr(t: ast.IndexExpr) {
  //   return this.autoDeref(
  //     this.inferExprType(t.arr),
  //     x => x.kind == )
  // }

  // TODO: collapse with this.inferCallExprType
  private inferFuncType(node: ast.Expr): FunctionType | null {
    const symbol2type = (func: FunctionSymbol): FunctionType => ({
      kind: "functionType",
      params: func.params,
      returnType: func.returnType
    })
    switch (node.kind) {
      case ast.ASTType.PathExpr:
        if (node.segs.length == 2) {
          let now = this.symbolTable.lookupType(node.segs[0]!)
          if (!now || now.kind != "structType") return null
          const r = now.methods?.get(node.segs[1]!)
          return r ? symbol2type(r) : null
        } else if (node.segs.length == 1) {
          const func = this.symbolTable.lookupFunction(node.segs[0]!)
          return func ? symbol2type(func) : null
        } else 
          return null
      case ast.ASTType.FieldExpr:
        const objectType = this.autoDeref(this.inferExprType(node.object),
          tp => ["structType", "arrayType", "u32", "usize", "integer"].includes(tp.kind));
        const methodName = node.field;
        if (objectType.kind === "structType") {
          const structType = objectType as StructType;
          if (structType.methods && structType.methods.has(methodName)) {
            const methodSymbol = structType.methods.get(methodName)!;
            return symbol2type(methodSymbol)
          } else {
            this.reportError(`Unknown method '${methodName}' for struct type`, node);
            return null;
          }
        } else if (objectType.kind == "arrayType" && methodName == "len") {
          const sz = objectType.size
          return {
            kind: "functionType",
            params: [],
            returnType: usizeType(),
          }
        } else if (objectType.kind == "primitiveType" && ["u32", "usize", "integer"].includes(objectType.name) && methodName == "to_string") {
          return {
            kind: "functionType",
            params: [],
            returnType: StringType(),
          }
        } else {
          this.reportError(`Cannot call method on non-struct type`, node);
          return null
        }
    }
    return null
  }

  // 类型推断方法（可以访问符号表）
  private inferExprType(expr: ast.Expr): Type {
    // 如果表达式已经有 evaluated 信息，直接返回

    /**
     * TODO: make use of evaluated information and be lazy
    if (expr.evaluated?.type) {
      return expr.evaluated.type;
    }
    */

    switch (expr.kind) {
      case ast.ASTType.CallExpr:
        // Use the new inferCallExprType method
        // return this.inferCallExprType(expr);
        return this.inferFuncType(expr.value)?.returnType || unitType()

      case ast.ASTType.CastExpr:
        // 类型转换：返回目标类型
        return this.analyzeType(expr.targetType);

      case ast.ASTType.PathExpr:
        // 路径表达式：查找变量符号获取类型
        if (expr.segs.length === 1) {
          const name = expr.segs[0]!;
          const varSymbol = this.symbolTable.lookupVariable(name);
          if (varSymbol) {
            return varSymbol.type;
          }
        }
        // TODO: 处理复杂路径（如 mod::Type::method）
        return unitType();
      case ast.ASTType.IndexExpr:
        const inferred = this.inferExprType(expr.arr)
        const pre = this.autoDeref(inferred, t => t.kind === "arrayType")
        if (pre.kind !== "arrayType") {
          this.reportError(`Expected array type, found ${pre.kind}`, expr.arr)
          return unitType()
        }
        return pre?.owner !== undefined
          ? { ...pre.type, owner: { kind: "left value", mutable: pre.owner.mutable } }
          : pre.type

      case ast.ASTType.BlockExpr:
        return (this.ctrl.ask(expr) as CtrlBlock | CtrlFnBlock)?.type || unitType()

      case ast.ASTType.IfExpr:
        const t = this.inferExprType(expr.then)
        if (expr.else) {
          const et = this.inferExprType(expr.else)
          if (!this.sameTypeOrNever(t, et))
            this.reportError("Expect two if-branches have same type", expr)
          const merge = (a: Type, b: Type) => isNever(a) ? b : a
          return merge(t, et)
        }
        return t

      case ast.ASTType.BinaryExpr:
        return this.inferBinaryType(expr)

      case ast.ASTType.UnaryExpr:
        return this.inferUnaryType(expr)

      case ast.ASTType.BorrowExpr:
        return {
          kind: "refType",
          under: this.inferExprType(expr.expr),
          mutable: expr.mutable,
        }

      case ast.ASTType.FieldExpr:
        const lhs = expr.object
        const lhsType = this.autoDeref(this.inferExprType(lhs), isStruct)
        if (lhsType.kind != "structType") {
          this.reportError(`Expect ${lhsType} to be a struct`)
          return unitType()
        }
        if (!lhsType.fields.has(expr.field)) {
          this.reportError(`type of ${lhs} has no field ${expr.field}`)
          return unitType()
        }
        return { ...lhsType.fields.get(expr.field)!, owner: lhsType.owner }

      case ast.ASTType.StructExpr:
        // TODO: handle paths
        return this.symbolTable.lookupType(expr.path.segs[0]!) || unitType()
      
      case ast.ASTType.ReturnExpr:
        return neverType()

      case ast.ASTType.LoopExpr:
        const ctrl = this.ctrl.ask(expr) as (CtrlLoop | undefined)
        if (!ctrl) {
          throw new Error("Unexpected error: not visited by control analyzer")
          return unitType()
        }
        return ctrl.type
      case ast.ASTType.ArrayExpr:
        const tp = (expr.val.map(this.inferExprType.bind(this)) as (Type | null)[])
          .reduce((u, v) => u && v && this.unifyType(u, v))
        if (!tp) return unitType()
        return {
          kind: "arrayType",
          type: tp,
          size: expr.val.length,
        }
      case ast.ASTType.RepeatArrayExpr:
        const sz = this.evaluateExpr(expr.repeat)
        if (!sz || typeof sz.value !== 'number' || sz.value as number < 0) {
          this.reportError("Expect repeat time to be non-negative integer")
          return unitType()
        }
        return {
          kind: "arrayType",
          type: this.inferExprType(expr.val),
          size: sz.value as number,
        }

      default:
        // 其他情况使用原有的 inferType
        return inferType(expr);
    }
  }
  inferUnaryType(expr: ast.UnaryExpr): Type {
    switch (expr.operator) {
      case "-":
        return this.inferExprType(expr.operand);
      case "!":
        return boolType();
      case "*":
        const t = this.inferExprType(expr.operand)
        if (t.kind != "refType")
          return unitType()
        return { ...t.under, owner: { kind: "left value", mutable: t.mutable } }
      default:
        return unitType();
    }
  }

  private inferBinaryType(binary: ast.BinaryExpr): Type {
    // Comparison operators return bool type
    const comparisonOps = ["==", "!=", "<", ">", "<=", ">="];
    if (comparisonOps.includes(binary.operator)) {
      return boolType();
    }

    // Logical operators return bool type
    if (binary.operator === "&&" || binary.operator === "||") {
      return boolType();
    }

    // Arithmetic and bitwise operators: handle integer type specialization
    const leftType = this.inferExprType(binary.operand[0]!);
    const rightType = this.inferExprType(binary.operand[1]!);

    // If both are primitive types
    if (leftType.kind === "primitiveType" && rightType.kind === "primitiveType") {
      const leftName = leftType.name;
      const rightName = rightType.name;

      // integer + integer = integer
      if (leftName === "integer" && rightName === "integer") {
        return integerType();
      }

      // integer + <concrete type> = <concrete type>
      if (leftName === "integer" && rightName !== "integer") {
        return rightType;
      }

      // <concrete type> + integer = <concrete type>
      if (leftName !== "integer" && rightName === "integer") {
        return leftType;
      }

      // Both are concrete types: return left type (will be checked for compatibility elsewhere)
      return leftType;
    }

    // Fallback: return left operand type
    return leftType;
  }

  private sameTypeOrNever(a: Type, b: Type): boolean {
    if (isNever(a) || isNever(b)) return true
    return true
  }

  // Handle struct expression
  onStructExpr(node: ast.NodeByKind<ast.ASTType.StructExpr>, self: ast.Visitor<void>): void {
    // Get the struct type from the path
    if (node.path.segs.length === 1) {
      const typeName = node.path.segs[0]!;
      const typeSymbol = this.symbolTable.lookupType(typeName);

      if (typeSymbol && typeSymbol.kind === "structType") {
        // Set the evaluated type of this expression
        node.evaluated = {
          type: typeSymbol,
          value: undefined
        };

        // TODO: Type-check that all required fields are present
        // TODO: Type-check that field values match field types
      } else {
        this.reportError("Only struct can be constructed", node)
        return
      }

      const vis: string[] = []
      // Visit all field values
      for (const field of node.fields) {
        this.visit(field.value, self)
        if (vis.includes(field.name)) {
          this.reportError("Duplicated init field", node)
          return
        }
        vis.push(field.name)
        const t = typeSymbol.fields.get(field.name)
        if (!t || !this.typeCastable(t, this.inferExprType(field.value))) {
          this.reportError("Type error: struct field type mismatch", node)
          return
        }
      }
      if (typeSymbol.fields.size != node.fields.length)
        this.reportError("missing field in struct expr")
    }
  }

  // 添加到Visitor接口的映射
  onLiteralExpr = undefined;
  onCallExpr(node: ast.NodeByKind<ast.ASTType.CallExpr>, self: ast.Visitor<void>): void {
    // Special handling for method calls: don't visit the FieldExpr itself,
    // only visit the object to infer its type
    if (node.value.kind === ast.ASTType.FieldExpr) {
      const fieldExpr = node.value as ast.FieldExpr;
      this.visit(fieldExpr.object, self);
    } else {
      // Regular function call - visit the callee
      this.visit(node.value, self);
    }

    const tp = this.inferFuncType(node.value)
    if (!tp) {
      this.reportError("Function not found!", node)
      return
    }

    // Visit all arguments
    // for (const param of node.param) {
    //   this.visit(param, self);
    // }
    node.param.find((param, idx) => {
      this.visit(param, self)
      if (!tp.params[idx] || !this.typeCastable(tp.params[idx], this.inferExprType(param))) {
        this.reportError(`Function parameter type mismatch`, node)
        return true
      }
    })

    // Infer the return type and set it on the node
    const returnType = tp.returnType;
    node.evaluated = {
      type: returnType,
      value: undefined
    };
  }

  onFieldExpr(node: ast.NodeByKind<ast.ASTType.FieldExpr>, self: ast.Visitor<void>): void {
    // Visit the object
    this.visit(node.object, self);

    // Infer the type of field access
    const objectType = this.autoDeref(this.inferExprType(node.object), isStruct);
    if (objectType.kind === "structType") {
      const structType = objectType as StructType;

      // Look up field type
      if (structType.fields.has(node.field)) {
        const fieldType = structType.fields.get(node.field)!;
        node.evaluated = {
          type: fieldType,
          value: undefined
        };
      } else {
        this.reportError(`Unknown field '${node.field}' for struct type`, node);
      }
    } else {
      this.reportError(`Cannot access field on non-struct type`, node);
    }
  }

  onUnaryExpr(node: ast.NodeByKind<ast.ASTType.UnaryExpr>, self: ast.Visitor<void>): void {
    switch (node.operator) {
      case "*":
        const t = this.inferExprType(node.operand)
        if (t.kind != "refType")
          this.reportError(`Operator* expects reference type`)
        break
      default:
    }
  }
  onBinaryExpr(node: ast.NodeByKind<ast.ASTType.BinaryExpr>, self: ast.Visitor<void>): void {
    // 先处理子节点，确保类型信息已经推断
    ast.walk(node, self);

    // 处理赋值表达式
    if (["=", "+=", "-=", "*=", "/=", "<<=", ">>=", "&=", "%=", "^=", "|="].includes(node.operator)) {
      // TODO: Combine the two checks
      // 检查左值是否可变
      this.checkMutability(node.operand[0]);
      // 检查类型匹配
      this.checkAssignmentTypes(node.operand[0], node.operand[1]);
    } else if (["+", "-", "*", "/", "<", ">"].indexOf(node.operator) != -1) {
      const lhsT = this.inferExprType(node.operand[0])
      const rhsT = this.inferExprType(node.operand[1])
      // TODO: this logic is wrong
      if (lhsT.kind != "primitiveType" || rhsT.kind != "primitiveType" || (lhsT.name != rhsT.name && lhsT.name != "integer" && rhsT.name != "integer"))
        this.reportError(`Unmatched type for operator ${node.operator}`)
    } else if (["==", "!="].includes(node.operator)) {
      const lhs = this.inferExprType(node.operand[0])
      const rhs = this.inferExprType(node.operand[1])
      if (!this.typeCastable(lhs, rhs) && !this.typeCastable(rhs, lhs))
        this.reportError(`Cannot compare between ${this.typeToString(lhs)} and ${this.typeToString(rhs)}`)
    }
  }
  
  // 辅助方法：检查表达式是否可变
  private checkMutability(expr: ast.Expr): void {
    const inferred = this.inferExprType(expr)
    const chk = inferred.owner
    if (!chk || !chk.mutable) {
      this.reportError(`Cannot assign to immutable expression '${expr}'`, expr);
      return
    }

    /**
     * Deprecated. Now we are using inferred type, which records whether it's
     * left-value or right-value type, to check mutability.
     *******
    // 对于索引表达式 arr[index]，需要检查 arr 是否可变
    if (expr.kind === ast.ASTType.IndexExpr) {
      const indexExpr = expr as ast.IndexExpr;
      // 检查数组表达式是否可变
      // this.checkArrayMutability(indexExpr.arr);
      this.checkMutability(indexExpr.arr)
      return;
    }
    
    // 对于路径表达式（变量），检查变量是否声明为可变
    if (expr.kind === ast.ASTType.PathExpr) {
      const pathExpr = expr as ast.PathExpr;
      // 简单路径（单个标识符）
      if (pathExpr.segs.length === 1) {
        const name = pathExpr.segs[0]!;
        const varSymbol = this.symbolTable.lookupVariable(name);
        if (varSymbol) {
          console.log(varSymbol.type)
          // 检查变量是否声明为可变
          if (!varSymbol.type.owner?.mutable) {
            this.reportError(`Cannot assign to immutable variable '${name}'`, expr);
          }
        } else {
          this.reportError(`Undeclared variable '${name}'`, expr);
        }
      }
      return;
    }
    
    // 其他情况默认为不可变
    this.reportError("Cannot assign to this expression", expr);
    */
  }

  log = (...args: any[]) => {
    const inspected = args.map(a => util.inspect(a, { depth: null, colors: true }))
    console.log(...inspected)
  }
  
  // 辅助方法：检查数组表达式是否可变
  private checkArrayMutability(expr: ast.Expr): void {
    // this.log(`Hello`, expr)
    // 对于路径表达式（变量），检查变量是否声明为可变
    if (expr.kind === ast.ASTType.PathExpr) {
      const pathExpr = expr as ast.PathExpr;
      // 简单路径（单个标识符）
      if (pathExpr.segs.length === 1) {
        const name = pathExpr.segs[0]!;
        const varSymbol = this.symbolTable.lookupVariable(name);
        if (varSymbol) {
          // 检查变量是否声明为可变
          if (!varSymbol._mutable) {
            this.reportError(`Cannot assign to immutable variable '${name}'`, expr);
          }
        } else {
          this.reportError(`Undeclared variable '${name}'`, expr);
        }
      }
      return;
    }
    
    // 其他情况默认为不可变
    this.reportError("Cannot assign to this expression", expr);
  }
  
  // 辅助方法：检查赋值语句的类型匹配
  private checkAssignmentTypes(left: ast.Expr, right: ast.Expr): void {
    // 推断左右表达式的类型
    const leftType = this.inferExprType(left);
    const rightType = this.inferExprType(right);

    // Debug logging
    // this.log(`Assignment type check:`, { left: left.kind, leftType, right: right.kind, rightType });

    // 检查类型是否匹配
    if (!areTypesEqual(leftType, rightType, this.symbolTable)) {
      this.reportError(
        `Type mismatch in assignment: expected ${this.typeToString(leftType)}, found ${this.typeToString(rightType)}`,
        left
      );
    }
  }
  
  // 辅助方法：将类型转换为字符串表示
  private typeToString(type: Type): string {
    switch (type.kind) {
      case "primitiveType":
        return type.name;
      case "arrayType":
        const elementType = this.typeToString(type.type);
        const sizeEval = type.size
        return `[${elementType}; ${sizeEval}]`;
        // if (sizeEval && typeof sizeEval.value === 'number') {
        //   return `[${elementType}; ${sizeEval.value}]`;
        // } else {
        //   return `[${elementType}; ?]`;
        // }
      case "structType":
        // Find the struct name from symbol table
        const structType = type as StructType;
        const fieldNames = Array.from(structType.fields.keys());
        return `struct { ${fieldNames.join(", ")} }`;
      default:
        return JSON.stringify(type);
    }
  }
  // 处理表达式语句
  onExprStatement(node: ast.NodeByKind<ast.ASTType.ExprStatement>, self: ast.Visitor<void>): void {
    // 继续处理子节点
    ast.walk(node, self);
  }
  
  // 辅助方法：检查数组维度匹配
  private checkArrayDimensions(declaredType: import("./info").Type, initExpr: ast.Expr, node: ast.ASTNode): void {
    // 检查声明的数组大小
    if (declaredType.kind === "arrayType") {
      const declaredSize = declaredType.size

      // 检查初始化表达式的类型
      if (initExpr.kind === ast.ASTType.ArrayExpr) {
        // 普通数组初始化 [1, 2, 3]
        const actualSize = initExpr.val.length;
        if (actualSize !== declaredSize) {
          this.reportError(
            `Array size mismatch: declared size is ${declaredSize}, but initialized with ${actualSize} elements`,
            node
          );
          return;
        }

        // 递归检查多维数组的元素
        // 检查每个元素是否与声明的元素类型匹配
        for (let i = 0; i < initExpr.val.length; i++) {
          const element = initExpr.val[i]!;
          this.checkArrayDimensions(declaredType.type, element, node);
        }
      } else if (initExpr.kind === ast.ASTType.RepeatArrayExpr) {
        // 重复数组初始化 [1; 3]
        const repeatEval = evaluateExpr(initExpr.repeat, this.symbolTable);
        if (repeatEval && typeof repeatEval.value === 'number') {
          const actualSize = repeatEval.value;
          if (actualSize !== declaredSize) {
            this.reportError(
              `Array size mismatch: declared size is ${declaredSize}, but initialized with ${actualSize} elements`,
              node
            );
            return;
          }

          // 递归检查重复数组的元素
          this.checkArrayDimensions(declaredType.type, initExpr.val, node);
        }
      }
    }
  }

  // 处理 if 表达式
  onIf(node: ast.NodeByKind<ast.ASTType.IfExpr>, self: ast.Visitor<void>): void {
    // 分析条件表达式
    this.visit(node.cond, self);

    // 检查条件表达式的类型是否为 bool
    const condType = this.inferExprType(node.cond);
    if (condType.kind !== "primitiveType" || condType.name !== "bool") {
      this.reportError(
        `If condition must be of type bool, found ${this.typeToString(condType)}`,
        node.cond
      );
    }

    // 分析 then 分支
    this.visit(node.then, self);

    // 分析 else 分支（如果存在）
    if (node.else) {
      this.visit(node.else, self);
    }
  }

  // Handle while expression
  onWhile(node: ast.NodeByKind<ast.ASTType.WhileExpr>, self: ast.Visitor<void>): void {
    // Analyze condition expression
    this.visit(node.cond, self);

    // Check if condition expression is of type bool
    const condType = this.inferExprType(node.cond);
    if (condType.kind !== "primitiveType" || condType.name !== "bool") {
      this.reportError(
        `While condition must be of type bool, found ${this.typeToString(condType)}`,
        node.cond
      );
    }

    // Enter while loop context
    this.loopDepth++;
    const prevInLoop = this.inLoopContext;
    this.inLoopContext = false; // while does NOT support break with value

    try {
      // Analyze loop body
      this.visit(node.body, self);
    } finally {
      // Always restore state
      this.loopDepth--;
      this.inLoopContext = prevInLoop;
    }
  }

  // Handle loop expression
  onLoop(node: ast.NodeByKind<ast.ASTType.LoopExpr>, self: ast.Visitor<void>): void {
    // Enter loop context
    this.loopDepth++;
    const prevInLoop = this.inLoopContext;
    this.inLoopContext = true; // loop supports break with value

    try {
      this.ctrl.onLoopPre(node)
      // Analyze loop body
      this.visit(node.body, self);
    } finally {
      this.ctrl.onLoopPost(node)
      // Always restore state
      this.loopDepth--;
      this.inLoopContext = prevInLoop;
    }
  }

  // Handle break expression
  onBreakExpr(node: ast.NodeByKind<ast.ASTType.BreakExpr>, self: ast.Visitor<void>): void {
    // Check 1: is break inside a loop?
    if (this.loopDepth === 0) {
      this.reportError("break statement outside of loop", node);
      return; // Already an error, no need to continue checking
    }

    // Check 2: if break has a value
    if (node.expr) {
      // break with value, but not in loop (in while instead)
      if (!this.inLoopContext) {
        this.reportError("break with value is only allowed in loop expressions", node);
      }
      // Visit the break expression
      this.visit(node.expr, self);
      this.ctrl.onBreakPost(node)
    }
  }
}