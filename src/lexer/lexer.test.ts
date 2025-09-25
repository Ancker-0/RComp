import { tokenize } from "."
import { TokenType } from "./token"

test("keyword 1", () => {
    const src = `async`  // this shouldn't be recognized as "as"
    const r = tokenize(src)
    expect(r[0]?.type).toEqual(TokenType.Keyword)
})