import { mean, median, standardDeviation } from 'simple-statistics';
import { facilities, score } from './dist/data.js';

// Analyze the same rounded facility scores displayed by the application.
// Missing assessments are excluded, rather than treated as zero.
console.log('Thane records; unknown assessments are excluded from score statistics.');
console.table(['All wards', ...new Set(facilities.map(f => f.ward??'Ward unknown'))].map(ward => {
  const records = facilities.filter(f => ward === 'All wards' || (f.ward??'Ward unknown') === ward);
  const scores = records.map(f => score(f.scores)).filter(Number.isFinite);
  return {
    ward,
    facilities: records.length,
    assessed: scores.length,
    mean: scores.length ? mean(scores) : null,
    median: scores.length ? median(scores) : null,
    populationStandardDeviation: scores.length ? standardDeviation(scores) : null,
  };
}));
