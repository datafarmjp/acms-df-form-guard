# Changelog

## Unreleased

<a id="v0-1-8"></a>
## 0.1.8 - 2026-05-15

- フォーム履歴一覧にAI判定列を追加し、`OK / NG / ERROR`、カテゴリ、信頼度、管理者宛メール抑制有無、判定理由を確認できるようにしました。
- フォーム履歴一覧用の専用POSTを追加し、保存済みの `df_form_guard_*` フィールドだけを返すようにしました。
- FormGuard有効時にフォームログを残さない設定の場合、フォームID編集画面に注意を表示するようにしました。
- READMEにフォーム履歴一覧で判定結果を確認できることを追記しました。

<a id="v0-1-7"></a>
## 0.1.7 - 2026-05-15

- 管理画面のパンくずに、拡張アプリ名として「DFフォームガード」を表示するようにしました。
- READMEに `admin-topicpath` によるパンくず表示ルールを追記しました。
- 最新版通知をDF_Likeの現在方針に合わせ、通常はGitHub APIを確認し、失敗時だけキャッシュへフォールバックするようにしました。
- 左メニューのDFフォームガードリンクに、最新版がある場合の青ドット表示を追加しました。

<a id="v0-1-6"></a>
## 0.1.6 - 2026-05-14

- 管理画面用CSSの一部をテンプレート内にも指定し、設定枠前の余白が確実に反映されるようにしました。
- 管理画面・フォームID編集画面のアセットクエリを `0.1.6` に更新しました。

<a id="v0-1-5"></a>
## 0.1.5 - 2026-05-14

- AI接続チェックを接続確認専用に整理し、テスト内容入力欄を削除しました。
- AI接続チェックの最終確認日時を保存し、管理画面に表示するようにしました。
- 管理画面とフォームID編集画面の主要項目にツールチップを追加しました。
- 全体設定画面からフォーム別設定への案内を強化しました。
- READMEと管理画面に開発継続の応援リンクを追加しました。
- 使い方案内を独立したセクションにし、文言をフォーム別設定への導線に絞りました。
- 開発応援ボタンに金額を表示しました。

<a id="v0-1-4"></a>
## 0.1.4 - 2026-05-14

- GitHub Release本文を他のDF拡張アプリと同じ `変更内容` / `インストール` / `注意` 形式に揃えました。
- `CHANGELOG.md` のバージョン別アンカーを使って、Release JSONと管理画面の更新通知から該当箇所へリンクできるようにしました。
- リリース前の静的確認をまとめて実行する `tools/release-check.sh` を追加しました。
- 管理画面にGitHub Releaseの最新版通知と、a-blog cms拡張アプリ開発の相談導線を追加しました。
- READMEと管理画面の説明を、問い合わせフォームの不要メール抑制に用途を限定する方針へ整理しました。
- AI接続チェック結果に、利用モデル、APIキー取得元、サンプル判定を表示するよう改善しました。
- データファーム製 a-blog cms 拡張アプリの共通公開ガイドライン参照を追加しました。

<a id="v0-1-3"></a>
## 0.1.3 - 2026-05-07

- Added `tools/release.sh` for ZIP packaging and GitHub Release publishing.
- Added `tools/release-json.php` and `RELEASE_MANIFEST.txt` for release metadata and package file control.
- Updated README with release packaging instructions.

<a id="v0-1-2"></a>
## 0.1.2 - 2026-05-07

- Switched the admin app screen from system theme copy to `InjectTemplate` on `admin-main`.
- Added conditional rendering for `app_df-form-guard` only.
- Added legacy managed admin template archive handling.

<a id="v0-1-1"></a>
## 0.1.1 - 2026-04-23

- Fixed injected form settings restoration by adding a form settings JSON POST.
- Kept reference entry IDs visible after saving from the form ID edit screen.

<a id="v0-1-0"></a>
## 0.1.0 - 2026-04-23

- Added initial PoC implementation.
- Added form-level FormGuard settings via the form ID edit screen.
- Added form-level reference entry IDs as OK-decision context for AI classification.
- Added OpenAI connection settings and AI connection check.
- Added `beforeSendAutoReply` hook classification and administrator email suppression.
- Added managed POST wrappers for `extension/acms/POST/`.
