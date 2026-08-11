function sendEditSourcesDetailsTelemetry(telemetryService, data) {
  telemetryService.publicLog2("editTelemetry.editSources.details", data);
}
function sendEditSourcesStatsTelemetry(telemetryService, data) {
  telemetryService.publicLog2("editTelemetry.editSources.stats", data);
}
export {
  sendEditSourcesDetailsTelemetry,
  sendEditSourcesStatsTelemetry
};
