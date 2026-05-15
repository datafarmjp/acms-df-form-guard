<?php

namespace Acms\Plugins\DF_FormGuard\POST;

use ACMS_POST;
use Acms\Services\Facades\Common;
use Field;

class FormGuardLogDecisions extends ACMS_POST
{
    /**
     * @var bool
     */
    public $isCacheDelete = false;

    public function post()
    {
        try {
            if (!$this->canUseFormLog()) {
                Common::responseJson([
                    'status' => 'failure',
                    'message' => 'フォーム履歴を確認する権限がありません。',
                ]);
            }

            $fmid = (int)$this->Post->get('fmid');
            $serials = $this->serials($this->Post->getArray('serials'));
            if ($fmid <= 0 || empty($serials)) {
                Common::responseJson([
                    'status' => 'failure',
                    'message' => 'フォーム履歴が指定されていません。',
                ]);
            }

            Common::responseJson([
                'status' => 'success',
                'decisions' => $this->loadDecisions($fmid, $serials),
            ]);
        } catch (\Throwable $e) {
            Common::responseJson([
                'status' => 'failure',
                'message' => $e->getMessage(),
            ]);
        }
    }

    private function canUseFormLog(): bool
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
     * @param mixed[] $values
     * @return int[]
     */
    private function serials(array $values): array
    {
        $serials = [];
        foreach ($values as $value) {
            $serial = (int)$value;
            if ($serial > 0) {
                $serials[$serial] = $serial;
            }
        }
        return array_values($serials);
    }

    /**
     * @param int[] $serials
     * @return array<string, array<string, string>>
     */
    private function loadDecisions(int $fmid, array $serials): array
    {
        $sql = \SQL::newSelect('log_form');
        $sql->addSelect('log_form_serial');
        $sql->addSelect('log_form_data');
        $sql->addSelect('log_form_version');
        $sql->addWhereOpr('log_form_form_id', $fmid);
        $sql->addWhereIn('log_form_serial', $serials);
        $sql->addLeftJoin('blog', 'blog_id', 'log_form_blog_id');
        \ACMS_Filter::blogTree($sql, BID, 'ancestor-or-self');

        $db = \DB::singleton(dsn());
        $result = [];
        $statement = $db->query($sql->get(dsn()), 'exec');
        while ($row = $db->next($statement)) {
            $serial = (string)(int)($row['log_form_serial'] ?? 0);
            if ($serial === '0') {
                continue;
            }
            $field = $this->fieldFromLog($row);
            if (!$field) {
                $result[$serial] = $this->emptyDecision();
                continue;
            }
            $result[$serial] = $this->decisionFromField($field);
        }
        return $result;
    }

    /**
     * @param array<string, mixed> $row
     */
    private function fieldFromLog(array $row): ?Field
    {
        if (!isset($row['log_form_version']) || (int)$row['log_form_version'] !== 1) {
            return null;
        }
        $field = acmsDangerUnserialize($row['log_form_data'] ?? '');
        return $field instanceof Field ? $field : null;
    }

    /**
     * @return array<string, string>
     */
    private function decisionFromField(Field $field): array
    {
        $result = strtoupper(trim((string)$field->get('df_form_guard_result')));
        if (!in_array($result, ['OK', 'NG', 'ERROR'], true)) {
            return $this->emptyDecision();
        }
        return [
            'result' => $result,
            'category' => trim((string)$field->get('df_form_guard_category')),
            'confidence' => trim((string)$field->get('df_form_guard_confidence')),
            'reason' => trim((string)$field->get('df_form_guard_reason')),
            'admin_mail_blocked' => trim((string)$field->get('df_form_guard_admin_mail_blocked')),
            'checked_at' => trim((string)$field->get('df_form_guard_checked_at')),
        ];
    }

    /**
     * @return array<string, string>
     */
    private function emptyDecision(): array
    {
        return [
            'result' => '',
            'category' => '',
            'confidence' => '',
            'reason' => '',
            'admin_mail_blocked' => '',
            'checked_at' => '',
        ];
    }
}
