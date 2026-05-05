<?php

namespace Acms\Plugins\DF_FormGuard\Services;

class Decision
{
    /**
     * @var string
     */
    private $result;

    /**
     * @var string
     */
    private $category;

    /**
     * @var float
     */
    private $confidence;

    /**
     * @var string
     */
    private $reason;

    private function __construct(string $result, string $category, float $confidence, string $reason)
    {
        $this->result = self::normalizeResult($result);
        $this->category = self::normalizeCategory($category);
        $this->confidence = max(0.0, min(1.0, $confidence));
        $this->reason = mb_substr(trim($reason), 0, 300);
    }

    public static function ok(string $category = 'legitimate', float $confidence = 0.0, string $reason = ''): self
    {
        return new self('OK', $category, $confidence, $reason);
    }

    public static function ng(string $category = 'sales', float $confidence = 0.0, string $reason = ''): self
    {
        return new self('NG', $category, $confidence, $reason);
    }

    public static function error(string $category = 'unknown', float $confidence = 0.0, string $reason = ''): self
    {
        return new self('ERROR', $category, $confidence, $reason);
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            (string)($data['result'] ?? 'ERROR'),
            (string)($data['category'] ?? 'unknown'),
            (float)($data['confidence'] ?? 0.0),
            (string)($data['reason'] ?? '')
        );
    }

    public function result(): string
    {
        return $this->result;
    }

    public function category(): string
    {
        return $this->category;
    }

    public function confidence(): float
    {
        return $this->confidence;
    }

    public function reason(): string
    {
        return $this->reason;
    }

    public function isNg(): bool
    {
        return $this->result === 'NG';
    }

    public function isError(): bool
    {
        return $this->result === 'ERROR';
    }

    private static function normalizeResult(string $result): string
    {
        $result = strtoupper(trim($result));
        return in_array($result, ['OK', 'NG', 'ERROR'], true) ? $result : 'ERROR';
    }

    private static function normalizeCategory(string $category): string
    {
        $category = strtolower(trim($category));
        $allowed = ['legitimate', 'sales', 'spam', 'irrelevant', 'unknown'];
        return in_array($category, $allowed, true) ? $category : 'unknown';
    }
}
