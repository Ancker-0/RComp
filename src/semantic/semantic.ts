import { SymbolTableImpl, SemanticError, VariableSymbol, TypeSymbol, Type, i32Type, boolType, unitType, areTypesEqual } from "./info";
import { genUUID } from "./util";
import * as ast from "../parser/ast";
import { inferType } from "./type-infer";
import { evaluateExpr } from "./const-eval";
import util from 'util';

// 语义分析结果
export interface SemanticAnalysisResult {
  errors: SemanticError[];
}

// 语义分析器类
export class SemanticAnalyzer implements ast.Visitor<void> {
  private symbolTable: SymbolTableImpl;
  private errors: SemanticError[] = [];

  constructor() {
    this.symbolTable = new SymbolTableImpl();
  }

  // 分析整个 crate
  analyze(crate: ast.Crate): SemanticAnalysisResult {
    this.visit(crate, this);
    return {
      errors: this.errors
    };
  }

  // 报告错误
  private reportError(message: string, node?: ast.ASTNode): void {
    const error = new SemanticError(message, node);
    this.errors.push(error);
  }

  // 访问者模式实现
  onCrate(node: ast.NodeByKind<ast.ASTType.Crate>, self: ast.Visitor<void>): void {
    // 遍历所有项
    for (const item of node.items) {
      this.visit(item, self);
    }
  }

  onFn(node: ast.NodeByKind<ast.ASTType.FnItem>, self: ast.Visitor<void>): void {
    // 进入函数作用域
    this.symbolTable.enterScope();
    
    try {
      // 处理函数参数
      for (const param of node.params) {
        this.analyzeParameter(param);
      }
      
      // 处理函数体
      if (node.body) {
        this.visit(node.body, self);
      }
    } finally {
      // 确保总是退出作用域
      this.symbolTable.exitScope();
    }
  }

  onBlock(node: ast.NodeByKind<ast.ASTType.BlockExpr>, self: ast.Visitor<void>): void {
    // 进入块作用域
    this.symbolTable.enterScope();
    
    try {
      // 处理块中的语句
      for (const stmt of node.statements) {
        this.visit(stmt, self);
      }
      
      // 处理块中的表达式
      if (node.expr) {
        this.visit(node.expr, self);
      }
    } finally {
      // 确保总是退出作用域
      this.symbolTable.exitScope();
    }
  }

  onLet(node: ast.NodeByKind<ast.ASTType.LetStatement>, self: ast.Visitor<void>): void {
    // 分析右侧表达式（如果存在）
    let inferredType: Type | undefined;
    if (node.expr) {
      this.visit(node.expr, self);
      // 推断表达式类型
      inferredType = inferType(node.expr);
    }
    
    // 分析变量类型
    let varType = this.analyzeType(node.type);

    // 如果变量声明中没有指定类型，使用推断的类型
    if (node.type.kind === ast.ASTType.UnitType && inferredType) {
      varType = inferredType;
    }

    // 如果声明了类型且有初始化表达式，检查类型是否匹配
    if (node.type.kind !== ast.ASTType.UnitType && inferredType) {
      if (!areTypesEqual(varType, inferredType)) {
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
        type: varType,
        mutable: node.pattern.mutable, // 添加可变性信息
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
    
    // 继续处理子节点
    ast.walk(node, self);
  }

  onConst(node: ast.NodeByKind<ast.ASTType.ConstItem>, self: ast.Visitor<void>): void {
    // 分析常量值（如果存在）
    let inferredType: Type | undefined;
    if (node.val) {
      this.visit(node.val, self);
      // 推断表达式类型
      inferredType = inferType(node.val);
    }
    
    // 分析常量类型
    let constType = this.analyzeType(node.type);
    
    // 如果常量声明中没有指定类型，使用推断的类型
    if (node.type.kind === ast.ASTType.UnitType && inferredType) {
      constType = inferredType;
    }
    
    // 创建常量符号
    const symbol: VariableSymbol = {
      UUID: genUUID(),
      name: node.name,
      type: constType,
      mutable: false  // 常量默认不可变
    };
    
    // 插入符号表
    try {
      this.symbolTable.insertVariable(node.name, symbol);
    } catch (error) {
      if (error instanceof SemanticError) {
        this.reportError(error.message, node);
      } else {
        throw error;
      }
    }
    
    // 继续处理子节点
    ast.walk(node, self);
  }

  onPathExpr(node: ast.NodeByKind<ast.ASTType.PathExpr>, self: ast.Visitor<void>): void {
    // 简单路径（单个标识符）
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
    const arrayType = inferType(node.arr);
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
        type: paramType,
        mutable: param.pattern.mutable,
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
    }
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
          return typeSymbol.type;
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
        const sizeEvaluated = evaluateExpr(type.expr);
        if (!sizeEvaluated) {
          this.reportError("Array size must be a constant expression", type.expr);
        } else if (typeof sizeEvaluated.value !== 'number' || sizeEvaluated.value < 0) {
          this.reportError("Array size must be a non-negative integer", type.expr);
        }
        
        return {
          kind: "arrayType",
          type: elementType,
          expr: type.expr
        };
      
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
  
  // 添加到Visitor接口的映射
  onLiteralExpr = undefined;
  onCallExpr = undefined;
  onUnaryExpr = undefined;
  onBinaryExpr(node: ast.NodeByKind<ast.ASTType.BinaryExpr>, self: ast.Visitor<void>): void {
    // 先处理子节点，确保类型信息已经推断
    ast.walk(node, self);

    // 处理赋值表达式
    if (node.operator === "=") {
      // 检查左值是否可变
      this.checkMutability(node.operand[0]);

      // 检查类型匹配
      this.checkAssignmentTypes(node.operand[0], node.operand[1]);
    }
  }
  
  // 辅助方法：检查表达式是否可变
  private checkMutability(expr: ast.Expr): void {
    // 对于索引表达式 arr[index]，需要检查 arr 是否可变
    if (expr.kind === ast.ASTType.IndexExpr) {
      const indexExpr = expr as ast.IndexExpr;
      // 检查数组表达式是否可变
      this.checkArrayMutability(indexExpr.arr);
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
          // 检查变量是否声明为可变
          if (!varSymbol.mutable) {
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
          if (!varSymbol.mutable) {
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
    const leftType = inferType(left);
    const rightType = inferType(right);

    // Debug logging
    // this.log(`Assignment type check:`, { left: left.kind, leftType, right: right.kind, rightType });

    // 检查类型是否匹配
    if (!areTypesEqual(leftType, rightType)) {
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
        const sizeEval = evaluateExpr(type.expr);
        if (sizeEval && typeof sizeEval.value === 'number') {
          return `[${elementType}; ${sizeEval.value}]`;
        } else {
          return `[${elementType}; ?]`;
        }
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
      const declaredSizeEval = evaluateExpr(declaredType.expr);
      if (declaredSizeEval && typeof declaredSizeEval.value === 'number') {
        const declaredSize = declaredSizeEval.value;
        
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
          const repeatEval = evaluateExpr(initExpr.repeat);
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
  }
}