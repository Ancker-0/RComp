import { tokenize } from "../lexer/index";
import { execute } from "../parser/parsek/parsek";
import { crate } from "../parser/parser";
import { SemanticAnalyzer } from "../semantic/semantic";
import * as fs from "fs";
import * as path from "path";

type Arg = { testPattern?: string, testDir?: string }

// 解析命令行参数
function parseCommandLineArgs(): Arg {
  const args = process.argv.slice(2); // 跳过 node 和脚本路径
  const options: Arg = {
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--test" || arg === "-t") {
      if (i + 1 < args.length) {
        options.testPattern = args[i + 1];
        i++; // 跳过下一个参数
      } else {
        console.error("错误: --test 参数需要一个值");
        process.exit(1);
      }
    } else if (arg == "--dir" || arg == "-d") {
      if (i + 1 < args.length) {
        options.testDir = args[i + 1]
        i++
      } else {
        console.error(`错误: ${arg} 参数需要一个值`);
        process.exit(1);
      }
    } else if (!arg.startsWith("-")) {
      // 如果不是以 - 开头的参数，假设它是测试模式
      options.testPattern = arg;
    }
  }

  return options;
}

// 检查测试名称是否匹配模式
function isTestMatch(testName: string, pattern?: string): boolean {
  if (!pattern) return true; // 如果没有模式，则匹配所有测试
  
  // 尝试将模式作为正则表达式处理
  try {
    const regex = new RegExp(pattern);
    return regex.test(testName);
  } catch (e) {
    // 如果不是有效的正则表达式，则作为普通字符串处理
    return testName === pattern;
  }
}

// 测试语义分析器对 semantics1 测试用例的处理
async function runSemantic1Tests(arg: Arg) {
  const { testPattern, testDir } = arg
  const testCasesDir = path.join(__dirname, `../../RCompiler-Testcases/${testDir || "semantic-1"}/src`);
  
  // 获取所有测试用例子目录
  const testDirs = fs.readdirSync(testCasesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  // 根据测试模式过滤测试用例
  const filteredTestDirs = testPattern
    ? testDirs.filter(dir => isTestMatch(dir, testPattern))
    : testDirs;
  
  console.log(`发现 ${filteredTestDirs.length} 个匹配的测试用例 (${testDirs.length} 总计)`);
  
  let passed = 0;
  let failed = 0;
  
  // 遍历所有测试用例
  for (const testDir of filteredTestDirs) {
    const testCasePath = path.join(testCasesDir, testDir);
    const rxFile = path.join(testCasePath, `${testDir}.rx`);
    
    // 检查是否存在 .rx 文件
    if (!fs.existsSync(rxFile)) {
      console.log(`跳过 ${testDir}: 缺少 .rx 文件`);
      continue;
    }
    
    try {
      // 读取源代码
      const sourceCode = fs.readFileSync(rxFile, "utf-8");
      
      // 进行词法分析
      const tokens = tokenize(sourceCode);
      
      // 进行语法分析
      const parsed = execute(crate, { token: tokens, start: 0 });

      // 检查测试用例的预期结果
      const metadata = parseTestMetadata(sourceCode);

      if (!parsed || parsed[1].start < parsed[1].token.length) {
        // 语法分析失败，将其视为错误
        if (metadata.verdict === "Success" || metadata.verdict === "Pass") {
          console.log(`❌ ${testDir}: 失败 (预期成功，但语法分析失败)`);
          failed++;
        } else if (metadata.verdict === "Fail") {
          console.log(`✅ ${testDir}: 通过 (预期失败，语法分析失败)`);
          passed++;
        } else {
          console.log(`⚠️  ${testDir}: 语法分析失败 (未知预期结果 "${metadata.verdict}")`);
        }
        continue;
      }

      const [crateNode] = parsed as [any, any];

      // 进行语义分析
      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyze(crateNode);

      // 根据预期结果判断测试是否通过
      if (metadata.verdict === "Success" || metadata.verdict === "Pass") {
        if (result.errors.length === 0) {
          console.log(`✅ ${testDir}: 通过 (预期成功，实际无错误)`);
          passed++;
        } else {
          console.log(`❌ ${testDir}: 失败 (预期成功，但有 ${result.errors.length} 个错误)`);
          console.log(`   错误信息:`);
          for (const error of result.errors) {
            console.log(`     - ${error.message}`);
          }
          failed++;
        }
      } else if (metadata.verdict === "Fail") {
        if (result.errors.length > 0) {
          console.log(`✅ ${testDir}: 通过 (预期失败，实际有 ${result.errors.length} 个错误)`);
          passed++;
        } else {
          console.log(`❌ ${testDir}: 失败 (预期失败，但无错误)`);
          failed++;
        }
      } else {
        console.log(`⚠️  ${testDir}: 未知的预期结果 "${metadata.verdict}"`);
      }
    } catch (error) {
      console.log(`❌ ${testDir}: 运行时错误 - ${error}`);
      failed++;
    }
  }
  
  console.log(`\n测试结果: ${passed} 通过, ${failed} 失败, 总计 ${passed + failed} 个测试用例`);
}

// 解析测试用例的元数据
function parseTestMetadata(sourceCode: string): { verdict: string } {
  // 查找注释中的 Verdict 字段
  const verdictMatch = sourceCode.match(/Verdict:\s*(\w+)/i);
  return {
    verdict: verdictMatch ? (verdictMatch[1] ?? "Unknown") : "Unknown"
  };
}

// 运行测试
const args = parseCommandLineArgs();
runSemantic1Tests(args).catch(console.error);