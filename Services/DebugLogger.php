<?php

namespace Acms\Plugins\DF_FormGuard\Services;

class DebugLogger
{
    /**
     * @var bool
     */
    private $enabled;

    public function __construct(bool $enabled)
    {
        $this->enabled = $enabled;
    }

    /**
     * @param array<string, mixed> $context
     */
    public function info(string $message, array $context = []): void
    {
        if (!$this->enabled) {
            return;
        }
        \AcmsLogger::info('[DF_FormGuard] ' . $message, $this->sanitize($context));
    }

    /**
     * @param array<string, mixed> $context
     */
    public function warning(string $message, array $context = []): void
    {
        if (!$this->enabled) {
            return;
        }
        \AcmsLogger::warning('[DF_FormGuard] ' . $message, $this->sanitize($context));
    }

    /**
     * @param array<string, mixed> $context
     * @return array<string, mixed>
     */
    private function sanitize(array $context): array
    {
        foreach ($context as $key => $value) {
            if (preg_match('/(key|token|secret|body|payload|content)/i', (string)$key)) {
                $context[$key] = '[hidden]';
            } elseif (is_string($value) && mb_strlen($value) > 160) {
                $context[$key] = mb_substr($value, 0, 160) . '...';
            }
        }
        return $context;
    }
}
