# ☁️ CloudDrop — Serverless File & Media Sharing Platform

A cloud-based file and media sharing platform built with **AWS serverless** infrastructure. Share text, images, videos, and documents instantly via unique shareable links.

![Architecture](https://img.shields.io/badge/AWS-Serverless-FF9900?style=for-the-badge&logo=amazonaws)
![Lambda](https://img.shields.io/badge/Lambda-Python_3.12-3776AB?style=for-the-badge&logo=python)
![Status](https://img.shields.io/badge/Status-Active-10b981?style=for-the-badge)

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser UI    │────▶│ API Gateway  │────▶│   Lambda     │
│  (HTML/CSS/JS)  │     │   (REST)     │     │  Functions   │
└─────────────────┘     └──────────────┘     └──────┬───────┘
                                                     │
                                    ┌────────────────┼────────────────┐
                                    ▼                ▼                ▼
                             ┌──────────┐    ┌──────────┐    ┌──────────────┐
                             │    S3    │    │ DynamoDB  │    │ EventBridge  │
                             │ (Files)  │    │(Metadata) │    │  (Cleanup)   │
                             └──────────┘    └──────────┘    └──────────────┘
```

### AWS Services Used

| Service | Purpose |
|---------|---------|
| **S3** | Store uploaded files (images, videos, documents) |
| **Lambda** | 4 functions — upload, share, text_share, cleanup |
| **API Gateway** | RESTful API endpoints |
| **DynamoDB** | Store share metadata with TTL auto-expiry |
| **EventBridge** | Scheduled cleanup of expired content |

---

## ✨ Features

- 📁 **File Upload** — Drag-and-drop or browse to upload images, videos, PDFs, ZIPs
- 📝 **Text Sharing** — Paste text/code and get an instant shareable link
- 🔗 **Shareable Links** — Unique 8-character codes (e.g., `share.html?code=abc12345`)
- 👁️ **Preview** — Inline preview for images, videos, and text
- ⏰ **Auto-Expiry** — Set expiry to 1 hour, 24 hours, 7 days, 30 days, or never
- ⬇️ **Download** — Direct download button on every share page
- 🌙 **Dark Mode** — Premium glassmorphism design
- 📱 **Responsive** — Works on mobile, tablet, and desktop
- 🧪 **Demo Mode** — Works locally without backend using localStorage

---

## 🚀 Quick Start

### 1. Run Locally (Demo Mode)

No AWS account needed — the frontend works standalone using localStorage:

```bash
cd frontend
# Open with any HTTP server
npx serve .
# OR
python -m http.server 3000
```

Open `http://localhost:3000` in your browser.

### 2. Deploy Backend to AWS

**Prerequisites:**
- AWS CLI installed and configured (`aws configure`)
- AWS SAM CLI installed ([install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))

```bash
# Build the SAM application
sam build

# Deploy (first time — guided mode)
sam deploy --guided
```

During guided deploy, use these settings:
- **Stack Name**: `clouddrop`
- **Region**: your preferred region (e.g., `ap-south-1`)
- **Confirm changes**: Yes
- **Allow SAM CLI to create IAM roles**: Yes

### 3. Connect Frontend to Backend

After deployment, copy the **API Gateway URL** from the outputs and update `frontend/js/app.js` and `frontend/js/share.js`:

```javascript
const CONFIG = {
  API_BASE: 'https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/Prod',
};
```

---

## 📁 Project Structure

```
MINI Project/
├── frontend/
│   ├── index.html          # Upload page (drag-drop + text paste)
│   ├── share.html          # Shared content viewer
│   ├── css/
│   │   └── style.css       # Design system (dark glassmorphism)
│   └── js/
│       ├── app.js          # Upload & text share logic
│       └── share.js        # Share page preview renderer
├── backend/
│   ├── upload.py           # Lambda: presigned URL generator
│   ├── share.py            # Lambda: share code lookup
│   ├── text_share.py       # Lambda: text content storage
│   └── cleanup.py          # Lambda: scheduled expiry cleaner
├── template.yaml           # AWS SAM / CloudFormation template
└── README.md               # This file
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Request presigned URL for file upload |
| `POST` | `/text` | Share text content |
| `GET` | `/share/{code}` | Get shared content metadata |

---

## 💰 Cost

This project runs entirely within the **AWS Free Tier**:
- Lambda: 1M free requests/month
- DynamoDB: 25 GB free storage
- S3: 5 GB free storage
- API Gateway: 1M free calls/month

---

## 📄 License

MIT License — use freely for your projects.
