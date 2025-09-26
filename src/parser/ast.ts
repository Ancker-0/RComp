import { KeywordToken, Operator, OperatorToken, Token, TokenGeneric, TokenType } from "../lexer/token"

export enum ASTType {
    Statement,
    ConstItem,
    FnItem,
    FnParam,
    StructItem,
    StructField,
    Trait,
    InherentImpl,
    TraitImpl,

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
    LoopExpr,
    BreakExpr,

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
export const unitType: () => UnitType = () => ({ kind: ASTType.UnitType })
export interface TypePath extends ASTBase {
    kind: ASTType.TypePath
}
export interface ArrayType extends ASTBase {
    kind: ASTType.ArrayType
    type: Type
    expr: Expr
}

export type Statement = EmptyStatement | Item | LetStatement | ExprStatement

export type Expr = LiteralExpr | CallExpr | UnaryExpr | BinaryExpr | PathExpr | ArrayExpr | RepeatArrayExpr | IndexExpr | LoopExpr | BreakExpr
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
export interface LoopExpr extends ASTBase {
    kind: ASTType.LoopExpr
    body: BlockExpr
}
export interface BreakExpr extends ASTBase {
    kind: ASTType.BreakExpr
    expr?: Expr
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

export type Item = FuncItem | ConstItem | StructItem | Trait | Impl
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
export interface StructItem extends ASTBase {
    kind: ASTType.StructItem
    name: string
    fields: StructField[]
}
export interface StructField extends ASTBase {
    kind: ASTType.StructField
    name: string
    type: Type
}

export interface BlockExpr extends ASTBase {
    kind: ASTType.BlockExpr
}

export interface Trait extends ASTBase {
    kind: ASTType.Trait
    fn: FuncItem[]
    const: ConstItem[]
}

export type Impl = InherentImpl | TraitImpl
export interface InherentImpl extends ASTBase {
    kind: ASTType.InherentImpl
    type: TypePath
    fn: FuncItem[]
    const: ConstItem[]
}
export interface TraitImpl extends ASTBase {
    kind: ASTType.TraitImpl
    type: TypePath
    name: string
    fn: FuncItem[]
    const: ConstItem[]
}

