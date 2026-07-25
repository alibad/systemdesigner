export type Prompt = { id: string; title: string; duration: number; prompt: string; starter: string[] };

export const PROMPTS: Prompt[] = [
  {
    id: 'url-shortener',
    title: 'Design a URL Shortener',
    duration: 45,
    prompt: 'Design a service that creates short URLs and redirects to original URLs. Cover API, storage, ID generation, TTL, analytics, and scale.',
    starter: ['user', 'api', 'server', 'database', 'cache']
  },
  {
    id: 'chat-system',
    title: 'Design a Chat System',
    duration: 60,
    prompt: 'Build a real-time messaging system (1:1 + groups) with presence, delivery guarantees, and offline notifications.',
    starter: ['user', 'api', 'queue', 'server', 'database']
  },
  {
    id: 'news-feed',
    title: 'Design a News Feed',
    duration: 60,
    prompt: 'Design a personalized news feed with fan-out strategies, ranking, caching, and pagination.',
    starter: ['user', 'api', 'server', 'cache', 'database']
  }
];
