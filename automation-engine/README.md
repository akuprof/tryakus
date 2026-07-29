# Trichy Insight Automation Engine

Phase 1 of the automated carousel, Tamil voiceover, reel, and publishing pipeline.

## Included

- Authenticated article ingestion endpoint
- Input validation
- AI-generated Tamil carousel structure
- Spoken-Tamil voiceover script
- Safety guidance for sensitive news
- Supabase jobs/tasks queue
- Slide, voiceover, and reel task creation
- Failure logging

## Setup

```bash
cd automation-engine
cp .env.example .env
npm install
npm run build
npm start
```

Apply `supabase/migrations/202607300001_automation_engine.sql` to the connected Supabase project.

## Endpoint

`POST /v1/jobs` with header `x-automation-secret`.

The initial release defaults to `autoPublish: false`. Publishing should only be enabled after rendered assets pass editorial and platform-policy checks.

## Next

1. Branded slide renderer
2. Tamil TTS worker and subtitle timing
3. Remotion/FFmpeg reel renderer
4. Meta, YouTube, Telegram, and CMS publishers
5. Approval dashboard, retries, analytics
