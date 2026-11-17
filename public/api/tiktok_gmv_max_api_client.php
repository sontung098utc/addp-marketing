<?php
/**
 * ADDP COMMERCE INTELLIGENCE - TIKTOK GMV MAX API CLIENT
 * 
 * Component: Sprint V2-02A.2 Official GMV Max API Ingestion
 * 
 * Target Endpoint:
 *   GET /open_api/v1.3/gmv_max/report/get/
 *   Base: https://business-api.tiktok.com/open_api/v1.3/
 * 
 * Responsibilities:
 *   1. Production-grade HTTP client with bounded retries, timeouts, and rate-limit backoff.
 *   2. Parameter builder supporting advertiser_id, store_ids, date bounding, dimensions, metrics, filtering, pagination.
 *   3. Multi-page pagination aggregation (fetchAllPages).
 *   4. Date range auto-chunking (max 30 days per chunk) with zero truncation.
 *   5. Response structure validation and structured error handling.
 *   6. Strict security: Zero token logging, fail-closed error redaction.
 *   7. Testable via injectable transport.
 */

declare(strict_types=1);

class TikTokAdsApiException extends \RuntimeException {
    private int $apiCode;
    private ?string $requestId;
    private array $rawResponse;

    public function __construct(
        string $message,
        int $apiCode = 0,
        ?string $requestId = null,
        array $rawResponse = [],
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, $apiCode, $previous);
        $this->apiCode = $apiCode;
        $this->requestId = $requestId;
        $this->rawResponse = $rawResponse;
    }

    public function getApiCode(): int {
        return $this->apiCode;
    }

    public function getRequestId(): ?string {
        return $this->requestId;
    }

    public function getRawResponse(): array {
        return $this->rawResponse;
    }
}

class TikTokGmvMaxApiClient {
    public const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3';
    public const ENDPOINT_GMV_MAX_REPORT = '/gmv_max/report/get/';
    public const API_VERSION = 'v1.3';
    public const DEFAULT_PAGE_SIZE = 100;
    public const MAX_DATE_CHUNK_DAYS = 30; // TikTok Ads API report limit per query
    public const MAX_RETRIES = 3;
    public const TIMEOUT_SECONDS = 15;
    public const CONNECT_TIMEOUT_SECONDS = 5;

    // Supported dimensions for Campaign GMV Max
    public const SUPPORTED_DIMENSIONS = [
        'campaign_id',
        'stat_time_day',
        'stat_time_hour',
        'item_group_id',
        'item_id',
        'room_id',
        'duration'
    ];

    // Supported official metrics
    public const SUPPORTED_METRICS = [
        'cost',
        'net_cost',
        'orders',
        'cost_per_order',
        'gross_revenue',
        'roi',
        'product_impressions',
        'product_clicks',
        'product_click_rate',
        'ad_click_rate',
        'ad_conversion_rate',
        'live_views',
        'cost_per_live_view',
        '10_second_live_views',
        'cost_per_10_second_live_view',
        'live_follows'
    ];

    private string $baseUrl;
    /** @var callable|null */
    private $httpTransport;

    /**
     * @param string|null $baseUrl Custom base URL if needed
     * @param callable|null $httpTransport Callable ($url, $method, $headers, $queryParams, $timeout) for testing
     */
    public function __construct(?string $baseUrl = null, ?callable $httpTransport = null) {
        $this->baseUrl = rtrim($baseUrl ?? self::BASE_URL, '/');
        $this->httpTransport = $httpTransport;
    }

    /**
     * Builds standard Campaign GMV Max report parameters
     */
    public function buildCampaignReportParams(
        string $advertiserId,
        string $startDate,
        string $endDate,
        array $options = []
    ): array {
        $this->validateDateFormat($startDate, 'start_date');
        $this->validateDateFormat($endDate, 'end_date');

        if ($startDate > $endDate) {
            throw new \InvalidArgumentException("start_date ({$startDate}) cannot be after end_date ({$endDate})");
        }

        $params = [
            'advertiser_id' => $advertiserId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'dimensions' => $options['dimensions'] ?? ['campaign_id', 'stat_time_day'],
            'metrics' => $options['metrics'] ?? ['cost', 'net_cost', 'orders', 'cost_per_order', 'gross_revenue', 'roi'],
            'page' => (int)($options['page'] ?? 1),
            'page_size' => (int)($options['page_size'] ?? self::DEFAULT_PAGE_SIZE)
        ];

        if (!empty($options['store_ids']) && is_array($options['store_ids'])) {
            $params['store_ids'] = array_values($options['store_ids']);
        }

        if (!empty($options['filtering']) && is_array($options['filtering'])) {
            $params['filtering'] = $options['filtering'];
        }

        return $params;
    }

    /**
     * Builds Product/SPU GMV Max report parameters.
     * Enforces fail-fast validation: requires campaign_ids >= 1.
     * STRICT SAFETY: Never sends gmv_max_promotion_types (rejected by API).
     */
    public function buildProductReportParams(
        string $advertiserId,
        string $startDate,
        string $endDate,
        array $campaignIds,
        array $options = []
    ): array {
        $this->validateDateFormat($startDate, 'start_date');
        $this->validateDateFormat($endDate, 'end_date');

        if ($startDate > $endDate) {
            throw new \InvalidArgumentException("start_date ({$startDate}) cannot be after end_date ({$endDate})");
        }

        if (empty($campaignIds)) {
            throw new \InvalidArgumentException("Product-level GMV Max report requires at least 1 campaign_id in filtering.");
        }

        $filtering = [
            'campaign_ids' => array_values(array_map('strval', $campaignIds))
        ];

        $params = [
            'advertiser_id' => $advertiserId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'dimensions' => $options['dimensions'] ?? ['campaign_id', 'item_group_id', 'stat_time_day'],
            'metrics' => $options['metrics'] ?? ['cost', 'gross_revenue', 'orders', 'roi'],
            'filtering' => $filtering,
            'page' => (int)($options['page'] ?? 1),
            'page_size' => (int)($options['page_size'] ?? self::DEFAULT_PAGE_SIZE)
        ];

        if (!empty($options['store_ids']) && is_array($options['store_ids'])) {
            $params['store_ids'] = array_values($options['store_ids']);
        }

        return $params;
    }

    /**
     * Builds Creative/Video GMV Max report parameters.
     * Enforces fail-fast validation: requires campaign_ids >= 1 AND item_group_ids >= 1.
     * STRICT SAFETY: Never sends gmv_max_promotion_types.
     */
    public function buildCreativeReportParams(
        string $advertiserId,
        string $startDate,
        string $endDate,
        array $campaignIds,
        array $itemGroupIds,
        array $options = []
    ): array {
        $this->validateDateFormat($startDate, 'start_date');
        $this->validateDateFormat($endDate, 'end_date');

        if ($startDate > $endDate) {
            throw new \InvalidArgumentException("start_date ({$startDate}) cannot be after end_date ({$endDate})");
        }

        if (empty($campaignIds)) {
            throw new \InvalidArgumentException("Creative-level GMV Max report requires at least 1 campaign_id in filtering.");
        }

        if (empty($itemGroupIds)) {
            throw new \InvalidArgumentException("Creative-level GMV Max report requires at least 1 item_group_id in filtering.");
        }

        $filtering = [
            'campaign_ids' => array_values(array_map('strval', $campaignIds)),
            'item_group_ids' => array_values(array_map('strval', $itemGroupIds))
        ];

        $params = [
            'advertiser_id' => $advertiserId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'dimensions' => $options['dimensions'] ?? ['campaign_id', 'item_group_id', 'item_id', 'stat_time_day'],
            'metrics' => $options['metrics'] ?? ['creative_delivery_status', 'cost', 'gross_revenue', 'orders', 'roi'],
            'filtering' => $filtering,
            'page' => (int)($options['page'] ?? 1),
            'page_size' => (int)($options['page_size'] ?? self::DEFAULT_PAGE_SIZE)
        ];

        if (!empty($options['store_ids']) && is_array($options['store_ids'])) {
            $params['store_ids'] = array_values($options['store_ids']);
        }

        return $params;
    }

    /**
     * Builds LIVE GMV Max report parameters.
     * Dimensions: campaign_id, room_id, stat_time_day.
     */
    public function buildLiveReportParams(
        string $advertiserId,
        string $startDate,
        string $endDate,
        array $campaignIds = [],
        array $options = []
    ): array {
        $this->validateDateFormat($startDate, 'start_date');
        $this->validateDateFormat($endDate, 'end_date');

        if ($startDate > $endDate) {
            throw new \InvalidArgumentException("start_date ({$startDate}) cannot be after end_date ({$endDate})");
        }

        $params = [
            'advertiser_id' => $advertiserId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'dimensions' => $options['dimensions'] ?? ['campaign_id', 'room_id', 'stat_time_day'],
            'metrics' => $options['metrics'] ?? ['cost', 'gross_revenue', 'orders', 'roi'],
            'page' => (int)($options['page'] ?? 1),
            'page_size' => (int)($options['page_size'] ?? self::DEFAULT_PAGE_SIZE)
        ];

        if (!empty($campaignIds)) {
            $params['filtering'] = ['campaign_ids' => array_values(array_map('strval', $campaignIds))];
        }

        if (!empty($options['store_ids']) && is_array($options['store_ids'])) {
            $params['store_ids'] = array_values($options['store_ids']);
        }

        return $params;
    }

    /**
     * Normalizes raw TikTok delivery status safely without crashing on known variants/typos (e.g. NOT_DELIVERYING).
     */
    public static function normalizeCreativeDeliveryStatus(?string $rawStatus): string {
        if ($rawStatus === null || trim($rawStatus) === '') {
            return 'UNKNOWN';
        }
        $trimmed = strtoupper(trim($rawStatus));
        switch ($trimmed) {
            case 'DELIVERING':
                return 'DELIVERING';
            case 'NOT_DELIVERYING': // TikTok API runtime typo variant
            case 'NOT_DELIVERING':
                return 'NOT_DELIVERING';
            case 'AUTHORIZATION_NEEDED':
                return 'AUTHORIZATION_NEEDED';
            case 'LEARNING':
                return 'LEARNING';
            case 'IN_QUEUE':
                return 'IN_QUEUE';
            case 'EXCLUDED':
                return 'EXCLUDED';
            case 'UNAVAILABLE':
                return 'UNAVAILABLE';
            case 'REJECTED':
                return 'REJECTED';
            case 'NOT_ACTIVE':
                return 'NOT_ACTIVE';
            default:
                return 'UNKNOWN';
        }
    }

    /**
     * Normalizes creative item ID.
     * item_id = -1 indicates unknown/unattributed creative bucket from TikTok.
     */
    public static function normalizeCreativeItemId(mixed $rawItemId): array {
        $strId = (string)$rawItemId;
        if ($strId === '-1' || (int)$rawItemId === -1) {
            return [
                'item_id' => '-1',
                'is_unattributed' => true,
                'display_name' => 'UNKNOWN / UNATTRIBUTED CREATIVE'
            ];
        }
        return [
            'item_id' => $strId,
            'is_unattributed' => false,
            'display_name' => $strId
        ];
    }


    /**
     * Executes a single paginated GET /open_api/v1.3/gmv_max/report/get/ request
     * with bounded retry, rate-limit backoff, and token redaction.
     *
     * @param array $params
     * @param string $accessToken
     * @return array Decoded TikTok response data
     * @throws TikTokAdsApiException
     */
    public function fetchReportPage(array $params, string $accessToken): array {
        if (empty($accessToken)) {
            throw new \InvalidArgumentException("TikTok Ads access token is required.");
        }
        if (empty($params['advertiser_id'])) {
            throw new \InvalidArgumentException("advertiser_id is required in report parameters.");
        }

        $url = $this->baseUrl . self::ENDPOINT_GMV_MAX_REPORT;
        $attempt = 0;
        $lastException = null;

        while ($attempt < self::MAX_RETRIES) {
            $attempt++;
            try {
                $rawRes = $this->executeHttpRequest($url, 'GET', $params, $accessToken);
                return $this->validateAndDecodeResponse($rawRes, $accessToken);
            } catch (TikTokAdsApiException $apiEx) {
                // Check if rate limited or transient server error
                $code = $apiEx->getApiCode();
                $isRateLimited = ($code === 40100 || $code === 40101 || $code === 429);
                $isServerError = ($code >= 50000 && $code <= 59999);

                if (($isRateLimited || $isServerError) && $attempt < self::MAX_RETRIES) {
                    $delayUs = (int)(200000 * pow(2, $attempt - 1)); // 200ms, 400ms...
                    usleep($delayUs);
                    $lastException = $apiEx;
                    continue;
                }
                throw $apiEx;
            } catch (\Throwable $t) {
                if ($attempt < self::MAX_RETRIES) {
                    $delayUs = (int)(150000 * pow(2, $attempt - 1));
                    usleep($delayUs);
                    $lastException = $t;
                    continue;
                }
                $safeMsg = $this->redactToken($t->getMessage(), $accessToken);
                throw new TikTokAdsApiException("Transport error on attempt {$attempt}: {$safeMsg}", -1, null, [], $t);
            }
        }

        $finalMsg = $lastException ? $lastException->getMessage() : "Exhausted all {$attempt} attempts";
        throw new TikTokAdsApiException("Request failed after {$attempt} retries: " . $this->redactToken($finalMsg, $accessToken), -1);
    }

    /**
     * Fetches all pages for a single bounded query automatically.
     *
     * @param array $params
     * @param string $accessToken
     * @return array Combined list of rows and pagination summary
     */
    public function fetchAllPages(array $params, string $accessToken): array {
        $currentPage = (int)($params['page'] ?? 1);
        $pageSize = (int)($params['page_size'] ?? self::DEFAULT_PAGE_SIZE);

        $allRows = [];
        $totalNumber = null;
        $totalPages = null;
        $maxPageSafety = 100; // Circuit breaker

        while ($currentPage <= $maxPageSafety) {
            $pageParams = $params;
            $pageParams['page'] = $currentPage;
            $pageParams['page_size'] = $pageSize;

            $res = $this->fetchReportPage($pageParams, $accessToken);
            $data = $res['data'] ?? [];
            $list = $data['list'] ?? [];
            $pageInfo = $data['page_info'] ?? [];

            $totalNumber = isset($pageInfo['total_number']) ? (int)$pageInfo['total_number'] : $totalNumber;
            $totalPages = isset($pageInfo['total_page']) ? (int)$pageInfo['total_page'] : 1;

            foreach ($list as $row) {
                $allRows[] = $row;
            }

            if (empty($list) || $currentPage >= $totalPages || count($allRows) >= ($totalNumber ?? count($allRows))) {
                break;
            }

            $currentPage++;
        }

        return [
            'list' => $allRows,
            'total_number' => $totalNumber ?? count($allRows),
            'total_page' => $totalPages ?? 1,
            'pages_fetched' => $currentPage
        ];
    }

    /**
     * Fetches a date-bounded report with automatic chunking if range > 30 days.
     * Guarantees ZERO silent truncation.
     *
     * @param array $params
     * @param string $accessToken
     * @return array Consolidated list of report rows
     */
    public function fetchDateBoundedReport(array $params, string $accessToken): array {
        $startDate = $params['start_date'];
        $endDate = $params['end_date'];

        $dtStart = new \DateTime($startDate);
        $dtEnd = new \DateTime($endDate);
        $diffDays = (int)$dtStart->diff($dtEnd)->format('%a') + 1;

        if ($diffDays <= self::MAX_DATE_CHUNK_DAYS) {
            $pageResult = $this->fetchAllPages($params, $accessToken);
            return $pageResult['list'];
        }

        // Chunking needed
        $chunks = [];
        $cursor = clone $dtStart;

        while ($cursor <= $dtEnd) {
            $chunkStart = $cursor->format('Y-m-d');
            $chunkEndDt = (clone $cursor)->modify('+' . (self::MAX_DATE_CHUNK_DAYS - 1) . ' days');
            if ($chunkEndDt > $dtEnd) {
                $chunkEndDt = clone $dtEnd;
            }
            $chunkEnd = $chunkEndDt->format('Y-m-d');

            $chunks[] = ['start' => $chunkStart, 'end' => $chunkEnd];
            $cursor = (clone $chunkEndDt)->modify('+1 day');
        }

        $allRows = [];
        foreach ($chunks as $c) {
            $chunkParams = $params;
            $chunkParams['start_date'] = $c['start'];
            $chunkParams['end_date'] = $c['end'];

            $res = $this->fetchAllPages($chunkParams, $accessToken);
            foreach ($res['list'] as $row) {
                $allRows[] = $row;
            }
        }

        return $allRows;
    }

    /**
     * Fetches date-bounded report batched by campaign_ids (<= 100 per request).
     * Automatically handles service-level batching so callers do not have to split batches manually.
     * Preserves pagination inside each batch, aggregates results, and collects batch-level errors without aborting other batches.
     *
     * @param array $baseParams
     * @param array $campaignIds
     * @param string $accessToken
     * @param int $batchSize
     * @return array ['list' => array, 'requested_batches' => int, 'successful_batches' => int, 'failed_batches' => int, 'errors' => array]
     */
    public function fetchBatchedCampaignReports(
        array $baseParams,
        array $campaignIds,
        string $accessToken,
        int $batchSize = 100
    ): array {
        if (empty($campaignIds)) {
            return [
                'list' => [],
                'requested_batches' => 0,
                'successful_batches' => 0,
                'failed_batches' => 0,
                'errors' => []
            ];
        }

        $cleanIds = array_values(array_unique(array_filter(array_map('strval', $campaignIds), function($id) {
            return trim($id) !== '';
        })));

        if (empty($cleanIds)) {
            return [
                'list' => [],
                'requested_batches' => 0,
                'successful_batches' => 0,
                'failed_batches' => 0,
                'errors' => []
            ];
        }

        $chunks = array_chunk($cleanIds, max(1, min($batchSize, 100)));
        $allRows = [];
        $errors = [];
        $successCount = 0;
        $failCount = 0;

        foreach ($chunks as $idx => $chunk) {
            $batchParams = $baseParams;
            if (!isset($batchParams['filtering'])) {
                $batchParams['filtering'] = [];
            }
            $batchParams['filtering']['campaign_ids'] = $chunk;

            try {
                $rows = $this->fetchDateBoundedReport($batchParams, $accessToken);
                foreach ($rows as $r) {
                    $allRows[] = $r;
                }
                $successCount++;
            } catch (\Throwable $t) {
                $failCount++;
                $errors[] = [
                    'batch_index' => $idx + 1,
                    'campaign_ids_count' => count($chunk),
                    'error' => $this->redactToken($t->getMessage(), $accessToken)
                ];
            }
        }

        return [
            'list' => $allRows,
            'requested_batches' => count($chunks),
            'successful_batches' => $successCount,
            'failed_batches' => $failCount,
            'errors' => $errors
        ];
    }

    /**
     * Executes HTTP request either via custom transport or cURL
     */
    private function executeHttpRequest(
        string $url,
        string $method,
        array $queryParams,
        string $accessToken
    ): string {
        $headers = [
            'Access-Token: ' . $accessToken,
            'Content-Type: application/json'
        ];

        if ($this->httpTransport !== null) {
            return ($this->httpTransport)($url, $method, $headers, $queryParams, self::TIMEOUT_SECONDS);
        }

        // Standard cURL implementation
        $encodedQuery = $this->buildQueryString($queryParams);
        $fullUrl = $url . '?' . $encodedQuery;

        $ch = curl_init($fullUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, self::TIMEOUT_SECONDS);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, self::CONNECT_TIMEOUT_SECONDS);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);

        $rawResponse = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($rawResponse === false) {
            throw new \RuntimeException("cURL error: {$curlError}");
        }

        if ($httpCode !== 200) {
            $safeError = $this->redactToken((string)$rawResponse, $accessToken);
            throw new TikTokAdsApiException("HTTP error {$httpCode}: {$safeError}", $httpCode);
        }

        return (string)$rawResponse;
    }

    /**
     * Builds URL query string encoding array/object fields to JSON strings
     * as required by TikTok Marketing API GET endpoints.
     */
    public function buildQueryString(array $params): string {
        $parts = [];
        foreach ($params as $key => $val) {
            if (is_array($val) || is_object($val)) {
                $parts[] = urlencode((string)$key) . '=' . urlencode(json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            } elseif ($val !== null) {
                $parts[] = urlencode((string)$key) . '=' . urlencode((string)$val);
            }
        }
        return implode('&', $parts);
    }

    /**
     * Validates and decodes TikTok JSON response
     */
    private function validateAndDecodeResponse(string $rawJson, string $accessToken): array {
        $decoded = json_decode($rawJson, true);
        if (!is_array($decoded)) {
            $safeSample = $this->redactToken(substr($rawJson, 0, 200), $accessToken);
            throw new TikTokAdsApiException("Failed to decode JSON response from TikTok Ads API: {$safeSample}", -1);
        }

        $code = (int)($decoded['code'] ?? -1);
        $message = (string)($decoded['message'] ?? 'Unknown status');
        $requestId = isset($decoded['request_id']) ? (string)$decoded['request_id'] : null;

        if ($code !== 0) {
            $safeMsg = $this->redactToken($message, $accessToken);
            throw new TikTokAdsApiException("TikTok Ads API error (code {$code}): {$safeMsg}", $code, $requestId, $decoded);
        }

        if (!isset($decoded['data']) || !is_array($decoded['data'])) {
            throw new TikTokAdsApiException("TikTok Ads API response missing 'data' object", 0, $requestId, $decoded);
        }

        return $decoded;
    }

    /**
     * Validates date string format YYYY-MM-DD
     */
    private function validateDateFormat(string $date, string $fieldName): void {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new \InvalidArgumentException("{$fieldName} must be in YYYY-MM-DD format (got '{$date}')");
        }
        $parts = explode('-', $date);
        if (!checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0])) {
            throw new \InvalidArgumentException("{$fieldName} is not a valid calendar date ('{$date}')");
        }
    }

    /**
     * Strictly redacts access tokens from logs, traces, and exception messages
     */
    public function redactToken(string $text, ?string $token): string {
        if (empty($token) || strlen($token) < 4) {
            return $text;
        }
        return str_ireplace($token, '[REDACTED_ACCESS_TOKEN]', $text);
    }
}
