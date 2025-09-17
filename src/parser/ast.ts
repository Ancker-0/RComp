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

export interface FuncItem extends ASTBase {
    kind: ASTType.Fn
    name: string
    quantifier: ("const")[]
    params: Param[]
    returnType: Type
    body: BlockExpr
}

export interface BlockExpr extends ASTBase {
    kind: ASTType.BlockExpr
}
