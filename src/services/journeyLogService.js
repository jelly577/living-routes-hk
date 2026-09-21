import { mockJourneyLog } from '../data/mockJourneyLog.js';
import { simulateNetwork } from './utils.js';

export async function generateJourneyLog({
  route,
  memories = [],
  style = 'reflective',
  language = 'en',
} = {}) {
  const chapters = memories.length > 0
    ? memories.map((memory, index) => ({
      id: `memory-chapter-${memory.id || index + 1}`,
      order: index + 1,
      place: memory.place || 'Along Route 1',
      time: memory.time || 'Journey moment',
      title: `A Moment at ${memory.place || 'the Next Stop'}`,
      text: memory.text || 'A private moment saved along the route.',
    }))
    : mockJourneyLog.chapters;

  return simulateNetwork({
    ...mockJourneyLog,
    title: memories.length > 0 ? 'My Living Route Through Hong Kong' : mockJourneyLog.title,
    chapters,
    routeId: route?.id || 'citybus-1-central-happy-valley',
    memoryCount: memories.length,
    style,
    language,
  }, 900);
}
