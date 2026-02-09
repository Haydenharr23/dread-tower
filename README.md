# Dread AI GM

An AI game master for Dread-style horror one-shots. Set up a story and characters, generate beats and endings, then play through scenes with the AI guiding the story.

## How to run it

### 1. Install Node.js (if you don’t have it)

- Go to [https://nodejs.org](https://nodejs.org) and download the **LTS** version.
- Run the installer, then close and reopen your terminal.

### 2. Install dependencies

In a terminal, go to this project folder and run:

```bash
npm install
```

### 3. Add your Gemini API key (so beats/endings match your story)

- Create a file named `.env.local` in the project folder.
- Add one line: `GEMINI_API_KEY=your_key_here`
- Get a free key at [Google AI Studio](https://aistudio.google.com/apikey).

Without this key, the app uses stub data (same generic beats for every story).

### 4. Start the app

```bash
npm run dev
```

You should see: `Local: http://localhost:3000`

### 5. Open in your browser

Go to **http://localhost:3000**. You should see the Dread AI GM page. Fill in the story and character sheets, then click “Generate beats & endings” and “Start game” to play.
