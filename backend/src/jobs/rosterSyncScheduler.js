// UC-001's roster sync scheduler. The original implementation was lost in
// the port from the old repo — this no-op stub keeps the server bootable
// until the UC-001 owner restores the real scheduler. It must not be
// extended by UC-003 work.

function start() {
  console.log('[rosterSyncScheduler] stub — roster sync is not scheduled (UC-001 implementation pending).');
}

module.exports = { start };
