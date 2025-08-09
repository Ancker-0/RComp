import { KEYWORDS_STRONG, OPERATORS } from "./const";

export enum TokenType {
    Identifier,
    Literal,
    Keyword,
    Operator,

    LeftParen,
    RightParen,
    LeftBracket,
    RightBracket,
    LeftBrace,
    RightBrace,

    Comma,
    Colon,
    Semicolon,
    Question,

    IntegerLiteral,
}

export type Location = {
    line: number
    col: number
}

interface TokenCommon {
    type: TokenType
    location: Location
}

type NormalToken = {
    type: Exclude<TokenType, TokenType.Keyword | TokenType.IntegerLiteral>,
    raw: string
}

export type Keyword = typeof KEYWORDS_STRONG[number]
type KeywordToken = {
    type: TokenType.Keyword
    raw: Keyword
}

export type Operator = typeof OPERATORS[number]
type OperatorToken = {
    type: TokenType.Operator
    raw: Operator
}

type IntegerLiteralToken = {
    type: TokenType.IntegerLiteral
    raw: string
}

export type TokenSpecific = NormalToken | KeywordToken | IntegerLiteralToken | OperatorToken
export type Token = TokenCommon & TokenSpecific
export type { NormalToken, KeywordToken, OperatorToken, IntegerLiteralToken }
