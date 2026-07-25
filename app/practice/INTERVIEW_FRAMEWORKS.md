# System Design Interview Frameworks

## Overview
This guide provides structured frameworks for different types of system design interviews. Each framework is optimized for the specific problem domain and interview expectations.

## Framework Selection Guide

### Traditional System Design
**Use for:** Web services, distributed systems, infrastructure design
**Examples:** Search engines, social media platforms, messaging systems, payment processors
**Duration:** 45-60 minutes
**Framework:** 4-section approach

### GenAI & ML Systems
**Use for:** Machine learning pipelines, AI-powered features, data processing systems
**Examples:** Recommendation systems, content moderation, language models, computer vision
**Duration:** 45-60 minutes  
**Framework:** 8-section approach

### Traditional ML Systems
**Use for:** Classical ML applications, data pipelines, analytics systems
**Examples:** Fraud detection, A/B testing, feature stores, batch processing
**Duration:** 45-60 minutes
**Framework:** 7-section approach

---

## Traditional System Design Framework (4 Sections)

### 1. Problem Understanding & Scope (10-15 minutes)

#### 1.1 Clarifying Questions
Interactive Q&A to narrow scope and understand requirements:
- **Functional Requirements**: What features must the system support?
- **Non-Functional Requirements**: Scale, performance, availability, consistency
- **Constraints**: Budget, timeline, existing infrastructure, compliance
- **Users & Usage Patterns**: Who uses it? How do they use it? Peak times?

#### 1.2 Back-of-the-Envelope Calculations
Realistic scale estimation with specific numbers:
- **User Scale**: MAU, DAU, concurrent users, growth rate
- **Request Volume**: QPS average/peak, read/write ratio
- **Storage Requirements**: Data per user, retention period, total storage
- **Bandwidth**: Ingress/egress, CDN requirements
- **Infrastructure Costs**: Servers, storage, network (monthly estimates)

### 2. High-Level Design & Buy-In (15-20 minutes)

#### 2.1 System Architecture Overview
End-to-end flow with major components:
- **Client → Load Balancer → API Gateway → Services → Database → Cache**
- Component responsibilities and interactions
- Data flow for key user scenarios
- Technology choices and rationale

#### 2.2 API Design
RESTful endpoints or service contracts:
- **Core APIs**: Create, read, update, delete operations
- **Request/Response Formats**: JSON schemas, parameters
- **Error Handling**: Status codes, error responses
- **Authentication**: Auth flow, security considerations

#### 2.3 Database Schema
Data model and storage strategy:
- **Tables/Collections**: Primary entities and relationships
- **Indexing Strategy**: Query patterns, performance optimization
- **Storage Technology**: SQL vs NoSQL choice rationale
- **Data Partitioning**: Sharding strategy if needed

### 3. Design Deep Dive (15-20 minutes)

#### 3.1 Scalability & Performance
Handling growth and high traffic:
- **Horizontal Scaling**: Load balancing, stateless services
- **Database Scaling**: Read replicas, sharding, caching strategy
- **Caching Layers**: Application cache, CDN, database cache
- **Performance Bottlenecks**: Identification and mitigation

#### 3.2 Reliability & Availability
System resilience and fault tolerance:
- **Failure Modes**: Single points of failure, cascade failures
- **Redundancy**: Multi-region, backup strategies
- **Monitoring & Alerting**: Health checks, metrics, incident response
- **Disaster Recovery**: RTO/RPO requirements, backup restoration

#### 3.3 Security & Compliance
Protecting data and meeting requirements:
- **Authentication & Authorization**: User identity, access control
- **Data Protection**: Encryption at rest/transit, PII handling
- **Network Security**: VPC, firewalls, rate limiting
- **Compliance**: GDPR, HIPAA, SOX requirements

### 4. Wrap-up & Extensions (5-10 minutes)

#### 4.1 Trade-offs & Alternatives
Decisions made and why:
- **Technology Choices**: Why this database? This architecture?
- **Consistency vs Availability**: CAP theorem implications
- **Cost vs Performance**: Optimization decisions
- **Alternative Approaches**: What else could work?

#### 4.2 Future Considerations
Scaling beyond initial design:
- **10x Growth**: How would the system handle 10x traffic?
- **New Features**: Analytics, recommendations, mobile support
- **Technical Debt**: Areas that would need refactoring
- **Monitoring**: Key metrics to track for success

---

## GenAI & ML Systems Framework (8 Sections)

### 1. Requirement Clarifications (5-8 minutes)
Simulate interview conversation to scope down the problem:
- **Data Sources**: Where does training data come from? User interactions? Public datasets?
- **Scale**: How many users? Requests per second? Data volume?
- **Latency**: Real-time (< 100ms)? Near real-time (< 1s)? Batch processing?
- **Deployment**: On-device? Cloud? Hybrid?
- **Privacy**: PII concerns? GDPR compliance? Enterprise requirements?
- **Inputs/Outputs**: What exactly goes in and comes out of the system?

### 2. ML Task Framing (5-8 minutes)
- **System Input**: Specific data format and structure
- **System Output**: What the model should produce
- **ML Approach**: Classification? Generation? Ranking? Recommendation?
- **Success Metrics**: Accuracy, latency, throughput, business metrics
- **Approach Comparison**: Why this approach vs alternatives?

### 3. Data Preparation (5-8 minutes)
- **Text Processing**: Cleaning, normalization, encoding
- **Tokenization**: BPE, SentencePiece, custom vocabularies
- **Quality Controls**: Deduplication, filtering, validation
- **Privacy**: PII detection, anonymization, differential privacy
- **Data Pipeline**: ETL, streaming vs batch, monitoring

### 4. Model Architecture (5-8 minutes)
- **Architecture**: Transformer, CNN, RNN, hybrid approaches
- **Model Size**: Parameter count, memory requirements
- **Context Handling**: Sequence length, attention mechanisms
- **Personalization**: User embeddings, adaptation layers

### 5. Training Pipeline (5-8 minutes)
- **Pre-training**: Unsupervised learning on large corpus
- **Fine-tuning**: Task-specific supervised learning
- **Multi-stage**: Domain adaptation, instruction tuning
- **Sampling**: Data selection, negative sampling, augmentation
- **Infrastructure**: Distributed training, GPUs, optimization

### 6. Evaluation Framework (5-8 minutes)
- **Offline Metrics**: BLEU, ROUGE, perplexity, human evaluation
- **Online Testing**: A/B testing, statistical significance
- **Monitoring**: Model drift, performance degradation
- **Failure Analysis**: Error categorization, root cause analysis

### 7. Production ML System Design (5-8 minutes)
- **Trigger**: When does the system activate?
- **Pre-process**: Input validation, feature extraction, context building
- **Inference**: Model serving, batching, caching
- **Post-process**: Output formatting, safety filtering, ranking
- **Architecture**: End-to-end system flow with specific components

### 8. Scaling & Trade-offs (5-8 minutes)
- **Scaling**: How to handle 10x, 100x growth
- **Cost Optimization**: Model compression, efficient serving
- **Safety**: Content filtering, bias mitigation
- **Compliance**: Regulatory requirements, auditability
- **Alternative Approaches**: What else could work? Trade-offs?

---

## Traditional ML Systems Framework (7 Sections)

### 1. Problem Understanding & Requirements (8-10 minutes)
- **Business Problem**: What are we trying to predict/optimize?
- **Data Availability**: What data do we have? Quality? Volume?
- **Success Metrics**: Precision, recall, business KPIs
- **Constraints**: Latency, interpretability, regulatory

### 2. Data Pipeline Design (8-10 minutes)
- **Data Sources**: Batch, streaming, APIs, databases
- **ETL Process**: Extract, transform, load operations
- **Feature Engineering**: Feature selection, transformations
- **Data Quality**: Validation, monitoring, alerting

### 3. Model Development (8-10 minutes)
- **Algorithm Selection**: Linear, tree-based, neural networks
- **Feature Selection**: Statistical methods, domain expertise
- **Model Training**: Cross-validation, hyperparameter tuning
- **Model Comparison**: Multiple algorithms, ensemble methods

### 4. Model Evaluation & Validation (8-10 minutes)
- **Offline Evaluation**: Hold-out, cross-validation, statistical tests
- **Online Evaluation**: A/B testing, gradual rollout
- **Model Monitoring**: Performance drift, data drift
- **Failure Analysis**: Error analysis, bias detection

### 5. Production System Design (8-10 minutes)
- **Training Pipeline**: Automated retraining, model versioning
- **Inference Service**: Batch vs real-time, API design
- **Model Serving**: Containerization, scaling, load balancing
- **Data Storage**: Feature stores, model artifacts, predictions

### 6. Monitoring & Maintenance (5-8 minutes)
- **Model Performance**: Accuracy, latency, throughput metrics
- **Data Quality**: Input validation, distribution monitoring
- **System Health**: Infrastructure monitoring, alerting
- **Model Updates**: Retraining triggers, deployment strategy

### 7. Scale & Production Considerations (5-8 minutes)
- **Scalability**: Handling increased load, data volume
- **Cost Optimization**: Infrastructure, compute efficiency
- **Security**: Model protection, data privacy
- **Compliance**: Regulatory requirements, auditability

---

## JSX Template Structures

### Traditional System Design Template
```tsx
{/* 1. Problem Understanding & Scope */}
{/*   1.1 Clarifying Questions */}
{/*   1.2 Back-of-the-Envelope Calculations */}

{/* 2. High-Level Design & Buy-In */}
{/*   2.1 System Architecture Overview */}
{/*   2.2 API Design */}
{/*   2.3 Database Schema */}

{/* 3. Design Deep Dive */}
{/*   3.1 Scalability & Performance */}
{/*   3.2 Reliability & Availability */}
{/*   3.3 Security & Compliance */}

{/* 4. Wrap-up & Extensions */}
{/*   4.1 Trade-offs & Alternatives */}
{/*   4.2 Future Considerations */}
```

### GenAI Template
```tsx
{/* 1. Requirement Clarifications */}
{/* 2. ML Task Framing */} 
{/* 3. Data Preparation */}
{/* 4. Model Architecture */}
{/* 5. Training Pipeline */}
{/* 6. Evaluation Framework */}
{/* 7. Production ML System Design */}
{/* 8. Scaling & Trade-offs */}
```

### Traditional ML Template
```tsx
{/* 1. Problem Understanding & Requirements */}
{/* 2. Data Pipeline Design */}
{/* 3. Model Development */}
{/* 4. Model Evaluation & Validation */}
{/* 5. Production System Design */}
{/* 6. Monitoring & Maintenance */}
{/* 7. Scale & Production Considerations */}
```

## Technical Depth Guidelines

### For All Frameworks
- **Include Specific Numbers**: Latency targets, throughput, storage, costs
- **Show Infrastructure Requirements**: Server counts, memory, network
- **Provide Cost Estimates**: Monthly operational costs where relevant
- **Compare Alternatives**: Concrete trade-offs between approaches
- **Use Realistic Scale**: Industry-standard volumes and performance

### Traditional System Design Specifics
- **Focus on Distributed Systems**: Consistency, availability, partition tolerance
- **Emphasize Scalability**: How to handle 10x, 100x growth
- **Include Monitoring**: Observability, alerting, incident response
- **Security First**: Authentication, authorization, data protection

### ML Systems Specifics  
- **Model Performance**: Accuracy, precision, recall, F1 scores
- **Infrastructure Costs**: GPU hours, storage, serving costs
- **Data Quality**: Validation, monitoring, drift detection
- **Experiment Design**: A/B testing, statistical significance

## Interview Tips

### Time Management
- **Clarifications**: Don't spend more than 15 minutes on requirements
- **High-Level Design**: Get buy-in before diving deep
- **Deep Dive**: Focus on 2-3 critical components, not everything
- **Wrap-up**: Always leave 5-10 minutes for trade-offs and scaling

### Communication
- **Think Out Loud**: Narrate your thought process
- **Draw Diagrams**: Visual representation of architecture
- **Ask for Feedback**: "Does this design make sense?" "Any concerns?"
- **Justify Decisions**: Why this technology? Why this approach?

### Common Mistakes to Avoid
- **Over-Engineering**: Don't design for 1000x scale immediately
- **Under-Scoping**: Don't ignore important non-functional requirements
- **Technology Fixation**: Focus on solving the problem, not using cool tech
- **Ignoring Trade-offs**: Every decision has pros and cons