<?php

namespace Acms\Plugins\DF_FormGuard\Services;

use Field;

class FormPayload
{
    /**
     * @param Field $field
     */
    public static function fromField($field, int $maxChars): string
    {
        $lines = [];
        foreach ($field->listFields() as $name) {
            if (self::shouldSkip($name)) {
                continue;
            }
            $values = $field->getArray($name);
            if (empty($values)) {
                $value = (string)$field->get($name);
                $values = $value === '' ? [] : [$value];
            }
            $cleanValues = [];
            foreach ($values as $value) {
                $value = self::cleanValue((string)$value);
                if ($value !== '') {
                    $cleanValues[] = $value;
                }
            }
            if (empty($cleanValues)) {
                continue;
            }
            $lines[] = $name . ': ' . implode(' / ', $cleanValues);
        }

        $text = implode("\n", $lines);
        if (mb_strlen($text) > $maxChars) {
            $text = mb_substr($text, 0, $maxChars) . "\n...(truncated)";
        }
        return $text;
    }

    private static function shouldSkip(string $name): bool
    {
        if ($name === '') {
            return true;
        }
        if (strpos($name, 'df_form_guard_') === 0) {
            return true;
        }
        if (preg_match('/(^|:)(validator|converter|v|field|takeover)$/', $name)) {
            return true;
        }
        if (preg_match('/@(path|baseName|originalName|downloadName)$/', $name)) {
            return true;
        }
        return in_array($name, ['step', 'id', 'formToken', 'submit'], true);
    }

    private static function cleanValue(string $value): string
    {
        $value = trim(strip_tags($value));
        $value = preg_replace('/\s+/u', ' ', $value);
        return trim((string)$value);
    }
}
