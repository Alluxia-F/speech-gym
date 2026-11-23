# Spotter

The Spotter catches the small verbal habits speakers rarely notice in themselves: filler sounds, crutch phrases, repeated words, and long stalls. It counts them, shows where they happened, and reports the results so the speaker can work on them.

**Filled by:** code. Counting works from the transcript and its timestamps, so this role needs no API key and no local language model. In a room with friends, a person can volunteer to present the Spotter's report aloud.

## What the Spotter does

- **Introduces itself at the start.** When a session opens, the Spotter shows a short note on what it tracks and why. Returning users can skip it.
- **Keeps the log automatically.** There is no form to fill in. Every speaker in the session gets their own log, built from the transcript as they talk.
- **Stays silent during the speech.** The speaker gets no buzzer or on-screen warning while talking. Being flagged mid-sentence makes most people more nervous, not more fluent.
- **Reports during the evaluation part of the session.** For each speaker: totals by category, the most frequent habit, and how the numbers compare with earlier attempts.

## What it tracks

| Category | Examples | How it is counted |
| --- | --- | --- |
| Filler sounds | um, uh, ah, er | Every occurrence |
| Crutch phrases | you know, I mean, kind of, basically | Every occurrence |
| Connector overuse | and, so, but, like | Only when used as a stall, for example at the start of a sentence or doubled as in "and, and". Normal use is not counted. |
| Repeats and restarts | "I I think", "we went, we went to" | Each immediate repetition of a word or phrase |
| Long pauses | A silence in the middle of a sentence | Each pause longer than the threshold, 2 seconds by default |

The lists are editable. Speakers can add their own crutch words, and each supported language has its own list. For Chinese, the defaults include 嗯, 那个, 就是, 就是说, and 然后.

## What it reports

- **Counts by category** and the total for the speech
- **Rate per minute**, so a 2-minute answer and a 7-minute speech can be compared fairly
- **The top habit**, the single word or phrase used most often
- **Where they cluster**, shown as highlights in the transcript. Fillers often bunch up at transitions or in sections that were less rehearsed.
- **Change over time**, compared with earlier attempts at the same speech and with the speaker's recent average

The Spotter only counts and reports. It does not give advice. The numbers are passed to the coach, who decides whether they matter for this speech and what to suggest.

## Known limits

- **Speech-to-text tends to clean up filler sounds.** Transcription models often drop "um" and "uh". Speech Gym configures transcription to keep them, but some will still be missed, so counts for filler sounds are a lower bound.
- **Not every pause is a problem.** A pause after a strong line is a technique, not a stall. The Spotter lists long pauses with their position and leaves the judgment to the coach and the speaker.
- **Words such as "so" and "like" are ambiguous.** The rules for connector overuse are deliberately cautious. They will miss some real fillers in order to avoid flagging normal speech.

## What speakers gain from the Spotter

- **Awareness.** Most people are surprised by their first report. Seeing the habit is the first step to changing it.
- **A number to move.** Fillers per minute is easy to track from one session to the next.
- **Comfort with silence.** The usual fix for a filler is a short pause. The report shows whether fillers are going down as deliberate pauses go up.

A person who presents the Spotter's report practices delivering observations briefly and factually, without embarrassing anyone.

## What the Spotter receives

- The transcript of each speaking slot, with word-level timestamps
- The filler lists for the session's language, including the speaker's own additions
- The speaker's earlier logs, when there are any

## What the Spotter produces

- A log for each speaker in the session
- A report shown on screen and read aloud during the evaluation part of the session
- A transcript view with fillers and long pauses highlighted
- Filler data for the coach and for the speaker's history
