<?php

namespace Acms\Plugins\DF_FormGuard;

use ACMS_App;
use Acms\Services\Common\HookFactory;
use Acms\Services\Common\InjectTemplate;

class ServiceProvider extends ACMS_App
{
    /**
     * @var string
     */
    private $adminTemplateMarker = 'DF_FormGuard managed admin app template';

    /**
     * @var string
     */
    private $postWrapperMarker = 'DF_FormGuard managed POST wrapper';

    /**
     * @var string
     */
    public $version = '0.1.1';

    /**
     * @var string
     */
    public $name = 'DFフォームガード';

    /**
     * @var string
     */
    public $author = '株式会社データファーム';

    /**
     * @var bool
     */
    public $module = false;

    /**
     * @var false|string
     */
    public $menu = 'df-form-guard';

    /**
     * @var string
     */
    public $desc = 'フォーム送信内容をAIで判定し、営業・迷惑メールらしい送信の管理者宛メールだけを抑制します。';

    /**
     * @return void
     */
    public function init()
    {
        $this->syncAdminTemplate();
        $this->syncPostWrappers();

        HookFactory::singleton()->attach('DF_FormGuard', new Hook());

        InjectTemplate::singleton()->add(
            'admin-form',
            PLUGIN_DIR . 'DF_FormGuard/template/form-guard-field.html'
        );
    }

    /**
     * @return bool
     */
    public function checkRequirements()
    {
        return true;
    }

    /**
     * @return void
     */
    public function install()
    {
        $this->syncAdminTemplate();
        $this->syncPostWrappers();
    }

    /**
     * @return void
     */
    public function uninstall()
    {
    }

    /**
     * @return bool
     */
    public function update()
    {
        $this->syncAdminTemplate();
        $this->syncPostWrappers();
        return true;
    }

    /**
     * @return bool
     */
    public function activate()
    {
        $this->syncAdminTemplate();
        $this->syncPostWrappers();
        return true;
    }

    /**
     * @return bool
     */
    public function deactivate()
    {
        return true;
    }

    /**
     * @return void
     */
    private function syncAdminTemplate()
    {
        $source = PLUGIN_LIB_DIR . 'DF_FormGuard/template/admin/app/df-form-guard.html';
        $themesDir = defined('THEMES_DIR') ? THEMES_DIR : 'themes/';
        $dest = SCRIPT_DIR . ltrim($themesDir, '/') . 'system/admin/app/df-form-guard.html';

        if (!is_file($source)) {
            return;
        }

        $dir = dirname($dest);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        if (!is_dir($dir)) {
            return;
        }

        if (is_file($dest)) {
            if (!is_writable($dest)) {
                return;
            }
            $content = (string)@file_get_contents($dest);
            if (strpos($content, $this->adminTemplateMarker) === false) {
                return;
            }
        } elseif (!is_writable($dir)) {
            return;
        }

        @copy($source, $dest);
    }

    /**
     * @return void
     */
    private function syncPostWrappers()
    {
        $files = [
            'FormGuardSettings.php',
            'FormGuardFormSettings.php',
            'FormGuardAiConnectionCheck.php',
        ];
        $sourceDir = PLUGIN_LIB_DIR . 'DF_FormGuard/template/post/';
        $destDir = SCRIPT_DIR . 'extension/acms/POST/';

        if (!is_dir($destDir)) {
            @mkdir($destDir, 0775, true);
        }
        if (!is_dir($destDir) || !is_writable($destDir)) {
            return;
        }

        foreach ($files as $file) {
            $source = $sourceDir . $file;
            $dest = $destDir . $file;
            if (!is_file($source)) {
                continue;
            }
            if (is_file($dest)) {
                if (!is_writable($dest)) {
                    continue;
                }
                $content = (string)@file_get_contents($dest);
                if (!$this->isManagedPostWrapper($content)) {
                    continue;
                }
            }
            @copy($source, $dest);
        }
    }

    /**
     * @param string $content
     * @return bool
     */
    private function isManagedPostWrapper($content)
    {
        if (strpos($content, $this->postWrapperMarker) !== false) {
            return true;
        }
        return strpos($content, 'Acms\\Plugins\\DF_FormGuard') !== false;
    }
}
