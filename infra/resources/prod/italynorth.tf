resource "azurerm_resource_group" "itn_elt" {
  name     = format("%s-elt-rg-01", local.project)
  location = local.location

  tags = local.tags
}

module "function_app_elt_itn" {
  source                                     = "../_modules/function_app_elt"
  prefix                                     = local.prefix
  env_short                                  = local.env_short
  project_weu_legacy                         = local.project_legacy
  resource_group_name                        = azurerm_resource_group.itn_elt.name
  secondary_location_display_name            = local.secondary_location_display_name
  location_itn                               = local.location
  vnet_common_name_itn                       = local.vnet_common_name_itn
  common_resource_group_name_itn             = local.common_resource_group_name_itn
  elt_snet_cidr                              = local.subnet_cidr
  cosmos_db_attributes                       = local.platform_data_platform.cosmos_api.weu
  application_insights_connection_string     = local.platform_observability.monitoring_westeurope.appi_connection_string
  application_insights_error_action_group_id = local.platform_observability.monitoring_westeurope.action_groups.error
  application_insights_instrumentation_key   = local.platform_observability.monitoring_westeurope.appi_instrumentation_key
  law_id                                     = local.platform_observability.monitoring_westeurope.log.id
  tags                                       = local.tags
}
