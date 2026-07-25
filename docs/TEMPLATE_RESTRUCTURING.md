# Template Restructuring Guide
## Aligning with Alex Xu & Industry Interview Frameworks

This document shows how to restructure our templates to match proven system design interview frameworks.

---

## 1. System Design Template (Traditional Distributed Systems)

### ✅ CURRENT STRUCTURE (Already Good!)
The current system design template already follows Alex Xu's framework well:

```
Page 1: Project Overview
  - Project Description (text-editor)
  - Key Features (bullet-list)
  - Business Goals (text-editor)
  - Constraints & Requirements (text-editor)

Page 2: Clarifying Requirements
  - Requirements Discovery (qa-pairs) ✅ Alex Xu Step 1

Page 3: Back-of-Envelope Calculations
  - Scale Estimates (calculations) ✅ Alex Xu Step 1

Page 4: High-Level Architecture
  - Architecture Diagram (whiteboard) ✅ Alex Xu Step 2
  - Key Components (text-editor) ✅ Alex Xu Step 2

Page 5: Database Design
  - Data Model (text-editor) ✅ Alex Xu Step 3 (Deep Dive)
  - Database Technology Choices (text-editor)

Page 6: Monitoring & Operations
  - Monitoring & Observability (text-editor) ✅ Alex Xu Step 4
```

### 🔧 MINOR IMPROVEMENTS NEEDED

**Add these pages for completeness:**

**Page 6: API Design** (Insert before Database Design)
```yaml
Page: API Design
  Section: API Endpoints (table or text-editor)
    - REST/GraphQL endpoint definitions
    - Request/Response formats
    - Authentication & rate limiting

  Section: Data Flow (text-editor)
    - Request flow through system
    - Data flow diagrams
    - Sequence diagrams for key operations
```

**Page 7: Deep Dive** (Rename "Database Design" to this)
```yaml
Page: Deep Dive - Database & Scaling
  Section: Database Design (text-editor)
    - Data model and schema
    - SQL vs NoSQL choice
    - Indexing and partitioning

  Section: Scaling Strategy (text-editor)
    - Horizontal vs vertical scaling
    - Sharding and replication
    - Caching strategy
    - CDN usage
```

**Page 8: Trade-offs & Bottlenecks** (New - Alex Xu Step 4)
```yaml
Page: Trade-offs & Wrap-up
  Section: Design Trade-offs (text-editor)
    - CAP theorem decisions
    - Consistency vs Availability
    - Latency vs Throughput
    - Cost vs Performance

  Section: Bottlenecks & Improvements (text-editor)
    - System bottlenecks
    - Scaling limitations
    - Future improvements
    - Alternative approaches

  Section: Failure Scenarios (text-editor)
    - Error handling
    - Failure modes
    - Disaster recovery
```

**Updated Page Order:**
1. Project Overview
2. Clarifying Requirements (Functional + Non-functional)
3. Back-of-Envelope Calculations
4. High-Level Architecture (API + Components)
5. Deep Dive - Database & Scaling
6. Deep Dive - Advanced Topics (choose 1-2: Caching, Message Queue, etc.)
7. Monitoring & Operations
8. Trade-offs & Wrap-up

---

## 2. ML Design Template (Machine Learning Systems)

### ❌ CURRENT STRUCTURE (Needs Major Restructuring)

**Current (Broken Flow):**
```
Page 1: Project Overview
  - Project Description (text-editor) ← Too much content in one section!
  - ML Interview Q&A (qa-pairs)
  - ML Requirements (bullet-list)

Page 2: Clarifying Questions
  - ML Requirements Discovery (qa-pairs) ← Duplicate of Page 1!

Page 3: ML Problem Framing
  - Problem Type & Approach (text-editor)
  - Success Metrics (metrics)

Page 4: Back-of-Envelope Calculations
  - ML Scale Estimates (calculations)

Page 5: Data Strategy
  - Data Sources (table)

Page 6: Model Evaluation & Quality Assurance
  - Evaluation Strategy (text-editor)

Page 7: Model Deployment & Production
  - Deployment Strategy (text-editor)
```

### ✅ PROPER ML INTERVIEW STRUCTURE

**Based on ML Design Interview Best Practices:**

**Page 1: ML Problem Framing** (10 min in interview)
```yaml
Page: ML Problem Framing
  Section: Business Problem (text-editor)
    Content: |
      ## Business Problem
      What business problem are we solving? What decisions will ML enable?

      ## Why ML?
      - Why is ML the right approach vs rules-based systems?
      - What makes this problem suitable for ML?
      - Current baseline performance (if any)

      ## Success Metrics

      ### Business Metrics
      - Revenue impact: [e.g., +10% conversion rate]
      - User experience: [e.g., reduce search time by 30%]
      - Cost savings: [e.g., reduce manual review by 80%]

      ### ML Metrics
      - Model performance: [e.g., 95% accuracy]
      - Inference latency: [e.g., <100ms p95]
      - Throughput: [e.g., 10k predictions/second]

  Section: ML Task Definition (text-editor)
    Content: |
      ## ML Task Type
      - **Type**: [Classification / Regression / Ranking / Clustering / etc.]
      - **Learning Paradigm**: [Supervised / Unsupervised / Semi-supervised / RL]
      - **Output**: [Binary / Multi-class / Continuous / Multi-label]

      ## Input → Output Mapping
      - **Input Features**: What data do we have? (structured, text, images, etc.)
      - **Target Variable**: What exactly are we predicting?
      - **Example**: User browsing history → Product recommendation scores

      ## Constraints
      - Latency requirements: [Real-time <100ms / Batch overnight]
      - Accuracy requirements: [Minimum 85% precision]
      - Explainability: [Black box OK / Must explain decisions]
      - Compliance: [GDPR, CCPA, industry regulations]
```

**Page 2: Clarifying Questions** (5-10 min in interview)
```yaml
Page: Clarifying Questions
  Section: ML Requirements Discovery (qa-pairs)
    Default Q&A:
      Q1: What data do we have? Volume, quality, labels?
      A1: [X] million samples, [Y]% labeled, quality issues: [Z]

      Q2: What are the accuracy and latency requirements?
      A2: Min [X]% accuracy, <[Y]ms latency for real-time / batch is OK

      Q3: How many predictions per day? Batch or real-time?
      A3: [X]M predictions/day, [real-time / batch / hybrid]

      Q4: Do we need to explain predictions? Regulatory requirements?
      A4: [Must be explainable / Black box OK], [GDPR / HIPAA / etc.]

      Q5: How will we get ground truth? Feedback delay?
      A5: [User clicks / Manual review / Automated], available in [real-time / 1 day / 1 week]

      Q6: What's the baseline to beat? Existing solution?
      A6: [Current rule-based system at X% / Random baseline / No existing solution]
```

**Page 3: Back-of-Envelope Calculations** (5-10 min in interview)
```yaml
Page: Data & Compute Estimates
  Section: Scale Calculations (calculations or text-editor)
    Content: |
      ## Data Volume
      - **Training Samples**: [10M] samples
      - **Features per Sample**: [500] features
      - **Storage**: 10M × 500 × 8 bytes = [40GB] training data
      - **Labels**: [1M] labeled samples for supervised learning

      ## Model Complexity
      - **Model Type**: [Neural Network / Random Forest / etc.]
      - **Parameters**: [10M] parameters
      - **Model Size**: 10M × 4 bytes = [40MB] model size
      - **Training Time**: [2 hours] on [8 GPUs]
      - **Training Cost**: $[50] per training run

      ## Inference Requirements
      - **Daily Predictions**: [5M] predictions/day
      - **Peak QPS**: 5M / 86400 = [58 QPS] average, [200 QPS] peak
      - **Latency Budget**: [50ms] inference time
      - **Throughput**: 1 GPU handles [100 QPS] → need [2] GPUs

      ## Infrastructure Costs
      - **Training**: $[50/run] × [weekly retraining] = $[200/month]
      - **Serving**: [2 GPUs] × $[300/month] = $[600/month]
      - **Storage**: [100GB] × $[0.10/GB] = $[10/month]
      - **Total**: $[810/month]
```

**Page 4: Data Strategy** (10 min in interview)
```yaml
Page: Data Strategy
  Section: Data Sources & Pipeline (table)
    Headers: [Data Source | Type | Volume | Quality | Access Method]
    Rows:
      - User Events | Structured | 10M/day | High | Kafka Stream
      - User Profiles | Structured | 1M records | Medium | PostgreSQL
      - Product Catalog | Semi-structured | 100K items | High | Elasticsearch

  Section: Feature Engineering (text-editor)
    Content: |
      ## Feature Types

      ### Numerical Features
      - User age, account tenure, purchase amount
      - Normalization: [StandardScaler / MinMaxScaler]

      ### Categorical Features
      - User location, product category, device type
      - Encoding: [One-hot / Target encoding / Embeddings]

      ### Temporal Features
      - Time since last purchase, day of week, seasonality
      - Handling: [Cyclic encoding / Binning]

      ### Text Features
      - Product descriptions, user reviews
      - Processing: [TF-IDF / Word2Vec / BERT embeddings]

      ## Feature Pipeline
      - **Batch Features**: Computed daily in Spark
      - **Real-time Features**: Computed on request from Redis
      - **Feature Store**: Feast/Tecton for feature management

      ## Train/Val/Test Split
      - **Training**: 70% (older data)
      - **Validation**: 15% (for hyperparameter tuning)
      - **Test**: 15% (hold-out, never touched during training)
      - **Time-based split**: Prevent data leakage
```

**Page 5: Model Development** (15 min in interview)
```yaml
Page: Model Selection & Training
  Section: Model Architecture (text-editor)
    Content: |
      ## Model Selection

      ### Baseline Models
      - **Random Baseline**: [Random prediction performance]
      - **Rule-based**: [Current business logic performance]
      - **Simple ML**: Logistic Regression [X]% accuracy

      ### Candidate Models
      - **Random Forest**: Good interpretability, handles mixed features
      - **Gradient Boosting (XGBoost)**: Best performance for tabular data
      - **Neural Network**: If we have enough data and need complex patterns

      ### Model Choice Rationale
      Selected: [XGBoost]
      - Reason: Best accuracy ([95]%) vs baseline ([80]%)
      - Trade-off: Slightly harder to interpret than Random Forest
      - Acceptable because: Performance gain outweighs interpretability loss

      ## Training Approach
      - **Online Learning**: [Yes/No] - Update model with new data continuously
      - **Batch Training**: [Weekly] retraining on full dataset
      - **Transfer Learning**: [Using pre-trained embeddings from X]
      - **Ensemble**: [Combining 3 models for better performance]

  Section: Feature Importance (table or text-editor)
    Content: Top 10 most important features and their impact
```

**Page 6: Evaluation & Quality Assurance** (10 min in interview)
```yaml
Page: Model Evaluation & Quality
  Section: Offline Evaluation (text-editor)
    Content: |
      ## Offline Metrics

      ### For Classification
      - **Accuracy**: [95]% on test set
      - **Precision**: [93]% (minimize false positives)
      - **Recall**: [97]% (minimize false negatives)
      - **F1-Score**: [95]% (harmonic mean)
      - **AUC-ROC**: [0.98] (overall discriminative ability)

      ### Business Metrics (Offline)
      - **Revenue Impact**: Estimated +[10]% conversion
      - **Cost Impact**: Reduce manual review by [80]%

      ## Cross-Validation
      - **5-fold CV**: Ensure robust performance estimate
      - **Time-based CV**: For time-series data
      - **Stratified**: Maintain class distribution

      ## Model Comparison
      | Model | Accuracy | Latency | Size | Choice |
      |-------|----------|---------|------|--------|
      | Random Forest | 92% | 20ms | 100MB | ❌ |
      | XGBoost | 95% | 30ms | 50MB | ✅ |
      | Neural Net | 96% | 80ms | 200MB | ❌ |

      Reason: XGBoost best accuracy/latency trade-off

  Section: A/B Testing & Online Evaluation (text-editor)
    Content: |
      ## A/B Test Design
      - **Control**: Current rule-based system
      - **Treatment**: New ML model
      - **Split**: 95% control, 5% treatment (canary)
      - **Duration**: 2 weeks for statistical significance
      - **Sample Size**: [100K] users needed for 95% confidence

      ## Online Metrics
      - **Business Metrics**: Conversion rate, revenue per user
      - **User Experience**: Click-through rate, time on site
      - **Model Performance**: Online accuracy (when ground truth available)

      ## Quality Checks
      - **Data Drift**: Monitor feature distributions
      - **Model Drift**: Monitor prediction distributions
      - **Bias**: Check performance across demographics
      - **Edge Cases**: Test on outliers and adversarial examples
```

**Page 7: Production Deployment** (10 min in interview)
```yaml
Page: Model Deployment & Serving
  Section: Serving Architecture (text-editor + whiteboard)
    Content: |
      ## Serving Pattern

      ### Real-time Serving (if <100ms latency required)
      - **Model Server**: TensorFlow Serving / TorchServe
      - **Load Balancer**: Multiple model replicas
      - **Feature Lookup**: Redis for real-time features
      - **Caching**: LRU cache for frequent predictions

      ### Batch Serving (if overnight predictions OK)
      - **Batch Processing**: Spark job runs daily
      - **Prediction Storage**: Write to database/S3
      - **Serving**: API reads pre-computed predictions

      ## Model Management
      - **Model Registry**: MLflow / Weights & Biases
      - **Versioning**: Git for code, registry for models
      - **A/B Testing**: Serve multiple model versions
      - **Rollback**: Quick revert to previous version

      ## Deployment Strategy
      - **Blue-Green**: Zero downtime deployment
      - **Canary**: 5% → 25% → 50% → 100% rollout
      - **Shadow Mode**: New model runs alongside old, no user impact

  Section: Monitoring & Alerts (text-editor)
    Content: |
      ## Performance Monitoring
      - **Latency**: p50, p95, p99 inference time
      - **Throughput**: Requests per second handled
      - **Error Rate**: Failed predictions, timeouts
      - **Resource Usage**: CPU, memory, GPU utilization

      ## Model Quality Monitoring
      - **Prediction Distribution**: Detect drift
      - **Feature Distribution**: Monitor input changes
      - **Online Accuracy**: When ground truth available
      - **Business Impact**: Track revenue, conversions

      ## Alerts
      - **P0**: Latency >500ms, Error rate >5%
      - **P1**: Accuracy drop >5%, Drift detected
      - **P2**: Resource usage >80%, Cost spike

      ## Retraining Strategy
      - **Scheduled**: Weekly retraining on new data
      - **Performance-based**: When accuracy drops <90%
      - **Data-driven**: When significant new data available
      - **Drift-based**: When feature/prediction drift detected
```

**Final ML Template Page Order:**
1. ML Problem Framing (Business problem + ML task definition)
2. Clarifying Questions (Requirements discovery Q&A)
3. Back-of-Envelope Calculations (Data, compute, cost estimates)
4. Data Strategy (Sources, features, pipeline)
5. Model Development (Selection, training, importance)
6. Evaluation & Quality (Offline metrics, A/B testing, quality checks)
7. Production Deployment (Serving, monitoring, retraining)

---

## 3. GenAI Design Template (LLM/Generative AI Systems)

### ❌ CURRENT STRUCTURE (Needs Some Fixes)

**Current:**
```
Page 1: Project Overview
  - Use Case (text-editor) ✅ Good but minimal

Page 2: Clarifying Requirements
  - GenAI Requirements Discovery (qa-pairs) ✅ Good
  - GenAI Requirements (bullet-list) ✅ Good

Page 3: Back-of-Envelope Calculations
  - GenAI Scale & Cost Estimates (calculations) ✅ Good

Page 4: Model Strategy
  - Model Selection & Strategy (text-editor) ✅ Good
  - Safety & Governance (checklist) ✅ Good

Page 5: GenAI Evaluation
  - GenAI Evaluation Strategy (text-editor) ✅ Good

Page 6: GenAI Deployment
  - GenAI Production Deployment (text-editor) ✅ Good
```

### ✅ ENHANCED GENAI STRUCTURE

**The current structure is actually pretty good! Just needs minor enhancements:**

**Page 1: Use Case & Problem Definition** (Enhanced)
```yaml
Page: Use Case & Requirements
  Section: Problem Statement (text-editor)
    Content: |
      ## GenAI Use Case
      What content are we generating? What problem does this solve?

      **Examples:**
      - Customer support chatbot (conversational)
      - Code generation assistant (code + explanations)
      - Content summarization (text transformation)
      - Creative writing assistant (long-form generation)

      ## Why Generative AI?
      - **Why not rules-based**: [Too complex patterns / Need creativity]
      - **Why not traditional ML**: [Need natural language / Need generation]
      - **What makes this suitable for GenAI**: [Well-defined task / Data available]

      ## Success Criteria

      ### Business Metrics
      - **User satisfaction**: [Target NPS score / Thumbs up rate]
      - **Efficiency gain**: [Reduce support time by 50%]
      - **Revenue impact**: [Increase conversion by 10%]

      ### Generation Quality
      - **Relevance**: Answers the user's question
      - **Accuracy**: Factually correct information
      - **Safety**: No harmful/biased content
      - **Style**: Matches desired tone and format

  Section: Example Interactions (text-editor or code-editor)
    Content: |
      ## Example Use Cases

      **Example 1: Customer Question**
      User: "How do I reset my password?"
      Expected Output: [Step-by-step instructions with helpful tone]

      **Example 2: Edge Case**
      User: "Tell me how to hack into an account"
      Expected Output: [Polite refusal, redirect to legitimate support]

      **Example 3: Ambiguous Query**
      User: "It's not working"
      Expected Output: [Clarifying questions to understand the issue]
```

**Page 2: Clarifying Requirements** (Already good, minor additions)
```yaml
Page: Clarifying Requirements
  Section: GenAI Requirements Discovery (qa-pairs)
    Additional Questions to Add:

      Q7: What is the expected input length? Context window needs?
      A7: [Average X tokens, max Y tokens, need for long context]

      Q8: Multi-turn conversations or single-shot?
      A8: [Stateless single prompts / Multi-turn with context]

      Q9: How to handle model failures and hallucinations?
      A9: [Fallback responses / Human review / Citation requirements]

      Q10: Integration with existing systems?
      A10: [API integration / Embedded in app / Slack bot / etc.]
```

**Page 3: Token Economics & Scale** (Enhanced calculations)
```yaml
Page: Back-of-Envelope Calculations
  Section: Token Economics (calculations or text-editor)
    Content: |
      ## Usage Metrics
      - **Daily Active Users**: [10K] users
      - **Prompts per User**: [5] prompts/day
      - **Total Daily Prompts**: 10K × 5 = [50K] prompts
      - **Peak QPS**: [20] prompts/second (assume 3x average)

      ## Token Breakdown

      ### Per Prompt
      - **System Prompt**: [500] tokens (role definition, instructions)
      - **User Input**: [200] tokens average (user question)
      - **Context/History**: [1000] tokens (RAG results or conversation history)
      - **Total Input**: 500 + 200 + 1000 = [1700] tokens per request
      - **Generated Output**: [400] tokens average (model response)

      ### Daily Token Usage
      - **Input Tokens**: 50K prompts × 1700 = [85M] tokens/day
      - **Output Tokens**: 50K prompts × 400 = [20M] tokens/day
      - **Total Tokens**: [105M] tokens/day

      ## Cost Estimates

      ### Option 1: GPT-4 (Highest Quality)
      - **Input**: 85M × $0.03/1K = $[2,550]/day
      - **Output**: 20M × $0.06/1K = $[1,200]/day
      - **Total**: $[3,750]/day = $[112,500]/month

      ### Option 2: GPT-3.5-Turbo (Cost-Effective)
      - **Input**: 85M × $0.0015/1K = $[127]/day
      - **Output**: 20M × $0.002/1K = $[40]/day
      - **Total**: $[167]/day = $[5,000]/month

      ### Option 3: Self-Hosted (LLaMA-2-70B)
      - **GPU Requirement**: [4×A100] GPUs = $[4,000]/month
      - **Throughput**: Can handle [50] QPS with 4 GPUs
      - **Storage**: Vector DB + Models = $[500]/month
      - **Total**: $[4,500]/month (fixed cost)

      ### Model Tiering Strategy
      - **Simple queries** (60%): GPT-3.5 at $[100]/day
      - **Complex queries** (40%): GPT-4 at $[1,500]/day
      - **Blended cost**: $[1,600]/day = $[48,000]/month

      ## Performance Targets
      - **Time to First Token**: <[500ms]
      - **Token Generation Speed**: [40] tokens/second
      - **Total Response Time**: <[3s] for 400 token response

      ## RAG Infrastructure (if applicable)
      - **Documents**: [1M] documents
      - **Embedding Cost**: 1M docs × 500 tokens × $0.0001 = $[50] one-time
      - **Vector DB Storage**: [20GB] embeddings = $[50]/month
      - **Query Latency**: <[100ms] for retrieval
```

**Page 4: Model & Knowledge Strategy** (Split into 2 pages)

**Page 4A: Model Selection**
```yaml
Page: Model Selection & Strategy
  Section: Base Model Selection (text-editor)
    Content: |
      ## Model Evaluation

      ### Selection Criteria
      | Criterion | Weight | GPT-4 | GPT-3.5 | Claude 3 | LLaMA-2-70B |
      |-----------|--------|-------|---------|----------|-------------|
      | Quality | 40% | 10/10 | 7/10 | 9/10 | 7/10 |
      | Cost | 30% | 3/10 | 9/10 | 5/10 | 8/10 |
      | Latency | 20% | 7/10 | 9/10 | 8/10 | 6/10 |
      | Control | 10% | 5/10 | 5/10 | 5/10 | 10/10 |
      | **Total** | | **6.9** | **7.6** | **7.0** | **7.2** |

      ### Decision: Multi-Model Strategy
      - **Primary**: GPT-3.5 for 70% of queries (cost-effective)
      - **Premium**: GPT-4 for 20% complex queries (quality)
      - **Fallback**: Claude 3 for 10% when others fail (reliability)

      ## Model Routing Logic
      ```python
      def route_to_model(query, user_tier):
          # Intent classification
          complexity = classify_complexity(query)

          if user_tier == "premium" or complexity == "high":
              return "gpt-4"
          elif complexity == "medium":
              return "gpt-3.5"
          else:
              return "gpt-3.5"  # Simple queries
      ```
```

**Page 4B: Knowledge Strategy (RAG vs Fine-tuning)**
```yaml
Page: Knowledge Integration
  Section: RAG vs Fine-tuning Decision (text-editor)
    Content: |
      ## Knowledge Strategy

      ### Option 1: RAG (Retrieval Augmented Generation)
      **When to Use:**
      - Need up-to-date information (docs change frequently)
      - Large knowledge base (can't fit in training)
      - Want to cite sources
      - Need to add/update knowledge without retraining

      **Implementation:**
      - **Vector DB**: Pinecone / Weaviate / Qdrant
      - **Embedding Model**: text-embedding-ada-002 / open-source
      - **Chunking Strategy**: 512 token chunks with 50 token overlap
      - **Retrieval**: Top-k=5 relevant chunks
      - **Reranking**: Cross-encoder for better relevance

      ### Option 2: Fine-tuning
      **When to Use:**
      - Need specific output format/style
      - Domain-specific terminology
      - Consistent behavior required
      - Have quality training data

      **Implementation:**
      - **Method**: PEFT/LoRA for parameter efficiency
      - **Training Data**: [10K] high-quality examples
      - **Training Cost**: $[500] per training run
      - **Maintenance**: Retrain monthly with new data

      ### Option 3: Hybrid Approach (Recommended)
      - **Base**: Fine-tuned model for style/format
      - **Knowledge**: RAG for facts and current info
      - **Prompts**: Few-shot examples for edge cases

  Section: Vector DB Design (table)
    Content: RAG implementation details
    Headers: [Component | Technology | Configuration | Cost]
    Rows:
      - Embedding Model | text-embedding-ada-002 | 1536 dimensions | $0.0001/1K tokens
      - Vector DB | Pinecone | 1M vectors, p1 pod | $70/month
      - Document Storage | S3 | 10GB documents | $2/month
      - Indexing Pipeline | Airflow | Daily updates | $50/month compute
```

**Page 5: Prompt Engineering & Safety**
```yaml
Page: Prompt Engineering & Safety
  Section: Prompt Strategy (code-editor)
    Content: |
      ## System Prompt Template

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
      - User's previous conversation history (if applicable)
      - User's account tier: [basic/premium]
      ```

      ## Few-Shot Examples

      **Example 1: Password Reset**
      User: "I forgot my password"
      Assistant: "I can help you reset your password! Here's how:
      1. Go to [company.com/login]
      2. Click 'Forgot Password'
      3. Enter your email address
      4. Check your email for a reset link
      5. Create a new password (8+ characters, mix of letters/numbers)

      The reset link expires in 24 hours. Let me know if you need any help!"

      ## Output Formatting
      - **Structured Output**: JSON for API responses
      - **Markdown**: For formatted text in chat
      - **Citations**: Include source references [1], [2]
      - **Validation**: Regex patterns for specific formats

  Section: Safety & Guardrails (checklist)
    Items:
      ✅ Content moderation (OpenAI Moderation API)
      ✅ PII detection and removal (presidio/custom patterns)
      ✅ Prompt injection defense (input validation)
      ✅ Output validation (check for hallucinations)
      ✅ Rate limiting (100 requests/hour per user)
      ✅ Cost limits ($100/day per user max)
      ✅ Human review for flagged content
      ✅ Feedback loop (thumbs up/down for improvements)
```

**Page 6: Evaluation & Quality**
```yaml
Page: Evaluation & Quality Assurance
  Section: Evaluation Metrics (text-editor)
    Content: |
      ## Automatic Evaluation

      ### Generation Quality
      - **Relevance**: Cosine similarity to gold answers (>0.85 target)
      - **Coherence**: Perplexity score (lower is better)
      - **Factual Accuracy**: Automated fact-checking against knowledge base
      - **Citation Accuracy**: Check if cited sources support claims

      ### Safety Metrics
      - **Toxicity Rate**: <0.1% of responses flagged
      - **PII Leakage**: 0 occurrences
      - **Hallucination Rate**: <5% (measured on test set)
      - **Policy Violations**: Track and categorize

      ## Human Evaluation

      ### Rating Criteria (1-5 scale)
      - **Helpfulness**: Did it solve the user's problem?
      - **Accuracy**: Is the information correct?
      - **Clarity**: Is it easy to understand?
      - **Safety**: Any concerning content?

      ### Evaluation Process
      - **Sample Size**: 100 responses per day
      - **Raters**: Mix of experts and target users
      - **Inter-rater agreement**: Fleiss' kappa >0.7
      - **Frequency**: Daily spot checks + weekly deep dives

      ## A/B Testing
      - **Test Design**: Champion (GPT-3.5) vs Challenger (GPT-4)
      - **Metrics**: User satisfaction, task completion, cost
      - **Sample**: 50/50 split, 10K users, 1 week
      - **Success Criteria**: +10% satisfaction with <2x cost increase

  Section: Quality Assurance Process (text-editor)
    Content: |
      ## Pre-Launch Testing

      ### Red Teaming
      - **Prompt Injection**: Try to override system prompts
      - **Jailbreaking**: Attempt to bypass safety measures
      - **Edge Cases**: Unusual inputs, ambiguous queries
      - **Stress Testing**: High concurrency, long contexts

      ### Regression Testing
      - **Golden Dataset**: 500 curated test cases
      - **Expected Outputs**: Human-verified correct responses
      - **Automated Checks**: Run on every model update
      - **Pass Criteria**: >95% match expected behavior

      ## Continuous Monitoring
      - **Real-time Dashboards**: Quality metrics updated live
      - **User Feedback**: Thumbs up/down, detailed reports
      - **Automated Flagging**: ML classifier for concerning responses
      - **Human Review Queue**: Flagged responses reviewed within 1 hour
```

**Page 7: Production & Operations**
```yaml
Page: Production Deployment & Operations
  Section: Serving Architecture (text-editor + whiteboard)
    Content: |
      ## Serving Infrastructure

      ### API Gateway Layer
      - **Authentication**: API keys, OAuth tokens
      - **Rate Limiting**: Redis-based token bucket
      - **Request Routing**: Route based on model tier
      - **Load Balancing**: Round-robin across replicas

      ### Model Serving
      - **Primary Model**: GPT-3.5 via OpenAI API
      - **Backup Model**: Claude via Anthropic API
      - **Self-hosted**: vLLM for cost-sensitive routes
      - **Failover**: Automatic switch on API errors

      ### Caching Strategy
      - **Semantic Caching**: Vector similarity for prompts
      - **Exact Match Cache**: Redis for identical queries
      - **Response Cache**: 24hr TTL for static answers
      - **Hit Rate Target**: 30% cache hit rate

      ### Context Management
      - **Session Storage**: Redis for conversation history
      - **Context Window**: Sliding window of last 10 messages
      - **Token Management**: Truncate old messages when limit reached
      - **Cleanup**: Remove sessions after 1 hour inactive

  Section: Monitoring & Cost Control (text-editor)
    Content: |
      ## Performance Monitoring

      ### Latency Metrics
      - **Time to First Token**: p50 <300ms, p95 <500ms
      - **Tokens/Second**: >40 tokens/sec
      - **End-to-End Latency**: p95 <3s
      - **Cache Hit Rate**: >30%

      ### Throughput
      - **Current QPS**: Real-time dashboard
      - **Capacity**: Max 100 QPS per model instance
      - **Auto-scaling**: Scale at 70% capacity
      - **Cost per Request**: Track by model tier

      ## Quality Monitoring
      - **Response Quality**: Automated scoring (0-1 scale)
      - **User Satisfaction**: Thumbs up rate >80%
      - **Safety Violations**: <0.1% flagged responses
      - **Hallucination Detection**: Consistency checks

      ## Cost Optimization

      ### Token Optimization
      - **Prompt Compression**: Remove redundant tokens
      - **Context Pruning**: Keep only relevant history
      - **Output Length**: Set max_tokens limits
      - **Caching**: Reuse responses where possible

      ### Smart Routing
      - **Complexity-based**: Simple → small model
      - **User tier-based**: Free → GPT-3.5, Pro → GPT-4
      - **Cost limits**: Stop at budget threshold
      - **Fallback chain**: GPT-4 → GPT-3.5 → Claude → Error

      ## Operational Procedures

      ### Incident Response
      - **Quality Drop**: Rollback to previous model version
      - **Cost Spike**: Activate cost limits, investigate
      - **Outage**: Failover to backup model provider
      - **Safety Incident**: Immediate review + temporary shutdown

      ### Regular Maintenance
      - **Prompt Updates**: A/B test weekly improvements
      - **Model Updates**: Evaluate new versions monthly
      - **Knowledge Refresh**: Update RAG docs daily
      - **Cost Review**: Weekly optimization opportunities
```

**Final GenAI Template Page Order:**
1. Use Case & Requirements (Problem + Examples)
2. Clarifying Questions (Requirements discovery Q&A)
3. Token Economics & Scale (Cost calculations, performance estimates)
4. Model Selection & Strategy (Model choice, routing logic)
5. Knowledge Integration (RAG vs Fine-tuning)
6. Prompt Engineering & Safety (Prompts, guardrails)
7. Evaluation & Quality (Metrics, A/B testing, QA process)
8. Production & Operations (Serving, monitoring, cost control)

---

## Summary of Changes

### System Design Template
- ✅ Already follows Alex Xu framework well
- 🔧 Add: API Design page
- 🔧 Add: Trade-offs & Wrap-up page
- 🔧 Enhance: Deep dive pages with trade-off discussions

### ML Design Template
- ❌ Major restructuring needed
- ✅ New flow: Problem → Clarify → Calculate → Data → Model → Eval → Deploy
- ✅ Each page has clear interview timing (10 min, 15 min, etc.)
- ✅ Better separation of concerns

### GenAI Design Template
- ✅ Structure is mostly good
- 🔧 Enhance: Token economics with model tiering
- 🔧 Split: Model strategy into Selection + Knowledge pages
- 🔧 Add: More detailed prompt engineering examples
- 🔧 Add: Cost optimization strategies

---

**Next Steps:**
1. Update `project-templates.ts` with these new structures
2. Update default content to be more interview-focused
3. Add timing guidance (5 min, 10 min, etc.) to page descriptions
4. Test with real interview scenarios
