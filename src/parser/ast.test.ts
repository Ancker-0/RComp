import { ChildProcess } from "child_process";
import { tokenize } from "../lexer";
import { ASTType, getChildren, visit, walk } from "./ast";
import { execute } from "./parsek/parsek";
import { fn } from "./parser";
import util from 'util'

const log = (...args: any[]) => {
    const inspected = args.map(a => util.inspect(a, { depth: null, colors: true }))
    console.log(...inspected)
}

test("visitor 1", () => {
    const r = execute(fn, {
        token: tokenize(`
            fn main() -> i32 {
                let haha: i32 = 1;
            }
        `), start: 0
    })
    expect(r).toBeTruthy()
    if (!r) return
    // log(r[0])
    let a: any[] = []
    let b: any[] = []
    visit(r[0], {
        onFn: (n, self) => {
            a.push(n.name)
            expect(n.body?.statements.length).toBe(1)
            walk(n, self)
        },
        onLet: (n, self) => {
            expect(n.pattern.kind).toBe(ASTType.IdentifierPattern)
            if (n.pattern.kind != ASTType.IdentifierPattern)
                return
            b.push(n.pattern.name)
            walk(n, self)
        },
        onLiteralExpr: walk,
        onCallExpr: walk,
        onUnaryExpr: walk,
        onBlock: walk,
        default: walk,
    })
    expect(a).toEqual(["main"])
    expect(b).toEqual(["haha"])
})