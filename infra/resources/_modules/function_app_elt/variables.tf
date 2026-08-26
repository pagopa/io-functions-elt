variable "prefix" {
  type    = string
  default = "io"
  validation {
    condition = (
      length(var.prefix) < 6
    )
    error_message = "Max length is 6 chars."
  }
}

variable "env_short" {
  type = string
  validation {
    condition = (
      length(var.env_short) <= 1
    )
    error_message = "Max length is 1 chars."
  }
}

variable "project_weu_legacy" {
  type        = string
  description = "IO prefix and short environment"
}

variable "secondary_location_display_name" {
  type        = string
  description = "Azure redundancy region display name"
}

variable "location_itn" {
  type    = string
  default = "italynorth"
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group that will contain all the created resources"
}

variable "tags" {
  type        = map(any)
  description = "Resource tags"
}

variable "vnet_common_name_itn" {
  type = string
}

variable "common_resource_group_name_itn" {
  type = string
}

variable "elt_snet_cidr" {
  type        = string
  description = "ELT Services Subnet CIDR"
}

variable "cosmos_db_attributes" {
  type        = map(any)
  sensitive   = true
  description = "Informations about the Cosmos DB, such as primary key and endpoint"
}

variable "application_insights_error_action_group_id" {
  type        = string
  description = "Application Insights error action group id"
}

variable "application_insights_instrumentation_key" {
  type        = string
  sensitive   = true
  description = "Application Insight instrumentation key"
}

variable "application_insights_connection_string" {
  type        = string
  sensitive   = true
  description = "Application Insight connection string"
}

variable "law_id" {
  type        = string
  description = "Log Analytics Workspace id"
}
