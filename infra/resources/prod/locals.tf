locals {
  prefix    = "io"
  env_short = "p"

  location       = "italynorth"
  location_short = "itn"

  project        = "${local.prefix}-${local.env_short}-${local.location_short}"
  project_legacy = "${local.prefix}-${local.env_short}"

  platform_data_platform = data.terraform_remote_state.platform_data_platform.outputs

  secondary_location_display_name = "North Europe"

  vnet_common_name_itn           = "${local.project}-common-vnet-01"
  common_resource_group_name_itn = "${local.project}-common-rg-01"

  subnet_cidr = "10.20.40.0/26"

  tags = {
    CostCenter     = "TS000 - Tecnologia e Servizi"
    CreatedBy      = "Terraform"
    Environment    = "Prod"
    BusinessUnit   = "App IO"
    Source         = "https://github.com/pagopa/io-functions-elt/blob/main/infra/resources/prod"
    ManagementTeam = "IO Platform"
  }
}
