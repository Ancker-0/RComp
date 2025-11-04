import { KeywordToken, Operator, OperatorToken, Token, TokenGeneric, TokenType } from "../lexer/token"
import { Evaluated } from "../semantic/const-eval"

export enum ASTType {
    Crate,

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
    RefType,

    BorrowExpr,
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
    WhileExpr,
    IfExpr,
    BreakExpr,
    ReturnExpr,
    AssignExpr,
    CastExpr,
    StructExpr,
    FieldExpr,

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

export interface Crate extends ASTBase {
    kind: ASTType.Crate
    items: Item[]
}

export interface Param extends ASTBase {
    kind: ASTType.FnParam
    pattern: Pattern
    type: Type
}

export type Pattern = IdentifierPattern | /* WildcardPattern |*/  ReferencePattern

export interface IdentifierPattern extends ASTBase {
    kind: ASTType.IdentifierPattern
    name: string
    mutable: boolean,
    ref: boolean,
}

// export interface WildcardPattern extends ASTBase {
//     kind: ASTType.WildcardPattern
// }

export interface ReferencePattern extends ASTBase {
    kind: ASTType.ReferencePattern
    mutable: boolean
    ref: 1 | 2
}

export type Type = UnitType | TypePath | ArrayType | RefType
export interface UnitType extends ASTBase {
    kind: ASTType.UnitType
}
export const unitType: () => UnitType = () => ({ kind: ASTType.UnitType })
export interface TypePath extends ASTBase {
    kind: ASTType.TypePath
    value: string
}
export interface ArrayType extends ASTBase {
    kind: ASTType.ArrayType
    type: Type
    expr: Expr
}
export interface RefType extends ASTBase {
    kind: ASTType.RefType
    type: Type
    mutable: boolean
}

export type Statement = EmptyStatement | Item | LetStatement | ExprStatement

export type Expr = LiteralExpr | CallExpr | UnaryExpr | BinaryExpr | PathExpr | ArrayExpr | RepeatArrayExpr | IndexExpr | LoopExpr | WhileExpr | IfExpr | BreakExpr | ReturnExpr | CastExpr | StructExpr | FieldExpr
                   | BlockExpr | BorrowExpr
export interface ExprBase extends ASTBase {
    evaluated?: Evaluated
}
export interface CallExpr extends ExprBase {
    kind: ASTType.CallExpr
    value: Expr
    param: Expr[]
}
export interface LiteralExpr extends ExprBase {
    kind: ASTType.LiteralExpr
    type: "char" | "string" | "rstring" | "cstring" | "rcstring" | "integer" | "bool"
    value: string
    suffix?: string  // For integer literals: i32, u32, usize, isize, etc.
}
export interface UnaryExpr extends ExprBase {
    kind: ASTType.UnaryExpr
    operator: Operator
    operand: Expr
    position: "prefix" | "postfix"
}
export interface BinaryExpr extends ExprBase {
    kind: ASTType.BinaryExpr
    operator: Operator
    operand: [Expr, Expr]
}
export interface PathExpr extends ExprBase {
    kind: ASTType.PathExpr
    segs: string[]
}
export interface ArrayExpr extends ExprBase {
    kind: ASTType.ArrayExpr
    val: Expr[]
}
export interface RepeatArrayExpr extends ExprBase {
    kind: ASTType.RepeatArrayExpr
    val: Expr
    repeat: Expr
}
export interface IndexExpr extends ExprBase {
    kind: ASTType.IndexExpr
    arr: Expr
    idx: Expr
}
export interface LoopExpr extends ExprBase {
    kind: ASTType.LoopExpr
    body: BlockExpr
}
export interface WhileExpr extends ExprBase {
    kind: ASTType.WhileExpr
    cond: Expr
    body: BlockExpr
}
export interface IfExpr extends ExprBase {
    kind: ASTType.IfExpr
    cond: Expr
    then: BlockExpr
    else?: BlockExpr | IfExpr
}
export interface BreakExpr extends ExprBase {
    kind: ASTType.BreakExpr
    expr?: Expr
}

export interface ReturnExpr extends ExprBase {
    kind: ASTType.ReturnExpr
    expr?: Expr
}

export interface CastExpr extends ExprBase {
    kind: ASTType.CastExpr
    expr: Expr
    targetType: Type
}

export interface StructExpr extends ExprBase {
    kind: ASTType.StructExpr
    path: PathExpr
    fields: { name: string, value: Expr }[]
}

export interface FieldExpr extends ExprBase {
    kind: ASTType.FieldExpr
    object: Expr
    field: string
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

export type Item = FuncItem | ConstItem | StructItem | /* Trait | */ Impl
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
    evaluated?: Evaluated
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

export interface BorrowExpr extends ExprBase {
    kind: ASTType.BorrowExpr
    expr: Expr
    mutable: boolean
}

export interface BlockExpr extends ExprBase {
    kind: ASTType.BlockExpr
    statements: Statement[]
    expr?: Expr
}

// export interface Trait extends ASTBase {
//     kind: ASTType.Trait
//     fn: FuncItem[]
//     const: ConstItem[]
// }

export type Impl = InherentImpl
export interface InherentImpl extends ASTBase {
    kind: ASTType.InherentImpl
    type: TypePath
    fn: FuncItem[]
    const: ConstItem[]
}
// export interface TraitImpl extends ASTBase {
//     kind: ASTType.TraitImpl
//     type: TypePath
//     name: string
//     fn: FuncItem[]
//     const: ConstItem[]
// }

export type ASTNode =
    // Pattern 节点
    | IdentifierPattern
    /*| WildcardPattern*/
    | ReferencePattern

    // Type 节点
    | UnitType
    | TypePath
    | ArrayType
    | RefType

    // Expr 节点
    | LiteralExpr
    | CallExpr
    | UnaryExpr
    | BinaryExpr
    | PathExpr
    | ArrayExpr
    | RepeatArrayExpr
    | IndexExpr
    | LoopExpr
    | WhileExpr
    | IfExpr
    | BreakExpr
    | ReturnExpr
    | CastExpr
    | StructExpr
    | FieldExpr
    | BlockExpr
    | BorrowExpr

    // Statement 节点
    | EmptyStatement
    | LetStatement
    | ExprStatement

    // Item 节点
    | FuncItem
    | ConstItem
    | StructItem
    | StructField
    /* | Trait */
    | InherentImpl
    /* | TraitImpl *///  No such thing!

    // 其它
    | Param
    | Crate


export type NodeByKind<K extends ASTType> = Extract<ASTNode, { kind: K }>;

export interface Visitor<R = void> {
    onLiteralExpr?(node: NodeByKind<ASTType.LiteralExpr>, self: Visitor<R>): R
    onCallExpr?(node: NodeByKind<ASTType.CallExpr>, self: Visitor<R>): R
    onUnaryExpr?(node: NodeByKind<ASTType.UnaryExpr>, self: Visitor<R>): R
    onBinaryExpr?(node: NodeByKind<ASTType.BinaryExpr>, self: Visitor<R>): R
    onPathExpr?(node: NodeByKind<ASTType.PathExpr>, self: Visitor<R>): R
    onArrayExpr?(node: NodeByKind<ASTType.ArrayExpr>, self: Visitor<R>): R
    onRepeatArrayExpr?(node: NodeByKind<ASTType.RepeatArrayExpr>, self: Visitor<R>): R
    onIndexExpr?(node: NodeByKind<ASTType.IndexExpr>, self: Visitor<R>): R
    onFn?(node: NodeByKind<ASTType.FnItem>, self: Visitor<R>): R
    onLet?(node: NodeByKind<ASTType.LetStatement>, self: Visitor<R>): R
    onBlock?(node: NodeByKind<ASTType.BlockExpr>, self: Visitor<R>): R
    onLoop?(node: NodeByKind<ASTType.LoopExpr>, self: Visitor<R>): R
    onWhile?(node: NodeByKind<ASTType.WhileExpr>, self: Visitor<R>): R
    onIf?(node: NodeByKind<ASTType.IfExpr>, self: Visitor<R>): R
    onCrate?(node: NodeByKind<ASTType.Crate>, self: Visitor<R>): R
    onConst?(node: NodeByKind<ASTType.ConstItem>, self: Visitor<R>): R
    onExprStatement?(node: NodeByKind<ASTType.ExprStatement>, self: Visitor<R>): R
    onReturnExpr?(node: NodeByKind<ASTType.ReturnExpr>, self: Visitor<R>): R
    onBreakExpr?(node: NodeByKind<ASTType.BreakExpr>, self: Visitor<R>): R
    onCastExpr?(node: NodeByKind<ASTType.CastExpr>, self: Visitor<R>): R
    onStructExpr?(node: NodeByKind<ASTType.StructExpr>, self: Visitor<R>): R
    onFieldExpr?(node: NodeByKind<ASTType.FieldExpr>, self: Visitor<R>): R
    // TODO
    default?(node: ASTNode, self: Visitor<R>): R
}

export function visit<R = void>(node: ASTNode, visitor: Visitor<R>): R | undefined {
  switch (node.kind) {
    case ASTType.LiteralExpr:
      return visitor.onLiteralExpr?.(node, visitor)
    case ASTType.CallExpr:
      return visitor.onCallExpr?.(node, visitor)
    case ASTType.UnaryExpr:
      return visitor.onUnaryExpr?.(node, visitor)
    case ASTType.BinaryExpr:
      return visitor.onBinaryExpr?.(node, visitor)
    case ASTType.PathExpr:
      return visitor.onPathExpr?.(node, visitor)
    case ASTType.ArrayExpr:
      return visitor.onArrayExpr?.(node, visitor)
    case ASTType.RepeatArrayExpr:
      return visitor.onRepeatArrayExpr?.(node, visitor)
    case ASTType.IndexExpr:
      return visitor.onIndexExpr?.(node, visitor)
    case ASTType.FnItem:
      return visitor.onFn?.(node, visitor)
    case ASTType.LetStatement:
      return visitor.onLet?.(node, visitor)
    case ASTType.BlockExpr:
      return visitor.onBlock?.(node, visitor)
    case ASTType.LoopExpr:
      return visitor.onLoop?.(node, visitor)
    case ASTType.WhileExpr:
      return visitor.onWhile?.(node, visitor)
    case ASTType.IfExpr:
      return visitor.onIf?.(node, visitor)
    case ASTType.Crate:
      return visitor.onCrate?.(node, visitor)
    case ASTType.ConstItem:
      return visitor.onConst?.(node, visitor)
    case ASTType.ExprStatement:
      return visitor.onExprStatement?.(node, visitor)
    case ASTType.ReturnExpr:
      return visitor.onReturnExpr?.(node, visitor)
    case ASTType.BreakExpr:
      return visitor.onBreakExpr?.(node, visitor)
    case ASTType.CastExpr:
      return visitor.onCastExpr?.(node, visitor)
    case ASTType.StructExpr:
      return visitor.onStructExpr?.(node, visitor)
    case ASTType.FieldExpr:
      return visitor.onFieldExpr?.(node, visitor)
    default:
      return visitor.default?.(node, visitor)
  }
}

export function walk<R = void>(node: ASTNode, visitor: Visitor<R>): (R | undefined)[] {
    return getChildren(node).map(n => visit(n, visitor))
}

export function getChildren(node: ASTNode): ASTNode[] {
    return visit<ASTNode[]>(node, {
        onLiteralExpr: n => [],
        onCallExpr: n => [...n.param, n.value],
        onUnaryExpr: n => [n.operand],
        onBinaryExpr: n => n.operand,
        onPathExpr: n => [],
        onArrayExpr: n => n.val,
        onRepeatArrayExpr: n => [n.val, n.repeat],
        onIndexExpr: n => [n.arr, n.idx],
        onFn: n => [...(n.body ? [n.body] : []), ...n.params, n.returnType],
        onLet: n => [n.pattern, n.type, ...(n.expr ? [n.expr] : [])],
        onBlock: n => [...(n.expr ? [n.expr] : []), ...n.statements],
        onLoop: n => [n.body],
        onWhile: n => [n.cond, n.body],
        onIf: n => [n.cond, n.then, ...(n.else ? [n.else] : [])],
        onCrate: n => n.items,
        onConst: n => [n.type, ...(n.val ? [n.val] : [])],
        onExprStatement: n => [n.expr],
        onReturnExpr: n => n.expr ? [n.expr] : [],
        onBreakExpr: n => n.expr ? [n.expr] : [],
        onCastExpr: n => [n.expr, n.targetType],
        onStructExpr: n => [n.path, ...n.fields.map(f => f.value)],
        onFieldExpr: n => [n.object],
        default: n => [],
    }) ?? []
}
