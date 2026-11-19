<?php
require_once 'db.php';

class TikTokShopClient {
    private $appKey;
    private $appSecret;
    private $baseUrl = "https://open-api.tiktokglobalshop.com";
    private static ?string $resolvedVideosEndpoint = null;
    private static ?string $resolvedLivesEndpoint = null;

    public function __construct() {
        $this->appKey = TIKTOK_APP_KEY;
        $this->appSecret = TIKTOK_APP_SECRET;
    }

    /**
     * Tạo chữ ký ký nhận API (Signature)
     */
    private function generateSign($path, $params, $body = '') {
        // 1. Sắp xếp tham số theo thứ tự alphabet
        ksort($params);

        // 2. Nối chuỗi key + value
        $queryString = '';
        foreach ($params as $key => $value) {
            if ($key !== 'sign' && $key !== 'access_token') {
                $queryString .= $key . $value;
            }
        }

        // 3. Kết hợp path + query + body
        $baseString = $path . $queryString . $body;

        // 4. Bọc bằng App Secret (Prepend & Append theo chuẩn API v2)
        $message = $this->appSecret . $baseString . $this->appSecret;

        // 5. Hash HMAC-SHA256
        return hash_hmac('sha256', $message, $this->appSecret);
    }

    /**
     * Gửi HTTP Request tới TikTok Shop API
     */
    public function request($method, $path, $queryParams = [], $bodyData = null, $accessToken = null) {
        $timestamp = time();
        
        // Thiết lập các tham số query mặc định
        $queryParams['app_key'] = $this->appKey;
        $queryParams['timestamp'] = $timestamp;

        // Định dạng body JSON
        $bodyStr = '';
        if ($bodyData !== null) {
            $bodyStr = json_encode($bodyData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }

        // Tính chữ ký bảo mật
        $sign = $this->generateSign($path, $queryParams, $bodyStr);
        $queryParams['sign'] = $sign;

        // Tạo full URL
        $url = $this->baseUrl . $path . '?' . http_build_query($queryParams);

        // Khởi tạo cURL
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

        // Tiêu đề Headers
        $headers = [
            'Content-Type: application/json',
        ];
        if ($accessToken) {
            // Truyền token ở Header theo chuẩn mới của TikTok 202309
            $headers[] = 'x-tts-access-token: ' . $accessToken;
        }

        if ($method === 'POST' || $method === 'PUT') {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $bodyStr);
        }

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception("cURL Error: " . $error);
        }

        $resData = json_decode($response, true);
        if ($httpCode !== 200 || (isset($resData['code']) && $resData['code'] !== 0)) {
            $msg = isset($resData['message']) ? $resData['message'] : "HTTP Status " . $httpCode;
            throw new Exception("TikTok API Error (Code " . ($resData['code'] ?? $httpCode) . "): " . $msg);
        }

        return $resData;
    }

    /**
     * Gửi HTTP Request tới TikTok Shop API có kiểm soát Retry, Timeout tách rời & Rate Limit
     */
    public function requestV2($method, $path, $queryParams = [], $bodyData = null, $accessToken = null, $connectTimeout = 5, $readTimeout = 30, $maxRetries = 3) {
        $attempt = 0;
        $lastException = null;

        // Correction 3: Configurable connector throttling
        $throttleMs = defined('TIKTOK_API_THROTTLE_MS') ? (int)TIKTOK_API_THROTTLE_MS : 100;
        if ($throttleMs > 0) {
            usleep($throttleMs * 1000);
        }

        while ($attempt < $maxRetries) {
            $timestamp = time();
            $params = $queryParams;
            $params['app_key'] = $this->appKey;
            $params['timestamp'] = $timestamp;

            $bodyStr = '';
            if ($bodyData !== null) {
                $bodyStr = json_encode($bodyData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            }

            $sign = $this->generateSign($path, $params, $bodyStr);
            $params['sign'] = $sign;

            $url = $this->baseUrl . $path . '?' . http_build_query($params);

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HEADER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, $readTimeout);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $connectTimeout);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

            $headers = ['Content-Type: application/json'];
            if ($accessToken) {
                $headers[] = 'x-tts-access-token: ' . $accessToken;
            }

            if ($method === 'POST' || $method === 'PUT') {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $bodyStr);
            }

            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                $attempt++;
                $lastException = new Exception("cURL Error (Attempt {$attempt}/{$maxRetries}): " . $error);
                if ($attempt < $maxRetries) {
                    $sleepTime = pow(2, $attempt) + (mt_rand(0, 1000) / 1000);
                    usleep((int)($sleepTime * 1000000));
                    continue;
                }
                throw $lastException;
            }

            $rawHeaders = substr($response, 0, $headerSize);
            $body = substr($response, $headerSize);

            // Handle HTTP 429 Too Many Requests (Correction 3: Throttling & Bounded Retry)
            if ($httpCode === 429) {
                $attempt++;
                $retryAfter = 0;
                if (preg_match('/Retry-After:\s*(\d+)/i', $rawHeaders, $matches)) {
                    $retryAfter = (int)$matches[1];
                }
                $defaultRetrySec = defined('TIKTOK_API_RETRY_AFTER_DEFAULT_SEC') ? (int)TIKTOK_API_RETRY_AFTER_DEFAULT_SEC : 2;
                $sleepTime = ($retryAfter > 0 && $retryAfter <= 60)
                    ? $retryAfter
                    : ($defaultRetrySec * pow(2, $attempt - 1) + (mt_rand(0, 1000) / 1000));
                if ($attempt < $maxRetries) {
                    usleep((int)($sleepTime * 1000000));
                    continue;
                }
                throw new Exception("TikTok API Rate Limit (HTTP 429) exceeded after {$maxRetries} attempts.");
            }

            // Handle HTTP 5xx Server Transient Errors
            if ($httpCode >= 500 && $httpCode <= 504) {
                $attempt++;
                if ($attempt < $maxRetries) {
                    $sleepTime = pow(2, $attempt) + (mt_rand(0, 500) / 1000);
                    usleep((int)($sleepTime * 1000000));
                    continue;
                }
                throw new Exception("TikTok API Server Error (HTTP {$httpCode}) after {$maxRetries} attempts.");
            }

            $resData = json_decode($body, true);
            if ($httpCode !== 200 || (isset($resData['code']) && $resData['code'] !== 0)) {
                $msg = isset($resData['message']) ? $resData['message'] : "HTTP Status " . $httpCode;
                $code = $resData['code'] ?? $httpCode;
                throw new Exception("TikTok API Error (Code {$code}): " . $msg);
            }

            return $resData;
        }

        throw $lastException ?? new Exception("TikTok API Request failed after {$maxRetries} attempts.");
    }


    /**
     * Lấy danh sách Shop được ủy quyền & shop_cipher
     */
    public function getAuthorizedShops($accessToken) {
        $path = "/authorization/202309/shops";
        $res = $this->request("GET", $path, [], null, $accessToken);
        return $res['data']['shops'] ?? [];
    }

    /**
     * Resolves shop_cipher safely without querying deprecated DB columns:
     * 1. Match exact configured shop_id
     * 2. Single-shop fallback ONLY when API returns exactly 1 shop
     * 3. If > 1 shop and no exact match => fail closed SHOP_CIPHER_NOT_FOUND
     * Never logs access token or shop cipher.
     */
    public function resolveShopCipher(string $shopId, string $accessToken): string {
        $shops = $this->getAuthorizedShops($accessToken);
        if (empty($shops)) {
            throw new RuntimeException("SHOP_CIPHER_NOT_FOUND: No authorized shops returned for shop {$shopId}");
        }

        // Exact match by configured shop_id
        foreach ($shops as $s) {
            $sId = (string)($s['id'] ?? $s['shop_id'] ?? '');
            if ($sId !== '' && $sId === $shopId) {
                $cipher = (string)($s['cipher'] ?? $s['shop_cipher'] ?? '');
                if ($cipher !== '') {
                    return $cipher;
                }
            }
        }

        // Single-shop fallback ONLY when API returns exactly 1 shop
        if (count($shops) === 1) {
            $cipher = (string)($shops[0]['cipher'] ?? $shops[0]['shop_cipher'] ?? '');
            if ($cipher !== '') {
                return $cipher;
            }
        }

        // Multi-shop without exact match => Fail closed
        throw new RuntimeException("SHOP_CIPHER_NOT_FOUND: Configured shop {$shopId} does not match any authorized shop (found " . count($shops) . " shops)");
    }

    /**
     * Tìm kiếm danh sách sản phẩm của cửa hàng
     */
    /**
     * Tìm kiếm danh sách sản phẩm của cửa hàng
     */
    public function searchProducts($accessToken, $shopCipher, $pageSize = 20, $pageToken = null) {
        $path = "/product/202309/products/search";
        $queryParams = [
            "shop_cipher" => $shopCipher,
            "page_size" => (int)$pageSize
        ];
        if ($pageToken !== null && $pageToken !== '') {
            $queryParams['page_token'] = $pageToken;
        }
        $body = new stdClass();
        $res = $this->request("POST", $path, $queryParams, $body, $accessToken);
        return $res['data'] ?? [];
    }

    /**
     * Tìm kiếm danh sách đơn hàng để đối soát GMV
     */
    public function searchOrders($accessToken, $shopCipher, $startTime = null, $endTime = null, $pageSize = 50, $pageToken = null) {
        $path = "/order/202309/orders/search";
        
        $queryParams = [
            "shop_cipher" => $shopCipher,
            "page_size" => (int)$pageSize
        ];
        
        if ($pageToken !== null && $pageToken !== '') {
            $queryParams['page_token'] = $pageToken;
        }
        
        $body = [];
        if ($startTime !== null) {
            $body["create_time_ge"] = (int)$startTime;
        }
        if ($endTime !== null) {
            $body["create_time_lt"] = (int)$endTime;
        }
        
        $bodyData = empty($body) ? new stdClass() : $body;
        $res = $this->request("POST", $path, $queryParams, $bodyData, $accessToken);
        return $res['data'] ?? [];
    }

    /**
     * HF1.2 Core Orders Engine V2: Tìm kiếm đơn hàng phân trang con trỏ chuẩn v202309
     * Hỗ trợ: page_size (ưu tiên 100), page_token, create_time, update_time, sort
     */
    public function searchOrdersV2($accessToken, $shopCipher, array $options = []) {
        $path = defined('TIKTOK_API_ORDER_SEARCH_ENDPOINT') ? TIKTOK_API_ORDER_SEARCH_ENDPOINT : "/order/202309/orders/search";
        
        $pageSize = isset($options['page_size']) ? (int)$options['page_size'] : (defined('TIKTOK_API_DEFAULT_PAGE_SIZE') ? TIKTOK_API_DEFAULT_PAGE_SIZE : 100);
        if ($pageSize < 1 || $pageSize > 100) {
            $pageSize = 100;
        }

        $queryParams = [
            "shop_cipher" => $shopCipher,
            "page_size" => $pageSize
        ];
        
        if (!empty($options['page_token'])) {
            $queryParams['page_token'] = (string)$options['page_token'];
        }
        if (!empty($options['sort_field'])) {
            $queryParams['sort_field'] = (string)$options['sort_field'];
        }
        if (!empty($options['sort_order'])) {
            $queryParams['sort_order'] = (string)$options['sort_order'];
        }
        
        $body = [];
        if (isset($options['create_time_ge'])) {
            $body["create_time_ge"] = (int)$options['create_time_ge'];
        }
        if (isset($options['create_time_lt'])) {
            $body["create_time_lt"] = (int)$options['create_time_lt'];
        }
        if (isset($options['update_time_ge'])) {
            $body["update_time_ge"] = (int)$options['update_time_ge'];
        }
        if (isset($options['update_time_lt'])) {
            $body["update_time_lt"] = (int)$options['update_time_lt'];
        }
        if (isset($options['order_status'])) {
            $body["order_status"] = (string)$options['order_status'];
        }
        if (!empty($options['order_ids'])) {
            $body["order_ids"] = is_array($options['order_ids']) ? array_values($options['order_ids']) : [(string)$options['order_ids']];
        } elseif (!empty($options['order_id'])) {
            $body["order_ids"] = [(string)$options['order_id']];
        }
        
        $bodyData = empty($body) ? new stdClass() : $body;
        $connectTimeout = defined('TIKTOK_API_CONNECT_TIMEOUT_SEC') ? TIKTOK_API_CONNECT_TIMEOUT_SEC : 5;
        $readTimeout = defined('TIKTOK_API_READ_TIMEOUT_SEC') ? TIKTOK_API_READ_TIMEOUT_SEC : 30;
        $maxRetries = defined('TIKTOK_API_RETRY_MAX_ATTEMPTS') ? TIKTOK_API_RETRY_MAX_ATTEMPTS : 3;

        $res = $this->requestV2("POST", $path, $queryParams, $bodyData, $accessToken, $connectTimeout, $readTimeout, $maxRetries);
        return $res['data'] ?? [];
    }

    /**
     * Bounded retrieval of orders by explicit order IDs (max 50) via official GET /order/202309/orders
     * Scope: seller.order
     * Query: shop_cipher, ids (comma-separated)
     * Returns: data.orders
     */
    public function getOrderDetailsV2(string $accessToken, string $shopCipher, array $orderIds): array {
        $bounded = array_values(array_slice(array_unique(array_filter(array_map('strval', $orderIds))), 0, 50));
        if (empty($bounded)) {
            return [];
        }

        $connectTimeout = defined('TIKTOK_API_CONNECT_TIMEOUT_SEC') ? TIKTOK_API_CONNECT_TIMEOUT_SEC : 5;
        $readTimeout = defined('TIKTOK_API_READ_TIMEOUT_SEC') ? TIKTOK_API_READ_TIMEOUT_SEC : 30;
        $maxRetries = defined('TIKTOK_API_RETRY_MAX_ATTEMPTS') ? TIKTOK_API_RETRY_MAX_ATTEMPTS : 3;

        $path = "/order/202309/orders";
        $queryParams = [
            'shop_cipher' => $shopCipher,
            'ids' => implode(',', $bounded)
        ];

        $res = $this->requestV2("GET", $path, $queryParams, null, $accessToken, $connectTimeout, $readTimeout, $maxRetries);
        return $res['data']['orders'] ?? [];
    }

    /**
     * Bounded retrieval of orders by explicit order IDs (max 50)
     * Backward-compatible wrapper forwarding to getOrderDetailsV2
     */
    public function getOrdersByIds(string $accessToken, string $shopCipher, array $orderIds): array {
        return $this->getOrderDetailsV2($accessToken, $shopCipher, $orderIds);
    }

    /**
     * HF1.3: Tìm kiếm danh sách yêu cầu trả hàng / hoàn tiền (RMA) chuẩn TikTok Shop v202602
     * Scope: seller.return_refund.basic
     * Endpoint: POST /return_refund/202602/returns/search
     */
    public function searchReturnRefundRmaV2($accessToken, $shopCipher, array $options = []) {
        $path = defined('TIKTOK_API_RMA_SEARCH_ENDPOINT') ? TIKTOK_API_RMA_SEARCH_ENDPOINT : "/return_refund/202602/returns/search";
        $pageSize = isset($options['page_size']) ? (int)$options['page_size'] : 50;
        if ($pageSize < 1 || $pageSize > 50) {
            $pageSize = 50;
        }

        $queryParams = [
            "shop_cipher" => $shopCipher,
            "page_size" => $pageSize
        ];
        if (!empty($options['page_token'])) {
            $queryParams['page_token'] = (string)$options['page_token'];
        }
        if (!empty($options['sort_field'])) {
            $queryParams['sort_field'] = (string)$options['sort_field'];
        }
        if (!empty($options['sort_order'])) {
            $queryParams['sort_order'] = (string)$options['sort_order'];
        }

        $body = [];
        if (isset($options['create_time_ge'])) {
            $body["create_time_ge"] = (int)$options['create_time_ge'];
        }
        if (isset($options['create_time_lt'])) {
            $body["create_time_lt"] = (int)$options['create_time_lt'];
        }
        if (isset($options['update_time_ge'])) {
            $body["update_time_ge"] = (int)$options['update_time_ge'];
        }
        if (isset($options['update_time_lt'])) {
            $body["update_time_lt"] = (int)$options['update_time_lt'];
        }

        // Returns search filters at root level
        if (!empty($options['return_status'])) {
            $body["return_status"] = (string)$options['return_status'];
        } elseif (!empty($options['rma_status'])) {
            $body["return_status"] = (string)$options['rma_status'];
        }

        if (!empty($options['return_types'])) {
            $body["return_types"] = is_array($options['return_types']) ? $options['return_types'] : [(string)$options['return_types']];
        } elseif (!empty($options['rma_type'])) {
            $body["return_types"] = is_array($options['rma_type']) ? $options['rma_type'] : [(string)$options['rma_type']];
        }

        if (!empty($options['order_ids'])) {
            $body["order_ids"] = is_array($options['order_ids']) ? $options['order_ids'] : [(string)$options['order_ids']];
        } elseif (!empty($options['order_id'])) {
            $body["order_ids"] = [(string)$options['order_id']];
        }

        $bodyData = empty($body) ? new stdClass() : $body;
        $connectTimeout = defined('TIKTOK_API_CONNECT_TIMEOUT_SEC') ? TIKTOK_API_CONNECT_TIMEOUT_SEC : 5;
        $readTimeout = defined('TIKTOK_API_READ_TIMEOUT_SEC') ? TIKTOK_API_READ_TIMEOUT_SEC : 30;
        $maxRetries = defined('TIKTOK_API_RETRY_MAX_ATTEMPTS') ? TIKTOK_API_RETRY_MAX_ATTEMPTS : 3;

        $res = $this->requestV2("POST", $path, $queryParams, $bodyData, $accessToken, $connectTimeout, $readTimeout, $maxRetries);
        return $res['data'] ?? [];
    }

    /**
     * HF1.3: Tìm kiếm kiện hàng kho vận & giao nhận chuẩn TikTok Shop v202309
     * Scope: seller.fulfillment.basic
     */
    public function searchFulfillmentPackagesV2($accessToken, $shopCipher, array $options = []) {
        $path = defined('TIKTOK_API_PACKAGES_SEARCH_ENDPOINT') ? TIKTOK_API_PACKAGES_SEARCH_ENDPOINT : "/fulfillment/202309/packages/search";
        $pageSize = isset($options['page_size']) ? (int)$options['page_size'] : 50;
        if ($pageSize < 1 || $pageSize > 50) {
            $pageSize = 50;
        }

        $queryParams = [
            "shop_cipher" => $shopCipher,
            "page_size" => $pageSize
        ];
        if (!empty($options['page_token'])) {
            $queryParams['page_token'] = (string)$options['page_token'];
        }

        $body = [];
        if (isset($options['create_time_ge'])) {
            $body["create_time_ge"] = (int)$options['create_time_ge'];
        }
        if (isset($options['create_time_lt'])) {
            $body["create_time_lt"] = (int)$options['create_time_lt'];
        }
        if (isset($options['update_time_ge'])) {
            $body["update_time_ge"] = (int)$options['update_time_ge'];
        }
        if (isset($options['update_time_lt'])) {
            $body["update_time_lt"] = (int)$options['update_time_lt'];
        }
        if (!empty($options['package_status'])) {
            $body["package_status"] = (string)$options['package_status'];
        }
        if (!empty($options['order_id'])) {
            $body["order_id"] = (string)$options['order_id'];
        }

        $bodyData = empty($body) ? new stdClass() : $body;
        $connectTimeout = defined('TIKTOK_API_CONNECT_TIMEOUT_SEC') ? TIKTOK_API_CONNECT_TIMEOUT_SEC : 5;
        $readTimeout = defined('TIKTOK_API_READ_TIMEOUT_SEC') ? TIKTOK_API_READ_TIMEOUT_SEC : 30;
        $maxRetries = defined('TIKTOK_API_RETRY_MAX_ATTEMPTS') ? TIKTOK_API_RETRY_MAX_ATTEMPTS : 3;

        $res = $this->requestV2("POST", $path, $queryParams, $bodyData, $accessToken, $connectTimeout, $readTimeout, $maxRetries);
        return $res['data'] ?? [];
    }



    /**
     * Lấy danh sách các ca Live Stream (Sử dụng gói quyền Live Data: creator.data.live.read.public)
     */
    public function getLiveSessions($accessToken, $shopCipher, $pageSize = 20) {
        $paths = [
            "/analytics/202309/shops/lives",
            "/live/202309/lives",
            "/creator/202404/lives"
        ];
        
        foreach ($paths as $p) {
            try {
                $res = $this->request("GET", $p, [
                    "shop_cipher" => $shopCipher,
                    "page_size" => (int)$pageSize
                ], null, $accessToken);
                if (isset($res['data'])) {
                    return $res['data']['lives'] ?? $res['data']['list'] ?? [];
                }
            } catch (Exception $e) {
                // Tiếp tục thử endpoint tiếp theo
            }
        }
        return [];
    }

    /**
     * Lấy chi tiết một sản phẩm (bao gồm hình ảnh, thuộc tính, phân loại SKUs)
     * Sử dụng quyền: seller.product.basic
     */
    public function getProductDetail($accessToken, $shopCipher, $productId) {
        $path = "/product/202309/products/" . $productId;
        $queryParams = [
            "shop_cipher" => $shopCipher
        ];
        try {
            $res = $this->request("GET", $path, $queryParams, null, $accessToken);
            return $res['data'] ?? null;
        } catch (Exception $e) {
            error_log("getProductDetail error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * [LEGACY / PROBE ONLY] Thử thăm dò hiệu suất và điểm trải nghiệm cửa hàng (SPS/SES)
     * Thử lần lượt các endpoint cũ để thăm dò quyền và dữ liệu trong quá trình discovery.
     * Cô lập hoàn toàn khỏi luồng HF1.5 Canonical Analytics để không che giấu lỗi hợp đồng.
     * 
     * @deprecated Sử dụng getShopPerformance() với đầy đủ startDate, endDate theo chuẩn HF1.5
     */
    public function getLegacyShopPerformanceProbe($accessToken, $shopCipher) {
        $paths = [
            "/analytics/202405/shop/performance",
            "/analytics/202309/shops/performance",
            "/seller/202309/shops/performance"
        ];
        foreach ($paths as $path) {
            try {
                $queryParams = [
                    "shop_cipher" => $shopCipher
                ];
                $res = $this->request("GET", $path, $queryParams, null, $accessToken);
                if (!empty($res['data'])) {
                    return $res['data'];
                }
            } catch (Exception $e) {
                // Tiếp tục thử endpoint khác trong probe
            }
        }
        return null;
    }

    /**
     * Lấy danh sách các hoạt động khuyến mãi (Flash sale, Voucher, Giảm giá...)
     * Sử dụng quyền: seller.promotion.info
     */
    public function getPromotions($accessToken, $shopCipher, $pageSize = 50) {
        $endpoints = [
            [
                "path" => "/promotion/202309/activities/search",
                "bodies" => [
                    ["page_size" => (int)$pageSize, "status" => "ACTIVATED"],
                    ["page_size" => (int)$pageSize, "status" => "ONGOING"],
                    ["page_size" => (int)$pageSize],
                    new stdClass()
                ]
            ],
            [
                "path" => "/promotion/202309/coupons/search",
                "bodies" => [
                    ["page_size" => (int)$pageSize, "status" => "ACTIVATED"],
                    ["page_size" => (int)$pageSize],
                    new stdClass()
                ]
            ]
        ];

        $results = [];
        foreach ($endpoints as $ep) {
            $path = $ep['path'];
            foreach ($ep['bodies'] as $bData) {
                try {
                    $queryParams = [
                        "shop_cipher" => $shopCipher,
                        "page_size" => (int)$pageSize
                    ];
                    $res = $this->request("POST", $path, $queryParams, $bData, $accessToken);
                    if (isset($res['data']['activities']) && is_array($res['data']['activities'])) {
                        $results = array_merge($results, $res['data']['activities']);
                        break; // Đã lấy thành công cho endpoint này
                    } elseif (isset($res['data']['coupons']) && is_array($res['data']['coupons'])) {
                        $results = array_merge($results, $res['data']['coupons']);
                        break;
                    }
                } catch (Exception $e) {
                    // Thử body format tiếp theo
                }
            }
        }
        return $results;
    }

    /**
     * Lấy danh sách bảng kê sao kê tài chính (Financial Settlement Statements)
     * Scope: seller.finance.info
     * Method: GET /finance/202309/statements (Bắt buộc GET theo chuẩn TikTok Shop)
     */
    public function getFinanceStatements(string $accessToken, string $shopCipher, array $options = []): array {
        $pageSize = isset($options['page_size']) ? (int)$options['page_size'] : 50;
        if ($pageSize < 1 || $pageSize > 100) {
            $pageSize = 50;
        }

        $queryParams = [
            "shop_cipher" => $shopCipher,
            "page_size" => $pageSize
        ];

        if (!empty($options['page_token'])) {
            $queryParams['page_token'] = (string)$options['page_token'];
        }
        if (!empty($options['sort_field'])) {
            $queryParams['sort_field'] = (string)$options['sort_field'];
        }
        if (!empty($options['sort_order'])) {
            $queryParams['sort_order'] = (string)$options['sort_order'];
        }
        if (isset($options['statement_time_ge'])) {
            $queryParams['statement_time_ge'] = (int)$options['statement_time_ge'];
        }
        if (isset($options['statement_time_lt'])) {
            $queryParams['statement_time_lt'] = (int)$options['statement_time_lt'];
        }

        $path = defined('TIKTOK_API_FINANCE_STATEMENT_ENDPOINT') 
            ? TIKTOK_API_FINANCE_STATEMENT_ENDPOINT 
            : "/finance/202309/statements";

        return $this->request("GET", $path, $queryParams, null, $accessToken);
    }

    /**
     * Lấy chi tiết dòng tiền và khấu trừ theo đơn hàng (Order Statement Transactions)
     * Scope: seller.finance.info
     * Method: GET /finance/202501/orders/{order_id}/statement_transactions (Chuẩn mới 202501)
     */
    public function getOrderStatementTransactions(string $accessToken, string $shopCipher, string $orderId, array $options = []): array {
        $pageSize = isset($options['page_size']) ? (int)$options['page_size'] : 50;
        if ($pageSize < 1 || $pageSize > 100) {
            $pageSize = 50;
        }

        $queryParams = [
            "shop_cipher" => $shopCipher,
            "page_size" => $pageSize
        ];

        if (!empty($options['page_token'])) {
            $queryParams['page_token'] = (string)$options['page_token'];
        }

        $encodedOrderId = rawurlencode($orderId);
        $path = "/finance/202501/orders/{$encodedOrderId}/statement_transactions";

        return $this->request("GET", $path, $queryParams, null, $accessToken);
    }

    /**
     * Lấy dữ liệu quyết toán tài chính, phí sàn và dòng tiền (Backward-Compatible Wrapper)
     * Sử dụng quyền: seller.finance.info
     */
    public function getFinanceSettlements($accessToken, $shopCipher, $pageSize = 50) {
        try {
            $res = $this->getFinanceStatements($accessToken, $shopCipher, ['page_size' => (int)$pageSize]);
            if (isset($res['data'])) {
                return $res['data']['statements'] ?? $res['data']['settlements'] ?? $res['data'] ?? [];
            }
        } catch (Exception $e) {
            // Thử endpoint dự phòng
        }
        return [];
    }

    /**
     * Lấy danh sách yêu cầu trả hàng / hoàn tiền
     * Sử dụng quyền: seller.return_refund.basic
     */
    public function getReturns($accessToken, $shopCipher, $pageSize = 50) {
        $path = "/return_refund/202309/returns/search";
        try {
            $queryParams = [
                "shop_cipher" => $shopCipher,
                "page_size" => (int)$pageSize
            ];
            $body = new stdClass();
            $res = $this->request("POST", $path, $queryParams, $body, $accessToken);
            return $res['data']['returns'] ?? $res['data']['return_orders'] ?? [];
        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Lấy danh sách kiện hàng kho vận & hoàn thiện đơn
     * Sử dụng quyền: seller.fulfillment.basic
     */
    public function getFulfillmentPackages($accessToken, $shopCipher, $pageSize = 50) {
        $path = "/fulfillment/202309/packages/search";
        try {
            $queryParams = [
                "shop_cipher" => $shopCipher,
                "page_size" => (int)$pageSize
            ];
            $body = new stdClass();
            $res = $this->request("POST", $path, $queryParams, $body, $accessToken);
            return $res['data']['packages'] ?? [];
        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Lấy chỉ số hiệu suất tổng quan gian hàng (Shop Performance)
     * Scope: data.shop_analytics.public.read
     * Method: GET /analytics/202405/shop/performance
     * 
     * Canonical HF1.5 Analytics contract:
     * - Requires $startDate and $endDate in YYYY-MM-DD format.
     * - Uses verified endpoint: /analytics/202405/shop/performance (no speculative silent fallback).
     * - Backward compatibility: If invoked with only ($accessToken, $shopCipher) without dates,
     *   dispatches safely to getLegacyShopPerformanceProbe() without fatal error.
     */
    public function getShopPerformance(
        string $accessToken,
        string $shopCipher,
        string $startDate = '',
        string $endDate = '',
        array $options = []
    ): array {
        // Tương thích ngược: Nếu gọi không kèm ngày, dispatch sang legacy probe đã cô lập
        if ($startDate === '' && $endDate === '') {
            $probe = $this->getLegacyShopPerformanceProbe($accessToken, $shopCipher);
            return $probe !== null 
                ? ['code' => 0, 'data' => $probe, 'message' => 'Legacy probe success'] 
                : ['code' => -1, 'data' => null, 'message' => 'Legacy probe returned empty/null'];
        }

        if ($startDate === '' || $endDate === '') {
            throw new InvalidArgumentException("getShopPerformance requires both startDate and endDate in YYYY-MM-DD format");
        }

        $queryParams = [
            "shop_cipher" => $shopCipher,
            "start_date_ge" => $startDate,
            "end_date_lt" => $endDate,
            "granularity" => $options['granularity'] ?? '1D',
            "currency" => $options['currency'] ?? 'LOCAL'
        ];
        if (isset($options['with_comparison'])) {
            $queryParams['with_comparison'] = $options['with_comparison'] ? 'true' : 'false';
        }

        $path = defined('TIKTOK_API_ANALYTICS_SHOP_ENDPOINT') 
            ? TIKTOK_API_ANALYTICS_SHOP_ENDPOINT 
            : "/analytics/202405/shop/performance";

        // Thực thi request GET chính xác, không tự động fallback sang endpoint chưa kiểm chứng
        return $this->request("GET", $path, $queryParams, null, $accessToken);
    }

    /**
     * Lấy chỉ số hiệu suất phiên phát trực tiếp (LIVE Stream Performance)
     * Scope: data.shop_analytics.public.read / creator.data.live.read.public
     * Auto-probes valid API versions: 202605, 202509, 202409, 202406, 202405, 202309
     */
    public function getShopLivesPerformance(string $accessToken, string $shopCipher, string $startDate, string $endDate, array $options = []): array {
        $pageSize = isset($options['page_size']) ? (int)$options['page_size'] : 50;
        if ($pageSize < 1 || $pageSize > 50) {
            $pageSize = 50;
        }

        $queryParams = [
            "shop_cipher" => $shopCipher,
            "start_date_ge" => $startDate,
            "end_date_lt" => $endDate,
            "page_size" => $pageSize,
            "currency" => $options['currency'] ?? 'LOCAL'
        ];

        if (!empty($options['page_token'])) {
            $queryParams['page_token'] = (string)$options['page_token'];
        }
        if (!empty($options['sort_field'])) {
            $queryParams['sort_field'] = (string)$options['sort_field'];
        }
        if (!empty($options['sort_order'])) {
            $queryParams['sort_order'] = (string)$options['sort_order'];
        }
        if (!empty($options['account_type'])) {
            $queryParams['account_type'] = (string)$options['account_type'];
        }

        $connectTimeout = defined('TIKTOK_API_CONNECT_TIMEOUT_SEC') ? TIKTOK_API_CONNECT_TIMEOUT_SEC : 5;
        $readTimeout = defined('TIKTOK_API_READ_TIMEOUT_SEC') ? TIKTOK_API_READ_TIMEOUT_SEC : 30;
        $maxRetries = defined('TIKTOK_API_RETRY_MAX_ATTEMPTS') ? TIKTOK_API_RETRY_MAX_ATTEMPTS : 3;

        if (self::$resolvedLivesEndpoint !== null) {
            return $this->requestV2("GET", self::$resolvedLivesEndpoint, $queryParams, null, $accessToken, $connectTimeout, $readTimeout, $maxRetries);
        }

        $configuredEndpoint = defined('TIKTOK_API_ANALYTICS_LIVES_ENDPOINT') ? TIKTOK_API_ANALYTICS_LIVES_ENDPOINT : null;
        $candidates = array_unique(array_filter([
            "/analytics/202609/shop_lives/performance",
            "/analytics/202605/shop_lives/performance",
            "/analytics/202509/shop_lives/performance",
            "/analytics/202409/shop_lives/performance",
            "/analytics/202406/shop_lives/performance",
            "/analytics/202405/shop_lives/performance",
            "/analytics/202309/shop_lives/performance",
            $configuredEndpoint
        ]));

        $lastException = null;
        foreach ($candidates as $candidatePath) {
            try {
                $res = $this->requestV2("GET", $candidatePath, $queryParams, null, $accessToken, $connectTimeout, $readTimeout, 1);
                self::$resolvedLivesEndpoint = $candidatePath;
                return $res;
            } catch (\Throwable $e) {
                $lastException = $e;
                $msg = $e->getMessage();
                $isVersionError = (
                    stripos($msg, '36009004') !== false ||
                    stripos($msg, 'Invalid API version') !== false ||
                    (stripos($msg, 'version') !== false && stripos($msg, 'invalid') !== false) ||
                    stripos($msg, 'HTTP 404') !== false
                );
                if ($isVersionError) {
                    continue;
                }
                self::$resolvedLivesEndpoint = $candidatePath;
                throw $e;
            }
        }

        throw $lastException ?? new RuntimeException("Không tìm thấy phiên bản TikTok LIVE Analytics API phù hợp.");
    }

    /**
     * Lấy chỉ số hiệu suất video ngắn (Short Video Performance)
     * Scope: data.shop_analytics.public.read
     * Auto-probes valid API versions: 202605, 202509, 202409, 202406, 202309
     */
    public function getShopVideosPerformance(string $accessToken, string $shopCipher, string $startDate, string $endDate, array $options = []): array {
        $pageSize = isset($options['page_size']) ? (int)$options['page_size'] : 50;
        if ($pageSize < 1 || $pageSize > 50) {
            $pageSize = 50;
        }

        $queryParams = [
            "shop_cipher" => $shopCipher,
            "start_date_ge" => $startDate,
            "end_date_lt" => $endDate,
            "page_size" => $pageSize,
            "currency" => $options['currency'] ?? 'LOCAL'
        ];

        if (!empty($options['page_token'])) {
            $queryParams['page_token'] = (string)$options['page_token'];
        }
        if (!empty($options['sort_field'])) {
            $queryParams['sort_field'] = (string)$options['sort_field'];
        }
        if (!empty($options['sort_order'])) {
            $queryParams['sort_order'] = (string)$options['sort_order'];
        }
        if (!empty($options['account_type'])) {
            $queryParams['account_type'] = (string)$options['account_type'];
        }

        $connectTimeout = defined('TIKTOK_API_CONNECT_TIMEOUT_SEC') ? TIKTOK_API_CONNECT_TIMEOUT_SEC : 5;
        $readTimeout = defined('TIKTOK_API_READ_TIMEOUT_SEC') ? TIKTOK_API_READ_TIMEOUT_SEC : 30;
        $maxRetries = defined('TIKTOK_API_RETRY_MAX_ATTEMPTS') ? TIKTOK_API_RETRY_MAX_ATTEMPTS : 3;

        // If an endpoint has already been successfully resolved, use it directly
        if (self::$resolvedVideosEndpoint !== null) {
            return $this->requestV2("GET", self::$resolvedVideosEndpoint, $queryParams, null, $accessToken, $connectTimeout, $readTimeout, $maxRetries);
        }

        // Ordered candidate versions to probe
        $configuredEndpoint = defined('TIKTOK_API_ANALYTICS_VIDEOS_ENDPOINT') ? TIKTOK_API_ANALYTICS_VIDEOS_ENDPOINT : null;
        $candidates = array_unique(array_filter([
            $configuredEndpoint,
            "/analytics/202609/shop_videos/performance",
            "/analytics/202605/shop_videos/performance",
            "/analytics/202509/shop_videos/performance",
            "/analytics/202409/shop_videos/performance",
            "/analytics/202406/shop_videos/performance",
            "/analytics/202309/shop_videos/performance",
            "/analytics/202405/shop_videos/performance"
        ]));

        $lastException = null;
        foreach ($candidates as $candidatePath) {
            try {
                // For candidate probe, attempt with 1 retry to fail fast on invalid versions
                $res = $this->requestV2("GET", $candidatePath, $queryParams, null, $accessToken, $connectTimeout, $readTimeout, 1);
                // Success: cache resolved endpoint
                self::$resolvedVideosEndpoint = $candidatePath;
                return $res;
            } catch (\Throwable $e) {
                $lastException = $e;
                $msg = $e->getMessage();
                // Check if error is specifically an invalid API version (Code 36009004 or 404)
                $isVersionError = (
                    stripos($msg, '36009004') !== false || 
                    stripos($msg, 'Invalid API version') !== false ||
                    (stripos($msg, 'version') !== false && stripos($msg, 'invalid') !== false) ||
                    stripos($msg, 'HTTP 404') !== false
                );
                if ($isVersionError) {
                    continue;
                }
                // If it's a business logic error (e.g., scope missing, auth error, rate limit),
                // this version route is valid. Cache candidate and throw.
                self::$resolvedVideosEndpoint = $candidatePath;
                throw $e;
            }
        }

        throw $lastException ?? new RuntimeException("Không tìm thấy phiên bản TikTok Video Analytics API phù hợp.");
    }

    /**
     * Lấy chỉ số hiệu suất sản phẩm (Product Performance)
     * Scope: data.shop_analytics.public.read
     * Method: GET /analytics/202405/shop_products/{product_id}/performance
     */
    public function getProductPerformance(string $accessToken, string $shopCipher, string $productId, string $startDate, string $endDate, array $options = []): array {
        $queryParams = [
            "shop_cipher" => $shopCipher,
            "start_date_ge" => $startDate,
            "end_date_lt" => $endDate,
            "currency" => $options['currency'] ?? 'LOCAL'
        ];

        $encodedProductId = rawurlencode($productId);
        $path = "/analytics/202405/shop_products/{$encodedProductId}/performance";

        return $this->request("GET", $path, $queryParams, null, $accessToken);
    }

    /**
     * Tìm kiếm đơn hàng tiếp thị liên kết (TikTok Shop Seller Affiliate Orders)
     * Scope: seller.affiliate_collaboration.read
     * Method: POST /affiliate_seller/202410/orders/search
     */
    public function searchAffiliateOrders(string $accessToken, string $shopCipher, array $options = []): array {
        $pageSize = isset($options['page_size']) ? (int)$options['page_size'] : 20;
        if ($pageSize < 1 || $pageSize > 100) {
            $pageSize = 20;
        }

        $queryParams = [
            "shop_cipher" => $shopCipher
        ];

        $bodyData = [
            "page_size" => $pageSize
        ];

        if (!empty($options['page_token'])) {
            $bodyData['page_token'] = (string)$options['page_token'];
        }
        if (!empty($options['create_time_ge'])) {
            $bodyData['create_time_ge'] = (int)$options['create_time_ge'];
        }
        if (!empty($options['create_time_lt'])) {
            $bodyData['create_time_lt'] = (int)$options['create_time_lt'];
        }
        if (!empty($options['order_status'])) {
            $bodyData['order_status'] = (string)$options['order_status'];
        }

        $path = defined('TIKTOK_API_AFFILIATE_ORDERS_ENDPOINT')
            ? TIKTOK_API_AFFILIATE_ORDERS_ENDPOINT
            : "/affiliate_seller/202410/orders/search";

        return $this->requestV2("POST", $path, $queryParams, $bodyData, $accessToken);
    }
}


