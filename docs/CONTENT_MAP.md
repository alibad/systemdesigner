# System Designer Content Map

## Overview
Total Pages: ~150+ pages across 5 main sections

## Content Structure Analysis

### 1. FUNDAMENTALS (15 pages)
**Purpose**: Core system design concepts and principles
- what-is-system-design
- system-design-framework
- scalability-basics
- advanced-scaling
- latency-vs-throughput
- performance-metrics
- reliability-availability
- bottleneck-analysis
- database-fundamentals
- acid-properties
- data-modeling
- api-design
- communication-patterns
- monolith-to-microservices

### 2. GENAI (24 pages)
**Purpose**: Generative AI concepts, architectures, and patterns

#### Core Concepts
- llm-intro
- transformers *(moved from technology)*
- llms *(moved from technology)*
- prompt-engineering

#### RAG & Retrieval (DUPLICATION DETECTED!)
- rag-systems (conceptual)
- rag *(moved from technology, implementation focused)*
- advanced-rag (advanced patterns)
- knowledge-graphs

#### AI Applications
- conversational-ai
- function-calling
- ai-agents
- langchain-production
- multimodal-ai
- text-to-image
- image-captioning
- video-generation
- smart-text-completion
- translation-systems
- personalized-genai

#### Infrastructure & Operations
- llm-serving
- token-management
- genai-monitoring
- production-deployment
- ai-safety

### 3. ML-SYSTEMS (27 pages)
**Purpose**: ML engineering and system architecture

#### Fundamentals (DUPLICATION with GenAI!)
- ml-fundamentals
- llm-fundamentals *(overlaps with genai/llm-intro)*
- ml-systems-design

#### Data & Pipeline (DUPLICATION DETECTED!)
- data-pipeline-design
- data-pipelines *(duplicate concept)*
- feature-engineering
- training-data-management
- data-distribution-shifts

#### Model Lifecycle
- model-training
- model-evaluation
- model-serving *(overlaps with genai/llm-serving)*
- mlops-monitoring *(overlaps with genai/genai-monitoring)*
- ab-testing
- continual-learning

#### Advanced Topics (DUPLICATION with GenAI!)
- advanced-ai-agents *(overlaps with genai/ai-agents)*
- advanced-reasoning
- rlhf
- human-in-the-loop-ml
- autonomous-systems

#### Domain Specific
- healthcare-ai
- financial-ml
- scientific-ml
- neuromorphic-computing
- quantum-ml

### 4. TECHNOLOGY (78 pages)
**Purpose**: Specific tools, frameworks, and technologies

#### AI/ML Frameworks
- langchain
- autogen
- crewai
- openai
- llamaindex
- pytorch
- tensorflow
- mlflow
- vllm
- vector-databases

#### Databases (9 pages)
- mysql, postgresql, mongodb, sqlite
- cassandra, clickhouse, dynamodb
- influxdb, neo4j

#### Cache & Storage
- redis, memcached, varnish
- hazelcast, object-storage

#### Message/Streaming (5 pages)
- kafka, rabbitmq, pulsar
- activemq, sqs

#### Cloud & Infrastructure
- aws, gcp, azure
- docker, kubernetes, helm
- terraform, ansible
- nginx, istio

#### API & Communication (DUPLICATION!)
- api-design *(duplicates fundamentals/api-design)*
- api-paradigms
- graphql, grpc
- websocket, webrtc
- http2-http3, udp-tcp

#### DevOps & Monitoring (DUPLICATION!)
- jenkins, gitlab-ci
- prometheus, grafana
- observability *(overlaps with mlops-monitoring)*

#### Security & Auth
- oauth2, jwt, keycloak, vault, consul

#### Data Processing
- spark, mapreduce
- streaming *(generic, overlaps with kafka/pulsar)*

#### System Patterns (DUPLICATION!)
- consistent-hashing
- circuit-breakers
- rate-limiting
- event-sourcing
- replication-sharding
- service-mesh
- chaos-engineering
- concurrency *(overlaps with fundamentals concepts)*

#### Data Structures
- sstable, trie, etcd

#### Workflow
- temporal

### 5. CASE-STUDIES (11 pages)
**Purpose**: Real-world system implementations
- openai-chatgpt
- netflix-streaming
- uber-ridesharing
- whatsapp-messaging
- instagram-photos
- discord-communication
- github-collaboration
- zoom-video
- key-value-store
- unique-id-generator
- web-crawler

### 6. PRACTICE (11 pages)
**Purpose**: Interactive exercises and problems
- chat-system
- distributed-cache
- news-feed
- notification-system
- payment-system
- ride-sharing
- search-engine
- url-shortener
- video-streaming
- problems
- quiz/[topic]

## 🔴 MAJOR DUPLICATIONS & OVERLAPS

### 1. **API Design**
- fundamentals/api-design
- technology/api-design
- technology/api-paradigms

### 2. **RAG Systems**
- genai/rag-systems (conceptual)
- genai/rag (implementation)
- genai/advanced-rag (patterns)

### 3. **LLM/AI Concepts**
- genai/llm-intro
- genai/llms
- ml-systems/llm-fundamentals

### 4. **AI Agents**
- genai/ai-agents
- ml-systems/advanced-ai-agents

### 5. **Monitoring & Observability**
- ml-systems/mlops-monitoring
- genai/genai-monitoring
- technology/observability
- technology/prometheus
- technology/grafana

### 6. **Model Serving**
- ml-systems/model-serving
- genai/llm-serving

### 7. **Data Pipelines**
- ml-systems/data-pipeline-design
- ml-systems/data-pipelines

### 8. **Streaming**
- technology/streaming (generic)
- technology/kafka
- technology/pulsar
- technology/spark

### 9. **Concurrency & System Concepts**
- fundamentals/performance-metrics
- fundamentals/latency-vs-throughput
- technology/concurrency

## 🔵 MISSING CONNECTIONS

### Topics that should reference each other:
1. **Vector Databases** ← → **RAG Systems**
2. **Transformers** ← → **LLMs** ← → **AI Agents**
3. **MLflow** ← → **MLOps Monitoring** ← → **Model Serving**
4. **Kafka/Pulsar** ← → **Streaming** ← → **Data Pipelines**
5. **API Design** ← → **GraphQL/gRPC** ← → **Service Mesh**

## 🟢 PROPOSED REORGANIZATION

### Option 1: Strict Separation
```
/fundamentals   - Core concepts only (no duplicates)
/concepts       - All conceptual/architectural content
  /system-design
  /ml-concepts
  /genai-concepts
/implementation - All implementation guides
  /ml-implementation  
  /genai-implementation
/technologies   - Only specific tools/frameworks
/case-studies   - Real-world examples
/practice       - Exercises
```

### Option 2: Domain-Based Organization
```
/core           - Fundamentals everyone needs
/backend        - Traditional backend systems
  /concepts
  /technologies
  /patterns
/ml             - All ML/AI content
  /concepts (includes transformers, llms, rag)
  /engineering (pipelines, serving, monitoring)
  /frameworks (pytorch, tensorflow, etc.)
/case-studies
/practice
```

### Option 3: Learning Path Based
```
/beginner
  /fundamentals
  /first-systems
/intermediate
  /system-patterns
  /ml-basics
  /technologies
/advanced
  /ml-systems
  /genai
  /production
/reference      - All technologies as reference
/practice
```

## 🎯 RECOMMENDATIONS

1. **Eliminate Duplicates**: Merge duplicate content, keep one canonical version
2. **Create Clear Boundaries**: Define what belongs in each section
3. **Add Cross-References**: Link related topics explicitly
4. **Standardize Naming**: Use consistent naming patterns
5. **Create Topic Graph**: Build actual dependency/relationship graph
6. **Add Metadata**: Each page should declare its prerequisites and related topics

## Next Steps
1. Choose reorganization approach
2. Create migration plan
3. Build content registry with relationships
4. Implement cross-referencing system
5. Add content validation to prevent future duplicates