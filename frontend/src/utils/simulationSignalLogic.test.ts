import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSignalState,
  evaluateQueueMetric,
  evaluateTrackingMetrics,
  evaluateDecisionReasoning
} from './simulationSignalLogic.ts';

test('1. North-South green renders the correct permitted movement', () => {
  const status = {
    status: 'running',
    signal: { north: 'GREEN', south: 'GREEN', east: 'RED', west: 'RED' },
    active_phase: 'North-South',
    remaining_seconds: 18
  };
  const result = evaluateSignalState(status);

  assert.equal(result.transitionState, 'GREEN');
  assert.equal(result.activePhase, 'North-South');
  assert.equal(result.nsPermitted, true, 'North-South movement must be permitted');
  assert.equal(result.ewPermitted, false, 'East-West movement must NOT be permitted during NS green');
  assert.equal(result.signals.north, 'GREEN');
  assert.equal(result.signals.south, 'GREEN');
  assert.equal(result.signals.east, 'RED');
  assert.equal(result.signals.west, 'RED');
  assert.equal(result.remainingSeconds, 18);
});

test('2. East-West green renders the correct permitted movement', () => {
  const status = {
    status: 'running',
    signal: { north: 'RED', south: 'RED', east: 'GREEN', west: 'GREEN' },
    active_phase: 'East-West',
    remaining_seconds: 24
  };
  const result = evaluateSignalState(status);

  assert.equal(result.transitionState, 'GREEN');
  assert.equal(result.activePhase, 'East-West');
  assert.equal(result.ewPermitted, true, 'East-West movement must be permitted');
  assert.equal(result.nsPermitted, false, 'North-South movement must NOT be permitted during EW green');
  assert.equal(result.signals.east, 'GREEN');
  assert.equal(result.signals.west, 'GREEN');
  assert.equal(result.signals.north, 'RED');
  assert.equal(result.signals.south, 'RED');
  assert.equal(result.remainingSeconds, 24);
});

test('3. Yellow and ALL-RED are represented correctly', () => {
  // Yellow clearance
  const yellowStatus = {
    status: 'running',
    signal: { north: 'YELLOW', south: 'YELLOW', east: 'RED', west: 'RED' },
    in_clearance: true,
    remaining_seconds: 4
  };
  const yellowRes = evaluateSignalState(yellowStatus);
  assert.equal(yellowRes.transitionState, 'YELLOW');
  assert.equal(yellowRes.nsPermitted, false, 'No green movements permitted during yellow');
  assert.equal(yellowRes.ewPermitted, false);
  assert.equal(yellowRes.signals.north, 'YELLOW');

  // ALL-RED clearance
  const allRedStatus = {
    status: 'running',
    signal: { north: 'RED', south: 'RED', east: 'RED', west: 'RED' },
    in_clearance: true,
    remaining_seconds: 2
  };
  const allRedRes = evaluateSignalState(allRedStatus);
  assert.equal(allRedRes.transitionState, 'ALL-RED');
  assert.equal(allRedRes.allRedActive, true);
  assert.equal(allRedRes.nsPermitted, false);
  assert.equal(allRedRes.ewPermitted, false);
  assert.equal(allRedRes.signals.north, 'RED');
  assert.equal(allRedRes.signals.south, 'RED');
  assert.equal(allRedRes.signals.east, 'RED');
  assert.equal(allRedRes.signals.west, 'RED');
});

test('4. Pending operator approval displays the correct status and safe signal state', () => {
  const pendingStatus = {
    status: 'running',
    signal: { north: 'RED', south: 'RED', east: 'RED', west: 'RED' },
    pending_recommendation: {
      recommended_phase: 'East-West',
      duration: 25,
      reason: 'High queue demand on EW',
      ns_demand: 2,
      ew_demand: 9,
      timestamp: '2026-10-11T00:00:00Z'
    }
  };
  const result = evaluateSignalState(pendingStatus);

  assert.equal(result.transitionState, 'WAITING FOR APPROVAL');
  assert.equal(result.isWaitingApproval, true);
  assert.equal(result.nsPermitted, false);
  assert.equal(result.ewPermitted, false);
  // Signals must show actual safe state (all RED)
  assert.equal(result.signals.north, 'RED');
  assert.equal(result.signals.south, 'RED');
  assert.equal(result.signals.east, 'RED');
  assert.equal(result.signals.west, 'RED');
  // Timer should be suppressed while waiting for user interaction
  assert.equal(result.remainingSeconds, null);

  const decision = evaluateDecisionReasoning(pendingStatus);
  assert.match(decision.operatorStatus, /Pending Operator Approval/);
  assert.equal(decision.proposedDuration, 25);
});

test('5. Invalid or stale signal data never produces a false green state', () => {
  // Missing signal object
  const nullSignal = evaluateSignalState({ status: 'running', signal: null });
  assert.equal(nullSignal.transitionState, 'ALL-RED');
  assert.equal(nullSignal.nsPermitted, false);
  assert.equal(nullSignal.ewPermitted, false);
  assert.equal(nullSignal.isFailsafe, true);

  // Corrupted signal values
  const corrupted = evaluateSignalState({
    status: 'running',
    signal: { north: 'PURPLE', south: 'UNKNOWN', east: 123, west: null }
  });
  assert.equal(corrupted.signals.north, 'RED');
  assert.equal(corrupted.signals.south, 'RED');
  assert.equal(corrupted.nsPermitted, false);
  assert.equal(corrupted.ewPermitted, false);

  // Conflicting greens (CRITICAL SAFETY TEST)
  const conflicting = evaluateSignalState({
    status: 'running',
    signal: { north: 'GREEN', south: 'RED', east: 'GREEN', west: 'RED' }
  });
  assert.equal(conflicting.nsPermitted, false, 'Conflicting greens must never allow NS flow');
  assert.equal(conflicting.ewPermitted, false, 'Conflicting greens must never allow EW flow');
  assert.equal(conflicting.transitionState, 'ALL-RED');
  assert.equal(conflicting.isFailsafe, true);
});

test('6. Missing queue measurements display as unavailable', () => {
  // Undefined approach
  const missing = evaluateQueueMetric('north', undefined);
  assert.equal(missing.status, 'unavailable');
  assert.equal(missing.displayValue, 'Unavailable');

  // Error approach
  const errored = evaluateQueueMetric('south', { status: 'error', error: 'Camera stream disconnected' });
  assert.equal(errored.status, 'unavailable');
  assert.equal(errored.displayValue, 'Unavailable');
  assert.match(errored.helperText, /disconnected/);
});

test('7. A valid zero queue displays as zero (not a dash or unavailable)', () => {
  const zeroMetric = evaluateQueueMetric('east', {
    queue_length_estimate: 0,
    status: 'processing',
    last_updated: '2026-10-11T12:00:00Z',
    frames_processed: 50
  }, new Date('2026-10-11T12:00:02Z').getTime()); // 2 seconds later (fresh)

  assert.equal(zeroMetric.status, 'zero');
  assert.equal(zeroMetric.rawValue, 0);
  assert.equal(zeroMetric.displayValue, '0 veh (est.)');
  assert.notEqual(zeroMetric.displayValue, '—');
  assert.notEqual(zeroMetric.displayValue, '-');
  assert.notEqual(zeroMetric.displayValue, 'Unavailable');
});

test('8. Metric labels correspond to the actual backend definitions and distinguish tracker counts', () => {
  // Queue labels
  const nQueue = evaluateQueueMetric('north', { queue_length_estimate: 5 });
  assert.equal(nQueue.label, 'Queue estimate — North approach');
  const sQueue = evaluateQueueMetric('south', { queue_length_estimate: 2 });
  assert.equal(sQueue.label, 'Queue estimate — South approach');
  const eQueue = evaluateQueueMetric('east', { queue_length_estimate: 0 });
  assert.equal(eQueue.label, 'Queue estimate — East approach');
  const wQueue = evaluateQueueMetric('west', { queue_length_estimate: 8 });
  assert.equal(wQueue.label, 'Queue estimate — West approach');

  // Tracking metrics distinction
  const approachData = {
    currently_tracked: 4,
    raw_detections: 7,
    cumulative_track_ids: 23,
    total_unique_tracked: 23
  };
  const breakdown = evaluateTrackingMetrics(approachData);

  assert.equal(breakdown.currentlyTracked.label, 'Currently Tracked Objects');
  assert.equal(breakdown.currentlyTracked.value, 4);

  assert.equal(breakdown.rawDetections.label, 'Raw Frame Detections');
  assert.equal(breakdown.rawDetections.value, 7);

  assert.equal(breakdown.cumulativeTrackIds.label, 'Cumulative Track IDs (ROI)');
  assert.equal(breakdown.cumulativeTrackIds.value, 23);
  assert.match(breakdown.cumulativeTrackIds.tooltip, /lose and reacquire/);

  assert.equal(breakdown.lineCrossingCount.label, 'Line-Crossing Traffic Count');
  assert.equal(breakdown.lineCrossingCount.value, 'Not Configured');
  assert.match(breakdown.lineCrossingCount.tooltip, /tripwire/);
});
