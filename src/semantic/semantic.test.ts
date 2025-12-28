import { SemanticAnalyzer } from "./semantic";
import { tokenize } from "../lexer/index";
import { execute, some } from "../parser/parsek/parsek";
import { crate } from "../parser/parser";

describe("SemanticAnalyzer", () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  test("should analyze simple function with variable declaration", () => {
    const source = `
fn main() {
  let x: i32 = 10;
  let y: bool = true;
}
`;

    const tokens = tokenize(source);
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).toBeDefined();
    if (parsed) {
      const [crateNode] = parsed;
      const result = analyzer.analyze(crateNode);
      
      // 应该没有语义错误
      expect(result.errors).toHaveLength(0);
    }
  });

// not anymore
//   test("should detect duplicate variable declarations", () => {
//     const source = `
// fn main() {
//   let x: i32 = 10;
//   let x: bool = true; // Duplicate declaration
// }
// `;
// 
//     const tokens = tokenize(source);
//     const parsed = execute(crate, { token: tokens, start: 0 });
//     
//     expect(parsed).toBeDefined();
//     if (parsed) {
//       const [crateNode] = parsed;
//       const result = analyzer.analyze(crateNode);
//       
//       // 应该有一个重复声明错误
//       expect(result.errors).toHaveLength(1);
//       expect(result.errors[0]!.message).toContain("Duplicate variable declaration");
//     }
//   });

  test("should handle scope shadowing correctly", () => {
    const source = `
fn main() {
  let x: i32 = 10; // Global x
  {
      let x: bool = false; // Shadowing global x
      let z = x; // Should be bool type
  }
  let y = x; // Should be i32 type
}
`;

    const tokens = tokenize(source);
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).toBeDefined();
    if (parsed) {
      const [crateNode] = parsed;
      const result = analyzer.analyze(crateNode);
      
      // 应该没有语义错误
      expect(result.errors).toHaveLength(0);
    }
  });

  test("should detect undeclared variables", () => {
    const source = `
fn main() {
  let x = y; // y not declared
}
`;

    const tokens = tokenize(source);
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).toBeDefined();
    if (parsed) {
      const [crateNode] = parsed;
      const result = analyzer.analyze(crateNode);
      
      // 应该有一个未声明变量错误
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toContain("Undeclared identifier");
    }
  });

  test("should handle built-in types correctly", () => {
    const source = `
fn main() {
    let a: i32 = 1;
    let b: u32 = 2;
    let c: bool = true;
    let d: char = 'c';
    let e: str = "hello";
    let f: () = ();
}
`;

    const tokens = tokenize(source);
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).toBeDefined();
    if (parsed) {
      const [crateNode] = parsed;
      const result = analyzer.analyze(crateNode);
      
      // 应该没有语义错误
      expect(result.errors).toHaveLength(0);
    }
  });

  test("should detect unknown types", () => {
    const source = `
fn main() {
    let x: UnknownType = 10;
}
`;

    const tokens = tokenize(source);
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).toBeDefined();
    if (parsed) {
      const [crateNode] = parsed;
      const result = analyzer.analyze(crateNode);
      
      // 应该有一个未知类型错误
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toContain("Unknown type");
    }
  });
});