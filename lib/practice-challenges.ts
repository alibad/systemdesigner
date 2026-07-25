/**
 * Client-safe practice-challenge config. Maps a practice slug to the graded block(s)
 * rendered for it by app/practice/layout.tsx.
 *
 * CRITICAL: this is imported by a client component, so it contains ONLY display data —
 * option labels, prompts, constraints. The grading (which option is accepted, the answer
 * bands) lives server-side in lib/rubrics/* and is never shipped here. The `challengeId`
 * links a block to its server rubric via /api/grade.
 *
 * Design-challenge problems (url-shortener, chat-system, …) are wired in-page and are
 * intentionally NOT listed here.
 */
import type { TradeoffOptionView } from '@/components/challenges/TradeoffChallenge';
import type { CapacityField } from '@/components/challenges/CapacityChallenge';

export interface PracticeTradeoff {
  challengeId: string;
  title: string;
  prompt: string;
  constraint: string;
  options: TradeoffOptionView[];
}

export interface PracticeCapacity {
  challengeId: string;
  title: string;
  prompt: string;
  fields: CapacityField[];
}

export interface PracticeChallengeConfig {
  tradeoff?: PracticeTradeoff;
  capacity?: PracticeCapacity;
}

export const PRACTICE_CHALLENGES: Record<string, PracticeChallengeConfig> = {
  'ad-targeting': {
    tradeoff: {
      challengeId: 'ad-targeting',
      title: 'Model serving for real-time bid scoring',
      prompt: 'A real-time bidding system must return a bid response within ~100ms at massive QPS, scoring each impression for click/conversion likelihood. How should you serve the scoring model on the bid hot path?',
      constraint: 'Hard sub-100ms bid latency at very high QPS — the auction drops late responses, and per-request compute is multiplied across millions of QPS.',
      options: [
        { id: 'lightweight-precomputed-embeddings', label: 'Lightweight online model over precomputed user/item embeddings' },
        { id: 'heavy-deep-model-per-request', label: 'Run a full heavy deep model per bid request' },
        { id: 'fully-precomputed-batch', label: 'Fully precomputed/batch scores looked up at bid time' },
        { id: 'external-model-api', label: 'Call an external/remote model inference API per request' },
      ],
    },
  },
  'ai-code-assistant': {
    tradeoff: {
      challengeId: 'ai-code-assistant',
      title: 'Model choice for inline code completion',
      prompt: 'Your IDE plugin shows inline "ghost text" completions as the developer types. Each keystroke can trigger a new suggestion. Which serving strategy should power the completions?',
      constraint: 'Completions must feel instant — under ~300ms end-to-end — or developers turn the feature off entirely. Perceived latency dominates raw suggestion quality.',
      options: [
        { id: 'large-high-quality', label: 'Always call a large, high-quality model for every keystroke' },
        { id: 'small-fast-model', label: 'Serve a small, latency-optimized model tuned for sub-200ms responses' },
        { id: 'speculative-cached', label: 'Small model on the hot path, with caching and speculative prefetch of likely next completions' },
        { id: 'large-with-streaming', label: 'Large high-quality model but stream tokens so the first token appears fast' },
      ],
    },
  },
  'computer-vision': {
    tradeoff: {
      challengeId: 'computer-vision',
      title: 'Inference placement for real-time on-device video analysis',
      prompt: "You're building an app that analyzes a live camera feed on phones and smart cameras (detecting objects/events frame-by-frame) and reacts instantly in the UI. Where should the vision model run?",
      constraint: 'Reactions must be real-time (sub-frame latency, no round-trip stalls), and raw video must NOT leave the device — both for privacy and to avoid saturating uplink bandwidth.',
      options: [
        { id: 'on-device-edge', label: 'Run a compact model fully on-device (edge inference)' },
        { id: 'hybrid-local-first', label: 'Hybrid: run detection on-device, send only sparse metadata/embeddings to the cloud' },
        { id: 'cloud-inference', label: 'Stream every frame to a cloud GPU and run the full model there' },
        { id: 'cloud-batch-after', label: 'Buffer video locally and batch-upload to the cloud for analysis after the fact' },
      ],
    },
  },
  'content-moderation': {
    tradeoff: {
      challengeId: 'content-moderation',
      title: 'Tuning the upload moderation classifier',
      prompt: 'A content classifier scores every user upload before it reaches other users. How should you configure the moderation pipeline?',
      constraint: 'Minimize harmful content reaching users while not over-blocking legitimate uploads — both failure modes are costly.',
      options: [
        { id: 'high-recall-autoblock', label: 'Tune for high recall and auto-block everything above the threshold' },
        { id: 'high-precision-autoallow', label: 'Tune for high precision and auto-allow anything below the threshold' },
        { id: 'human-in-loop-band', label: 'Auto-allow confident-safe, auto-block confident-harmful, route the uncertain middle band to human review' },
        { id: 'recall-then-appeals', label: 'Tune for high recall, auto-block aggressively, but offer a fast user appeals process' },
      ],
    },
  },
  'conversational-ai': {
    tradeoff: {
      challengeId: 'conversational-ai',
      title: 'Grounding a support assistant in fast-changing knowledge',
      prompt: 'Your support assistant must answer questions using company-specific knowledge (policies, product details, pricing) that changes weekly. Replies must reflect the latest facts and be grounded in real sources. Which approach fits best?',
      constraint: 'Knowledge changes frequently; answers must stay current and grounded in authoritative sources.',
      options: [
        { id: 'rag-live-kb', label: 'RAG: retrieve from a live knowledge base at query time, then generate grounded answers' },
        { id: 'fine-tune', label: 'Fine-tune the model on the company knowledge' },
        { id: 'bigger-base', label: 'Switch to a bigger, more capable base model' },
        { id: 'rag-plus-finetune', label: 'RAG for facts, plus light fine-tuning for tone and tool-calling format' },
      ],
    },
  },
  'dataset-diversity-dashboard': {
    tradeoff: {
      challengeId: 'dataset-diversity-dashboard',
      title: 'Computing diversity metrics for the dataset dashboard',
      prompt: 'A dashboard reports diversity metrics (class balance, demographic coverage, duplication rate) over very large training datasets. How should the metrics be computed to back the dashboard?',
      constraint: 'Metrics span huge datasets but are viewed only occasionally; freshness-to-the-minute is not required, and cost matters.',
      options: [
        { id: 'nightly-batch', label: 'Precompute metrics in a nightly batch job, serve cached results' },
        { id: 'compute-on-query', label: 'Compute on demand at view time, cache the result' },
        { id: 'streaming-realtime', label: 'Maintain metrics with a streaming/real-time aggregation pipeline' },
        { id: 'materialized-on-write', label: 'Recompute a materialized view on every dataset write' },
      ],
    },
  },
  'face-generation': {
    tradeoff: {
      challengeId: 'face-generation',
      title: 'Model choice for interactive face generation',
      prompt: 'Your app generates face images on demand while the user waits on screen for the result. Faces must look convincing but need not be flawless. Which model architecture should power the generator?',
      constraint: 'Users wait interactively for each result, so perceived latency is the priority; image quality must be good but not flawless.',
      options: [
        { id: 'gan', label: 'A GAN (single forward pass)' },
        { id: 'distilled', label: 'A small distilled diffusion model (few-step)' },
        { id: 'full-diffusion', label: 'A full multi-step diffusion model' },
        { id: 'autoregressive', label: 'An autoregressive pixel/token model' },
      ],
    },
  },
  'feature-store': {
    tradeoff: {
      challengeId: 'feature-store',
      title: 'Serving features online and offline',
      prompt: 'Your model trains on historical features in batch and needs the same features served at inference. How do you store and serve features so training and serving agree?',
      constraint: 'Eliminate train/serve skew (identical feature values at training and inference) while keeping online serving latency low (single-digit ms).',
      options: [
        { id: 'dual-store-sync', label: 'Separate online + offline stores written by one shared transform, kept in sync' },
        { id: 'on-the-fly', label: 'Compute features on demand at serving time, no precomputed store' },
        { id: 'single-store', label: 'One store for both training and serving' },
        { id: 'online-only', label: 'Serve from the online store; let training query it directly for historical values' },
      ],
    },
  },
  'fraud-detection': {
    tradeoff: {
      challengeId: 'fraud-detection',
      title: 'Tuning the fraud scorer',
      prompt: 'Your model scores every transaction for fraud in real time. Fraud that slips through is expensive to reverse, but blocking a legitimate customer at checkout erodes trust. How do you tune and architect the scoring decision?',
      constraint: 'Missed fraud is costly, but false positives that block real customers hurt trust just as much — protect recall without sacrificing the legitimate-customer experience.',
      options: [
        { id: 'async-deep-review', label: 'Real-time score with a fast threshold, plus async deep review for borderline cases' },
        { id: 'optimize-recall', label: 'Optimize the model purely for recall (catch as much fraud as possible)' },
        { id: 'optimize-precision', label: 'Optimize the model purely for precision (only flag when highly confident)' },
        { id: 'hard-block-threshold', label: 'Single hard cutoff that auto-blocks every transaction above a fixed risk score' },
      ],
    },
  },
  'gmail-smart-compose': {
    tradeoff: {
      challengeId: 'gmail-smart-compose',
      title: 'Where to run Smart Compose inference',
      prompt: 'Smart Compose predicts the rest of a sentence as the user types, suggesting completions inline. Where should the prediction model run?',
      constraint: 'Suggestions must keep up with keystrokes (single-digit-to-low-tens-of-ms latency) AND the email content being typed must stay private — sending raw draft text to servers is a privacy concern.',
      options: [
        { id: 'server-large', label: 'Server-side large model: stream keystroke context to a hosted LLM for every prediction' },
        { id: 'on-device-small', label: 'On-device small model: a compact quantized model runs locally for all predictions' },
        { id: 'hybrid', label: 'Hybrid: on-device for short completions, fall back to the server model for longer/complex ones' },
        { id: 'server-cached-edge', label: 'Server-side model behind an edge cache with regional endpoints to cut latency' },
      ],
    },
  },
  'google-translate': {
    tradeoff: {
      challengeId: 'google-translate',
      title: 'Serving strategy for web-scale translation',
      prompt: 'Translation requests arrive at enormous QPS, and a large fraction are repeated common phrases ("hello", "thank you", short UI strings). How should you serve translations to minimize latency and cost?',
      constraint: 'Low latency and low cost at enormous QPS, where a large fraction of requests are repeated common phrases.',
      options: [
        { id: 'always-nmt', label: 'Always run the full NMT model for every request' },
        { id: 'cache-then-nmt', label: 'Cache common phrase/sentence translations, fall back to NMT on miss' },
        { id: 'tier-by-popularity', label: 'Tier serving by language-pair popularity (dedicated capacity for hot pairs)' },
        { id: 'precompute-all', label: 'Precompute and store translations for the entire phrase space offline' },
      ],
    },
  },
  'headshot-generation': {
    tradeoff: {
      challengeId: 'headshot-generation',
      title: 'Generation flow for AI professional headshots',
      prompt: 'Users upload photos to generate professional headshots. High-quality output needs many seconds-to-minutes of GPU per image. How should you structure the generation flow?',
      constraint: 'High-quality results take many seconds-to-minutes of GPU; users will wait for quality but want feedback that something is happening.',
      options: [
        { id: 'fast-preview-then-async-hq', label: 'Fast low-quality preview instantly, then async high-quality job with notification' },
        { id: 'async-batch-notify', label: 'Async batch job, notify user when high-quality result is ready' },
        { id: 'synchronous-realtime', label: 'Synchronous real-time generation — block the request until the high-quality image returns' },
        { id: 'downgrade-quality-for-speed', label: 'Always serve only the fast lower-quality output to keep it real-time' },
      ],
    },
  },
  'image-captioning': {
    tradeoff: {
      challengeId: 'image-captioning',
      title: 'Captioning strategy for a huge, repetitive image corpus',
      prompt: 'You must generate alt-text captions for billions of images, where a large fraction are exact or near-duplicate copies of images you have already seen. Which captioning strategy do you build around?',
      constraint: 'High throughput over a huge corpus with heavy image repetition; per-image cost dominates, and marginal caption-quality gains matter little.',
      options: [
        { id: 'dedup-cache', label: 'Content-hash + perceptual-hash cache: caption once, serve cached caption for duplicates' },
        { id: 'small-model', label: 'Run a small captioning model (e.g. BLIP-base) on every image' },
        { id: 'large-vlm', label: 'Run a large vision-language model (e.g. GPT-4V class) on every image' },
        { id: 'large-vlm-on-cache-miss', label: 'Cache by hash, but run a large VLM on every cache miss' },
      ],
    },
  },
  'image-synthesis': {
    tradeoff: {
      challengeId: 'image-synthesis',
      title: 'Sampling strategy for the interactive image generator',
      prompt: 'Your text-to-image diffusion product lets users iterate on prompts in real time, then export a final hero image. How should you run the denoising/sampling pipeline?',
      constraint: 'GPU cost and interactive latency are binding during iteration; users only need final-grade quality on the one image they keep, not on every draft.',
      options: [
        { id: 'full-steps-always', label: 'Run full 50-step denoising on the base model for every generation' },
        { id: 'fast-preview-then-refine', label: 'Distilled few-step model for instant previews, then full-quality refine only on the kept image' },
        { id: 'distilled-everywhere', label: 'Use a distilled / few-step model for everything, including the final export' },
        { id: 'fewer-steps-base', label: 'Keep the base model but cut to ~15 steps for all generations' },
      ],
    },
  },
  'ml-duplicate-detection': {
    tradeoff: {
      challengeId: 'ml-duplicate-detection',
      title: 'Near-duplicate detection across billions of items',
      prompt: 'You must find near-duplicate items in a corpus of billions. Which approach should anchor the matching strategy?',
      constraint: 'Billions of items — the method must scale sub-linearly, and a slight loss of recall is acceptable.',
      options: [
        { id: 'lsh', label: 'Locality-sensitive hashing (LSH) into candidate buckets' },
        { id: 'ann-embeddings', label: 'Approximate nearest neighbor (ANN) over learned embeddings' },
        { id: 'exact-pairwise', label: 'Exact pairwise comparison of every item pair' },
        { id: 'single-key-blocking', label: 'Block/sort on one exact key and compare only within blocks' },
      ],
    },
  },
  'rag-system': {
    tradeoff: {
      challengeId: 'rag-system',
      title: 'Retrieval strategy for the RAG system',
      prompt: 'Your RAG system answers questions where queries mix natural-language intent ("how do I reset a locked account") with exact tokens like product codes and proper names ("error E-4471", "Dr. Okafor"). Which retrieval approach should back the index?',
      constraint: 'Answers must stay relevant for BOTH semantic paraphrase queries AND exact-keyword lookups (names, codes), within a tight latency budget.',
      options: [
        { id: 'dense-only', label: 'Dense vector (embedding) search only' },
        { id: 'bm25-only', label: 'Keyword/BM25 search only' },
        { id: 'hybrid-fused', label: 'Hybrid: dense + BM25, scores fused (e.g. RRF)' },
        { id: 'dense-rerank', label: 'Dense retrieval + cross-encoder reranker' },
      ],
    },
    capacity: {
      challengeId: 'rag-token-budget',
      title: 'RAG token & cost budget',
      prompt: 'Each query retrieves the top 5 chunks (~500 tokens each), plus a ~500-token system prompt, a ~100-token question, and a ~500-token answer. LLM cost is $5 per 1M tokens. Estimate the budget.',
      fields: [
        { key: 'tokensPerQuery', label: 'Total tokens per query', unit: 'tokens', placeholder: 'e.g. 3600' },
        { key: 'costPer1k', label: 'Cost per 1,000 queries', unit: 'USD', placeholder: 'e.g. 18' },
      ],
    },
  },
  'recommendation-system': {
    tradeoff: {
      challengeId: 'recommendation-system',
      title: 'Architecture for the recommendation engine',
      prompt: 'You recommend items from a catalog of millions to tens of millions of users. New users and items arrive constantly, the catalog turns over quickly, and recommendations must render in the page hot path. Which architecture do you build?',
      constraint: 'Must handle cold-start (new users and new items) and stay fresh, all at low serving latency.',
      options: [
        { id: 'matrix-factorization-cf', label: 'Pure collaborative filtering (matrix factorization on the user-item matrix)' },
        { id: 'content-based-only', label: 'Pure content-based filtering (recommend items similar to past engagement)' },
        { id: 'hybrid-two-stage', label: 'Hybrid two-stage: candidate generation (CF + content/ANN) then a feature-rich ranker' },
        { id: 'single-stage-deep-ranker', label: 'Single-stage deep model scoring the full catalog per request' },
      ],
    },
  },
  'search-ranking': {
    tradeoff: {
      challengeId: 'search-ranking',
      title: 'Ranking architecture for sub-200ms personalized search',
      prompt: "You're ranking results from a huge document index. Each query must return personalized, relevant results. How do you architect the ranking pipeline?",
      constraint: 'Sub-200ms end-to-end latency while delivering personalization and relevance over a huge index.',
      options: [
        { id: 'two-stage-rerank', label: 'Two-stage: cheap retrieval narrows to top-K, then ML re-ranks the top-K' },
        { id: 'online-ltr-full-index', label: 'Online learning-to-rank: score every document with the ML model per query' },
        { id: 'static-precompute', label: 'Precompute a single static ranking offline and serve it' },
        { id: 'static-plus-light-personalization', label: 'Static base ranking plus a lightweight per-query personalization re-rank' },
      ],
    },
  },
  'text-to-image': {
    tradeoff: {
      challengeId: 'text-to-image',
      title: 'Serving strategy for the text-to-image product',
      prompt: 'Your text-to-image product serves a large free tier plus a smaller paid tier on expensive GPUs. Generation is the dominant cost, and free users vastly outnumber paid ones. How do you allocate model capacity across tiers?',
      constraint: 'GPU cost at scale is the binding limit; free users dominate volume, and paid users are the ones who actually need top output quality.',
      options: [
        { id: 'model-tiering', label: 'Model tiering: a fast/cheap model for the free tier, a high-quality model for paid' },
        { id: 'fixed-high-quality', label: 'Fixed high-quality model for everyone, free and paid alike' },
        { id: 'one-model-for-all', label: 'A single mid-tier model for all users' },
        { id: 'quality-with-quotas', label: 'High-quality model for all, but cap free users with tight daily quotas' },
      ],
    },
  },
  'text-to-video': {
    tradeoff: {
      challengeId: 'text-to-video',
      title: 'Generation pattern for the text-to-video service',
      prompt: 'Users submit a prompt and get back a short generated video. Each render takes minutes of GPU time. Which generation pattern should the service use?',
      constraint: 'Video generation is extremely compute-heavy (minutes of GPU per render); cost control is paramount.',
      options: [
        { id: 'async-queue', label: 'Async job queue: enqueue, run on a GPU worker pool, notify the user when ready' },
        { id: 'progressive', label: 'Progressive: stream a fast low-res preview, then render the full-quality video' },
        { id: 'synchronous', label: 'Synchronous generation: hold the request open until the video finishes rendering' },
        { id: 'prewarm-pool', label: 'Keep a large pool of pre-warmed GPUs serving requests synchronously for low latency' },
      ],
    },
  },
};

/** Slugs that have a design challenge wired in-page (used to mark those lessons mastery-gated). */
export const DESIGN_CHALLENGE_SLUGS = new Set([
  'url-shortener',
  'chat-system',
  'news-feed',
  'notification-system',
  'payment-system',
  'ride-sharing',
  'video-streaming',
  'search-engine',
  'distributed-cache',
]);

/** A practice problem is graded if it has any challenge (design in-page, or trade-off/capacity here). */
export function isGradedPractice(slug: string): boolean {
  return DESIGN_CHALLENGE_SLUGS.has(slug) || slug in PRACTICE_CHALLENGES;
}
