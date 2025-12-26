import { tokenize } from "../lexer/index";
import { execute } from "../parser/parsek/parsek";
import { crate } from "../parser/parser";
import { SemanticAnalyzer } from "../semantic/semantic";

// 测试多维数组维度检查功能
describe("多维数组维度检查功能测试", () => {
  test("二维数组维度不匹配，应该报错", () => {
    const code = `
fn main() {
    let grid: [[i32; 2]; 3] = [
        [1, 2],
        [3, 4],
        [5, 6, 7],
    ];
}
`;

    // 进行词法分析
    const tokens = tokenize(code);
    
    // 进行语法分析
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).not.toBeNull();
    
    const [crateNode] = parsed as [any, any];
    
    // 进行语义分析
    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(crateNode);
    
    // 应该检测到错误
    expect(result.errors.length).toBeGreaterThan(0);
    // expect(result.errors[0]?.message).toContain("Array size mismatch");
  });

  test("二维数组维度匹配，不应该报错", () => {
    const code = `
fn main() {
    let grid: [[i32; 2]; 3] = [
        [1, 2],
        [3, 4],
        [5, 6],
    ];
}
`;

    // 进行词法分析
    const tokens = tokenize(code);
    
    // 进行语法分析
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).not.toBeNull();
    
    const [crateNode] = parsed as [any, any];
    
    // 进行语义分析
    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(crateNode);
    
    // 不应该检测到错误
    expect(result.errors.length).toBe(0);
  });

  test("三维数组维度不匹配，应该报错", () => {
    const code = `
fn main() {
    let cube: [[[i32; 2]; 2]; 2] = [
        [[1, 2], [3, 4]],
        [[5, 6], [7, 8, 9]],
    ];
}
`;

    // 进行词法分析
    const tokens = tokenize(code);
    
    // 进行语法分析
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).not.toBeNull();
    
    const [crateNode] = parsed as [any, any];
    
    // 进行语义分析
    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(crateNode);
    
    // 应该检测到错误
    expect(result.errors.length).toBeGreaterThan(0);
    // expect(result.errors[0]?.message).toContain("Array size mismatch");
  });

  test("三维数组维度匹配，不应该报错", () => {
    const code = `
fn main() {
    let cube: [[[i32; 2]; 2]; 2] = [
        [[1, 2], [3, 4]],
        [[5, 6], [7, 8]],
    ];
}
`;

    // 进行词法分析
    const tokens = tokenize(code);
    
    // 进行语法分析
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).not.toBeNull();
    
    const [crateNode] = parsed as [any, any];
    
    // 进行语义分析
    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(crateNode);
    
    // 不应该检测到错误
    expect(result.errors.length).toBe(0);
  });
});