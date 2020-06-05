var btoa = require('btoa');

exports = {
  events: [
    { event: "onConversationCreate", callback: "onConversationCreateCallback" }
  ],

  onConversationCreateCallback: function (payload) {
    let iparamData = payload.iparams;
    let ticketId = payload.data.conversation.ticket_display_id.split("-")[1];
    let bodyData = {
      body: `<p><b>Reply from ${iparamData.freshservice_subdomain}</b></p><br>${payload.data.conversation.body}`,
      private: true
    };

    getTicketData(iparamData, ticketId, bodyData);
  }
};

function getTicketData(iparamData, ticketId, bodyData) {
  let ticketUrl = `https://${iparamData.freshservice_subdomain}.freshservice.com/api/v2/tickets/${ticketId}`;
  let ticketFieldsUrl = `https://${iparamData.freshservice_subdomain}.freshservice.com/api/v2/ticket_fields`;
  let options = {
    headers: {
      'Authorization': 'Basic <%= encode(iparam.freshservice_apikey) %>',
      'Content-Type': 'application/json'
    }
  };

  let ticketRequest = $request.get(ticketUrl, options);
  let ticketFieldsRequest = $request.get(ticketFieldsUrl, options);

  Promise.all([ticketRequest, ticketFieldsRequest]).then(function (responseData) {
    let ticketData = JSON.parse(responseData[0].response).ticket;
    let fieldsData = JSON.parse(responseData[1].response).ticket_fields;
    let customValues = ticketData.custom_fields;
    let subAccountDomain = customValues.other_account_domain;
    let subAccountTicketId = customValues.other_account_ticket_id;
    let isReplyToSubaccount = customValues.reply_to_other_account;
    let ticketStatus;

    fieldsData.map(function (field) {
      if (field.name == "status") {
        ticketStatus = field.choices[ticketData.status][0];
      }
    });

    if (subAccountDomain && subAccountTicketId && isReplyToSubaccount) {
      ticketUpdate(iparamData, ticketId);

      (iparamData.sub_account_credentials).map(function (subAccount) {
        if (subAccountDomain == subAccount.subdomain) {
          createReply(subAccount, subAccountTicketId, ticketId, ticketStatus, bodyData, iparamData);
        }
      });
    } else {
      console.log("Custom fields have null value");
    }
  }, function (err) {
    console.log("==================================");
    console.log("Ticket get error!");
    console.log(JSON.stringify(err));
    console.log("==================================");
  });
}

function createReply(subAccount, subAccountTicketId, ticketId, ticketStatus, bodyData, iparamData) {
  let ticketUrl = `https://${subAccount.subdomain}.freshservice.com/api/v2/tickets/${subAccountTicketId}`;
  let ticketOptions = {
    headers: {
      'Authorization': `Basic ${btoa(subAccount.apikey)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      custom_fields: {
        other_account_domain: iparamData.freshservice_subdomain,
        other_account_ticket_id: `${ticketId}`,
        other_account_ticket_status: ticketStatus
      }
    })
  };

  let noteUrl = `https://${subAccount.subdomain}.freshservice.com/api/v2/tickets/${subAccountTicketId}/notes`;
  let noteOptions = {
    headers: {
      'Authorization': `Basic ${btoa(subAccount.apikey)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyData)
  };

  let ticketRequest = $request.put(ticketUrl, ticketOptions);
  let noteRequest = $request.post(noteUrl, noteOptions);

  Promise.all([ticketRequest, noteRequest]).then(function () {
    console.log("Reply added successfully!");
  }, function (err) {
    console.log("==================================");
    console.log("Reply added error!");
    console.log(JSON.stringify(err));
    console.log("==================================");
  });
}

function ticketUpdate(iparamData, ticketId) {
  let url = `https://${iparamData.freshservice_subdomain}.freshservice.com/api/v2/tickets/${ticketId}`;
  let options = {
    headers: {
      'Authorization': 'Basic <%= encode(iparam.freshservice_apikey) %>',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      custom_fields: {
        reply_to_other_account: false
      }
    })
  };

  $request.put(url, options).then(function () {
    console.log("Ticket updated successfully!");
  }, function (err) {
    console.log("==================================");
    console.log("Ticket update error!");
    console.log(JSON.stringify(err));
    console.log("==================================");
  });
}