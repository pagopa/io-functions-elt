resource "azurerm_resource_group" "itn_elt" {
  name     = format("%s-elt-rg-01", local.project_itn)
  location = var.location_itn

  tags = var.tags
}

module "function_app_elt" {
  source                          = "../_modules/function_elt"
  prefix                          = local.prefix
  env_short                       = local.env_short
  project_weu_legacy              = local.project_weu_legacy
  secondary_location_display_name = local.function_elt.secondary_location_display_name
  location_itn                    = local.function_elt.location_itn
  vnet_common_name_itn            = local.function_elt.vnet_common_name_itn
  common_resource_group_name_itn  = local.function_elt.common_resource_group_name_itn
  elt_snet_cidr                   = local.function_elt.elt_snet_cidr
  tags                            = local.function_elt.tags
}
