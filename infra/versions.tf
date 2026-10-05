terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }

  # State is kept in a local file (infra/terraform.tfstate, git-ignored).
  # Fine for one person; a team would store it in a GCS bucket with locking.
}

provider "google" {
  project = var.project_id
  region  = var.region
}
