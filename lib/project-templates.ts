// Project Templates - Predefined structures for different types of projects

import {
  ProjectTemplateDefinition,
  PageTemplateDefinition,
  SectionTemplateDefinition,
  ProjectTemplate,
  SectionType
} from './project-data-model';

// System Design Template - Following Alex Xu's 4-Step Interview Framework
export const systemDesignTemplate: ProjectTemplateDefinition = {
  id: 'system_design',
  name: 'System Design',
  description: 'Traditional distributed systems design following Alex Xu\'s 4-step interview framework',
  version: '3.0.0',
  pages: [
    {
      id: 'requirements',
      title: 'Understand Problem & Requirements',
      description: 'Step 1: Clarify requirements and establish design scope (3-10 min)',
      order: 1,
      sections: [
        {
          id: 'project_description',
          title: 'Project Description',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: 'Describe what this system does, its main purpose, and who it\'s for.\n\nExample: A real-time collaborative document editor that allows teams to work together seamlessly with rich media support and version control.',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'key_features',
          title: 'Key Features',
          type: 'bullet-list',
          order: 2,
          defaultContent: {
            type: 'bullet-list',
            items: {
              'feature': [
                {
                  id: '1',
                  title: 'User registration and authentication',
                  type: 'feature',
                  order: 0
                },
                {
                  id: '2',
                  title: 'Real-time updates and notifications',
                  type: 'feature',
                  order: 1
                },
                {
                  id: '3',
                  title: 'Search and filtering capabilities',
                  type: 'feature',
                  order: 2
                }
              ]
            },
            settings: {
              sectionTitle: 'Key Features',
              sectionDescription: 'List the main features your system needs to support',
              typeOptions: [
                {
                  key: 'feature',
                  label: 'Feature',
                  color: 'blue',
                  icon: '✨'
                }
              ],
              allowQuickAdd: true,
              showDescriptions: false
            }
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'business_goals',
          title: 'Business Goals',
          type: 'text-editor',
          order: 3,
          defaultContent: {
            type: 'text-editor',
            markdown: 'What business problems does this solve? What success metrics matter?\n\nExample: Increase team productivity by 30%, reduce email overhead by 50%, enable async collaboration across time zones.',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: false
        },
        {
          id: 'constraints_requirements',
          title: 'Constraints & Requirements',
          type: 'text-editor',
          order: 4,
          defaultContent: {
            type: 'text-editor',
            markdown: 'Any technical constraints, compliance requirements, or specific performance needs?\n\nExample: Must comply with GDPR, support 10k concurrent users, <100ms latency for real-time updates.',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: false
        },
        {
          id: 'inspiration',
          title: 'Inspiration (Optional)',
          type: 'text-editor',
          order: 5,
          defaultContent: {
            type: 'text-editor',
            markdown: 'Similar systems or companies that inspire this project.\n\nExample: Notion for UX, Figma for real-time collaboration, Slack for notifications.',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: false
        },
        {
          id: 'functional_requirements',
          title: 'Functional Requirements',
          type: 'bullet-list',
          order: 6,
          defaultContent: {
            type: 'bullet-list',
            items: {
              'feature': [
                {
                  id: '1',
                  title: 'Users can create, read, update, delete posts',
                  type: 'feature',
                  order: 0
                },
                {
                  id: '2',
                  title: 'Users can follow other users',
                  type: 'feature',
                  order: 1
                },
                {
                  id: '3',
                  title: 'News feed shows posts from followed users',
                  type: 'feature',
                  order: 2
                }
              ]
            },
            settings: {
              sectionTitle: 'Functional Requirements',
              sectionDescription: 'What features must the system support?',
              typeOptions: [
                {
                  key: 'feature',
                  label: 'Feature',
                  color: 'blue',
                  icon: '✨'
                }
              ],
              allowQuickAdd: true,
              showDescriptions: false
            }
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'non_functional_requirements',
          title: 'Non-Functional Requirements',
          type: 'text-editor',
          order: 7,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Scale\n- **DAU**: 10 million daily active users\n- **MAU**: 50 million monthly active users\n- **Peak QPS**: 10,000 requests/second\n- **Growth**: 20% year-over-year\n\n## Performance\n- **Read Latency**: < 100ms p99\n- **Write Latency**: < 200ms p99\n- **Availability**: 99.9% uptime (8.76 hours downtime/year)\n\n## Consistency\n- **Reads**: Eventual consistency acceptable\n- **Writes**: Strong consistency for critical operations\n- **Data**: No data loss tolerance\n\n## Other\n- **Compliance**: GDPR, SOC 2\n- **Regions**: Global (US, EU, APAC)\n- **Mobile + Web**: Support both platforms',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'high-level-design',
      title: 'High-Level Design & Buy-in',
      description: 'Step 2: Architecture diagram, API design, data model, and calculations (10-15 min)',
      order: 2,
      sections: [
        {
          id: 'api_design',
          title: 'API Design',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## REST API Endpoints\n\n### User Management\n```\nPOST   /api/v1/users          # Create user\nGET    /api/v1/users/{id}     # Get user profile\nPUT    /api/v1/users/{id}     # Update user\nDELETE /api/v1/users/{id}     # Delete user\n```\n\n### Posts\n```\nPOST   /api/v1/posts          # Create post\nGET    /api/v1/posts/{id}     # Get post\nPUT    /api/v1/posts/{id}     # Update post\nDELETE /api/v1/posts/{id}     # Delete post\nGET    /api/v1/feed           # Get user feed\n```\n\n### Social\n```\nPOST   /api/v1/follow         # Follow user\nDELETE /api/v1/follow/{id}    # Unfollow user\nGET    /api/v1/followers      # Get followers\n```\n\n## Example Request/Response\n\n### Create Post\n**Request:**\n```json\nPOST /api/v1/posts\n{\n  "user_id": "user123",\n  "content": "Hello world!",\n  "media": ["image1.jpg"]\n}\n```\n\n**Response:**\n```json\n{\n  "post_id": "post456",\n  "created_at": "2025-01-15T10:30:00Z",\n  "status": "published"\n}\n```\n\n## Authentication\n- **Method**: JWT tokens\n- **Header**: `Authorization: Bearer <token>`\n- **Refresh**: 7-day refresh tokens',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'calculations',
          title: 'Back-of-Envelope Calculations',
          type: 'calculations',
          order: 1,
          defaultContent: {
            type: 'calculations',
            calculations: [
              {
                id: '1',
                title: 'Expected Traffic (QPS)',
                formula: 'Users × Requests/Day ÷ 86400',
                variables: { users: 1000000, requestsPerDay: 10 },
                result: 115,
                unit: 'QPS average',
                notes: '1M users × 10 requests/day = 10M requests/day ÷ 86400 seconds = ~115 QPS average'
              },
              {
                id: '2',
                title: 'Storage Needed',
                formula: 'Users × Data/User',
                variables: { users: 1000000, dataPerUserMB: 100 },
                result: 100,
                unit: 'TB',
                notes: '1M users × 100 MB per user = 100 TB total storage'
              },
              {
                id: '3',
                title: 'Bandwidth Required',
                formula: 'QPS × Avg Response Size',
                variables: { qps: 115, avgResponseKB: 50 },
                result: 5.75,
                unit: 'MB/s',
                notes: '115 QPS × 50 KB response = 5.75 MB/s bandwidth'
              },
              {
                id: '4',
                title: 'Servers Needed',
                formula: 'QPS ÷ QPS/Server',
                variables: { qps: 115, qpsPerServer: 100 },
                result: 2,
                unit: 'servers',
                notes: '115 QPS ÷ 100 QPS/server = ~2 servers (add redundancy)'
              }
            ],
            assumptions: ['10 requests per user per day', '50 KB average response size', '100 QPS capacity per server'],
            references: []
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'architecture_diagram',
          title: 'Architecture Diagram',
          type: 'whiteboard',
          order: 3,
          defaultContent: {
            type: 'whiteboard',
            whiteboardId: '', // Will be set during project creation
            pageId: 'page:page' // Default TLDraw page ID
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', height: 'fixed', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'data_model',
          title: 'Data Model (High-Level)',
          type: 'text-editor',
          order: 4,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Core Entities\n\n### Users\n- id (UUID)\n- email (string)\n- username (string)\n- created_at (timestamp)\n\n### Posts\n- id (UUID)\n- user_id (UUID, FK)\n- content (text)\n- media_urls (array)\n- created_at (timestamp)\n- updated_at (timestamp)\n\n### Follows\n- follower_id (UUID, FK)\n- followee_id (UUID, FK)\n- created_at (timestamp)\n\n## Relationships\n\n- Users → Posts (1:many)\n- Users → Follows (many:many self-join)\n- Users → Likes (many:many through likes table)',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'deep-dive',
      title: 'Design Deep Dive',
      description: 'Step 3: Dive deep into 1-2 critical components with trade-offs (10-25 min)',
      order: 3,
      sections: [
        {
          id: 'database_deep_dive',
          title: 'Database Design (Deep Dive)',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Database Choice: SQL vs NoSQL\n\n### PostgreSQL (Chosen)\n**Why:**\n- ✅ ACID compliance for transactions\n- ✅ Complex queries and joins\n- ✅ Proven at scale (Instagram, Uber)\n- ✅ JSON support for flexibility\n\n**Trade-offs:**\n- ❌ Vertical scaling limits\n- ❌ Sharding complexity\n\n### Cassandra (Alternative)\n**Why:**\n- ✅ Horizontal scaling\n- ✅ High write throughput\n- ❌ No joins, eventual consistency\n\n## Schema Design\n\n### Indexing Strategy\n```sql\n-- Primary indexes\nCREATE INDEX idx_posts_user_id ON posts(user_id);\nCREATE INDEX idx_posts_created_at ON posts(created_at DESC);\n\n-- Composite for feed queries\nCREATE INDEX idx_posts_user_created ON posts(user_id, created_at DESC);\n```\n\n### Sharding Strategy\n- **Shard Key**: user_id (keeps user data together)\n- **Shards**: 16 shards initially, plan for 64\n- **Replication**: 3 replicas per shard\n\n## Replication\n- **Master-Slave**: 1 write master, 3 read replicas\n- **Read/Write Split**: 95% reads → replicas, 5% writes → master\n- **Failover**: Automatic promotion with health checks',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'scaling_caching',
          title: 'Scaling & Caching Strategy',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Horizontal Scaling\n\n### Application Tier\n- **Stateless Servers**: Store session in Redis\n- **Load Balancer**: Round-robin with health checks\n- **Auto-scaling**: Scale on CPU > 70% for 5 min\n\n### Database Tier\n- **Read Replicas**: 3 replicas per master\n- **Connection Pooling**: pgBouncer (1000 connections)\n- **Query Optimization**: Explain analyze slow queries\n\n## Caching Strategy\n\n### Redis Architecture\n```\nCache-Aside Pattern:\n1. Check cache first\n2. If miss → query DB\n3. Write to cache (TTL: 1 hour)\n4. Return data\n```\n\n### What to Cache\n- **User profiles**: TTL 1 hour\n- **Hot posts**: TTL 5 minutes\n- **Feed data**: TTL 2 minutes\n- **Session data**: TTL 24 hours\n\n### Cache Invalidation\n- **Write-through**: Update cache on writes\n- **TTL-based**: Expire stale data\n- **Event-driven**: Invalidate on user actions',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'trade_offs',
          title: 'Trade-offs & Alternatives',
          type: 'text-editor',
          order: 3,
          defaultContent: {
            type: 'text-editor',
            markdown: '## CAP Theorem Trade-offs\n\n### Our Choice: CP (Consistency + Partition Tolerance)\n**Why:**\n- Financial transactions require consistency\n- Can sacrifice availability during network partitions\n\n**Alternative: AP (Availability + Partition Tolerance)**\n- Social media feeds (eventual consistency OK)\n- Higher availability during failures\n\n## Latency vs Throughput\n\n### Optimizing for Latency (< 100ms)\n- ✅ CDN for static assets\n- ✅ Redis caching\n- ✅ Connection pooling\n- ❌ Some throughput sacrificed\n\n### Optimizing for Throughput (> 10K QPS)\n- ✅ Async processing with queues\n- ✅ Batch operations\n- ❌ Higher latency for complex operations\n\n## Cost vs Performance\n\n### Current Design\n- **Cost**: $50K/month (moderate)\n- **Performance**: 100ms p99, 10K QPS\n\n### Budget Option (-60% cost)\n- Fewer read replicas (2 instead of 3)\n- Smaller cache (10GB instead of 50GB)\n- **Trade-off**: 200ms p99, 5K QPS\n\n### Premium Option (+100% cost)\n- More shards, more replicas\n- Larger cache, multi-region\n- **Benefit**: 50ms p99, 50K QPS, 99.99% uptime',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'wrap-up',
      title: 'Wrap Up',
      description: 'Step 4: Bottlenecks, error cases, monitoring, and future improvements (3-5 min)',
      order: 4,
      sections: [
        {
          id: 'bottlenecks',
          title: 'Bottlenecks & Scale Limits',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Current Bottlenecks\n\n### Database (Most Critical)\n- **Current Limit**: 10K QPS per shard\n- **At 10x scale**: Need 160 shards (from 16)\n- **Solution**: Implement sharding earlier, use Vitess\n\n### Cache Layer\n- **Current Limit**: 50GB Redis, 100K ops/sec\n- **At 10x scale**: Need Redis Cluster (500GB)\n- **Solution**: Partition cache by user_id ranges\n\n### Application Servers\n- **Current**: 20 servers @ 500 QPS each\n- **At 10x scale**: Need 200 servers\n- **Solution**: Already stateless, easy to scale horizontally\n\n## Single Points of Failure\n- **Load Balancer**: Use HAProxy in active-passive pair\n- **Master Database**: Automatic failover to replica\n- **Redis**: Redis Sentinel for HA\n- **Message Queue**: RabbitMQ cluster mode',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'error_cases',
          title: 'Error Cases & Failures',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Failure Scenarios\n\n### Database Failure\n- **Detection**: Health check every 5s\n- **Action**: Promote replica to master (30s)\n- **Fallback**: Serve cached data, queue writes\n\n### Cache Failure\n- **Detection**: Circuit breaker pattern\n- **Action**: Direct DB reads (slower but works)\n- **Impact**: Latency 100ms → 500ms\n\n### Network Partition\n- **Scenario**: Region A can\'t reach Region B\n- **Action**: Serve stale data, eventual consistency\n- **Recovery**: Sync when partition heals\n\n### Rate Limiting\n- **Per User**: 1000 requests/hour\n- **Per IP**: 10,000 requests/hour\n- **Response**: 429 Too Many Requests\n\n### Abuse Prevention\n- **Spam Detection**: ML model flags suspicious activity\n- **Bot Detection**: CAPTCHA after 5 failed logins\n- **DDoS**: CloudFlare + rate limiting',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'monitoring_ops',
          title: 'Monitoring & Operations',
          type: 'text-editor',
          order: 3,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Key Metrics to Monitor\n\n### Application Metrics\n- **Latency**: p50, p95, p99 response times\n- **Throughput**: Requests per second\n- **Error Rate**: 5xx errors, 4xx errors\n- **Availability**: Uptime percentage\n\n### Infrastructure Metrics\n- **CPU/Memory**: Per server utilization\n- **Database**: Connection pool, query times\n- **Cache**: Hit rate, memory usage\n- **Network**: Bandwidth, packet loss\n\n### Business Metrics\n- **DAU/MAU**: Active users\n- **Engagement**: Posts per user, time on site\n- **Growth**: Sign-ups, churn rate\n\n## Alerting Strategy\n\n### P0 Alerts (Page immediately)\n- Service down > 1 minute\n- Error rate > 10% for 5 minutes\n- Database master down\n\n### P1 Alerts (Within 1 hour)\n- Latency p99 > 1s for 10 minutes\n- CPU > 90% for 15 minutes\n- Cache hit rate < 50%\n\n### P2 Alerts (Within 24 hours)\n- Disk > 80% full\n- Memory > 85% used\n- Slow query count increasing\n\n## Deployment Strategy\n- **Blue-Green**: Zero downtime deploys\n- **Canary**: 5% → 25% → 100%\n- **Rollback**: Automated on error spike\n- **Feature Flags**: Toggle features without deploy',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'future_improvements',
          title: 'Future Improvements',
          type: 'text-editor',
          order: 4,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Near-term Improvements (3-6 months)\n\n### Performance Optimization\n- **GraphQL**: Reduce over-fetching, 1 request vs 5\n- **CDN Expansion**: Add Edge locations in APAC\n- **Query Optimization**: Review slow query log weekly\n- **Connection Pooling**: Implement PgBouncer\n\n### Reliability\n- **Multi-region**: Active-active in US + EU\n- **Chaos Engineering**: Regular failure testing\n- **Backup Strategy**: Cross-region backups\n\n## Long-term Improvements (6-12+ months)\n\n### Advanced Features\n- **Real-time Updates**: WebSockets for live feed\n- **Recommendation Engine**: ML-based feed ranking\n- **Search**: Elasticsearch for full-text search\n- **Analytics**: Data warehouse for insights\n\n### Scaling Strategy\n- **Microservices**: Break monolith into services\n  - User Service\n  - Post Service\n  - Feed Service\n  - Notification Service\n- **Event-Driven**: Kafka for async communication\n- **Database**: Consider NewSQL (CockroachDB, Spanner)\n\n### Cost Optimization\n- **Auto-scaling**: Dynamic sizing based on load\n- **Spot Instances**: 60% cost savings for batch jobs\n- **Data Archiving**: Move old data to S3 Glacier\n- **Reserved Instances**: 40% savings for steady-state\n\n## Summary\n\nOur design handles **10M DAU, 10K QPS** with:\n- **Latency**: < 100ms p99\n- **Availability**: 99.9% uptime\n- **Cost**: ~$50K/month\n- **Scale Path**: Clear roadmap to 100M DAU',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    }
  ],
  settings: {
    allowPageAddition: true,
    allowPageRemoval: false,
    allowSectionAddition: true,
    allowSectionRemoval: false,
    allowSectionReordering: true,
    customizableThemes: true
  }
};

// ML Design Template - Following Alex Xu ML Design Interview Framework
export const mlDesignTemplate: ProjectTemplateDefinition = {
  id: 'ml_design',
  name: 'ML System Design',
  description: 'Machine Learning system design following ML engineering best practices',
  version: '3.0.0',
  pages: [
    {
      id: 'problem-framing',
      title: 'ML Problem Framing',
      description: 'Step 1: Define business problem, ML task type, and success metrics (8 min)',
      order: 1,
      sections: [
        {
          id: 'business_problem',
          title: 'Business Problem Definition',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Business Problem\n\n### What business problem are we solving?\nDescribe the specific business problem, its impact, and why ML is the right approach.\n\n**Example**: Reduce customer churn by predicting which users are likely to cancel their subscription in the next 30 days.\n\n### Why ML vs Rule-Based?\n- **Complexity**: Too many variables for manual rules\n- **Scale**: Millions of users, patterns change over time\n- **Performance**: Current manual approach achieves X% accuracy, ML can improve to Y%\n\n### Current Baseline\n- Existing solution performance (if any)\n- Manual process metrics\n- Business impact of current approach',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'ml_task_type',
          title: 'ML Task Formulation',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## ML Task Type\n\n### Task Classification\n- **Type**: [Classification / Regression / Ranking / Clustering / Anomaly Detection]\n- **Subtype**: [Binary / Multi-class / Multi-label / Ordinal / Continuous]\n- **Learning**: [Supervised / Unsupervised / Semi-supervised / Reinforcement]\n\n### Input → Output\n- **Input Features**: User demographics, behavioral data, transaction history\n- **Output**: Probability of churn (0-1) or Churn/No-Churn class\n- **Prediction Window**: Next 30 days\n\n### Training Paradigm\n- **Supervised Learning**: With historical labels\n- **Data Requirement**: X months of historical data with churn labels',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'success_metrics',
          title: 'Success Metrics',
          type: 'text-editor',
          order: 3,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Success Metrics\n\n### Business Metrics (Primary)\n- **Revenue Impact**: Reduce churn by X%, save $Y/month\n- **User Retention**: Increase 30-day retention from A% to B%\n- **Operational Efficiency**: Reduce manual review time by Z%\n\n### ML Metrics (Secondary)\n- **Model Performance**: Precision, Recall, F1-score, AUC-ROC\n  - Target: F1 > 0.85, AUC > 0.90\n- **Inference Latency**: < 100ms p95\n- **Throughput**: Handle Xk predictions/second\n\n### Trade-offs\n- **Precision vs Recall**: Prefer high recall (catch more churners) even with some false positives\n- **Latency vs Accuracy**: Real-time requirement limits model complexity',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        },
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'clarifying-questions',
      title: 'Clarifying Questions',
      description: 'Step 2: Understand requirements, constraints, and data availability (8 min)',
      order: 2,
      sections: [
        {
          id: 'ml_questions',
          title: 'ML Requirements Discovery',
          type: 'qa-pairs',
          order: 1,
          defaultContent: {
            type: 'qa-pairs',
            pairs: [
              {
                id: '1',
                question: 'What exactly are we trying to predict/classify/rank?',
                answer: 'Specific target variable and its meaning. This determines our ML task type and evaluation metrics.',
                order: 0
              },
              {
                id: '2',
                question: 'What data do we have access to? Volume, quality, and labeling?',
                answer: 'Data sources, size, quality issues, label availability. This impacts feasibility and approach (supervised vs unsupervised).',
                order: 1
              },
              {
                id: '3',
                question: 'What accuracy is needed? What about latency?',
                answer: 'Minimum accuracy threshold, inference latency limits. This involves trade-offs between model complexity and performance.',
                order: 2
              },
              {
                id: '4',
                question: 'How many predictions per day? Batch or real-time?',
                answer: 'Volume of predictions, serving pattern. This determines serving infrastructure and optimization needs.',
                order: 3
              },
              {
                id: '5',
                question: 'Do we need to explain predictions? Regulatory requirements?',
                answer: 'Explainability needs, compliance requirements. This constrains model selection (e.g., tree-based vs neural networks).',
                order: 4
              },
              {
                id: '6',
                question: 'How will we know if predictions are correct? How quickly?',
                answer: 'Ground truth availability, feedback delay. This impacts monitoring and retraining strategy.',
                order: 5
              },
              {
                id: '7',
                question: 'What are the operational constraints? Cost, maintenance, team size?',
                answer: 'Budget for training/serving, team ML expertise, ops capacity. Influences technology choices and complexity.',
                order: 6
              }
            ],
            settings: {
              sectionTitle: 'ML Requirements Discovery',
              sectionDescription: 'Key ML-specific questions to understand requirements and approach',
              questionLabel: 'ML Question',
              answerLabel: 'Technical Answer',
              allowReordering: true,
              maxPairs: 15
            }
          },
          settings: {
            isVisible: true,
            isCollapsible: true,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'calculations',
      title: 'Back-of-Envelope Calculations',
      description: 'Step 3: Estimate data volume, compute resources, and infrastructure costs (8 min)',
      order: 3,
      sections: [
        {
          id: 'ml_calculations',
          title: 'ML Scale Estimates',
          type: 'calculations',
          order: 1,
          defaultContent: {
            type: 'calculations',
            calculations: [],
            assumptions: [],
            references: []
          },
          fallbackContent: {
            type: 'text-editor',
            markdown: '## Scale & Performance Calculations\n\n### Data Volume\n- **Training Data Size**: [X] GB/TB\n  - Number of samples: [Y] million\n  - Features per sample: [Z]\n  - Storage needed: samples × features × bytes_per_feature\n\n### Model Metrics\n- **Model Size**: [X] MB/GB (depends on architecture)\n- **Parameters**: [Y] million/billion\n- **Training Time**: [Z] hours on [hardware spec]\n- **Inference Latency**: [X] ms per prediction\n\n### Infrastructure Requirements\n\n#### Training Infrastructure\n- **GPU Requirements**: [X] GPUs × [Y] hours\n- **Memory Requirements**: [X] GB RAM\n- **Storage**: [Y] TB for datasets and checkpoints\n- **Cost Estimate**: $[Z]/training run\n\n#### Serving Infrastructure\n- **Predictions/Day**: [X] million\n- **Peak QPS**: [Y] predictions/second\n- **Model Replicas Needed**: peak_qps / throughput_per_replica\n- **Serving Cost**: $[Z]/month\n\n### Data Pipeline\n- **Daily Data Ingestion**: [X] GB/day\n- **Feature Computation Time**: [Y] minutes\n- **Feature Storage**: [Z] GB\n- **Pipeline Cost**: $[X]/month\n\n### Monitoring & Retraining\n- **Monitoring Metrics Storage**: [X] GB/month\n- **Retraining Frequency**: [Weekly/Monthly/Quarterly]\n- **A/B Test Duration**: [X] days\n- **Rollback Time**: [Y] minutes',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'data',
      title: 'Data Strategy',
      description: 'Step 4: Data sources, quality, feature engineering, and train/val/test splits (8 min)',
      order: 4,
      sections: [
        {
          id: 'data_pipeline_diagram',
          title: 'Data Pipeline Architecture',
          type: 'whiteboard',
          order: 1,
          defaultContent: {
            type: 'whiteboard',
            whiteboardId: '', // Will be set during project creation
            pageId: 'page:data-pipeline'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', height: 'fixed', padding: 'medium', borders: true }
          },
          required: false
        },
        {
          id: 'data_sources',
          title: 'Data Sources',
          type: 'table',
          order: 2,
          defaultContent: {
            type: 'table',
            headers: ['Data Source', 'Type', 'Volume', 'Quality', 'Access Method'],
            rows: [
              {
                id: '1',
                cells: {
                  'Data Source': 'User Events',
                  'Type': 'Structured',
                  'Volume': '10M records/day',
                  'Quality': 'High',
                  'Access Method': 'Kafka Stream'
                }
              }
            ],
            schema: {
              columns: [
                { id: 'source', name: 'Data Source', type: 'text', required: true },
                { id: 'type', name: 'Type', type: 'select', options: ['Structured', 'Unstructured', 'Semi-structured'] },
                { id: 'volume', name: 'Volume', type: 'text' },
                { id: 'quality', name: 'Quality', type: 'select', options: ['High', 'Medium', 'Low'] },
                { id: 'access', name: 'Access Method', type: 'text' }
              ]
            }
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'feature_engineering',
          title: 'Feature Engineering',
          type: 'text-editor',
          order: 3,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Feature Engineering Strategy\n\n### Feature Categories\n\n#### User Features\n- Demographics: age, location, account_age\n- Engagement: login_frequency, session_duration, features_used\n- Historical: lifetime_value, support_tickets, referrals\n\n#### Behavioral Features\n- Recency: days_since_last_login, days_since_last_purchase\n- Frequency: logins_per_week, transactions_per_month\n- Monetary: avg_transaction_value, total_spend\n\n#### Derived Features\n- Ratios: engagement_score = active_days / total_days\n- Aggregations: avg_session_duration_last_30d\n- Time-based: day_of_week, hour_of_day, is_weekend\n\n### Feature Transformations\n- **Normalization**: Scale numerical features to [0,1] or standardize\n- **Encoding**: One-hot for categorical, embedding for high-cardinality\n- **Binning**: Age groups, transaction amount buckets\n- **Interactions**: product of related features (e.g., tenure × engagement)\n\n### Feature Selection\n- **Correlation Analysis**: Remove highly correlated features\n- **Feature Importance**: Use tree-based models or SHAP values\n- **Domain Knowledge**: Include features known to be predictive',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'data_splits',
          title: 'Train/Val/Test Strategy',
          type: 'text-editor',
          order: 4,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Dataset Splits\n\n### Split Strategy\n- **Training**: 70% (model learning)\n- **Validation**: 15% (hyperparameter tuning, early stopping)\n- **Test**: 15% (final evaluation, never touched during dev)\n\n### Time-Based Splitting (Recommended for ML)\n- **Training**: Jan - Sep 2023\n- **Validation**: Oct 2023\n- **Test**: Nov 2023\n- **Why**: Prevents data leakage, mimics production (predict future from past)\n\n### Data Quality Checks\n\n#### Training Data\n- **Label Quality**: Inter-annotator agreement > 90%\n- **Class Balance**: Check for severe imbalance (use SMOTE, class weights if needed)\n- **Missing Values**: < 5% per feature, handle via imputation or indicator features\n- **Outliers**: Identify and decide to remove or cap\n\n#### Data Freshness\n- **Staleness**: How old can training data be before retraining?\n- **Drift Detection**: Monitor feature distributions in production vs training\n- **Retraining Trigger**: When accuracy drops or significant drift detected',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'model-development',
      title: 'Model Development',
      description: 'Baseline models, candidate selection, and training approach (8 min)',
      order: 5,
      sections: [
        {
          id: 'ml_architecture_diagram',
          title: 'ML System Architecture',
          type: 'whiteboard',
          order: 1,
          defaultContent: {
            type: 'whiteboard',
            whiteboardId: '', // Will be set during project creation
            pageId: 'page:ml-architecture'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', height: 'fixed', padding: 'medium', borders: true }
          },
          required: false
        },
        {
          id: 'model_selection',
          title: 'Model Selection',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Model Development Strategy\n\n### Baseline Models (Always Start Here)\n\n#### Simple Baselines\n- **Random Classifier**: Random predictions based on class distribution\n- **Majority Class**: Always predict most common class\n- **Rule-Based**: Business logic rules (e.g., churn if no login in 60 days)\n\n#### Why Baselines Matter\n- Establish performance floor\n- Justify ML investment vs simple rules\n- Sanity check for complex models\n\n### Candidate Models\n\n#### For Binary Classification (Churn Example)\n\n**1. Logistic Regression**\n- **Pros**: Fast, interpretable, good baseline\n- **Cons**: Linear decision boundary, limited feature interactions\n- **When**: Need explainability, simple patterns\n\n**2. Gradient Boosted Trees (XGBoost, LightGBM)**\n- **Pros**: High accuracy, handles non-linear, feature importance\n- **Cons**: Longer training, potential overfitting\n- **When**: Tabular data, need high performance\n\n**3. Random Forest**\n- **Pros**: Robust, less prone to overfitting than boosting\n- **Cons**: Larger model size, slower inference\n- **When**: Need robustness, less tuning time\n\n**4. Neural Network**\n- **Pros**: Can learn complex patterns, handles any feature type\n- **Cons**: Needs more data, harder to interpret, longer training\n- **When**: Large dataset, complex patterns, have GPU resources\n\n### Model Selection Criteria\n- **Accuracy**: Offline validation performance\n- **Latency**: Inference speed < 100ms?\n- **Interpretability**: Can we explain predictions?\n- **Training Cost**: Time and compute for retraining\n- **Operational Complexity**: Deployment and monitoring burden',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'training_approach',
          title: 'Training Approach',
          type: 'text-editor',
          order: 3,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Training Strategy\n\n### Hyperparameter Tuning\n\n#### Tuning Methods\n- **Grid Search**: Exhaustive search over predefined param grid\n- **Random Search**: Random sampling (often better than grid)\n- **Bayesian Optimization**: Smart search based on past results\n- **Hyperband**: Early stopping for bad configurations\n\n#### Key Hyperparameters (XGBoost Example)\n- `learning_rate`: 0.01 - 0.3\n- `max_depth`: 3 - 10\n- `n_estimators`: 100 - 1000\n- `min_child_weight`: 1 - 10\n- `subsample`: 0.5 - 1.0\n\n### Training Optimizations\n\n#### For Large Datasets\n- **Mini-batch training**: Process data in chunks\n- **Distributed training**: Spark MLlib, Dask, Ray\n- **Sampling**: Train on representative sample first\n- **Incremental learning**: Update model with new data\n\n#### Preventing Overfitting\n- **Regularization**: L1/L2 penalty, dropout\n- **Early Stopping**: Stop when validation performance plateaus\n- **Cross-Validation**: K-fold CV for robust estimates\n- **Data Augmentation**: If applicable (images, text)\n\n### Training Infrastructure\n- **Compute**: CPU vs GPU (neural nets benefit from GPU)\n- **Storage**: Fast access to training data (SSD, distributed FS)\n- **Tracking**: MLflow, Weights & Biases for experiment tracking\n- **Reproducibility**: Fixed random seeds, version code & data',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'ml-evaluation',
      title: 'Evaluation & Quality Assurance',
      description: 'Offline metrics, A/B testing, and quality assurance (8 min)',
      order: 6,
      sections: [
        {
          id: 'evaluation_strategy',
          title: 'Evaluation Strategy',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Model Evaluation Strategy\n\n### Offline Evaluation\n\n#### Core ML Metrics\n- **Classification**: Accuracy, Precision, Recall, F1-score, AUC-ROC\n- **Regression**: MAE, RMSE, R², MAPE\n- **Ranking**: NDCG, MAP, MRR\n- **Clustering**: Silhouette score, Calinski-Harabasz index\n\n#### Business Metrics\n- **Revenue Impact**: Lift in conversion, revenue per user\n- **User Experience**: Click-through rate, engagement time\n- **Operational**: False positive rate, manual review reduction\n\n### Dataset Strategy\n\n#### Train/Validation/Test Split\n- **Training**: 70% (model learning)\n- **Validation**: 15% (hyperparameter tuning)\n- **Test**: 15% (final evaluation, never touched during development)\n\n#### Cross-Validation\n- **K-fold CV**: For robust performance estimates\n- **Time-based splits**: For time series data\n- **Stratified sampling**: Maintain class distribution\n\n### Model Comparison\n\n#### Baseline Models\n- **Simple baseline**: Random classifier, mean predictor\n- **Business rule baseline**: Current manual process\n- **Previous model**: Existing production model\n\n#### Statistical Significance\n- **A/B testing framework**: Statistical power analysis\n- **Confidence intervals**: For metric estimates\n- **Hypothesis testing**: McNemar test for classification\n\n## Quality Assurance\n\n### Data Quality Checks\n- **Data drift detection**: Distribution changes over time\n- **Feature importance**: Model explainability\n- **Bias detection**: Fairness across demographics\n- **Edge case analysis**: Model behavior on outliers\n\n### Model Validation\n- **Sanity checks**: Model predictions make business sense\n- **Ablation studies**: Impact of individual features\n- **Robustness testing**: Performance under adversarial conditions',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'ml-deployment',
      title: 'Production Deployment',
      description: 'Serving architecture, monitoring, and retraining strategy (8 min)',
      order: 7,
      sections: [
        {
          id: 'deployment_pipeline_diagram',
          title: 'Training & Serving Pipeline',
          type: 'whiteboard',
          order: 1,
          defaultContent: {
            type: 'whiteboard',
            whiteboardId: '', // Will be set during project creation
            pageId: 'page:deployment-pipeline'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', height: 'fixed', padding: 'medium', borders: true }
          },
          required: false
        },
        {
          id: 'deployment_strategy',
          title: 'Production Deployment',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Deployment Strategy\n\n### Serving Architecture\n\n#### Real-time Serving\n- **Model serving framework**: TensorFlow Serving, TorchServe, MLflow\n- **API gateway**: Rate limiting, authentication, versioning\n- **Load balancing**: Multiple model replicas\n- **Caching**: Feature caching, prediction caching\n\n#### Batch Serving\n- **Batch processing**: Spark, Airflow for large-scale inference\n- **Scheduling**: Daily/hourly batch jobs\n- **Output storage**: Results stored in database/data lake\n\n### Model Versioning & Management\n\n#### Model Registry\n- **Version control**: Git for code, MLflow for models\n- **Model metadata**: Performance metrics, training data info\n- **Model lineage**: Track data and code versions\n- **Approval workflow**: Staging → Production promotion\n\n#### Deployment Patterns\n- **Blue-Green Deployment**: Zero-downtime model updates\n- **Canary Deployment**: Gradual rollout (5% → 25% → 100%)\n- **A/B Testing**: Champion vs challenger models\n- **Shadow Mode**: New model runs alongside old, no impact\n\n## Production Monitoring\n\n### Model Performance Monitoring\n\n#### Online Metrics\n- **Prediction latency**: p50, p95, p99 response times\n- **Throughput**: Requests per second handled\n- **Error rates**: Failed predictions, timeouts\n- **Resource utilization**: CPU, memory, GPU usage\n\n#### Model Quality Monitoring\n- **Prediction distribution**: Monitor for drift\n- **Feature drift**: Input feature distributions\n- **Performance degradation**: Accuracy drop over time\n- **Business impact**: Revenue, conversion tracking\n\n### Automated Alerting\n\n#### Performance Alerts\n- **Latency spike**: >500ms p95 for 5 minutes\n- **Error rate**: >5% errors for 10 minutes\n- **Throughput drop**: <50% of expected requests\n\n#### Quality Alerts\n- **Model drift**: Significant distribution change\n- **Accuracy drop**: Performance below threshold\n- **Bias detection**: Fairness metrics violation\n\n## Retraining Strategy\n\n### Retraining Triggers\n- **Scheduled**: Weekly/monthly retraining\n- **Performance-based**: When accuracy drops below threshold\n- **Data-driven**: When significant new data available\n- **Drift-based**: Feature or prediction drift detected\n\n### Retraining Pipeline\n- **Data validation**: Check new training data quality\n- **Automated training**: Trigger training pipeline\n- **Model validation**: Compare against current production model\n- **Deployment**: Automated or manual promotion to production',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    }
  ],
  settings: {
    allowPageAddition: true,
    allowPageRemoval: false,
    allowSectionAddition: true,
    allowSectionRemoval: false,
    allowSectionReordering: true,
    customizableThemes: true
  }
};

// GenAI Design Template - Application-focused GenAI system design (using existing LLMs)
export const genaiDesignTemplate: ProjectTemplateDefinition = {
  id: 'genai_design',
  name: 'GenAI System Design',
  description: 'Generative AI application design using existing LLMs (RAG, chatbots, content generation)',
  version: '3.0.0',
  pages: [
    {
      id: 'use-case-clarification',
      title: 'Use Case Clarification',
      description: 'Step 1: Define generation type, quality requirements, and constraints (8 min)',
      order: 1,
      sections: [
        {
          id: 'use_case_definition',
          title: 'Use Case Definition',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## What Are We Building?\n\n### Generation Type\n- **Text Generation**: Conversational AI, summarization, content creation, code completion\n- **Image Generation**: Realistic images, artistic styles, image editing\n- **Code Generation**: Code completion, explanation, debugging assistance\n- **Multimodal**: Text→Image, Image→Text, etc.\n\n**Example**: Build a customer support chatbot that answers product questions using company documentation.\n\n### Why GenAI?\n- Why is generative AI the right approach vs rule-based or traditional ML?\n- What makes this suitable for LLMs?\n- Current baseline (if any): Manual support agents, FAQ pages',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'quality_requirements',
          title: 'Quality & Performance Requirements',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Quality Requirements\n\n### Accuracy & Relevance\n- **Factual Accuracy**: Must cite sources, 95% accuracy target\n- **Relevance**: Answers must be on-topic and helpful\n- **Consistency**: Multi-turn conversations maintain context\n- **Style**: Professional, friendly tone\n\n### Performance Requirements\n- **Latency**: Time to first token < 500ms, total response < 3s\n- **Throughput**: 100 requests/second peak\n- **Concurrent Users**: 1,000 simultaneous users\n\n### Safety & Compliance\n- **Content Safety**: Filter toxic, harmful, biased content\n- **PII Protection**: Detect and mask personal information\n- **Regulatory**: GDPR compliance, data retention policies\n- **Hallucination Tolerance**: Low tolerance for factual errors',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'token-economics',
      title: 'Token Economics & Scale',
      description: 'Step 2: Calculate token usage, costs, and infrastructure requirements (8 min)',
      order: 2,
      sections: [
        {
          id: 'usage_metrics',
          title: 'Usage & Scale Estimation',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Usage Metrics\n\n### Daily Volume\n- **Daily Active Users (DAU)**: 10,000 users\n- **Requests per User**: 5 prompts/user/day\n- **Total Daily Requests**: 10K × 5 = 50,000 requests\n- **Peak QPS**: Assume 3× average = ~20 requests/second\n\n### Token Breakdown (Per Request)\n\n```\nSystem Prompt:      500 tokens  (role definition, instructions)\nUser Input:         200 tokens  (average user question)\nContext/RAG:      1,000 tokens  (retrieved documents or history)\n─────────────────────────────────────────────────────\nTotal Input:      1,700 tokens per request\n\nGenerated Output:   400 tokens  (model response)\n```\n\n### Daily Token Usage\n```\nInput Tokens:  50K × 1,700 = 85 million tokens/day\nOutput Tokens: 50K × 400 = 20 million tokens/day\nTotal:         105 million tokens/day\n```',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'cost_analysis',
          title: 'Cost Analysis & Model Selection',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Cost Comparison\n\n### Option 1: GPT-4 (Highest Quality)\n```\nInput:  85M × $0.03/1K = $2,550/day\nOutput: 20M × $0.06/1K = $1,200/day\nTotal: $3,750/day = $112,500/month ❌ Expensive!\n```\n\n### Option 2: GPT-3.5-Turbo (Cost-Effective)\n```\nInput:  85M × $0.0015/1K = $127/day\nOutput: 20M × $0.002/1K  = $40/day\nTotal: $167/day = $5,000/month ✅ Budget-friendly\n```\n\n### Option 3: Self-Hosted (LLaMA-70B)\n```\nGPU: 4×A100 GPUs = $4,000/month (fixed)\nStorage: $500/month (models + vector DB)\nTotal: $4,500/month (breakeven at ~90K req/day)\n```\n\n### Option 4: Model Tiering (RECOMMENDED)\n```\nSimple queries (60%): GPT-3.5 → $100/day\nComplex queries (40%): GPT-4 → $1,500/day\nBlended: $1,600/day = $48,000/month\n\nSavings: 57% vs all-GPT-4\n```\n\n## Performance Targets\n- **Time to First Token**: < 500ms\n- **Token Generation Speed**: 40 tokens/second\n- **Total Response Time**: 400 ÷ 40 = 10s (need streaming!)\n- **Cache Hit Rate**: 30% target (reduce costs)',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'model-selection',
      title: 'Model Selection & Routing',
      description: 'Step 3: Choose models, routing strategy, and fallback mechanisms (8 min)',
      order: 3,
      sections: [
        {
          id: 'model_routing_diagram',
          title: 'Model Routing Architecture',
          type: 'whiteboard',
          order: 1,
          defaultContent: {
            type: 'whiteboard',
            whiteboardId: '', // Will be set during project creation
            pageId: 'page:model-routing'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', height: 'fixed', padding: 'medium', borders: true }
          },
          required: false
        },
        {
          id: 'model_selection',
          title: 'Model Selection & Strategy',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Model Evaluation Matrix\n\n### Comparison Table\n\n| Model | Quality | Cost | Latency | Context | Best For |\n|-------|---------|------|---------|---------|----------|\n| **GPT-4** | 10/10 | 3/10 | 7/10 | 128K | Complex reasoning, premium users |\n| **GPT-3.5** | 7/10 | 9/10 | 9/10 | 16K | Simple queries, cost-sensitive |\n| **Claude 3** | 9/10 | 5/10 | 8/10 | 200K | Long context, document analysis |\n| **LLaMA-70B** | 7/10 | 8/10 | 6/10 | 8K | Self-hosted, data privacy |\n\n### Selection Criteria\n\n**Primary Model (60-70% of queries):**\n- **Choice**: GPT-3.5-Turbo\n- **Why**: Best cost/quality balance for simple queries\n- **Use Cases**: FAQs, basic questions, summarization\n\n**Premium Model (30-40% of queries):**\n- **Choice**: GPT-4\n- **Why**: Highest quality for complex reasoning\n- **Use Cases**: Multi-step problems, technical queries, premium users\n\n**Fallback Model:**\n- **Choice**: Claude 3 Haiku\n- **Why**: Different provider for reliability\n- **Use Cases**: When primary models fail or rate-limited',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'routing_strategy',
          title: 'Model Routing Strategy',
          type: 'text-editor',
          order: 3,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Routing Logic\n\n### Intent-Based Routing\n\n```python\ndef route_to_model(query, user_tier, query_complexity):\n    # Premium users always get best model\n    if user_tier == "premium":\n        return "gpt-4"\n    \n    # Complexity classification\n    if query_complexity == "high":\n        return "gpt-4"  # Complex reasoning\n    elif query_complexity == "medium":\n        return "gpt-3.5"  # Most queries\n    else:\n        return "gpt-3.5"  # Simple queries\n```\n\n### Complexity Classification\n\n**Simple Queries (60%)** → GPT-3.5\n- Single-step questions\n- FAQs\n- Definitions\n- Query length < 50 tokens\n\n**Medium Queries (30%)** → GPT-3.5\n- Multi-part questions\n- Summarization\n- Query length 50-200 tokens\n\n**Complex Queries (10%)** → GPT-4\n- Multi-step reasoning\n- Technical deep dives\n- Requires analysis across multiple sources\n- Query length > 200 tokens\n\n### Fallback Chain\n```\nGPT-4 → GPT-3.5 → Claude 3 → Error Response\n```\n\n**Fallback Triggers:**\n- Rate limit hit\n- API timeout (> 10s)\n- Model error response\n- Cost budget exceeded',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'knowledge-integration',
      title: 'Knowledge Integration',
      description: 'RAG architecture, fine-tuning strategy, and knowledge management (8 min)',
      order: 4,
      sections: [
        {
          id: 'rag_architecture_diagram',
          title: 'RAG Architecture Diagram',
          type: 'whiteboard',
          order: 1,
          defaultContent: {
            type: 'whiteboard',
            whiteboardId: '', // Will be set during project creation
            pageId: 'page:rag-architecture'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', height: 'fixed', padding: 'medium', borders: true }
          },
          required: false
        },
        {
          id: 'rag_vs_finetuning',
          title: 'RAG vs Fine-tuning Decision',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Decision Matrix\n\n### When to Use RAG (Retrieval Augmented Generation)\n\n✅ **Use RAG When:**\n- Knowledge base changes frequently (docs, products, policies)\n- Need to cite sources for factual accuracy\n- Knowledge doesn\'t fit in training data\n- Want to add/update knowledge without retraining\n- Multiple knowledge domains\n\n**Example**: Customer support chatbot with product documentation\n\n### When to Use Fine-tuning\n\n✅ **Use Fine-tuning When:**\n- Need specific output format/style consistently\n- Domain-specific terminology and jargon\n- Have quality training data (10K+ examples)\n- Want to internalize knowledge into model\n- Style matters more than up-to-date facts\n\n**Example**: Legal document generation with specific formatting\n\n### When to Use Prompt Engineering Only\n\n✅ **Use Prompts When:**\n- Quick iteration needed\n- Limited training data\n- Requirements change frequently\n- General knowledge sufficient\n\n**Example**: Simple Q&A without domain expertise\n\n### Hybrid Approach (RECOMMENDED)\n```\nBase Model: Fine-tuned for style/format\n+ RAG: For facts and current information  \n+ Prompt Engineering: For edge cases\n```',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'rag_architecture',
          title: 'RAG Architecture (Detailed)',
          type: 'text-editor',
          order: 3,
          defaultContent: {
            type: 'text-editor',
            markdown: '## RAG Pipeline\n\n### Architecture Flow\n```\nUser Query\n  ↓\nQuery Embedding (text-embedding-ada-002)\n  ↓\nVector Search (Top-k=10)\n  ↓\nReranking (Cross-encoder, Top-k=5)\n  ↓\nContext Construction (Insert into prompt)\n  ↓\nLLM Generation (GPT-4/3.5)\n  ↓\nResponse with Citations\n```\n\n### Component Selection\n\n**Vector Database:**\n- **Pinecone**: Managed, fast, expensive ($70/mo base)\n- **Weaviate**: Open-source, flexible, self-hosted\n- **Qdrant**: Fast, Rust-based, good for production\n- **Chroma**: Simple, embedded, good for prototyping\n\n**Recommendation**: Start with Qdrant (self-hosted) or Pinecone (managed)\n\n**Embedding Model:**\n- **OpenAI ada-002**: $0.0001/1K tokens, 1536 dims, high quality\n- **Open-source**: all-MiniLM-L6-v2 (384 dims, free, faster)\n\n**Recommendation**: OpenAI ada-002 for production quality\n\n### Chunking Strategy\n- **Chunk Size**: 512 tokens (balance context vs precision)\n- **Overlap**: 50 tokens (preserve context across chunks)\n- **Metadata**: Store source, page, timestamp\n\n### Retrieval Strategy\n- **Semantic Search**: Vector similarity (cosine)\n- **Hybrid Search**: Vector + keyword (BM25)\n- **Reranking**: Cross-encoder for better relevance\n\n### Performance\n- **Vector Search Latency**: < 50ms\n- **Reranking Latency**: < 50ms\n- **Total Retrieval**: < 100ms target',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'prompt-engineering',
      title: 'Prompt Engineering & Safety',
      description: 'System prompts, few-shot examples, and safety guardrails (8 min)',
      order: 5,
      sections: [
        {
          id: 'prompt_design',
          title: 'Prompt Engineering Patterns',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## System Prompt Template\n\n```\nYou are a helpful customer support assistant for [Company].\n\n**Your Role:**\n- Answer questions accurately using provided documentation\n- Use friendly, professional tone\n- If unsure, say "I don\'t know" - never make up information\n- Direct to human support for complex issues\n\n**Guidelines:**\n- Keep responses concise (< 200 words)\n- Use bullet points for multi-step instructions\n- Include relevant links when helpful\n- Never share customer personal data\n- Always cite sources: [1], [2]\n\n**Context Provided:**\n{retrieved_documents}\n\n**User Question:**\n{user_query}\n```\n\n## Few-Shot Examples\n\n**Example 1: Password Reset**\n```\nUser: "I forgot my password"\n\nAssistant: "I can help! Here\'s how to reset:\n1. Go to company.com/login  \n2. Click \'Forgot Password\'\n3. Enter your email\n4. Check email for reset link (24hr expiry)\n\nLet me know if you need help! [1]\n\nSources:\n[1] Password Reset Guide - help.company.com/reset"\n```\n\n## Advanced Patterns\n\n**Chain-of-Thought:**\n"Let\'s think step by step..."\n- Improves reasoning for complex problems\n\n**ReAct (Reasoning + Acting):**\n"Thought: I need to check X. Action: Search for Y..."\n- For multi-step problem solving\n\n**Output Formatting:**\n"Respond in JSON format: {answer: string, sources: string[]}"',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'safety_guardrails',
          title: 'Safety Guardrails',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Input Safety\n\n### Prompt Injection Defense\n```python\ndef validate_input(user_query):\n    # Block malicious patterns\n    blocked_patterns = [\n        "ignore previous instructions",\n        "you are now a",\n        "disregard all"\n    ]\n    if any(p in user_query.lower() for p in blocked_patterns):\n        return False, "Invalid input detected"\n    return True, user_query\n```\n\n### PII Detection\n- **Before LLM**: Detect and mask emails, SSNs, credit cards\n- **Tools**: Microsoft Presidio, AWS Comprehend\n- **Action**: Replace with placeholders [EMAIL], [SSN]\n\n### Content Moderation\n- **OpenAI Moderation API**: Check for harmful content\n- **Categories**: Hate, violence, sexual, self-harm\n- **Action**: Block flagged inputs before sending to LLM\n\n## Output Safety\n\n### Content Filtering\n- **Toxicity Detection**: Perspective API (Google)\n- **PII Removal**: Scrub outputs for leaked PII\n- **Hallucination Check**: Verify claims against sources\n\n### Rate Limiting\n```\nPer-user: 100 requests/hour\nPer-IP: 1000 requests/hour  \nCost limit: $100/day per user\nToken limit: Max 2000 tokens/request\n```\n\n### Human Review Queue\n- **Auto-flag**: Safety score < 0.7\n- **Review SLA**: Within 1 hour\n- **Feedback Loop**: Use reviews to improve filters',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'genai-evaluation',
      title: 'Evaluation & Quality Assurance',
      description: 'Automatic metrics, human evaluation, and A/B testing (8 min)',
      order: 6,
      sections: [
        {
          id: 'genai_evaluation_strategy',
          title: 'GenAI Evaluation Strategy',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## GenAI Evaluation Strategy\n\n### Generation Quality Metrics\n\n#### Automatic Metrics\n- **Relevance**: Semantic similarity to expected output\n- **Fluency**: BLEU, ROUGE scores for text generation\n- **Coherence**: Logical flow and consistency\n- **Factual Accuracy**: Hallucination detection metrics\n- **Safety Violations**: Content filter pass rates\n\n#### Human Evaluation\n- **Quality Ratings**: 1-5 scale for overall quality\n- **Task Completion**: Did it solve the user problem?\n- **User Satisfaction**: Net Promoter Score (NPS)\n- **Expert Review**: Domain expert evaluation\n\n### Safety & Bias Evaluation\n\n#### Content Safety\n- **Toxicity Detection**: Hate speech, harassment\n- **Harmful Content**: Violence, self-harm\n- **Privacy Violations**: PII leakage detection\n- **Misinformation**: Fact-checking alignment\n\n#### Bias & Fairness\n- **Demographic Bias**: Performance across user groups\n- **Stereotype Amplification**: Reinforcing harmful stereotypes\n- **Representation**: Diversity in generated content\n- **Cultural Sensitivity**: Appropriate cultural context\n\n### A/B Testing Framework\n\n#### Test Design\n- **Metrics**: Primary (quality) vs Secondary (engagement)\n- **Sample Size**: Statistical power analysis\n- **Duration**: Sufficient time for conclusive results\n- **Randomization**: User-level or session-level\n\n#### Champion vs Challenger\n- **Champion**: Current production model\n- **Challenger**: New model or configuration\n- **Success Criteria**: Improvement thresholds\n- **Rollback Plan**: Automatic rollback on degradation\n\n## Quality Assurance Process\n\n### Pre-deployment Testing\n\n#### Adversarial Testing\n- **Prompt injection**: Malicious prompt attempts\n- **Edge cases**: Unusual input patterns\n- **Stress testing**: High volume, concurrent requests\n- **Jailbreak attempts**: Circumventing safety measures\n\n#### Regression Testing\n- **Golden dataset**: Curated test cases\n- **Performance benchmarks**: Latency, throughput\n- **Safety regression**: Ensure safety measures intact\n- **API compatibility**: Backward compatibility checks\n\n### Continuous Monitoring\n- **Real-time quality**: Online evaluation metrics\n- **User feedback**: Thumbs up/down, detailed feedback\n- **Content flagging**: Community and automated flagging\n- **Performance tracking**: Response times, error rates',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'genai-deployment',
      title: 'Production Deployment & Operations',
      description: 'Serving architecture, caching, monitoring, and cost optimization (8 min)',
      order: 7,
      sections: [
        {
          id: 'genai_system_architecture',
          title: 'GenAI System Architecture',
          type: 'whiteboard',
          order: 1,
          defaultContent: {
            type: 'whiteboard',
            whiteboardId: '', // Will be set during project creation
            pageId: 'page:genai-architecture'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', height: 'fixed', padding: 'medium', borders: true }
          },
          required: false
        },
        {
          id: 'genai_deployment_strategy',
          title: 'GenAI Production Deployment',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Deployment Architecture\n\n### Serving Infrastructure\n\n#### Model Serving Options\n- **API-based**: OpenAI, Anthropic, Google AI\n- **Self-hosted**: vLLM, TGI, Ollama\n- **Hybrid**: Primary + fallback models\n- **Edge deployment**: Local models for privacy\n\n#### Load Balancing & Scaling\n- **Request routing**: By complexity, user tier\n- **Auto-scaling**: Based on queue depth, latency\n- **GPU scaling**: Multiple replicas with load balancing\n- **Cost optimization**: Spot instances, reserved capacity\n\n### Model Management\n\n#### Version Control\n- **Model registry**: MLflow, Weights & Biases\n- **Prompt versioning**: Git-based prompt management\n- **A/B testing**: Multiple model versions\n- **Rollback capability**: Quick revert to previous version\n\n#### Configuration Management\n- **Model parameters**: Temperature, top_p, max_tokens\n- **Safety filters**: Content moderation settings\n- **Rate limits**: Per-user, per-application limits\n- **Feature flags**: Gradual feature rollouts\n\n## Production Monitoring\n\n### Performance Monitoring\n\n#### Latency Metrics\n- **Time to First Token (TTFT)**: < 500ms target\n- **Token Generation Speed**: Tokens per second\n- **End-to-End Latency**: < 3s for most requests\n- **Queue Wait Time**: Time in request queue\n\n#### Throughput & Utilization\n- **Requests per Second**: Current vs capacity\n- **Token throughput**: Input + output tokens/second\n- **GPU utilization**: Memory and compute usage\n- **Cost per request**: Token cost + infrastructure\n\n### Quality Monitoring\n\n#### Real-time Quality Metrics\n- **Response quality**: Automated quality scoring\n- **Safety violations**: Content filter triggers\n- **User satisfaction**: Real-time feedback scores\n- **Task success rate**: Completion of user intents\n\n#### Drift Detection\n- **Input drift**: Changes in user prompt patterns\n- **Output drift**: Changes in model behavior\n- **Performance degradation**: Quality metrics over time\n- **Safety regression**: Increase in policy violations\n\n## Cost Control & Optimization\n\n### Token Management\n- **Context optimization**: Efficient prompt engineering\n- **Caching strategies**: Response caching, prompt caching\n- **Token budgets**: Per-user monthly limits\n- **Streaming responses**: Reduce perceived latency\n\n### Infrastructure Optimization\n- **Model quantization**: INT8, INT4 for faster inference\n- **Batch processing**: Group requests for efficiency\n- **Smart routing**: Route to appropriate model size\n- **Preemptible instances**: Use spot pricing when possible\n\n## Operational Procedures\n\n### Incident Response\n- **Quality degradation**: Automatic model rollback\n- **Safety incidents**: Immediate content review\n- **Performance issues**: Auto-scaling, traffic routing\n- **Cost alerts**: Budget threshold notifications\n\n### Regular Maintenance\n- **Model updates**: Monthly/quarterly retraining\n- **Safety tuning**: Continuous filter improvements\n- **Performance optimization**: Regular latency tuning\n- **Cost review**: Monthly cost optimization',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    }
  ],
  settings: {
    allowPageAddition: true,
    allowPageRemoval: false,
    allowSectionAddition: true,
    allowSectionRemoval: false,
    allowSectionReordering: true,
    customizableThemes: true
  }
};

// Product Design Template - Product Management Interview Framework
export const productDesignTemplate: ProjectTemplateDefinition = {
  id: 'product_design',
  name: 'Product Design',
  description: 'Product management and product design following PM interview best practices',
  version: '1.0.0',
  pages: [
    {
      id: 'problem-user-research',
      title: 'Problem & User Research',
      description: 'Understand the problem, users, and pain points',
      order: 1,
      sections: [
        {
          id: 'problem_statement',
          title: 'Problem Statement',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## What Problem Are We Solving?\n\n### The Core Problem\nDescribe the specific problem users face. Be clear and concise.\n\n**Example**: Small business owners struggle to manage their inventory across multiple sales channels, leading to overselling and stockouts.\n\n### Why This Problem Matters\n- **Impact**: How many users are affected?\n- **Frequency**: How often does this problem occur?\n- **Severity**: How painful is this problem? (1-10 scale)\n- **Current Workarounds**: What do users do today?\n\n### Problem Validation\n- **User Research**: Interviews, surveys, observations\n- **Data Evidence**: Analytics, support tickets, churn reasons\n- **Market Validation**: Industry reports, competitor analysis',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'target_users',
          title: 'Target Users & Personas',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Who Are Our Users?\n\n### Primary Persona\n**Name**: Sarah the Small Business Owner\n- **Demographics**: 35-45 years old, owns retail store\n- **Goals**: Increase sales, reduce manual work\n- **Pain Points**: Spends 5 hours/week on inventory\n- **Tech Savviness**: Moderate (uses Shopify, Excel)\n\n### Secondary Persona\n**Name**: Mike the Marketplace Seller\n- **Demographics**: 25-35, sells on Amazon/eBay\n- **Goals**: Scale to multiple marketplaces\n- **Pain Points**: Overselling causes bad reviews\n\n### User Needs (Jobs-to-be-Done)\n- **Functional**: Sync inventory across channels\n- **Emotional**: Feel confident, reduce stress\n- **Social**: Appear professional to customers',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'product-vision',
      title: 'Product Vision & Strategy',
      description: 'Define vision, value proposition, and competitive positioning',
      order: 2,
      sections: [
        {
          id: 'vision_statement',
          title: 'Product Vision',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Product Vision\n\n### Vision Statement (1-2 sentences)\n**Example**: "Empower small businesses to sell everywhere without inventory headaches. One source of truth for all your products."\n\n### Value Proposition\n**For** [target customer]\n**Who** [statement of need]\n**Our product** [product name]\n**Is a** [product category]\n**That** [key benefit/reason to buy]\n**Unlike** [primary competitive alternative]\n**Our product** [statement of primary differentiation]\n\n**Example**:\nFor small business owners who sell on multiple channels, InventoryPro is an inventory management tool that automatically syncs stock across all platforms. Unlike spreadsheets or manual updates, our product prevents overselling and saves 5 hours per week.\n\n### Strategic Positioning\n- **Market Category**: Inventory Management SaaS\n- **Target Segment**: Small businesses (1-50 SKUs)\n- **Key Differentiator**: Real-time multi-channel sync\n- **Competitive Moat**: Deep integrations + ease of use',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'competitive_analysis',
          title: 'Competitive Analysis',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Competitive Landscape\n\n### Direct Competitors\n\n**Competitor A (Market Leader)**\n- **Strengths**: Established brand, 100K users, many features\n- **Weaknesses**: Complex UI, expensive ($99/mo), slow support\n- **Our Advantage**: Simpler, $29/mo, white-glove onboarding\n\n**Competitor B (Emerging Player)**\n- **Strengths**: Modern UI, good marketing\n- **Weaknesses**: Limited integrations (5 vs our 20)\n- **Our Advantage**: More channels, better API\n\n### Indirect Competitors\n- **Spreadsheets**: Free but manual, error-prone\n- **Native Platform Tools**: Limited to one channel\n\n### Competitive Strategy\n- **Win on**: Ease of use + affordability + integrations\n- **Acceptable trade-off**: Fewer enterprise features\n- **Pricing**: $29/mo (vs $99/mo market leader)',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'user-stories',
      title: 'User Stories & Requirements',
      description: 'Define user flows, features, and MVP scope',
      order: 3,
      sections: [
        {
          id: 'user_flows',
          title: 'Key User Flows',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Core User Flows\n\n### Flow 1: Onboarding (New User)\n1. Sign up with email\n2. Connect first sales channel (Shopify)\n3. Import products (automatic)\n4. Connect second channel (Amazon)\n5. See unified inventory dashboard\n6. **Success Metric**: Time to first sync < 5 minutes\n\n### Flow 2: Daily Inventory Check\n1. Log in to dashboard\n2. See real-time stock levels across all channels\n3. Receive low-stock alert\n4. Adjust quantities\n5. Changes sync automatically\n6. **Success Metric**: Check inventory in < 30 seconds\n\n### Flow 3: Handle a Sale\n1. Customer buys on Shopify\n2. Stock decrements on Shopify\n3. Auto-sync to Amazon/eBay within 1 minute\n4. No overselling\n5. **Success Metric**: Sync latency < 1 minute',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'feature_prioritization',
          title: 'Feature Prioritization (MoSCoW)',
          type: 'bullet-list',
          order: 2,
          defaultContent: {
            type: 'bullet-list',
            items: {
              'must': [
                {
                  id: '1',
                  title: 'Multi-channel inventory sync (Shopify, Amazon, eBay)',
                  type: 'must',
                  order: 0
                },
                {
                  id: '2',
                  title: 'Real-time stock level dashboard',
                  type: 'must',
                  order: 1
                },
                {
                  id: '3',
                  title: 'Low-stock alerts',
                  type: 'must',
                  order: 2
                }
              ],
              'should': [
                {
                  id: '4',
                  title: 'Bulk product upload via CSV',
                  type: 'should',
                  order: 0
                },
                {
                  id: '5',
                  title: 'Sales analytics dashboard',
                  type: 'should',
                  order: 1
                }
              ],
              'could': [
                {
                  id: '6',
                  title: 'Mobile app',
                  type: 'could',
                  order: 0
                },
                {
                  id: '7',
                  title: 'AI-powered demand forecasting',
                  type: 'could',
                  order: 1
                }
              ],
              'wont': [
                {
                  id: '8',
                  title: 'Multi-warehouse management (V2)',
                  type: 'wont',
                  order: 0
                }
              ]
            },
            settings: {
              sectionTitle: 'Feature Prioritization',
              sectionDescription: 'MoSCoW method: Must, Should, Could, Won\'t have',
              typeOptions: [
                {
                  key: 'must',
                  label: 'Must Have (MVP)',
                  color: 'red',
                  icon: '🔴',
                  description: 'Critical for launch'
                },
                {
                  key: 'should',
                  label: 'Should Have (V1)',
                  color: 'orange',
                  icon: '🟠',
                  description: 'Important but not critical'
                },
                {
                  key: 'could',
                  label: 'Could Have (V2)',
                  color: 'yellow',
                  icon: '🟡',
                  description: 'Nice to have'
                },
                {
                  key: 'wont',
                  label: 'Won\'t Have (Later)',
                  color: 'gray',
                  icon: '⚫',
                  description: 'Out of scope'
                }
              ],
              allowQuickAdd: true,
              showDescriptions: true
            }
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'design-ux',
      title: 'Design & User Experience',
      description: 'Wireframes, design principles, and UX considerations',
      order: 4,
      sections: [
        {
          id: 'wireframes',
          title: 'Wireframes & Mockups',
          type: 'whiteboard',
          order: 1,
          defaultContent: {
            type: 'whiteboard',
            whiteboardId: '',
            pageId: 'page:page'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', height: 'fixed', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'design_principles',
          title: 'Design Principles & UX',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Design Principles\n\n### 1. Simplicity First\n- **Why**: Users are busy, overwhelmed by complex tools\n- **How**: One primary action per screen, progressive disclosure\n- **Example**: Dashboard shows only stock levels, advanced features hidden in menu\n\n### 2. Speed & Efficiency\n- **Why**: Users check inventory multiple times per day\n- **How**: < 2 second page loads, keyboard shortcuts, bulk actions\n- **Example**: Update 10 products at once, not one-by-one\n\n### 3. Confidence & Trust\n- **Why**: Inventory errors cost money and reputation\n- **How**: Clear confirmation messages, undo actions, audit logs\n- **Example**: "Stock updated on Shopify ✓ Amazon ✓ eBay ✓"\n\n## Key UX Decisions\n\n### Dashboard Layout\n- **Choice**: Table view (not card view)\n- **Why**: Users need to scan many products quickly\n- **Trade-off**: Less visual but more information density\n\n### Navigation\n- **Choice**: Single-page app with sidebar\n- **Why**: Reduce page loads, stay in context\n\n### Mobile Strategy\n- **MVP**: Responsive web (not native app)\n- **V2**: Native app for push notifications',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'gtm-strategy',
      title: 'Go-to-Market Strategy',
      description: 'Launch plan, pricing, marketing, and distribution',
      order: 5,
      sections: [
        {
          id: 'launch_plan',
          title: 'Launch Plan',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Launch Strategy\n\n### Phase 1: Private Beta (Month 1-2)\n- **Goal**: Validate product-market fit\n- **Users**: 20 hand-picked customers\n- **Success Criteria**: 80% weekly active, NPS > 40\n- **Feedback Loop**: Weekly calls, in-app surveys\n\n### Phase 2: Public Beta (Month 3-4)\n- **Goal**: Scale to 100 users, refine onboarding\n- **Channels**: Product Hunt, Facebook groups, Reddit\n- **Pricing**: Free during beta\n- **Success Criteria**: 50% activation (connect 2+ channels)\n\n### Phase 3: General Availability (Month 5+)\n- **Goal**: $10K MRR by Month 6\n- **Channels**: SEO, content marketing, paid ads\n- **Pricing**: $29/mo standard plan\n- **Success Criteria**: 10% free → paid conversion\n\n## Launch Checklist\n- ✅ Landing page with demo video\n- ✅ Help documentation (10 key articles)\n- ✅ Onboarding email sequence (5 emails)\n- ✅ Support system (Intercom)\n- ✅ Analytics tracking (Mixpanel)\n- ✅ Payment processing (Stripe)',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'pricing_distribution',
          title: 'Pricing & Distribution',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Pricing Strategy\n\n### Pricing Tiers\n\n**Starter ($29/mo)**\n- Up to 100 products\n- 2 sales channels\n- Email support\n- **Target**: Solo sellers\n\n**Professional ($79/mo)**\n- Up to 1,000 products\n- Unlimited channels\n- Priority support + phone\n- Analytics dashboard\n- **Target**: Growing businesses\n\n**Enterprise ($249/mo)**\n- Unlimited products\n- API access\n- Dedicated account manager\n- Custom integrations\n- **Target**: 10+ stores\n\n### Pricing Rationale\n- **Anchor**: Competitor charges $99/mo, we\'re 70% cheaper\n- **Value Metric**: Products (not channels) - scales with business\n- **Acquisition**: Low-cost Starter plan gets users in door\n- **LTV**: Upsell to Professional as they grow\n\n## Distribution Channels\n\n### Organic (60% of leads)\n- **SEO**: "inventory management for Shopify" (5K searches/mo)\n- **Content**: Blog posts, YouTube tutorials\n- **Word of mouth**: Referral program (give $10, get $10)\n\n### Paid (30% of leads)\n- **Facebook Ads**: Target Shopify + Amazon seller groups\n- **Google Ads**: Search intent keywords\n- **Retargeting**: 7-day abandoned trial campaign\n\n### Partnerships (10% of leads)\n- **Shopify App Store**: Featured listing\n- **Amazon Seller Central**: Integration spotlight\n- **Accounting Software**: QuickBooks partnership',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'success-metrics',
      title: 'Success Metrics & KPIs',
      description: 'Define metrics, goals, and measurement framework',
      order: 6,
      sections: [
        {
          id: 'north_star_metric',
          title: 'North Star Metric & Goals',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## North Star Metric\n\n### Our North Star\n**Weekly Active Businesses Syncing Inventory**\n\n**Why This Metric:**\n- ✅ Measures actual value delivery (not vanity)\n- ✅ Leading indicator of retention & revenue\n- ✅ Captures the core "aha moment"\n- ✅ Aligned across product, eng, marketing\n\n**Target Goals:**\n- **Month 3**: 50 weekly active businesses\n- **Month 6**: 200 weekly active businesses\n- **Month 12**: 1,000 weekly active businesses\n\n## Supporting Metrics (AARRR Pirate Metrics)\n\n### Acquisition\n- **Metric**: Sign-ups per week\n- **Goal**: 100 sign-ups/week by Month 6\n- **Channels**: 40% organic, 40% paid, 20% referral\n\n### Activation\n- **Metric**: % users who connect 2+ channels\n- **Goal**: 50% activation rate\n- **Time**: Within 7 days of sign-up\n\n### Retention\n- **Metric**: Day 30 retention rate\n- **Goal**: 60% of activated users still active\n- **Cohort**: Track monthly cohorts\n\n### Revenue\n- **Metric**: Monthly Recurring Revenue (MRR)\n- **Goal**: $10K MRR by Month 6, $50K by Month 12\n- **ARPU**: $40 average revenue per user\n\n### Referral\n- **Metric**: Viral coefficient (K-factor)\n- **Goal**: K = 0.3 (30% of users refer someone)\n- **Incentive**: $10 credit per referral',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'measurement_framework',
          title: 'Measurement & A/B Testing',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Analytics Implementation\n\n### Key Events to Track\n\n**User Journey Events:**\n- `user_signed_up` (source, referrer)\n- `channel_connected` (platform, order)\n- `first_sync_completed` (time_to_sync)\n- `inventory_updated` (num_products)\n- `low_stock_alert_sent`\n- `subscription_started` (plan, price)\n\n**Engagement Events:**\n- `dashboard_viewed` (daily)\n- `product_edited`\n- `report_generated`\n\n### Dashboard Structure\n\n**Executive Dashboard (Weekly Review)**\n- North Star: WAU trend\n- MRR & growth rate\n- Churn rate\n- CAC & LTV\n\n**Product Dashboard (Daily Check)**\n- Sign-ups (by source)\n- Activation rate (7-day rolling)\n- Feature usage\n- Error rates\n\n**User Feedback Dashboard**\n- NPS score (monthly survey)\n- Support ticket volume\n- Feature requests (upvotes)\n\n## A/B Testing Framework\n\n### Test 1: Onboarding Flow\n- **Hypothesis**: Adding a progress bar increases activation by 10%\n- **Variants**: A (no progress), B (5-step progress bar)\n- **Sample**: 1000 users per variant\n- **Duration**: 2 weeks\n- **Success Metric**: % completing onboarding\n\n### Test 2: Pricing Page\n- **Hypothesis**: Leading with annual pricing (vs monthly) increases ACV by 20%\n- **Variants**: A (monthly first), B (annual first + 20% discount)\n- **Sample**: All traffic for 1 month\n- **Success Metric**: Average contract value\n\n## Success Criteria (6 Month Checkpoint)\n\n✅ **Product-Market Fit Indicators:**\n- 200+ weekly active businesses\n- 60%+ 30-day retention\n- NPS > 50\n- $10K+ MRR\n- < 5% monthly churn',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    }
  ],
  settings: {
    allowPageAddition: true,
    allowPageRemoval: false,
    allowSectionAddition: true,
    allowSectionRemoval: false,
    allowSectionReordering: true,
    customizableThemes: true
  }
};

// Research Template - Following academic/research project framework
export const researchTemplate: ProjectTemplateDefinition = {
  id: 'research',
  name: 'Research Project',
  description: 'Academic research, technical studies, and investigative projects',
  version: '1.0.0',
  pages: [
    {
      id: 'research-question',
      title: 'Research Question & Hypothesis',
      description: 'Define the problem, research questions, and hypothesis',
      order: 1,
      sections: [
        {
          id: 'problem_statement',
          title: 'Problem Statement & Research Gap',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Problem Statement\n\n**Context:**\nCurrent state of the field and what\'s known...\n\n**Problem:**\nWhat specific problem or gap exists in current knowledge/practice?\n\n**Example:**\n*Problem:* Existing recommendation systems suffer from cold-start problems when onboarding new users with no historical data. Current approaches require 20+ interactions before providing quality recommendations, leading to 40% user drop-off.\n\n## Research Gap\n\n**What\'s Missing:**\n- Existing solutions focus on collaborative filtering (needs history)\n- Content-based approaches don\'t capture user preferences\n- Hybrid methods still require significant interaction data\n\n**Opportunity:**\nExplore zero-shot recommendation using large language models to understand user preferences from initial profile setup.\n\n## Contribution to Field\n\n**Expected Contributions:**\n1. Novel approach using LLMs for cold-start recommendation\n2. Methodology for extracting preferences from unstructured text\n3. Empirical evaluation showing 60% reduction in interactions needed\n4. Open-source framework for researchers and practitioners',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'research_questions',
          title: 'Research Questions & Hypothesis',
          type: 'qa-pairs',
          order: 2,
          defaultContent: {
            type: 'qa-pairs',
            pairs: [
              {
                id: '1',
                question: 'RQ1 (Primary): Can LLMs generate accurate user preference profiles from minimal textual input?',
                answer: 'Hypothesis: LLMs can extract preference signals from 3-5 open-ended questions with > 70% accuracy compared to traditional methods requiring 20+ interactions.',
                order: 0
              },
              {
                id: '2',
                question: 'RQ2 (Secondary): How does recommendation quality scale with amount of initial text?',
                answer: 'Hypothesis: Quality improves logarithmically - 3 questions give 70% accuracy, 5 questions give 80%, diminishing returns after 7 questions.',
                order: 1
              },
              {
                id: '3',
                question: 'RQ3 (Secondary): What types of initial questions extract the most signal?',
                answer: 'Hypothesis: Open-ended preference questions ("What do you enjoy?") outperform demographic questions ("What\'s your age?") by 15%.',
                order: 2
              }
            ],
            settings: {
              questionLabel: 'Research Question',
              answerLabel: 'Hypothesis',
              sectionTitle: 'Research Questions & Hypotheses',
              sectionDescription: 'Primary and secondary research questions with testable hypotheses',
              allowReordering: true
            }
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'expected_outcomes',
          title: 'Expected Outcomes & Impact',
          type: 'text-editor',
          order: 3,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Expected Outcomes\n\n### Theoretical Contributions\n1. **Framework**: Zero-shot preference extraction methodology\n2. **Understanding**: How LLMs encode domain knowledge for recommendations\n3. **Theory**: Trade-offs between initial effort and recommendation quality\n\n### Practical Contributions\n1. **Tool**: Open-source LLM-based recommendation framework\n2. **Guidelines**: Best practices for onboarding question design\n3. **Benchmark**: Public dataset for cold-start evaluation\n\n## Success Metrics\n\n**Quantitative:**\n- ✅ Recommendation accuracy: > 70% (vs 50% baseline)\n- ✅ User interactions needed: < 5 (vs 20+ baseline)\n- ✅ User drop-off rate: < 15% (vs 40% baseline)\n- ✅ Statistical significance: p < 0.05\n\n**Qualitative:**\n- User satisfaction survey: NPS > 50\n- Expert review: 4/5 rating on recommendation quality\n\n## Impact\n\n**Academic Impact:**\n- Target venue: RecSys 2025, SIGIR, WWW\n- Citations expected: 10+ in first year\n- Collaboration opportunities with industry\n\n**Industry Impact:**\n- Reduce onboarding friction for new platforms\n- 60% cost reduction in user acquisition\n- Applicable to e-commerce, streaming, content platforms',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'literature-review',
      title: 'Literature Review & Theoretical Framework',
      description: 'Survey related work and establish theoretical foundation',
      order: 2,
      sections: [
        {
          id: 'related_work',
          title: 'Related Work & Prior Research',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Key Research Areas\n\n### 1. Collaborative Filtering\n\n**Matrix Factorization (Koren et al., 2009)**\n- User-item interaction matrix decomposition\n- **Limitation:** Requires dense interaction history\n- **Cold-start problem:** Cannot handle new users\n\n**Deep Learning Approaches (He et al., 2017 - NCF)**\n- Neural collaborative filtering with embeddings\n- **Limitation:** Still needs 10+ interactions per user\n\n### 2. Content-Based Recommendation\n\n**TF-IDF & Item Similarity (Pazzani & Billsus, 2007)**\n- Recommend items similar to user\'s past preferences\n- **Limitation:** Cannot infer preferences without history\n\n**Knowledge Graphs (Wang et al., 2019)**\n- Use item relationships and metadata\n- **Limitation:** Requires explicit user preferences\n\n### 3. Hybrid & Transfer Learning\n\n**Hybrid Systems (Burke, 2002)**\n- Combine collaborative + content-based\n- **Limitation:** Cold-start remains for new users\n\n**Cross-Domain Transfer (Cantador et al., 2015)**\n- Transfer preferences from other domains\n- **Limitation:** Requires user history in another domain\n\n### 4. LLMs for Recommendation (Emerging)\n\n**P5 (Geng et al., 2022)** - Pretrained Prompting Personalization\n- Unified text-to-text framework for recommendations\n- **Gap:** Focused on in-domain training, not zero-shot\n\n**ChatGPT for Recommendations (Wang et al., 2023)**\n- Exploratory study on using conversational AI\n- **Gap:** No systematic evaluation of cold-start performance\n\n## Research Gaps\n\n**Gap 1:** No existing work systematically evaluates LLMs for **zero-shot** cold-start recommendation\n\n**Gap 2:** Lack of methodology for extracting rich preference profiles from minimal initial text\n\n**Gap 3:** No benchmarks comparing LLM-based vs traditional cold-start approaches',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'theoretical_framework',
          title: 'Theoretical Framework',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Theoretical Foundation\n\n### Core Theory: Preference Elicitation\n\n**Information Theory Perspective:**\n- Initial questions aim to maximize information gain\n- Each answer reduces uncertainty about user preferences\n- Goal: Minimize questions while maximizing entropy reduction\n\n### LLM Capabilities Hypothesis\n\n**Why LLMs Might Work:**\n1. **World Knowledge:** Pretrained on diverse content (books, reviews, forums)\n2. **Semantic Understanding:** Can map free text to latent preferences\n3. **Few-Shot Learning:** Transfer knowledge from training to new users\n4. **Contextual Reasoning:** Understand nuanced preferences from natural language\n\n**Theoretical Model:**\n```\nUser Input (Text) → LLM Encoder → Preference Vector → Recommendation Model → Items\n\nWhere:\n- Preference Vector: Dense representation of user interests\n- LLM acts as zero-shot preference extractor\n- No user-specific fine-tuning needed\n```\n\n## Conceptual Framework\n\n### Stages of Our Approach\n\n**Stage 1: Question Design**\n- Craft 5-7 open-ended onboarding questions\n- Focus on interests, dislikes, use cases\n\n**Stage 2: LLM-based Preference Extraction**\n- Feed user responses to LLM (GPT-4)\n- Extract structured preference profile (JSON)\n\n**Stage 3: Preference-to-Embedding Mapping**\n- Convert preference profile to item space embeddings\n- Use similarity search to find candidate items\n\n**Stage 4: Ranking & Personalization**\n- Score candidates using preference weights\n- Return top-k personalized recommendations\n\n## Assumptions & Constraints\n\n**Assumptions:**\n- Users can articulate preferences in natural language\n- LLM world knowledge covers target domain (e.g., movies, books)\n- Text-based input is acceptable UX for target users\n\n**Constraints:**\n- LLM API cost: Max $0.10 per user onboarding\n- Latency: < 5 seconds for initial recommendations\n- Accuracy threshold: > 70% to justify approach',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'methodology',
      title: 'Methodology & Research Design',
      description: 'Data collection, experimental design, and analysis approach',
      order: 3,
      sections: [
        {
          id: 'research_design',
          title: 'Research Design & Approach',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Research Design\n\n**Type:** Mixed-methods (quantitative + qualitative)\n\n### Quantitative Study\n\n**Design:** Between-subjects experiment with control group\n\n**Groups:**\n- **Control:** Traditional collaborative filtering (baseline)\n- **Treatment 1:** LLM-based with 3 questions\n- **Treatment 2:** LLM-based with 5 questions\n- **Treatment 3:** LLM-based with 7 questions\n\n**Randomization:** Random assignment to groups, stratified by demographics\n\n### Qualitative Study\n\n**Design:** Semi-structured interviews + user observation\n\n**Purpose:**\n- Understand user experience with LLM-based onboarding\n- Identify pain points and improvement areas\n- Gather feedback on question quality and clarity\n\n**Sample:** 20 participants (5 from each group)\n\n## Sample Size & Power Analysis\n\n### Quantitative Sample\n\n**Calculation:**\n```\nEffect size: d = 0.5 (medium effect)\nPower: 0.80\nSignificance: α = 0.05\nGroups: 4\n\nRequired: n = 64 per group = 256 total participants\nWith 20% attrition: 320 recruited\n```\n\n**Recruitment:**\n- Target: Adults 18-65 who use recommendation platforms\n- Channels: University participant pool, social media ads, Prolific\n- Compensation: $10 Amazon gift card (15 min study)\n\n### Qualitative Sample\n\n**Purposive Sampling:**\n- 5 participants per experimental group (20 total)\n- Mix of high/low satisfaction scores\n- Diverse demographics (age, gender, tech proficiency)\n\n**Recruitment:**\n- Invite from quantitative study participants\n- Additional $15 compensation for 30-min interview',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'data_collection',
          title: 'Data Collection Methods',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Data Collection Procedures\n\n### Quantitative Data\n\n**Phase 1: Onboarding (Day 0)**\n- **Control Group:** Browse 20 items, rate 5+ to build profile\n- **Treatment Groups:** Answer 3/5/7 open-ended questions\n- **Data Collected:** Question responses, time spent, abandonment rate\n\n**Phase 2: Recommendation Evaluation (Day 0)**\n- Show 10 personalized recommendations\n- **Metrics Collected:**\n  - Click-through rate (CTR)\n  - Explicit ratings (1-5 stars)\n  - Time spent on recommended items\n  - Diversity of recommendations (coverage)\n\n**Phase 3: Follow-up (Day 7, Day 30)**\n- Track continued engagement\n- Measure retention and satisfaction\n- Survey: System Usability Scale (SUS), satisfaction\n\n### Qualitative Data\n\n**Interview Protocol (Semi-structured):**\n\n1. **Experience Reflection (10 min)**\n   - "Walk me through your onboarding experience"\n   - "How did you feel answering the questions?"\n   - "Were recommendations relevant?"\n\n2. **Deep Dive (15 min)**\n   - "What would improve the questions?"\n   - "How did this compare to other platforms?"\n   - "Would you recommend this to friends?"\n\n3. **Suggestions (5 min)**\n   - "What features are missing?"\n   - "What would make recommendations better?"\n\n**Recording:**\n- Audio recorded (with consent)\n- Transcribed using Otter.ai\n- Coded using thematic analysis\n\n## Tools & Instruments\n\n**Technical Tools:**\n- LLM: OpenAI GPT-4 API\n- Vector DB: Pinecone (for item embeddings)\n- Survey Platform: Qualtrics\n- Analytics: Mixpanel + custom logging\n\n**Datasets:**\n- **MovieLens 25M:** 25M ratings, 62K movies\n- **Books:** Amazon Books dataset (14M reviews)\n\n**Evaluation Metrics:**\n- Accuracy: Precision@10, Recall@10, NDCG@10\n- Diversity: Intra-list diversity, coverage\n- User Metrics: CTR, dwell time, satisfaction',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'analysis_approach',
          title: 'Analysis Approach & Statistical Methods',
          type: 'text-editor',
          order: 3,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Quantitative Analysis\n\n### Statistical Tests\n\n**Primary Analysis: ANOVA**\n- Compare recommendation accuracy across 4 groups\n- Dependent variable: NDCG@10 score\n- Independent variable: Onboarding method (4 levels)\n- Post-hoc: Tukey HSD for pairwise comparisons\n\n**Secondary Analysis: T-tests**\n- Control vs each treatment group\n- Bonferroni correction for multiple comparisons\n\n**Regression Analysis:**\n```\nAccuracy ~ NumQuestions + TimeSpent + Diversity + Demographics\n```\n- Understand which factors predict recommendation quality\n\n### Effect Size Calculation\n\n**Cohen\'s d:** Standardized mean difference\n```python\nd = (mean_treatment - mean_control) / pooled_std\n\nInterpretation:\nd < 0.2: Small effect\nd = 0.5: Medium effect  \nd > 0.8: Large effect\n```\n\n### Handling Missing Data\n\n- **Approach:** Multiple imputation (MI) with 5 imputations\n- **Assumption:** Missing at random (MAR)\n- **Sensitivity Analysis:** Complete case analysis as robustness check\n\n## Qualitative Analysis\n\n### Thematic Analysis (Braun & Clarke, 2006)\n\n**Step 1: Familiarization**\n- Read all transcripts 2-3 times\n- Note initial observations\n\n**Step 2: Coding**\n- Line-by-line coding in NVivo\n- Develop codebook iteratively\n- Inter-rater reliability: Cohen\'s kappa > 0.7\n\n**Step 3: Theme Development**\n- Group codes into themes\n- Create theme hierarchy\n- Validate with research team\n\n**Step 4: Review & Refine**\n- Ensure themes supported by data\n- Check for internal consistency\n- Write theme descriptions\n\n**Step 5: Reporting**\n- Select representative quotes\n- Connect themes to research questions\n\n### Integration: Mixed Methods\n\n**Convergent Design:**\n- Quantitative: "How much better?"\n- Qualitative: "Why better?" and "How to improve?"\n- Triangulation: Validate quantitative findings with qualitative insights\n\n## Software & Tools\n\n**Statistical Analysis:**\n- R (primary): tidyverse, lme4, ggplot2\n- Python: scipy, statsmodels, pandas\n\n**Qualitative Analysis:**\n- NVivo 14 (coding and theme analysis)\n- Otter.ai (transcription)\n- Dedoose (collaborative coding)',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'ethical_considerations',
          title: 'Ethical Considerations & IRB',
          type: 'text-editor',
          order: 4,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Ethical Approval\n\n**IRB Status:** Pending approval from University Ethics Board\n\n**Protocol Number:** IRB-2025-0123\n\n**Risk Level:** Minimal risk (online survey + interview)\n\n## Informed Consent\n\n**Consent Process:**\n1. Participants read consent form online\n2. Must check "I agree" to proceed\n3. Can withdraw anytime without penalty\n4. Consent form includes:\n   - Study purpose and procedures\n   - Risks and benefits\n   - Data privacy and anonymization\n   - Compensation details\n   - Contact info for questions\n\n## Privacy & Data Protection\n\n**Data Anonymization:**\n- No personally identifiable information (PII) collected\n- Participant IDs: Random UUIDs (no names/emails)\n- Interview recordings: Transcribed and audio deleted after 30 days\n\n**Data Storage:**\n- Encrypted database (AES-256)\n- Access restricted to research team only\n- Data retention: 5 years (per university policy)\n- Deletion: Secure deletion after retention period\n\n**GDPR Compliance:**\n- Right to access data\n- Right to deletion ("Right to be Forgotten")\n- Data minimization principle\n\n## Potential Risks & Mitigation\n\n**Risk 1: Boredom/Fatigue**\n- Mitigation: Keep study < 15 minutes\n\n**Risk 2: Recommendation Quality Issues**\n- Mitigation: Disclaimer that recommendations are experimental\n\n**Risk 3: Data Breach**\n- Mitigation: Encryption, access controls, regular security audits\n\n## Benefits & Compensation\n\n**Individual Benefits:**\n- Learn about recommendation systems\n- Contribute to research improving user experience\n\n**Societal Benefits:**\n- Better onboarding for new platform users\n- Reduced friction in online services\n\n**Compensation:**\n- Quantitative study: $10 (15 min)\n- Qualitative interview: Additional $15 (30 min)\n- Fair compensation (> minimum wage equivalent)',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'single_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'data-analysis',
      title: 'Data Collection & Analysis Plan',
      description: 'Detailed procedures for gathering and analyzing data',
      order: 4,
      sections: [
        {
          id: 'data_gathering',
          title: 'Data Gathering Procedures',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Timeline & Phases\n\n### Phase 1: Preparation (Weeks 1-2)\n- ✅ IRB approval obtained\n- ✅ Implement experimental platform\n- ✅ Pilot test with 10 users\n- ✅ Refine questions based on pilot feedback\n\n### Phase 2: Recruitment (Weeks 3-4)\n- Post recruitment ads (Prolific, university, social media)\n- Screen participants (demographics, platform usage)\n- Schedule interview participants\n- Target: 320 quantitative + 20 qualitative\n\n### Phase 3: Data Collection (Weeks 5-8)\n\n**Week 5-6: Initial Data**\n- Participants complete onboarding\n- Immediate recommendation evaluation\n- Day 0 satisfaction survey\n\n**Week 7: Follow-up 1**\n- Day 7 engagement tracking\n- Retention and usage metrics\n\n**Week 8: Follow-up 2**\n- Day 30 long-term retention\n- Final satisfaction survey\n- Conduct qualitative interviews\n\n### Phase 4: Analysis (Weeks 9-12)\n- Quantitative analysis (Weeks 9-10)\n- Qualitative coding and themes (Weeks 10-11)\n- Integration and triangulation (Week 12)\n\n## Data Quality Checks\n\n**Quantitative Data:**\n- Check for duplicate responses (IP, device fingerprint)\n- Identify outliers (response time < 2 min or > 30 min)\n- Attention checks: 2 embedded validation questions\n- Missing data: Flag > 10% missing for exclusion\n\n**Qualitative Data:**\n- Audio quality check\n- Transcription accuracy: Spot-check 10% of transcripts\n- Inter-rater reliability: 20% of codes checked by second coder',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'validation_reliability',
          title: 'Validation & Reliability',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Internal Validity\n\n**Threats & Mitigation:**\n\n**Threat 1: Selection Bias**\n- *Mitigation:* Random assignment to groups\n- Stratify by age, gender, tech proficiency\n\n**Threat 2: Maturation**\n- *Mitigation:* Short study duration (30 days)\n- Control group experiences same time effects\n\n**Threat 3: Testing Effects**\n- *Mitigation:* Different questions at Day 0, 7, 30\n- No repeated recommendation evaluations\n\n**Threat 4: Instrumentation**\n- *Mitigation:* Consistent LLM model version (GPT-4 snapshot)\n- Same evaluation metrics across groups\n\n## External Validity\n\n**Generalizability:**\n\n**Population:**\n- Sample: University students + Prolific (general population)\n- Limitation: Over-representation of young adults\n- Future work: Older adults (65+), international users\n\n**Domain:**\n- Tested on: Movies (MovieLens)\n- Likely generalizable to: Books, music, products\n- May not generalize to: Niche domains without LLM coverage\n\n**Setting:**\n- Lab-like online study (controlled)\n- May differ from: Real-world onboarding with distractions\n\n## Construct Validity\n\n**Measurement Quality:**\n\n**Recommendation Accuracy (NDCG@10):**\n- Widely used metric in RecSys literature\n- Captures ranking quality\n- Limitation: Doesn\'t measure serendipity\n\n**User Satisfaction (SUS + Custom):**\n- SUS: Validated 10-item scale\n- Custom: 5 domain-specific questions\n- Cronbach\'s alpha > 0.7 (reliability check)\n\n## Reliability\n\n**Test-Retest Reliability:**\n- Subset of 50 users retake onboarding after 1 week\n- Check consistency of LLM preference extraction\n- Target: Correlation r > 0.7\n\n**Inter-Coder Reliability (Qualitative):**\n- Two coders independently code 20% of transcripts\n- Cohen\'s kappa > 0.7 (substantial agreement)\n- Resolve disagreements through discussion',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'results-findings',
      title: 'Results & Findings',
      description: 'Present data, visualizations, and key findings',
      order: 5,
      sections: [
        {
          id: 'results_presentation',
          title: 'Results Presentation',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Participant Demographics\n\n**Total Participants:** 312 (after exclusions)\n\n**Demographics:**\n- Age: Mean = 32.4 (SD = 10.2), Range = 18-64\n- Gender: 52% Female, 46% Male, 2% Non-binary\n- Education: 65% Bachelor\'s+, 35% High school\n- Prior platform use: 89% use 2+ recommendation platforms\n\n**Group Distribution:**\n- Control (baseline): n = 78\n- Treatment 1 (3 questions): n = 77\n- Treatment 2 (5 questions): n = 79\n- Treatment 3 (7 questions): n = 78\n\n## Primary Finding: Recommendation Accuracy\n\n**Metric: NDCG@10 (Normalized Discounted Cumulative Gain)**\n\n| Group | Mean NDCG@10 | SD | vs Control |\n|-------|--------------|-----|------------|\n| Control (baseline) | 0.542 | 0.089 | - |\n| 3 questions | 0.651 | 0.076 | +20.1% *** |\n| 5 questions | 0.712 | 0.068 | +31.4% *** |\n| 7 questions | 0.728 | 0.071 | +34.3% *** |\n\n*** p < 0.001\n\n**ANOVA Results:**\n- F(3, 308) = 87.42, p < 0.001\n- η² = 0.46 (large effect size)\n\n**Post-Hoc (Tukey HSD):**\n- Control vs 3Q: p < 0.001, d = 1.34\n- Control vs 5Q: p < 0.001, d = 2.15\n- Control vs 7Q: p < 0.001, d = 2.34\n- 5Q vs 7Q: p = 0.18 (not significant)\n\n**Key Insight:** 5 questions optimal - 7 questions show diminishing returns\n\n## Secondary Findings\n\n### User Engagement (CTR & Dwell Time)\n\n**Click-Through Rate:**\n- Control: 32%\n- 3Q: 48% (+16 pp)\n- 5Q: 56% (+24 pp)\n- 7Q: 58% (+26 pp)\n\n**Average Dwell Time:**\n- Control: 2.1 min\n- 5Q: 4.8 min (+129%)\n\n### Onboarding Completion Rate\n\n- Control: 68% (32% abandoned after rating 2 items)\n- 3Q: 91% (+23 pp)\n- 5Q: 87% (+19 pp)\n- 7Q: 79% (+11 pp)\n\n**Key Insight:** 7 questions too many - completion drops',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'data_visualizations',
          title: 'Data Visualizations',
          type: 'whiteboard',
          order: 2,
          defaultContent: {
            type: 'whiteboard',
            whiteboardId: '',
            pageId: 'results-charts'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: false
        },
        {
          id: 'qualitative_findings',
          title: 'Qualitative Findings & Themes',
          type: 'text-editor',
          order: 3,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Thematic Analysis Results\n\n**Participants:** 20 interviews (5 per group)\n\n**Themes Identified:** 4 major themes, 12 subthemes\n\n### Theme 1: "Feels More Natural" (18/20 participants)\n\n**Subthemes:**\n- Conversational vs mechanical (15/20)\n- Authentic expression of preferences (12/20)\n- Less cognitive load than rating (10/20)\n\n**Representative Quotes:**\n\n> *"I felt like I was talking to a friend about what I like, not filling out a boring survey."* - P7 (5Q group)\n\n> *"Rating random movies is exhausting. I don\'t know half of them. Questions let me explain what I actually enjoy."* - P12 (3Q group)\n\n### Theme 2: "Surprisingly Accurate" (16/20 participants)\n\n**Subthemes:**\n- Better than expected quality (16/20)\n- Captured niche preferences (11/20)\n- Avoided obvious/mainstream bias (8/20)\n\n**Quotes:**\n\n> *"I mentioned I like slow-burn thrillers, and it recommended some obscure gems I\'d never heard of but loved."* - P3 (5Q group)\n\n> *"Most platforms just give me Marvel movies. This actually got my taste for indie sci-fi."* - P15 (7Q group)\n\n### Theme 3: "Sweet Spot at 5 Questions" (14/20 participants)\n\n**Subthemes:**\n- 3 questions too shallow (9/20)\n- 7 questions felt tedious (11/20)\n- 5 questions "just right" (14/20)\n\n**Quotes:**\n\n> *"3 questions didn\'t capture enough. I have complex tastes."* - P4 (3Q group)\n\n> *"By question 7, I was repeating myself. Felt like overkill."* - P18 (7Q group)\n\n> *"5 questions was perfect - enough to express preferences without getting bored."* - P9 (5Q group)\n\n### Theme 4: Desire for Transparency (13/20 participants)\n\n**Subthemes:**\n- Want to see extracted preferences (13/20)\n- Ability to correct misunderstandings (9/20)\n- Explain why recommendations given (8/20)\n\n**Quotes:**\n\n> *"I\'d love to see what the system thinks I like based on my answers."* - P11 (5Q group)\n\n> *"Show me: \'We recommended this because you said X.\' That builds trust."* - P14 (7Q group)\n\n## Integration: Quant + Qual\n\n**Convergence:**\n- Quantitative: 5Q optimal accuracy\n- Qualitative: 5Q "sweet spot" for UX\n- **Conclusion:** Both methods support 5-question approach\n\n**Divergence:**\n- Quantitative: 7Q slightly better accuracy\n- Qualitative: 7Q causes fatigue and abandonment\n- **Resolution:** Accuracy gain small (+2% vs 5Q), UX cost high → Stick with 5Q',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    },
    {
      id: 'discussion-conclusion',
      title: 'Discussion, Limitations & Future Work',
      description: 'Interpret results, discuss implications, and outline next steps',
      order: 6,
      sections: [
        {
          id: 'interpretation',
          title: 'Interpretation of Results',
          type: 'text-editor',
          order: 1,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Key Findings Interpretation\n\n### Finding 1: LLMs Enable High-Quality Zero-Shot Recommendations\n\n**What We Found:**\n- 5 questions → 71.2% NDCG (vs 54.2% baseline)\n- 31% improvement with minimal user effort\n\n**Why This Matters:**\n- Validates hypothesis: LLMs can extract rich preference signals from text\n- Demonstrates practical viability for production systems\n- Challenges assumption that collaborative filtering needs 20+ interactions\n\n**Mechanism:**\n- LLMs leverage pretrained world knowledge (movies, genres, themes)\n- Semantic understanding maps free text to latent preference space\n- Zero-shot transfer: No user-specific fine-tuning needed\n\n### Finding 2: Diminishing Returns After 5 Questions\n\n**What We Found:**\n- 5Q → 71.2% NDCG\n- 7Q → 72.8% NDCG (+1.6% absolute, +2.2% relative)\n\n**Why This Matters:**\n- Information theory confirmed: Entropy reduction plateaus\n- UX trade-off: Small accuracy gain vs higher abandonment\n- Design guideline: 5 open-ended questions optimal\n\n**Practical Implication:**\n- Don\'t over-engineer onboarding\n- Focus on question quality over quantity\n\n### Finding 3: User Experience Drives Adoption\n\n**What We Found:**\n- 91% completion rate (3Q) vs 68% (baseline)\n- Qualitative: "Feels more natural" theme\n\n**Why This Matters:**\n- Cold-start isn\'t just accuracy problem - it\'s UX problem\n- Natural language onboarding reduces friction\n- Higher completion → More users get quality recommendations\n\n**Behavioral Insight:**\n- Users prefer self-expression over mechanical rating\n- Conversational UX builds engagement and trust\n\n## Answering Research Questions\n\n**RQ1: Can LLMs generate accurate user profiles from minimal text?**\n✅ **YES** - 71% accuracy with 5 questions (vs 54% baseline with 20 ratings)\n\n**RQ2: How does quality scale with text amount?**\n✅ **Logarithmic scaling confirmed** - 3Q (65%) → 5Q (71%) → 7Q (73%)\n\n**RQ3: What question types extract most signal?**\n✅ **Open-ended preference questions** > Demographics by 15% (exploratory finding)',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'implications',
          title: 'Theoretical & Practical Implications',
          type: 'text-editor',
          order: 2,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Theoretical Implications\n\n### For Recommendation Systems Research\n\n**Contribution 1: Zero-Shot Preference Learning Paradigm**\n- Challenges collaborative filtering orthodoxy\n- Opens new research direction: LLM-based preference modeling\n- Demonstrates viability of natural language as preference input\n\n**Contribution 2: Information-Theoretic Framing**\n- Validates diminishing returns hypothesis\n- Provides theoretical framework for question design\n- Connects preference elicitation to entropy reduction\n\n### For Human-Computer Interaction\n\n**Contribution 3: Conversational Onboarding Effectiveness**\n- Natural language reduces cognitive load\n- Self-expression improves engagement\n- Design pattern: Open-ended > Closed-ended for preference capture\n\n## Practical Implications\n\n### For Industry (Platform Designers)\n\n**Implication 1: Reduce Onboarding Friction**\n- Replace "rate 20 items" with 5 questions\n- Improve completion rates by 25%+\n- Faster time-to-value for new users\n\n**Implementation Guidance:**\n```\n1. Design 5 open-ended questions:\n   - What genres/topics do you enjoy?\n   - What do you dislike or avoid?\n   - Describe your ideal [movie/book/product]\n   - Who are your favorite [artists/creators]?\n   - What\'s a recent favorite and why?\n\n2. Use GPT-4 to extract preferences:\n   - System prompt: "Extract user preferences..."\n   - Output: JSON preference profile\n\n3. Map to item embeddings:\n   - Similarity search in vector space\n   - Rank by preference alignment\n```\n\n**Implication 2: Cost-Effective Personalization**\n- LLM API cost: $0.05 per user onboarding\n- vs $2.00 server cost for 20-item rating flow\n- 40x cost reduction\n\n**Implication 3: Applicability Across Domains**\n- Tested on: Movies\n- Likely applicable: Books, music, products, content\n- Requires: Domain covered in LLM training data\n\n### For Researchers\n\n**Implication 4: Benchmark & Open-Source**\n- Public dataset: LLM-RecSys-Benchmark\n- Code: GitHub repo for reproducibility\n- Enables future comparisons and improvements',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'limitations',
          title: 'Limitations of This Study',
          type: 'text-editor',
          order: 3,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Study Limitations\n\n### Limitation 1: Single Domain (Movies)\n\n**Issue:**\n- Only tested on MovieLens dataset\n- Movies well-represented in LLM training data\n- May not generalize to niche domains\n\n**Mitigation in Future Work:**\n- Test on books, music, products, restaurants\n- Evaluate on specialized domains (scientific articles, B2B tools)\n\n### Limitation 2: Sample Demographics\n\n**Issue:**\n- Over-representation of young adults (18-40)\n- Under-representation of older adults (65+)\n- Western, English-speaking participants\n\n**Mitigation:**\n- Recruit older adults (may have different UX preferences)\n- International study with non-English languages\n- Check if findings hold across cultures\n\n### Limitation 3: Short-Term Evaluation (30 Days)\n\n**Issue:**\n- Don\'t know long-term retention (6+ months)\n- Preference drift not captured\n- Novelty effect may inflate satisfaction\n\n**Mitigation:**\n- Longitudinal study (6-12 months)\n- Track preference evolution over time\n- Measure long-term retention and churn\n\n### Limitation 4: LLM Model Dependency\n\n**Issue:**\n- Results specific to GPT-4 (January 2025 snapshot)\n- Model updates may change performance\n- Cost and latency constraints\n\n**Mitigation:**\n- Test with other LLMs (Claude, Gemini, Llama)\n- Evaluate robustness to model variations\n- Explore fine-tuned smaller models for cost reduction\n\n### Limitation 5: Text-Based Input Assumption\n\n**Issue:**\n- Assumes users can/will articulate preferences\n- May disadvantage non-native speakers, low literacy\n- Voice input not tested\n\n**Mitigation:**\n- Support voice-to-text onboarding\n- Test with diverse literacy levels\n- Hybrid: Text + visual browsing\n\n## Threats to Validity (Not Fully Addressed)\n\n**External Validity:**\n- Lab study ≠ real-world onboarding (distractions, context)\n- Compensation may increase engagement (Hawthorne effect)\n\n**Construct Validity:**\n- NDCG doesn\'t measure serendipity or diversity\n- Satisfaction self-reported (social desirability bias)\n\n**Statistical Conclusion:**\n- Multiple comparisons increase Type I error risk\n- Bonferroni correction applied, but conservative',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'future_work',
          title: 'Future Research Directions',
          type: 'text-editor',
          order: 4,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Near-Term Extensions (Next 6-12 Months)\n\n### Extension 1: Multi-Domain Validation\n\n**Goal:** Test generalizability across domains\n\n**Domains to Test:**\n- Books (Amazon, Goodreads)\n- Music (Spotify, Last.fm)\n- Products (Amazon e-commerce)\n- Restaurants (Yelp)\n\n**Hypothesis:** 70%+ accuracy generalizes to domains well-represented in LLM training\n\n### Extension 2: Non-English Languages\n\n**Goal:** Evaluate cross-lingual performance\n\n**Languages:**\n- Spanish, French, German (high-resource)\n- Arabic, Hindi, Chinese (morphologically diverse)\n\n**Hypothesis:** Performance degradation < 10% for high-resource languages\n\n### Extension 3: Hybrid Approaches\n\n**Goal:** Combine LLM onboarding with implicit signals\n\n**Approach:**\n- LLM questions (explicit preferences)\n- + Browsing behavior (implicit preferences)\n- + Contextual signals (time, device, location)\n\n**Hypothesis:** Hybrid > LLM-only by 5-10%\n\n### Extension 4: Adaptive Questioning\n\n**Goal:** Dynamically adjust question count based on user\n\n**Approach:**\n- Start with 3 questions\n- If uncertainty high → Ask 2 more\n- Stop when confidence threshold reached\n\n**Hypothesis:** Reduces avg questions to 4.2 while maintaining accuracy\n\n## Long-Term Research Directions (1-3 Years)\n\n### Direction 1: Multimodal Preference Elicitation\n\n**Vision:** Combine text + images + voice\n\n**Example:**\n- User uploads photo: "I like this aesthetic"\n- Voice: "Recommend books like [podcast description]"\n- Visual browsing: Click examples to refine\n\n**Challenge:** Unified multimodal preference representation\n\n### Direction 2: Conversational Refinement\n\n**Vision:** Multi-turn dialogue for preference clarification\n\n**Example:**\n- User: "I like sci-fi"\n- System: "Hard sci-fi (realistic) or space opera (adventure)?"\n- User: "Hard sci-fi with social themes"\n- System: *Refines recommendations*\n\n**Challenge:** Balance depth vs friction\n\n### Direction 3: Privacy-Preserving LLM Recommendations\n\n**Vision:** Local LLMs for preference extraction (no data sent to cloud)\n\n**Approach:**\n- Fine-tune smaller LLM (Llama 3.1 8B) for preference extraction\n- Run on-device or in secure enclave\n- Federated learning for model updates\n\n**Challenge:** Accuracy vs model size trade-off\n\n### Direction 4: Explainable Preference Profiles\n\n**Vision:** Show users extracted preferences + allow editing\n\n**UI Mock:**\n```\nBased on your answers, we think you like:\n✅ Hard sci-fi (+edit)\n✅ Character-driven stories (+edit)  \n✅ Realistic world-building (+edit)\n❌ Romance subplots (-remove)\n\n+ Add preference\n```\n\n**Hypothesis:** Transparency increases trust and accuracy\n\n## Open Questions\n\n1. Can LLMs capture evolving preferences over time?\n2. How to detect and adapt to preference drift?\n3. What\'s the role of serendipity in LLM-based recommendations?\n4. Can LLMs explain *why* an item is recommended?\n5. How to handle adversarial users (gaming the system)?',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'half', padding: 'medium', borders: true }
          },
          required: true
        },
        {
          id: 'conclusion',
          title: 'Conclusion & Contribution Summary',
          type: 'text-editor',
          order: 5,
          defaultContent: {
            type: 'text-editor',
            markdown: '## Summary of Contributions\n\n### Theoretical Contributions\n\n1. **Zero-Shot Preference Learning Framework**\n   - Demonstrated LLMs can extract preferences without user history\n   - Provided theoretical grounding in information theory\n   - Opened new research direction for RecSys community\n\n2. **Optimal Question Design Principles**\n   - 5 open-ended questions optimal (accuracy vs UX)\n   - Logarithmic information gain curve validated\n   - Question quality > quantity\n\n3. **Mixed-Methods Evidence**\n   - Quantitative: 31% accuracy improvement\n   - Qualitative: "Natural" and "accurate" UX themes\n   - Convergent validation strengthens findings\n\n### Practical Contributions\n\n1. **Production-Ready Framework**\n   - Open-source implementation (GitHub)\n   - API integration guide for GPT-4\n   - Cost analysis: $0.05 per user onboarding\n\n2. **Public Benchmark Dataset**\n   - 320 user responses (text + ratings)\n   - Enables reproducibility and comparison\n   - Accelerates future research\n\n3. **Design Guidelines for Practitioners**\n   - 5-question template with examples\n   - LLM prompt engineering best practices\n   - A/B testing framework for validation\n\n## Final Reflection\n\nThis research demonstrates that **large language models fundamentally change how we approach the cold-start problem in recommendation systems**. By leveraging pretrained world knowledge and semantic understanding, LLMs enable high-quality personalization from minimal user input, replacing tedious rating tasks with natural conversation.\n\nThe implications extend beyond recommendation systems to **any domain requiring rapid preference elicitation**: e-commerce personalization, content curation, career guidance, healthcare decision support. As LLMs continue to improve, zero-shot preference learning will become increasingly viable, reshaping how we design user onboarding experiences.\n\n**Key Takeaway:** The future of personalization is conversational, not mechanical.\n\n## Acknowledgments\n\n- Advisor: Dr. [Name], for invaluable guidance\n- Participants: 320 individuals who contributed their time\n- Funding: [Grant/Fellowship name and number]\n- Code: Built on HuggingFace Transformers and Pinecone vector DB\n\n## Publication Plan\n\n**Target Venues:**\n- Primary: ACM RecSys 2025 (Deadline: May 2025)\n- Secondary: SIGIR 2025, WWW 2026\n- Workshop: LLMs for RecSys (KDD 2025)\n\n**Dissemination:**\n- Conference presentation\n- Blog post (Towards Data Science)\n- GitHub repo (code + data)\n- University press release',
            format: 'markdown'
          },
          settings: {
            isVisible: true,
            isCollapsible: false,
            isCollapsed: false,
            layout: { width: 'full', padding: 'medium', borders: true }
          },
          required: true
        }
      ],
      settings: {
        isVisible: true,
        allowComments: true,
        layout: { type: 'two_column', sectionSpacing: 'normal' }
      }
    }
  ],
  settings: {
    allowPageAddition: true,
    allowPageRemoval: false,
    allowSectionAddition: true,
    allowSectionRemoval: false,
    allowSectionReordering: true,
    customizableThemes: true
  }
};

// Template registry
export const projectTemplates: Record<ProjectTemplate, ProjectTemplateDefinition> = {
  system_design: systemDesignTemplate,
  ml_design: mlDesignTemplate,
  genai_design: genaiDesignTemplate,
  product_design: productDesignTemplate,
  research: researchTemplate,
  custom: {
    id: 'custom',
    name: 'Custom Project',
    description: 'Start with a blank project and build your own structure',
    version: '1.0.0',
    pages: [
      {
        id: 'overview',
        title: 'Project Overview',
        description: 'Basic project information',
        order: 1,
        sections: [
          {
            id: 'description',
            title: 'Description',
            type: 'text-editor',
            order: 1,
            defaultContent: {
              type: 'text-editor',
              markdown: '# Project Title\n\nProject description goes here...',
              format: 'markdown'
            },
            settings: {
              isVisible: true,
              isCollapsible: false,
              isCollapsed: false,
              layout: { width: 'full', padding: 'medium', borders: true }
            },
            required: true
          }
        ],
        settings: {
          isVisible: true,
          allowComments: true,
          layout: { type: 'single_column', sectionSpacing: 'normal' }
        }
      }
    ],
    settings: {
      allowPageAddition: true,
      allowPageRemoval: true,
      allowSectionAddition: true,
      allowSectionRemoval: true,
      allowSectionReordering: true,
      customizableThemes: true
    }
  }
};

// Helper functions
export function getProjectTemplate(templateId: ProjectTemplate): ProjectTemplateDefinition {
  return projectTemplates[templateId];
}

export function getAvailableTemplates(): ProjectTemplateDefinition[] {
  return Object.values(projectTemplates);
}

export function createProjectFromTemplate(
  templateId: ProjectTemplate,
  projectTitle: string,
  projectDescription: string,
  ownerId: string
): any {
  const template = getProjectTemplate(templateId);
  const now = new Date().toISOString();

  // Convert template to actual project structure
  const pages: Record<string, any> = {};

  template.pages.forEach(pageTemplate => {
    const sections: Record<string, any> = {};

    pageTemplate.sections.forEach(sectionTemplate => {
      sections[sectionTemplate.id] = {
        id: sectionTemplate.id,
        title: sectionTemplate.title,
        type: sectionTemplate.type,
        order: sectionTemplate.order,
        content: sectionTemplate.defaultContent,
        settings: sectionTemplate.settings,
        progress: {
          status: 'not_started',
          completionPercentage: 0,
          lastUpdated: now
        }
      };
    });

    pages[pageTemplate.id] = {
      id: pageTemplate.id,
      title: pageTemplate.title,
      description: pageTemplate.description,
      order: pageTemplate.order,
      sections: sections,
      settings: pageTemplate.settings,
      progress: {
        status: 'not_started',
        completedSections: [],
        totalSections: pageTemplate.sections.length,
        completionPercentage: 0,
        lastUpdated: now
      }
    };
  });

  return {
    id: '', // Will be generated by Firestore
    title: projectTitle,
    description: projectDescription,
    templateType: templateId,
    createdAt: now,
    updatedAt: now,
    ownerId: ownerId,
    pages: pages,
    settings: {
      isPublic: false,
      allowComments: true,
      allowCollaboration: false,
      collaborators: [],
      template: {
        templateId: templateId,
        templateVersion: template.version,
        customizations: []
      },
      customizations: {
        theme: 'default',
        colorScheme: 'light'
      }
    },
    metadata: {
      tags: [],
      category: 'general',
      complexity: 'medium',
      status: 'draft',
      phase: 'planning'
    }
  };
}