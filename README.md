# Formant Drift (English)
A Web Audio Module (WAM2) effect in which three peaks, like vocal formants, slowly wander around the frequencies you set.

- ID: `net.pitan76.formantdrift`
- Type: Effect

![Formant Drift](screenshot.png)

## Controls
| Name | Range | Description |
| --- | --- | --- |
| Peak | 0-24 dB | Height of the peaks |
| Sharp | 0.3-3 | Sharpness of the peaks (multiplier of Q) |
| Drift | 0-1 | How far the peaks wander. 0 keeps them fixed, 1 uses the whole range |
| Rate | 0.02-3 Hz | Speed of the wandering |
| Mix | 0-1 | Amount of the effect |
| F1 | 280-900 Hz | Center of the first peak. Drag F1 on the display, or type a value |
| F2 | 800-2700 Hz | Center of the second peak |
| F3 | 2300-3600 Hz | Center of the third peak |

The Random button picks new F1-F3 values within their ranges. The result is saved like any other value, so you can fine-tune it afterwards. Nothing is random except at the moment you press the button, so the sound is the same every time.

## How it works
Three peaking filters are placed in series in the ranges of the vowel formants (F1 280-900 Hz, F2 800-2700 Hz, F3 2300-3600 Hz). Each filter wanders smoothly around the frequency set by F1-F3 with a sine wave of its own speed and phase, connected directly to `detune`. Adding peaks raises the level, so the output is lowered according to `Peak`.

## Development
```sh
npm ci
npm run build   # creates dist/index.js and dist/descriptor.json (an ES module with the SDK bundled)
npm test   # in headless Chrome, checks that sound is produced and the spectrum moves, that parameter values can be read and written, and that GUI knob operations do not snap back
npm run screenshot   # retakes the GUI and saves it to screenshot.png
```

Pushing to main makes GitHub Actions publish `dist/` with GitHub Pages. Give the host the URL of the published `index.js`.

---

# Formant Drift (日本語)
フォルマントにあたる3つの山が、設定した周波数を中心にゆっくり揺らぎながら変わっていく Web Audio Module（WAM2）のエフェクト

- ID: `net.pitan76.formantdrift`
- 種別: エフェクト

![Formant Drift](screenshot.png)

## つまみ
| 名前 | 範囲 | 内容 |
| --- | --- | --- |
| Peak | 0〜24 dB | 山の高さ |
| Sharp | 0.3〜3 | 山の鋭さ（Q に掛ける倍率） |
| Drift | 0〜1 | 山の揺れる幅。0 で固定、1 で動ける範囲いっぱいまで動く |
| Rate | 0.02〜3 Hz | 揺れる速さ |
| Mix | 0〜1 | 効果音の割合 |
| F1 | 280〜900 Hz | 1 つ目の山の中心。ディスプレイの F1 をドラッグするか、数値で入力する |
| F2 | 800〜2700 Hz | 2 つ目の山の中心 |
| F3 | 2300〜3600 Hz | 3 つ目の山の中心 |

Random ボタンを押すと、F1〜F3 を範囲内でランダムに決め直す。結果は普通の値として保存されるので、あとから細かく直せる。ランダムなのはボタンを押した瞬間だけで、音は毎回同じになる。

## しくみ
母音のフォルマント（F1 280〜900 Hz、F2 800〜2700 Hz、F3 2300〜3600 Hz）の範囲に、3 つのピーキングフィルターを直列に置く。F1〜F3 で決めた周波数を中心に、山ごとに速さと位相をずらした正弦波で滑らかに揺らす（`detune` に直接つなぐ）。山を足すと音量が上がるので、`Peak` に応じて出力を下げている。

## 開発
```sh
npm ci
npm run build   # dist/index.js と dist/descriptor.json を作る（SDK を同梱した ES モジュール）
npm test   # Chrome（headless）で、音が出てスペクトルが動くこと、つまみの値が読み書きできること、画面のつまみの操作が戻らないことを確かめる
npm run screenshot   # 画面を撮り直して screenshot.png に保存する
```

main に push すると、GitHub Actions が `dist/` を GitHub Pages で公開する。ホストには、公開された `index.js` の URL を渡す。
