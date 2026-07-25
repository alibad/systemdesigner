'use client';

import { useState } from 'react';

export default function SSTableStorageCalculator() {
  const [recordCount, setRecordCount] = useState(1000000);

  const [keySize, setKeySize] = useState(32);

  const [valueSize, setValueSize] = useState(1024);

  const [blockSize, setBlockSize] = useState(64);

  const [compressionRatio, setCompressionRatio] = useState(0.7);

  const [indexSampling, setIndexSampling] = useState(128);

  const [bloomFilterFPR, setBloomFilterFPR] = useState(0.01);

  const calculateMetrics = () => {
      // Basic size calculations
      const avgRecordSize = keySize + valueSize;
      const uncompressedSize = recordCount * avgRecordSize;
      const compressedSize = uncompressedSize * compressionRatio;

      // Block calculations
      const recordsPerBlock = Math.floor((blockSize * 1024) / avgRecordSize);
      const totalBlocks = Math.ceil(recordCount / recordsPerBlock);

      // Index calculations
      const indexEntries = Math.ceil(recordCount / indexSampling);
      const indexSize = indexEntries * (keySize + 8); // 8 bytes for offset

      // Bloom filter calculations
      const optimalHashFunctions = Math.ceil(-Math.log2(bloomFilterFPR));
      const bitsPerKey = -1.44 * Math.log2(bloomFilterFPR);
      const bloomFilterSize = Math.ceil((recordCount * bitsPerKey) / 8);

      // Read performance
      const diskSeeks = bloomFilterFPR > 0 ? 1 : 2; // With/without bloom filter
      const avgReadTimeMs = diskSeeks * 10; // 10ms avg seek time

      // Write performance (sequential)
      const writeTimeMs = (compressedSize / (100 * 1024 * 1024)) * 1000; // 100MB/s write speed

      // Memory usage
      const memoryMB = (indexSize + bloomFilterSize) / (1024 * 1024);

      // Compaction cost estimation
      const compactionCostMB = compressedSize * 2; // Read + write during compaction

      return {
        uncompressedSize: uncompressedSize / (1024 * 1024), // MB
        compressedSize: compressedSize / (1024 * 1024), // MB
        totalBlocks,
        recordsPerBlock,
        indexEntries,
        indexSize: indexSize / 1024, // KB
        bloomFilterSize: bloomFilterSize / 1024, // KB
        avgReadTimeMs,
        writeTimeMs,
        memoryMB,
        compactionCostMB: compactionCostMB / (1024 * 1024), // MB
        optimalHashFunctions
      };
    };

  const metrics = calculateMetrics();

  return (
    <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-xl p-6 mb-8 border border-green-200 dark:border-green-800">
            <h3 className="text-xl font-semibold mb-4 text-green-800 dark:text-green-200">
              🗃️ SSTable Storage Calculator
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Record Count</label>
                  <input
                    type="number"
                    value={recordCount}
                    onChange={(e) => setRecordCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="1000"
                    max="100000000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Average Key Size (bytes)</label>
                  <input
                    type="number"
                    value={keySize}
                    onChange={(e) => setKeySize(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="8"
                    max="1024"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Average Value Size (bytes)</label>
                  <input
                    type="number"
                    value={valueSize}
                    onChange={(e) => setValueSize(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="64"
                    max="10240"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Block Size (KB)</label>
                  <input
                    type="number"
                    value={blockSize}
                    onChange={(e) => setBlockSize(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="4"
                    max="1024"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Compression Ratio</label>
                  <input
                    type="number"
                    step="0.1"
                    value={compressionRatio}
                    onChange={(e) => setCompressionRatio(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0.1"
                    max="1.0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Index Sampling Rate</label>
                  <input
                    type="number"
                    value={indexSampling}
                    onChange={(e) => setIndexSampling(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="16"
                    max="1024"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Bloom Filter False Positive Rate</label>
                  <input
                    type="number"
                    step="0.001"
                    value={bloomFilterFPR}
                    onChange={(e) => setBloomFilterFPR(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0.001"
                    max="0.1"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2">📊 Storage Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <div>Uncompressed Size: <span className="font-mono">{metrics.uncompressedSize.toFixed(1)} MB</span></div>
                    <div>Compressed Size: <span className="font-mono">{metrics.compressedSize.toFixed(1)} MB</span></div>
                    <div>Total Blocks: <span className="font-mono">{metrics.totalBlocks.toLocaleString()}</span></div>
                    <div>Records per Block: <span className="font-mono">{metrics.recordsPerBlock}</span></div>
                    <div>Index Entries: <span className="font-mono">{metrics.indexEntries.toLocaleString()}</span></div>
                    <div>Index Size: <span className="font-mono">{metrics.indexSize.toFixed(1)} KB</span></div>
                    <div>Bloom Filter Size: <span className="font-mono">{metrics.bloomFilterSize.toFixed(1)} KB</span></div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">⚡ Performance Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <div>Avg Read Time: <span className="font-mono">{metrics.avgReadTimeMs.toFixed(1)} ms</span></div>
                    <div>Write Time: <span className="font-mono">{metrics.writeTimeMs.toFixed(1)} ms</span></div>
                    <div>Memory Usage: <span className="font-mono">{metrics.memoryMB.toFixed(1)} MB</span></div>
                    <div>Compaction Cost: <span className="font-mono">{metrics.compactionCostMB.toFixed(1)} MB</span></div>
                    <div>Hash Functions: <span className="font-mono">{metrics.optimalHashFunctions}</span></div>
                  </div>
                </div>

                <div className={`p-4 rounded-lg ${metrics.memoryMB > 100 ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-green-100 dark:bg-green-900/20'}`}>
                  <h4 className="font-semibold mb-2">💡 Optimization Tips</h4>
                  <div className="text-sm">
                    {metrics.memoryMB > 100 && (
                      <div className="text-yellow-700 dark:text-yellow-300">
                        ⚠️ High memory usage - consider increasing index sampling rate
                      </div>
                    )}
                    {metrics.compressedSize > 1000 && (
                      <div className="text-blue-700 dark:text-blue-300">
                        💾 Large SSTable - consider partitioning or more aggressive compaction
                      </div>
                    )}
                    {metrics.bloomFilterSize < 10 && (
                      <div className="text-green-700 dark:text-green-300">
                        ✅ Efficient bloom filter size
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
  );
}
