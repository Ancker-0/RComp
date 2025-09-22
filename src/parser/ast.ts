import { KeywordToken, Operator, OperatorToken, Token, TokenGeneric, TokenType } from "../lexer/token"

export enum ASTType {
    Statement,
    ConstItem,
    FnItem,
    FnParam,

    IdentifierPattern,
    WildcardPattern,
    ReferencePattern,

    // Type,
    UnitType,
    TypePath,
    ArrayType,

    BlockExpr,
    LiteralExpr,
    CallExpr,
    PathExpr,
    BinaryExpr,
    UnaryExpr,
    ArrayExpr,
    RepeatArrayExpr,
    IndexExpr,

    LetStatement,
    ExprStatement,
    EmptyStatement,
}

export interface ASTBase {
    kind: ASTType
    src?: {
        tokens: Token[]
        start: number
        end: number
    }
}

export interface Param extends ASTBase {
    kind: ASTType.FnParam
    pattern: Pattern
    type: Type
}

export type Pattern = IdentifierPattern | WildcardPattern | ReferencePattern

export interface IdentifierPattern extends ASTBase {
    kind: ASTType.IdentifierPattern
    name: string
}

export interface WildcardPattern extends ASTBase {
    kind: ASTType.WildcardPattern
}

export interface ReferencePattern extends ASTBase {
    kind: ASTType.ReferencePattern
}

export type Type = UnitType | TypePath | ArrayType
export interface UnitType extends ASTBase {
    kind: ASTType.UnitType
}
export const unitType: UnitType = { kind: ASTType.UnitType }
export interface TypePath extends ASTBase {
    kind: ASTType.TypePath
}
export interface ArrayType extends ASTBase {
    kind: ASTType.ArrayType
    type: Type
    expr: Expr
}

export type Statement = EmptyStatement | Item | LetStatement | ExprStatement

export type Expr = LiteralExpr | CallExpr | UnaryExpr | BinaryExpr | PathExpr | ArrayExpr | RepeatArrayExpr | IndexExpr
export interface CallExpr extends ASTBase {
    kind: ASTType.CallExpr
    value: Expr
    param: Expr[]
}
export interface LiteralExpr extends ASTBase {
    kind: ASTType.LiteralExpr
    type: "char" | "string" | "rstring" | "cstring" | "rcstring" | "integer" | "bool"
    value: string
}
export interface UnaryExpr extends ASTBase {
    kind: ASTType.UnaryExpr
    operator: Operator
    operand: Expr
    position: "prefix" | "postfix"
}
export interface BinaryExpr extends ASTBase {
    kind: ASTType.BinaryExpr
    operator: Operator
    operand: [Expr, Expr]
}
export interface PathExpr extends ASTBase {
    kind: ASTType.PathExpr
    segs: string[]
}
export interface ArrayExpr extends ASTBase {
    kind: ASTType.ArrayExpr
    val: Expr[]
}
export interface RepeatArrayExpr extends ASTBase {
    kind: ASTType.RepeatArrayExpr
    val: Expr
    repeat: Expr
}
export interface IndexExpr extends ASTBase {
    kind: ASTType.IndexExpr
    arr: Expr
    idx: Expr
}

export interface EmptyStatement extends ASTBase {
    kind: ASTType.EmptyStatement
}

export interface LetStatement extends ASTBase {
    kind: ASTType.LetStatement
    pattern: Pattern
    type: Type
    expr?: Expr
}

export interface ExprStatement extends ASTBase {
    kind: ASTType.ExprStatement
    expr: Expr
}

export type Item = FuncItem | ConstItem
export interface FuncItem extends ASTBase {
    kind: ASTType.FnItem
    name: string
    quantifier: ("const")[]
    params: Param[]
    returnType: Type
    body?: BlockExpr
}
export interface ConstItem extends ASTBase {
    kind: ASTType.ConstItem
    name: string
    type: Type
    val?: Expr
}

export interface BlockExpr extends ASTBase {
    kind: ASTType.BlockExpr
}
