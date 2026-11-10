/* Pure manager-domain rules, usable in both the browser and Node tests. */
(function (root) {
  'use strict';
  const statuses = ['Reported', 'Awaiting approval', 'Ordered', 'Received'];
  const owners = ['Staff A', 'Staff B', 'Staff C'];
  function seed() {
    return {
      version: 1,
      jobs: [
        { id: 'DEMO-201', device: 'iPhone 13', repairStatus: 'Waiting', otherBlocker: '' },
        { id: 'DEMO-202', device: 'Samsung Galaxy S22', repairStatus: 'Waiting', otherBlocker: 'Technical help still open' },
        { id: 'DEMO-203', device: 'iPhone 12', repairStatus: 'Waiting', otherBlocker: '' }
      ],
      shortages: [
        { id: 'part-201', jobId: 'DEMO-201', part: 'Replacement display', quantity: 1, owner: '', status: 'Reported', nextAction: 'Check availability and arrange a replacement.', expectedArrival: '', updatedAt: '', history: [] },
        { id: 'part-202', jobId: 'DEMO-202', part: 'Charging port', quantity: 1, owner: 'Staff B', status: 'Ordered', nextAction: 'Confirm the delivery date with the supplier.', expectedArrival: '', updatedAt: '', history: [] },
        { id: 'part-203', jobId: 'DEMO-203', part: 'Replacement battery', quantity: 1, owner: 'Staff A', status: 'Received', nextAction: 'Ask the technician to check the part before fitting.', expectedArrival: '', updatedAt: '', history: [] }
      ]
    };
  }
  function validDate(value) {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !isNaN(date) && date.toISOString().slice(0, 10) === value;
  }
  function validate(input) {
    if (!owners.includes(input.owner)) return { field: 'owner', message: 'Choose a follow-up owner before saving.' };
    if (!statuses.includes(input.status)) return { field: 'status', message: 'Choose a valid follow-up status.' };
    if (typeof input.nextAction !== 'string' || !input.nextAction.trim()) return { field: 'nextAction', message: 'Add the next action so the team knows what to do.' };
    if (input.nextAction.trim().length > 240) return { field: 'nextAction', message: 'Keep the next action within 240 characters.' };
    if (typeof input.expectedArrival !== 'string' || !validDate(input.expectedArrival)) return { field: 'expectedArrival', message: 'Enter a valid arrival date or leave it blank.' };
    return null;
  }
  function update(state, id, input, timestamp) {
    const error = validate(input);
    if (error) return { error };
    const index = state.shortages.findIndex(item => item.id === id);
    if (index < 0) return { error: { field: '', message: 'This parts request is no longer available.' } };
    const previous = state.shortages[index];
    const values = { owner: input.owner, status: input.status, nextAction: input.nextAction.trim(), expectedArrival: input.expectedArrival };
    const changed = Object.keys(values).some(key => values[key] !== previous[key]);
    if (!changed) return { state, changed: false };
    const next = JSON.parse(JSON.stringify(state));
    next.shortages[index] = { ...previous, ...values, updatedAt: timestamp,
      history: [{ time: timestamp, from: previous.status, to: values.status, owner: values.owner, nextAction: values.nextAction, expectedArrival: values.expectedArrival }, ...previous.history] };
    // Receiving a part must never complete or resume the repair automatically.
    return { state: next, changed: true };
  }
  function isState(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.jobs) || !Array.isArray(value.shortages)) return false;
    const jobIds = new Set(); const shortageIds = new Set();
    for (const j of value.jobs) {
      if (!j || typeof j.id !== 'string' || jobIds.has(j.id) || typeof j.device !== 'string' || typeof j.repairStatus !== 'string' || typeof j.otherBlocker !== 'string') return false;
      jobIds.add(j.id);
    }
    return value.shortages.every(s => {
      if (!s || typeof s.id !== 'string' || shortageIds.has(s.id) || !jobIds.has(s.jobId) || typeof s.part !== 'string' || !Number.isInteger(s.quantity) || s.quantity < 1 || !statuses.includes(s.status) || !(s.owner === '' || owners.includes(s.owner)) || typeof s.nextAction !== 'string' || s.nextAction.length > 240 || typeof s.expectedArrival !== 'string' || !validDate(s.expectedArrival) || typeof s.updatedAt !== 'string' || !Array.isArray(s.history)) return false;
      shortageIds.add(s.id);
      return s.history.every(h => h && typeof h.time === 'string' && statuses.includes(h.from) && statuses.includes(h.to) && owners.includes(h.owner) && typeof h.nextAction === 'string' && typeof h.expectedArrival === 'string' && validDate(h.expectedArrival));
    });
  }
  const api = { statuses, owners, seed, validate, update, isState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ManagerModel = api;
})(typeof window === 'undefined' ? globalThis : window);
