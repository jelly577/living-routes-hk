import { demoRoute, demoRouteStops } from '../data/route.js';
import { places } from '../data/places.js';
import { simulateNetwork } from './utils.js';

export async function getRoute({ origin, destination, mode = 'demo' } = {}) {
  return simulateNetwork({
    ...demoRoute,
    requestedOrigin: origin || demoRoute.origin,
    requestedDestination: destination || demoRoute.destination,
    mode,
    stops: demoRouteStops,
    storyPoints: places,
  });
}

