<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
handleCORS();
$authUser = requireAuth('admin:all');

initializeDatabase();

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET rules and audit logs
if ($method === 'GET') {
    try {
        // Fetch rules
        $stmtRules = $db->query("SELECT * FROM `tiktok_rules` ORDER BY created_at DESC");
        $rules = $stmtRules->fetchAll();
        
        foreach ($rules as &$r) {
            $r['status'] = (bool)$r['status'];
            $r['campaignType'] = $r['campaign_type']; // Map key name to match frontend JS
            $r['trigger'] = $r['trigger_cond'];
            $r['action'] = $r['action_taken'];
        }

        // Fetch audit logs
        $stmtLogs = $db->query("SELECT * FROM `tiktok_audit_logs` ORDER BY log_time DESC LIMIT 20");
        $logs = $stmtLogs->fetchAll();

        echo json_encode([
            'success' => true,
            'rules' => $rules,
            'logs' => $logs
        ]);
    } catch (\Throwable $e) {
        sanitizeErrorResponse($e, 'Lỗi tải danh sách quy tắc.');
    }
    exit;
}

// Handle POST
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode(['success' => false, 'message' => 'Dữ liệu đầu vào không hợp lệ']);
        exit;
    }
    
    $action = isset($input['action']) ? $input['action'] : '';

    // Action: TOGGLE STATUS
    if ($action === 'toggle') {
        $id = $input['id'];
        $status = $input['status'] ? 1 : 0;
        
        try {
            $stmt = $db->prepare("UPDATE `tiktok_rules` SET status = :status WHERE id = :id");
            $stmt->execute([':status' => $status, ':id' => $id]);
            echo json_encode(['success' => true, 'message' => 'Cập nhật trạng thái luật thành công']);
        } catch (\Throwable $e) {
            sanitizeErrorResponse($e, 'Lỗi cập nhật trạng thái quy tắc.');
        }
        exit;
    }

    // Action: CREATE NEW RULE
    if ($action === 'create') {
        $id = 'rule-' . time();
        $name = $input['name'];
        $campaign_type = $input['campaignType'];
        $trigger_cond = $input['trigger'];
        $action_taken = $input['action'];
        $frequency = $input['frequency'];

        try {
            $stmt = $db->prepare("INSERT INTO `tiktok_rules` (id, name, campaign_type, trigger_cond, action_taken, frequency, status) 
                VALUES (:id, :name, :campaign_type, :trigger_cond, :action_taken, :frequency, 1)");
            
            $stmt->execute([
                ':id' => $id,
                ':name' => $name,
                ':campaign_type' => $campaign_type,
                ':trigger_cond' => $trigger_cond,
                ':action_taken' => $action_taken,
                ':frequency' => $frequency
            ]);
            
            echo json_encode([
                'success' => true, 
                'message' => 'Tạo quy tắc thành công',
                'data' => [
                    'id' => $id,
                    'name' => $name,
                    'campaignType' => $campaign_type,
                    'trigger' => $trigger_cond,
                    'action' => $action_taken,
                    'frequency' => $frequency,
                    'status' => true
                ]
            ]);
        } catch (\Throwable $e) {
            sanitizeErrorResponse($e, 'Lỗi tạo mới quy tắc.');
        }
        exit;
    }
}
