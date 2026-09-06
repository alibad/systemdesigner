function classificationMetrics(truePositives, falsePositives, falseNegatives) {
  const round = (value) => Math.round(value * 10000) / 10000;
  const flagged = truePositives + falsePositives;
  const relevant = truePositives + falseNegatives;
  const f1Denominator = 2 * truePositives + falsePositives + falseNegatives;
  return {
    precision: flagged === 0 ? 0 : round(truePositives / flagged),
    recall: relevant === 0 ? 0 : round(truePositives / relevant),
    f1: f1Denominator === 0 ? 0 : round((2 * truePositives) / f1Denominator),
  };
}
