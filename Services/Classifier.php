<?php

namespace Acms\Plugins\DF_FormGuard\Services;

class Classifier
{
    private const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

    /**
     * @var Settings
     */
    private $settings;

    /**
     * @var DebugLogger
     */
    private $logger;

    public function __construct(Settings $settings, DebugLogger $logger)
    {
        $this->settings = $settings;
        $this->logger = $logger;
    }

    public function classify(string $payload, string $formPrompt = '', string $referenceText = ''): Decision
    {
        if ($this->settings->apiKey() === '') {
            return Decision::error('unknown', 0.0, 'OpenAI APIキーが設定されていません。');
        }
        if (!function_exists('curl_init')) {
            return Decision::error('unknown', 0.0, 'cURLが利用できません。');
        }

        $request = [
            'model' => $this->settings->model(),
            'temperature' => 0,
            'response_format' => [
                'type' => 'json_object',
            ],
            'messages' => [
                [
                    'role' => 'system',
                    'content' => $this->systemPrompt(),
                ],
                [
                    'role' => 'user',
                    'content' => $this->userPrompt($payload, $formPrompt, $referenceText),
                ],
            ],
        ];

        $ch = curl_init(self::ENDPOINT);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->settings->timeoutSeconds(),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->settings->apiKey(),
            ],
            CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($body === false || $body === '') {
            $this->logger->warning('OpenAI request failed', ['status' => $status, 'error' => $error]);
            return Decision::error('unknown', 0.0, 'AI判定リクエストに失敗しました。');
        }
        if ($status < 200 || $status >= 300) {
            $this->logger->warning('OpenAI returned error', ['status' => $status]);
            return Decision::error('unknown', 0.0, 'AI判定APIがエラーを返しました。');
        }

        $json = json_decode($body, true);
        if (!is_array($json)) {
            return Decision::error('unknown', 0.0, 'AI判定レスポンスをJSONとして読めませんでした。');
        }
        $content = $json['choices'][0]['message']['content'] ?? '';
        if (!is_string($content) || trim($content) === '') {
            return Decision::error('unknown', 0.0, 'AI判定レスポンスが空でした。');
        }

        $decision = json_decode($content, true);
        if (!is_array($decision)) {
            return Decision::error('unknown', 0.0, 'AI判定結果をJSONとして読めませんでした。');
        }

        return Decision::fromArray($decision);
    }

    private function systemPrompt(): string
    {
        return implode("\n", [
            'あなたは問い合わせフォームの内容を分類する審査AIです。',
            '目的は、営業メール、迷惑メール、不要メールらしい送信だけをNGにすることです。',
            '正規問い合わせ、見積依頼、相談、苦情、採用応募、既存顧客からの連絡、判断に迷うものはOKにしてください。',
            '判断材料エントリーが与えられた場合、その内容に関係する質問、相談、見積依頼、資料請求はOK寄りにしてください。',
            'ただし判断材料に関係しているように見えても、売り込み、営業提案、代行提案、広告・SEO・制作営業はNG候補のままです。',
            '判断材料と関係が薄いという理由だけでNGにしないでください。',
            'SEO営業、広告営業、制作営業、営業代行、ツール売り込み、協業を装った売り込み、明らかな迷惑文はNGにしてください。',
            '必ずJSONだけを返してください。',
            '形式: {"result":"OK|NG|ERROR","category":"legitimate|sales|spam|irrelevant|unknown","confidence":0.0,"reason":"短い日本語理由"}',
        ]);
    }

    private function userPrompt(string $payload, string $formPrompt, string $referenceText): string
    {
        $parts = [];
        if (trim($formPrompt) !== '') {
            $parts[] = "フォーム固有の追加判定ルール:\n" . trim($formPrompt);
        }
        if (trim($referenceText) !== '') {
            $parts[] = "判断材料エントリー:\n" . trim($referenceText);
        }
        $parts[] = "フォーム送信内容:\n" . $payload;
        return implode("\n\n", $parts);
    }
}
