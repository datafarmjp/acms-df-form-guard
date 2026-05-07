# DFフォームガード

DFフォームガードは、a-blog cms の問い合わせフォーム送信を AI で判定し、営業メール・迷惑メール・不要メールっぽい送信だけを管理者宛メールから外すための拡張アプリです。

フォーム履歴は通常どおり残しつつ、管理者が毎回営業メールを見るストレスを減らすことを目的にしています。

現在はデータファーム内で実運用しながら調整している段階ですが、無料で一般公開する前提で整備を進めています。

## できること

- フォーム単位で DFフォームガード の利用有無を設定
- フォーム送信内容を OpenAI で `OK / NG / ERROR` 判定
- `NG` のときだけ管理者宛メール送信を抑制
- フォーム履歴に判定結果を保存
- フォームごとの追加判定ルールを設定
- 判断材料にしたい公開エントリーを複数指定

## この PoC の方針

- 正規問い合わせを落とさないことを優先する
- `ERROR` 時は初期設定で送信する
- 対象フォームはフォームID編集画面で個別に有効化する
- a-blog cms コアは改修せず、既存 Hook と互換 POST で実装する

## 動作概要

- 判定タイミングは `beforeSendAutoReply`
- `NG` 判定時は `AdminFormSend = no` を設定して管理者宛メールだけ止める
- 自動返信とフォーム履歴保存の通常フローは継続する
- `ERROR` 判定時は、初期設定では管理者宛メールを送信する

## 設定場所

### 1. 拡張アプリ管理画面

共通設定として以下を持ちます。

- OpenAI APIキー
- OpenAIモデル
- AIタイムアウト
- debugモード
- AI接続チェック

### 2. フォームID編集画面

フォームごとに以下を設定します。

- DFフォームガードを利用する
- 追加判定ルール
- NG時の管理者宛メール抑制
- ERROR時の動作
- 判定対象の最大文字数
- 判断材料エントリー
- 判断材料の最大文字数
- 判定理由の保存

## フォーム履歴に保存する項目

- `df_form_guard_result`
- `df_form_guard_category`
- `df_form_guard_confidence`
- `df_form_guard_reason`
- `df_form_guard_admin_mail_blocked`
- `df_form_guard_checked_at`

## 判断材料エントリーについて

会社情報、サービス紹介、FAQ などの公開エントリーを判断材料として指定できます。

これらは「この内容に関係する問い合わせなら OK 寄りに判断しやすくする」ための文脈です。  
関連が薄いことだけを理由に `NG` にはしません。

## デバッグ

拡張アプリ設定で debug を有効にすると、判定概要をログに出力します。

ブラウザ側の補助デバッグは以下でも有効化できます。

```js
localStorage.setItem('DFFormGuardDebug', '1')
```

APIキーやフォーム本文全文は、デバッグ出力に含めない前提です。

## このリポジトリについて

このリポジトリは、`extension/plugins/DF_FormGuard/` 配下のプラグイン本体を公開するためのものです。

管理画面は `themes/system/admin/app/df-form-guard.html` へコピーせず、a-blog cms の `InjectTemplate` でプラグイン内テンプレートを `admin-main` に差し込みます。

互換POSTだけは、環境差を吸収するために同期ファイルを使います。

- `extension/acms/POST/FormGuardSettings.php`
- `extension/acms/POST/FormGuardFormSettings.php`
- `extension/acms/POST/FormGuardAiConnectionCheck.php`

旧バージョンで作成された `themes/system/admin/app/df-form-guard.html` は、管理マーカー付きの場合だけ更新時に自動退避されます。  
退避後は `InjectTemplate` 方式の最新管理画面が表示されます。  
管理マーカーがないファイルは、ユーザー編集の可能性があるため自動退避しません。

## 注意

- 現時点では PoC 段階です
- OpenAI API の利用料金は利用者側で発生します
- AI 判定は 100% 正確ではないため、正規問い合わせを落とさない設定を優先しています
