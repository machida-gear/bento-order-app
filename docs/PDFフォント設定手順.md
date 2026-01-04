# PDFフォント設定手順

PDF生成時に日本語が正しく表示されるように、日本語フォントを設定する手順です。

> 📖 **関連ドキュメント**: [README.md](./README.md) - すべてのドキュメントへの参照

---

## 本番環境での注意事項

- **フォントファイルの配置**: 本番環境でも`public/fonts/`フォルダにフォントファイルを配置する必要があります
- **ビルド時の確認**: ビルド時にフォントファイルが正しく配置されることを確認してください
- **エラーハンドリング**: フォントファイルが見つからない場合、PDF生成APIで明確なエラーメッセージが表示されます
- **詳細**: 本番環境でのPDF生成エラー対策は`docs/本番環境PDF生成エラー対策チェックリスト.md`を参照してください

---

## フォントのダウンロード

以下のいずれかのフォントをダウンロードしてください：

### 1. IPAexフォント（推奨）

1. [IPAexフォントのダウンロードページ](https://moji.or.jp/ipafont/ipafontdownload/)にアクセス
2. 「IPAexゴシック」をダウンロード
3. ダウンロードしたZIPファイルを解凍
4. `ipaexg.ttf`ファイル（または`IPAexGothic.ttf`）を`public/fonts/`フォルダにコピー
   - 注意: ファイル名は`ipaexg.ttf`の場合があります

### 1-2. IPAフォント（旧版）

1. [IPAフォント Ver.003.03 ダウンロードページ](https://moji.or.jp/ipafont/ipa00303/)にアクセス
2. 「IPAゴシック」をダウンロード
3. ダウンロードしたZIPファイルを解凍
4. `ipag.ttf`ファイルを`public/fonts/`フォルダにコピー

### 2. Noto Sans JP

1. [Google Fonts - Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)にアクセス
2. 「Download family」をクリックしてダウンロード
3. ダウンロードしたZIPファイルを解凍
4. `NotoSansJP-Regular.ttf`ファイルを`public/fonts/`フォルダにコピー

## フォントファイルの配置

ダウンロードしたフォントファイルを以下の場所に配置してください：

```
public/
  fonts/
    ipaexg.ttf        (IPAexゴシック - 推奨、実際のファイル名)
    または
    IPAexGothic.ttf   (IPAexゴシック - 標準名)
    または
    ipag.ttf          (IPAゴシック - 旧版)
    または
    NotoSansJP-Regular.ttf  (Noto Sans JP)
```

## 確認

フォントファイルを配置した後、開発サーバーを再起動してPDF生成を試してください。

日本語が正しく表示されるはずです。
