<?php

namespace Acms\Plugins\DF_FormGuard\POST;

use ACMS_POST;
use Acms\Services\Facades\Common;

class FormGuardFormSettings extends ACMS_POST
{
    /**
     * @var bool
     */
    public $isCacheDelete = false;

    public function post()
    {
        try {
            if (!$this->canUseAdminPost()) {
                Common::responseJson([
                    'status' => 'failure',
                    'message' => 'フォーム設定を確認する権限がありません。',
                ]);
            }

            $fmid = (int)$this->Post->get('fmid');
            if ($fmid <= 0) {
                Common::responseJson([
                    'status' => 'failure',
                    'message' => 'フォームIDが指定されていません。',
                ]);
            }

            $field = $this->loadFormData($fmid);
            if (!$field) {
                Common::responseJson([
                    'status' => 'failure',
                    'message' => 'フォーム設定を取得できませんでした。',
                ]);
            }

            Common::responseJson([
                'status' => 'success',
                'settings' => $this->buildSettings($field),
            ]);
        } catch (\Throwable $e) {
            Common::responseJson([
                'status' => 'failure',
                'message' => $e->getMessage(),
            ]);
        }
    }

    /**
     * @return \Field|null
     */
    private function loadFormData(int $fmid)
    {
        $sql = \SQL::newSelect('form');
        $sql->addSelect('form_data');
        $sql->addWhereOpr('form_id', $fmid);

        $row = \DB::query($sql->get(dsn()), 'row');
        if (!$row || !isset($row['form_data'])) {
            return null;
        }

        $field = acmsDangerUnserialize($row['form_data']);
        return $field instanceof \Field ? $field : null;
    }

    /**
     * @return array<string, string>
     */
    private function buildSettings(\Field $field): array
    {
        return [
            'df_form_guard_enabled' => $this->feature($field->get('df_form_guard_enabled'), 'disabled'),
            'df_form_guard_prompt' => (string)$field->get('df_form_guard_prompt'),
            'df_form_guard_block_admin_mail_on_ng' => $this->feature($field->get('df_form_guard_block_admin_mail_on_ng'), 'enabled'),
            'df_form_guard_error_action' => $this->choice((string)$field->get('df_form_guard_error_action'), ['send', 'block'], 'send'),
            'df_form_guard_max_input_chars' => (string)$this->number((string)$field->get('df_form_guard_max_input_chars'), 500, 20000, 4000),
            'df_form_guard_reference_eids' => implode(',', $this->eids($field->getArray('df_form_guard_reference_eids'))),
            'df_form_guard_reference_max_chars' => (string)$this->number((string)$field->get('df_form_guard_reference_max_chars'), 500, 20000, 3000),
            'df_form_guard_store_reason' => $this->feature($field->get('df_form_guard_store_reason'), 'enabled'),
        ];
    }

    private function canUseAdminPost(): bool
    {
        if (function_exists('sessionWithFormAdministration') && sessionWithFormAdministration()) {
            return true;
        }
        if (function_exists('sessionWithAdministration') && sessionWithAdministration(BID)) {
            return true;
        }
        if (function_exists('roleAvailableUser') && roleAvailableUser()) {
            return function_exists('roleAuthorization')
                && (roleAuthorization('form_view', BID) || roleAuthorization('form_edit', BID));
        }
        return false;
    }

    /**
     * @param mixed $value
     */
    private function feature($value, string $fallback): string
    {
        $value = strtolower(trim((string)$value));
        if ($value === '') {
            return $fallback;
        }
        return in_array($value, ['disabled', 'off', '0', 'false'], true) ? 'disabled' : 'enabled';
    }

    /**
     * @param string[] $allowed
     */
    private function choice(string $value, array $allowed, string $fallback): string
    {
        return in_array($value, $allowed, true) ? $value : $fallback;
    }

    private function number(string $value, int $min, int $max, int $fallback): int
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
    private function eids(array $values): array
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
