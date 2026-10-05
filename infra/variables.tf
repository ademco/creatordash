variable "project_id" {
  description = "Google Cloud project ID, e.g. fan-insights-123456."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run and Artifact Registry. us-central1 is in the free tier."
  type        = string
  default     = "us-central1"
}

variable "bigquery_location" {
  description = "Where BigQuery stores the dataset. US is a multi-region and is in the free tier."
  type        = string
  default     = "US"
}

variable "image" {
  description = "Full container image name to run, set by scripts/deploy.sh after it pushes the image."
  type        = string
  default     = ""
}

variable "sample_data" {
  description = "Tells the dashboard the loaded numbers are made up, so it shows the sample-data note."
  type        = bool
  default     = true
}

variable "max_instances" {
  description = "Upper limit on Cloud Run containers. Keeps a traffic spike from becoming a big bill."
  type        = number
  default     = 2
}
