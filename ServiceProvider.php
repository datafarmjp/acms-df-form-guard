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
    private $postWrapperMarker = 'DF_FormGuard managed POST wrapper';

    /**
     * @var string
     */
    public $version = '0.1.8';

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
        $this->injectAdminTemplate();
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
        $this->injectAdminTemplate();
        $this->syncPostWrappers();
        return true;
    }

    /**
     * @return bool
     */
    public function activate()
    {
        $this->injectAdminTemplate();
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
    private function injectAdminTemplate()
    {
        InjectTemplate::singleton()->add(
            'admin-main',
            PLUGIN_DIR . 'DF_FormGuard/template/admin/form-log.html'
        );

        $themesDir = defined('THEMES_DIR') ? THEMES_DIR : 'themes/';
        $legacyTemplate = SCRIPT_DIR . ltrim($themesDir, '/') . 'system/admin/app/df-form-guard.html';
        if (is_file($legacyTemplate) && !$this->archiveLegacyAdminTemplate($legacyTemplate)) {
            return;
        }

        InjectTemplate::singleton()->add(
            'admin-main',
            PLUGIN_DIR . 'DF_FormGuard/template/admin/app/df-form-guard.html'
        );
        InjectTemplate::singleton()->add(
            'admin-topicpath',
            PLUGIN_DIR . 'DF_FormGuard/template/admin/topicpath/df-form-guard.html'
        );
    }

    /**
     * @param string $path
     * @return bool
     */
    private function archiveLegacyAdminTemplate($path)
    {
        $content = (string)@file_get_contents($path);
        if ($content === '' || strpos($content, 'DF_FormGuard managed admin app template') === false) {
            return false;
        }

        $base = $path . '.df-form-guard-backup-' . date('YmdHis');
        $backup = $base;
        $index = 1;
        while (is_file($backup)) {
            $backup = $base . '-' . $index;
            $index++;
        }

        return @rename($path, $backup);
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
            'FormGuardLogDecisions.php',
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
