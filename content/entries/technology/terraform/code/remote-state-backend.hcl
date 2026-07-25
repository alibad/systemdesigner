terraform {
  backend "s3" {
    bucket       = "example-terraform-state"
    key          = "payments/prod/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

# This example is specific to Terraform's Amazon S3 backend.
# Enable S3 bucket versioning separately and grant least-privilege access to
# both the state object and its .tflock object. Supply credentials through the
# execution environment, never in this backend block.
