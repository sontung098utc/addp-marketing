/**
 * ====================================================================
 * OPENAI ARCHITECT (LLM) + SANDBOXED LOCAL TOOL HARNESS (RUNNER)
 * File: tools/agent_bridge/agent_bridge_runner.cjs
 * 
 * KIẾN TRÚC HỆ THỐNG & ĐẶC TẢ THỰC TẾ:
 * 1. AI Model (Architect / Planner):
 *    - Sử dụng OpenAI API (mô hình gpt-4o hoặc gpt-4o-mini).
 *    - Chịu trách nhiệm thiết kế, ra quyết định kỹ thuật và phát sinh Function Calls.
 * 2. Local Tool Execution Harness (Worker Engine):
 *    - File runner này CHÍNH LÀ ENGINE THỰC THI CỤC BỘ (Local Tool Harness).
 *    - Runner tự mình xác thực tính an toàn, ghi file (fs.writeFileSync) và chạy test (execSync).
 *    - KHÔNG CÓ AI THỨ HAI nào chạy trong runner này (không gọi thêm LLM cục bộ nào khác).
 *    - Antigravity là IDE/AI pair-programmer mà người dùng đang mở trên máy tính.
 * 
 * QUY TẮC BẢO MẬT ZERO-TRUST:
 * - Vùng cách ly (Sandbox): Chỉ cho phép đọc/ghi trong sandbox/trial_task/.
 * - Ngăn chặn Path Traversal: Chặn ".." và đường dẫn trỏ ra ngoài sandbox.
 * - Danh sách trắng lệnh: Chỉ duy nhất 'node <test.js>' (hoặc .cjs) trong sandbox.
 * - Cách ly biến môi trường: Không truyền OPENAI_API_KEY hay biến hệ thống nhạy cảm sang tiến trình test.
 * - Bật cờ phân quyền Node.js (--permission): Khóa chặt quyền đọc/ghi file ngoài sandbox và cấm child_process.
 * - Quét tĩnh mã nguồn (Static Security Scan): Chặn module mạng (http/fetch) và module tiến trình con.
 * - Giới hạn chi phí & Token: Tự động tính toán chi phí USD và ngắt an toàn nếu vượt ngân sách.
 * - Checkpoint & Resume: Cho phép tiếp tục phiên mà không lặp lại thao tác đã xong; Reset không xóa audit.
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Resolve Root Paths & Environment
const projectRoot = path.resolve(__dirname, '../..');
const sandboxDir = path.resolve(projectRoot, 'sandbox', 'trial_task');
const auditDir = path.resolve(sandboxDir, 'audit');
const checkpointFile = path.resolve(sandboxDir, 'checkpoint.json');

// Ensure directories exist
if (!fs.existsSync(sandboxDir)) fs.mkdirSync(sandboxDir, { recursive: true });
if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });

// 2. Command Line Arguments
const args = process.argv.slice(2);
const isResume = args.includes('--resume');
const isReset = args.includes('--reset');
const isSimulate = args.includes('--simulate') || args.includes('--dry-run');
const maxLoopsArg = args.find(a => a.startsWith('--max-loops='));
const MAX_LOOPS = maxLoopsArg ? parseInt(maxLoopsArg.split('=')[1], 10) : 3;
const modelArg = args.find(a => a.startsWith('--model='));
const MODEL = modelArg ? modelArg.split('=')[1] : 'gpt-4o';
const maxTokensArg = args.find(a => a.startsWith('--max-tokens='));
const MAX_TOKENS = maxTokensArg ? parseInt(maxTokensArg.split('=')[1], 10) : 50000;

// Load API Key from .env.local or .env
function loadOpenAIKey() {
  const envLocalPath = path.resolve(projectRoot, '.env.local');
  const envPath = path.resolve(projectRoot, '.env');

  for (const f of [envLocalPath, envPath]) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('OPENAI_API_KEY=')) {
          return trimmed.substring('OPENAI_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
        }
      }
    }
  }
  return process.env.OPENAI_API_KEY || null;
}

const OPENAI_API_KEY = loadOpenAIKey();
if (!OPENAI_API_KEY && !isSimulate) {
  console.error('[FATAL] OPENAI_API_KEY không tìm thấy trong .env.local hoặc biến môi trường.');
  console.error('        Để chạy thử nghiệm không cần API Key, hãy dùng: node tools/agent_bridge/agent_bridge_runner.cjs --simulate');
  process.exit(1);
}

// 3. Security & Validation Guards
function validateSandboxPath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    throw new Error('SECURITY_ERROR: Đường dẫn tệp tin không hợp lệ.');
  }

  // Sanitize relative path
  const sanitized = relativePath.replace(/^(\.[\/\\])+/, '');
  const resolved = path.resolve(sandboxDir, sanitized);

  // Must strictly reside inside sandboxDir
  if (!resolved.startsWith(sandboxDir)) {
    throw new Error(`SECURITY_VIOLATION: Đường dẫn [${relativePath}] vượt ra ngoài thư mục sandbox.`);
  }

  // Deny sensitive files / system folders
  const basename = path.basename(resolved);
  if (basename.startsWith('.env') || basename.startsWith('.git')) {
    throw new Error(`SECURITY_VIOLATION: Truy cập thư mục/tệp cấm [${basename}].`);
  }

  const forbiddenKeywords = ['.git', 'node_modules', 'public', 'dist', 'src', 'tools'];
  for (const kw of forbiddenKeywords) {
    if (resolved.includes(path.sep + kw + path.sep) || resolved.endsWith(path.sep + kw) || basename === kw) {
      throw new Error(`SECURITY_VIOLATION: Truy cập thư mục/tệp cấm [${kw}].`);
    }
  }

  return resolved;
}

function validateTestScriptContent(scriptAbsPath) {
  if (!fs.existsSync(scriptAbsPath)) {
    throw new Error(`SECURITY_VIOLATION: Tệp kiểm thử [${path.basename(scriptAbsPath)}] không tồn tại.`);
  }
  const content = fs.readFileSync(scriptAbsPath, 'utf8');

  // Check 1: Forbidden networking imports / APIs
  const netPatterns = [
    /(?:import|require)\s*\(?['"](?:node:)?(?:https?|net|dgram|tls|dns|http2|axios|undici|node-fetch|ws|socket\.io)/i,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/
  ];
  for (const pat of netPatterns) {
    if (pat.test(content)) {
      throw new Error(`SECURITY_VIOLATION: Phát hiện hành vi cố gắng truy cập mạng trong mã kiểm thử (${pat}). Bị chặn.`);
    }
  }

  // Check 2: Forbidden child_process / worker_threads / cluster
  const processPatterns = [
    /(?:import|require)\s*\(?['"](?:node:)?(?:child_process|cluster|worker_threads)/i,
    /\bprocess\.binding\b/,
    /\bprocess\.kill\b/,
    /\bchild_process\b/
  ];
  for (const pat of processPatterns) {
    if (pat.test(content)) {
      throw new Error(`SECURITY_VIOLATION: Phát hiện hành vi sinh tiến trình con hoặc worker thread (${pat}). Bị chặn.`);
    }
  }

  return true;
}

function validateAndExecuteCommand(commandStr) {
  if (!commandStr || typeof commandStr !== 'string') {
    throw new Error('SECURITY_ERROR: Lệnh rỗng hoặc không đúng định dạng.');
  }

  const trimmed = commandStr.trim();

  // Strict whitelist regex: only `node <filename>.js` with optional arguments
  // Strictly disallow shell metacharacters: |, &, ;, <, >, $, `, \, \n
  if (/[;&|<>$`\r\n\\]/.test(trimmed)) {
    throw new Error(`SECURITY_VIOLATION: Lệnh chứa ký tự đặc biệt nguy hiểm: "${trimmed}"`);
  }

  // Disallow forbidden commands
  const dangerousCommands = [
    'rm', 'del', 'erase', 'rmdir', 'curl', 'wget', 'powershell', 'cmd',
    'bash', 'sh', 'ssh', 'git', 'net', 'reg', 'taskkill', 'format'
  ];
  const parts = trimmed.split(/\s+/);
  const exe = parts[0].toLowerCase();

  if (dangerousCommands.includes(exe)) {
    throw new Error(`SECURITY_VIOLATION: Lệnh [${exe}] nằm trong danh sách cấm tuyệt đối.`);
  }

  if (exe !== 'node') {
    throw new Error(`SECURITY_VIOLATION: Chỉ cho phép chạy lệnh [node <test_file.js>]. Đã từ chối [${exe}].`);
  }

  // Target file must be inside sandbox
  const targetScript = parts[1];
  if (!targetScript || !(targetScript.endsWith('.js') || targetScript.endsWith('.cjs'))) {
    throw new Error(`SECURITY_VIOLATION: Lệnh node phải chỉ định rõ tệp .js hoặc .cjs (ví dụ: node test_runner.js).`);
  }

  const scriptAbsPath = validateSandboxPath(targetScript);

  // Static AST / code pattern inspection before execution
  validateTestScriptContent(scriptAbsPath);

  // Sanitized environment: NEVER pass OPENAI_API_KEY or sensitive credentials to test processes
  const safeEnv = {
    PATH: process.env.PATH || '',
    SYSTEMROOT: process.env.SYSTEMROOT || '',
    COMSPEC: process.env.COMSPEC || '',
    PATHEXT: process.env.PATHEXT || '',
    TEMP: process.env.TEMP || '',
    TMP: process.env.TMP || '',
    NODE_ENV: 'test',
    NODE_OPTIONS: ''
  };

  // Node native permission arguments: lock down filesystem to sandboxDir only, disallow child processes & workers
  const sandboxPattern = `${sandboxDir}\\*`;
  const permissionArgs = [
    '--permission',
    `--allow-fs-read="${sandboxPattern}"`,
    `--allow-fs-read="${sandboxDir}"`,
    `--allow-fs-write="${sandboxPattern}"`,
    `--allow-fs-write="${sandboxDir}"`
  ];

  const secureCmd = `node ${permissionArgs.join(' ')} ${targetScript}`;

  // Execute strictly inside sandboxDir
  try {
    const stdout = execSync(secureCmd, {
      cwd: sandboxDir,
      timeout: 10000, // 10s max
      env: safeEnv,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      success: false,
      exitCode: err.status || 1,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || err.message || '').trim()
    };
  }
}

function calculateCost(model, promptTokens, completionTokens) {
  let inRate = 2.50 / 1e6; // $2.50 / 1M prompt tokens
  let outRate = 10.00 / 1e6; // $10.00 / 1M completion tokens
  if (model.includes('mini')) {
    inRate = 0.15 / 1e6;
    outRate = 0.60 / 1e6;
  }
  return Number(((promptTokens * inRate) + (completionTokens * outRate)).toFixed(6));
}

// 4. OpenAI Tools Definition (Manager Capabilities)
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Tạo hoặc cập nhật nội dung tệp tin mã nguồn / kiểm thử trong thư mục sandbox độc lập.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Đường dẫn tương đối trong sandbox (ví dụ: phone_validator.js, test_validator.js)'
          },
          content: {
            type: 'string',
            description: 'Toàn bộ nội dung tệp tin cần ghi'
          },
          purpose: {
            type: 'string',
            description: 'Mục đích của việc tạo/sửa file này'
          }
        },
        required: ['file_path', 'content', 'purpose']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Đọc nội dung tệp tin hiện có trong sandbox.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Đường dẫn tương đối của file cần đọc'
          }
        },
        required: ['file_path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'Liệt kê các tệp tin hiện có trong sandbox.',
      parameters: {
        type: 'object',
        properties: {
          sub_dir: {
            type: 'string',
            description: 'Thư mục con cần liệt kê (để trống nếu xem thư mục gốc của sandbox)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_test_command',
      description: 'Chạy lệnh kiểm thử đơn vị trong sandbox (chỉ cho phép: node <file_test.js>).',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Lệnh chạy test, ví dụ: node test_validator.js'
          }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'finish_task',
      description: 'Báo cáo hoàn thành nhiệm vụ khi toàn bộ unit test đã PASS và chức năng đạt yêu cầu.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Tóm tắt giải pháp đã xây dựng và kết quả kiểm thử'
          },
          all_tests_passed: {
            type: 'boolean',
            description: 'True nếu 100% test cases đã pass thành công'
          }
        },
        required: ['summary', 'all_tests_passed']
      }
    }
  }
];

// 5. System Prompt for OpenAI Manager
const SYSTEM_PROMPT = `Bạn là Giám đốc kỹ thuật (Lead Software Architect / Manager).
Bạn đang chỉ đạo một Kỹ sư tự động (Antigravity Worker Engine) trên máy trạm của người dùng.

QUY TẮC BẮT BUỘC (CRITICAL RULES):
1. PHẠM VI CÔ LẬP (SANDBOX ONLY): Mọi thao tác đọc/ghi file và chạy lệnh chỉ được phép diễn ra trong thư mục độc lập (sandbox/trial_task). Tuyệt đối không chạm đến mã nguồn chính hoặc production.
2. PHƯƠNG PHÁP TDD (Test-Driven Development):
   - Vòng 1: Tạo file test trước (test cases) và file skeleton ban đầu. Chạy test để thấy test FAIL (Red).
   - Vòng 2: Phân tích log test fail, viết code hoàn thiện chức năng và chạy lại test để test PASS (Green).
   - Vòng 3: Tối ưu, bổ sung edge cases, kiểm tra lại và gọi tool finish_task.
3. GIỚI HẠN VÒNG LẶP: Bạn có tối đa 3 vòng lặp. Phải hoàn thành nghiệm thu trước hoặc tại vòng 3.
4. LỆNH KIỂM THỬ: Chỉ được dùng lệnh dạng 'node <file_test.js>'. Tuyệt đối không dùng bash, sh, rm, curl.
5. CHUẨN ES MODULES: Dự án chạy Node.js ESM ("type": "module"). Khi viết file .js, bắt buộc dùng cú pháp 'import assert from "node:assert"' và 'export function ...' (không dùng require / module.exports).
6. GIAO TIẾP: Trả lời ngắn gọn, nêu rõ lý do kỹ thuật và gọi các tool tương ứng.`;

// 6. Trial Task Specification
const TRIAL_TASK_BRIEF = `[NHIỆM VỤ THỬ NGHIỆM ĐỘC LẬP]
Hãy xây dựng một module tiện ích chuẩn Node.js ES Modules tên là 'vietnam_phone_normalizer.js' cùng bộ unit test 'test_phone_normalizer.js' với các yêu cầu sau:
1. Hàm normalizePhoneNumber(raw):
   - Nhận vào chuỗi SĐT người dùng nhập (có thể chứa khoảng trắng, dấu chấm, gạch nối, tiền tố +84, 84 hoặc 0).
   - Chuẩn hóa về định dạng chuẩn 10 chữ số bắt đầu bằng 0 (ví dụ: "+84 912-345-678" -> "0912345678", "84988.111.222" -> "0988111222").
   - Hợp lệ: Đầu số di động Việt Nam phổ biến (03, 05, 07, 08, 09) và đúng 10 chữ số. Trả về { valid: true, phone: "09xxxxxxxx", carrier: "Viettel" | "Vinaphone" | "Mobifone" | "Vietnamobile" | "Gmobile" | "Other" }.
   - Không hợp lệ: Số bàn, thiếu/thừa số, chứa ký tự chữ -> Trả về { valid: false, phone: null, carrier: null, error: "REASON" }.
2. Hàm maskPhoneNumber(phone):
   - Giấu 3 số giữa để bảo mật thông tin (ví dụ: "0912345678" -> "091***5678").
3. Định dạng mã nguồn: Dùng ES Modules (export / import).
4. Bộ unit test tự viết không phụ thuộc thư viện ngoài (dùng assert của node:assert). Khi chạy 'node test_phone_normalizer.js', in ra chi tiết các test pass/fail và exit(0) nếu pass hết, exit(1) nếu có lỗi.

Hãy bắt đầu Vòng 1 bằng việc tạo bộ test và khung module!`;

// 7. OpenAI API Call Function
async function callOpenAI(messages) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: MODEL,
    messages: messages,
    tools: TOOLS,
    tool_choice: 'auto',
    temperature: 0.2
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI API Error HTTP ${resp.status}: ${errText}`);
  }

  return await resp.json();
}

// 7.1. Simulated Manager Generator (For offline verification or dry-run)
function getSimulatedManagerResponse(loop) {
  if (loop === 1) {
    return {
      usage: { prompt_tokens: 820, completion_tokens: 285, total_tokens: 1105 },
      choices: [{
        message: {
          role: 'assistant',
          content: 'Chào Worker. Tôi là Lead Architect. Theo phương pháp TDD, trước hết chúng ta sẽ tạo bộ unit test toàn diện cho module vietnam_phone_normalizer.js và khung hàm ban đầu. Sau đó chúng ta sẽ chạy test để xác nhận trạng thái RED (fail).',
          tool_calls: [
            {
              id: 'call_step1_test',
              type: 'function',
              function: {
                name: 'write_file',
                arguments: JSON.stringify({
                  file_path: 'test_phone_normalizer.js',
                  purpose: 'Tạo bộ kiểm thử đơn vị độc lập kiểm tra chuẩn hóa và ẩn số điện thoại VN',
                  content: `import assert from 'node:assert';
import { normalizePhoneNumber, maskPhoneNumber } from './vietnam_phone_normalizer.js';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(\`  ✓ [PASS] \${name}\`);
    passed++;
  } catch (e) {
    console.log(\`  ✗ [FAIL] \${name}: \${e.message}\`);
    failed++;
  }
}

console.log('=== RUNNING VIETNAM PHONE NORMALIZER UNIT TESTS ===');

runTest('Chuẩn hóa số di động Viettel có tiền tố +84', () => {
  const res = normalizePhoneNumber('+84 988-123-456');
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.phone, '0988123456');
  assert.strictEqual(res.carrier, 'Viettel');
});

runTest('Chuẩn hóa số di động Vinaphone có dấu chấm', () => {
  const res = normalizePhoneNumber('84.912.333.444');
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.phone, '0912333444');
  assert.strictEqual(res.carrier, 'Vinaphone');
});

runTest('Chuẩn hóa số Mobifone đầu 07', () => {
  const res = normalizePhoneNumber('079 888 9999');
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.phone, '0798889999');
  assert.strictEqual(res.carrier, 'Mobifone');
});

runTest('Từ chối số điện thoại bàn', () => {
  const res = normalizePhoneNumber('024 3822 1234');
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.phone, null);
});

runTest('Từ chối số có ký tự chữ', () => {
  const res = normalizePhoneNumber('0912abc456');
  assert.strictEqual(res.valid, false);
});

runTest('Ẩn số điện thoại 3 số giữa', () => {
  const masked = maskPhoneNumber('0988123456');
  assert.strictEqual(masked, '098***3456');
});

console.log(\`\\nKẾT QUẢ: \${passed} PASSED, \${failed} FAILED\`);
if (failed > 0) process.exit(1);
process.exit(0);
`
                })
              }
            },
            {
              id: 'call_step1_skeleton',
              type: 'function',
              function: {
                name: 'write_file',
                arguments: JSON.stringify({
                  file_path: 'vietnam_phone_normalizer.js',
                  purpose: 'Khung hàm ban đầu chưa hoàn thiện (để kiểm tra Red Phase)',
                  content: `export function normalizePhoneNumber(raw) {
  // Skeleton implementation (will fail unit tests initially)
  return { valid: false, phone: null, carrier: null, error: 'NOT_IMPLEMENTED' };
}

export function maskPhoneNumber(phone) {
  return '***';
}
`
                })
              }
            },
            {
              id: 'call_step1_run',
              type: 'function',
              function: {
                name: 'run_test_command',
                arguments: JSON.stringify({
                  command: 'node test_phone_normalizer.js'
                })
              }
            }
          ]
        }
      }]
    };
  }

  if (loop === 2) {
    return {
      usage: { prompt_tokens: 1250, completion_tokens: 410, total_tokens: 1660 },
      choices: [{
        message: {
          role: 'assistant',
          content: 'Nhận được kết quả test thất bại đúng như kỳ vọng ở giai đoạn Red. Bây giờ tôi sẽ cập nhật code đầy đủ trong vietnam_phone_normalizer.js để xử lý chuẩn hóa regex, loại bỏ ký tự không phải số, nhận diện nhà mạng theo dải đầu số (03, 05, 07, 08, 09) và ẩn 3 số giữa.',
          tool_calls: [
            {
              id: 'call_step2_impl',
              type: 'function',
              function: {
                name: 'write_file',
                arguments: JSON.stringify({
                  file_path: 'vietnam_phone_normalizer.js',
                  purpose: 'Triển khai hoàn chỉnh logic chuẩn hóa và phân loại nhà mạng',
                  content: `const CARRIERS = {
  Viettel: ['086', '096', '097', '098', '032', '033', '034', '035', '036', '037', '038', '039'],
  Vinaphone: ['088', '091', '094', '081', '082', '083', '084', '085'],
  Mobifone: ['089', '090', '093', '070', '079', '077', '076', '078'],
  Vietnamobile: ['092', '056', '058'],
  Gmobile: ['099', '059']
};

export function detectCarrier(phone10) {
  const prefix3 = phone10.substring(0, 3);
  for (const [carrier, prefixes] of Object.entries(CARRIERS)) {
    if (prefixes.includes(prefix3)) {
      return carrier;
    }
  }
  return 'Other';
}

export function normalizePhoneNumber(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { valid: false, phone: null, carrier: null, error: 'EMPTY_INPUT' };
  }

  // Remove common separators and spaces
  let cleaned = raw.replace(/[\\s\\.\\-\\(\\)]/g, '');

  // Reject if contains any non-digit other than leading '+'
  if (!/^\\+?\\d+$/.test(cleaned)) {
    return { valid: false, phone: null, carrier: null, error: 'INVALID_CHARACTERS' };
  }

  // Normalize prefix +84 or 84 to 0
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.substring(2);
  }

  // Must be strictly 10 digits starting with 0
  if (!/^0[35789]\\d{8}$/.test(cleaned)) {
    return { valid: false, phone: null, carrier: null, error: 'INVALID_MOBILE_PREFIX_OR_LENGTH' };
  }

  const carrier = detectCarrier(cleaned);
  return {
    valid: true,
    phone: cleaned,
    carrier: carrier,
    error: null
  };
}

export function maskPhoneNumber(phone) {
  if (typeof phone !== 'string') return '';
  const digits = phone.replace(/\\D/g, '');
  if (digits.length !== 10) return phone;
  return digits.substring(0, 3) + '***' + digits.substring(6);
}
`
                })
              }
            },
            {
              id: 'call_step2_run',
              type: 'function',
              function: {
                name: 'run_test_command',
                arguments: JSON.stringify({
                  command: 'node test_phone_normalizer.js'
                })
              }
            }
          ]
        }
      }]
    };
  }

  return {
    usage: { prompt_tokens: 1720, completion_tokens: 130, total_tokens: 1850 },
    choices: [{
      message: {
        role: 'assistant',
        content: 'Tất cả các unit tests đã PASS 100%! Module vietnam_phone_normalizer.js hoạt động chính xác theo đúng đặc tả kỹ thuật, bảo đảm chuẩn hóa sạch, phát hiện nhà mạng chuẩn xác và bảo mật che số điện thoại. Tôi tiến hành nghiệm thu hoàn thành.',
        tool_calls: [
          {
            id: 'call_step3_finish',
            type: 'function',
            function: {
              name: 'finish_task',
              arguments: JSON.stringify({
                summary: 'Đã hoàn thành module vietnam_phone_normalizer.js với 6/6 unit test cases vượt qua thành công trong sandbox cô lập.',
                all_tests_passed: true
              })
            }
          }
        ]
      }
    }]
  };
}

// 8. Main Execution Loop
async function main() {
  console.log('====================================================================');
  console.log('  OPENAI ARCHITECT (LLM) + SANDBOXED LOCAL TOOL HARNESS (RUNNER)');
  console.log('  AI Model: ' + (isSimulate ? 'EMULATED_OPENAI_GPT4O' : MODEL));
  console.log('  Local Execution Engine: Node.js Isolated Sandbox Harness');
  console.log('  Sandbox Directory: ' + sandboxDir);
  console.log('  Max Iteration Loops: ' + MAX_LOOPS + ' | Token Budget: ' + MAX_TOKENS);
  console.log('====================================================================\n');

  let state = {
    sessionId: 'session_' + new Date().toISOString().replace(/[:.]/g, '-'),
    loop: 1,
    status: 'IN_PROGRESS',
    messages: [],
    auditLogs: [],
    changesRecorded: [],
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0
    }
  };

  // Handle Reset / Resume
  if (isReset && fs.existsSync(checkpointFile)) {
    console.log('[RESET] Xóa checkpoint cũ để bắt đầu phiên mới...');
    console.log('[RESET] Lưu ý: Toàn bộ lịch sử báo cáo trong audit/ vẫn được bảo lưu an toàn.');
    fs.rmSync(checkpointFile);
  } else if (isResume && fs.existsSync(checkpointFile)) {
    console.log('[RESUME] Đang tải trạng thái từ checkpoint.json...');
    try {
      state = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
      console.log(`[RESUME] Khôi phục thành công. Phiên: ${state.sessionId}, Trạng thái: ${state.status}, Tiếp tục từ vòng lặp: ${state.loop}`);
      if (state.status === 'COMPLETED') {
        console.log('[RESUME] Nhiệm vụ trong checkpoint đã HOÀN THÀNH trước đó (100% test pass). Không lặp lại.');
        return;
      }
    } catch (e) {
      console.warn('[RESUME] Checkpoint hỏng, khởi tạo phiên mới.');
    }
  }

  // Initial Message Setup if starting fresh
  if (state.messages.length === 0) {
    state.messages.push({ role: 'system', content: SYSTEM_PROMPT });
    state.messages.push({ role: 'user', content: TRIAL_TASK_BRIEF });
  }

  const sessionAuditJson = path.resolve(auditDir, `${state.sessionId}.json`);
  const sessionAuditMd = path.resolve(auditDir, `${state.sessionId}.md`);

  let taskCompleted = false;

  while (state.loop <= MAX_LOOPS && !taskCompleted) {
    console.log(`\n--------------------------------------------------------------------`);
    console.log(`>>> VÒNG LẶP ${state.loop} / ${MAX_LOOPS} - MANAGER (OPENAI) ĐANG TƯ DUY...`);
    console.log(`--------------------------------------------------------------------`);

    const loopAuditEntry = {
      loop: state.loop,
      timestamp: new Date().toISOString(),
      managerPromptTokens: null,
      managerResponse: null,
      workerActions: []
    };

    let aiResponse;
    try {
      if (isSimulate) {
        aiResponse = getSimulatedManagerResponse(state.loop);
      } else {
        aiResponse = await callOpenAI(state.messages);
      }
    } catch (apiErr) {
      console.error(`\n[LỖI GỌI OPENAI]:`, apiErr.message);
      if (apiErr.message.includes('insufficient_quota') || apiErr.message.includes('credit_balance_exhausted')) {
        console.log('\n💡 [HƯỚNG DẪN]: Tài khoản OpenAI hiện chưa nạp credits ($0 balance).');
        console.log('   Bạn có thể nạp thêm credits tại: https://platform.openai.com/settings/organization/billing');
        console.log('   HOẶC chạy chế độ kiểm nghiệm mô phỏng toàn trình ngay bây giờ:');
        console.log('   node tools/agent_bridge/agent_bridge_runner.cjs --simulate\n');
      }
      state.status = 'PAUSED_ERROR';
      fs.writeFileSync(checkpointFile, JSON.stringify(state, null, 2), 'utf8');
      console.log('[CHECKPOINT] Đã lưu trạng thái. Chạy lại với --resume để tiếp tục.');
      process.exitCode = 1;
      return;
    }

    const choice = aiResponse.choices[0];
    const assistantMessage = choice.message;
    state.messages.push(assistantMessage);

    if (aiResponse.usage) {
      const p = aiResponse.usage.prompt_tokens || 0;
      const c = aiResponse.usage.completion_tokens || 0;
      const t = aiResponse.usage.total_tokens || (p + c);
      state.usage.promptTokens += p;
      state.usage.completionTokens += c;
      state.usage.totalTokens += t;
      state.usage.estimatedCostUsd = calculateCost(MODEL, state.usage.promptTokens, state.usage.completionTokens);

      loopAuditEntry.tokens = { promptTokens: p, completionTokens: c, totalTokens: t };
      console.log(`[TOKEN & CHI PHÍ]: Vòng này: ${t} tokens | Tích lũy: ${state.usage.totalTokens} tokens (~$${state.usage.estimatedCostUsd})`);
    }

    // Budget limit enforcement
    if (state.usage.totalTokens > MAX_TOKENS) {
      console.warn(`\n⚠️ [GIỚI HẠN VƯỢT MỨC]: Đã vượt hạn mức token tối đa (${state.usage.totalTokens} > ${MAX_TOKENS}). Buộc dừng an toàn.`);
      state.status = 'TOKEN_BUDGET_EXCEEDED';
      fs.writeFileSync(checkpointFile, JSON.stringify(state, null, 2), 'utf8');
      generateMarkdownAudit(sessionAuditMd, state);
      fs.writeFileSync(sessionAuditJson, JSON.stringify(state, null, 2), 'utf8');
      return;
    }

    loopAuditEntry.managerResponse = assistantMessage;
    if (assistantMessage.content) {
      console.log(`\n[MANAGER PHẢN HỒI]:\n${assistantMessage.content}\n`);
    }

    const toolCalls = assistantMessage.tool_calls || [];

    if (toolCalls.length === 0) {
      console.log('[MANAGER]: Không có hành động tool nào được gọi.');
    }

    for (const toolCall of toolCalls) {
      const fnName = toolCall.function.name;
      let args = {};
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (pe) {
        args = {};
      }

      console.log(`\n[WORKER KIỂM TRA PHẠM VI]: Yêu cầu thực thi tool [${fnName}]`);

      let toolResult = null;
      let isAllowed = true;
      let violationMsg = null;

      try {
        if (fnName === 'write_file') {
          const target = validateSandboxPath(args.file_path);
          console.log(`  -> Ghi file: sandbox/trial_task/${path.basename(target)} (${args.purpose})`);
          fs.writeFileSync(target, args.content, 'utf8');
          state.changesRecorded.push({
            file: path.relative(sandboxDir, target),
            timestamp: new Date().toISOString(),
            purpose: args.purpose,
            bytes: args.content.length
          });
          toolResult = {
            success: true,
            file: path.relative(sandboxDir, target),
            bytes_written: args.content.length,
            message: `Ghi file thành công: ${path.relative(sandboxDir, target)}`
          };
        } else if (fnName === 'read_file') {
          const target = validateSandboxPath(args.file_path);
          console.log(`  -> Đọc file: sandbox/trial_task/${path.basename(target)}`);
          if (!fs.existsSync(target)) {
            toolResult = { success: false, error: 'FILE_NOT_FOUND', message: 'Tệp không tồn tại.' };
          } else {
            const content = fs.readFileSync(target, 'utf8');
            toolResult = { success: true, file: args.file_path, content: content };
          }
        } else if (fnName === 'list_files') {
          const target = validateSandboxPath(args.sub_dir || '.');
          const entries = fs.readdirSync(target, { withFileTypes: true });
          const fileList = entries.map(e => (e.isDirectory() ? `[DIR] ${e.name}` : e.name));
          console.log(`  -> Liệt kê file: ${fileList.length} mục`);
          toolResult = { success: true, files: fileList };
        } else if (fnName === 'run_test_command') {
          console.log(`  -> Chạy kiểm thử: ${args.command}`);
          const execRes = validateAndExecuteCommand(args.command);
          if (execRes.success) {
            console.log(`  [TEST PASS]:\n${execRes.stdout}`);
          } else {
            console.log(`  [TEST FAIL - Exit Code ${execRes.exitCode}]:\nSTDOUT: ${execRes.stdout}\nSTDERR: ${execRes.stderr}`);
          }
          toolResult = execRes;
        } else if (fnName === 'finish_task') {
          console.log(`\n🎉 [MANAGER BÁO CÁO HOÀN THÀNH NHIỆM VỤ]:`);
          console.log(`  Tổng kết: ${args.summary}`);
          console.log(`  Toàn bộ test pass: ${args.all_tests_passed}`);
          taskCompleted = Boolean(args.all_tests_passed);
          toolResult = {
            acknowledged: true,
            session_status: taskCompleted ? 'COMPLETED' : 'REQUIRES_FURTHER_TESTS'
          };
        } else {
          isAllowed = false;
          violationMsg = `Tool [${fnName}] không nằm trong whitelist cho phép.`;
          toolResult = { success: false, error: 'UNKNOWN_TOOL', message: violationMsg };
        }
      } catch (err) {
        isAllowed = false;
        violationMsg = err.message;
        console.error(`  ❌ [TỪ CHỐI THỰC THI]: ${err.message}`);
        toolResult = { success: false, error: 'SECURITY_VALIDATION_FAILED', message: err.message };
      }

      loopAuditEntry.workerActions.push({
        toolName: fnName,
        arguments: args,
        isAllowed: isAllowed,
        violation: violationMsg,
        result: toolResult
      });

      // Feed tool result back into conversation
      state.messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult)
      });
    }

    state.auditLogs.push(loopAuditEntry);

    // Save checkpoint after each loop
    state.loop++;
    if (taskCompleted) {
      state.status = 'COMPLETED';
    } else if (state.loop > MAX_LOOPS) {
      state.status = 'MAX_LOOPS_REACHED';
    }
    fs.writeFileSync(checkpointFile, JSON.stringify(state, null, 2), 'utf8');

    // Generate Markdown Audit Dossier
    generateMarkdownAudit(sessionAuditMd, state);
    fs.writeFileSync(sessionAuditJson, JSON.stringify(state, null, 2), 'utf8');
  }

  console.log('\n====================================================================');
  console.log(`KẾT THÚC PHIÊN THỬ NGHIỆM: Trạng thái: ${state.status}`);
  console.log(`Tổng số thay đổi ghi nhận: ${state.changesRecorded.length} tệp`);
  console.log(`Hồ sơ lưu trữ kiểm tra (Audit JSON): ${sessionAuditJson}`);
  console.log(`Báo cáo chi tiết (Audit Markdown): ${sessionAuditMd}`);
  console.log('====================================================================\n');
}

function generateMarkdownAudit(mdPath, state) {
  let md = `# BÁO CÁO PHIÊN THỬ NGHIỆM: OPENAI ARCHITECT (LLM) + SANDBOXED LOCAL TOOL HARNESS\n\n`;
  md += `> **Tuyên bố Kiến trúc**: Hệ thống chỉ kết nối tới duy nhất 01 mô hình AI là OpenAI API (${isSimulate ? 'EMULATED_OPENAI_GPT4O' : MODEL}). File runner đóng vai trò là một Local Tool Execution Harness cục bộ, tự động kiểm tra bảo mật và thực thi Function Calls (ghi file, chạy test) trong sandbox độc lập. Không có mô hình AI thứ hai tham gia trong quá trình chạy script này.\n\n`;
  md += `- **Phiên làm việc (Session ID)**: \`${state.sessionId}\`\n`;
  md += `- **Trạng thái**: **${state.status}**\n`;
  md += `- **Mô hình AI**: \`${isSimulate ? 'EMULATED_OPENAI_GPT4O' : MODEL}\`\n`;
  md += `- **Số vòng phản hồi thực tế**: ${state.loop - 1} / ${MAX_LOOPS}\n`;
  md += `- **Thời gian cập nhật**: ${new Date().toISOString()}\n\n`;

  md += `## 1. Thống Kê Tiêu Thụ Token & Chi Phí Ước Tính\n\n`;
  if (state.usage) {
    md += `| Chỉ số | Giá trị |\n|---|---|\n`;
    md += `| **Prompt Tokens** | ${state.usage.promptTokens.toLocaleString()} |\n`;
    md += `| **Completion Tokens** | ${state.usage.completionTokens.toLocaleString()} |\n`;
    md += `| **Tổng Tokens** | **${state.usage.totalTokens.toLocaleString()}** (Giới hạn: ${MAX_TOKENS.toLocaleString()}) |\n`;
    md += `| **Chi phí ước tính (USD)** | **$${state.usage.estimatedCostUsd}** |\n\n`;
  } else {
    md += `*Chưa có dữ liệu thống kê token.*\n\n`;
  }

  md += `## 2. Tệp tin tạo/sửa trong Sandbox (\`sandbox/trial_task/\`)\n\n`;
  if (state.changesRecorded.length === 0) {
    md += `*Chưa có tệp tin nào được tạo.*\n\n`;
  } else {
    md += `| Tệp tin | Mục đích | Kích thước |\n|---|---|---|\n`;
    for (const ch of state.changesRecorded) {
      md += `| \`${ch.file}\` | ${ch.purpose || 'N/A'} | ${ch.bytes} bytes |\n`;
    }
    md += `\n`;
  }

  md += `## 3. Nhật ký tương tác từng vòng (Audit Trail)\n\n`;
  for (const log of state.auditLogs) {
    md += `### Vòng lặp ${log.loop} (${log.timestamp})\n\n`;
    if (log.tokens) {
      md += `*Tiêu thụ vòng này: ${log.tokens.totalTokens} tokens (${log.tokens.promptTokens} in / ${log.tokens.completionTokens} out)*\n\n`;
    }
    if (log.managerResponse && log.managerResponse.content) {
      md += `**Chỉ đạo từ Manager (OpenAI):**\n> ${log.managerResponse.content.replace(/\n/g, '\n> ')}\n\n`;
    }

    md += `**Hành động Local Harness đã thực thi & xác thực bảo mật:**\n\n`;
    for (const act of log.workerActions) {
      const badge = act.isAllowed ? '✅ **ĐƯỢC PHÉP**' : '⛔ **TỪ CHỐI**';
      md += `- ${badge}: Gọi tool \`${act.toolName}\`\n`;
      if (act.violation) {
        md += `  - *Lý do chặn an toàn*: ${act.violation}\n`;
      }
      md += `  - *Kết quả*: \`\`\`json\n${JSON.stringify(act.result, null, 2)}\n\`\`\`\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync(mdPath, md, 'utf8');
}

main().catch(err => {
  console.error('[FATAL EXCEPTION]:', err);
  process.exit(1);
});
