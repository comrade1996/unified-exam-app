# Unified Exam Study App

Static exam app for:

- Mathematics for AI
- Information Security
- OOP
- AI Ethics
- Artificial Intelligence
- Operating Systems

The app stores each user's progress in browser `localStorage`, so every user has separate progress on their own browser/device.

## Run Locally

From the parent `OS` folder:

```powershell
node study-server.js
```

Open:

```text
http://127.0.0.1:4173/unified-exam-app/index.html
```

## Rebuild Data

If the source exam JSON or OS exam bank changes:

```powershell
node unified-exam-app\build-unified-data.js
```

## Add AI Questions Later

Put any JSON file anywhere under:

```text
C:\Users\Omair Gibreel\Downloads\AI
```

Use this shape:

```json
{
  "title": "AI Lecture Exams",
  "exams": [
    {
      "id": "ai-lecture-1",
      "kind": "Lecture Exam",
      "title": "Lecture 1 - Example",
      "description": "Optional description",
      "questions": [
        {
          "type": "Single Choice",
          "prompt": "Question text?",
          "choices": ["Correct", "Wrong", "Wrong", "Wrong"],
          "answer": [0],
          "explanation": "Why the answer is correct."
        }
      ]
    }
  ]
}
```

Then rebuild:

```powershell
node unified-exam-app\build-unified-data.js
```

## Deploy to GitHub Pages

Upload the contents of this folder to a GitHub repository, then enable:

- Settings
- Pages
- Deploy from a branch
- Branch: `main`
- Folder: `/root`

The deployed app will work without a backend.
