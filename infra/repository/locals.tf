locals {
  repository = {
    name                     = "io-functions-elt"
    description              = "Functions for ELT processes for PDND data exports"
    topics                   = ["io", "functions", "elt", "pdnd"]
    reviewers_teams          = ["io-platform-admin", "io-communication-backend", "io-auth-n-identity-backend"]
    default_branch_name      = "main"
    infra_cd_policy_branches = ["main"]
    opex_cd_policy_branches  = ["main"]
    app_cd_policy_branches   = ["main"]
    jira_boards_ids          = ["IOPLT", "IOCOM", "IOPID"]
  }
}