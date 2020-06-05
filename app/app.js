$(document).ready(function () {
  app.initialized()
    .then(onAppInitializedCallback)
    .catch(function (err) {
      console.error(err);
      showNotification("error", "Unable to initialize the app");
    });
});

function onAppInitializedCallback(_client) {
  window.client = _client;
  window.ticket_fields = [];

  $('.loading, #panel, #show_groups, #fields_info').hide();

  client.events.on('app.activated', function () {
    let iparamRequest = client.iparams.get();
    let ticketRequest = client.data.get("ticket");
    let agentRequest = client.data.get("loggedInUser");

    Promise.all([iparamRequest, ticketRequest, agentRequest]).then(function (dataResponse) {
      $('#sub_accounts').empty();
      $('#sub_accounts').append(`<option value="">Choose Sub-account</option>`);

      window.iparamData = dataResponse[0];
      window.ticketData = dataResponse[1].ticket;
      window.agentData = dataResponse[2].loggedInUser.user;

      let ticketUrl = `https://${iparamData.freshservice_subdomain}.freshservice.com/api/v2/tickets/${ticketData.display_id}`;
      let ticketOptions = {
        headers: {
          'Authorization': 'Basic <%= encode(iparam.freshservice_apikey) %>',
          'Content-Type': 'application/json'
        }
      };

      client.request.get(ticketUrl, ticketOptions).then(function (responseData) {
        let ticketInfo = JSON.parse(responseData.response).ticket;
        let subAccountDomain = ticketInfo.custom_fields.other_account_domain;
        let subAccountTicketId = ticketInfo.custom_fields.other_account_ticket_id;

        if (subAccountDomain || subAccountTicketId) {
          $("#panel").hide();

          showNotification("info", "Already ticket has been created to subaccount");
        } else {
          $("#panel").show();

          (iparamData.sub_account_credentials).map(function (accountCredential) {
            $('#sub_accounts').append(`<option value="${accountCredential.subdomain}">${accountCredential.subdomain}</option>`);
          });
        }
      }, function (err) {
        console.error(err);
        showNotification("error", "Unable to get ticket data");
      });
    }, function (err) {
      console.error(err);
      showNotification("error", "Unable to get initial parameters data");
    });
  });

  $("#sub_accounts").change(function () {
    let selectedAccount = $(this).val();

    if (selectedAccount == "") {
      $('#show_groups, #fields_info').hide();
      $('#panel').show();

      showNotification("error", "Please choose the sub account");
    } else {
      (iparamData.sub_account_credentials).map(function (accountCredential) {
        if (selectedAccount == accountCredential.subdomain) {
          $('#panel').hide();
          $('.loading').show();

          window.selectedAccountData = accountCredential;

          getGroupsAndTicketFieldsData(accountCredential.apikey, accountCredential.subdomain);
        }
      });
    }
  });

  $("#createTicket").click(function () {
    let ticketFieldValues = {};
    let removeCount = 0;

    if ($("#groups").val() != "") {
      $('input, select').each(function () {
        let input_name = $(this)[0].name;
        let input_type = $(this)[0].type;

        if (ticket_fields.includes(input_name) || ticket_fields.includes(`cf_${input_name}`)) {
          let input_value;

          if (input_type == "checkbox") {
            input_value = $(this)[0].checked;
          } else if (input_type == "date") {
            input_value = Date($(this).val());
          } else if (input_type == "number") {
            input_value = Number($(this).val());
          } else {
            input_value = $(this).val();
          }

          if (input_name == "group_id" || input_name == "responder_id") {
            input_value = Number(input_value);
          }

          if (input_value && input_value != "") {
            let isRemove = false;

            if (input_type == "select-one" && input_value == "NN") {
              removeCount += 1;
              isRemove = true;
            }

            if (!isRemove) {
              ticketFieldValues[input_name] = input_value;
            }
          }
        }
      });

      if ((ticket_fields.length - removeCount) == (Object.keys(ticketFieldValues)).length) {
        $('#panel').hide();
        $('.loading').show();

        createFreshserviceTicket(ticketFieldValues);
      } else {
        showNotification("error", "All fields must be filled out!");
      }
    } else {
      showNotification("error", "Please choose group!");
    }
  });
}

function getGroupsAndTicketFieldsData(apikey, subdomain) {
  let groupUrl = `https://${subdomain}.freshservice.com/api/v2/groups?per_page=100`;
  let ticketUrl = `https://${subdomain}.freshservice.com/api/v2/ticket_fields`;
  let options = {
    headers: {
      "Authorization": `Basic ${btoa(apikey)}`,
      "Content-Type": "application/json"
    }
  };

  getFreshserviceData(groupUrl, ticketUrl, options).then(function (dataResponse) {
    $('.loading').hide();
    $('#panel').show();

    let groups = (JSON.parse(dataResponse[0].response)).groups;
    let ticketFields = (JSON.parse(dataResponse[1].response)).ticket_fields;

    if (groups.length > 0) {
      $('#show_groups').show();
      $('#groups').empty();
      $('#groups').append(`<option value="">Choose Group</option>`);

      groups.map(function (group) {
        $('#groups').append(`<option value="${group.id}">${group.name}</option>`);
      });
    } else {
      showNotification("error", "No groups found!");
    }

    if (ticketFields.length > 0) {
      $('#fields_info').show();

      filterTicketFields(ticketFields);
    } else {
      showNotification("error", "No ticket fields found!");
    }
  }, function (err) {
    console.error(err);

    $('.loading').hide();
    $('#panel').show();

    if (err.status == 401) {
      showNotification("error", "Invalid Freshservice API key");
    } else if (err.status == 403) {
      showNotification("error", "You are not authorized to perform this action");
    } else if (err.status == 404) {
      showNotification("error", "Invalid Freshservice Subdomain");
    } else {
      showNotification("error", "Unable to process the request. Please try again!");
    }
  });
}

function filterTicketFields(ticketFields) {
  let defaultFieldList = [];
  let customFieldList = [];

  defaultFieldList = ticketFields.filter(function (field) {
    if (field.default && field.required_for_agents && field.name != "requester" && field.name != "subject" && field.name != "description" && field.name != "status" && field.name != "priority" && field.name != "source" && field.name != "group")
      return true;
    else
      return false;
  });

  customFieldList = ticketFields.filter(function (field) {
    if (!field.default && field.required_for_agents)
      return true;
    else
      return false;
  });

  let fieldList = {
    default: defaultFieldList,
    custom: customFieldList
  };

  showTicketFields(fieldList);
}

function showTicketFields(fieldList) {
  ticket_fields = [];

  (fieldList.default).map(function (field) {
    let temp;
    let fieldString = '';

    if (field.name == "ticket_type")
      temp = "type";
    else if (field.name == "group")
      temp = "group_id";
    else if (field.name == "agent")
      temp = "responder_id";
    else
      temp = field.name;

    ticket_fields.push(temp);

    if (field.nested_ticket_fields) {
      fieldString += `<input type="hidden" id="category${field.id}" value='${JSON.stringify(field)}'>`;
      fieldString += `<input type="hidden" id="subCategory${field.id}" value="">`;
      fieldString += `<div class="form-group"><label>${field.label}</label>`;

      fieldString += `<select class="form-control" id="${temp}" name="${temp}" placeholder="Select ${field.label}" onchange="loadCategoryOne(this.value, ${field.id})" required>`;
      fieldString += `<option value="", selected>Select ${field.label}</option>`;

      for (let key in field.choices) {
        fieldString += `<option value="${key}">${key}</option>`;
      }

      fieldString += `</select></div>`;
      fieldString += `<div class="dependent" style="display: none; border-left: 2px solid green">`;

      let i = 0;

      (field.nested_ticket_fields).map(function (subCategory) {
        ticket_fields.push(subCategory.name);
        i++;
        fieldString += `<div class="form-group" id="subCategory${field.id}${i}" style="margin-left: 10px">`;

        if (i == 1) {
          fieldString += `<select class="form-control" id="${subCategory.name}" name="${subCategory.name}" placeholder="Select ${subCategory.label}" onchange="loadCategoryTwo(this.value, ${field.id})" required>`;
          fieldString += `<option value="", selected>Select ${subCategory.label}</option>`;
        } else {
          fieldString += `<select class="form-control" id="${subCategory.name}" name="${subCategory.name}" placeholder="Select ${subCategory.label}" required>`;
          fieldString += `<option value="", selected>Select ${subCategory.label}</option>`;
        }

        fieldString += `</select></div>`;
      });

      fieldString += `</div>`;
    } else if (field.choices) {
      if (temp == "group_id" || temp == "responder_id") {
        fieldString += `<div class="form-group"><label>${field.label}</label>`;
        fieldString += `<select class="form-control" id="${temp}" name="${temp}" placeholder="Select ${field.label}" required>`;
        fieldString += `<option value="", selected>Select ${field.label}</option>`;

        for (let key in field.choices) {
          fieldString += `<option value="${(field.choices)[key]}">${key}</option>`;
        }

        fieldString += `</select></div>`;
      } else {
        fieldString += `<div class="form-group"><label>${field.label}</label>`;
        fieldString += `<select class="form-control" id="${temp}" name="${temp}" placeholder="Select ${field.label}" required>`;
        fieldString += `<option value="", selected>Select ${field.label}</option>`;

        (field.choices).map(function (choice) {
          fieldString += `<option value="${choice}">${choice}</option>`;
        });

        fieldString += `</select></div>`;
      }
    } else {
      fieldString += `<div class="form-group"><label>${field.label}</label>`;
      fieldString += `<input type="text" class="form-control" id="${temp}" name="${temp}" placeholder="Enter ${field.label}"></div>`;
    }

    $("#ticket_fields").append(fieldString);
  });

  (fieldList.custom).map(function (field) {
    let temp = field.name;
    let fieldString = '';
    ticket_fields.push(`cf_${temp}`);

    if (field.type == "nested_field") {
      fieldString += `<input type="hidden" id="category${field.id}" value='${JSON.stringify(field)}'>`;
      fieldString += `<input type="hidden" id="subCategory${field.id}" value="">`;
      fieldString += `<div class="form-group"><label>${field.label}</label>`;

      fieldString += `<select class="form-control" id="cf_${temp}" name="cf_${temp}" placeholder="Select ${field.label}" onchange="loadCategoryOne(this.value, ${field.id})" required>`;
      fieldString += `<option value="", selected>Select ${field.label}</option>`;

      for (let key in field.choices) {
        fieldString += `<option value="${key}">${key}</option>`;
      }

      fieldString += `</select></div>`;
      fieldString += `<div class="dependent" style="display: none; border-left: 2px solid green">`;

      let i = 0;

      (field.nested_ticket_fields).map(function (subCategory) {
        ticket_fields.push(`cf_${subCategory.name}`);
        i++;

        fieldString += `<div class="form-group" id="subCategory${field.id}${i}" style="margin-left: 10px">`;

        if (i == 1) {
          fieldString += `<select class="form-control" id="cf_${subCategory.name}" name="cf_${subCategory.name}" placeholder="Select ${subCategory.label}" onchange="loadCategoryTwo(this.value, ${field.id})" required>`;
          fieldString += `<option value="", selected>Select ${subCategory.label}</option>`;
        } else {
          fieldString += `<select class="form-control" id="cf_${subCategory.name}" name="cf_${subCategory.name}" placeholder="Select ${subCategory.label}" required>`;
          fieldString += `<option value="", selected>Select ${subCategory.label}</option>`;
        }

        fieldString += `</select></div>`;
      });

      fieldString += `</div>`;
    } else if (field.type == "custom_dropdown") {
      fieldString += `<div class="form-group"><label>${field.label}</label>`;
      fieldString += `<select class="form-control" id="cf_${temp}" name="cf_${temp}" placeholder="Select ${field.label}" required>`;
      fieldString += `<option value="", selected>Select ${field.label}</option>`;

      (field.choices).map(function (choice) {
        fieldString += `<option value="${choice}"">${choice}</option>`;
      });

      fieldString += `</select></div>`;
    } else if (field.type == "custom_date") {
      fieldString += `<div class="form-group"><label>${field.label}</label>`;
      fieldString += `<input type="date" class="form-control" id="cf_${temp}" name="cf_${temp}" placeholder="Enter ${field.label}" required></div>`;
    } else if (field.type == "custom_number") {
      fieldString += `<div class="form-group"><label>${field.label}</label>`;
      fieldString += `<input type="number" class="form-control" id="cf_${temp}" name="cf_${temp}" placeholder="Enter ${field.label}" required></div>`;
    } else if (field.type == "custom_checkbox") {
      fieldString += `<div class="form-group"><label><input type="checkbox" id="cf_${temp}" name="cf_${temp}" placeholder="Enter ${field.label}" required> ${field.label}</label></div>`;
    } else {
      fieldString += `<div class="form-group"><label>${field.label}</label>`;
      fieldString += `<input type="text" class="form-control" id="cf_${field.label}" name="cf_${temp}" placeholder="Enter ${field.label}" required></div>`;
    }

    $("#ticket_fields").append(fieldString);
  });
}

function loadCategoryOne(selectedField, categoryId) {
  $('.dependent').show();
  $(`#subCategory${categoryId}1`).show();
  $(`#subCategory${categoryId}2`).hide();

  let jsonData = JSON.parse($(`#category${categoryId}`).val());
  let i = 0;

  (jsonData.nested_ticket_fields).map(function (subCategory) {
    i++;

    $(`#${subCategory.name}`).empty();
    $(`#${subCategory.name}`).append(`<option value="">Select ${subCategory.name}</option>`);

    if (selectedField != "") {
      if (i == 1) {
        $(`#subCategory${categoryId}`).attr("value", JSON.stringify(jsonData.choices[selectedField]));

        (Object.keys(jsonData.choices[selectedField])).map(function (value) {
          $(`#${subCategory.name}`).append(`<option value='${value}'>${value}</option>`);
        });
      }
    } else {
      $(`#subCategory${categoryId}1`).hide();
    }
  });
}

function loadCategoryTwo(selectedField, categoryId) {
  let jsonData = JSON.parse($(`#category${categoryId}`).val());
  let subCategoryData = JSON.parse($(`#subCategory${categoryId}`).val());
  let i = 0;

  (jsonData.nested_ticket_fields).map(function (subCategory) {
    i++;

    if (i === 2) {
      $(`#subCategory${categoryId}2`).show();
      $(`#${subCategory.name}`).empty();
      $(`#${subCategory.name}`).append(`<option value="">Select ${subCategory.label}</option>`);

      if (selectedField != "" && (subCategoryData[selectedField]).length > 0) {
        (subCategoryData[selectedField]).map(function (value) {
          $(`#${subCategory.name}`).append(`<option value="${value}">${value}</option>`);
        });
      } else {
        $(`#${subCategory.name}`).empty();
        $(`#${subCategory.name}`).append(`<option value="">Select ${subCategory.label}</option>`);
        $(`#subCategory${categoryId}2`).hide();
      }
    }
  });
}

function createFreshserviceTicket(ticketFieldValues) {
  let defaultValues;
  let defaultFieldValues = {};
  let customFieldValues = {};

  for (let key in ticketFieldValues) {
    if (key.substring(0, 3) == "cf_") {
      let newKey = key.replace("cf_", "");
      customFieldValues[newKey] = ticketFieldValues[key];
    } else {
      defaultFieldValues[key] = ticketFieldValues[key];
    }
  }

  customFieldValues["other_account_domain"] = iparamData.freshservice_subdomain;
  customFieldValues["other_account_ticket_id"] = `${ticketData.display_id}`;

  let customValues = {
    "custom_fields": customFieldValues
  };
  let freshserviceFieldValues = {
    name: agentData.name,
    email: agentData.email,
    subject: ticketData.subject,
    description: ticketData.description_html || "No description",
    status: 2,
    priority: 1,
    source: 2,
    type: "Incident"
  };

  if (Object.keys(defaultFieldValues).length == 0) {
    defaultValues = freshserviceFieldValues;
  } else {
    let freshservicedefaultValues = defaultFieldValues;
    defaultValues = Object.assign(freshserviceFieldValues, freshservicedefaultValues);
  }

  defaultValues["group_id"] = Number($("#groups").val());

  let ticketBody = JSON.stringify(Object.assign(defaultValues, customValues));
  let url = `https://${selectedAccountData.subdomain}.freshservice.com/api/v2/tickets`;
  let options = {
    headers: {
      "Authorization": `Basic ${btoa(selectedAccountData.apikey)}`,
      "Content-Type": "application/json"
    },
    body: ticketBody
  };

  postFreshserviceData(url, options).then(function () {
    $('.loading').hide();
    $('#panel').hide();

    showNotification("success", "Ticket created!");
  }, function (err) {
    console.error(err);

    $('.loading').hide();
    $('#panel').show();

    showNotification("error", "Unable to create ticket!");
  });
}

function getFreshserviceData(url1, url2, options) {
  return new Promise(function (resolve, reject) {
    let request1 = client.request.get(url1, options);
    let request2 = client.request.get(url2, options);

    Promise.all([request1, request2]).then(function (dataResponse) {
      resolve(dataResponse);
    }, function (err) {
      reject(err)
    });
  });
}

function postFreshserviceData(url, options) {
  return new Promise(function (resolve, reject) {
    client.request.post(url, options).then(function (data) {
      resolve(data);
    }, function (err) {
      reject(err);
    });
  });
}

function showNotification(type, message) {
  client.interface.trigger("showNotify", {
    type: type,
    message: message
  });
}