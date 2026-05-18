<?php

namespace Acms\Plugins\DF_FormGuard\Services;

use Acms\Services\Facades\Config;

class Settings
{
    /**
     * @var \Field|null
     */
    private static $config = null;

    /**
     * @var array<string, mixed>
     */
    private $values;

    /**
     * @param array<string, mixed> $values
     */
    private function __construct(array $values)
    {
        $this->values = $values;
    }

    public static function load(): self
    {
        return new self([
            'apiKey' => self::openAiApiKey(),
            'model' => self::openAiModel(),
            'timeout' => self::number('df_form_guard_ai_timeout_seconds', 1, 60, 10),
            'debug' => self::feature('df_form_guard_debug', false),
            'honeypot' => self::feature('df_form_guard_honeypot_enabled', true),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public static function all(): array
    {
        $settings = self::load();
        return [
            'openAiApiKeySource' => $settings->apiKeySource(),
            'openAiModel' => $settings->model(),
            'openAiModelSource' => $settings->modelSource(),
            'timeoutSeconds' => $settings->timeoutSeconds(),
            'debug' => $settings->debugEnabled(),
            'honeypot' => $settings->honeypotEnabled(),
        ];
    }

    public function apiKey(): string
    {
        $apiKey = $this->values['apiKey'];
        return (string)$apiKey['value'];
    }

    public function apiKeySource(): string
    {
        $apiKey = $this->values['apiKey'];
        return (string)$apiKey['source'];
    }

    public function model(): string
    {
        $model = $this->values['model'];
        return (string)$model['value'];
    }

    public function modelSource(): string
    {
        $model = $this->values['model'];
        return (string)$model['source'];
    }

    public function timeoutSeconds(): int
    {
        return (int)$this->values['timeout'];
    }

    public function debugEnabled(): bool
    {
        return (bool)$this->values['debug'];
    }

    public function honeypotEnabled(): bool
    {
        return (bool)$this->values['honeypot'];
    }

    /**
     * @return array{value: string, source: string}
     */
    public static function openAiApiKey(): array
    {
        $configured = self::value('df_form_guard_openai_api_key');
        if ($configured !== '') {
            return [
                'value' => $configured,
                'source' => 'config',
            ];
        }
        if (defined('DF_FORM_GUARD_OPENAI_API_KEY')) {
            return [
                'value' => (string)DF_FORM_GUARD_OPENAI_API_KEY,
                'source' => 'constant',
            ];
        }
        $key = getenv('OPENAI_API_KEY');
        if (is_string($key) && $key !== '') {
            return [
                'value' => $key,
                'source' => 'env',
            ];
        }
        return [
            'value' => '',
            'source' => 'missing',
        ];
    }

    /**
     * @return array{value: string, source: string}
     */
    public static function openAiModel(): array
    {
        $configured = self::value('df_form_guard_openai_model');
        if ($configured !== '') {
            return [
                'value' => $configured,
                'source' => 'config',
            ];
        }
        if (defined('DF_FORM_GUARD_OPENAI_MODEL')) {
            $model = trim((string)DF_FORM_GUARD_OPENAI_MODEL);
            if ($model !== '') {
                return [
                    'value' => $model,
                    'source' => 'constant',
                ];
            }
        }
        $model = getenv('OPENAI_MODEL');
        $model = is_string($model) ? trim($model) : '';
        if ($model !== '') {
            return [
                'value' => $model,
                'source' => 'env',
            ];
        }
        return [
            'value' => 'gpt-4o-mini',
            'source' => 'default',
        ];
    }

    private static function value(string $key): string
    {
        $config = self::config();
        if (!$config) {
            return '';
        }
        return trim((string)$config->get($key));
    }

    private static function config(): ?\Field
    {
        if (self::$config) {
            return self::$config;
        }
        if (!defined('BID') || !BID) {
            return null;
        }

        $currentBid = (int)BID;
        $config = Config::loadDefaultField();
        foreach (self::ancestorBlogIds($currentBid) as $bid) {
            $config->overload(Config::loadBlogConfig($bid));
        }
        $config->overload(Config::loadBlogConfigSet($currentBid));
        $config->overload(Config::loadBlogConfig($currentBid));

        self::$config = $config;
        return self::$config;
    }

    /**
     * @return int[]
     */
    private static function ancestorBlogIds(int $bid): array
    {
        $SQL = \SQL::newSelect('blog');
        $SQL->addSelect('blog_id');
        \ACMS_Filter::blogTree($SQL, $bid, 'ancestor-or-self');
        $SQL->setOrder('blog_left', 'ASC');

        $rows = \DB::query($SQL->get(dsn()), 'all');
        $ids = [];
        foreach ($rows as $row) {
            $id = (int)($row['blog_id'] ?? 0);
            if ($id > 0) {
                $ids[] = $id;
            }
        }
        return $ids ?: [$bid];
    }

    private static function number(string $key, int $min, int $max, int $fallback): int
    {
        $value = (int)self::value($key);
        if ($value < $min || $value > $max) {
            return $fallback;
        }
        return $value;
    }

    private static function feature(string $key, bool $fallback): bool
    {
        $value = strtolower(self::value($key));
        if ($value === '') {
            return $fallback;
        }
        return !in_array($value, ['disabled', 'off', '0', 'false'], true);
    }
}
