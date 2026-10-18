# API Reference: Notebook PDF Export

Generates and downloads a formatted PDF document containing ordered notes, rich text, task lists, code blocks, tables, and embedded images.

## Endpoint

```http
POST /api/export/pdf
```

## Authentication

| Type | Header | Scope | Description |
|---|---|---|---|
| Cookie | `Cookie: freeform_session=<token>` | Session | Standard browser session cookie |
| Bearer | `Authorization: Bearer ff_pat_<token>` | `read` or `read,write` | Personal Access Token (PAT) |

---

## Request Parameters

The request body is a JSON object supporting flexible payload structures:

### Top-Level Attributes

| Parameter | Type | Required | Description |
|---|---|---|---|
| `notebookName` | string | Optional | Document title printed at top of PDF and used in the default filename. Aliases: `notebook_name`, `title`. |
| `notebookId` | string | Optional | UUID of the notebook. Used to look up the notebook name or fallback to all notes in the notebook. |
| `filename` | string | Optional | Custom output filename (excluding or including `.pdf`). |
| `notes` | array | Optional | Ordered array of note objects or HTML strings. Aliases: `items`. |
| `html` | array \| string | Optional | Raw HTML string or array of pre-formatted HTML sections. |
| `ids` | array | Optional | Ordered array of note IDs to fetch and render from SQLite. Aliases: `noteIds`. |

> **Validation Rule:** At least one note object, HTML snippet, or valid note ID must resolve from the payload; otherwise, the endpoint responds with HTTP `400 Bad Request`.

---

### Note Object Schema (`notes[]` / `items[]`)

| Property | Type | Description |
|---|---|---|
| `id` | string | Note identifier. Used to hydrate missing fields from the database. |
| `title` | string | Note heading displayed in the PDF document section. |
| `html` | string | Pre-rendered TipTap / Markdown HTML content. |
| `content` | string | Raw markdown or plain-text body (used if `html` is omitted). |
| `type` | string | Item type: `'note'`, `'counter'`, `'bookmark'`, `'poster'`. |
| `metadata` | object | Form template data, counter settings, or bookmark details. |
| `tags` | array | Array of string tag names or `{ name: string }` objects. |
| `created_at` | string | ISO timestamp of note creation. |
| `updated_at` | string | ISO timestamp of last update. |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PUPPETEER_EXECUTABLE_PATH` | Automatic discovery | Absolute path to the Chromium / Chrome executable on the host or inside the container. |
| `CHROME_PATH` | Automatic discovery | Secondary fallback variable for the browser binary. |
| `CHROMIUM_PATH` | Automatic discovery | Tertiary fallback variable for the browser binary. |

---

## Example Requests

### 1. Client-Side Rendered Notes with Ordered Sequence

```bash
curl -X POST "http://localhost:3000/api/export/pdf" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ff_pat_0123456789abcdef" \
  --output "Engineering_Notebook.pdf" \
  --data-binary @- <<'JSON'
{
  "notebookName": "Engineering Specifications",
  "filename": "Engineering-Specs-2026",
  "notes": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "title": "Architecture Overview",
      "html": "<h2>Architecture Overview</h2><p>System components and layout.</p><ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"true\"><label><input type=\"checkbox\" checked=\"checked\" disabled=\"disabled\" /><span></span></label><div>Deploy cluster</div></li></ul>",
      "type": "note",
      "tags": ["architecture", "rfc"]
    },
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "title": "Production Deployment Checklist",
      "content": "### Steps\n- [x] Run unit tests\n- [ ] Promote build",
      "type": "note"
    }
  ]
}
JSON
```

### 2. Export by Existing Database Note IDs in Custom Order

```bash
curl -X POST "http://localhost:3000/api/export/pdf" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ff_pat_0123456789abcdef" \
  --output "Selected_Notes.pdf" \
  -d '{
    "notebookName": "Sprint Review",
    "ids": [
      "22222222-2222-2222-2222-222222222222",
      "11111111-1111-1111-1111-111111111111"
    ]
  }'
```

---

## Response Headers & Body

### Success (`200 OK`)

| Header | Example Value |
|---|---|
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `attachment; filename="Engineering-Specs-2026.pdf"` |
| `Content-Length` | `48214` |

The response body contains binary `%PDF-1.4` stream data.

### Error Responses

#### `400 Bad Request`
Returned when no valid notes or HTML snippets are supplied, or when all supplied IDs are invalid or belong to other users:
```json
{
  "error": "At least one note or HTML payload is required to generate a PDF"
}
```

#### `500 Internal Server Error`
Returned if the Chromium process fails or is missing from the environment:
```json
{
  "error": "Failed to generate PDF: No Chromium/Chrome executable found. Set PUPPETEER_EXECUTABLE_PATH or install chromium."
}
```
