import * as ast from "./ast"
import { fmap, Info, lazy, many, manyL, manyR, map, maybe, more, or, or as or1, ParserK, seq, skip, some } from "./parsek/parsek"
import { id, keyword, operator } from "./parsek/pkutil"
import { Token, TokenType } from "../lexer/token"
import { expr as exprRaw } from "./pratt-parse/expr"
import { tokenize } from "../lexer"

export const identifierPattern: ParserK<ast.IdentifierPattern> = fmap(seq(maybe(keyword("ref")), maybe(keyword("mut")), id(TokenType.Identifier)),
    r => ({
        kind: ast.ASTType.IdentifierPattern,
        name: r[2].raw,
        mutable: Boolean(r[1]),
        ref: Boolean(r[0]),
    }))
export const referencePattern: ParserK<ast.ReferencePattern> = fmap(
    seq(or(operator("&"), operator("&&")), maybe(keyword("mut")), lazy(() => pattern)),
    r => ({
        kind: ast.ASTType.ReferencePattern,
        mutable: Boolean(r[1]),
        ref: r[0] === "&" ? 1 : 2,
    })
)
export const pattern: ParserK<ast.Pattern> = or(referencePattern, identifierPattern)

export const exprWithBlock = lazy(() => or(loop, whileE, ifE))
export const expr = or(lazy(()=>exprRaw), lazy(()=>loop))  // TODO: add expression with block
/**
 * TODO: now `if (a) { b } else { c }` has two ways to interpret as an expression:
 * 1. an expression alone (e.g. as an sub-expression of 1+(...) )
 * 2. block expression
 * We should eliminate this error
 * See test "expr 0" and "if 6"
 */

// export const literalExpr: ParserK<ast.LiteralExpr> = fmap(id(TokenType.IntegerLiteral),
//     r => {
//         if (r.type == TokenType.IntegerLiteral) {
//             return {
//                 kind: ast.ASTType.LiteralExpr,
//                 type: "integer",
//                 value: r.raw
//             }
//         } else
//             throw Error("HAHA")
//     }
// )
// export const expr: ParserK<ast.Expr> = literalExpr

export const unitType: ParserK<ast.Type> = fmap(
    seq(id(TokenType.LeftParen), id(TokenType.RightParen)),
    _ => ast.unitType());
export const typePath: ParserK<ast.TypePath> = fmap(
    or1(id(TokenType.Identifier), keyword("Self")),
    r => ({ kind: ast.ASTType.TypePath, value: typeof r === 'string' ? r : r.raw }))
export const arrayType: ParserK<ast.ArrayType> = fmap(
    seq(id(TokenType.LeftBracket), lazy(() => type), id(TokenType.Semicolon), expr, id(TokenType.RightBracket)),
    r => ({
        kind: ast.ASTType.ArrayType,
        type: r[1],
        expr: r[3],
    })
)
export const type: ParserK<ast.Type> = or(unitType, typePath, arrayType, lazy(()=>refType))
export const refType: ParserK<ast.RefType> = fmap(
    seq(operator("&"), maybe(keyword("mut")), type),
    r => ({
        kind: ast.ASTType.RefType,
        type: r[2],
        mutable: Boolean(r[1]),
    })
)

export const letStatement: ParserK<ast.LetStatement> = fmap(
    seq(
        keyword("let"), pattern, id(TokenType.Colon), type,
        maybe(seq(operator("="), expr)), id(TokenType.Semicolon)
    ),
    r => ({
        kind: ast.ASTType.LetStatement,
        pattern: r[1],
        type: r[3],
        ...(r[4] && { expr: r[4][1] })
    })
)

export const exprStatement: ParserK<ast.ExprStatement> = fmap(  // TODO: expr with block
    or(
        seq(exprRaw, id(TokenType.Semicolon)),
        seq(exprWithBlock, maybe(id(TokenType.Semicolon))),
    ),
    r => ({
        kind: ast.ASTType.ExprStatement,
        expr: r[0],
    })
)

function expect<T>(v: T) { }

export const statement: ParserK<ast.Statement> = fmap(
    or(id(TokenType.Semicolon), letStatement, exprStatement, lazy(()=>item)),
    r => {
        if ('raw' in r) {
            expect<Token>(r)
            return { kind: ast.ASTType.EmptyStatement }
        } else {
            expect<ast.LetStatement | ast.ExprStatement | ast.Item>(r)
            return r
        }
    }
)

export const block: ParserK<ast.BlockExpr> = fmap(  // TODO
    seq(
        id(TokenType.LeftBrace),
        manyL(statement),
        maybe(expr),
        id(TokenType.RightBrace)
    ),
    r => ({
        kind: ast.ASTType.BlockExpr,
        statements: r[1],
        expr: r[2] ?? undefined,
    })
)

export const loop: ParserK<ast.LoopExpr> = fmap(
    seq(keyword("loop"), block),
    r => ({
        kind: ast.ASTType.LoopExpr,
        body: r[1],
    })
)

export const whileE: ParserK<ast.WhileExpr> = fmap(
    seq(keyword("while"), id(TokenType.LeftParen), expr, id(TokenType.RightParen), block),
    r => ({
        kind: ast.ASTType.WhileExpr,
        cond: r[2],
        body: r[4],
    })
)

export const ifE: ParserK<ast.IfExpr> = fmap(
    seq(
        keyword("if"),
        id(TokenType.LeftParen),
        expr,
        id(TokenType.RightParen),
        block,
        or(seq(keyword("else"), or(lazy(() => ifE), block)), skip)
    ),
    r => ({
        kind: ast.ASTType.IfExpr,
        cond: r[2],
        then: r[4],
        ...(r[5] && { else: r[5][1] })
    })
)

export const ifElseE: ParserK<ast.IfExpr> = fmap(
    seq(
        keyword("if"),
        id(TokenType.LeftParen),
        expr,
        id(TokenType.RightParen),
        block,
        seq(keyword("else"), or(lazy(() => ifE), block))
    ),
    r => ({
        kind: ast.ASTType.IfExpr,
        cond: r[2],
        then: r[4],
        else: r[5][1],
    })
)

// const selfParam = or1(
//     seq(maybe(operator("&")), maybe(keyword("mut")), keyword("self")),
//     seq(maybe(keyword("mut")), keyword("self"), id(TokenType.Colon), type))
const selfParam = seq(maybe(operator("&")), maybe(keyword("mut")), keyword("self"))

const funcParam: ParserK<ast.Param> = fmap(
    seq(pattern, id(TokenType.Colon), type),
    r => ({
        kind: ast.ASTType.FnParam,
        pattern: r[0],
        type: r[2],
    })
)

export const fn: ParserK<ast.FuncItem> = fmap(
    seq(
        maybe(keyword("const")), keyword("fn"), id(TokenType.Identifier),
        id(TokenType.LeftParen),
        maybe(or1(
            seq(selfParam, maybe(id(TokenType.Comma))),
            seq(maybe(seq(selfParam, id(TokenType.Comma))), funcParam, many(seq(id(TokenType.Comma), funcParam)), maybe(id(TokenType.Comma)))
        )),
        id(TokenType.RightParen),
        maybe(seq(operator("->"), type)),
        or1(id(TokenType.Semicolon), block)
    ),
    res => {
        // Extract params from res[4]
        // res[4] is null (no params) or one of:
        // - [selfParam, maybe(comma)] - just self
        // - [maybe(selfParam+comma), funcParam, many([comma, funcParam]), maybe(comma)] - regular params
        let params: ast.Param[] = []
        const paramsPart = res[4]
        let self: undefined | { ref: boolean, mutable: boolean }

        if (paramsPart && Array.isArray(paramsPart) && paramsPart.length === 4 && paramsPart[1] && 'kind' in paramsPart[1]) {
            // Second form: regular function parameters
            const firstParam = paramsPart[1] as ast.Param
            const restParams = (paramsPart[2] as any[]).map((x: any) => x[1] as ast.Param)
            params = [firstParam, ...restParams]
            if (paramsPart[0])
                self = {
                    ref: Boolean(paramsPart[0][0][0]),
                    mutable: Boolean(paramsPart[0][0][1]),
                }
        } else if (paramsPart && Array.isArray(paramsPart) && paramsPart.length == 2)
            self = {
                ref: Boolean(paramsPart[0][0]),
                mutable: Boolean(paramsPart[0][1]),
            }
        // Otherwise it's either empty or self param, which we're not handling yet

        return {
            kind: ast.ASTType.FnItem,
            name: res[2].raw,
            quantifier: res[0] === null ? [] : ["const"],
            params,
            self,
            returnType: res[6] ? res[6][1] : ast.unitType(),
            ...('raw' in res[7] ? {} : { body: res[7] }),
        }
    })

export const constItem: ParserK<ast.ConstItem> = fmap(
    seq(keyword("const"), id(TokenType.Identifier), id(TokenType.Colon), type, maybe(seq(operator("="), expr)), id(TokenType.Semicolon)),
    r => ({
        kind: ast.ASTType.ConstItem,
        name: r[1].raw,
        type: r[3],
        ...(r[4] ? { val: r[4][1] } : {})
    })
)

export const structField: ParserK<ast.StructField> = fmap(
    seq(id(TokenType.Identifier), id(TokenType.Colon), type),
    r => ({
        kind: ast.ASTType.StructField,
        name: r[0].raw,
        type: r[2],
    })
)

export const structFields: ParserK<ast.StructField[]> = fmap(
    maybe(seq(structField, many(seq(id(TokenType.Comma), structField)), maybe(id(TokenType.Comma)))),
    r => r ? [r[0], ...r[1].map(x => x[1])] : []
)

export const structFieldInit: ParserK<{ name: string, value: ast.Expr }> = fmap(
    seq(id(TokenType.Identifier), id(TokenType.Colon), lazy(() => expr)),
    r => ({
        name: r[0].raw,
        value: r[2],
    })
)

export const structFieldsInit: ParserK<{ name: string, value: ast.Expr }[]> = fmap(
    or1(seq(structFieldInit, many(seq(id(TokenType.Comma), structFieldInit)), or1(id(TokenType.Comma), skip)), skip),
    r => r === null ? [] : [r[0], ...r[1].map(x => x[1])]
)

export const structExprFields: ParserK<{ name: string, value: ast.Expr }[]> = fmap(
    seq(id(TokenType.LeftBrace), structFieldsInit, id(TokenType.RightBrace)),
    r => r[1]
)

export const structItem: ParserK<ast.StructItem> = fmap(
    seq(
        keyword("struct"), id(TokenType.Identifier),
        or1(
            id(TokenType.Semicolon),
            seq(id(TokenType.LeftBrace), structFields, id(TokenType.RightBrace))
        )
    ),
    r => ({
        kind: ast.ASTType.StructItem,
        name: r[1].raw,
        fields: 'type' in r[2] ? [] : r[2][1]
    })
)

export const associatedItems = fmap(
    more(or1(constItem, fn)),
    r => ({
        fn: r.filter(x => x.kind === ast.ASTType.FnItem),
        const: r.filter(x => x.kind === ast.ASTType.ConstItem),
    })
)

// export const trait: ParserK<ast.Trait> = fmap(
//     seq(
//         keyword("trait"), id(TokenType.Identifier),
//         id(TokenType.LeftBrace), associatedItems, id(TokenType.RightBrace)),
//     r => ({
//         kind: ast.ASTType.Trait,
//         ...r[3],
//     })
// )

export const inherentImpl: ParserK<ast.InherentImpl> = fmap(
    seq(keyword("impl"), typePath, id(TokenType.LeftBrace), associatedItems, id(TokenType.RightBrace)),
    r => ({
        kind: ast.ASTType.InherentImpl,
        type: r[1],
        ...r[3],
    })
)
// export const traitImpl: ParserK<ast.TraitImpl> = fmap(
//     seq(keyword("impl"), id(TokenType.Identifier), keyword("for"), typePath, id(TokenType.LeftBrace), associatedItems, id(TokenType.RightBrace)),
//     r => ({
//         kind: ast.ASTType.TraitImpl,
//         name: r[1].raw,
//         type: r[3],
//         ...r[5],
//     })
// )
// export const impl = or(inherentImpl, traitImpl)
export const impl = inherentImpl

export const item: ParserK<ast.Item> = or(fn, constItem, structItem, /*trait,*/ impl)
export const crate: ParserK<ast.Crate> = fmap(more(item), items => ({
    kind: ast.ASTType.Crate,
    items,
}))
