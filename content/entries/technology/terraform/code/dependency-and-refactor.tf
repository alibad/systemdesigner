terraform {
  required_version = ">= 1.5.0"
}

variable "network_revision" {
  description = "A reviewed revision identifier for the network contract."
  type        = string
  default     = "2026-07-01"
}

resource "terraform_data" "network_contract" {
  input = {
    revision = var.network_revision
  }
}

resource "terraform_data" "service_release" {
  input = {
    # This expression carries data and creates an implicit dependency.
    network_contract_id = terraform_data.network_contract.id
    release             = "checkout-2026.07"
  }
}

resource "terraform_data" "smoke_check" {
  input = {
    service_id = terraform_data.service_release.id
  }

  # Use depends_on only for behavior Terraform cannot infer from expressions.
  depends_on = [terraform_data.service_release]
}

# Preserve the remote-object binding if this resource used to be named
# terraform_data.application. Terraform handles the address change in state
# before it constructs the plan.
moved {
  from = terraform_data.application
  to   = terraform_data.service_release
}
