# Speech Gym

Practice public speaking with AI, alone or with friends.

Speech Gym is an open-source practice room modeled on a Toastmasters-style meeting. You give a speech or answer an impromptu question, and AI fills the meeting roles that no human is available for: it hosts, asks the questions, and gives you a structured evaluation. Friends can join the same room peer-to-peer and take any role themselves.

> **Status:** early development. Solo practice of a prepared speech works today: record, transcribe, get Pacer and Spotter reports, and get a Coach evaluation. The sparring round, the other AI roles, and rooms with friends are not built yet. Sections below describe the full plan.

## What you can do

- **Practice solo.** You are the speaker. AI plays every other role.
- **Practice with friends.** Friends join your room directly over a peer-to-peer connection. Humans take the roles they want, and AI fills the rest.
- **Pick a theme.** Each session runs around one theme, which shapes the impromptu questions and the host's remarks.
- **Get a real evaluation.** Feedback quotes what you actually said, and comes with your pace, pauses, filler-word count, and timing.
- **Check your pronunciation clarity.** Paste the script you plan to read, in English. The app compares it with what the speech recognizer heard, highlights the words a listener could not make out, and lets you replay how you said each one next to a reference.
- **Drill what was unclear.** After the feedback, a drill session has you repeat the unclear words, contrasting pairs, and sentences until the listener hears each one clearly three times.

## Meeting roles

| Role | What it does | Who can fill it |
| --- | --- | --- |
| [Speaker](docs/roles/speaker.md) | Gives a prepared speech or answers an impromptu question | Human |
| [Captain](docs/roles/captain.md) | Hosts the session and introduces each part | Human or AI |
| [Sparring Partner](docs/roles/sparring-partner.md) | Runs the sparring round: impromptu questions on the theme that nobody has seen in advance | Human or AI |
| [Coach](docs/roles/coach.md) | Gives structured feedback on a speech | Human or AI |
| [Form Checker](docs/roles/form-checker.md) | Comments on word choice and language use | Human or AI |
| [Pacer](docs/roles/pacer.md) | Tracks speaking time against the target | Code, no AI needed |
| [Spotter](docs/roles/spotter.md) | Counts filler words such as "um" and "you know" | Code, no AI needed |

## How it works

1. You speak, and the browser records your audio.
2. A speech-to-text model turns the audio into a transcript with word-level timestamps.
3. Code measures pace, pauses, filler words, and total time.
4. A language model reads the transcript and those measurements, then writes the evaluation.
5. A text-to-speech voice reads the evaluation aloud, and the text appears on screen.

## Design principles

- **No server.** Speech Gym is a static web app. Fork it, run it locally, or publish it to GitHub Pages at no cost.
- **Bring your own key.** If you use a cloud AI provider, you enter your own API key. It stays in your browser and is never committed to the repository or sent to other participants.
- **Works without a key.** Every AI part has a free local option, so you can practice fully offline.
- **Swappable providers.** The language model, speech-to-text, and text-to-speech each sit behind a common interface, so you can choose a provider per role.
- **The host runs the AI.** In a shared room, the AI roles run on the host's machine and the results are synced to everyone else. Guests need no key and no setup.

## AI components

| Component | Free local default | Optional upgrade |
| --- | --- | --- |
| Language model | Local model through Ollama | Cloud API such as Claude or an OpenAI-compatible endpoint |
| Speech-to-text | Whisper running in the browser | Cloud speech-to-text API |
| Text-to-speech | The browser's built-in voices | Cloud text-to-speech API |

Evaluation quality depends most on the language model. A mid-tier or top-tier cloud model gives specific, quote-backed feedback. Small local models work, but their feedback is more generic.

## Planned tech stack

- Vite, React, and TypeScript
- WebRTC for peer-to-peer audio and room state, with serverless signaling
- Whisper in the browser for transcription
- Web Speech API for the default voices

## Roadmap

1. **Solo practice.** One speaker, one theme, AI Sparring Partner and Coach, timer, and filler-word count.
2. **Provider settings.** Choose a model per role, and enter your own keys.
3. **Rooms with friends.** Peer-to-peer rooms with human and AI roles mixed.
4. **Deeper delivery feedback.** Vocal variety and, later, video-based feedback on body language.

## Getting started

You need [Node.js](https://nodejs.org) 20 or later and a recent version of Chrome, Edge, or Safari.

```bash
git clone https://github.com/Alluxia-F/speech-gym.git
cd speech-gym
npm install
npm run dev
```

Open the address the command prints, usually `http://localhost:5173`.

1. Open **Settings** and choose how the Coach runs:
   - **Claude**: paste your own Anthropic API key. It is stored only in your browser.
   - **Ollama**: install [Ollama](https://ollama.com), pull a model, and enter its name. No key is needed.
2. Enter a speech title, a target length, and up to three goals. To practice pronunciation, also paste your script.
3. Choose **Start speaking** and give your speech. The clock starts at your first word, and the border turns green, yellow, then red as you move through your target time.
4. Choose **Finish speech**. The first run downloads the speech-to-text model, which takes about a minute. Later runs start right away.

The timing, pace, and filler reports work with no key and no Ollama. Only the Coach's evaluation needs a language model.

To run the unit tests, use `npm test`.

## Contributing

Issues and pull requests are welcome. The project is at the design stage, so feedback on the design is especially useful.

## License

To be decided. MIT is the current plan.

## Trademark notice

Speech Gym is an independent project. It is not affiliated with, sponsored by, or endorsed by Toastmasters International. "Toastmasters" is a trademark of Toastmasters International and is used here only to describe the meeting format that inspired this project.
