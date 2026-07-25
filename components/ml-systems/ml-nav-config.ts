export interface MLNavigationItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  description: string;
  status: 'available' | 'coming-soon' | 'in-progress';
  prerequisites?: string[];
}

// ML Fundamentals - Core Learning Path
export const ML_FUNDAMENTALS: MLNavigationItem[] = [
  {
    id: 'ml-fundamentals',
    title: 'ML vs Traditional Systems',
    slug: 'ml-fundamentals',
    category: 'Foundation',
    difficulty: 'beginner',
    estimatedTime: '20 min',
    description: 'Why ML systems are different and harder to build',
    status: 'available'
  },
  {
    id: 'data-pipeline-design',
    title: 'Data Pipeline Architecture',
    slug: 'data-pipeline-design',
    category: 'Foundation',
    difficulty: 'beginner',
    estimatedTime: '30 min',
    description: 'ETL/ELT, streaming, batch processing for ML',
    status: 'available'
  },
  {
    id: 'feature-engineering',
    title: 'Feature Store Systems',
    slug: 'feature-engineering',
    category: 'Foundation',
    difficulty: 'intermediate',
    estimatedTime: '25 min',
    description: 'Feature pipelines, storage, and serving consistency',
    status: 'available',
    prerequisites: ['data-pipeline-design']
  },
  {
    id: 'model-training-infra',
    title: 'Training Infrastructure',
    slug: 'model-training-infra',
    category: 'Foundation',
    difficulty: 'intermediate',
    estimatedTime: '35 min',
    description: 'Distributed training, resource management, experiment tracking',
    status: 'coming-soon',
    prerequisites: ['feature-engineering']
  },
  {
    id: 'model-serving',
    title: 'Model Serving Patterns',
    slug: 'model-serving',
    category: 'Foundation',
    difficulty: 'intermediate',
    estimatedTime: '30 min',
    description: 'Batch, real-time, edge deployment strategies',
    status: 'coming-soon',
    prerequisites: ['model-training-infra']
  },
  {
    id: 'monitoring-observability',
    title: 'ML Monitoring & Observability',
    slug: 'monitoring-observability',
    category: 'Foundation',
    difficulty: 'advanced',
    estimatedTime: '40 min',
    description: 'Model drift, data quality, performance tracking',
    status: 'coming-soon',
    prerequisites: ['model-serving']
  }
];

// ML Reference - Quick Decision Guides
export const ML_REFERENCE: MLNavigationItem[] = [
  {
    id: 'ml-latencies',
    title: 'ML Latencies Reference',
    slug: 'ml-latencies',
    category: 'Performance',
    difficulty: 'beginner',
    estimatedTime: '15 min',
    description: 'Training, inference, and data processing latencies',
    status: 'coming-soon'
  },
  {
    id: 'ml-data-sizes',
    title: 'ML Data Sizes Reference', 
    slug: 'ml-data-sizes',
    category: 'Performance',
    difficulty: 'beginner',
    estimatedTime: '15 min',
    description: 'Model sizes, feature sizes, dataset requirements',
    status: 'coming-soon'
  },
  {
    id: 'feature-store-patterns',
    title: 'Feature Store Patterns',
    slug: 'feature-store-patterns',
    category: 'Architecture',
    difficulty: 'intermediate',
    estimatedTime: '20 min',
    description: 'Online vs offline stores, consistency, performance trade-offs',
    status: 'coming-soon'
  },
  {
    id: 'model-serving-architectures',
    title: 'Model Serving Architectures',
    slug: 'model-serving-architectures',
    category: 'Architecture',
    difficulty: 'intermediate',
    estimatedTime: '20 min',
    description: 'Synchronous, asynchronous, batch serving patterns',
    status: 'coming-soon'
  },
  {
    id: 'mlops-toolchain-comparison',
    title: 'MLOps Toolchain Comparison',
    slug: 'mlops-toolchain-comparison',
    category: 'Tools',
    difficulty: 'intermediate',
    estimatedTime: '25 min',
    description: 'Platform comparison matrix and decision guide',
    status: 'coming-soon'
  },
  {
    id: 'ml-cost-estimation',
    title: 'ML Cost Estimation',
    slug: 'ml-cost-estimation',
    category: 'Economics',
    difficulty: 'intermediate',
    estimatedTime: '20 min',
    description: 'Training, serving, storage cost breakdowns and optimization',
    status: 'coming-soon'
  }
];

// ML Technology - Deep Dives
export const ML_TECHNOLOGY: MLNavigationItem[] = [
  // ML Orchestration
  {
    id: 'airflow-ml',
    title: 'Apache Airflow for ML',
    slug: 'airflow-ml',
    category: 'Orchestration',
    difficulty: 'intermediate',
    estimatedTime: '30 min',
    description: 'DAG patterns, ML operators, workflow management',
    status: 'coming-soon'
  },
  {
    id: 'kubeflow',
    title: 'Kubeflow',
    slug: 'kubeflow',
    category: 'Orchestration',
    difficulty: 'advanced',
    estimatedTime: '40 min',
    description: 'End-to-end ML pipelines on Kubernetes',
    status: 'coming-soon'
  },
  {
    id: 'mlflow',
    title: 'MLflow',
    slug: 'mlflow',
    category: 'Orchestration',
    difficulty: 'intermediate',
    estimatedTime: '25 min',
    description: 'Experiment tracking, model registry, deployment',
    status: 'coming-soon'
  },
  // Feature Stores
  {
    id: 'feast',
    title: 'Feast Feature Store',
    slug: 'feast',
    category: 'Feature Store',
    difficulty: 'intermediate',
    estimatedTime: '30 min',
    description: 'Open-source feature store architecture and deployment',
    status: 'coming-soon'
  },
  {
    id: 'tecton',
    title: 'Tecton',
    slug: 'tecton',
    category: 'Feature Store',
    difficulty: 'advanced',
    estimatedTime: '35 min',
    description: 'Enterprise feature platform, real-time consistency',
    status: 'coming-soon'
  },
  {
    id: 'sagemaker-feature-store',
    title: 'AWS SageMaker Feature Store',
    slug: 'sagemaker-feature-store',
    category: 'Feature Store',
    difficulty: 'intermediate',
    estimatedTime: '25 min',
    description: 'Managed feature store service and integration patterns',
    status: 'coming-soon'
  },
  // Model Serving
  {
    id: 'tensorflow-serving',
    title: 'TensorFlow Serving',
    slug: 'tensorflow-serving',
    category: 'Model Serving',
    difficulty: 'intermediate',
    estimatedTime: '30 min',
    description: 'High-performance model serving and optimization',
    status: 'coming-soon'
  },
  {
    id: 'seldon-core',
    title: 'Seldon Core',
    slug: 'seldon-core',
    category: 'Model Serving',
    difficulty: 'advanced',
    estimatedTime: '35 min',
    description: 'Kubernetes-native ML deployment platform',
    status: 'coming-soon'
  },
  {
    id: 'kserve',
    title: 'KServe',
    slug: 'kserve',
    category: 'Model Serving',
    difficulty: 'advanced',
    estimatedTime: '30 min',
    description: 'Serverless ML inference on Kubernetes',
    status: 'coming-soon'
  },
  // Specialized Infrastructure
  {
    id: 'vector-databases',
    title: 'Vector Databases',
    slug: 'vector-databases',
    category: 'Storage',
    difficulty: 'intermediate',
    estimatedTime: '25 min',
    description: 'Pinecone, Weaviate, Chroma for embedding storage',
    status: 'coming-soon'
  },
  {
    id: 'ray',
    title: 'Ray',
    slug: 'ray',
    category: 'Distributed Computing',
    difficulty: 'advanced',
    estimatedTime: '40 min',
    description: 'Distributed ML training and serving framework',
    status: 'coming-soon'
  },
  {
    id: 'ml-monitoring-tools',
    title: 'ML Monitoring Tools',
    slug: 'ml-monitoring-tools',
    category: 'Monitoring',
    difficulty: 'intermediate',
    estimatedTime: '30 min',
    description: 'Evidently AI, WhyLabs, Arize for production monitoring',
    status: 'coming-soon'
  }
];

// ML Practice - Hands-on Challenges
export const ML_PRACTICE: MLNavigationItem[] = [
  {
    id: 'recommendation-system',
    title: 'Design Recommendation System',
    slug: 'recommendation-system',
    category: 'System Design',
    difficulty: 'advanced',
    estimatedTime: '90 min',
    description: 'Netflix-style recommendation system for 100M users',
    status: 'coming-soon'
  },
  {
    id: 'fraud-detection',
    title: 'Real-time Fraud Detection',
    slug: 'fraud-detection',
    category: 'System Design',
    difficulty: 'advanced',
    estimatedTime: '90 min',
    description: 'Credit card fraud detection with <50ms latency',
    status: 'coming-soon'
  },
  {
    id: 'computer-vision-pipeline',
    title: 'Scale Computer Vision Pipeline',
    slug: 'computer-vision-pipeline',
    category: 'System Design',
    difficulty: 'advanced',
    estimatedTime: '90 min',
    description: 'Process 1B images daily for content moderation',
    status: 'coming-soon'
  },
  {
    id: 'search-ranking',
    title: 'Search Ranking System',
    slug: 'search-ranking',
    category: 'System Design',
    difficulty: 'advanced',
    estimatedTime: '90 min',
    description: 'E-commerce search with personalized ranking',
    status: 'coming-soon'
  },
  {
    id: 'ml-platform-design',
    title: 'ML Platform Architecture',
    slug: 'ml-platform-design',
    category: 'Platform Design',
    difficulty: 'advanced',
    estimatedTime: '120 min',
    description: 'Design ML platform for 50-person data science team',
    status: 'coming-soon'
  }
];

// Combined navigation for easy access
export const ML_NAVIGATION = {
  fundamentals: ML_FUNDAMENTALS,
  reference: ML_REFERENCE,
  technology: ML_TECHNOLOGY,
  practice: ML_PRACTICE
};

// Helper functions
export function getMLTopicById(id: string): MLNavigationItem | undefined {
  const allTopics = [
    ...ML_FUNDAMENTALS,
    ...ML_REFERENCE,
    ...ML_TECHNOLOGY,
    ...ML_PRACTICE
  ];
  return allTopics.find(topic => topic.id === id);
}

export function getMLTopicsByCategory(category: string): MLNavigationItem[] {
  const allTopics = [
    ...ML_FUNDAMENTALS,
    ...ML_REFERENCE,
    ...ML_TECHNOLOGY,
    ...ML_PRACTICE
  ];
  return allTopics.filter(topic => topic.category === category);
}

export function getMLTopicsByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): MLNavigationItem[] {
  const allTopics = [
    ...ML_FUNDAMENTALS,
    ...ML_REFERENCE,
    ...ML_TECHNOLOGY,
    ...ML_PRACTICE
  ];
  return allTopics.filter(topic => topic.difficulty === difficulty);
}