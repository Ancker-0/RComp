import { KeywordToken, Token, TokenGeneric } from "../lexer/token"

export enum ASTType {
    Statement,
    Fn,
    FnParam,

    IdentifierPattern,
    WildcardPattern,
    ReferencePattern,

    // Type,
    UnitType,
    TypePath,
    ArrayType,

    BlockExpr,
    Let,
    LiteralExpr,
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

export type Item = FuncItem

export type Statement = EmptyStatement | Item | LetStatement

export type Expr = LiteralExpr  // TODO

export interface LiteralExpr extends ASTBase {
    kind: ASTType.LiteralExpr
    type: "char" | "string" | "rstring" | "cstring" | "rcstring" | "integer" | "true" | "false"
    value: string
}

export interface EmptyStatement extends ASTBase {
    kind: ASTType.EmptyStatement
}

export interface LetStatement extends ASTBase {
    kind: ASTType.Let
    pattern: Pattern
    type: Type
    expr?: Expr
}

export interface FuncItem extends ASTBase {
    kind: ASTType.Fn
    name: string
    quantifier: ("const")[]
    params: Param[]
    returnType: Type
    body?: BlockExpr
}

export interface BlockExpr extends ASTBase {
    kind: ASTType.BlockExpr
}
