<?php
/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - PRODUCT UNIT ECONOMICS & BREAK-EVEN ROI SERVICE
 * Component: P0-04 Product-specific Break-even ROI Configuration
 * 
 * Target:
 * 1. Product-level Unit Economics (SPU grain item_group_id):
 *    - Selling Price (Giá bán tham chiếu)
 *    - COGS (Giá vốn hàng bán per unit)
 *    - Variable Cost (Đóng gói, nhân công, vận hành per unit)
 *    - Platform Fee % (Phí sàn TikTok Shop %)
 * 2. Strict Mathematical Invariants:
 *    - Unit Margin = Selling Price - COGS - Variable Cost - (Platform Fee % * Selling Price)
 *    - Margin % = Unit Margin / Selling Price
 *    - Break-even ROAS = 1 / Margin Ratio = Selling Price / Unit Margin
 * 3. Zero Global Fallback:
 *    - If unconfigured, returns NOT_CONFIGURED. Never assumes 6.00x or 15.00x default.
 * ====================================================================
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

class CommerceProductCostService {
    public const PLATFORM = 'tiktok_shop';

    private PDO $db;
    private ?bool $tableExists = null;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? getDBConnection();
    }

    /**
     * Checks if commerce_product_costs table exists (and creates it if missing)
     */
    private function checkTableExists(): bool {
        if ($this->tableExists !== null) {
            return $this->tableExists;
        }

        try {
            $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
            if ($driver === 'sqlite') {
                $stmt = $this->db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='commerce_product_costs'");
                $exists = (bool)($stmt && $stmt->fetchColumn());
                if (!$exists) {
                    $this->db->exec("CREATE TABLE IF NOT EXISTS `commerce_product_costs` (
                        `id` INTEGER PRIMARY KEY AUTOINCREMENT,
                        `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
                        `shop_id` VARCHAR(64) NOT NULL,
                        `product_id` VARCHAR(64) NOT NULL,
                        `product_name` VARCHAR(255) DEFAULT NULL,
                        `selling_price` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                        `cogs_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                        `variable_cost_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                        `platform_fee_pct` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
                        `margin_target_pct` DECIMAL(6,2) DEFAULT NULL,
                        `unit_margin` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                        `margin_pct` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
                        `breakeven_roas` DECIMAL(8,2) DEFAULT NULL,
                        `status` VARCHAR(32) NOT NULL DEFAULT 'CONFIGURED',
                        `notes` TEXT DEFAULT NULL,
                        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(`platform`, `shop_id`, `product_id`)
                    )");
                    $exists = true;
                }
                $this->tableExists = $exists;
                return $this->tableExists;
            }

            $stmt = $this->db->query("SHOW TABLES LIKE 'commerce_product_costs'");
            $exists = (bool)($stmt && $stmt->fetchColumn());
            if (!$exists) {
                $this->db->exec("CREATE TABLE IF NOT EXISTS `commerce_product_costs` (
                    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
                    `shop_id` VARCHAR(64) NOT NULL,
                    `product_id` VARCHAR(64) NOT NULL,
                    `product_name` VARCHAR(255) DEFAULT NULL,
                    `selling_price` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    `cogs_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    `variable_cost_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    `platform_fee_pct` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
                    `margin_target_pct` DECIMAL(6,2) DEFAULT NULL,
                    `unit_margin` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    `margin_pct` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
                    `breakeven_roas` DECIMAL(8,2) DEFAULT NULL,
                    `status` VARCHAR(32) NOT NULL DEFAULT 'CONFIGURED',
                    `notes` TEXT DEFAULT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY `uk_shop_product_cost` (`platform`, `shop_id`, `product_id`),
                    INDEX `idx_shop_cost` (`shop_id`, `status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
                $exists = true;
            }
            $this->tableExists = $exists;
        } catch (\Throwable $t) {
            $this->tableExists = false;
        }

        return $this->tableExists;
    }

    /**
     * Computes unit margin and break-even ROAS accurately
     */
    public function calculateBreakEven(
        float $sellingPrice,
        float $cogs,
        float $variableCost = 0.0,
        float $platformFeePct = 0.0,
        ?float $marginTargetPct = null
    ): array {
        if ($sellingPrice <= 0.0 || $cogs <= 0.0) {
            return [
                'is_configured' => false,
                'selling_price' => $sellingPrice,
                'cogs_amount' => $cogs,
                'variable_cost_amount' => $variableCost,
                'platform_fee_pct' => $platformFeePct,
                'platform_fee_amount' => 0.0,
                'unit_margin' => null,
                'margin_pct' => null,
                'breakeven_roas' => null,
                'target_roas' => null,
                'status' => 'INSUFFICIENT_DATA',
                'message' => 'Giá bán và giá vốn (COGS) phải lớn hơn 0 để tính ROI hòa vốn.'
            ];
        }

        $platformFeeAmount = round(($platformFeePct / 100.0) * $sellingPrice, 2);
        $unitMargin = round($sellingPrice - $cogs - $variableCost - $platformFeeAmount, 2);
        $marginPct = round(($unitMargin / $sellingPrice) * 100.0, 2);

        if ($unitMargin <= 0.0) {
            return [
                'is_configured' => true,
                'selling_price' => $sellingPrice,
                'cogs_amount' => $cogs,
                'variable_cost_amount' => $variableCost,
                'platform_fee_pct' => $platformFeePct,
                'platform_fee_amount' => $platformFeeAmount,
                'unit_margin' => $unitMargin,
                'margin_pct' => $marginPct,
                'breakeven_roas' => null,
                'target_roas' => null,
                'status' => 'NEGATIVE_MARGIN',
                'message' => 'Giá vốn và chi phí vượt quá giá bán (Lợi nhuận đóng góp âm).'
            ];
        }

        $marginRatio = $unitMargin / $sellingPrice;
        $breakevenRoas = round(1.0 / $marginRatio, 2);

        // Optional target ROAS if target margin is desired
        $targetRoas = null;
        if ($marginTargetPct !== null && $marginTargetPct > 0.0) {
            $effectiveMarginRatio = max(0.01, $marginRatio - ($marginTargetPct / 100.0));
            $targetRoas = round(1.0 / $effectiveMarginRatio, 2);
        }

        return [
            'is_configured' => true,
            'selling_price' => $sellingPrice,
            'cogs_amount' => $cogs,
            'variable_cost_amount' => $variableCost,
            'platform_fee_pct' => $platformFeePct,
            'platform_fee_amount' => $platformFeeAmount,
            'unit_margin' => $unitMargin,
            'margin_pct' => $marginPct,
            'breakeven_roas' => $breakevenRoas,
            'target_roas' => $targetRoas,
            'status' => 'CONFIGURED',
            'message' => 'Đã tính toán thành công ROI hòa vốn.'
        ];
    }

    /**
     * Retrieves all product cost configurations for a shop
     */
    public function getProductCosts(string $shopId): array {
        if (!$this->checkTableExists()) {
            return [];
        }

        try {
            $stmt = $this->db->prepare("SELECT * FROM `commerce_product_costs` WHERE shop_id = ? ORDER BY updated_at DESC");
            $stmt->execute([$shopId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $result = [];
            foreach ($rows as $r) {
                $spuId = (string)$r['product_id'];
                $result[$spuId] = [
                    'product_id' => $spuId,
                    'product_name' => $r['product_name'],
                    'selling_price' => (float)$r['selling_price'],
                    'cogs_amount' => (float)$r['cogs_amount'],
                    'variable_cost_amount' => (float)$r['variable_cost_amount'],
                    'platform_fee_pct' => (float)$r['platform_fee_pct'],
                    'margin_target_pct' => $r['margin_target_pct'] !== null ? (float)$r['margin_target_pct'] : null,
                    'unit_margin' => (float)$r['unit_margin'],
                    'margin_pct' => (float)$r['margin_pct'],
                    'breakeven_roas' => $r['breakeven_roas'] !== null ? (float)$r['breakeven_roas'] : null,
                    'status' => $r['status'],
                    'notes' => $r['notes'],
                    'updated_at' => $r['updated_at']
                ];
            }
            return $result;
        } catch (\Throwable $t) {
            error_log("Failed to fetch product costs: " . $t->getMessage());
            return [];
        }
    }

    /**
     * Saves or updates product cost configuration
     */
    public function saveProductCost(string $shopId, string $productId, array $data): array {
        if (!$this->checkTableExists()) {
            return [
                'success' => false,
                'status' => 'SCHEMA_MIGRATION_REQUIRED',
                'message' => 'Bảng commerce_product_costs chưa được tạo. Vui lòng chạy migration 20261009_022_create_commerce_product_costs.sql.'
            ];
        }

        $prodName = trim((string)($data['product_name'] ?? ''));
        $sellingPrice = (float)($data['selling_price'] ?? 0.0);
        $cogs = (float)($data['cogs_amount'] ?? 0.0);
        $varCost = (float)($data['variable_cost_amount'] ?? 0.0);
        $feePct = (float)($data['platform_fee_pct'] ?? 0.0);
        $targetPct = isset($data['margin_target_pct']) && $data['margin_target_pct'] !== '' ? (float)$data['margin_target_pct'] : null;
        $notes = trim((string)($data['notes'] ?? ''));

        $calc = $this->calculateBreakEven($sellingPrice, $cogs, $varCost, $feePct, $targetPct);

        if (!$calc['is_configured']) {
            return [
                'success' => false,
                'status' => $calc['status'],
                'message' => $calc['message']
            ];
        }

        try {
            $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
            if ($driver === 'sqlite') {
                $sql = "INSERT INTO `commerce_product_costs` (
                    `platform`, `shop_id`, `product_id`, `product_name`, `selling_price`,
                    `cogs_amount`, `variable_cost_amount`, `platform_fee_pct`, `margin_target_pct`,
                    `unit_margin`, `margin_pct`, `breakeven_roas`, `status`, `notes`
                ) VALUES (
                    :platform, :shop_id, :product_id, :product_name, :selling_price,
                    :cogs_amount, :variable_cost_amount, :platform_fee_pct, :margin_target_pct,
                    :unit_margin, :margin_pct, :breakeven_roas, :status, :notes
                ) ON CONFLICT(`platform`, `shop_id`, `product_id`) DO UPDATE SET
                    `product_name` = COALESCE(excluded.`product_name`, `product_name`),
                    `selling_price` = excluded.`selling_price`,
                    `cogs_amount` = excluded.`cogs_amount`,
                    `variable_cost_amount` = excluded.`variable_cost_amount`,
                    `platform_fee_pct` = excluded.`platform_fee_pct`,
                    `margin_target_pct` = excluded.`margin_target_pct`,
                    `unit_margin` = excluded.`unit_margin`,
                    `margin_pct` = excluded.`margin_pct`,
                    `breakeven_roas` = excluded.`breakeven_roas`,
                    `status` = excluded.`status`,
                    `notes` = excluded.`notes`,
                    `updated_at` = CURRENT_TIMESTAMP";
            } else {
                $sql = "INSERT INTO `commerce_product_costs` (
                    `platform`, `shop_id`, `product_id`, `product_name`, `selling_price`,
                    `cogs_amount`, `variable_cost_amount`, `platform_fee_pct`, `margin_target_pct`,
                    `unit_margin`, `margin_pct`, `breakeven_roas`, `status`, `notes`
                ) VALUES (
                    :platform, :shop_id, :product_id, :product_name, :selling_price,
                    :cogs_amount, :variable_cost_amount, :platform_fee_pct, :margin_target_pct,
                    :unit_margin, :margin_pct, :breakeven_roas, :status, :notes
                ) ON DUPLICATE KEY UPDATE
                    `product_name` = COALESCE(VALUES(`product_name`), `product_name`),
                    `selling_price` = VALUES(`selling_price`),
                    `cogs_amount` = VALUES(`cogs_amount`),
                    `variable_cost_amount` = VALUES(`variable_cost_amount`),
                    `platform_fee_pct` = VALUES(`platform_fee_pct`),
                    `margin_target_pct` = VALUES(`margin_target_pct`),
                    `unit_margin` = VALUES(`unit_margin`),
                    `margin_pct` = VALUES(`margin_pct`),
                    `breakeven_roas` = VALUES(`breakeven_roas`),
                    `status` = VALUES(`status`),
                    `notes` = VALUES(`notes`),
                    `updated_at` = CURRENT_TIMESTAMP";
            }

            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':platform' => self::PLATFORM,
                ':shop_id' => $shopId,
                ':product_id' => $productId,
                ':product_name' => $prodName ?: null,
                ':selling_price' => $sellingPrice,
                ':cogs_amount' => $cogs,
                ':variable_cost_amount' => $varCost,
                ':platform_fee_pct' => $feePct,
                ':margin_target_pct' => $targetPct,
                ':unit_margin' => $calc['unit_margin'],
                ':margin_pct' => $calc['margin_pct'],
                ':breakeven_roas' => $calc['breakeven_roas'],
                ':status' => $calc['status'],
                ':notes' => $notes ?: null
            ]);

            return [
                'success' => true,
                'status' => 'SAVED',
                'product_id' => $productId,
                'unit_margin' => $calc['unit_margin'],
                'margin_pct' => $calc['margin_pct'],
                'breakeven_roas' => $calc['breakeven_roas'],
                'target_roas' => $calc['target_roas'],
                'message' => "Đã lưu thành công cấu hình giá vốn và ROI hòa vốn ({$calc['breakeven_roas']}x) cho sản phẩm."
            ];
        } catch (\Throwable $t) {
            error_log("Failed to save product cost: " . $t->getMessage());
            return [
                'success' => false,
                'status' => 'DB_ERROR',
                'message' => 'Lỗi lưu dữ liệu: ' . $t->getMessage()
            ];
        }
    }
}
