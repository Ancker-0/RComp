import { Token } from "./token"
import { Lexer } from "./lexer"

export function tokenize(src: string): Token[] {
    for (const x of src)
        if (x.charCodeAt(0) > 127 || x.charCodeAt(0) < 0)
            throw new Error(`Unexpected character ${x}`)
    const lexer = new Lexer(src)
    return lexer.tokenize()
}