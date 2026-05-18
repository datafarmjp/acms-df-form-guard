<?php

namespace Acms\Plugins\DF_FormGuard;

use ACMS_POST_Form_Submit;
use Acms\Plugins\DF_FormGuard\Services\Classifier;
use Acms\Plugins\DF_FormGuard\Services\DebugLogger;
use Acms\Plugins\DF_FormGuard\Services\Decision;
use Acms\Plugins\DF_FormGuard\Services\FormPayload;
use Acms\Plugins\DF_FormGuard\Services\FormSettings;
use Acms\Plugins\DF_FormGuard\Services\ReferenceEntries;
use Acms\Plugins\DF_FormGuard\Services\Settings;
use Field;
use Field_Validation;

class Hook
{
    /**
     * @param ACMS_POST_Form_Submit $thisModule
     * @param bool &$abort
     * @param Field $mail
     * @param Field_Validation $field
     * @return void
     */
    public function beforeSendAutoReply(
        ACMS_POST_Form_Submit $thisModule,
        bool &$abort,
        Field $mail,
        Field_Validation $field
    ): void {
        $formCode = (string)$thisModule->Post->get('id');
        $info = $thisModule->loadForm($formCode);
        if (empty($info) || empty($info['data'])) {
            return;
        }

        $settings = Settings::load();
        $logger = new DebugLogger($settings->debugEnabled());
        if ($settings->honeypotEnabled() && $this->isHoneypotTriggered($thisModule, $field)) {
            $abort = true;
            $thisModule->Post->set('step', 'forbidden');
            $logger->info('form blocked before ai decision', [
                'form_id' => (int)$info['id'],
                'form_code' => $formCode,
                'reason' => 'honeypot',
            ]);
            return;
        }

        $formSettings = FormSettings::fromField($info['data']);
        if (!$formSettings->enabled()) {
            return;
        }

        $decision = null;
        $adminMailBlocked = false;

        try {
            $payload = FormPayload::fromField($field, $formSettings->maxInputChars());
            if ($payload === '') {
                $decision = Decision::ok('legitimate', 0.0, '判定対象の本文が空でした。');
            } else {
                $referenceText = '';
                try {
                    $referenceText = (new ReferenceEntries($logger))->buildContext(
                        $formSettings->referenceEids(),
                        $formSettings->referenceMaxChars()
                    );
                } catch (\Throwable $e) {
                    $logger->warning('reference entries unavailable', [
                        'message' => $e->getMessage(),
                    ]);
                }
                $decision = (new Classifier($settings, $logger))->classify(
                    $payload,
                    $formSettings->prompt(),
                    $referenceText
                );
            }
        } catch (\Throwable $e) {
            $decision = Decision::error('unknown', 0.0, $e->getMessage());
        }

        if ($decision->isNg() && $formSettings->blockAdminMailOnNg()) {
            $mail->set('AdminFormSend', 'no');
            $adminMailBlocked = true;
        } elseif ($decision->isError() && $formSettings->blockOnError()) {
            $mail->set('AdminFormSend', 'no');
            $adminMailBlocked = true;
        }

        $this->storeDecision($field, $decision, $adminMailBlocked, $formSettings->storeReason());
        $logger->info('form decision', [
            'form_id' => (int)$info['id'],
            'form_code' => $formCode,
            'result' => $decision->result(),
            'category' => $decision->category(),
            'confidence' => $decision->confidence(),
            'admin_mail_blocked' => $adminMailBlocked ? 'yes' : 'no',
        ]);
    }

    /**
     * @param Field_Validation $field
     * @param Decision $decision
     * @param bool $adminMailBlocked
     * @param bool $storeReason
     * @return void
     */
    private function storeDecision(Field_Validation $field, Decision $decision, bool $adminMailBlocked, bool $storeReason): void
    {
        $field->set('df_form_guard_result', $decision->result());
        $field->set('df_form_guard_category', $decision->category());
        $field->set('df_form_guard_confidence', number_format($decision->confidence(), 2, '.', ''));
        $field->set('df_form_guard_reason', $storeReason ? $decision->reason() : '');
        $field->set('df_form_guard_admin_mail_blocked', $adminMailBlocked ? 'yes' : 'no');
        $field->set('df_form_guard_checked_at', date('Y-m-d H:i:s', REQUEST_TIME));
    }

    private function isHoneypotTriggered($thisModule, ?Field_Validation $field = null): bool
    {
        $values = [];
        if ($field) {
            $values = $field->getArray('df_form_guard_honeypot');
            if (empty($values)) {
                $value = (string)$field->get('df_form_guard_honeypot');
                $values = $value === '' ? [] : [$value];
            }
        }
        if (empty($values)) {
            $postValues = method_exists($thisModule->Post, 'getArray')
                ? $thisModule->Post->getArray('df_form_guard_honeypot')
                : [];
            if (empty($postValues)) {
                $postValue = $thisModule->Post->get('df_form_guard_honeypot');
                $postValues = is_array($postValue) ? $postValue : [$postValue];
            }
            $values = $postValues;
        }
        if (empty($values) && isset($_POST['df_form_guard_honeypot'])) {
            $rawPostValue = $_POST['df_form_guard_honeypot'];
            $values = is_array($rawPostValue) ? $rawPostValue : [$rawPostValue];
        }
        if (empty($values) && isset($_POST['df_form_guard_honeypot[]'])) {
            $rawPostValue = $_POST['df_form_guard_honeypot[]'];
            $values = is_array($rawPostValue) ? $rawPostValue : [$rawPostValue];
        }

        foreach ($values as $value) {
            if (trim((string)$value) !== '') {
                return true;
            }
        }
        return false;
    }

}
