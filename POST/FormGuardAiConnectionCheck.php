<?php

namespace Acms\Plugins\DF_FormGuard\POST;

use ACMS_POST;
use Acms\Plugins\DF_FormGuard\Services\Classifier;
use Acms\Plugins\DF_FormGuard\Services\DebugLogger;
use Acms\Plugins\DF_FormGuard\Services\Settings;
use Acms\Services\Facades\Common;
use Acms\Services\Facades\Config;
use Field;

class FormGuardAiConnectionCheck extends ACMS_POST
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
                    'message' => 'AI接続を確認する権限がありません。',
                ]);
            }

            $settings = Settings::load();
            if ($settings->apiKey() === '') {
                Common::responseJson([
                    'status' => 'failure',
                    'message' => 'OpenAI APIキーが設定されていません。',
                    'apiKeySource' => $settings->apiKeySource(),
                    'model' => $settings->model(),
                ]);
            }

            $text = trim((string)$this->Post->get('test_text'));
            if ($text === '') {
                $text = 'お世話になります。貴社サイトのSEO改善サービスをご提案したくご連絡しました。';
            }

            $decision = (new Classifier($settings, new DebugLogger($settings->debugEnabled())))->classify($text, '');
            if ($decision->isError()) {
                Common::responseJson([
                    'status' => 'failure',
                    'message' => $decision->reason() ?: 'AI接続を確認できませんでした。',
                    'apiKeySource' => $settings->apiKeySource(),
                    'model' => $settings->model(),
                    'decision' => [
                        'result' => $decision->result(),
                        'category' => $decision->category(),
                        'confidence' => $decision->confidence(),
                        'reason' => $decision->reason(),
                    ],
                ]);
            }

            $lastCheckedAt = $this->saveLastCheckedAt();

            Common::responseJson([
                'status' => 'success',
                'message' => 'AI接続に成功しました。',
                'apiKeySource' => $settings->apiKeySource(),
                'model' => $settings->model(),
                'last_checked_at' => $lastCheckedAt,
                'decision' => [
                    'result' => $decision->result(),
                    'category' => $decision->category(),
                    'confidence' => $decision->confidence(),
                    'reason' => $decision->reason(),
                ],
            ]);
        } catch (\Throwable $e) {
            Common::responseJson([
                'status' => 'failure',
                'message' => $e->getMessage(),
            ]);
        }
    }

    private function canUseAdminPost(): bool
    {
        if (function_exists('sessionWithAdministration') && sessionWithAdministration(BID)) {
            return true;
        }
        if (function_exists('roleAvailableUser') && roleAvailableUser()) {
            return function_exists('roleAuthorization') && roleAuthorization('config_edit', BID);
        }
        return false;
    }

    private function saveLastCheckedAt(): string
    {
        $timestamp = date('Y-m-d H:i');
        $field = new Field();
        $field->set('df_form_guard_ai_last_checked_at', $timestamp);
        Config::saveConfig($field, BID);
        return $timestamp;
    }
}
