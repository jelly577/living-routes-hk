# 10/4 GenAI 对比证据

These are designed as four short screen recordings or live interactions. The outputs should be generated from the reviewed local data so the demo still works without a model key or network.

## 1. Interest changes the angle

**Same place:** Blue House, Heritage Facts, English, 45 seconds.

| Profile | Expected opening / emphasis |
|---|---|
| Architecture | balconies, timber stairs, building cluster and conservation detail |
| Local life / People's Memories | shared kitchens, neighbours and keeping residents in place |

Evidence to show: the `personalization.interestFocus` value and the changed first sentence in the story.

## 2. Remaining time changes length

**Same place:** Lee Tung Street, Heritage Facts, Cantonese.

| Remaining time | Expected result |
|---:|---|
| 10 seconds | `story.length = short` |
| 60 seconds | `story.length = long` |

Evidence to show: the selected title, `durationSec`, and the fact that the shorter story does not simply get cut mid-sentence.

## 3. Content type changes the voice

**Same place:** Central Market, Cantonese.

| Type | What the judge should hear |
|---|---|
| Heritage Facts | source-grounded history and architecture |
| Local Voices | an authorised human recording when available; otherwise an explicit Demo adaptation label |
| Culture Bites | a short, source-grounded cultural connection, not an invented celebrity anecdote |

Evidence to show: `contentType`, disclosure/source line and the language switch.

## 4. Private memory changes the next recommendation

Add a private memory such as: “I photographed the old facade and the afternoon light.” Generate the journal.

Expected result:

- profile signal: `Photography & architecture`
- next recommendation: `An architecture detail story`
- privacy banner remains visible; nothing is added to the public Community feed automatically.

## Recording checklist

- Start with the same location and language in each comparison.
- Capture the input controls and the returned metadata, not only the final prose.
- Label pre-generated outputs as `rule-based reviewed content`.
- If a real local recording is not yet available, say so explicitly and use the demo adaptation card.

