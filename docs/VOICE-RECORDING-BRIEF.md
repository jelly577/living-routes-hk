# Local Voices 录音 brief

## 这次先录什么

优先选择 **蓝屋建筑群**，因为它已经在当前城巴 1 号线 Demo 路线中。九龙城寨可以作为未来路线扩展内容，暂时不要放进当前路线的主 Demo，否则评委会问它为什么不在这条路线沿线。

目标：一段 20–40 秒的自然粤语录音，保留说话者的停顿、语气和口音。

## 录音提示词

请说一件你亲身经历、听家人说过，或在这里长期观察到的日常小事。不要尝试讲完整历史；重点是一个具体画面：谁在做什么、邻居怎样相处、你当时有什么感觉。

可以参考以下开头，但不要照读：

> 「我以前成日經過藍屋，最記得係……」
>
> 「嗰陣時樓下啲街坊……」
>
> 「我唔敢講年份，但我記得嗰種生活係……」

如果录音者不是当事人，而是团队成员的演示录音，必须在素材中标注：

> Prototype participant voice · demonstration only · not a verified resident submission

## 录音时不要做的事

- 不要编造具体居民姓名、职业或未核实年份。
- 不要把公开历史资料说成自己的亲身经历。
- 不要模仿名人或使用未经许可的声音克隆。
- 不要录入身份证、住址、电话号码等个人资料。

## 授权文字

录音前请让说话者明确同意以下用途，并保存同意记录：

> 我同意 Lorevista / Living Routes HK 在黑客松原型及演示中使用这段录音，用于转写、降噪、翻译、字幕和生成导览摘要。我知道这段录音不会自动公开发布；如要加入公开故事库，团队会再次向我确认。

English version:

> I consent to Lorevista / Living Routes HK using this recording in the hackathon prototype and demo for transcription, noise reduction, translation, subtitles and a narrated summary. I understand it will not be published automatically; the team will ask again before adding it to a public story library.

上面的授权**不包含声音克隆**。如果希望由 AI 用录音者的声音朗读经其确认的新稿件，必须另行、单独取得可撤回的授权：

> 我另行同意 Living Routes HK 使用这段录音建立仅用于本项目已批准导览稿件的 AI 声音副本。我明白这不是公开发布授权，也不是无限期或通用授权；我可以随时要求停止生成新音频及撤下尚未锁定的衍生音频。

English version:

> I separately consent to Living Routes HK using this recording to create an AI replica of my voice solely for approved scripts in this project. I understand that this is not permission for public release or unrestricted reuse, and I may withdraw permission for future generation and request removal of derivative audio that has not been contractually retained.

原型阶段默认优先播放原始录音；没有上述独立授权时，只能使用原声片段或中性旁白，不得模拟录音者声音。即使已经同意声音副本，每段新生成稿件仍需人工复核，并清楚标注为 AI 合成语音。

## 交给代码时的 metadata

```json
{
  "placeId": "blue-house",
  "speakerLabel": "Prototype participant voice",
  "language": "zh-HK",
  "consentForDemo": true,
  "consentForPublicLibrary": false,
  "consentForVoiceReplica": false,
  "sourceType": "recorded-with-consent",
  "factStatus": "personal-memory-not-a-fact-claim"
}
```
