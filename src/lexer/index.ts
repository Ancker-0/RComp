import { Token } from "./token"
import { Lexer } from "./lexer"

export function tokenize(src: string): Token[] {
    const lexer = new Lexer(src)
    return lexer.tokenize()
}