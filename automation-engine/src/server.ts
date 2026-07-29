import "dotenv/config";
import Fastify from "fastify";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const env = z.object({
  PORT: z.coerce.number().default(8787),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_TEXT_MODEL: z.string().default("gpt-5-mini"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AUTOMATION_WEBHOOK_SECRET: z.string().min(16)
}).parse(process.env);

const articleSchema = z.object({
  articleId: z.string().min(1),
  title: z.string().min(5),
  summary: z.string().min(10),
  content: z.string().min(50),
  category: z.string().default("திருச்சி செய்திகள்"),
  sourceImageUrls: z.array(z.string().url()).default([]),
  publishTargets: z.array(z.enum(["instagram", "facebook", "youtube", "telegram", "cms"])).default(["instagram", "facebook", "youtube", "telegram", "cms"]),
  autoPublish: z.boolean().default(false)
});

const app = Fastify({ logger: true });
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

app.get("/health", async () => ({ ok: true, service: "trichy-insight-automation-engine" }));

app.post("/v1/jobs", async (request, reply) => {
  if (request.headers["x-automation-secret"] !== env.AUTOMATION_WEBHOOK_SECRET) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  const article = articleSchema.parse(request.body);
  const { data: job, error: createError } = await db.from("automation_jobs").insert({
    article_id: article.articleId,
    status: "planning",
    input_payload: article,
    auto_publish: article.autoPublish,
    publish_targets: article.publishTargets
  }).select("id").single();
  if (createError) throw createError;

  try {
    const response = await openai.responses.create({
      model: env.OPENAI_TEXT_MODEL,
      input: `You are Trichy Insight's Tamil social newsroom editor. Convert this article into accurate JSON for a 7-10 slide vertical carousel and natural spoken-Tamil voiceover. Do not invent facts. Avoid graphic or sensational treatment of crime, suicide, accidents, or vulnerable people. Output keys: carouselTitle, reelCaption, voiceoverScript, estimatedDurationSeconds, hashtags, safetyNotes, slides. Each slide: index, role (hook/story/summary/cta), headline, body, visualPrompt, narration. Article: ${JSON.stringify(article)}`,
      text: { format: { type: "json_object" } }
    });

    const plan = JSON.parse(response.output_text);
    const tasks = [
      ...plan.slides.map((slide: Record<string, unknown>) => ({ job_id: job.id, task_type: "render_slide", task_key: `slide-${slide.index}`, payload: slide, status: "queued" })),
      { job_id: job.id, task_type: "generate_voiceover", task_key: "voiceover", payload: { script: plan.voiceoverScript }, status: "queued" },
      { job_id: job.id, task_type: "render_reel", task_key: "reel", payload: { slideCount: plan.slides.length }, status: "blocked" }
    ];

    const { error: updateError } = await db.from("automation_jobs").update({ status: "planned", content_plan: plan, updated_at: new Date().toISOString() }).eq("id", job.id);
    if (updateError) throw updateError;
    const { error: taskError } = await db.from("automation_tasks").insert(tasks);
    if (taskError) throw taskError;

    return reply.code(202).send({ jobId: job.id, status: "queued", slideCount: plan.slides.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown planning failure";
    await db.from("automation_jobs").update({ status: "failed", error_message: message, updated_at: new Date().toISOString() }).eq("id", job.id);
    throw error;
  }
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof z.ZodError) return reply.code(400).send({ error: "Invalid request", details: error.issues });
  app.log.error(error);
  return reply.code(500).send({ error: "Internal automation error" });
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });
