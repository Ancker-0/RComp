import { Type, unitType, i32Type, boolType } from "./info";
import * as ast from "../parser/ast";

// 类型推断函数
export function inferType(expr: ast.Expr): Type {
  // 如果表达式已经有推断的类型信息，直接返回
  if (expr.evaluated?.type) {
    return expr.evaluated.type;
  }

  switch (expr.kind) {
    case ast.ASTType.LiteralExpr:
      return inferLiteralType(expr);

    case ast.ASTType.PathExpr:
      // 如果没有 evaluated 信息，返回 unit 类型
      // (通常在语义分析阶段会设置 evaluated)
      return unitType();

    case ast.ASTType.BinaryExpr:
      return inferBinaryType(expr);

    case ast.ASTType.UnaryExpr:
      return inferUnaryType(expr);

    case ast.ASTType.CallExpr:
      // TODO: 实现函数调用的类型推断
      return unitType();

    case ast.ASTType.ArrayExpr:
      return inferArrayType(expr);

    case ast.ASTType.RepeatArrayExpr:
      return inferRepeatArrayType(expr);

    case ast.ASTType.IndexExpr:
      return inferIndexType(expr);

    case ast.ASTType.CastExpr:
      // TODO: 需要访问符号表，将在 SemanticAnalyzer 中处理
      return unitType();

    default:
      // 默认返回 unit 类型
      return unitType();
  }
}

// 推断字面量类型
function inferLiteralType(literal: ast.LiteralExpr): Type {
  switch (literal.type) {
    case "integer":
      return i32Type();
    
    case "bool":
      return boolType();
    
    case "char":
      return {
        kind: "primitiveType",
        name: "char"
      };
    
    case "string":
    case "rstring":
    case "cstring":
    case "rcstring":
      return {
        kind: "primitiveType",
        name: "str"
      };
    
    default:
      return unitType();
  }
}

// 推断数组表达式类型
function inferArrayType(array: ast.ArrayExpr): Type {
  if (array.val.length === 0) {
    // 空数组，返回 unit 类型
    return unitType();
  }

  // 获取第一个元素的类型作为数组元素类型
  const elementType = inferType(array.val[0]!);

  // 创建一个表示数组大小的字面量表达式
  const sizeExpr: ast.LiteralExpr = {
    kind: ast.ASTType.LiteralExpr,
    type: "integer",
    value: array.val.length.toString(),
    evaluated: {
      type: i32Type(),
      value: array.val.length
    }
  };

  // 返回数组类型
  return {
    kind: "arrayType",
    type: elementType,
    expr: sizeExpr
  };
}

// 推断重复数组表达式类型
function inferRepeatArrayType(repeat: ast.RepeatArrayExpr): Type {
  // 重复数组的类型由其值表达式的类型和重复次数决定
  return {
    kind: "arrayType",
    type: inferType(repeat.val),
    expr: repeat.repeat  // 重复次数表达式表示数组大小
  };
}

// 推断索引表达式类型
function inferIndexType(index: ast.IndexExpr): Type {
  // 索引表达式的类型是数组元素的类型
  const arrayType = inferType(index.arr);
  
  // 如果数组类型是数组类型，则返回其元素类型
  if (arrayType.kind === "arrayType") {
    return arrayType.type;
  }
  
  // 否则返回 unit 类型
  return unitType();
}

// 推断二元表达式类型
function inferBinaryType(binary: ast.BinaryExpr): Type {
  // 比较运算符返回 bool 类型
  const comparisonOps = ["==", "!=", "<", ">", "<=", ">="];
  if (comparisonOps.includes(binary.operator)) {
    return boolType();
  }

  // 逻辑运算符返回 bool 类型
  if (binary.operator === "&&" || binary.operator === "||") {
    return boolType();
  }

  // 算术和位运算符返回操作数类型
  // TODO: 更精确的类型推断（考虑类型提升等）
  return inferType(binary.operand[0]!);
}

// 推断一元表达式类型
function inferUnaryType(unary: ast.UnaryExpr): Type {
  switch (unary.operator) {
    case "-":
      // 负号操作符通常返回与操作数相同的类型
      return inferType(unary.operand);
    
    case "!":
      // 逻辑非操作符返回 bool 类型
      return boolType();
    
    default:
      return unitType();
  }
}