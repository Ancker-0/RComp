import { KeywordToken, Token, TokenGeneric } from "../lexer/token"

export enum ASTType {
    Statement,
    Fn,
    FnParam,
    IdentifierPattern,
    WildcardPattern,
    ReferencePattern,
    Type,
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

export interface Type extends ASTBase {
    kind: ASTType.Type
    value: any
}

export const unitType: Type = {
    kind: ASTType.Type,
    value: "()"
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
