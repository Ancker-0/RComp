import * as ast from "./ast"
import { fmap, Info, lazy, many, manyL, map, maybe, more, or, or as or1, ParserK, seq, skip, some } from "./parsek/parsek"
import { id, keyword, operator } from "./parsek/pkutil"
import { Token, TokenType } from "../lexer/token"
import { expr as exprRaw } from "./pratt-parse/expr"
import { tokenize } from "../lexer"

export const identifierPattern: ParserK<ast.Pattern> = fmap(id(TokenType.Identifier),
    r => ({
        kind: ast.ASTType.IdentifierPattern,
        name: r.raw
    }))
export const pattern: ParserK<ast.Pattern> = identifierPattern

export const expr = exprRaw  // TODO: add expression with block

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
export const type: ParserK<ast.Type> = or1(or1(unitType, typePath), arrayType)

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
    seq(expr, id(TokenType.Semicolon)),
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
        maybe(more(statement)),
        maybe(exprRaw),
        id(TokenType.RightBrace)
    ),
    r => ({
        kind: ast.ASTType.BlockExpr,
        _value: r,
    })
)

const selfParam = or1(
    seq(maybe(operator("&")), maybe(keyword("mut")), keyword("self")),
    seq(maybe(keyword("mut")), keyword("self"), id(TokenType.Colon), type))

const funcParam = skip;

export const fn: ParserK<ast.FuncItem> = fmap(
    seq(
        maybe(keyword("const")), keyword("fn"), id(TokenType.Identifier),
        id(TokenType.LeftParen),
        or1(
            seq(selfParam, maybe(id(TokenType.Comma))),
            seq(maybe(seq(selfParam, id(TokenType.Comma))), funcParam, maybe(many(seq(id(TokenType.Comma), funcParam))), maybe(id(TokenType.Comma)))
        ),
        id(TokenType.RightParen),
        maybe(seq(operator("->"), type)),
        or1(id(TokenType.Semicolon), block)
    ),
    res => ({
        kind: ast.ASTType.FnItem,
        name: "",
        quantifier: res[0] === null ? [] : ["const"],
        params: [],
        returnType: res[6] ? res[6][1] : ast.unitType(),
        ...('raw' in res[7] ? {} : { body: res[7] }),
    }))

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

export const trait: ParserK<ast.Trait> = fmap(
    seq(
        keyword("trait"), id(TokenType.Identifier),
        id(TokenType.LeftBrace), associatedItems, id(TokenType.RightBrace)),
    r => ({
        kind: ast.ASTType.Trait,
        ...r[3],
    })
)

export const inherentImpl: ParserK<ast.InherentImpl> = fmap(
    seq(keyword("impl"), typePath, id(TokenType.LeftBrace), associatedItems, id(TokenType.RightBrace)),
    r => ({
        kind: ast.ASTType.InherentImpl,
        type: r[1],
        ...r[3],
    })
)
export const traitImpl: ParserK<ast.TraitImpl> = fmap(
    seq(keyword("impl"), id(TokenType.Identifier), keyword("for"), typePath, id(TokenType.LeftBrace), associatedItems, id(TokenType.RightBrace)),
    r => ({
        kind: ast.ASTType.TraitImpl,
        name: r[1].raw,
        type: r[3],
        ...r[5],
    })
)
export const impl = or(inherentImpl, traitImpl)

export const item: ParserK<ast.Item> = or(fn, constItem, structItem, trait, impl)
