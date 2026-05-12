data "azurerm_subscription" "current" {}

data "azurerm_container_app_environment" "runner" {
  name                = local.runner.cae_name
  resource_group_name = local.runner.cae_resource_group_name
}

data "azurerm_key_vault" "common" {
  name                = local.key_vault.name
  resource_group_name = local.key_vault.resource_group_name
}

data "azurerm_resource_group" "dns_zones" {
  name = local.dns_zones.resource_group_name
}

data "azurerm_resource_group" "dashboards" {
  name = "dashboards"
}

data "azurerm_resource_group" "common_itn" {
  name = "${local.prefix}-${local.env_short}-itn-common-rg-01"
}

data "azuread_group" "admins" {
  display_name = local.adgroups.admins_name
}

data "azuread_group" "developers" {
  display_name = local.adgroups.devs_name
}

data "azurerm_resource_group" "elt_itn" {
  name = "${local.prefix}-${local.env_short}-itn-elt-rg-01"
}