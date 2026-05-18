<?php
/**
 * DF_FormGuard managed GET wrapper
 */

namespace {
    if (!class_exists('\Acms\Plugins\DF_FormGuard\Services\Settings')) {
        $dfFormGuardSettingsPaths = [];
        if (defined('PLUGIN_LIB_DIR')) {
            $dfFormGuardSettingsPaths[] = rtrim(PLUGIN_LIB_DIR, '/\\') . '/DF_FormGuard/Services/Settings.php';
        }
        $dfFormGuardSettingsPaths[] = dirname(__DIR__, 3) . '/extension/plugins/DF_FormGuard/Services/Settings.php';

        foreach (array_unique($dfFormGuardSettingsPaths) as $dfFormGuardSettingsPath) {
            if (is_file($dfFormGuardSettingsPath)) {
                require_once $dfFormGuardSettingsPath;
                break;
            }
        }
    }
}

namespace Acms\Custom\GET {
    use ACMS_GET;
    use Acms\Plugins\DF_FormGuard\Services\Settings;

    class DFFormGuardHoneypot extends ACMS_GET
    {
        public function get()
        {
            $settings = class_exists(Settings::class) ? Settings::load() : null;
            $enabled = $settings ? $settings->honeypotEnabled() : true;
            $debug = $settings ? $settings->debugEnabled() : false;

            if (!$enabled) {
                return $debug ? '<!-- DF_FormGuard Honeypot: disabled -->' : '';
            }

            $html = implode('', [
                '<div class="df-form-guard-honeypot" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;">',
                '<label>',
                '<input type="checkbox" name="df_form_guard_honeypot[]" value="1" tabindex="-1" autocomplete="off">',
                'この項目は入力しないでください',
                '</label>',
                '<input type="hidden" name="field[]" value="df_form_guard_honeypot">',
                '<input type="hidden" name="df_form_guard_honeypot:v#max" value="0">',
                '</div>',
            ]);
            return $debug ? '<!-- DF_FormGuard Honeypot: enabled -->' . $html : $html;
        }
    }
}
