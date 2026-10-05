# Everything Fan Insights needs in Google Cloud. `terraform plan` shows what
# would change; `terraform apply` makes it so. See docs/DEPLOY.md.

locals {
  services = [
    "run.googleapis.com",              # Cloud Run: runs the container
    "artifactregistry.googleapis.com", # stores the container image
    "bigquery.googleapis.com",         # the data warehouse
    "iam.googleapis.com",              # service accounts and permissions
  ]
  labels = { app = "fan-insights" }
}

# A new project has most APIs switched off. Leave them on when destroying, so
# `terraform destroy` doesn't break anything else that uses them.
resource "google_project_service" "apis" {
  for_each           = toset(local.services)
  service            = each.value
  disable_on_destroy = false
}

# --- Container registry -----------------------------------------------------

resource "google_artifact_registry_repository" "app" {
  repository_id = "fan-insights"
  location      = var.region
  format        = "DOCKER"
  description   = "Fan Insights container images"
  labels        = local.labels

  # Storage costs money after 0.5 GB, so keep the 5 newest images and
  # delete anything else older than 30 days.
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 5
    }
  }
  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"
    condition {
      older_than = "2592000s"
    }
  }

  depends_on = [google_project_service.apis]
}

# --- BigQuery ---------------------------------------------------------------

resource "google_bigquery_dataset" "fan_insights" {
  dataset_id  = "fan_insights"
  location    = var.bigquery_location
  description = "Audience and content numbers for the Fan Insights dashboard"
  labels      = local.labels

  # A portfolio project should be easy to tear down. In production you'd set
  # this to false so a destroy can't delete real data.
  delete_contents_on_destroy = true

  depends_on = [google_project_service.apis]
}

# Same columns as the CSV files (see CLAUDE.md, "Data model").
resource "google_bigquery_table" "audience" {
  dataset_id          = google_bigquery_dataset.fan_insights.dataset_id
  table_id            = "audience"
  description         = "One row per platform per day"
  deletion_protection = false
  labels              = local.labels

  schema = jsonencode([
    { name = "date", type = "DATE", mode = "REQUIRED", description = "YYYY-MM-DD" },
    { name = "platform", type = "STRING", mode = "REQUIRED", description = "spotify, youtube, twitch, kick, tiktok" },
    { name = "audience", type = "INT64", mode = "REQUIRED", description = "Followers, subscribers, or Spotify monthly listeners" },
  ])
}

resource "google_bigquery_table" "content" {
  dataset_id          = google_bigquery_dataset.fan_insights.dataset_id
  table_id            = "content"
  description         = "One row per release, video, stream, or short"
  deletion_protection = false
  labels              = local.labels

  schema = jsonencode([
    { name = "published_date", type = "DATE", mode = "REQUIRED", description = "YYYY-MM-DD" },
    { name = "platform", type = "STRING", mode = "REQUIRED", description = "spotify, youtube, twitch, kick, tiktok" },
    { name = "content_type", type = "STRING", mode = "REQUIRED", description = "release, video, stream, short" },
    { name = "title", type = "STRING", mode = "REQUIRED" },
    { name = "views", type = "INT64", mode = "REQUIRED", description = "Streams, views, or peak viewers" },
  ])
}

# --- Identity: what the running app is allowed to do -------------------------

# The app runs as its own service account instead of the default one, which
# has broad Editor rights on the whole project.
resource "google_service_account" "app" {
  account_id   = "fan-insights-run"
  display_name = "Fan Insights (Cloud Run)"
  description  = "Runs the dashboard. Can read the fan_insights dataset and nothing else."
  depends_on   = [google_project_service.apis]
}

# Read the tables in this one dataset only...
resource "google_bigquery_dataset_iam_member" "app_reads_dataset" {
  dataset_id = google_bigquery_dataset.fan_insights.dataset_id
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${google_service_account.app.email}"
}

# ...and run query jobs. Reading data and running queries are separate
# permissions in BigQuery; a query is a "job" billed to a project.
resource "google_project_iam_member" "app_runs_queries" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.app.email}"
}

# --- Cloud Run ----------------------------------------------------------------

resource "google_cloud_run_v2_service" "app" {
  name                = "fan-insights"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false
  labels              = local.labels

  template {
    service_account = google_service_account.app.email

    # Scale to zero: no requests, no containers, no cost. The first visit
    # after a quiet spell waits a second or two for a container to start.
    scaling {
      min_instance_count = 0
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      env {
        name  = "DATA_SOURCE"
        value = "bigquery"
      }
      env {
        name  = "BQ_PROJECT"
        value = var.project_id
      }
      env {
        name  = "BQ_DATASET"
        value = google_bigquery_dataset.fan_insights.dataset_id
      }
      env {
        name  = "BQ_LOCATION"
        value = var.bigquery_location
      }
      env {
        name  = "SAMPLE_DATA"
        value = tostring(var.sample_data)
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        # Only pay for CPU while a request is being handled.
        cpu_idle = true
      }

      startup_probe {
        http_get {
          path = "/healthz"
        }
      }
    }
  }

  lifecycle {
    precondition {
      condition     = var.image != ""
      error_message = "Set var.image to a pushed container image. scripts/deploy.sh does this for you."
    }
  }

  depends_on = [
    google_project_service.apis,
    google_bigquery_dataset_iam_member.app_reads_dataset,
    google_project_iam_member.app_runs_queries,
  ]
}

# Anyone with the URL can view the dashboard. It's a public portfolio demo.
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.app.name
  location = google_cloud_run_v2_service.app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
