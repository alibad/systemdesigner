// Interview session data models and utilities

export interface InterviewPrompt {
  id: string;
  title: string;
  description: string;
  duration: number; // minutes
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: 'Design' | 'Scale' | 'Architecture' | 'Data';
  prompt: string;
  starter: string[];
  expectations: string[];
  keyComponents: string[];
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  weight: number; // percentage
  maxScore: number;
}

export interface InterviewRubric {
  criteria: RubricCriterion[];
  totalScore: number;
}

export interface SessionScore {
  criterionId: string;
  score: number;
  feedback: string;
}

export interface InterviewSession {
  id: string;
  promptId: string;
  startTime: string;
  endTime?: string;
  duration: number; // actual minutes spent
  status: 'in_progress' | 'completed' | 'abandoned';
  notes: string;
  scores?: SessionScore[];
  totalScore?: number;
  percentageScore?: number;
  createdAt: string;
}

// Default rubric for system design interviews
export const DEFAULT_RUBRIC: InterviewRubric = {
  criteria: [
    {
      id: 'requirements',
      name: 'Requirements Gathering',
      description: 'Clarified functional and non-functional requirements, asked relevant questions',
      weight: 15,
      maxScore: 10
    },
    {
      id: 'capacity',
      name: 'Capacity Estimation',
      description: 'Performed realistic capacity planning and load calculations',
      weight: 10,
      maxScore: 10
    },
    {
      id: 'high_level',
      name: 'High-Level Design',
      description: 'Created clear architectural overview with key components',
      weight: 25,
      maxScore: 10
    },
    {
      id: 'detailed_design',
      name: 'Detailed Design',
      description: 'Deep-dived into critical components with proper interfaces',
      weight: 20,
      maxScore: 10
    },
    {
      id: 'scaling',
      name: 'Scaling & Performance',
      description: 'Addressed bottlenecks, scaling strategies, and performance optimizations',
      weight: 15,
      maxScore: 10
    },
    {
      id: 'reliability',
      name: 'Reliability & Availability',
      description: 'Considered failure scenarios, redundancy, and monitoring',
      weight: 10,
      maxScore: 10
    },
    {
      id: 'communication',
      name: 'Communication',
      description: 'Clear explanations, good trade-off discussions, responsive to feedback',
      weight: 5,
      maxScore: 10
    }
  ],
  totalScore: 70 // 7 criteria * 10 max score each
};

// Extended prompt list with more variety
export const INTERVIEW_PROMPTS: InterviewPrompt[] = [
  {
    id: 'url-shortener',
    title: 'URL Shortener Service',
    description: 'Design a service like bit.ly that creates short URLs and handles redirects',
    duration: 45,
    difficulty: 'Easy',
    category: 'Design',
    prompt: 'Design a service that creates short URLs and redirects to original URLs. Consider API design, storage, ID generation, TTL, analytics, and scaling to handle millions of requests.',
    starter: ['user', 'api', 'server', 'database', 'cache'],
    expectations: [
      'API design for creating and resolving short URLs',
      'Base62 encoding for short URL generation',
      'Database schema for URL mappings',
      'Caching strategy for popular URLs',
      'Analytics and metrics collection'
    ],
    keyComponents: ['Load Balancer', 'API Gateway', 'URL Service', 'Database', 'Cache', 'Analytics']
  },
  {
    id: 'chat-system',
    title: 'Real-time Chat System',
    description: 'Build a messaging system supporting 1:1 and group conversations',
    duration: 60,
    difficulty: 'Medium',
    category: 'Design',
    prompt: 'Build a real-time messaging system supporting 1:1 and group chats with presence indicators, delivery guarantees, and offline notifications. Handle millions of users.',
    starter: ['user', 'api', 'websocket', 'queue', 'database'],
    expectations: [
      'WebSocket connections for real-time messaging',
      'Message delivery guarantees and ordering',
      'Presence and online status management',
      'Push notifications for offline users',
      'Group chat scaling and permissions'
    ],
    keyComponents: ['WebSocket Gateway', 'Message Queue', 'Chat Service', 'User Service', 'Notification Service', 'Database']
  },
  {
    id: 'news-feed',
    title: 'Social Media News Feed',
    description: 'Design a personalized feed system like Facebook or Twitter',
    duration: 60,
    difficulty: 'Hard',
    category: 'Scale',
    prompt: 'Design a personalized news feed system with fan-out strategies, content ranking algorithms, and real-time updates. Support billions of posts and users.',
    starter: ['user', 'api', 'server', 'cache', 'database'],
    expectations: [
      'Fan-out strategies (push vs pull vs hybrid)',
      'Content ranking and personalization algorithms',
      'Timeline generation and pagination',
      'Real-time feed updates',
      'Handling celebrity users and hot content'
    ],
    keyComponents: ['Feed Service', 'Fan-out Service', 'Ranking Service', 'Content Store', 'Cache Layer', 'ML Pipeline']
  },
  {
    id: 'video-streaming',
    title: 'Video Streaming Platform',
    description: 'Design a video platform like YouTube or Netflix',
    duration: 60,
    difficulty: 'Hard',
    category: 'Scale',
    prompt: 'Design a video streaming platform that supports video upload, processing, storage, and streaming to millions of users globally with different quality options.',
    starter: ['user', 'cdn', 'api', 'storage', 'processing'],
    expectations: [
      'Video upload and processing pipeline',
      'Multiple quality encoding and adaptive bitrate',
      'Global CDN distribution strategy',
      'Metadata and search functionality',
      'View counting and analytics'
    ],
    keyComponents: ['Upload Service', 'Video Processor', 'CDN', 'Metadata Service', 'Search Service', 'Analytics']
  },
  {
    id: 'distributed-cache',
    title: 'Distributed Cache System',
    description: 'Build a distributed caching system like Redis Cluster',
    duration: 45,
    difficulty: 'Medium',
    category: 'Architecture',
    prompt: 'Design a distributed cache system that provides high availability, consistency, and performance. Handle cache eviction, replication, and failover.',
    starter: ['client', 'cache-node', 'cluster', 'coordinator'],
    expectations: [
      'Consistent hashing for data distribution',
      'Replication and failover mechanisms',
      'Cache eviction policies',
      'Conflict resolution and consistency models',
      'Monitoring and health checks'
    ],
    keyComponents: ['Cache Nodes', 'Cluster Coordinator', 'Hash Ring', 'Replication Manager', 'Health Monitor']
  },
  {
    id: 'search-engine',
    title: 'Web Search Engine',
    description: 'Design a search engine that crawls and indexes the web',
    duration: 60,
    difficulty: 'Hard',
    category: 'Data',
    prompt: 'Design a web search engine that crawls billions of pages, builds indexes, and returns relevant results quickly. Include ranking algorithms and real-time updates.',
    starter: ['crawler', 'index', 'ranking', 'api', 'storage'],
    expectations: [
      'Web crawling strategy and politeness',
      'Inverted index construction and storage',
      'PageRank and relevance scoring',
      'Query processing and optimization',
      'Real-time index updates'
    ],
    keyComponents: ['Web Crawler', 'Index Builder', 'Query Processor', 'Ranking Service', 'Document Store']
  }
];

// Session storage utilities
export class InterviewSessionStorage {
  private static STORAGE_KEY = 'interview_sessions';

  static getAllSessions(): InterviewSession[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading interview sessions:', error);
      return [];
    }
  }

  static getSession(id: string): InterviewSession | null {
    const sessions = this.getAllSessions();
    return sessions.find(session => session.id === id) || null;
  }

  static saveSession(session: InterviewSession): void {
    try {
      const sessions = this.getAllSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving interview session:', error);
      throw error;
    }
  }

  static deleteSession(id: string): void {
    try {
      const sessions = this.getAllSessions();
      const filtered = sessions.filter(session => session.id !== id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting interview session:', error);
      throw error;
    }
  }

  static getSessionsByPrompt(promptId: string): InterviewSession[] {
    return this.getAllSessions().filter(session => session.promptId === promptId);
  }

  static getCompletedSessions(): InterviewSession[] {
    return this.getAllSessions().filter(session => session.status === 'completed');
  }
}

// Utility functions
export function calculateSessionScore(scores: SessionScore[]): { total: number; percentage: number } {
  if (!scores.length) return { total: 0, percentage: 0 };

  let totalWeightedScore = 0;
  let totalMaxWeightedScore = 0;

  scores.forEach(score => {
    const criterion = DEFAULT_RUBRIC.criteria.find(c => c.id === score.criterionId);
    if (criterion) {
      const weightedScore = score.score * (criterion.weight / 100);
      const maxWeightedScore = criterion.maxScore * (criterion.weight / 100);
      totalWeightedScore += weightedScore;
      totalMaxWeightedScore += maxWeightedScore;
    }
  });

  const percentage = totalMaxWeightedScore > 0 ? (totalWeightedScore / totalMaxWeightedScore) * 100 : 0;

  return {
    total: Math.round(totalWeightedScore * 10) / 10, // Round to 1 decimal
    percentage: Math.round(percentage)
  };
}

export function getSessionPerformanceLevel(percentage: number): { level: string; color: string; description: string } {
  if (percentage >= 90) {
    return {
      level: 'Excellent',
      color: 'text-green-600 dark:text-green-400',
      description: 'Outstanding performance, ready for senior roles'
    };
  } else if (percentage >= 75) {
    return {
      level: 'Good',
      color: 'text-blue-600 dark:text-blue-400',
      description: 'Solid performance, minor improvements needed'
    };
  } else if (percentage >= 60) {
    return {
      level: 'Average',
      color: 'text-yellow-600 dark:text-yellow-400',
      description: 'Meets basic expectations, room for improvement'
    };
  } else {
    return {
      level: 'Needs Work',
      color: 'text-red-600 dark:text-red-400',
      description: 'Significant improvement required'
    };
  }
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}