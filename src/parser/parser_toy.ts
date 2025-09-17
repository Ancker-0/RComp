import { TokenType, Token } from "../lexer/token";
import { lazy, many, map, maybe, more, nothing, or, seq, skip } from "./parsec";
import { id, keyword, operator } from "./putil"


const typename = id(TokenType.Identifier)  // TODO

const expression = id(TokenType.IntegerLiteral)  // TODO
const expression_noblock = expression  // TODO

const rangePattern = nothing
const identifierPattern = seq(
    maybe(keyword("ref")), maybe(keyword("mut")),
    id(TokenType.Identifier),
    // maybe(seq(operator("@"), lazy(() => patternNoTopAlt)))
)
const patternWithoutRange = or(identifierPattern, nothing)
const patternNoTopAlt = or(patternWithoutRange, rangePattern)

const let_stmt =
    seq(keyword("let"),
        patternNoTopAlt,
        maybe(seq(id(TokenType.Colon), typename)),
        maybe(seq(operator("="), expression)),
        id(TokenType.Semicolon))  // TODO
const statement = or(id(TokenType.Semicolon), let_stmt)  // TODO
const statements = or(more(statement), maybe(seq(more(statement), expression_noblock)), expression_noblock)

export const block =
    map(([_0, stmt, _1]: any) => stmt as Token[],
        seq(id(TokenType.LeftBrace), statements, id(TokenType.RightBrace)))