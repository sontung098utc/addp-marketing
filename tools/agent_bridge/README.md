# HƯỚNG DẪN VẬN HÀNH & ĐẶC TẢ KIẾN TRÚC CẦU NỐI AGENT BRIDGE

> **Mục tiêu**: Xây dựng cầu nối tự động hóa TDD, kết nối mô hình OpenAI (Lead Architect / Planner) với Engine thực thi cục bộ (Sandboxed Local Tool Harness) trên máy trạm của lập trình viên, hoạt động hoàn toàn độc lập trong thư mục sandbox và tuân thủ các quy chuẩn bảo mật Zero-Trust nghiêm ngặt.

---

## 1. Bản Chất Kiến Trúc Hệ Thống (Architectural Transparency)

Để bảo đảm tính trung thực tuyệt đối về mặt kỹ thuật:

```
[ Người dùng / Lập trình viên ]
             │
             ▼
   [ agent_bridge_runner.cjs ]  <─────── (Local Tool Execution Harness)
             │
   (Gửi Task Brief & Tool Schema)
             │
             ▼
      [ OpenAI API ]            <─────── (Mô hình AI DUY NHẤT: GPT-4o / GPT-4o-mini)
             │
   (Trả về Function Calls)
             │
             ▼
   [ agent_bridge_runner.cjs ]  <─────── (Bộ lọc bảo mật: Whitelist + Safe Env + Node Permission)
             │
 ┌───────────┴───────────┐
 ▼                       ▼
[ Ghi file nội bộ ]   [ Chạy Unit Test ]
(fs.writeFileSync)     (execSync: node --permission test.js)
```

### Điểm kỹ thuật cốt lõi cần làm rõ:
- **Chỉ có 01 mô hình AI duy nhất tham gia**: Đó là OpenAI API (`gpt-4o` hoặc `gpt-4o-mini`).
- **File runner là một Local Tool Execution Harness**:
  - Tại các dòng `635–726` của `agent_bridge_runner.cjs`, khi OpenAI trả về Function Call `write_file`, chính runner tự gọi hàm Node.js `fs.writeFileSync()` để ghi file.
  - Khi OpenAI trả về Function Call `run_test_command`, chính runner tự gọi `execSync()` với danh sách trắng lệnh để chạy unit test.
- **KHÔNG CÓ AI THỨ HAI nào chạy trong runner**: Runner không gọi thêm bất kỳ mô hình AI nào khác. "Antigravity" là môi trường IDE / Coding Assistant hỗ trợ lập trình viên trên máy trạm, không phải là một mô hình AI thứ hai chạy ngầm bên trong script `agent_bridge_runner.cjs`.

---

## 2. Các Lớp Bảo Mật Zero-Trust & Chứng Minh Thực Nghiệm

Hệ thống đã tích hợp 5 lớp bảo vệ kiểm soát tuyệt đối:

1. **Vùng cách ly độc lập (Strict Sandbox)**:
   - Toàn bộ thao tác đọc/ghi và chạy lệnh chỉ được phép diễn ra trong thư mục `sandbox/trial_task/`.
   - Hàm `validateSandboxPath()` tự động chuẩn hóa đường dẫn và chặn đứng mọi nỗ lực Path Traversal (`..`, truy cập `.git`, `.env*`, `src/`, `dist/`).
2. **Cách ly biến môi trường (Safe Environment)**:
   - Khi chạy lệnh kiểm thử, `safeEnv` chỉ truyền các biến hệ thống cơ bản (`PATH`, `SYSTEMROOT`, `TEMP`).
   - Biến môi trường nhạy cảm `OPENAI_API_KEY` bị loại trừ hoàn toàn khỏi tiến trình con, ngăn chặn tuyệt đối nguy cơ script kiểm thử đọc lén hoặc làm lộ khóa bí mật.
3. **Phân quyền cấp hệ thống Node.js (`--permission`)**:
   - Khi chạy test, runner tự động kích hoạt cờ `--permission` của Node.js:
     `--allow-fs-read="sandbox/trial_task/*" --allow-fs-write="sandbox/trial_task/*"`
   - Bất kỳ hành vi đọc/ghi tệp ngoài sandbox đều bị Node.js chặn đứng ở cấp C++ Runtime với lỗi `ERR_ACCESS_DENIED`.
   - Mặc định cấm hoàn toàn quyền sinh tiến trình con (`ChildProcess`) và luồng chạy ngầm (`Worker`).
4. **Bộ kiểm duyệt mã nguồn tĩnh (Static AST / Code Scan)**:
   - Hàm `validateTestScriptContent()` quét toàn bộ tệp test trước khi thực thi.
   - Chặn đứng ngay lập tức nếu phát hiện các module mạng (`http`, `https`, `net`, `dgram`, `fetch`, `axios`, `WebSocket`) hoặc module tiến trình (`child_process`, `worker_threads`, `cluster`).
5. **Chứng minh bằng bộ kiểm thử bảo mật tự động**:
   - Tệp kiểm thử tự động `tools/agent_bridge/test_security_sandbox.cjs` đã thực hiện 11 bài kiểm thử tấn công giả lập:
     - Chặn Path Traversal ghi tệp: **PASS**
     - Chặn Path Traversal đọc tệp: **PASS**
     - Chặn truy cập tệp `.env*`: **PASS**
     - Chặn tiêm lệnh shell (`;`, `|`): **PASS**
     - Chặn tiện ích nguy hiểm (`curl`, `powershell`, `rm`): **PASS**
     - Ngăn rò rỉ API Key sang tiến trình con: **PASS**
     - Ngăn đọc tệp bên ngoài bằng Node `--permission`: **PASS**
     - Ngăn sinh tiến trình con: **PASS**
     - Ngăn truy cập mạng qua `fetch()`: **PASS**

---

## 3. Quản Lý Phiên: Checkpoint, Resume & Reset

- **Cơ chế Checkpoint (`checkpoint.json`)**:
  - Trạng thái phiên làm việc (Session ID, vòng lặp hiện tại, toàn bộ tin nhắn, số token, tệp đã thay đổi) được lưu tự động sau mỗi vòng lặp tại `sandbox/trial_task/checkpoint.json`.
- **Tiếp tục phiên (`--resume`)**:
  - Không lặp lại các thao tác đã hoàn thành: Nếu Vòng 1 đã hoàn thành, khi resume hệ thống sẽ chuyển ngay sang Vòng 2.
  - Nếu nhiệm vụ đã hoàn tất 100% test pass, cờ `--resume` sẽ thông báo nhiệm vụ đã hoàn thành và dừng lại ngay lập tức mà không thực thi lặp lại.
- **Làm mới phiên (`--reset`)**:
  - Khi dùng `--reset`, hệ thống chỉ xóa tệp trạng thái `checkpoint.json` để sẵn sàng cho phiên mới.
  - **Bảo lưu lịch sử**: Toàn bộ hồ sơ kiểm tra (Audit JSON và Markdown) trong thư mục `sandbox/trial_task/audit/` **KHÔNG BAO GIỜ BỊ XÓA**, đảm bảo tính toàn vẹn của lịch sử kiểm tra.

---

## 4. Giới Hạn Vòng Lặp, Ngân Sách Token & Điều Kiện Dừng

| Thông số | Giá trị mặc định | Cấu hình qua CLI | Ý nghĩa |
|---|---|---|---|
| **Giới hạn số vòng lặp** | 3 vòng | `--max-loops=N` | Tối đa số chu kỳ TDD phản hồi giữa Manager và Harness |
| **Hạn mức Token tối đa** | 50,000 tokens | `--max-tokens=N` | Ngăn chặn vòng lặp vô tận gây tốn chi phí |
| **Mô hình AI** | `gpt-4o` | `--model=...` | Cho phép đổi sang `gpt-4o-mini` để tiết kiệm chi phí |
| **Chi phí ước tính** | Tự động tính | Báo cáo trong log & markdown audit | `gpt-4o`: $2.50 / $10.00 cho 1M token; `mini`: $0.15 / $0.60 |

### 5 Điều Kiện Dừng Cố Định (Hard Stop Conditions):
1. **Nhiệm vụ hoàn thành**: Lead Architect gọi tool `finish_task` với `all_tests_passed: true` (Trạng thái: `COMPLETED`).
2. **Chạm giới hạn vòng lặp**: Số vòng lặp vượt quá `MAX_LOOPS` (Trạng thái: `MAX_LOOPS_REACHED`).
3. **Vượt hạn mức ngân sách Token**: Tổng số token tích lũy vượt quá `MAX_TOKENS` (Trạng thái: `TOKEN_BUDGET_EXCEEDED`).
4. **Phát hiện vi phạm bảo mật**: Phát hiện lệnh lạ, truy cập ngoài sandbox, module cấm (Trạng thái: `SECURITY_HALTED`).
5. **Sự cố API / Hết Credit**: Nhận mã lỗi HTTP 429 hoặc lỗi mạng, tự động ghi checkpoint an toàn (Trạng thái: `PAUSED_ERROR`).

---

## 5. Hướng Dẫn Vận Hành Chi Tiết

### Bước 1: Cấu hình Khóa Bí Mật (Chỉ thực hiện trên máy cục bộ)
Sao chép tệp mẫu và cập nhật API Key của bạn:
```bash
cp tools/agent_bridge/.env.example .env.local
```
Mở `.env.local` và điền:
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
```
*(Tệp `.env.local` đã nằm trong `.gitignore`, không bao giờ được commit lên Git).*

### Bước 2: Chạy kiểm thử an toàn hộp cát (Security Test Suite)
```bash
node tools/agent_bridge/test_security_sandbox.cjs
```

### Bước 3: Chạy mô phỏng toàn trình không tốn credit (Simulation Mode)
```bash
node tools/agent_bridge/agent_bridge_runner.cjs --reset --simulate
```

### Bước 4: Chạy kết nối OpenAI API thật (Sau khi nạp credit trên OpenAI)
```bash
node tools/agent_bridge/agent_bridge_runner.cjs --reset
```

### Bước 5: Tiếp tục phiên sau khi dừng hoặc lỗi mạng
```bash
node tools/agent_bridge/agent_bridge_runner.cjs --resume
```

---

## 6. Hồ Sơ Bàn Giao Kèm Theo
- Mã nguồn chạy: `agent_bridge_runner.cjs`
- Bộ test bảo mật: `test_security_sandbox.cjs`
- Cấu hình mẫu: `.env.example`
- Hướng dẫn vận hành: `README.md`
- Nhật ký chạy thật (HTTP 429 Credit Exhausted): `logs/live_api_run.log`
- Nhật ký chạy mô phỏng (100% Pass TDD): `logs/simulate_run.log`
