import { TokenType, Token } from "../lexer/token";
import { lazy, many, map, seq } from "./parsec";
import { id, keyword, operator } from "./putil"

export { }

export const block =
    map(([_0, stmt, _1]: any) => stmt as Token[],
        seq(id(TokenType.LeftBrace), lazy(() => statement), id(TokenType.RightBrace)))
const statement = many(id(TokenType.IntegerLiteral))