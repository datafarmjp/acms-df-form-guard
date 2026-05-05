<?php

namespace Acms\Plugins\DF_FormGuard\Services;

use Field;

class FormSettings
{
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

    public static function fromField(Field $field): self
    {
        return new self([
            'enabled' => self::feature($field->get('df_form_guard_enabled'), false),
            'prompt' => trim((string)$field->get('df_form_guard_prompt')),
            'blockAdminMailOnNg' => self::feature($field->get('df_form_guard_block_admin_mail_on_ng'), true),
            'errorAction' => self::choice((string)$field->get('df_form_guard_error_action'), ['send', 'block'], 'send'),
            'maxInputChars' => self::number((string)$field->get('df_form_guard_max_input_chars'), 500, 20000, 4000),
            'referenceEids' => self::eids($field->getArray('df_form_guard_reference_eids')),
            'referenceMaxChars' => self::number((string)$field->get('df_form_guard_reference_max_chars'), 500, 20000, 3000),
            'storeReason' => self::feature($field->get('df_form_guard_store_reason'), true),
        ]);
    }

    public function enabled(): bool
    {
        return (bool)$this->values['enabled'];
    }

    public function prompt(): string
    {
        return (string)$this->values['prompt'];
    }

    public function blockAdminMailOnNg(): bool
    {
        return (bool)$this->values['blockAdminMailOnNg'];
    }

    public function blockOnError(): bool
    {
        return $this->values['errorAction'] === 'block';
    }

    public function maxInputChars(): int
    {
        return (int)$this->values['maxInputChars'];
    }

    /**
     * @return int[]
     */
    public function referenceEids(): array
    {
        return $this->values['referenceEids'];
    }

    public function referenceMaxChars(): int
    {
        return (int)$this->values['referenceMaxChars'];
    }

    public function storeReason(): bool
    {
        return (bool)$this->values['storeReason'];
    }

    /**
     * @param mixed $value
     */
    private static function feature($value, bool $fallback): bool
    {
        $value = strtolower(trim((string)$value));
        if ($value === '') {
            return $fallback;
        }
        return !in_array($value, ['disabled', 'off', '0', 'false'], true);
    }

    /**
     * @param string[] $allowed
     */
    private static function choice(string $value, array $allowed, string $fallback): string
    {
        $value = trim($value);
        return in_array($value, $allowed, true) ? $value : $fallback;
    }

    private static function number(string $value, int $min, int $max, int $fallback): int
    {
        $number = (int)$value;
        if ($number < $min || $number > $max) {
            return $fallback;
        }
        return $number;
    }

    /**
     * @param mixed[] $values
     * @return int[]
     */
    private static function eids(array $values): array
    {
        $ids = [];
        foreach ($values as $value) {
            foreach (preg_split('/[,\s]+/', (string)$value) as $id) {
                $id = (int)$id;
                if ($id > 0) {
                    $ids[$id] = $id;
                }
            }
        }
        return array_values($ids);
    }
}
