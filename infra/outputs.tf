output "url" {
  description = "Public URL of the dashboard"
  value       = google_cloud_run_v2_service.app.uri
}

output "image_repository" {
  description = "Where scripts/deploy.sh pushes images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "service_account" {
  description = "Identity the dashboard runs as"
  value       = google_service_account.app.email
}
