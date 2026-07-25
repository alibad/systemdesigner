'use client';

import { ScenarioAnalysis } from '@/components/fundamentals/InteractiveLearning';

export default function ScalabilityScenarios() {
  return (
    <ScenarioAnalysis
      title="Real-world Scaling Scenarios"
      description="Explore how different companies handle scaling challenges"
      category="fundamentals"
      scenarios={[
        {
          name: 'E-commerce Flash Sale',
          description: 'Black Friday traffic spike: 10x normal load in 1 hour',
          metrics: [
            { label: 'Normal Traffic', value: '1K RPS' },
            { label: 'Peak Traffic', value: '10K RPS', color: 'text-red-600 dark:text-red-400' },
            { label: 'Response Time', value: '2.5s', color: 'text-red-600 dark:text-red-400' },
            { label: 'Error Rate', value: '15%', color: 'text-red-600 dark:text-red-400' },
          ],
          outcome: 'Without auto-scaling, servers crashed. Lost $2M in sales during 3-hour outage.',
          lessons: [
            'Pre-scale infrastructure before known traffic spikes',
            'Implement auto-scaling with aggressive scaling policies',
            'Use CDN and caching to reduce server load',
            'Load test with 10x expected traffic',
          ],
        },
        {
          name: 'Social Media Viral Post',
          description: 'Unexpected viral content: 100x traffic in 30 minutes',
          metrics: [
            { label: 'Baseline Traffic', value: '500 RPS' },
            { label: 'Viral Peak', value: '50K RPS', color: 'text-orange-600 dark:text-orange-400' },
            { label: 'Auto-scale Time', value: '5 minutes' },
            { label: 'Service Maintained', value: '99.8%', color: 'text-green-600 dark:text-green-400' },
          ],
          outcome: 'Auto-scaling and circuit breakers prevented total failure. Minor degradation for 5 minutes.',
          lessons: [
            'Horizontal scaling handles unpredictable spikes better',
            'Circuit breakers prevent cascading failures',
            'Graceful degradation maintains core functionality',
            'Monitor social media for early viral detection',
          ],
        },
        {
          name: 'Gaming Launch Day',
          description: 'New game release: Sustained high load for 48 hours',
          metrics: [
            { label: 'Expected Users', value: '100K' },
            { label: 'Actual Users', value: '500K', color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Queue System', value: 'Active' },
            { label: 'Player Satisfaction', value: '85%', color: 'text-green-600 dark:text-green-400' },
          ],
          outcome: 'Queue system managed demand. Players waited but stayed engaged. Server costs 3x budget but revenue 5x.',
          lessons: [
            'Queue systems can manage demand spikes gracefully',
            'Communication with users during delays is crucial',
            'Over-provisioning for launches can be profitable',
            'Plan for success - prepare for higher than expected demand',
          ],
        },
        {
          name: 'Streaming Service Super Bowl',
          description: 'Live sports streaming: 50M concurrent viewers during halftime',
          metrics: [
            { label: 'Peak Viewers', value: '50M', color: 'text-red-600 dark:text-red-400' },
            { label: 'CDN Bandwidth', value: '200 Tbps', color: 'text-orange-600 dark:text-orange-400' },
            { label: 'Stream Quality', value: '4K/60fps' },
            { label: 'Global Uptime', value: '99.95%', color: 'text-green-600 dark:text-green-400' },
          ],
          outcome: 'Pre-scaled infrastructure to 3x normal capacity. Minor buffering in some regions but overall success.',
          lessons: [
            'Pre-event capacity planning is critical for live content',
            'Global CDN distribution prevents regional overload',
            'Adaptive bitrate streaming maintains quality during congestion',
            'Real-time monitoring enables rapid response to issues',
          ],
        },
        {
          name: 'Banking System Payment Rush',
          description: 'Tax deadline day: 10x increase in money transfers and payments',
          metrics: [
            { label: 'Normal TPS', value: '50K' },
            { label: 'Peak TPS', value: '500K', color: 'text-red-600 dark:text-red-400' },
            { label: 'Queue Depth', value: '2M requests', color: 'text-orange-600 dark:text-orange-400' },
            { label: 'Processing Delay', value: '15 minutes', color: 'text-yellow-600 dark:text-yellow-400' },
          ],
          outcome: 'Database became bottleneck. Read replicas helped but write contention caused delays. No data loss.',
          lessons: [
            'Financial systems require careful database scaling planning',
            'Write-heavy workloads need different scaling strategies than read-heavy',
            'Queue systems prevent data loss during overload',
            'Regulatory compliance limits how aggressively you can scale',
          ],
        },
        {
          name: 'News Site Breaking Story',
          description: 'Major world event: Traffic from 10K to 2M users in 20 minutes',
          metrics: [
            { label: 'Traffic Spike', value: '200x normal', color: 'text-red-600 dark:text-red-400' },
            { label: 'Page Load Time', value: '8 seconds', color: 'text-red-600 dark:text-red-400' },
            { label: 'Auto-scale Response', value: '12 minutes' },
            { label: 'Revenue Impact', value: '+400%', color: 'text-green-600 dark:text-green-400' },
          ],
          outcome: 'Site initially slowed but auto-scaling kicked in. Static content caching saved the day.',
          lessons: [
            'News sites need aggressive caching for breaking stories',
            'Auto-scaling policies should be tuned for rapid response',
            'Static content delivery is crucial for content sites',
            'Performance during viral moments directly impacts ad revenue',
          ],
        },
        {
          name: "Ride-sharing New Year's Eve",
          description: 'Peak demand night: 50x normal ride requests in major cities',
          metrics: [
            { label: 'Normal Requests/min', value: '1K' },
            { label: 'Peak Requests/min', value: '50K', color: 'text-red-600 dark:text-red-400' },
            { label: 'Matching Success', value: '65%', color: 'text-yellow-600 dark:text-yellow-400' },
            { label: 'Avg Wait Time', value: '25 minutes', color: 'text-orange-600 dark:text-orange-400' },
          ],
          outcome: 'Surge pricing activated. Matching algorithm scaled but driver supply was the real bottleneck.',
          lessons: [
            'Some bottlenecks are business model constraints, not technical',
            'Predictable demand spikes should trigger pre-scaling',
            'Algorithm efficiency matters more at extreme scale',
            'Economic incentives (surge pricing) can balance supply/demand',
          ],
        },
        {
          name: 'Cloud Storage Backup Sunday',
          description: 'Weekly backup day: 100TB+ of data uploaded simultaneously',
          metrics: [
            { label: 'Upload Volume', value: '100TB+', color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Concurrent Uploads', value: '500K', color: 'text-orange-600 dark:text-orange-400' },
            { label: 'Storage Nodes', value: '10K active' },
            { label: 'Success Rate', value: '99.2%', color: 'text-green-600 dark:text-green-400' },
          ],
          outcome: 'Storage clusters handled load well but network bandwidth became bottleneck in some regions.',
          lessons: [
            'Data-intensive applications need network capacity planning',
            'Geographic distribution of storage improves performance',
            'Retry mechanisms and resumable uploads are essential',
            'Predictable batch workloads allow for scheduled scaling',
          ],
        },
      ]}
    />
  );
}
