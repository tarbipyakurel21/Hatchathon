# SurgiLabel & BioLabel — Advanced Surgical Video & Biomedical Image Annotation Platform

> **From Raw Surgical Footage & Microscopy to AI-Ready Computer Vision Datasets.**

SurgiLabel is a world-class, web-based platform for annotating surgical videos and creating high-quality biomedical computer vision datasets. Built for healthcare AI hackathons and biomedical research teams, it merges **CVAT's deep annotation power**, **Figma's canvas precision**, **Linear's workflow elegance**, and **modern medical imaging clarity**.

![SurgiLabel Architecture](https://img.shields.io/badge/Stack-Next.js%2014%20%7C%20FastAPI%20%7C%20React%20Konva%20%7C%20Three.js-0B1120?style=flat-square)
![Design Palette](https://img.shields.io/badge/Theme-Scientific%20Dark%20(#0B1120)-22D3EE?style=flat-square)
![Hardware](https://img.shields.io/badge/Target-MacBook%20Air%20M3%20%288GB%20RAM%29-10B981?style=flat-square)
![Docker Compose](https://img.shields.io/badge/Deploy-docker%20compose%20up%20--build-3B82F6?style=flat-square)

---

## 🎯 Product Highlights

### 1. Surgical Video Annotation Workspace (`/annotate/[videoId]`)
- **5-Region Professional Layout**:
  - **Region 1: Top Toolbar**: Video metadata, real-time save indicator, undo/redo history, zoom/pan controls, dataset export, and review status badge.
  - **Region 2: Left Vertical Tool Strip**: Select (`V`), Bounding Box (`B`), Polygon (`P`), Point (`K`), Pan (`H`), 3D Mesh View, and Delete (`Del`).
  - **Region 3: Central Video Canvas**: High-definition HTML5 video rendering with a synchronized **React Konva** coordinate-accurate annotation overlay (calibrated to native video resolution `640x480`). Features label-colored outlines, selection handles, and SAM 2 optical flow tracking.
  - **Region 4: Right Inspector**: 4 dedicated tabs — **Objects** (track list, visibility, deletion), **Labels** (standard surgical instrument taxonomy), **Properties** (exact bounding box/polygon geometry and telemetry), and **Review** (QA status, reviewer notes, and one-click approval).
  - **Region 5: Video Timeline & Surgical Phase Lanes**: CVAT-grade NLE timeline with frame-accurate scrubbing, direct frame jump, keyframe diamonds (`◆`), multi-track instrument lanes, and editable surgical phase interval tracks (`Preparation`, `Dissection`, `Clipping`, `Extraction`).
- **Authentic Medical Data**: Pre-bundled with real human laparoscopic cholecystectomy surgical footage (`real_laparoscopy_cholecystectomy.mp4`, 120 frames @ 25 FPS) with pre-tracked clinical objects:
  - Laparoscopic Grasper (`#3B82F6`)
  - Electrocautery Hook (`#EF4444`)
  - Gallbladder Fundus (`#10B981`)
  - Liver Parenchyma (`#F59E0B`)
- **Three.js Volumetric Viewer**: Interactive 3D WebGL mesh viewer rendering spatial surgical organ models with realistic medical materials.

### 2. Project & Dataset Management (`/projects`, `/projects/[id]`)
- **Linear-Inspired Project Library**: Grid and list views, search and filtering, sort by progress/date, and New Project modal with clinical instrument taxonomy selection.
- **Project Details Hub**: Dataset statistics, video clip cards with clinical thumbnails, annotation completion bars, taxonomy viewer, team collaboration UI, and drag-and-drop video upload dropzone (`MP4`, `WebM`).

### 3. Executive Dashboard (`/dashboard`)
- 4 Key Clinical Metric KPIs: **Total Projects**, **Videos Uploaded**, **Annotated Frames**, and **Pending Reviews**.
- Recharts-powered 7-day annotation velocity and QA approval chart.
- Quick-launch active surgical projects and chronological procedural activity feed.

### 4. Research-Oriented Analytics (`/analytics`)
- Annotation distribution by surgical instrument class (Recharts bar chart).
- Manual vs. AI-assisted tracking ratio (Recharts pie chart).
- Multi-stage QA review funnel (Unreviewed ➔ Pending Review ➔ Approved ➔ Rejected).

### 5. Multi-Format Dataset Export
Download genuine machine-learning-ready datasets directly in the browser:
- **Video-COCO JSON**: Full video, sequence, and frame-level polygon/bbox definitions.
- **YOLOv8 Format**: Darknet normalized coordinates with `data.yaml` class mapping.
- **SurgiLabel JSON**: Native schema with video timestamps, surgical phase intervals, and multi-track object associations.

---

## ⚡ Quickstart Deployment

SurgiLabel is optimized to run locally on an **Apple MacBook Air M3 (8 GB RAM)** with zero cloud costs or external API dependencies.

### Run with Docker Compose

```bash
docker compose up --build
```

### Access Points
- **Web Application**: [http://localhost:3000](http://localhost:3000) (Redirects to `/dashboard`)
  - **Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
  - **Projects Library**: [http://localhost:3000/projects](http://localhost:3000/projects)
  - **Surgical Workspace**: [http://localhost:3000/annotate/demo_laparoscopy_cholecystectomy](http://localhost:3000/annotate/demo_laparoscopy_cholecystectomy)
  - **Analytics**: [http://localhost:3000/analytics](http://localhost:3000/analytics)
- **Backend REST API**: [http://localhost:8000](http://localhost:8000)
- **Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Diagnostic**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## 🛠️ Technology Architecture

### Frontend
- **Framework**: Next.js 14 (App Router, TypeScript)
- **State Management**: Zustand (`useSurgiLabelStore.ts`) with undo/redo stack
- **Canvas Overlay**: React Konva (`konva` + `react-konva`) for pixel-perfect 2D vector graphics
- **3D Visualization**: Three.js (`three` + `@types/three`)
- **Data Visualization**: Recharts for responsive SVG analytics
- **Styling**: Tailwind CSS with custom scientific dark palette:
  - Deep Charcoal: `#0B1120`
  - Sidebar: `#0F172A`
  - Elevated Surfaces: `#172033`
  - Accent Cyan: `#22D3EE`
  - Accent Blue: `#3B82F6`
  - Success Green: `#10B981`
  - Warning Amber: `#F59E0B`
  - Error Red: `#EF4444`

### Backend
- **Framework**: FastAPI (Python 3.11)
- **Computer Vision**: OpenCV Headless, NumPy, SciPy, scikit-image
- **Database**: SQLite with WAL mode (`PRAGMA journal_mode = WAL;`) and autocommit connection pooling
- **Video Processing**: Frame extraction, real surgical video demo generation, and video streaming

---

## 🧪 Test Suites

### Backend Unit & Integration Tests (29/29 Passing)
```bash
PYTHONPATH=. ./.venv/bin/pytest backend/tests/
```

### Frontend Tests (8/8 Passing)
```bash
npm test --prefix frontend
```

### Next.js Production Build
```bash
npm run build --prefix frontend
```
All routes compile and statically generate cleanly without warnings or errors.
