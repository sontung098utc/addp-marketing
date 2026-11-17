<?php
/**
 * Mock PDO for testing without requiring sqlite/mysql drivers.
 */

class MockPDOStatement extends PDOStatement {
    private mixed $rows;
    private int $idx = 0;

    public function __construct(mixed $rows = []) {
        if ($rows instanceof Throwable) {
            $this->rows = $rows;
        } elseif (!is_array($rows)) {
            $this->rows = [[$rows]];
        } else {
            $this->rows = $rows;
        }
    }

    public function execute(?array $params = null): bool {
        if ($this->rows instanceof Throwable) {
            throw $this->rows;
        }
        $this->idx = 0;
        return true;
    }

    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursor = PDO::FETCH_ORI_NEXT, int $offset = 0): mixed {
        if ($this->idx >= count($this->rows)) {
            return false;
        }
        return $this->rows[$this->idx++];
    }

    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array {
        return $this->rows;
    }

    public function fetchColumn(int $col = 0): mixed {
        if (empty($this->rows)) {
            return false;
        }
        $first = $this->rows[0];
        if (is_array($first)) {
            $vals = array_values($first);
            return $vals[$col] ?? false;
        }
        return $first;
    }

    public function rowCount(): int {
        return count($this->rows);
    }
}

class MockPDO extends PDO {
    private array $mockData = [];

    public function __construct(array $mockData = []) {
        $this->mockData = $mockData;
    }

    public function prepare(string $query, array $options = []): PDOStatement {
        $normQuery = preg_replace('/\s+/', ' ', trim($query));
        foreach ($this->mockData as $pattern => $rows) {
            $normPattern = preg_replace('/\s+/', ' ', trim((string)$pattern));
            if (stripos($normQuery, $normPattern) !== false) {
                return new MockPDOStatement($rows);
            }
        }
        return new MockPDOStatement([]);
    }

    public function query(string $query, ?int $mode = null, mixed ...$args): PDOStatement|false {
        return $this->prepare($query);
    }

    public function exec(string $statement): int|false {
        return 1;
    }

    public function lastInsertId(?string $name = null): string|false {
        return "101";
    }

    public function beginTransaction(): bool {
        return true;
    }

    public function commit(): bool {
        return true;
    }

    public function rollBack(): bool {
        return true;
    }

    public function inTransaction(): bool {
        return false;
    }
}

class MockPdoHelper {
    public static function createMockPdo(array $mockData = []): MockPDO {
        return new MockPDO($mockData);
    }
}

if (!function_exists('createMockPDO')) {
    function createMockPDO(array $mockData = []): MockPDO {
        return new MockPDO($mockData);
    }
}

