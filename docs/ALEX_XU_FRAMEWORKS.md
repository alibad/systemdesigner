# Alex Xu & Industry-Standard Interview Frameworks
## Exact Structures for System Design, ML, and GenAI Interviews

This document captures the **exact frameworks** from Alex Xu's books and industry best practices.

---

## 1. System Design Interview Framework
**Source**: Alex Xu - "System Design Interview: An Insider's Guide" (Chapter 3)

### ⏱️ Total Time: 45-60 minutes

### **The 4-Step Framework**

#### **Step 1: Understand the Problem and Establish Design Scope** (3-10 minutes)
**Goal**: Clarify requirements before jumping to solutions

**What to Ask:**
- **Functional Requirements**: What features need to be supported?
  - Example: "What are the core features? Users can post/read? Follow others?"
- **Non-Functional Requirements**: What are the scale, performance, and availability needs?
  - Scale: "How many daily active users? Monthly?"
  - Performance: "What latency is acceptable for reads/writes?"
  - Availability: "How critical is uptime? Can we have downtime for maintenance?"
  - Consistency: "Strong consistency or eventual consistency acceptable?"
- **Scope**: What's explicitly in/out of scope?
  - "Are we building mobile apps too, or just API?"
  - "Do we need to support internationalization?"

**What NOT to Do:**
- ❌ Don't jump to solutions immediately
- ❌ Don't make assumptions without asking
- ❌ Don't over-engineer for features not requested

**Output**: Clear list of requirements (functional + non-functional)

---

#### **Step 2: Propose High-Level Design and Get Buy-in** (10-15 minutes)
**Goal**: Create a blueprint and collaborate with interviewer

**What to Do:**
1. **API Design**: Define key endpoints
   - Example: `POST /api/posts`, `GET /api/feed`
   - Include request/response formats
   - Authentication approach

2. **High-Level Architecture Diagram**
   - Client → Load Balancer → App Servers → Database
   - Include: API Gateway, Caching, Message Queue (if needed)
   - Show data flow for critical operations

3. **Data Model (High-Level)**
   - Core entities and relationships
   - Example: Users, Posts, Follows, Likes
   - Basic schema design

4. **Back-of-Envelope Calculations**
   - Traffic estimates (QPS)
   - Storage requirements
   - Bandwidth needs
   - Number of servers needed

**Key Principle**: Draw diagrams on whiteboard/paper. Visual communication is critical.

**Collaboration**: Get buy-in from interviewer before proceeding. Ask: "Does this approach make sense? Shall we dive deeper into any particular component?"

---

#### **Step 3: Design Deep Dive** (10-25 minutes)
**Goal**: Go deep into 1-2 critical components

**What to Focus On:**
- Pick the most critical or interesting components
- Discuss trade-offs and alternatives
- Show multiple approaches and justify your choice

**Common Deep Dive Topics:**
1. **Database Design**
   - SQL vs NoSQL choice
   - Schema design
   - Indexing strategy
   - Sharding and partitioning

2. **Scaling Strategy**
   - Horizontal vs vertical scaling
   - Stateless application servers
   - Database replication (master-slave, master-master)
   - Caching strategy (Redis, Memcached)

3. **Performance Optimization**
   - CDN for static assets
   - Database query optimization
   - Async processing with message queues
   - Rate limiting

4. **Reliability**
   - Fault tolerance
   - Failover mechanisms
   - Data backup and recovery
   - Monitoring and alerting

**Trade-Off Discussions (Critical!)**:
- CAP Theorem: Consistency vs Availability
- Latency vs Throughput
- Read-heavy vs Write-heavy optimization
- Cost vs Performance

**Example**:
"For the news feed, we could use a push model (fanout-on-write) or pull model (fanout-on-read). Push is faster for reads but expensive for users with many followers. Pull is slower but more scalable. For our use case with average 500 followers, push model makes sense with a hybrid approach for celebrities."

---

#### **Step 4: Wrap Up** (3-5 minutes)
**Goal**: Identify bottlenecks, discuss improvements, and address remaining concerns

**What to Cover:**
1. **Bottlenecks**: Identify system bottlenecks
   - Example: "Database could be a bottleneck at 10x scale"

2. **Error Cases and Failures**
   - "What happens if database goes down?"
   - "How do we handle network partitions?"
   - "Rate limiting for abuse prevention"

3. **Monitoring and Metrics**
   - "Key metrics: QPS, latency, error rate, resource utilization"
   - "Alerts: Latency >500ms, Error rate >1%, CPU >80%"

4. **Future Improvements**
   - "If we had more time, we'd add..."
   - "At 100x scale, we'd need to..."

5. **Recap**
   - Briefly summarize the design
   - Highlight key decisions and trade-offs

**Key Principle**: Show that you can think beyond the immediate problem and consider operational concerns.

---

### 📚 **Alex Xu's Example Chapters** (Volumes 1 & 2)

**Volume 1 Topics:**
- Chapter 4: Rate Limiter
- Chapter 5: Consistent Hashing
- Chapter 6: Key-Value Store
- Chapter 7: Unique ID Generator
- Chapter 8: URL Shortener
- Chapter 9: Web Crawler
- Chapter 10: Notification System
- Chapter 11: News Feed System
- Chapter 12: Chat System
- Chapter 13: Search Autocomplete
- Chapter 14: YouTube
- Chapter 15: Google Drive

**Volume 2 Topics:**
- Proximity Service
- Nearby Friends
- Google Maps
- Distributed Message Queue
- And more...

**Each chapter follows the 4-step framework exactly.**

---

## 2. ML System Design Interview Framework
**Sources**:
- Ali Aminian & Alex Xu - "Machine Learning System Design Interview" (7-step framework)
- Industry Standard (Exponent, Meta, Google)

### ⏱️ Total Time: 45-60 minutes

### **The 6-7 Step Framework**

#### **Step 1: Problem Framing** (8 minutes)
**Goal**: Translate business problem into an ML problem

**What to Do:**
1. **Understand Business Problem**
   - What decision are we trying to make?
   - What's the business impact? (revenue, cost savings, UX improvement)
   - What's the baseline performance? (existing solution or random baseline)

2. **Frame as ML Problem**
   - **ML Task Type**: Classification, Regression, Ranking, Clustering, Anomaly Detection, Recommendation
   - **Learning Paradigm**: Supervised, Unsupervised, Semi-supervised, Reinforcement Learning
   - **Input → Output Mapping**: Clearly define what goes in and what comes out
   - Example: "User browsing history → Product recommendation scores (Ranking)"

3. **Define Success Metrics**
   - **Business Metrics**: Revenue lift (+10%), Conversion rate (+15%), User engagement (+20%)
   - **ML Metrics**: Accuracy (95%), Precision, Recall, F1, AUC-ROC, NDCG (for ranking)
   - **Inference Requirements**: Real-time (<100ms) or Batch (overnight)

4. **Clarify Constraints**
   - Latency: Real-time (<50ms) vs Batch acceptable
   - Accuracy: Minimum threshold (e.g., 85% precision)
   - Explainability: Black box OK or need interpretability
   - Regulatory: GDPR, HIPAA, fairness requirements

**Key Questions to Ask:**
- "What exactly are we predicting?"
- "What data do we have access to?"
- "What's acceptable latency and accuracy?"
- "Do predictions need to be explainable?"
- "How will we know if predictions are correct?"

**Output**: Clear ML problem statement with success metrics

---

#### **Step 2: Data Strategy** (8 minutes)
**Goal**: Design data collection and feature engineering pipeline

**What to Do:**
1. **Data Sources**
   - Available data: User logs, transactions, product catalog, etc.
   - Data volume: 10M samples, 500 features
   - Data quality: Labeling quality, missing data, noise
   - Access method: Kafka stream, PostgreSQL, S3

2. **Feature Engineering**
   - **Numerical features**: Age, price, time_since_event → Normalization
   - **Categorical features**: Location, category → One-hot encoding, embeddings
   - **Text features**: Reviews, descriptions → TF-IDF, word2vec, BERT embeddings
   - **Temporal features**: Time of day, day of week → Cyclic encoding

3. **Feature Pipeline**
   - **Batch features**: Computed daily in Spark (historical aggregations)
   - **Real-time features**: Computed on-demand from Redis (current session)
   - **Feature Store**: Centralized feature management (Feast, Tecton)

4. **Train/Validation/Test Split**
   - Training: 70% (model learning)
   - Validation: 15% (hyperparameter tuning)
   - Test: 15% (final evaluation, never touched during training)
   - **Time-based split** for time-series data to prevent leakage

**Data Quality Checks:**
- Check for label imbalance
- Identify missing data patterns
- Detect outliers and anomalies
- Validate data distributions

**Output**: Data pipeline design with feature engineering approach

---

#### **Step 3: Model Selection** (8 minutes)
**Goal**: Choose appropriate model architecture with justification

**What to Do:**
1. **Baseline Models** (Always start here!)
   - **Random baseline**: Random predictions (e.g., 50% for binary)
   - **Rule-based baseline**: Current business logic
   - **Simple ML baseline**: Logistic Regression, Decision Tree

2. **Candidate Models**
   - **Tabular Data**: Random Forest, Gradient Boosting (XGBoost, LightGBM)
   - **Text Data**: LSTM, Transformers (BERT, GPT)
   - **Image Data**: CNNs (ResNet, EfficientNet)
   - **Recommendation**: Collaborative Filtering, Matrix Factorization, Neural CF

3. **Model Choice Rationale**
   - Example: "Choose XGBoost over Neural Network because:"
     - ✅ Better performance on tabular data
     - ✅ Faster training and inference
     - ✅ Better interpretability (feature importance)
     - ❌ Less flexible for unstructured data (acceptable trade-off)

4. **Training Approach**
   - **Batch training**: Retrain weekly on full dataset
   - **Online learning**: Continuous updates (for concept drift)
   - **Transfer learning**: Use pre-trained models (for limited data)
   - **Ensemble**: Combine multiple models (for better performance)

**Trade-offs to Discuss:**
- **Accuracy vs Interpretability**: Neural Network vs Linear Model
- **Training Time vs Performance**: Simple model vs Complex model
- **Model Size vs Latency**: Large model (slow) vs Compressed model (fast)

**Output**: Selected model with clear justification

---

#### **Step 4: Model Training** (Covered in Step 3, ~5 minutes)
**Goal**: Explain training process and optimization

**What to Cover:**
1. **Loss Function**: Cross-entropy (classification), MSE (regression), etc.
2. **Optimizer**: Adam, SGD, AdaGrad
3. **Hyperparameter Tuning**: Grid search, Random search, Bayesian optimization
4. **Regularization**: L1/L2, Dropout, Early stopping
5. **Cross-Validation**: K-fold CV for robust performance estimates

---

#### **Step 5: Evaluation** (8 minutes)
**Goal**: Define how to measure model success offline and online

**What to Do:**
1. **Offline Evaluation Metrics**
   - **Classification**: Accuracy, Precision, Recall, F1, AUC-ROC, Confusion Matrix
   - **Regression**: MAE, RMSE, R², MAPE
   - **Ranking**: NDCG, MAP, MRR
   - **Business Metrics (Offline)**: Estimated revenue lift, cost reduction

2. **Model Comparison**
   ```
   | Model          | Accuracy | Latency | Size  | Interpretability | Choice |
   |----------------|----------|---------|-------|------------------|--------|
   | Logistic Reg   | 85%      | 5ms     | 10MB  | High             | ❌     |
   | Random Forest  | 92%      | 20ms    | 100MB | Medium           | ❌     |
   | XGBoost        | 95%      | 30ms    | 50MB  | Medium           | ✅     |
   | Neural Network | 96%      | 80ms    | 200MB | Low              | ❌     |
   ```
   Justification: "XGBoost offers best accuracy/latency trade-off"

3. **Online Evaluation (A/B Testing)**
   - **Control**: Current rule-based system
   - **Treatment**: New ML model
   - **Split**: 95% control, 5% treatment (canary deployment)
   - **Duration**: 2 weeks for statistical significance
   - **Metrics**: Business metrics (conversion, revenue), User experience metrics

4. **Quality Assurance**
   - **Data drift detection**: Monitor feature distributions over time
   - **Model drift detection**: Monitor prediction distributions
   - **Bias detection**: Performance across demographics
   - **Edge case testing**: Model behavior on outliers

**Output**: Comprehensive evaluation strategy with online/offline metrics

---

#### **Step 6: Deployment & Serving** (8 minutes)
**Goal**: Design production serving architecture

**What to Do:**
1. **Serving Pattern**

   **Real-time Serving** (if <100ms latency required):
   - **Model Server**: TensorFlow Serving, TorchServe, MLflow
   - **Load Balancer**: Multiple model replicas for high availability
   - **Feature Lookup**: Redis for real-time feature retrieval
   - **Prediction Caching**: LRU cache for frequent queries

   **Batch Serving** (if overnight predictions OK):
   - **Batch Processing**: Spark job runs daily
   - **Prediction Storage**: Write to database/S3
   - **API**: Serves pre-computed predictions (very fast lookup)

2. **Model Management**
   - **Model Registry**: MLflow, Weights & Biases for versioning
   - **A/B Testing**: Serve multiple model versions (Champion vs Challenger)
   - **Rollback**: Quick revert to previous version if issues detected

3. **Deployment Strategy**
   - **Blue-Green Deployment**: Zero downtime, instant switch
   - **Canary Deployment**: Gradual rollout (5% → 25% → 100%)
   - **Shadow Mode**: New model runs alongside old, no user impact (for testing)

4. **Monitoring**
   - **Performance Metrics**: p50/p95/p99 latency, QPS, Error rate
   - **Model Quality Metrics**: Online accuracy (when ground truth available)
   - **Data Quality Metrics**: Feature distribution drift
   - **Business Metrics**: Revenue, conversion, user engagement

5. **Alerting**
   - **P0 Alerts**: Latency >500ms, Error rate >5%, Service down
   - **P1 Alerts**: Accuracy drop >5%, Prediction drift detected
   - **P2 Alerts**: Resource usage >80%, Cost spike

6. **Retraining Strategy**
   - **Scheduled**: Weekly/monthly retraining on new data
   - **Performance-based**: Trigger when accuracy drops below threshold
   - **Data-driven**: Trigger when significant new data available
   - **Drift-based**: Trigger when feature/prediction drift detected

**Output**: Complete deployment architecture with monitoring plan

---

#### **Step 7: Wrap Up** (5 minutes)
**Goal**: Summarize and discuss improvements

**What to Cover:**
1. **Summary**: Recap the ML system end-to-end
2. **Bottlenecks**: Identify potential bottlenecks at scale
3. **Trade-offs**: Highlight key trade-offs made
4. **Future Improvements**:
   - "With more time, we'd experiment with deep learning"
   - "At 10x scale, we'd need distributed training"
   - "Could add more sophisticated feature engineering"

---

### 📚 **Ali Aminian's Example Chapters**

The book covers 10 real ML system design questions:
- Chapter 2: Visual Search System
- Chapter 3: Google Street View Blurring System
- Chapter 4: YouTube Video Search
- Chapter 5: Harmful Content Detection
- Chapter 6: Video Recommendation System
- Chapter 7: Event Recommendation System
- Chapter 8: Ad Click Prediction
- Chapter 9: Similar Listings (Airbnb-style)
- Chapter 10: Personalized News Feed
- Chapter 11: People You May Know

**Each chapter follows the 7-step framework.**

---

## 3. GenAI/LLM System Design Interview Framework
**Sources**:
- Ali Aminian & Hao Sheng - "Generative AI System Design Interview" (7-step framework)
- Industry Best Practices (OpenAI, Anthropic, Google)

### ⏱️ Total Time: 45-60 minutes

### **The 7-Step Framework**

#### **Step 1: Use Case Clarification & Requirements** (8 minutes)
**Goal**: Understand the generation task and requirements

**What to Ask:**
1. **Generation Type**
   - Text generation: Conversational, summarization, creative writing
   - Image generation: Realistic, artistic, editing
   - Code generation: Completion, explanation, debugging
   - Multimodal: Text→Image, Image→Text, etc.

2. **Quality Requirements**
   - **Relevance**: Must answer the user's question accurately
   - **Accuracy**: Factual correctness (especially for RAG)
   - **Style**: Formal, casual, technical, creative
   - **Safety**: Content filtering requirements
   - **Consistency**: Multi-turn conversation coherence

3. **Performance Requirements**
   - **Latency**: Time to first token (<500ms), Total response time (<3s)
   - **Throughput**: Requests per second (100 QPS, 1000 QPS?)
   - **Concurrent Users**: How many simultaneous users?

4. **Budget & Cost Constraints**
   - **Monthly Budget**: $10K/month, $100K/month?
   - **Cost per Request**: Acceptable cost (GPT-4 expensive vs GPT-3.5 cheaper)
   - **Token Budget**: Average tokens per request

5. **Safety & Compliance**
   - **Content Filtering**: Toxicity, harmful content, PII
   - **Regulatory**: GDPR, CCPA, industry-specific
   - **Bias & Fairness**: Performance across demographics
   - **Hallucination Tolerance**: How critical is factual accuracy?

**Key Questions to Ask:**
- "What types of content will be generated?"
- "What quality bar is needed? (factual accuracy critical?)"
- "How many requests per day? What latency is acceptable?"
- "What's the budget for API costs?"
- "What content safety requirements do we have?"
- "Do we need to explain/cite sources for outputs?"

**Example Answers:**
- "Customer support chatbot: 10K daily users, 5 prompts/user = 50K prompts/day"
- "Need <3s response time, factual accuracy critical (cite sources)"
- "Budget: $5K/month, PII must be filtered, content must be family-safe"

**Output**: Clear use case definition with requirements

---

#### **Step 2: Token Economics & Scale Estimation** (8 minutes)
**Goal**: Calculate token usage and infrastructure costs

**What to Calculate:**
1. **Usage Metrics**
   ```
   Daily Active Users: 10,000 users
   Prompts per User: 5 prompts/day
   Total Daily Prompts: 10K × 5 = 50,000 prompts
   Peak QPS: Assume 3x average = 20 prompts/second
   ```

2. **Token Breakdown (per request)**
   ```
   System Prompt: 500 tokens (role definition, instructions)
   User Input: 200 tokens average (user question)
   Context/History: 1,000 tokens (RAG results or conversation history)
   ------------------------------
   Total Input: 1,700 tokens per request

   Generated Output: 400 tokens average (model response)
   ```

3. **Daily Token Usage**
   ```
   Input Tokens: 50K × 1,700 = 85 million tokens/day
   Output Tokens: 50K × 400 = 20 million tokens/day
   Total: 105 million tokens/day
   ```

4. **Cost Estimates**

   **Option 1: GPT-4 (Highest Quality)**
   ```
   Input: 85M × $0.03/1K = $2,550/day
   Output: 20M × $0.06/1K = $1,200/day
   Total: $3,750/day = $112,500/month ❌ Too expensive!
   ```

   **Option 2: GPT-3.5-Turbo (Cost-Effective)**
   ```
   Input: 85M × $0.0015/1K = $127/day
   Output: 20M × $0.002/1K = $40/day
   Total: $167/day = $5,000/month ✅ Within budget
   ```

   **Option 3: Self-Hosted (LLaMA-2-70B)**
   ```
   GPU Requirement: 4×A100 GPUs
   Infrastructure: $4,000/month (fixed cost)
   Storage: $500/month (vector DB + models)
   Total: $4,500/month (breakeven at ~90K requests/day)
   ```

   **Option 4: Model Tiering (Recommended)**
   ```
   Simple queries (60%): GPT-3.5 → $100/day
   Complex queries (40%): GPT-4 → $1,500/day
   Blended cost: $1,600/day = $48,000/month
   ```

5. **Performance Estimates**
   ```
   Time to First Token: <500ms target
   Token Generation Speed: 40 tokens/second
   Total Response Time: 400 tokens ÷ 40 = 10 seconds
                        (Need to optimize with streaming!)
   ```

6. **RAG Infrastructure (if applicable)**
   ```
   Documents: 1 million documents
   Embedding Cost: 1M × 500 tokens × $0.0001 = $50 (one-time)
   Vector DB Storage: 20GB embeddings = $50/month
   Query Latency: <100ms for retrieval
   ```

**Output**: Detailed cost breakdown and infrastructure sizing

---

#### **Step 3: Model Selection Strategy** (8 minutes)
**Goal**: Choose the right model(s) based on requirements and cost

**What to Do:**
1. **Model Evaluation Criteria**
   ```
   | Criterion        | Weight | GPT-4 | GPT-3.5 | Claude 3 | LLaMA-70B |
   |------------------|--------|-------|---------|----------|-----------|
   | Quality          | 40%    | 10/10 | 7/10    | 9/10     | 7/10      |
   | Cost             | 30%    | 3/10  | 9/10    | 5/10     | 8/10      |
   | Latency          | 20%    | 7/10  | 9/10    | 8/10     | 6/10      |
   | Control/Privacy  | 10%    | 5/10  | 5/10    | 5/10     | 10/10     |
   |------------------|--------|-------|---------|----------|-----------|
   | Weighted Total   |        | 6.9   | 7.6     | 7.0      | 7.2       |
   ```

2. **Model Routing Strategy**
   ```python
   def route_to_model(query, user_tier, complexity):
       # Intent classification
       if user_tier == "premium" or complexity == "high":
           return "gpt-4"  # Best quality for paying users
       elif complexity == "medium":
           return "gpt-3.5"  # Good balance
       else:
           return "gpt-3.5"  # Simple queries, cost-effective

   # Fallback chain
   # GPT-4 → GPT-3.5 → Claude → Error
   ```

3. **Multi-Model Strategy Benefits**
   - **Cost Optimization**: Use cheaper model for simple queries (60-70%)
   - **Quality Optimization**: Use premium model for complex queries (30-40%)
   - **Reliability**: Fallback to alternative provider if primary fails

**Output**: Model selection with routing logic

---

#### **Step 4: Knowledge Integration Strategy** (8 minutes)
**Goal**: Decide between RAG, Fine-tuning, or Prompt Engineering

**What to Do:**
1. **RAG (Retrieval Augmented Generation)**

   **When to Use:**
   - ✅ Need up-to-date information (docs change frequently)
   - ✅ Large knowledge base (can't fit in training)
   - ✅ Want to cite sources for factual accuracy
   - ✅ Need to add/update knowledge without retraining

   **Implementation:**
   ```
   Vector Database: Pinecone / Weaviate / Qdrant
   Embedding Model: text-embedding-ada-002 (OpenAI) or open-source
   Chunking Strategy: 512 token chunks with 50 token overlap
   Retrieval: Top-k=5 relevant chunks
   Reranking: Cross-encoder for better relevance
   ```

   **RAG Pipeline:**
   ```
   User Query → Embed Query → Vector Search → Top-k Chunks →
   Rerank → Insert into Prompt → LLM → Response
   ```

2. **Fine-tuning**

   **When to Use:**
   - ✅ Need specific output format/style consistently
   - ✅ Domain-specific terminology
   - ✅ Have quality training data (10K+ examples)
   - ✅ Want to internalize knowledge into model

   **Implementation:**
   ```
   Method: PEFT/LoRA (parameter-efficient fine-tuning)
   Training Data: 10K high-quality question-answer pairs
   Training Cost: $500 per training run
   Maintenance: Retrain monthly with new data
   ```

3. **Prompt Engineering**

   **When to Use:**
   - ✅ Need quick iteration and testing
   - ✅ Limited training data
   - ✅ Changing requirements frequently

   **Techniques:**
   - System prompts: Role and behavior definition
   - Few-shot examples: In-context learning
   - Chain-of-thought: Complex reasoning tasks
   - Output formatting: Structured responses (JSON)

4. **Hybrid Approach (Recommended)**
   ```
   Base Model: Fine-tuned for consistent style/format
   + RAG: For facts and current information
   + Prompt Engineering: For edge cases and iteration
   ```

**Trade-off Discussion:**
- **RAG vs Fine-tuning**: RAG for dynamic knowledge, Fine-tuning for style
- **Cost**: RAG cheaper (no training), Fine-tuning has upfront cost
- **Latency**: Fine-tuning faster (no retrieval), RAG adds 50-100ms
- **Accuracy**: Fine-tuning better for style, RAG better for facts

**Output**: Knowledge integration strategy with justification

---

#### **Step 5: Prompt Engineering & Safety** (8 minutes)
**Goal**: Design effective prompts and safety guardrails

**What to Do:**
1. **System Prompt Design**
   ```
   You are a helpful customer support assistant for [Company].

   **Your role:**
   - Answer customer questions accurately and helpfully
   - Use a friendly, professional tone
   - If you don't know something, say so - never make up information
   - Direct users to human support for complex issues

   **Guidelines:**
   - Keep responses concise (under 200 words)
   - Use bullet points for multi-step instructions
   - Include relevant links when helpful
   - Never share personal customer data

   **Context provided:**
   - Company knowledge base (retrieved via RAG)
   - User's conversation history (if applicable)
   - User account tier: [basic/premium]
   ```

2. **Few-Shot Examples**
   ```
   Example 1: Password Reset
   User: "I forgot my password"
   Assistant: "I can help you reset your password! Here's how:
   1. Go to company.com/login
   2. Click 'Forgot Password'
   3. Enter your email
   4. Check email for reset link (expires in 24 hours)
   Let me know if you need help!"
   ```

3. **Output Formatting**
   - Structured Output: JSON for API responses
   - Markdown: For formatted text
   - Citations: Include source references [1], [2]
   - Validation: Regex patterns for specific formats

4. **Safety Guardrails**

   **Input Safety:**
   - ✅ Prompt injection defense (validate inputs)
   - ✅ PII detection and masking (before sending to LLM)
   - ✅ Content moderation (OpenAI Moderation API)

   **Output Safety:**
   - ✅ Content filtering (toxicity, harmful content)
   - ✅ Hallucination detection (fact-checking against sources)
   - ✅ PII removal (scrub from outputs)

   **Rate Limiting:**
   - ✅ Per-user limits: 100 requests/hour
   - ✅ Cost limits: $100/day per user max
   - ✅ Token limits: Max 2000 tokens per request

**Output**: Prompt templates and safety framework

---

#### **Step 6: Evaluation & Quality Assurance** (8 minutes)
**Goal**: Define metrics and testing strategy

**What to Do:**
1. **Automatic Evaluation Metrics**
   - **Relevance**: Cosine similarity to gold answers (>0.85 target)
   - **Fluency**: Perplexity score (lower is better)
   - **Factual Accuracy**: Automated fact-checking against knowledge base
   - **Citation Accuracy**: Verify cited sources support claims
   - **Safety Metrics**: Toxicity rate <0.1%, PII leakage = 0

2. **Human Evaluation** (1-5 scale)
   - **Helpfulness**: Did it solve the user's problem?
   - **Accuracy**: Is the information correct?
   - **Clarity**: Is it easy to understand?
   - **Safety**: Any concerning content?

   **Process:**
   - Sample Size: 100 responses per day
   - Raters: Mix of experts and target users
   - Inter-rater agreement: Fleiss' kappa >0.7

3. **A/B Testing Framework**
   ```
   Champion: GPT-3.5 (current production)
   Challenger: GPT-4 or fine-tuned model

   Split: 50/50 random assignment
   Sample: 10,000 users
   Duration: 1 week

   Metrics:
   - Primary: User satisfaction (thumbs up rate)
   - Secondary: Task completion, cost per request

   Success Criteria: +10% satisfaction with <2x cost increase
   ```

4. **Pre-Launch Testing**
   - **Red Teaming**: Attempt prompt injection, jailbreaking
   - **Edge Cases**: Unusual inputs, ambiguous queries
   - **Stress Testing**: High concurrency, long contexts
   - **Regression Testing**: 500 golden test cases

5. **Continuous Monitoring**
   - Real-time quality scoring
   - User feedback (thumbs up/down)
   - Automated flagging for concerning responses
   - Human review queue (flagged responses reviewed within 1 hour)

**Output**: Comprehensive evaluation and QA plan

---

#### **Step 7: Production Deployment & Operations** (8 minutes)
**Goal**: Design serving architecture and operational procedures

**What to Do:**
1. **Serving Architecture**
   ```
   User Request
   ↓
   API Gateway (Auth, Rate Limiting)
   ↓
   Request Router (Complexity Classifier)
   ↓
   Model Tier Selection (GPT-4 / GPT-3.5 / Claude)
   ↓
   Semantic Cache Check (30% hit rate target)
   ↓
   RAG Pipeline (if cache miss)
   ├─ Vector Search (100ms)
   ├─ Reranking (50ms)
   ├─ Prompt Construction
   ↓
   LLM API Call (1-3 seconds)
   ↓
   Safety Filters (Output validation)
   ↓
   Response Cache Update
   ↓
   User Response
   ```

2. **Caching Strategy**
   - **Semantic Caching**: Vector similarity for prompts (Embedding + Redis)
   - **Exact Match Cache**: Redis for identical queries (24hr TTL)
   - **Response Cache**: Static answers (FAQ responses)
   - **Hit Rate Target**: 30% cache hit rate

3. **Context Management**
   - **Session Storage**: Redis for conversation history
   - **Context Window**: Sliding window of last 10 messages
   - **Token Management**: Truncate old messages when limit reached
   - **Cleanup**: Remove sessions after 1 hour inactive

4. **Monitoring Dashboards**

   **Performance Metrics:**
   - Time to First Token: p50 <300ms, p95 <500ms
   - Tokens/Second: >40 tokens/sec
   - End-to-End Latency: p95 <3s
   - Cache Hit Rate: >30%
   - Current QPS vs Capacity

   **Quality Metrics:**
   - Response quality score (0-1 scale)
   - User satisfaction (thumbs up rate >80%)
   - Safety violations (<0.1% flagged)
   - Hallucination detection rate

   **Cost Metrics:**
   - Cost per request (by model tier)
   - Daily/monthly spend vs budget
   - Token usage trends

5. **Alerting**
   - **P0**: Service down, Safety incident, Cost >2x budget
   - **P1**: Quality drop >10%, Latency >5s p95, Error rate >5%
   - **P2**: Cost increase >20%, Cache hit rate <20%

6. **Operational Procedures**

   **Incident Response:**
   - Quality drop → Rollback to previous prompt/model version
   - Cost spike → Activate strict rate limits, investigate
   - Safety incident → Immediate review + temporary shutdown if needed

   **Regular Maintenance:**
   - Prompt updates: A/B test weekly improvements
   - Model updates: Evaluate new versions monthly
   - Knowledge refresh: Update RAG documents daily (for dynamic content)
   - Cost review: Weekly optimization opportunities

7. **Cost Optimization Tactics**
   - **Prompt Compression**: Remove redundant tokens, use abbreviations
   - **Context Pruning**: Keep only relevant conversation history
   - **Output Length Limits**: Set max_tokens to prevent over-generation
   - **Smart Routing**: Simple → cheap model, Complex → expensive model
   - **Caching**: Aggressive caching for common queries

**Output**: Complete production architecture with operational playbook

---

### 📚 **Ali Aminian's GenAI Example Chapters**

The book "Generative AI System Design Interview" covers 10 real GenAI questions:
- Gmail Smart Compose
- Google Translate
- ChatGPT Personal Assistant
- Image Captioning
- Retrieval-Augmented Generation (RAG)
- Realistic Face Generation
- High-Resolution Image Synthesis
- Text-to-Image Generation
- Personalized Text-to-Image Headshot
- Text-to-Video Generation

**Each chapter follows the 7-step framework.**

---

## Summary: Framework Comparison

| Aspect | System Design | ML Design | GenAI Design |
|--------|---------------|-----------|--------------|
| **Steps** | 4 steps | 6-7 steps | 7 steps |
| **Time** | 45-60 min | 45-60 min | 45-60 min |
| **Focus** | Distributed systems, scaling | Data, models, metrics | Token economics, RAG/FT, safety |
| **Key Trade-offs** | CAP theorem, latency vs throughput | Accuracy vs latency, complexity vs interpretability | Cost vs quality, safety vs capability |
| **Deep Dive** | 1-2 components (DB, cache) | Model + Serving | Knowledge strategy + Prompts |
| **Unique Aspects** | API design, sharding | Feature engineering, A/B testing | Token costs, hallucinations, safety |

---

## Key Principles Across All Frameworks

1. **Clarify Before Designing**: Always ask questions first (Step 1)
2. **Collaborate with Interviewer**: Get buy-in, don't just present
3. **Justify Decisions**: Every choice needs a rationale with trade-offs
4. **Think Production**: Don't just design, think about operations
5. **Show Breadth & Depth**: Cover end-to-end, then dive deep
6. **Time Management**: Allocate time wisely across steps
7. **Visual Communication**: Draw diagrams, don't just talk

---

**Last Updated**: 2025-01-05
**Sources**: Alex Xu (Volumes 1, 2, ML), Ali Aminian (ML, GenAI), Industry Best Practices
