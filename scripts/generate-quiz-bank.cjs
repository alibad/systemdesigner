#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the content registry to get all content entries
function loadContentRegistry() {
  const registryPath = path.join(process.cwd(), 'lib', 'content-registry.ts');
  const content = fs.readFileSync(registryPath, 'utf8');

  // Extract content entries by parsing the TypeScript file
  const entries = [];
  const lines = content.split('\n');
  let currentEntry = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Start of new entry
    if (line.includes('id:') && line.includes("'")) {
      const idMatch = line.match(/id:\s*'([^']+)'/);
      if (idMatch) {
        currentEntry = { id: idMatch[1] };
      }
    }

    // Extract title
    if (currentEntry && line.includes('title:') && line.includes("'")) {
      const titleMatch = line.match(/title:\s*'([^']+)'/);
      if (titleMatch) {
        currentEntry.title = titleMatch[1];
      }
    }

    // Extract section
    if (currentEntry && line.includes('section:') && line.includes("'")) {
      const sectionMatch = line.match(/section:\s*'([^']+)'/);
      if (sectionMatch) {
        currentEntry.section = sectionMatch[1];
      }
    }

    // Extract level
    if (currentEntry && line.includes('level:') && line.includes("'")) {
      const levelMatch = line.match(/level:\s*'([^']+)'/);
      if (levelMatch) {
        currentEntry.level = levelMatch[1];
      }
    }

    // End of entry (closing brace)
    if (currentEntry && line === '},') {
      if (currentEntry.id && currentEntry.title && currentEntry.section) {
        entries.push(currentEntry);
      }
      currentEntry = null;
    }
  }

  console.log(`📊 Found ${entries.length} content entries in registry`);
  return entries;
}

// Load existing quiz bank
function loadExistingQuizBank() {
  const quizBankPath = path.join(process.cwd(), 'lib', 'quiz-bank', 'all-quizzes.json');
  if (fs.existsSync(quizBankPath)) {
    const content = fs.readFileSync(quizBankPath, 'utf8');
    return JSON.parse(content);
  }
  return {};
}

// Generate quiz questions based on section and topic
function generateQuizQuestions(entry) {
  const { id, title, section, level } = entry;

  // Template questions by section
  const questionTemplates = {
    fundamentals: [
      {
        question: `What is the primary purpose of ${title.toLowerCase()}?`,
        options: [
          "To increase system complexity",
          "To improve system scalability and reliability",
          "To reduce development time",
          "To minimize hardware costs"
        ],
        correctAnswer: 1,
        explanation: `${title} focuses on building systems that can scale effectively while maintaining reliability and performance.`
      },
      {
        question: `Which factor is most important when implementing ${title.toLowerCase()}?`,
        options: [
          "Latest technology trends",
          "System requirements and constraints",
          "Development team size",
          "Project timeline"
        ],
        correctAnswer: 1,
        explanation: `Understanding system requirements and constraints is crucial for effective implementation of ${title.toLowerCase()}.`
      },
      {
        question: `What is a key benefit of ${title.toLowerCase()}?`,
        options: [
          "Reduced code complexity",
          "Improved system performance and maintainability",
          "Faster development cycles",
          "Lower infrastructure costs"
        ],
        correctAnswer: 1,
        explanation: `${title} primarily aims to improve system performance and maintainability through better design practices.`
      },
      {
        question: `When should you consider ${title.toLowerCase()}?`,
        options: [
          "Only for large-scale systems",
          "When system requirements demand it",
          "Always, regardless of context",
          "Only when other approaches fail"
        ],
        correctAnswer: 1,
        explanation: `${title} should be considered when system requirements and constraints make it the appropriate solution.`
      }
    ],
    genai: [
      {
        question: `What is the main use case for ${title}?`,
        options: [
          "Traditional software development",
          "AI-powered content generation and processing",
          "Database management",
          "Network security"
        ],
        correctAnswer: 1,
        explanation: `${title} is primarily used for AI-powered content generation and intelligent processing tasks.`
      },
      {
        question: `Which component is essential for ${title} implementation?`,
        options: [
          "Relational database",
          "Large language model or AI framework",
          "Load balancer",
          "Message queue"
        ],
        correctAnswer: 1,
        explanation: `${title} requires large language models or AI frameworks as core components for processing and generation.`
      },
      {
        question: `What is a key consideration when deploying ${title}?`,
        options: [
          "Database indexing",
          "Model inference latency and token costs",
          "Network bandwidth",
          "Storage capacity"
        ],
        correctAnswer: 1,
        explanation: `${title} deployment must consider model inference latency and token/compute costs for optimal performance.`
      },
      {
        question: `How does ${title} handle context and memory?`,
        options: [
          "Through traditional caching",
          "Using conversation history and context windows",
          "Via database transactions",
          "Through session management"
        ],
        correctAnswer: 1,
        explanation: `${title} manages context through conversation history and model context windows for coherent interactions.`
      }
    ],
    'ml-systems': [
      {
        question: `What is the primary goal of ${title}?`,
        options: [
          "Web development",
          "Machine learning model deployment and optimization",
          "Database administration",
          "Network management"
        ],
        correctAnswer: 1,
        explanation: `${title} focuses on effectively deploying and optimizing machine learning models in production systems.`
      },
      {
        question: `Which metric is most important for ${title}?`,
        options: [
          "Code coverage",
          "Model accuracy and inference latency",
          "Database throughput",
          "Network uptime"
        ],
        correctAnswer: 1,
        explanation: `${title} prioritizes model accuracy and inference latency to ensure effective ML system performance.`
      },
      {
        question: `What is a common challenge with ${title}?`,
        options: [
          "Database schema design",
          "Model drift and data quality issues",
          "Frontend rendering",
          "DNS resolution"
        ],
        correctAnswer: 1,
        explanation: `${title} commonly faces challenges with model drift and maintaining data quality over time.`
      },
      {
        question: `How does ${title} ensure reliability?`,
        options: [
          "Database replication",
          "Model monitoring and automated retraining",
          "Load balancing",
          "CDN deployment"
        ],
        correctAnswer: 1,
        explanation: `${title} ensures reliability through continuous model monitoring and automated retraining pipelines.`
      }
    ],
    technology: [
      {
        question: `What is ${title} primarily used for?`,
        options: [
          "General-purpose computing",
          "Specific technical functionality based on its design",
          "Operating system management",
          "Hardware optimization"
        ],
        correctAnswer: 1,
        explanation: `${title} is designed for specific technical use cases that leverage its unique capabilities and features.`
      },
      {
        question: `What is a key advantage of ${title}?`,
        options: [
          "Universal compatibility",
          "Optimized performance for its intended use case",
          "Zero configuration required",
          "No learning curve"
        ],
        correctAnswer: 1,
        explanation: `${title} provides optimized performance and features specifically designed for its intended use cases.`
      },
      {
        question: `When should you consider using ${title}?`,
        options: [
          "For every project",
          "When its capabilities match your system requirements",
          "Only for prototypes",
          "As a last resort"
        ],
        correctAnswer: 1,
        explanation: `${title} should be chosen when its specific capabilities and features align with your system requirements.`
      },
      {
        question: `What is an important consideration when implementing ${title}?`,
        options: [
          "Marketing requirements",
          "Performance characteristics and integration complexity",
          "Team preferences",
          "Industry trends"
        ],
        correctAnswer: 1,
        explanation: `Implementation of ${title} requires careful consideration of its performance characteristics and integration complexity.`
      }
    ],
    'case-studies': [
      {
        question: `What is the main focus of the ${title} case study?`,
        options: [
          "Academic research",
          "Real-world system architecture and implementation",
          "Theoretical concepts",
          "Marketing strategies"
        ],
        correctAnswer: 1,
        explanation: `${title} demonstrates real-world system architecture and implementation practices from production systems.`
      },
      {
        question: `What key insight does ${title} provide?`,
        options: [
          "Perfect solutions exist for all problems",
          "Trade-offs and constraints drive architectural decisions",
          "Technology choice is always the most important factor",
          "Scale is the only consideration"
        ],
        correctAnswer: 1,
        explanation: `${title} illustrates how trade-offs and constraints shape real-world architectural decisions.`
      },
      {
        question: `How does ${title} handle scale?`,
        options: [
          "Through single-server optimization",
          "Using distributed systems principles and patterns",
          "By avoiding the problem",
          "Through hardware upgrades only"
        ],
        correctAnswer: 1,
        explanation: `${title} demonstrates scaling through distributed systems principles and proven architectural patterns.`
      },
      {
        question: `What lesson can be learned from ${title}?`,
        options: [
          "One-size-fits-all solutions work best",
          "Context-specific solutions based on requirements and constraints",
          "Always use the newest technology",
          "Avoid complexity at all costs"
        ],
        correctAnswer: 1,
        explanation: `${title} teaches the importance of context-specific solutions tailored to specific requirements and constraints.`
      }
    ],
    practice: [
      {
        question: `What is the primary goal when designing ${title.replace('Design ', '')}?`,
        options: [
          "Use as many technologies as possible",
          "Meet specific requirements while balancing trade-offs",
          "Minimize development time",
          "Maximize feature count"
        ],
        correctAnswer: 1,
        explanation: `Designing ${title.replace('Design ', '').toLowerCase()} requires meeting specific requirements while carefully balancing trade-offs.`
      },
      {
        question: `What should you consider first when approaching ${title}?`,
        options: [
          "Technology selection",
          "Requirements clarification and constraints",
          "Implementation details",
          "Team structure"
        ],
        correctAnswer: 1,
        explanation: `${title} should begin with thorough requirements clarification and understanding of constraints.`
      },
      {
        question: `How do you ensure ${title.replace('Design ', '').toLowerCase()} can scale?`,
        options: [
          "Use the most powerful hardware",
          "Design for horizontal scaling and plan for bottlenecks",
          "Avoid distributed systems",
          "Focus only on current requirements"
        ],
        correctAnswer: 1,
        explanation: `Scalable ${title.replace('Design ', '').toLowerCase()} requires horizontal scaling design and proactive bottleneck planning.`
      },
      {
        question: `What is most important for ${title} reliability?`,
        options: [
          "Perfect code with no bugs",
          "Failure handling and graceful degradation",
          "Expensive hardware",
          "Small team size"
        ],
        correctAnswer: 1,
        explanation: `Reliable ${title.replace('Design ', '').toLowerCase()} depends on robust failure handling and graceful degradation strategies.`
      }
    ],
    reference: [
      {
        question: `What is the purpose of ${title}?`,
        options: [
          "Entertainment",
          "Quick reference and decision-making support",
          "Marketing material",
          "Academic research"
        ],
        correctAnswer: 1,
        explanation: `${title} serves as a quick reference guide to support technical decision-making and implementation.`
      },
      {
        question: `When should you consult ${title}?`,
        options: [
          "Only when completely stuck",
          "During design and implementation phases",
          "After project completion",
          "For debugging only"
        ],
        correctAnswer: 1,
        explanation: `${title} is most valuable when consulted during design and implementation phases for guidance.`
      },
      {
        question: `How should ${title} be used effectively?`,
        options: [
          "Memorize all content",
          "Use as contextual guidance for specific situations",
          "Replace engineering judgment",
          "Follow blindly without consideration"
        ],
        correctAnswer: 1,
        explanation: `${title} should be used as contextual guidance while applying engineering judgment to specific situations.`
      },
      {
        question: `What makes ${title} valuable?`,
        options: [
          "Complex theoretical explanations",
          "Practical insights distilled from experience",
          "Comprehensive coverage of all topics",
          "Latest technology trends"
        ],
        correctAnswer: 1,
        explanation: `${title} provides practical insights distilled from real-world experience and proven practices.`
      }
    ],
    tools: [
      {
        question: `What is the main purpose of ${title}?`,
        options: [
          "Academic study",
          "Interactive calculation and analysis",
          "Documentation generation",
          "Code compilation"
        ],
        correctAnswer: 1,
        explanation: `${title} provides interactive calculation and analysis capabilities for practical system design work.`
      },
      {
        question: `When is ${title} most useful?`,
        options: [
          "After system deployment",
          "During planning and capacity estimation",
          "For marketing presentations",
          "Only for learning purposes"
        ],
        correctAnswer: 1,
        explanation: `${title} is most valuable during planning and capacity estimation phases of system design.`
      },
      {
        question: `What type of insights does ${title} provide?`,
        options: [
          "Historical data",
          "Quantitative estimates and projections",
          "Qualitative assessments",
          "Marketing metrics"
        ],
        correctAnswer: 1,
        explanation: `${title} provides quantitative estimates and projections to support data-driven design decisions.`
      },
      {
        question: `How should results from ${title} be interpreted?`,
        options: [
          "As absolute truth",
          "As estimates requiring engineering judgment",
          "As marketing numbers",
          "As minimum requirements"
        ],
        correctAnswer: 1,
        explanation: `Results from ${title} should be interpreted as estimates that require additional engineering judgment and validation.`
      }
    ]
  };

  const templates = questionTemplates[section] || questionTemplates.fundamentals;
  return templates;
}

// Main function
function generateCompleteQuizBank() {
  console.log('🚀 Generating complete quiz bank...\n');

  // Load content registry and existing quizzes
  const contentEntries = loadContentRegistry();
  const existingQuizzes = loadExistingQuizBank();

  console.log(`📊 Existing quizzes: ${Object.keys(existingQuizzes).length}`);
  console.log(`📊 Content entries: ${contentEntries.length}`);

  // Generate quiz bank
  const completeQuizBank = {};
  let generatedCount = 0;
  let keptCount = 0;

  contentEntries.forEach(entry => {
    if (existingQuizzes[entry.id]) {
      // Keep existing quiz
      completeQuizBank[entry.id] = existingQuizzes[entry.id];
      keptCount++;
    } else {
      // Generate new quiz
      const questions = generateQuizQuestions(entry);
      completeQuizBank[entry.id] = {
        title: entry.title,
        section: entry.section,
        difficulty: entry.level || 'intermediate',
        duration: '10 min',
        questions: questions
      };
      generatedCount++;
    }
  });

  // Save complete quiz bank
  const outputPath = path.join(process.cwd(), 'lib', 'quiz-bank', 'all-quizzes.json');
  fs.writeFileSync(outputPath, JSON.stringify(completeQuizBank, null, 2));

  console.log('\n✅ Complete quiz bank generated!');
  console.log(`📊 Total quizzes: ${Object.keys(completeQuizBank).length}`);
  console.log(`🔄 Kept existing: ${keptCount}`);
  console.log(`✨ Generated new: ${generatedCount}`);
  console.log(`💾 Saved to: ${outputPath}`);

  // Show missing entries (should be 0)
  const missingEntries = contentEntries.filter(entry => !completeQuizBank[entry.id]);
  if (missingEntries.length > 0) {
    console.log(`\n⚠️  Missing quizzes: ${missingEntries.length}`);
    missingEntries.forEach(entry => console.log(`   - ${entry.id}: ${entry.title}`));
  } else {
    console.log('\n🎯 100% coverage achieved!');
  }
}

if (require.main === module) {
  generateCompleteQuizBank();
}