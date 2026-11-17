# KIỂM TOÁN P0 RELEASE TRƯỚC PRODUCTION
Ngày kiểm toán: 10/10/2026
Hệ thống: marketing.addp.vn
Kết luận: **NO-GO — chưa triển khai production gói hiện tại.**

## Phạm vi và mức độ xác minh
Đã đọc ZIP thực tế, 8 migration SQL (4 forward, 4 rollback), webhook controller/service, CLI worker, orchestrator, luồng sync/report và tài liệu master handover. Không SSH, không gọi production, không sửa gói gốc.
Đây là kiểm toán mã nguồn và cấu trúc gói. Môi trường hiện tại không có PHP/MariaDB CLI; chưa chạy php -l, migration trên DB thật, kiểm thử PHP hay benchmark. Không xác nhận lại kết quả 67/67 PASS.
Gói không có 6 test suite, source React, hoặc 9 tài liệu riêng được nêu trong handover. Chưa kết luận các tài liệu đó không tồn tại ở repository Antigravity; chỉ xác nhận chưa có trong bộ artifact nhận được.

## Kết quả kiểm tra gói
- SHA-256 ZIP: 4ff4860847f12f226b41a0db826b8db86e7e5dd3fadb72b4e10d1efeff256d3e — khớp.
- 56 entry trong ZIP; 36 file PHP.
- Cả 8 SHA-256 migration khớp danh mục trong handover.
- Không có api/db.php, api/config.php, .env; đây là phụ thuộc cấu hình hiện hữu cần kiểm tra trước triển khai.
- Không thấy đường dẫn tuyệt đối hoặc ../ trong tên entry ZIP.
- Khớp mã băm chỉ xác minh đúng artifact, không chứng minh artifact hoạt động đúng hoặc an toàn.

## Các lỗi và rủi ro
Mức Critical: bảo mật/mất dữ liệu. High: chặn vận hành hoặc sai số liệu. Medium: điều kiện triển khai/bằng chứng còn thiếu. Các dòng dưới đây theo file bên trong ZIP.

### F01 — Critical: webhook bỏ qua xác thực khi thiếu secret
Bằng chứng: api/commerce_webhook_service.php:140–151 chỉ kiểm tra chữ ký trong if (!empty($this->appSecret)). Nếu secret null/rỗng, processEvent tiếp tục ghi inbox và xử lý nghiệp vụ, kể cả production. verifySignature có nhánh APP_ENV nhưng processEvent không gọi nó trong trường hợp này.
Tác động: cấu hình thiếu secret có thể cho phép yêu cầu không ký sửa đơn hoặc xử lý DEAUTHORIZE.
Sửa: thiếu secret phải dừng và trả lỗi cấu hình; luôn gọi kiểm tra chữ ký. Test production secret null/rỗng, signature thiếu/sai đều phải không ghi DB.

### F02 — Critical: API xem dữ liệu xóa video theo campaign cố định
Bằng chứng: api/sync.php:53–57 có DELETE tiktok_video_ads, gồm campaign_id NOT IN ba ID cố định; không nằm trong guard forceSync.
Tác động: một lần xem dữ liệu có thể xóa video thật thuộc campaign mới/khác; không giới hạn shop. Điều kiện tên video ở DELETE đầu cũng có thể trùng tên thật.
Sửa: bỏ DELETE khỏi API đọc. Nếu cần làm sạch dữ liệu giả, dùng migration riêng với provenance xác định, preview danh sách, sao lưu và phạm vi tenant; không suy ra dữ liệu giả từ campaign whitelist.

### F03 — High: CLI worker không tìm được cấu hình trong cấu trúc release
Bằng chứng: tools/sync_worker_cli.php:55–68 thử tools/../public/api, tools/api, tools/public/api rồi fallback tools. Gói release có api/ ở ngang hàng tools/, nên đường dẫn đúng là __DIR__.'/../api', nhưng không được thử.
Tác động: chạy php public_html/tools/sync_worker_cli.php --cron không tìm được config.php trong cấu trúc bàn giao tiêu chuẩn; cron và background sync có thể chết.
Sửa: hỗ trợ ../api, kiểm tra đủ config/db/orchestrator, thông báo rõ lỗi. Smoke test từ gói giải nén, thêm config/db staging hợp lệ, chạy bằng PHP 8.2 với cwd khác webroot.

### F04 — High: hàm được gọi không có định nghĩa trong gói
Bằng chứng: syncDailyReportsToDatabase được gọi tại api/sync.php:61 và api/gemini_analyze.php:1377,1386. Tìm toàn bộ PHP trong ZIP không có định nghĩa; api/creatives_data.php hiện tại không cung cấp hàm này.
Tác động: nếu config/db hiện hữu không định nghĩa hàm ngoài gói, các luồng này sẽ lỗi Call to undefined function. sync.php còn chạy DELETE trước điểm lỗi.
Sửa: làm rõ hợp đồng dependency; khôi phục hàm phù hợp hoặc loại bỏ lời gọi. Chạy endpoint tích hợp với config/db staging thật. Không dùng stub no-op chỉ để pass.

### F05 — Critical: rollback 016 xóa bảng
Bằng chứng: database/migrations/20261005_016_rollback_create_commerce_sync_jobs.sql có DROP TABLE IF EXISTS commerce_sync_jobs.
Tác động: mất lịch sử job/checkpoint khi chạy rollback này. Mâu thuẫn với cam kết rollback không DROP TABLE.
Sửa: rollback code trước, giữ bảng additive hoặc archive có quy trình restore; dừng writer trước rollback. Không chạy script rollback 016 hiện tại trên production.

### F06 — High: inbox không bảo đảm lưu bền vững, không có Fast ACK thật
Bằng chứng: commerce_webhook_service.php:587–589 và 628–630 trả is_duplicate=false nếu thiếu bảng hoặc ghi inbox lỗi. processEvent:201–252 chạy handler và cập nhật status rồi mới trả kết quả cho webhook.php. Không có worker xử lý PENDING/FAILED inbox trong tools/sync_worker_cli.php hoặc orchestrator.
Tác động: nghiệp vụ có thể được ghi dù không có inbox; response thành công không bảo đảm audit record. Xử lý đồng bộ có thể timeout; FAILED không được tự thử lại bởi inbox worker.
Sửa: ACK sau insert durable thành công; lỗi ghi inbox phải trả non-2xx. Worker claim event, retry/backoff/dead-letter, đo ACK latency.

### F07 — High: dedup và thứ tự cập nhật không nguyên tử
Bằng chứng: recordInboxEvent SELECT status rồi INSERT ON DUPLICATE KEY; chỉ PROCESSED được bỏ qua. PENDING có thể được hai request xử lý đồng thời. Handler đọc trạng thái đơn rồi UPDATE WHERE id; không có transaction/row lock/CAS bảo vệ phiên bản.
Tác động: hai event song song có thể cùng vượt qua kiểm tra và ghi trạng thái sai thứ tự; unique inbox chỉ ngăn thêm dòng trùng, không ngăn xử lý trùng.
Sửa: claim event nguyên tử; transaction theo đơn hoặc update có điều kiện version; test hai connection đồng thời và crash giữa các bước.

### F08 — High: CANCELLED bị mở lại; logic test helper khác luồng thực tế
Bằng chứng: commerce_webhook_service.php:300 có điều kiện currentWeight > newWeight && currentStatus !== 'CANCELLED'. Với CANCELLED → AWAITING_SHIPMENT và timestamp mới hơn, guard không chặn. isAllowedStatusTransition() ở đầu file chặn terminal transition nhưng handler không gọi nó.
Tác động: trạng thái đơn hủy có thể quay về active; loss ledger và số liệu báo cáo không còn nhất quán.
Sửa: dùng một quy tắc chuyển trạng thái thống nhất trong handler và reconciliation, có ngoại lệ chỉ khi nguồn chính thức yêu cầu. Test processEvent với DB, không chỉ test helper.

### F09 — High: aftersales không chống sự kiện sai thứ tự
Bằng chứng: handleAftersalesEvent:402–451 không dùng eventTimestamp; ON DUPLICATE KEY UPDATE ghi status và platform_updated_at=NOW() vô điều kiện.
Tác động: event REQUESTED cũ đến sau SUCCESS có thể ghi lùi trạng thái; ledger cũ và trạng thái aftersales lệch nhau.
Sửa: dùng thời gian/version nguồn, rule transition aftersales, transaction và test SUCCESS rồi REQUESTED cũ.

### F10 — High: lỗi ledger/aggregate bị nuốt nhưng event vẫn PROCESSED
Bằng chứng: handler order:376–389 và aftersales:448–465 bắt Throwable rỗng cho loss engine/enqueue. updateInboxStatus cũng nuốt lỗi. Handler không có transaction bao trùm order/items/loss/inbox.
Tác động: đơn đã đổi trạng thái nhưng loss/aggregate chưa cập nhật; event bị đánh PROCESSED và retry bị bỏ qua. Đẳng thức Gross-Loss=Realized tự thân không chứng minh các thành phần đúng nguồn.
Sửa: outbox durable cho các tác vụ phụ hoặc transaction phù hợp; báo trạng thái cần retry; inject lỗi DB/ledger/enqueue rồi chứng minh phục hồi.

### F11 — High: micro-batch không giới hạn toàn bộ tick, thiếu resume cho mutation/RMA
Bằng chứng: executeJobStep:2050–2065 chỉ giới hạn coverage của mutation 1 trang rồi chuyển step; RMA tối đa 2 trang và chuyển step, không lưu resume tại các step này. syncOrdersDomain:714–729 còn gọi MUTATION_REFRESH với 50 trang, không dùng max_pages micro-batch. Client requestV2 mặc định timeout đọc 30s và retries; coverage còn backfill customer/orphan losses.
Tác động: tick HTTP vẫn có thể lâu và nhiều API request; mutation/RMA có thể chỉ hoàn thành một phần. Cam kết mọi tick <2s chưa được chứng minh.
Sửa: budget thời gian cho toàn tick, checkpoint từng domain, không chạy vòng 50 trang trong tick, đưa backfill/rebuild sang queue. Test nhiều trang, timeout và 429.

### F12 — High: lock lấy sau khi đọc checkpoint
Bằng chứng: executeJobStep:1957–1984 đọc job/checkpoint trước acquireShopLock; sau khi có lock không đọc lại job.
Tác động: request B có thể đọc checkpoint cũ, lấy lock sau khi A hoàn thành và nhả lock, rồi lặp step hoặc ghi đè checkpoint mới bằng dữ liệu cũ.
Sửa: đọc lại row và kiểm tra terminal sau khi có lock; CAS checkpoint/version. Test hai worker interleave ở điểm trước GET_LOCK.

### F13 — Medium: cron/recovery khác mô tả và báo thành công không phản ánh lỗi
Bằng chứng: worker --cron dùng -30 days, không phải 3–7 ngày; --cron trả success=true và exit(0) dù shop FAILED/EXCEPTION. executeWithBackoff chỉ bắt exception; domain errors thường đã bị service/orchestrator chuyển thành array status nên wrapper này không thấy lỗi đó. recoverStaleJobsAndRuns đánh FAILED, không tự resume checkpoint; không kiểm tra named lock trước đánh stale.
Tác động: cron monitoring có thể báo khỏe trong khi job lỗi; recovery là kết thúc lỗi, chưa phải phục hồi hoàn chỉnh. Một job thật đang chạy lâu có thể bị watchdog đánh FAILED.
Sửa: exit/status phản ánh aggregate outcome; retry typed errors đúng tầng; quy trình resume/requeue rõ ràng; tránh đánh stale khi owner còn hoạt động.

### F14 — Medium: migration preflight chưa đủ và ALTER có thể chạy dở dang
Bằng chứng: 016/023 CREATE IF NOT EXISTS không kiểm schema bảng có sẵn. 021 chỉ kiểm 18 tên cột; 022 kiểm 11 tên cột, chưa toàn bộ cột service dùng. Check unique chỉ dựa tên index, chưa NON_UNIQUE/thứ tự cột. 023 kiểm index theo tên rồi ALTER, chưa kiểm bảng/cột prerequisite hoặc hình dạng index.
Tác động: migration có thể báo qua khi schema sai; có thể tạo inbox xong rồi lỗi ALTER do thiếu baseline tables/columns. Thời gian khóa/chi phí ALTER trên DB lớn chưa đo.
Sửa: preflight schema/types/nullability/unique definition, baseline version, engine/collation và privileges CREATE ROUTINE/ALTER. Chạy forward hai lần, trên schema không tương thích, và đo lock trên bản sao staging có kích thước gần production; không mặc định mọi DDL có thể rollback bằng transaction.

### F15 — Medium: thiếu consumer aggregate queue trong đường worker bàn giao
Bằng chứng: commerce_daily_aggregate_service.php có drainQueue() nhưng tìm trong toàn bộ PHP của ZIP chỉ thấy định nghĩa, không thấy nơi gọi. Webhook enqueue ngày bẩn; worker chủ yếu rebuild requested range.
Tác động: queue ngày lịch sử có thể không được xử lý nếu không có consumer bên ngoài gói. Báo cáo đọc daily aggregates có thể dùng dữ liệu cũ sau hoàn/hủy muộn.
Sửa: bàn giao worker/cron drainQueue rõ ràng hoặc chứng minh consumer hiện hữu; test refund ngày ngoài cửa sổ cron làm báo cáo cũ thay đổi.

### F16 — Medium: cần xác minh hợp đồng webhook và prepared statement với cấu hình thật
Bằng chứng: chữ ký chấp nhận hai công thức tự triển khai, timestamp chỉ đọc một số header, event fallback identity dùng timestamp hoặc time(); shop thiếu được gán shop mặc định cố định. processEvent bỏ freshness check khi thiếu timestamp. New-order SQL dùng :gross_amt hai lần.
Rủi ro chưa xác nhận: hợp đồng header/event/payload chính thức có thể khác; retry thiếu event_id có thể sinh ID khác; timestamp unsigned trong nhánh HMAC body có thể bị thay mà không đổi chữ ký. SQL placeholder lặp cần chạy với PDO config hiện hữu, đặc biệt native prepares.
Sửa: dùng tài liệu và mẫu event/signature thật đúng ứng dụng; ký/kiểm tra timestamp theo hợp đồng; không suy đoán shop; identity ổn định; dùng placeholder riêng và test ATTR_EMULATE_PREPARES=false. Chưa khẳng định cả hai thuật toán chữ ký là chuẩn TikTok.

## Các mâu thuẫn với handover
1. “Rollback không DROP TABLE”: sai đối với rollback 016.
2. “Fast ACK ngay sau inbox”: mã chạy handler trước ACK.
3. “Fail-closed”: processEvent bỏ xác thực khi secret rỗng.
4. “Mỗi tick 1 trang <2s”: không đúng toàn pipeline; có nhánh 50 trang và timeout 30s.
5. “Cron 3–7 ngày”: worker mặc định 30 ngày.
6. “Tự phục hồi”: watchdog hiện đánh FAILED, chưa thể hiện resume tự động.
7. Index orders được mô tả idx_orders_shop_status_create/idx_orders_update_time nhưng migration 023 thực tế tạo idx_orders_plat_shop_updated, cùng hai index loss/items.
8. “<20ms” và “67/67 PASS”: chưa có raw test log, fixture/runtime và benchmark để tái lập.

## Điều kiện mở lại quyết định triển khai
1. Sửa F01–F12; đóng hoặc chứng minh giải pháp hiện hữu cho F13–F16.
2. Cung cấp source commit, test suite/log gốc, dependency config mẫu không chứa secret, baseline schema và 9 tài liệu riêng.
3. Staging PHP 8.2 + MariaDB theo production: smoke từ ZIP giải nén; forward migrations hai lần; schema mismatch; rollback giữ nguyên dữ liệu và code hoạt động.
4. Test webhook theo payload thật đã ẩn dữ liệu nhạy cảm: signature đúng/sai/thiếu secret, event trùng, event đảo thứ tự, hai worker, DB down, lỗi ledger và replay/retry hợp lệ.
5. Test đồng bộ đa trang tất cả domain, token resume, 429/timeouts và restart giữa trang; verify không phát sinh API/write/delete khi chỉ xem báo cáo.
6. Đối soát vài đơn hủy/hoàn/hoàn một phần và ngày lịch sử giữa nguồn chính thức, normalized DB, loss ledger và aggregates.
7. Đo ACK p95, tick p95, report p95, queue backlog và lock contention trên dữ liệu gần thực tế.
8. Đóng gói lại ZIP + manifest + hash + hướng dẫn backup/rollback; kiểm toán lại đúng artifact cuối.

## Đề nghị công việc tiếp theo cho Antigravity
Giữ Zero Production Deployment / No SSH. Tạo bản sửa local từ đúng source commit của ZIP trên. Ưu tiên F01, F02, F03, F04, F05 rồi F06–F12. Không chỉ chỉnh báo cáo để thay cam kết; phải sửa đường thực thi và bổ sung integration/concurrency tests. Không dùng mock hasTable=true làm bằng chứng migration pass. Bàn giao ZIP mới, test source/log, migrations đã sửa, schema preflight, commit SHA và mapping từng finding → code/test chứng minh. Chưa chạy migration hoặc deploy lên production.

