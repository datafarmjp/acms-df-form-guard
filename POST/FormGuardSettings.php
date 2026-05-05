<?php

namespace Acms\Plugins\DF_FormGuard\POST;

use ACMS_POST;
use Acms\Plugins\DF_FormGuard\Services\Settings;
use Acms\Services\Facades\Common;

class FormGuardSettings extends ACMS_POST
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
                    'message' => '設定を確認する権限がありません。',
                ]);
            }

            Common::responseJson([
                'status' => 'success',
                'settings' => Settings::all(),
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
}
