## Problem Statement
If the customer has multiple Freshservice accounts based on the region or some other criteria, the tickets would be arriving to a primary/global account which the customer might have considered as a global account.

The agents will analyse the ticket, if it needs more insight then it will be forwarded to the relevant sub account. The agent from the sub account will be providing the necessary information to help the agent in the global account on the same ticket as a private note, so that those content will be hidden from the customer.

## Problem Solution
Now, the solution is to sync the same ticket on both the accounts. When the agent from the global account thinks that the particular ticket needs an insight from the agent in the sub account ,the agent will create a ticket to the respective sub-account. When the agent at the sub-account responds/replies to the ticket, the response needs to be reflected in the primary account ticket too as a private note.

Thus, there will exist two different accounts for the ticket with better management since the work will be distributed. Since, we need to know the id of the ticket in the primary account, it will be passed to the sub-account ticket for reference and also for easy access with API calls. Naturally, it will also be necessary to pass the sub-account details in the IParams too.One of the cons of this use-case is that, since we are addressing the same issue via two different accounts, it will lead to few more API calls.

But, the management will become easier and the time required to resolve any particular issue will decrease considerably. Also, since these are multiple accounts, the chances of them hitting their individual API limits are quite low. Considering the above points, the pros of this project outweigh the cons and hence it might actually be a very useful feature to incorporate into a FreshService account.

*Note:* This project is based on FreshService, but it can be incorporated into most other Freshworks products too.

## Precaustics
Form Fields need to created

1. Other Account Domain
2. Other Account Ticket ID
3. Other Account Ticket Status
4. Reply to Other Account

## Your First App

Congratulations on creating your first app! Feel free to replace this text with your app's actual description.

### Folder structure explained

    .
    ├── README.md                  This file
    ├── app                        Contains the files that are required for the front end component of the app
    │   ├── app.js                 JS to render the dynamic portions of the app
    │   ├── icon.svg               Sidebar icon SVG file. Should have a resolution of 64x64px.
    │   ├── freshservice_logo.png  The Freshservice logo that is displayed in the app
    │   ├── style.css              Style sheet for the app
    │   ├── template.html          Contains the HTML required for the app’s UI
    ├── config                     Contains the installation parameters and OAuth configuration
    │   ├── iparams.json           Contains the parameters that will be collected during installation
    │   └── iparam_test_data.json  Contains sample Iparam values that will used during testing
    └── manifest.json              Contains app meta data and configuration information
