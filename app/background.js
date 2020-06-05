$(document).ready(function () {
  app.initialized()
    .then(onAppInitializedCallback)
    .catch(function () {
      showNotification("error", "Unable to initialize the app");
    });
});

function onAppInitializedCallback(_client) {
  window.client = _client;

  disableCustomFields();

  client.events.on('app.activated', function () {
    disableCustomFields();
  });
}

function disableCustomFields() {
  client.interface.trigger("disableElement", { id: "other_account_domain" });
  client.interface.trigger("disableElement", { id: "other_account_ticket_id" });
  client.interface.trigger("disableElement", { id: "other_account_ticket_status" });
}

function showNotification(type, message) {
  client.interface.trigger("showNotify", {
    type: type,
    message: message
  });
}