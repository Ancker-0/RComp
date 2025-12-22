interface Expr<A, Visitor> {
    accept(visitor: Visitor): A
}

class Integer<A, Visitor extends {
    integer: (x: number) => A
}> implements Expr<A, Visitor> {
    constructor(readonly value: number) { }
    accept(visitor: Visitor): A {
        return visitor.integer(this.value)
    }
}

class Add<A, Visitor extends {
    add: (lhs: Expr<A, Visitor>, rhs: Expr<A, Visitor>) => A
}> implements Expr<A, Visitor> {
    constructor(readonly lhs: Expr<A, Visitor>, readonly rhs: Expr<A, Visitor>) { }
    accept(visitor: Visitor): A {
        return visitor.add(this.lhs, this.rhs)
    }
}

type Printer = Algebra<string>


function expr<A, V extends Algebra<A>>() {
    let lhs = new Integer<A, V>(1)
    let rhs = new Integer<A, V>(2)
    return new Add(lhs, rhs)
}

interface Algebra<A> {
    integer(x: number): A
    add(lhs: Expr<A, Algebra<A>>, rhs: Expr<A, Algebra<A>>): A
}

type Eval = Algebra<number>

let eval_vis: Eval = {
    integer: x => x,
    add: (lhs, rhs) => lhs.accept(eval_vis) + rhs.accept(eval_vis)
}

class EV implements Eval {
    integer(x) { return x }
    add(lhs, rhs) { return lhs.accept(eval_vis) + rhs.accept(eval_vis) }
}

let printer_vis: Printer = {
    integer: x => x.toString(),
    add: (lhs, rhs) => `(${lhs.accept(printer_vis)} + ${rhs.accept(printer_vis)})`
}


let eval_result = expr<number, Eval>().accept(eval_vis)
console.log(eval_result)

let printer_result = expr<string, Printer>().accept(printer_vis)
console.log(printer_result)