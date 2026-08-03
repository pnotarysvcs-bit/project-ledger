# Project Ledger

## Production recovery

This checkout does not currently contain the production application's source code or a deployment manifest. It only contained a placeholder GitHub Actions workflow when the production incident was reported. Deploying this revision cannot produce a working application.

Before the next production deployment:

1. Identify the last known-good production deployment in the hosting provider and promote or roll it back to restore service.
2. Restore the application source and deployment configuration from the correct repository, branch, or backup.
3. Confirm `./scripts/check-deploy-readiness.sh` succeeds. Dependency lockfiles by themselves intentionally do not pass this check.
4. Run the restored application's build and test suite, then deploy through the normal production pipeline.

The deployment-readiness workflow deliberately fails while the application source is absent. This prevents a placeholder-only revision from appearing safe to deploy.
