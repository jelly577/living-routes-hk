import { buildNextRecommendation, deriveInterestSignals } from './recommendationService.js';
import { simulateNetwork } from './utils.js';

export async function generateJourneyLog({
  route,
  memories = [],
  style = 'reflective',
  language = 'en',
} = {}) {
  if (!Array.isArray(memories) || memories.length === 0) {
    throw new Error('Save your own journey memories before generating a log.');
  }
  const chapters = memories.map((memory, index) => ({
      id: `memory-chapter-${memory.id || index + 1}`,
      order: index + 1,
      place: memory.place || 'Along Route 1',
      time: memory.time || 'Journey moment',
      title: `A Moment at ${memory.place || 'the Next Stop'}`,
      text: memory.text || 'A private moment saved along the route.',
    }));
  const interestSignals = deriveInterestSignals(memories);

  return simulateNetwork({
    title: 'My Living Route Through Hong Kong',
    summary: 'A private log assembled from your saved memories.',
    status: 'memory-assembled',
    chapters,
    routeId: route?.id || 'citybus-1-central-happy-valley',
    memoryCount: memories.length,
    style,
    language,
    interestSignals,
    nextRecommendation: buildNextRecommendation(interestSignals),
  }, 900);
}
