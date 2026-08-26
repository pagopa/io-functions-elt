# Use this file to import the wanted resources inside the state file, 
# remember to cleanup the import code blocks with a separate PR once the import has been completed successfully.
# Here is the documentation which explains how to use the import code block: https://developer.hashicorp.com/terraform/language/block/import

import {
  to = azurerm_resource_group.itn_elt
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01"
}

import {
  to = module.function_app_elt_itn.azurerm_key_vault_access_policy.function_elt_itn_kv_common
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-rg-common/providers/Microsoft.KeyVault/vaults/io-p-kv-common/objectId/7d3a8b8e-ca29-4761-b819-759051efab01"
}

import {
  to = module.function_app_elt_itn.azurerm_key_vault_access_policy.function_elt_itn_slot_staging_kv_common
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-rg-common/providers/Microsoft.KeyVault/vaults/io-p-kv-common/objectId/9a5e07b1-027f-49bf-97d1-57a40a792d11"
}

import {
  to = module.function_app_elt_itn.azurerm_monitor_diagnostic_setting.queue_diagnostic_setting
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Storage/storageAccounts/iopitneltstfn01/queueServices/default|io-p-fnelt-internal-st-queue-ds-01"
}

import {
  to = module.function_app_elt_itn.azurerm_monitor_scheduled_query_rules_alert_v2.profile_deletion_failure_alert_rule
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Insights/scheduledQueryRules/[CITIZEN-AUTH | iopfneltsdt] Failures on pdnd-io-cosmosdb-profile-deletion-failure-poison"
}

import {
  to = module.function_app_elt_itn.azurerm_monitor_scheduled_query_rules_alert_v2.profiles_failure_alert_rule
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Insights/scheduledQueryRules/[CITIZEN-AUTH | iopfneltsdt] Failures on pdnd-io-cosmosdb-profiles-failure-poison"
}

import {
  to = module.function_app_elt_itn.azurerm_monitor_scheduled_query_rules_alert_v2.service_preferences_failure_alert_rule
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Insights/scheduledQueryRules/[CITIZEN-AUTH | iopfneltsdt] Failures on pdnd-io-cosmosdb-service-preferences-failure-poison"
}

import {
  to = module.function_app_elt_itn.azurerm_storage_queue.pdnd-io-cosmosdb-profile-deletion-failure
  id = "https://iopitneltst02.queue.core.windows.net/pdnd-io-cosmosdb-profile-deletion-failure"
}

import {
  to = module.function_app_elt_itn.azurerm_storage_queue.pdnd-io-cosmosdb-profile-deletion-failure-poison
  id = "https://iopitneltst02.queue.core.windows.net/pdnd-io-cosmosdb-profile-deletion-failure-poison"
}

import {
  to = module.function_app_elt_itn.azurerm_storage_queue.pdnd-io-cosmosdb-profiles-failure
  id = "https://iopitneltst02.queue.core.windows.net/pdnd-io-cosmosdb-profiles-failure"
}

import {
  to = module.function_app_elt_itn.azurerm_storage_queue.pdnd-io-cosmosdb-profiles-failure-poison
  id = "https://iopitneltst02.queue.core.windows.net/pdnd-io-cosmosdb-profiles-failure-poison"
}

import {
  to = module.function_app_elt_itn.azurerm_storage_queue.pdnd-io-cosmosdb-service-preferences-failure
  id = "https://iopitneltst02.queue.core.windows.net/pdnd-io-cosmosdb-service-preferences-failure"
}

import {
  to = module.function_app_elt_itn.azurerm_storage_queue.pdnd-io-cosmosdb-service-preferences-failure-poison
  id = "https://iopitneltst02.queue.core.windows.net/pdnd-io-cosmosdb-service-preferences-failure-poison"
}

import {
  to = module.function_app_elt_itn.azurerm_storage_queue.pdnd-io-cosmosdb-services-failure
  id = "https://iopitneltst02.queue.core.windows.net/pdnd-io-cosmosdb-services-failure"
}

import {
  to = module.function_app_elt_itn.azurerm_storage_queue.pdnd-io-cosmosdb-services-failure-poison
  id = "https://iopitneltst02.queue.core.windows.net/pdnd-io-cosmosdb-services-failure-poison"
}

import {
  to = module.function_app_elt_itn.azurerm_storage_table.fneltcommands_itn
  id = "https://iopitneltst02.table.core.windows.net/Tables('fneltcommands')"
}

import {
  to = module.function_app_elt_itn.azurerm_storage_table.fnelterrors_itn
  id = "https://iopitneltst02.table.core.windows.net/Tables('fnelterrors')"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_linux_function_app.this
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Web/sites/io-p-itn-elt-func-01"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_linux_function_app_slot.this[0]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Web/sites/io-p-itn-elt-func-01/slots/staging"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_monitor_metric_alert.function_app_health_check[0]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Insights/metricAlerts/[io-p-itn-elt-func-01] Health Check Failed"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_monitor_metric_alert.storage_account_health_check[0]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Insights/metricAlerts/[iopitneltstfn01] Low Availability"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_private_endpoint.function_sites
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Network/privateEndpoints/io-p-itn-elt-func-pep-01"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_private_endpoint.st_blob
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Network/privateEndpoints/io-p-itn-elt-func-blob-pep-01"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_private_endpoint.st_file
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Network/privateEndpoints/io-p-itn-elt-func-file-pep-01"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_private_endpoint.st_queue
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Network/privateEndpoints/io-p-itn-elt-func-queue-pep-01"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_private_endpoint.staging_function_sites[0]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Network/privateEndpoints/io-p-itn-elt-staging-func-pep-01"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_role_assignment.function_storage_account_contributor
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Storage/storageAccounts/iopitneltstfn01/providers/Microsoft.Authorization/roleAssignments/2804e55f-c1f2-ea55-712d-b02e5175b43e"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_role_assignment.function_storage_blob_data_owner
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Storage/storageAccounts/iopitneltstfn01/providers/Microsoft.Authorization/roleAssignments/57b669b8-c7ca-d3fd-456f-b514e29f9f92"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_role_assignment.function_storage_queue_data_contributor
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Storage/storageAccounts/iopitneltstfn01/providers/Microsoft.Authorization/roleAssignments/d9b8c900-119a-ef1b-ca6a-3600e569944e"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_role_assignment.staging_function_storage_account_contributor[0]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Storage/storageAccounts/iopitneltstfn01/providers/Microsoft.Authorization/roleAssignments/c649241c-dbb2-62bb-cd61-70cfd747c4ca"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_role_assignment.staging_function_storage_blob_data_owner[0]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Storage/storageAccounts/iopitneltstfn01/providers/Microsoft.Authorization/roleAssignments/f8df3a94-199d-728e-0995-fef823028301"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_role_assignment.staging_function_storage_queue_data_contributor[0]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Storage/storageAccounts/iopitneltstfn01/providers/Microsoft.Authorization/roleAssignments/ad1def11-13bf-377e-bc45-6f89ec363755"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_service_plan.this[0]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Web/serverFarms/io-p-itn-elt-asp-01"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_storage_account.this
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Storage/storageAccounts/iopitneltstfn01"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_storage_account_network_rules.st_network_rules
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Storage/storageAccounts/iopitneltstfn01"
}

import {
  to = module.function_app_elt_itn.module.function_elt_itn.azurerm_subnet.this[0]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-common-rg-01/providers/Microsoft.Network/virtualNetworks/io-p-itn-common-vnet-01/subnets/io-p-itn-elt-func-snet-01"
}

import {
  to = module.function_app_elt_itn.module.storage_account_itn_elt.azurerm_monitor_metric_alert.storage_account_health_check[0]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Insights/metricAlerts/[iopitneltst02] Low Availability"
}

import {
  to = module.function_app_elt_itn.module.storage_account_itn_elt.azurerm_private_endpoint.this["blob"]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Network/privateEndpoints/io-p-itn-elt-blob-pep-02"
}

import {
  to = module.function_app_elt_itn.module.storage_account_itn_elt.azurerm_private_endpoint.this["queue"]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Network/privateEndpoints/io-p-itn-elt-queue-pep-02"
}

import {
  to = module.function_app_elt_itn.module.storage_account_itn_elt.azurerm_private_endpoint.this["table"]
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Network/privateEndpoints/io-p-itn-elt-table-pep-02"
}

import {
  to = module.function_app_elt_itn.module.storage_account_itn_elt.azurerm_storage_account.this
  id = "/subscriptions/ec285037-c673-4f58-b594-d7c480da4e8b/resourceGroups/io-p-itn-elt-rg-01/providers/Microsoft.Storage/storageAccounts/iopitneltst02"
}
