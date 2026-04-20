CREATE TABLE IF NOT EXISTS pull_request_files (
  id                BIGINT        AUTO_INCREMENT PRIMARY KEY,
  pull_request_id   VARCHAR(255)  NOT NULL  COMMENT 'FK → pull_requests.id',
  repo_id           VARCHAR(255)  NOT NULL  COMMENT 'FK → repos.id',
  repo_name         VARCHAR(255)  NOT NULL  COMMENT 'owner/repo',
  pr_number         BIGINT        NOT NULL,
  filename          TEXT          NOT NULL,
  status            VARCHAR(50)             COMMENT 'added|modified|removed|renamed|copied|changed|unchanged',
  additions         INT           NOT NULL  DEFAULT 0,
  deletions         INT           NOT NULL  DEFAULT 0,
  changes           INT           NOT NULL  DEFAULT 0,
  previous_filename TEXT                    COMMENT 'populated only for renamed files',
  blob_url          TEXT,
  synced_at         DATETIME(3)   NOT NULL  DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_pr_id   (pull_request_id),
  INDEX idx_repo_pr (repo_id, pr_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
