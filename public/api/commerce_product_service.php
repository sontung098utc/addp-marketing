<?php
/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE V2 - PRODUCT METADATA & IMAGE CATALOG SERVICE
 * File: public/api/commerce_product_service.php
 * Target: Authoritative Product Catalog, SKU Image Differentiation & Stable Cache Control
 *
 * Responsibilities:
 * 1. Synchronizes latest product titles and images from TikTok Shop Product Open API
 *    (/product/202309/products/search & /product/202309/products/{id}).
 * 2. Distinguishes Product-level images vs SKU-level variant images:
 *    - Only assigns specific SKU images when TikTok explicitly supplies distinct sku_img.
 *    - Fallbacks gracefully to Product cover when SKU doesn't have an individual photo.
 * 3. Stable Image Versioning & Smart Cache Invalidation:
 *    - Increments image_version and generates image_hash ONLY when the URL/image changes.
 *    - Strictly prevents appending random query parameters (?t=Date.now()) on every load.
 * 4. Resilient Fallbacks:
 *    - When no valid image is present, returns null so the frontend displays a neutral
 *      placeholder (<Package />), preventing false product pictures from showing.
 *    - In-memory and transient caching to avoid re-fetching on every tab switch.
 * 5. Safe Integration:
 *    - Completely preserves order counting, gross revenue, cancellations, and accounting invariants.
 * ====================================================================
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/tiktok_client.php';
require_once __DIR__ . '/commerce_transient_cache.php';

class CommerceProductService {
    public const PLATFORM_TIKTOK_SHOP = 'tiktok_shop';

    private PDO $db;
    private ?TikTokClient $client;

    public function __construct(PDO $db, ?TikTokClient $client = null) {
        $this->db = $db;
        $this->client = $client;
    }

    /**
     * Ensures the commerce_product_catalog table exists safely on MySQL/MariaDB or SQLite.
     */
    public function ensureTableExists(): bool {
        try {
            $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
            if ($driver === 'sqlite') {
                $this->db->exec("CREATE TABLE IF NOT EXISTS `commerce_product_catalog` (
                    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
                    `platform` TEXT NOT NULL DEFAULT 'tiktok_shop',
                    `shop_id` TEXT NOT NULL,
                    `product_id` TEXT NOT NULL,
                    `sku_id` TEXT NOT NULL DEFAULT '',
                    `product_name` TEXT NOT NULL,
                    `sku_name` TEXT NULL,
                    `product_image` TEXT NULL,
                    `sku_image` TEXT NULL,
                    `display_image_url` TEXT NULL,
                    `has_sku_image` INTEGER NOT NULL DEFAULT 0,
                    `image_source` TEXT NOT NULL DEFAULT 'TIKTOK_PRODUCT_API',
                    `image_hash` TEXT NULL,
                    `image_version` INTEGER NOT NULL DEFAULT 1,
                    `status` TEXT NOT NULL DEFAULT 'ACTIVATE',
                    `price` REAL NOT NULL DEFAULT 0.00,
                    `synced_at` TEXT NULL,
                    `created_at` TEXT DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (`platform`, `shop_id`, `product_id`, `sku_id`)
                )");
            } else {
                $this->db->exec("CREATE TABLE IF NOT EXISTS `commerce_product_catalog` (
                    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
                    `shop_id` VARCHAR(64) NOT NULL,
                    `product_id` VARCHAR(64) NOT NULL,
                    `sku_id` VARCHAR(64) NOT NULL DEFAULT '',
                    `product_name` VARCHAR(512) NOT NULL,
                    `sku_name` VARCHAR(255) NULL DEFAULT NULL,
                    `product_image` VARCHAR(1024) NULL DEFAULT NULL,
                    `sku_image` VARCHAR(1024) NULL DEFAULT NULL,
                    `display_image_url` VARCHAR(1024) NULL DEFAULT NULL,
                    `has_sku_image` TINYINT(1) NOT NULL DEFAULT 0,
                    `image_source` VARCHAR(32) NOT NULL DEFAULT 'TIKTOK_PRODUCT_API',
                    `image_hash` VARCHAR(64) NULL DEFAULT NULL,
                    `image_version` INT UNSIGNED NOT NULL DEFAULT 1,
                    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVATE',
                    `price` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
                    `synced_at` TIMESTAMP NULL DEFAULT NULL,
                    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    UNIQUE KEY `uq_platform_shop_prod_sku` (`platform`, `shop_id`, `product_id`, `sku_id`),
                    KEY `idx_shop_prod` (`shop_id`, `product_id`),
                    KEY `idx_shop_status` (`shop_id`, `status`),
                    KEY `idx_updated_at` (`updated_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            return true;
        } catch (\Throwable $t) {
            error_log("[COMMERCE_PRODUCT_SERVICE] ensureTableExists error: " . $t->getMessage());
            return false;
        }
    }

    /**
     * Sanitizes image URLs: strips invalid strings, blocks hardcoded/dummy fallbacks.
     * Returns null for invalid or missing URLs to allow clean neutral placeholder rendering.
     */
    public static function sanitizeImageUrl(?string $url): ?string {
        if ($url === null) return null;
        $clean = trim($url);
        if ($clean === '' || strlen($clean) < 8) return null;

        // Block dummy unsplash or local placeholders
        if (stripos($clean, 'unsplash') !== false || stripos($clean, 'placeholder') !== false) {
            return null;
        }

        // Must be a valid HTTP/HTTPS URL
        if (!preg_match('#^https?://#i', $clean)) {
            return null;
        }

        return $clean;
    }

    /**
     * Deterministic image hash for stable versioning and caching.
     */
    public static function computeImageHash(?string $url): ?string {
        $clean = self::sanitizeImageUrl($url);
        if ($clean === null) return null;
        return substr(md5($clean), 0, 12);
    }

    /**
     * Retrieves the authoritative product catalog map for a shop.
     * Returns associative map keyed by "product_id:sku_id" and "product_id:".
     * Uses transient cache for zero lag on repeated tab visits.
     */
    public function getShopCatalogMap(string $shopId): array {
        $cacheKey = "product_catalog_map_" . $shopId;
        $cached = CommerceTransientCache::get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        $this->ensureTableExists();

        $map = [];
        try {
            $stmt = $this->db->prepare("SELECT 
                product_id, sku_id, product_name, sku_name, product_image,
                sku_image, display_image_url, has_sku_image, image_source,
                image_hash, image_version, status, updated_at
            FROM `commerce_product_catalog`
            WHERE platform = :platform AND shop_id = :shop_id");
            $stmt->execute([
                ':platform' => self::PLATFORM_TIKTOK_SHOP,
                ':shop_id' => $shopId
            ]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as $r) {
                $pId = (string)$r['product_id'];
                $sId = (string)($r['sku_id'] ?? '');
                $key = $pId . ':' . $sId;
                $map[$key] = [
                    'product_id' => $pId,
                    'sku_id' => $sId,
                    'product_name' => $r['product_name'],
                    'sku_name' => $r['sku_name'],
                    'product_image' => self::sanitizeImageUrl($r['product_image']),
                    'sku_image' => self::sanitizeImageUrl($r['sku_image']),
                    'display_image_url' => self::sanitizeImageUrl($r['display_image_url']),
                    'has_sku_image' => (bool)$r['has_sku_image'],
                    'image_source' => $r['image_source'],
                    'image_hash' => $r['image_hash'],
                    'image_version' => (int)($r['image_version'] ?? 1),
                    'status' => $r['status'] ?? 'ACTIVATE',
                    'updated_at' => $r['updated_at']
                ];
            }
        } catch (\Throwable $t) {
            error_log("[COMMERCE_PRODUCT_SERVICE] getShopCatalogMap error: " . $t->getMessage());
        }

        // If table is empty, auto-seed from existing commerce_order_items
        if (empty($map)) {
            $this->populateFromOrderItemsIfEmpty($shopId);
            // Re-fetch once if seeded
            try {
                $stmt = $this->db->prepare("SELECT 
                    product_id, sku_id, product_name, sku_name, product_image,
                    sku_image, display_image_url, has_sku_image, image_source,
                    image_hash, image_version, status, updated_at
                FROM `commerce_product_catalog`
                WHERE platform = :platform AND shop_id = :shop_id");
                $stmt->execute([':platform' => self::PLATFORM_TIKTOK_SHOP, ':shop_id' => $shopId]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $r) {
                    $key = (string)$r['product_id'] . ':' . (string)($r['sku_id'] ?? '');
                    $map[$key] = [
                        'product_id' => (string)$r['product_id'],
                        'sku_id' => (string)($r['sku_id'] ?? ''),
                        'product_name' => $r['product_name'],
                        'sku_name' => $r['sku_name'],
                        'product_image' => self::sanitizeImageUrl($r['product_image']),
                        'sku_image' => self::sanitizeImageUrl($r['sku_image']),
                        'display_image_url' => self::sanitizeImageUrl($r['display_image_url']),
                        'has_sku_image' => (bool)$r['has_sku_image'],
                        'image_source' => $r['image_source'],
                        'image_hash' => $r['image_hash'],
                        'image_version' => (int)($r['image_version'] ?? 1),
                        'status' => $r['status'] ?? 'ACTIVATE',
                        'updated_at' => $r['updated_at']
                    ];
                }
            } catch (\Throwable $t) {}
        }

        // Cache for 5 minutes (300 seconds)
        CommerceTransientCache::set($cacheKey, $map, 300);
        return $map;
    }

    /**
     * Seeds initial metadata from existing commerce_order_items if catalog is completely empty.
     */
    public function populateFromOrderItemsIfEmpty(string $shopId): int {
        try {
            $stmt = $this->db->prepare("SELECT 
                product_id,
                sku_id,
                MAX(product_name) as product_name,
                MAX(sku_name) as sku_name,
                MAX(sku_image) as sku_image
            FROM `commerce_order_items`
            WHERE platform = :platform AND shop_id = :shop_id
            GROUP BY product_id, sku_id");
            $stmt->execute([
                ':platform' => self::PLATFORM_TIKTOK_SHOP,
                ':shop_id' => $shopId
            ]);
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (empty($items)) return 0;

            $inserted = 0;
            foreach ($items as $item) {
                $pId = (string)$item['product_id'];
                $sId = (string)($item['sku_id'] ?? '');
                $pName = (string)($item['product_name'] ?? 'Sản phẩm TikTok Shop');
                $sName = !empty($item['sku_name']) ? (string)$item['sku_name'] : null;
                $sImg = self::sanitizeImageUrl($item['sku_image']);
                $hash = self::computeImageHash($sImg);

                $this->upsertCatalogEntry([
                    'platform' => self::PLATFORM_TIKTOK_SHOP,
                    'shop_id' => $shopId,
                    'product_id' => $pId,
                    'sku_id' => $sId,
                    'product_name' => $pName,
                    'sku_name' => $sName,
                    'product_image' => $sImg,
                    'sku_image' => $sImg,
                    'display_image_url' => $sImg,
                    'has_sku_image' => 0, // In order items we cannot verify if it was SKU-specific or product cover
                    'image_source' => 'TIKTOK_ORDER_ITEM',
                    'image_hash' => $hash,
                    'status' => 'ACTIVATE'
                ]);
                $inserted++;
            }
            return $inserted;
        } catch (\Throwable $t) {
            error_log("[COMMERCE_PRODUCT_SERVICE] populateFromOrderItems error: " . $t->getMessage());
            return 0;
        }
    }

    /**
     * Synchronizes authoritative products, SKUs and images from TikTok Shop Open API.
     */
    public function syncProductsFromTikTok(string $shopId, bool $force = false): array {
        $this->ensureTableExists();

        // 1. Get TikTok API credentials from config
        $accessToken = null;
        $shopCipher = null;
        try {
            $stmt = $this->db->prepare("SELECT access_token, refresh_token, shop_cipher FROM `tiktok_config` WHERE shop_id = ? ORDER BY updated_at DESC LIMIT 1");
            $stmt->execute([$shopId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $accessToken = $row['access_token'] ?? null;
                $shopCipher = $row['shop_cipher'] ?? null;
            }
        } catch (\Throwable $t) {}

        if (!$accessToken) {
            return [
                'success' => false,
                'code' => 'NO_ACCESS_TOKEN',
                'message' => 'Cửa hàng chưa có Token kết nối TikTok Shop hợp lệ hoặc đã hết hạn.',
                'synced_products' => 0,
                'synced_skus' => 0,
                'updated_images' => 0
            ];
        }

        if (!$this->client) {
            $this->client = class_exists('TikTokShopClient') ? new TikTokShopClient() : (class_exists('TikTokClient') ? new TikTokClient() : null);
        }

        if (empty($shopCipher)) {
            try {
                $shopCipher = $this->client->resolveShopCipher($shopId, $accessToken);
            } catch (\Throwable $t) {
                $shopCipher = '';
            }
        }

        if (empty($shopCipher)) {
            return [
                'success' => false,
                'code' => 'NO_SHOP_CIPHER',
                'message' => 'Không thể định danh shop_cipher cho cửa hàng.',
                'synced_products' => 0,
                'synced_skus' => 0,
                'updated_images' => 0
            ];
        }

        // 2. Query products from TikTok Shop Product Search API
        $totalProducts = 0;
        $totalSkus = 0;
        $updatedImages = 0;
        $pageToken = null;
        $maxPages = 10;
        $page = 0;

        try {
            do {
                $page++;
                $searchRes = $this->client->searchProducts($accessToken, $shopCipher, 50, $pageToken);
                $products = $searchRes['products'] ?? (isset($searchRes[0]) ? $searchRes : []);
                $pageToken = $searchRes['next_page_token'] ?? null;

                if (empty($products)) break;

                foreach ($products as $p) {
                    $pId = (string)($p['id'] ?? '');
                    if ($pId === '') continue;

                    $pTitle = (string)($p['title'] ?? 'Sản phẩm TikTok Shop');
                    $pStatus = strtoupper((string)($p['status'] ?? 'ACTIVATE'));

                    // Extract Product-level main image
                    $productMainImage = null;
                    if (!empty($p['main_images']) && is_array($p['main_images'])) {
                        $firstImg = $p['main_images'][0] ?? null;
                        if (is_array($firstImg)) {
                            $productMainImage = $firstImg['urls'][0] ?? $firstImg['url'] ?? $firstImg['thumb_urls'][0] ?? null;
                        }
                    }

                    // If main image or SKUs not detailed in search, call getProductDetail
                    $skusList = $p['skus'] ?? [];
                    if (empty($productMainImage) || empty($skusList)) {
                        try {
                            $detail = $this->client->getProductDetail($accessToken, $shopCipher, $pId);
                            if ($detail) {
                                if (empty($productMainImage) && !empty($detail['main_images'])) {
                                    $firstImg = $detail['main_images'][0] ?? null;
                                    if (is_array($firstImg)) {
                                        $productMainImage = $firstImg['urls'][0] ?? $firstImg['url'] ?? $firstImg['thumb_urls'][0] ?? null;
                                    }
                                }
                                if (empty($skusList) && !empty($detail['skus'])) {
                                    $skusList = $detail['skus'];
                                }
                                if (!empty($detail['title'])) {
                                    $pTitle = (string)$detail['title'];
                                }
                            }
                        } catch (\Throwable $t) {}
                    }

                    $productMainImage = self::sanitizeImageUrl($productMainImage);
                    $prodHash = self::computeImageHash($productMainImage);

                    // Upsert Product root entry (sku_id = '')
                    $this->upsertCatalogEntry([
                        'platform' => self::PLATFORM_TIKTOK_SHOP,
                        'shop_id' => $shopId,
                        'product_id' => $pId,
                        'sku_id' => '',
                        'product_name' => $pTitle,
                        'sku_name' => null,
                        'product_image' => $productMainImage,
                        'sku_image' => null,
                        'display_image_url' => $productMainImage,
                        'has_sku_image' => 0,
                        'image_source' => 'TIKTOK_PRODUCT_API',
                        'image_hash' => $prodHash,
                        'status' => $pStatus
                    ]);
                    $totalProducts++;

                    // Upsert each SKU with distinct SKU image analysis
                    if (!empty($skusList) && is_array($skusList)) {
                        foreach ($skusList as $sku) {
                            $skuId = (string)($sku['id'] ?? '');
                            if ($skuId === '') continue;

                            $skuName = (string)($sku['seller_sku'] ?? '');
                            $skuSpecificImage = null;

                            // Check SKU sales attributes for specific variant photo
                            if (!empty($sku['sales_attributes']) && is_array($sku['sales_attributes'])) {
                                foreach ($sku['sales_attributes'] as $attr) {
                                    if (!empty($attr['sku_img']) && is_array($attr['sku_img'])) {
                                        $skuSpecificImage = $attr['sku_img']['urls'][0] ?? $attr['sku_img']['url'] ?? $attr['sku_img']['thumb_urls'][0] ?? null;
                                    }
                                    if (!empty($attr['value_name']) && empty($skuName)) {
                                        $skuName = (string)$attr['value_name'];
                                    }
                                    if ($skuSpecificImage) break;
                                }
                            }

                            // Check direct sku_img or image field on SKU
                            if (empty($skuSpecificImage) && !empty($sku['sku_img']) && is_array($sku['sku_img'])) {
                                $skuSpecificImage = $sku['sku_img']['urls'][0] ?? $sku['sku_img']['url'] ?? null;
                            }
                            if (empty($skuSpecificImage) && !empty($sku['image']) && is_array($sku['image'])) {
                                $skuSpecificImage = $sku['image']['urls'][0] ?? $sku['image']['url'] ?? null;
                            }

                            $skuSpecificImage = self::sanitizeImageUrl($skuSpecificImage);

                            // Distinction: Only mark has_sku_image if distinct from product main cover
                            $hasSkuImg = 0;
                            $skuImgToStore = null;
                            $displayImg = $productMainImage;

                            if (!empty($skuSpecificImage) && $skuSpecificImage !== $productMainImage) {
                                $hasSkuImg = 1;
                                $skuImgToStore = $skuSpecificImage;
                                $displayImg = $skuSpecificImage;
                            }

                            $displayHash = self::computeImageHash($displayImg);
                            $wasUpdated = $this->upsertCatalogEntry([
                                'platform' => self::PLATFORM_TIKTOK_SHOP,
                                'shop_id' => $shopId,
                                'product_id' => $pId,
                                'sku_id' => $skuId,
                                'product_name' => $pTitle,
                                'sku_name' => $skuName ?: null,
                                'product_image' => $productMainImage,
                                'sku_image' => $skuImgToStore,
                                'display_image_url' => $displayImg,
                                'has_sku_image' => $hasSkuImg,
                                'image_source' => 'TIKTOK_PRODUCT_API',
                                'image_hash' => $displayHash,
                                'status' => $pStatus
                            ]);

                            if ($wasUpdated) {
                                $updatedImages++;
                            }
                            $totalSkus++;

                            // Also update commerce_order_items to align order history display
                            try {
                                $stmtUpdateItems = $this->db->prepare("UPDATE `commerce_order_items`
                                    SET sku_image = :display_img, product_name = :p_name
                                    WHERE platform = :platform AND shop_id = :shop_id 
                                      AND product_id = :p_id AND sku_id = :s_id");
                                $stmtUpdateItems->execute([
                                    ':display_img' => $displayImg,
                                    ':p_name' => $pTitle,
                                    ':platform' => self::PLATFORM_TIKTOK_SHOP,
                                    ':shop_id' => $shopId,
                                    ':p_id' => $pId,
                                    ':s_id' => $skuId
                                ]);
                            } catch (\Throwable $t) {}
                        }
                    }
                }
            } while (!empty($pageToken) && $page < $maxPages);

            // Invalidate transient cache so subsequent calls reflect fresh metadata immediately
            CommerceTransientCache::delete("product_catalog_map_" . $shopId);

            return [
                'success' => true,
                'code' => 'SYNC_SUCCESS',
                'message' => "Đã đồng bộ thành công {$totalProducts} sản phẩm và {$totalSkus} SKUs từ TikTok Shop API.",
                'synced_products' => $totalProducts,
                'synced_skus' => $totalSkus,
                'updated_images' => $updatedImages
            ];
        } catch (\Throwable $t) {
            error_log("[COMMERCE_PRODUCT_SERVICE] syncProductsFromTikTok error: " . $t->getMessage());
            return [
                'success' => false,
                'code' => 'API_SYNC_ERROR',
                'message' => 'Lỗi kết nối TikTok Shop Product API: ' . $t->getMessage(),
                'synced_products' => $totalProducts,
                'synced_skus' => $totalSkus,
                'updated_images' => $updatedImages
            ];
        }
    }

    /**
     * Upserts an authoritative catalog entry.
     * Computes versioning: if display_image_url or image_hash changed, increments image_version.
     * Returns true if image changed.
     */
    public function upsertCatalogEntry(array $data): bool {
        $platform = $data['platform'] ?? self::PLATFORM_TIKTOK_SHOP;
        $shopId = $data['shop_id'];
        $productId = $data['product_id'];
        $skuId = $data['sku_id'] ?? '';
        $productName = $data['product_name'];
        $skuName = $data['sku_name'] ?? null;
        $productImage = self::sanitizeImageUrl($data['product_image'] ?? null);
        $skuImage = self::sanitizeImageUrl($data['sku_image'] ?? null);
        $displayImageUrl = self::sanitizeImageUrl($data['display_image_url'] ?? null);
        $hasSkuImage = !empty($data['has_sku_image']) ? 1 : 0;
        $imageSource = $data['image_source'] ?? 'TIKTOK_PRODUCT_API';
        $imageHash = $data['image_hash'] ?? self::computeImageHash($displayImageUrl);
        $status = $data['status'] ?? 'ACTIVATE';
        $price = (float)($data['price'] ?? 0.0);

        // Check existing row to handle image_version
        $existingVersion = 1;
        $existingHash = null;
        $isImageChanged = false;

        try {
            $stmtEx = $this->db->prepare("SELECT id, image_version, image_hash, display_image_url
                FROM `commerce_product_catalog`
                WHERE platform = ? AND shop_id = ? AND product_id = ? AND sku_id = ?
                LIMIT 1");
            $stmtEx->execute([$platform, $shopId, $productId, $skuId]);
            $existing = $stmtEx->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                $existingVersion = (int)($existing['image_version'] ?? 1);
                $existingHash = $existing['image_hash'] ?? null;

                if ($existingHash !== $imageHash && $imageHash !== null) {
                    $existingVersion++;
                    $isImageChanged = true;
                }
            } else {
                $isImageChanged = true;
            }
        } catch (\Throwable $t) {}

        $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'sqlite') {
            $sql = "INSERT INTO `commerce_product_catalog` (
                platform, shop_id, product_id, sku_id, product_name, sku_name,
                product_image, sku_image, display_image_url, has_sku_image,
                image_source, image_hash, image_version, status, price, synced_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(platform, shop_id, product_id, sku_id) DO UPDATE SET
                product_name = excluded.product_name,
                sku_name = excluded.sku_name,
                product_image = excluded.product_image,
                sku_image = excluded.sku_image,
                display_image_url = excluded.display_image_url,
                has_sku_image = excluded.has_sku_image,
                image_source = excluded.image_source,
                image_hash = excluded.image_hash,
                image_version = excluded.image_version,
                status = excluded.status,
                price = excluded.price,
                synced_at = datetime('now'),
                updated_at = datetime('now')";
        } else {
            $sql = "INSERT INTO `commerce_product_catalog` (
                platform, shop_id, product_id, sku_id, product_name, sku_name,
                product_image, sku_image, display_image_url, has_sku_image,
                image_source, image_hash, image_version, status, price, synced_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                product_name = VALUES(product_name),
                sku_name = VALUES(sku_name),
                product_image = VALUES(product_image),
                sku_image = VALUES(sku_image),
                display_image_url = VALUES(display_image_url),
                has_sku_image = VALUES(has_sku_image),
                image_source = VALUES(image_source),
                image_hash = VALUES(image_hash),
                image_version = VALUES(image_version),
                status = VALUES(status),
                price = VALUES(price),
                synced_at = NOW(),
                updated_at = NOW()";
        }

        try {
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                $platform, $shopId, $productId, $skuId, $productName, $skuName,
                $productImage, $skuImage, $displayImageUrl, $hasSkuImage,
                $imageSource, $imageHash, $existingVersion, $status, $price
            ]);
            return $isImageChanged;
        } catch (\Throwable $t) {
            error_log("[COMMERCE_PRODUCT_SERVICE] upsertCatalogEntry error: " . $t->getMessage());
            return false;
        }
    }
}
