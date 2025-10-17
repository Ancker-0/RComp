import { SemanticAnalyzer } from "./semantic";
import { tokenize } from "../lexer";
import { execute } from "../parser/parsek/parsek";
import { crate } from "../parser/parser";

// 测试数组可变性检查
describe("Array Mutability Check", () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  it("should report error for assigning to immutable array element", () => {
    const source = `
      fn main() {
          let arr: [i32; 3] = [1, 2, 3];
          arr[1] = 4;     // arr 未声明为 mut
      }
    `;

    const tokens = tokenize(source);
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).toBeDefined();
    if (parsed) {
      const [ast] = parsed;
      const result = analyzer.analyze(ast);
      
      // 应该有一个错误
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toContain("Cannot assign to immutable variable 'arr'");
    }
  });

  it("should not report error for assigning to mutable array element", () => {
    const source = `
      fn main() {
          let mut arr: [i32; 3] = [1, 2, 3];
          arr[1] = 4;     // arr 声明为 mut
      }
    `;

    const tokens = tokenize(source);
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).toBeDefined();
    if (parsed) {
      const [ast] = parsed;
      const result = analyzer.analyze(ast);
      
      // 应该没有语义错误
      expect(result.errors).toHaveLength(0);
    }
  });
});