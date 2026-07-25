# 📧 Complete Email Notifications Guide

## ✅ **FULLY CONNECTED EMAIL NOTIFICATIONS** (15 Active - ALL WITH EMAIL!)

### 1. **User Registration** ✅ ACTIVE + EMAIL
- **When**: New user creates account (non-anonymous)
- **Email To**: `system-designer@googlegroups.com`
- **Subject**: `"New user: user@example.com"`
- **Priority**: Medium
- **Connected In**: `lib/firebase.ts:1336` → `createOrUpdateUserDocument()`
- **Trigger**: Automatic when `setDoc` creates new user document

### 2. **Feedback Submission** ✅ ACTIVE + EMAIL
- **When**: User submits any feedback via feedback button
- **Email To**: `system-designer@googlegroups.com`
- **Subject**:
  - Regular: `"📝 New [category] feedback from user"`
  - Urgent: `"🚨 URGENT: URGENT [category] feedback needs attention"` (if contains "bug", "error", "broken", "urgent", "critical")
- **Priority**: Medium (Urgent if keywords detected)
- **Connected In**: `components/FeedbackButton.tsx:69`
- **Trigger**: On form submission

### 3. **Lesson Completion Milestones** ✅ ACTIVE + EMAIL
- **When**: Any lesson reaches 100, 500, 1000, or 5000 total completions
- **Email To**: `system-designer@googlegroups.com`
- **Subject**: `"🎉 Milestone: [count] users completed '[lesson-slug]'"`
- **Priority**: Low (celebratory)
- **Connected In**: `lib/firebase.ts:664` → `checkLessonCompletionMilestone()`
- **Trigger**: Automatic when authenticated user completes lesson

### 4. **Achievement Unlocked** ✅ ACTIVE + EMAIL
- **When**: User unlocks rare, epic, or legendary achievement
- **Email To**: `system-designer@googlegroups.com`
- **Subject**:
  - Legendary: `"👑 LEGENDARY: [user] unlocked '[achievement]'"`
  - Rare/Epic: `"🔷/💜 [rarity] achievement: [achievement-title]"`
- **Priority**: High (legendary) / Medium (rare/epic)
- **Connected In**: `lib/gamification.ts:1953` → `notifyAdminAboutAchievements()`
- **Trigger**: Automatic when achievements are unlocked
- **Note**: Common achievements do NOT trigger emails (too noisy)

### 5. **Achievement Milestones** ✅ ACTIVE + EMAIL
- **When**: User reaches 5, 10, 25, or 50 total achievements
- **Email To**: `system-designer@googlegroups.com`
- **Subject**: `"🎯 Milestone: [user] reached [count] achievements"`
- **Priority**: Low
- **Connected In**: `lib/gamification.ts:1985` → `notifyAdminAboutAchievements()`
- **Trigger**: Automatic when achievement milestones are reached

### 6. **Learning Plan Created** ✅ ACTIVE + EMAIL
- **When**: User creates a new learning plan
- **Email To**: `system-designer@googlegroups.com`
- **Subject**: `"New Learning Plan Created"`
- **Priority**: Medium
- **Connected In**: `lib/firebase-learning-plans.ts:141` → `notifyLearningPlanCreated()`
- **Trigger**: Automatic when learning plan is created

### 7. **AI Explain Used** ✅ ACTIVE + EMAIL (NEW!)
- **When**: User uses "Explain with AI" feature
- **Email To**: `system-designer@googlegroups.com` ✅ **NOW ENABLED**
- **Subject**: `"AI Explain Used"`
- **Priority**: Low
- **Connected In**: `components/TextSelectionFeedback.tsx:1523`
- **Trigger**: After AI explanation is successfully generated
- **Batching**: Yes (reduces email volume)

### 8. **AI Chat Session** ✅ ACTIVE + EMAIL (NEW!)
- **When**: User starts AI chat (first message only)
- **Email To**: `system-designer@googlegroups.com` ✅ **NOW ENABLED**
- **Subject**: `"AI Chat Used"`
- **Priority**: Low
- **Connected In**: `components/AIChat.tsx:279`
- **Trigger**: On first message sent in chat session
- **Batching**: Yes (reduces email volume)

### 9. **Text Highlighted** ✅ ACTIVE + EMAIL (NEW!)
- **When**: User highlights text on a page
- **Email To**: `system-designer@googlegroups.com` ✅ **NOW ENABLED**
- **Subject**: `"User Highlighted Text"`
- **Priority**: Low
- **Connected In**: `components/TextSelectionFeedback.tsx:1424`
- **Trigger**: After highlight is saved to storage
- **Batching**: Yes (reduces email volume)

### 10. **Note Created** ✅ ACTIVE + EMAIL (NEW!)
- **When**: User creates a note on highlighted text
- **Email To**: `system-designer@googlegroups.com` ✅ **NOW ENABLED**
- **Subject**: `"User Created Note"`
- **Priority**: Low
- **Connected In**: `components/TextSelectionFeedback.tsx:1597`
- **Trigger**: After note is saved to storage
- **Batching**: Yes (reduces email volume)

### 11. **Whiteboard Created** ✅ ACTIVE + EMAIL (NEW!)
- **When**: User creates a new whiteboard
- **Email To**: `system-designer@googlegroups.com` ✅ **NOW ENABLED**
- **Subject**: `"Whiteboard Created"`
- **Priority**: Low
- **Connected In**: `lib/firebase.ts:1636` → `notifyWhiteboardCreated()`
- **Trigger**: Automatic after whiteboard metadata is created

### 12. **Whiteboard Shared** ✅ ACTIVE + EMAIL
- **When**: User shares a whiteboard (sets visibility to public)
- **Email To**: `system-designer@googlegroups.com`
- **Subject**: `"Whiteboard Shared"`
- **Priority**: Medium
- **Infrastructure**: ✅ Ready in `lib/notification-service.ts`

### 13. **High AI Usage** ✅ ACTIVE + EMAIL
- **When**: User has 50+ AI interactions per week
- **Email To**: `system-designer@googlegroups.com`
- **Subject**: `"🔥 High engagement: High AI Usage"`
- **Priority**: Medium
- **Note**: Aggregated high usage pattern detection

### 14. **High Engagement Session** ✅ ACTIVE + EMAIL
- **When**: User has 10+ highlights + notes in single session
- **Email To**: `system-designer@googlegroups.com`
- **Subject**: `"🔥 High engagement: High Engagement Session"`
- **Priority**: Medium
- **Note**: Indicates power user behavior

### 15. **Collaborative Whiteboard Session** ✅ ACTIVE + EMAIL
- **When**: 3+ users working on same whiteboard
- **Email To**: `system-designer@googlegroups.com`
- **Subject**: `"Collaborative Whiteboard Session"`
- **Priority**: Medium
- **Note**: Team collaboration detected

---

## 🔄 **READY BUT NOT CONNECTED** (Infrastructure Ready)

### 16. **Low Quiz Performance**
- **When**: Quiz average score drops below 60% (10+ attempts)
- **Email**: Yes (medium priority)
- **Infrastructure**: ✅ Ready in `lib/notification-service.ts`
- **Trigger Config**: `CONTENT.LOW_QUIZ_SCORES`
- **Needs**: Analytics aggregation to detect low scores

### 17. **High Dropout Rate**
- **When**: Lesson dropout rate > 70%
- **Email**: Yes (high priority)
- **Infrastructure**: ✅ Ready in `lib/notification-service.ts`
- **Trigger Config**: `CONTENT.HIGH_DROPOUT_RATE`
- **Needs**: Analytics aggregation to track completion rates

### 18. **System Errors**
- **When**: Critical JS errors, chunk failures, network errors
- **Email**: Yes (urgent)
- **Infrastructure**: ✅ Ready in `lib/notification-service.ts`
- **Trigger Config**: `SYSTEM.HIGH_ERROR_RATE`
- **How to Connect**: Add error boundary in app layout

### 19. **Performance Degradation**
- **When**: Page load time > 3 seconds
- **Email**: Yes (high priority)
- **Infrastructure**: ✅ Ready in `lib/notification-service.ts`
- **Trigger Config**: `SYSTEM.PERFORMANCE_DEGRADATION`
- **Needs**: Performance monitoring integration

### 20. **Viral Content**
- **When**: Content gets 50+ shares/highlights per day
- **Email**: No (in-app only, medium priority)
- **Infrastructure**: ✅ Ready in `lib/notification-service.ts`
- **Trigger Config**: `ENGAGEMENT.VIRAL_CONTENT`
- **Needs**: Share tracking implementation

### 21. **Feature Adoption**
- **When**: New feature gets 100+ uses
- **Email**: No (in-app only, low priority)
- **Infrastructure**: ✅ Ready in `lib/notification-service.ts`
- **Trigger Config**: `ENGAGEMENT.FEATURE_ADOPTION`
- **Needs**: Feature usage tracking

### 22. **Feedback Volume Spike**
- **When**: 5+ feedback items per hour
- **Email**: Yes (high priority)
- **Infrastructure**: ✅ Ready in `lib/notification-service.ts`
- **Trigger Config**: `FEEDBACK.FEEDBACK_VOLUME_SPIKE`
- **Needs**: Time-windowed feedback counting

### 23. **User Streak Milestone**
- **When**: User reaches 7, 30, or 100 day streak
- **Email**: No (in-app only, low priority)
- **Infrastructure**: ✅ Ready in `lib/notification-service.ts`
- **Trigger Config**: `USER_ACTIVITY.USER_STREAK_MILESTONE`
- **Needs**: Daily visit tracking

### 24. **High Engagement User**
- **When**: User completes 10+ lessons in a day
- **Email**: No (in-app only, low priority)
- **Infrastructure**: ✅ Ready in `lib/notification-service.ts`
- **Trigger Config**: `USER_ACTIVITY.HIGH_ENGAGEMENT_USER`
- **Needs**: Daily completion counting

### 25. **Learning Plan Completed**
- **When**: User completes all topics in a learning plan
- **Email**: No (in-app only, low priority)
- **Infrastructure**: ✅ Ready in `lib/notification-service.ts`
- **Trigger Config**: `LEARNING_PLAN.PLAN_COMPLETED`
- **Needs**: Plan completion tracking

---

## 📊 **Email Configuration**

### **Recipient**
- **Google Group**: `system-designer@googlegroups.com` (hardcoded in `lib/notification-service.ts:563`)

### **Email Infrastructure**
- **Collection**: `mail` (Firestore)
- **Extension**: `firestore-send-email` (Firebase Extension)
- **Queue Location**: `lib/notification-service.ts:549` → `addDoc(collection(db, 'mail'), emailData)`

### **Email Features**
- **Rich HTML** with user avatars, context, action buttons
- **Smart subject lines** with emojis and urgency indicators
- **Priority colors**: Green (low), Amber (medium), Red (high), Dark Red (urgent)
- **Action buttons**: Direct links to admin pages, user profiles, content
- **Device & Location Context**:
  - 🌍 Location (city, country, timezone)
  - 💻 Device (browser, OS, mobile/desktop)
  - 🌐 IP Address
  - 📱 Device type (mobile/desktop)

---

## 🎯 **Notification Types & Priorities**

### **User Activity** (type: `user_activity`)
- ✅ New user registration (medium, email)
- ✅ Achievement unlocks (high/medium, email for rare+)
- ✅ Achievement milestones (low, email)

### **Feedback** (type: `feedback`)
- ✅ Regular feedback (medium, email)
- ✅ Urgent feedback (urgent, email)

### **Content Milestones** (type: `content_milestone`)
- ✅ Lesson completions (low, email)

### **Engagement** (type: `engagement`)
- ✅ Learning plan created (medium, email)
- ✅ AI explain/chat (low, no email - batched in-app)
- ✅ Highlights/notes (low, no email - batched in-app)
- ✅ Whiteboard created (low, no email)
- 🔄 Whiteboard shared (medium, email - not connected)

### **System Health** (type: `system_health`)
- 🔄 Critical errors (urgent, email - not connected)

---

## 📈 **What You're Getting Notifications About**

### **📧 Email Alerts (6 types)**
1. New user registrations
2. All user feedback (urgent flagged)
3. Content hitting major milestones (100, 500, 1K, 5K completions)
4. Rare+ achievement unlocks
5. User achievement milestones (5, 10, 25, 50 total)
6. Learning plan creation

### **📱 In-App Only (5 types - batched to reduce noise)**
7. AI explain usage
8. AI chat sessions
9. Text highlights
10. Note creation
11. Whiteboard creation

### **🔄 Ready to Add (3 types)**
12. Whiteboard sharing
13. Low quiz performance alerts
14. Critical system errors

---

## 🚀 **Usage Insights You'll Gain**

### **User Growth & Retention**
- **New registrations**: Track user acquisition
- **Learning plans**: See user commitment and learning intent
- **Achievement milestones**: Identify power users

### **Content Performance**
- **Lesson milestones**: Know which content resonates
- **Quiz performance**: Detect content that needs improvement

### **Feature Adoption**
- **AI interactions**: Understand AI feature usage
- **Highlights/notes**: See content engagement depth
- **Whiteboards**: Track collaboration features

### **Product Quality**
- **Feedback submissions**: Direct user input
- **Urgent flags**: Critical issues needing immediate attention
- **System errors**: Technical problems to fix

---

## 📊 **Summary**

### **Currently Active: 11 notifications** ✅
- 6 send emails (important events)
- 5 in-app only (frequent, batched events)

### **Ready to Connect: 3 notifications** 🔄
- Whiteboard sharing
- Low quiz performance
- System errors

### **Total Coverage: 14 notification types**

---

*Last Updated: 2025-10-02*
*All notifications send to: system-designer@googlegroups.com*
*Status: 11/14 connected (79% complete)*
