/**
 * Server-only rubric registry. Rubrics hold answer bands / expected topology and
 * must NEVER be imported into a client component — only /api/grade reads them, so
 * the answer key is never shipped to the browser. Register each new rubric here.
 */
import type { Rubric } from '@/lib/challenges/types';
import urlShortener from './url-shortener.json';
import likeCounterConsistency from './consistency-like-counter.json';
import chatSystem from './chat-system.json';
import newsFeed from './news-feed.json';
import notificationSystem from './notification-system.json';
import paymentSystem from './payment-system.json';
import rideSharing from './ride-sharing.json';
import videoStreaming from './video-streaming.json';
import searchEngine from './search-engine.json';
import distributedCache from './distributed-cache.json';
import adTargeting from './ad-targeting.json';
import aiCodeAssistant from './ai-code-assistant.json';
import computerVision from './computer-vision.json';
import contentModeration from './content-moderation.json';
import conversationalAi from './conversational-ai.json';
import datasetDiversityDashboard from './dataset-diversity-dashboard.json';
import faceGeneration from './face-generation.json';
import featureStore from './feature-store.json';
import fraudDetection from './fraud-detection.json';
import gmailSmartCompose from './gmail-smart-compose.json';
import googleTranslate from './google-translate.json';
import headshotGeneration from './headshot-generation.json';
import imageCaptioning from './image-captioning.json';
import imageSynthesis from './image-synthesis.json';
import mlDuplicateDetection from './ml-duplicate-detection.json';
import ragSystem from './rag-system.json';
import recommendationSystem from './recommendation-system.json';
import searchRanking from './search-ranking.json';
import textToImage from './text-to-image.json';
import textToVideo from './text-to-video.json';
import ragTokenBudget from './rag-token-budget.json';

const RUBRICS: Record<string, Rubric> = {
  'url-shortener': urlShortener as unknown as Rubric,
  'consistency-like-counter': likeCounterConsistency as unknown as Rubric,
  'chat-system': chatSystem as unknown as Rubric,
  'news-feed': newsFeed as unknown as Rubric,
  'notification-system': notificationSystem as unknown as Rubric,
  'payment-system': paymentSystem as unknown as Rubric,
  'ride-sharing': rideSharing as unknown as Rubric,
  'video-streaming': videoStreaming as unknown as Rubric,
  'search-engine': searchEngine as unknown as Rubric,
  'distributed-cache': distributedCache as unknown as Rubric,
  'ad-targeting': adTargeting as unknown as Rubric,
  'ai-code-assistant': aiCodeAssistant as unknown as Rubric,
  'computer-vision': computerVision as unknown as Rubric,
  'content-moderation': contentModeration as unknown as Rubric,
  'conversational-ai': conversationalAi as unknown as Rubric,
  'dataset-diversity-dashboard': datasetDiversityDashboard as unknown as Rubric,
  'face-generation': faceGeneration as unknown as Rubric,
  'feature-store': featureStore as unknown as Rubric,
  'fraud-detection': fraudDetection as unknown as Rubric,
  'gmail-smart-compose': gmailSmartCompose as unknown as Rubric,
  'google-translate': googleTranslate as unknown as Rubric,
  'headshot-generation': headshotGeneration as unknown as Rubric,
  'image-captioning': imageCaptioning as unknown as Rubric,
  'image-synthesis': imageSynthesis as unknown as Rubric,
  'ml-duplicate-detection': mlDuplicateDetection as unknown as Rubric,
  'rag-system': ragSystem as unknown as Rubric,
  'recommendation-system': recommendationSystem as unknown as Rubric,
  'search-ranking': searchRanking as unknown as Rubric,
  'text-to-image': textToImage as unknown as Rubric,
  'text-to-video': textToVideo as unknown as Rubric,
  'rag-token-budget': ragTokenBudget as unknown as Rubric,
};

export function getRubric(challengeId: string): Rubric | undefined {
  return RUBRICS[challengeId];
}

/** Public, client-safe view of a rubric: prompt + palette only, no answers. */
export function getChallengePrompt(challengeId: string): {
  challengeId: string;
  kind: Rubric['kind'];
  title: string;
  prompt: string;
  palette?: Rubric['palette'];
} | undefined {
  const r = RUBRICS[challengeId];
  if (!r) return undefined;
  return { challengeId: r.challengeId, kind: r.kind, title: r.title, prompt: r.prompt, palette: r.palette };
}

export function listRubricIds(): string[] {
  return Object.keys(RUBRICS);
}
