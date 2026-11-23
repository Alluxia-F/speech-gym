# Pacer

The Pacer measures how long every speaker and every part of the session takes, shows speakers where they are against their target while they talk, and reports the results at the end.

**Filled by:** code. Timing needs a clock, not a language model, so this role works with no API key and no local model. In a room with friends, a person can volunteer to present the Pacer's report aloud.

## What the Pacer does

- **Knows the limits for each segment.** Every type of speaking slot has a target range. The defaults are below, and the speaker's own target length overrides them for prepared speeches.
- **Explains the signals at the start.** When a session opens, the Pacer shows a short explanation of the limits and what each signal color means. Returning users can skip it.
- **Starts and stops on the speaker's voice.** The clock starts at the speaker's first word and stops when they finish, so setup and silence before the speech are not counted.
- **Signals the speaker during the speech.** A color signal appears on the speaker's screen at each threshold. It is visible at a glance and makes no sound, so it does not interrupt the speech.
- **Reports at the end.** For each speaker: name, segment, actual time, target range, and whether they finished inside it.

## Default time limits and signals

| Segment | Target range | Green | Yellow | Red |
| --- | --- | --- | --- | --- |
| Prepared speech | 5 to 7 minutes | 5:00 | 6:00 | 7:00 |
| Impromptu answer | 1 to 2 minutes | 1:00 | 1:30 | 2:00 |
| Evaluation | 2 to 3 minutes | 2:00 | 2:30 | 3:00 |

- **Green** means the minimum has been reached. Finishing now is inside the range.
- **Yellow** means the halfway point of the range. Start moving toward the close.
- **Red** means the maximum has been reached. Wrap up now.

For a prepared speech with a custom target, green appears at the minimum, red at the maximum, and yellow halfway between.

## Timing in a shared room

- The host's clock is the single source of truth. Signals and times are synced from the host to everyone in the room.
- The speaker sees the signals prominently. Other participants see the same clock in a smaller form.
- AI roles are timed too. An AI coach is held to the same two to three minutes as a human one.

## What the Pacer adds beyond a stopwatch

Because the app already has a transcript with timestamps, the Pacer's report can go further than total time:

- **Time per section.** How long the opening, body, and close each took, when those sections can be identified.
- **History.** How this attempt's time compares with earlier attempts at the same speech.

These numbers are also passed to the coach, who interprets them. The Pacer itself only measures and reports.

## What speakers gain from the Pacer

- **A feel for time.** After enough sessions, speakers learn what one minute and five minutes of their own speaking feel like.
- **Pacing under a limit.** Practice at adjusting mid-speech when the yellow signal appears earlier than expected.
- **Respect for the room.** Finishing on time is part of being a good speaker in any meeting.

A person who presents the Pacer's report practices giving a short, factual summary: names, times, and nothing extra.

## What the Pacer receives

- The session agenda: who speaks, in what order, and in which segment type
- Each speaker's target length, when they set one
- Speech start and end, detected from the audio

## What the Pacer produces

- Live color signals during each speaking slot
- A timing report for the session, shown on screen and read aloud at the end
- Timing data for the coach and for the speaker's history
