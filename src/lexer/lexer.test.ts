import { tokenize } from "."
import { TokenType } from "./token"

test("keyword 1", () => {
    const src = `async`  // this shouldn't be recognized as "as"
    const r = tokenize(src)
    expect(r[0]?.type).toEqual(TokenType.Keyword)
})

test("multiline comment", () => {
    const src = `
    /* This is a
       multiline comment */
    let a = 1;
    `
    const r = tokenize(src)
    expect(r.length).toBe(5) // let, a, =, 1, ;
    expect(r[0]?.type).toEqual(TokenType.Keyword) // let
    expect(r[1]?.type).toEqual(TokenType.Identifier) // a
    expect(r[2]?.type).toEqual(TokenType.Operator) // =
    expect(r[3]?.type).toEqual(TokenType.IntegerLiteral) // 1
    expect(r[4]?.type).toEqual(TokenType.Semicolon) // ;
})

test("multiline comment with nested /* and */", () => {
    const src = `
    /* This is a /* nested */ comment with */ some text
    let a = 1;
    `
    const r = tokenize(src)
    expect(r.length).toBe(7) // some, text, let, a, =, 1, ;
    expect(r[0]?.type).toEqual(TokenType.Identifier) // some
    expect(r[1]?.type).toEqual(TokenType.Identifier) // text
    expect(r[2]?.type).toEqual(TokenType.Keyword) // let
    expect(r[3]?.type).toEqual(TokenType.Identifier) // a
    expect(r[4]?.type).toEqual(TokenType.Operator) // =
    expect(r[5]?.type).toEqual(TokenType.IntegerLiteral) // 1
    expect(r[6]?.type).toEqual(TokenType.Semicolon) // ;
})

test("multiline comment at end of file", () => {
    const src = `
    let a = 1;
    /* This is a comment at the end */`
    const r = tokenize(src)
    expect(r.length).toBe(5) // let, a, =, 1, ;
    expect(r[0]?.type).toEqual(TokenType.Keyword) // let
    expect(r[1]?.type).toEqual(TokenType.Identifier) // a
    expect(r[2]?.type).toEqual(TokenType.Operator) // =
    expect(r[3]?.type).toEqual(TokenType.IntegerLiteral) // 1
    expect(r[4]?.type).toEqual(TokenType.Semicolon) // ;
})

test("nested comment", () => {
    const src = `
    /* This is a /* nested */ comment */
    let a = 1;
    `
    const r = tokenize(src)
    expect(r.length).toBe(5) // let, a, =, 1, ;
    expect(r[0]?.type).toEqual(TokenType.Keyword) // let
    expect(r[1]?.type).toEqual(TokenType.Identifier) // a
    expect(r[2]?.type).toEqual(TokenType.Operator) // =
    expect(r[3]?.type).toEqual(TokenType.IntegerLiteral) // 1
    expect(r[4]?.type).toEqual(TokenType.Semicolon) // ;
})